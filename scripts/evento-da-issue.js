#!/usr/bin/env node
/**
 * Turn a filled-in issue form into an entry in config.yaml.
 *
 * Reads the issue body from ISSUE_BODY and never from an argument, so the
 * untrusted text is not interpolated into a shell command anywhere along the
 * way. It writes through the YAML document API rather than by string
 * concatenation, which keeps the file's comments and lets the parser worry
 * about quoting whatever someone typed.
 *
 * The result is validated against the same schema the site build uses, so an
 * event that would break the page is rejected here instead of on main.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';
import YAML from 'yaml';

import { parseConfig, ConfigError } from '../schema/config.schema.js';
import { slugify } from '../lib/slug.js';

const CONFIG = new URL('../config.yaml', import.meta.url);
const PASTA_FOTOS = fileURLToPath(new URL('../src/assets/eventos/', import.meta.url));

/**
 * Formatos que o site sabe servir. A chave é o content-type que o servidor
 * declara, e o valor vira a extensão do arquivo guardado.
 */
const TIPOS_DE_IMAGEM = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

/** Acima disso a miniatura não vale o que custa no celular de quem visita. */
const PESO_MAXIMO = 5 * 1024 * 1024;

/** GitHub writes this into every field the person left empty. */
const VAZIO = '_No response_';

/**
 * Issue forms render as `### Label` followed by the value. Splitting on the
 * headings is enough, and avoids depending on a third-party parser action.
 * @param {string} body
 * @returns {Map<string, string>}
 */
export function parseIssueForm(body) {
  const campos = new Map();
  const partes = String(body).split(/^###\s+/m).slice(1);

  for (const parte of partes) {
    const quebra = parte.indexOf('\n');
    if (quebra === -1) continue;
    const rotulo = parte.slice(0, quebra).trim();
    const valor = parte.slice(quebra + 1).trim();
    campos.set(rotulo, valor === VAZIO ? '' : valor);
  }
  return campos;
}

/**
 * `21/09/2026` and `19:00` into the `AAAA-MM-DDTHH:MM` the schema expects.
 * Returns null when either piece is malformed, and the caller reports it.
 * @param {string} data
 * @param {string} hora
 */
export function paraIso(data, hora) {
  // Um ou dois dígitos: quem preenche escreve 1/9/2026 tanto quanto 01/09/2026.
  const d = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(data.trim());
  if (!d) return null;
  const dia = d[1].padStart(2, '0');
  const mes = d[2].padStart(2, '0');
  const ano = d[3];

  if (!hora.trim()) return `${ano}-${mes}-${dia}`;
  const h = /^(\d{1,2}):(\d{2})$/.exec(hora.trim());
  if (!h) return null;
  return `${ano}-${mes}-${dia}T${String(h[1]).padStart(2, '0')}:${h[2]}`;
}

/**
 * O campo da foto aceita três coisas, porque as três acontecem: a pessoa cola
 * a imagem e o GitHub a transforma em markdown, cola o HTML de uma imagem, ou
 * cola o endereço cru.
 * @param {string} campo
 * @returns {string | null}
 */
export function extrairUrlDaFoto(campo) {
  const texto = String(campo ?? '').trim();
  if (!texto) return null;

  const markdown = /!\[[^\]]*\]\(\s*(\S+?)\s*\)/.exec(texto);
  const html = /<img[^>]+src\s*=\s*["']([^"']+)["']/i.exec(texto);
  const bruto = /https:\/\/\S+/.exec(texto);

  const achado = markdown?.[1] ?? html?.[1] ?? bruto?.[0] ?? null;
  if (achado === null) return null;

  let url;
  try {
    url = new URL(achado);
  } catch {
    return null;
  }
  // Só https: o build baixa esse endereço, e http seria interceptável.
  return url.protocol === 'https:' ? url.href : null;
}

/**
 * O formulário publica direto no site, então a mesma issue não pode entrar
 * duas vezes. Título e início identificam o evento: a mesma atividade se
 * repete ao longo da semana, mas nunca no mesmo horário.
 * @param {object[]} eventos
 * @param {object} evento
 */
export function jaTemEvento(eventos, evento) {
  return eventos.some((atual) => atual.title === evento.title && atual.start === evento.start);
}

/**
 * @param {Map<string, string>} campos
 * @returns {{evento: object, erros: string[]}}
 */
export function montarEvento(campos) {
  const erros = [];
  const ler = (rotulo) => (campos.get(rotulo) ?? '').trim();

  const titulo = ler('Título do evento');
  if (!titulo) erros.push('O título está vazio.');

  const data = ler('Data');
  const inicio = paraIso(data, ler('Hora de início'));
  if (!inicio) {
    erros.push(
      `Não entendi a data "${data}" com a hora "${ler('Hora de início')}". ` +
        'Use dia/mês/ano, como 21/09/2026, e hora:minuto, como 19:00.',
    );
  }

  // Sem último dia, o término é no mesmo dia do início.
  const dataFim = ler('Último dia') || data;
  const horaFim = ler('Hora de término');
  let fim = null;
  if (horaFim || ler('Último dia')) {
    fim = paraIso(dataFim, horaFim);
    if (!fim) erros.push(`Não entendi o término "${dataFim} ${horaFim}".`);
  }

  const evento = { title: titulo, start: inicio };
  if (fim) evento.end = fim;

  const tipo = ler('Tipo de atividade');
  if (tipo && tipo !== 'Outro') evento.kind = tipo;

  const link = ler('Link para mais informações');
  if (link) evento.url = link;

  const descricao = ler('Descrição');
  if (descricao) evento.description = descricao.replace(/\s+/g, ' ');

  return { evento, erros };
}

/**
 * Baixa a foto para dentro do repositório. Guardar a imagem aqui, em vez de
 * apontar para o endereço de origem, evita que o navegador de quem visita a
 * agenda entregue o IP a um servidor de terceiro, e evita que o cartão quebre
 * no dia em que a imagem sair do ar lá.
 *
 * @param {string} url
 * @param {object} evento
 * @returns {Promise<string>} caminho relativo para gravar no config.yaml
 */
export async function baixarFoto(url, evento) {
  let resposta;
  try {
    resposta = await fetch(url, { redirect: 'follow' });
  } catch (causa) {
    throw new Error(`Não consegui acessar a foto em ${url}. ${causa.message}`, { cause: causa });
  }

  if (!resposta.ok) {
    throw new Error(`A foto em ${url} respondeu ${resposta.status}. Confira se o endereço é público.`);
  }

  const tipo = (resposta.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  const extensao = TIPOS_DE_IMAGEM[tipo];
  if (!extensao) {
    throw new Error(
      `Esse endereço não devolveu uma imagem, e sim "${tipo || 'nada'}". ` +
        'Aceito JPG, PNG e WebP. Se você colou o link de uma página, abra a foto e copie o endereço dela.',
    );
  }

  const bytes = new Uint8Array(await resposta.arrayBuffer());
  if (bytes.byteLength > PESO_MAXIMO) {
    const mb = (bytes.byteLength / 1024 / 1024).toFixed(1);
    throw new Error(`A foto tem ${mb} MB, e o limite é 5 MB. Reduza a imagem e envie de novo.`);
  }

  const nome = `${slugify(evento.title, evento.start)}.${extensao}`;
  const pasta = process.env.PASTA_FOTOS ?? PASTA_FOTOS;
  await mkdir(pasta, { recursive: true });
  await writeFile(path.join(pasta, nome), bytes);

  console.log(`Foto guardada: src/assets/eventos/${nome} (${Math.round(bytes.byteLength / 1024)} kB)`);
  return `assets/eventos/${nome}`;
}

async function principal() {
  const body = process.env.ISSUE_BODY;
  if (!body) {
    console.error('ISSUE_BODY não veio no ambiente.');
    process.exit(1);
  }

  const campos = parseIssueForm(body);
  const { evento, erros } = montarEvento(campos);
  if (erros.length > 0) {
    console.error(erros.map((e) => `- ${e}`).join('\n'));
    process.exit(1);
  }

  const bruto = await readFile(CONFIG, 'utf8');
  const doc = YAML.parseDocument(bruto);

  const atual = doc.toJS();

  // Sai sem escrever nada, e quem chamou percebe pelo arquivo intacto. É o que
  // acontece quando a issue é editada ou reaberta depois de já publicada.
  if (jaTemEvento(atual.events ?? [], evento)) {
    console.log(`Esse evento já está na agenda: ${evento.title} (${evento.start})`);
    return;
  }

  const foto = extrairUrlDaFoto(campos.get('Foto do evento'));
  if (foto) {
    try {
      evento.image = await baixarFoto(foto, evento);
    } catch (error) {
      console.error(`${error.message}\n\nPara publicar sem foto, apague o conteúdo do campo Foto do evento.`);
      process.exit(1);
    }
  }

  const eventos = [...(atual.events ?? []), evento];

  // A mesma validação do build: se quebraria o site, para aqui.
  try {
    parseConfig({ ...atual, events: eventos }, { source: 'config.yaml' });
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }

  // Anexa ao nó existente em vez de trocar a lista inteira: substituir faria o
  // YAML reescrever todos os eventos, e o diff do PR ficaria ilegível para
  // quem só quer conferir o que foi adicionado.
  const lista = doc.get('events');
  if (lista && typeof lista.add === 'function') lista.add(doc.createNode(evento));
  else doc.set('events', eventos);

  await writeFile(CONFIG, doc.toString({ lineWidth: 96 }));

  console.log(`Evento adicionado: ${evento.title} (${evento.start})`);
}

// Só executa quando chamado direto, para os testes poderem importar as funções.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  await principal();
}

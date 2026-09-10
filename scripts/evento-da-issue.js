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
import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';
import YAML from 'yaml';

import { parseConfig, ConfigError } from '../schema/config.schema.js';

const CONFIG = new URL('../config.yaml', import.meta.url);

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

async function principal() {
  const body = process.env.ISSUE_BODY;
  if (!body) {
    console.error('ISSUE_BODY não veio no ambiente.');
    process.exit(1);
  }

  const { evento, erros } = montarEvento(parseIssueForm(body));
  if (erros.length > 0) {
    console.error(erros.map((e) => `- ${e}`).join('\n'));
    process.exit(1);
  }

  const bruto = await readFile(CONFIG, 'utf8');
  const doc = YAML.parseDocument(bruto);

  const atual = doc.toJS();
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

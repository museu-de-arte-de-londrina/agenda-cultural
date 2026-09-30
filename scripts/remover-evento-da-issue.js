#!/usr/bin/env node
/**
 * Tira do config.yaml o evento pedido pelo formulário "Remover evento".
 *
 * O avesso de evento-da-issue.js, com os mesmos cuidados: o corpo da issue
 * chega por ISSUE_BODY e a escrita passa pela API de documento do YAML, que
 * mexe só no bloco removido e preserva os comentários do resto do arquivo.
 *
 * O evento é achado por título e data, as duas coisas que aparecem no cartão.
 * A hora só é necessária quando o mesmo título tem mais de uma sessão no dia.
 */
import { readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';
import YAML from 'yaml';

import { parseIssueForm, paraIso } from './evento-da-issue.js';

const CONFIG = new URL('../config.yaml', import.meta.url);
const PASTA_SRC = fileURLToPath(new URL('../src/', import.meta.url));

/** Quem copia o título do cartão às vezes traz espaço a mais ou muda a caixa. */
const normalizar = (texto) => String(texto ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * @param {object[]} eventos como estão no config.yaml
 * @param {Map<string, string>} campos
 * @returns {{indice: number, erro?: undefined} | {indice?: undefined, erro: string}}
 */
export function acharEvento(eventos, campos) {
  const ler = (rotulo) => (campos.get(rotulo) ?? '').trim();
  const titulo = ler('Título do evento');
  const data = ler('Data');
  const hora = ler('Hora de início');

  if (!titulo) return { erro: 'O título está vazio.' };
  const dia = paraIso(data, '');
  if (!dia) return { erro: `Não entendi a data "${data}". Use dia/mês/ano, como 21/09/2026.` };
  const inicio = hora ? paraIso(data, hora) : null;
  if (hora && !inicio) return { erro: `Não entendi a hora "${hora}". Use hora:minuto, como 19:00.` };

  const noDia = eventos
    .map((evento, indice) => ({ evento, indice }))
    .filter(({ evento }) => String(evento.start).slice(0, 10) === dia);
  const achados = noDia.filter(
    ({ evento }) =>
      normalizar(evento.title) === normalizar(titulo) && (!inicio || String(evento.start) === inicio),
  );

  if (achados.length === 1) return { indice: achados[0].indice };

  if (achados.length > 1) {
    const horas = achados.map(({ evento }) => String(evento.start).slice(11) || 'dia todo');
    return {
      erro: `Há ${achados.length} sessões de "${titulo}" em ${data} (${horas.join(', ')}). Preencha a hora de início para dizer qual.`,
    };
  }

  // Sem achado, mostrar o que existe no dia resolve quase todo erro de digitação.
  const lista = noDia.map(({ evento }) => `  - ${evento.title} (${String(evento.start).slice(11) || 'dia todo'})`);
  return {
    erro:
      `Não achei "${titulo}"${inicio ? ` às ${hora}` : ''} em ${data}.` +
      (lista.length ? `\n\nNesse dia a agenda tem:\n${lista.join('\n')}` : '\n\nNão há nenhum evento nesse dia.'),
  };
}

/**
 * A foto só sai do repositório quando veio do formulário e nenhum outro item
 * da página usa o mesmo arquivo.
 * @param {object} config
 * @param {string | undefined} imagem
 */
export function fotoOrfa(config, imagem) {
  // O caminho vem do config.yaml, e mesmo assim não sai da pasta das fotos.
  if (!imagem?.startsWith('assets/eventos/') || path.posix.normalize(imagem) !== imagem) return false;
  const usos = [...(config.events ?? []), ...(config.ongoing ?? [])].filter((item) => item.image === imagem);
  return usos.length === 0;
}

async function principal() {
  const body = process.env.ISSUE_BODY;
  if (!body) {
    console.error('ISSUE_BODY não veio no ambiente.');
    process.exit(1);
  }

  const doc = YAML.parseDocument(await readFile(CONFIG, 'utf8'));
  const atual = doc.toJS();

  const { indice, erro } = acharEvento(atual.events ?? [], parseIssueForm(body));
  if (erro) {
    console.error(erro);
    process.exit(1);
  }

  const [removido] = atual.events.splice(indice, 1);
  const lista = doc.get('events');
  // Os índices do documento e do toJS andam juntos; a conferência garante.
  if (lista.items[indice]?.get('title') !== removido.title) {
    console.error('O config.yaml mudou de forma inesperada. Remova este evento à mão.');
    process.exit(1);
  }
  lista.items.splice(indice, 1);
  await writeFile(CONFIG, doc.toString({ lineWidth: 96 }));

  if (fotoOrfa(atual, removido.image)) {
    await rm(path.join(PASTA_SRC, removido.image), { force: true });
    console.log(`Foto apagada: src/${removido.image}`);
  }

  console.log(`Evento removido: ${removido.title} (${removido.start})`);
}

// Só executa quando chamado direto, para os testes poderem importar as funções.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  await principal();
}

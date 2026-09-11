import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';

import {
  parseIssueForm,
  paraIso,
  montarEvento,
  jaTemEvento,
  extrairUrlDaFoto,
  baixarFoto,
  ordenarCampos,
} from '../scripts/evento-da-issue.js';

/** O formato que o GitHub gera a partir do formulário. */
function corpo(campos) {
  return Object.entries(campos)
    .map(([rotulo, valor]) => `### ${rotulo}\n\n${valor || '_No response_'}\n`)
    .join('\n');
}

const COMPLETO = {
  'Título do evento': 'Apresentação de Taiko',
  Data: '21/09/2026',
  'Hora de início': '19:00',
  'Hora de término': '20:00',
  'Último dia': '',
  'Tipo de atividade': 'Show Musical',
  Descrição: 'Tambores japoneses, pelo 22º Londrina Matsuri.',
  'Link para mais informações': 'https://example.org/taiko',
};

test('lê os campos do formulário e trata os vazios', () => {
  const campos = parseIssueForm(corpo(COMPLETO));
  assert.equal(campos.get('Título do evento'), 'Apresentação de Taiko');
  assert.equal(campos.get('Último dia'), '', '_No response_ vira campo vazio');
  assert.equal(campos.size, 8);
});

test('converte data brasileira, com um ou dois dígitos', () => {
  assert.equal(paraIso('21/09/2026', '19:00'), '2026-09-21T19:00');
  assert.equal(paraIso('5/10/2026', '9:30'), '2026-10-05T09:30', 'dia e hora com um dígito');
  assert.equal(paraIso('21/09/2026', ''), '2026-09-21', 'sem hora, fica só a data');
  assert.equal(paraIso('  21/09/2026  ', ' 19:00 '), '2026-09-21T19:00', 'espaços das pontas');
});

test('recusa o que não é data', () => {
  for (const [data, hora] of [
    ['2026-09-21', '19:00'],
    ['21-09-2026', '19:00'],
    ['21/09/26', '19:00'],
    ['amanhã', '19:00'],
    ['', ''],
    ['21/09/2026', '19h'],
    ['21/09/2026', '19'],
  ]) {
    assert.equal(paraIso(data, hora), null, `deveria recusar ${data} ${hora}`);
  }
});

test('monta o evento com tudo preenchido', () => {
  const { evento, erros } = montarEvento(parseIssueForm(corpo(COMPLETO)));
  assert.deepEqual(erros, []);
  assert.deepEqual(evento, {
    title: 'Apresentação de Taiko',
    start: '2026-09-21T19:00',
    end: '2026-09-21T20:00',
    kind: 'Show Musical',
    url: 'https://example.org/taiko',
    description: 'Tambores japoneses, pelo 22º Londrina Matsuri.',
  });
});

test('o mínimo é título e data', () => {
  const { evento, erros } = montarEvento(
    parseIssueForm(corpo({ 'Título do evento': 'Visita mediada', Data: '21/09/2026' })),
  );
  assert.deepEqual(erros, []);
  assert.deepEqual(evento, { title: 'Visita mediada', start: '2026-09-21' });
});

test('último dia sozinho vira temporada', () => {
  const { evento } = montarEvento(
    parseIssueForm(
      corpo({ 'Título do evento': 'Mostra', Data: '21/09/2026', 'Último dia': '27/09/2026' }),
    ),
  );
  assert.equal(evento.start, '2026-09-21');
  assert.equal(evento.end, '2026-09-27');
});

test('a hora de término sozinha fica no mesmo dia', () => {
  const { evento } = montarEvento(
    parseIssueForm(
      corpo({
        'Título do evento': 'Oficina',
        Data: '22/09/2026',
        'Hora de início': '14:00',
        'Hora de término': '17:00',
      }),
    ),
  );
  assert.equal(evento.end, '2026-09-22T17:00');
});

test('"Outro" não vira etiqueta de tipo', () => {
  const { evento } = montarEvento(
    parseIssueForm(
      corpo({ 'Título do evento': 'X', Data: '21/09/2026', 'Tipo de atividade': 'Outro' }),
    ),
  );
  assert.equal(evento.kind, undefined, 'Outro não diz nada a quem lê a agenda');
});

test('a descrição vira uma linha só', () => {
  const { evento } = montarEvento(
    parseIssueForm(
      corpo({ 'Título do evento': 'X', Data: '21/09/2026', Descrição: 'Primeira linha.\nSegunda   linha.' }),
    ),
  );
  assert.equal(evento.description, 'Primeira linha. Segunda linha.');
});

test('erros são explicados em português, não em código', () => {
  const semTitulo = montarEvento(parseIssueForm(corpo({ Data: '21/09/2026' })));
  assert.match(semTitulo.erros.join(' '), /título está vazio/i);

  const dataRuim = montarEvento(
    parseIssueForm(corpo({ 'Título do evento': 'X', Data: '32/13/2026' })),
  );
  assert.equal(dataRuim.erros.length, 0, 'o formato bate, então quem recusa é o schema depois');

  const formatoRuim = montarEvento(
    parseIssueForm(corpo({ 'Título do evento': 'X', Data: '21-09-2026' })),
  );
  assert.match(formatoRuim.erros.join(' '), /21\/09\/2026/, 'a mensagem mostra o formato certo');
});

test('texto solto na issue não vira campo', () => {
  const campos = parseIssueForm('Oi, queria adicionar um evento!\n\nObrigado.');
  assert.equal(campos.size, 0);
  const { erros } = montarEvento(campos);
  assert.ok(erros.length > 0, 'sem os campos do formulário, nada é publicado');
});

test('o mesmo evento não entra duas vezes', () => {
  const evento = { title: 'Visita mediada', start: '2026-09-21T14:00' };
  const agenda = [{ title: 'Outra coisa', start: '2026-09-21T14:00' }, evento];

  assert.equal(jaTemEvento(agenda, { ...evento }), true, 'título e início iguais');
  assert.equal(jaTemEvento([], evento), false, 'agenda vazia');
  assert.equal(
    jaTemEvento(agenda, { title: 'Visita mediada', start: '2026-09-21T16:00' }),
    false,
    'a mesma atividade em outro horário é outro evento',
  );
});

test('acha o endereço da foto no que a pessoa colar', () => {
  const casos = [
    ['![cartaz](https://github.com/user-attachments/assets/abc-123)', 'https://github.com/user-attachments/assets/abc-123'],
    ['<img src="https://exemplo.org/foto.jpg" width="400">', 'https://exemplo.org/foto.jpg'],
    ['https://exemplo.org/foto.png', 'https://exemplo.org/foto.png'],
    ['  a foto é essa: https://exemplo.org/foto.webp  ', 'https://exemplo.org/foto.webp'],
  ];
  for (const [entrada, esperado] of casos) {
    assert.equal(extrairUrlDaFoto(entrada), esperado, entrada);
  }
});

test('recusa foto que não seja https', () => {
  assert.equal(extrairUrlDaFoto(''), null, 'campo vazio');
  assert.equal(extrairUrlDaFoto('_No response_'.replace('_No response_', '')), null);
  assert.equal(extrairUrlDaFoto('http://exemplo.org/foto.jpg'), null, 'http é interceptável');
  assert.equal(extrairUrlDaFoto('javascript:alert(1)'), null);
  assert.equal(extrairUrlDaFoto('tenho uma foto mas não sei o link'), null);
});

/** O mesmo ffmpeg de que o baixarFoto depende. Sem ele, o teste não tem o que provar. */
async function temFfmpeg() {
  try {
    await promisify(execFile)('ffmpeg', ['-version']);
    return true;
  } catch {
    return false;
  }
}

test('reduz a foto grande para WebP, dentro do limite de largura', async (t) => {
  if (!(await temFfmpeg())) {
    t.skip('ffmpeg não está nesta máquina');
    return;
  }

  const pasta = await mkdtemp(path.join(tmpdir(), 'fotos-'));
  process.env.PASTA_FOTOS = pasta;
  const original = globalThis.fetch;
  t.after(async () => {
    delete process.env.PASTA_FOTOS;
    globalThis.fetch = original;
    await rm(pasta, { recursive: true, force: true });
  });

  // Uma foto de câmera, no espírito: larga demais e em PNG, que é o formato
  // que chegou duas vezes pelo formulário.
  const fonte = path.join(pasta, 'camera.png');
  await promisify(execFile)('ffmpeg', [
    '-v', 'error', '-y',
    '-f', 'lavfi', '-i', 'testsrc=size=2400x1600:duration=1:rate=1',
    '-frames:v', '1',
    fonte,
  ]);
  const entrada = await readFile(fonte);

  globalThis.fetch = async () =>
    new Response(new Uint8Array(entrada), { headers: { 'content-type': 'image/png' } });

  const caminho = await baixarFoto('https://exemplo.org/camera.png', {
    title: 'Coral',
    start: '2026-10-03T14:00',
  });

  assert.equal(caminho, 'assets/eventos/coral-202610031400.webp', 'o PNG vira webp no config.yaml');

  const arquivo = path.join(pasta, 'coral-202610031400.webp');
  const gravado = await readFile(arquivo);
  // RIFF....WEBP: prova que o arquivo é webp de verdade, e não o PNG renomeado.
  assert.equal(gravado.subarray(0, 4).toString('latin1'), 'RIFF');
  assert.equal(gravado.subarray(8, 12).toString('latin1'), 'WEBP');
  assert.ok(gravado.byteLength < entrada.byteLength, 'tinha que ficar menor que o original');

  const { stdout } = await promisify(execFile)('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width', '-of', 'csv=p=0',
    arquivo,
  ]);
  assert.equal(Number(stdout.trim()), 1200, 'a largura é limitada, e não o que a câmera mandou');

  // O arquivo de trabalho não pode ficar para trás na pasta do site.
  assert.equal(existsSync(`${arquivo}.original`), false);
});

test('sem ffmpeg, guarda o arquivo como veio em vez de barrar a publicação', async (t) => {
  const pasta = await mkdtemp(path.join(tmpdir(), 'fotos-'));
  process.env.PASTA_FOTOS = pasta;
  t.after(async () => {
    delete process.env.PASTA_FOTOS;
    await rm(pasta, { recursive: true, force: true });
  });

  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/webp' } });
  t.after(() => {
    globalThis.fetch = original;
  });

  const caminho = await baixarFoto('https://exemplo.org/f.webp', {
    title: 'Oficina de Gravura',
    start: '2026-10-03T14:00',
  });

  // Três bytes não são imagem nenhuma, então o ffmpeg recusa e cai no plano B.
  assert.equal(caminho, 'assets/eventos/oficina-de-gravura-202610031400.webp');
  const gravado = await readFile(path.join(pasta, 'oficina-de-gravura-202610031400.webp'));
  assert.deepEqual([...gravado], [1, 2, 3], 'o arquivo chegou inteiro');
});

test('explica em português por que a foto não serve', async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  const evento = { title: 'X', start: '2026-10-03T14:00' };

  globalThis.fetch = async () => new Response('', { status: 404 });
  await assert.rejects(baixarFoto('https://exemplo.org/f.jpg', evento), /404/);

  globalThis.fetch = async () =>
    new Response('<html>', { headers: { 'content-type': 'text/html; charset=utf-8' } });
  await assert.rejects(baixarFoto('https://exemplo.org/pagina', evento), /não devolveu uma imagem/);

  globalThis.fetch = async () =>
    new Response(new Uint8Array(6 * 1024 * 1024), { headers: { 'content-type': 'image/png' } });
  await assert.rejects(baixarFoto('https://exemplo.org/enorme.png', evento), /limite é 5 MB/);
});

test('a foto fica no meio do bloco, e não no fim', () => {
  const evento = {
    title: 'Oficina',
    start: '2026-10-15T14:00',
    description: 'Uma frase.',
    image: 'assets/eventos/oficina.webp',
    kind: 'Oficina',
  };
  assert.deepEqual(Object.keys(ordenarCampos(evento)), [
    'title',
    'start',
    'kind',
    'image',
    'description',
  ]);
});

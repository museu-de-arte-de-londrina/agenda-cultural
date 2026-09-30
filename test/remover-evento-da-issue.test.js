import test from 'node:test';
import assert from 'node:assert/strict';

import { parseIssueForm } from '../scripts/evento-da-issue.js';
import { acharEvento, fotoOrfa } from '../scripts/remover-evento-da-issue.js';

const EVENTOS = [
  { title: 'Oficina de Gravura', start: '2026-10-03T10:00' },
  { title: 'Oficina de Gravura', start: '2026-10-03T15:00' },
  { title: 'Apresentação de Taiko', start: '2026-09-21T19:30', image: 'assets/eventos/taiko.webp' },
  { title: 'Exposição', start: '2026-10-01' },
];

/** O formato que o GitHub gera a partir do formulário. */
function campos(titulo, data, hora = '') {
  return parseIssueForm(
    `### Título do evento\n\n${titulo}\n\n### Data\n\n${data}\n\n### Hora de início\n\n${hora || '_No response_'}\n`,
  );
}

test('acha o evento pelo título e pela data, sem ligar para caixa e espaços', () => {
  assert.deepEqual(acharEvento(EVENTOS, campos('  apresentação de  TAIKO ', '21/9/2026')), { indice: 2 });
  assert.deepEqual(acharEvento(EVENTOS, campos('Exposição', '01/10/2026')), { indice: 3 });
});

test('pede a hora quando o título tem mais de uma sessão no dia', () => {
  const { erro } = acharEvento(EVENTOS, campos('Oficina de Gravura', '03/10/2026'));
  assert.match(erro, /2 sessões.*10:00, 15:00/);
  assert.deepEqual(acharEvento(EVENTOS, campos('Oficina de Gravura', '03/10/2026', '15:00')), { indice: 1 });
});

test('sem achado, lista o que existe no dia', () => {
  const { erro } = acharEvento(EVENTOS, campos('Oficina de Gravuras', '03/10/2026'));
  assert.match(erro, /Não achei/);
  assert.match(erro, /Oficina de Gravura \(10:00\)/);
  assert.match(acharEvento(EVENTOS, campos('Taiko', '22/09/2026')).erro, /Não há nenhum evento/);
});

test('explica data e hora mal escritas', () => {
  assert.match(acharEvento(EVENTOS, campos('Taiko', '2026-09-21')).erro, /Não entendi a data/);
  assert.match(acharEvento(EVENTOS, campos('Taiko', '21/09/2026', '19h')).erro, /Não entendi a hora/);
  assert.match(acharEvento(EVENTOS, campos('', '21/09/2026')).erro, /título está vazio/);
});

test('só apaga foto do formulário que ninguém mais usa', () => {
  const img = 'assets/eventos/taiko.webp';
  assert.equal(fotoOrfa({ events: [] }, img), true);
  assert.equal(fotoOrfa({ events: [], ongoing: [{ image: img }] }, img), false);
  assert.equal(fotoOrfa({ events: [] }, 'assets/logo.svg'), false);
  assert.equal(fotoOrfa({ events: [] }, undefined), false);
  assert.equal(fotoOrfa({ events: [] }, 'assets/eventos/../../package.json'), false);
});

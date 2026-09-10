import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseDateTime,
  toDate,
  toIsoString,
  isUpcoming,
  formatEventWhen,
  formatDateTile,
} from '../lib/datetime.js';

/** Intl pontua intervalos com espaço fino + travessão; escrito por extenso
 *  aqui porque esses caracteres são invisíveis no editor. */
const RANGE = '\u2009\u2013\u2009';

test('aceita data pura e data com hora', () => {
  assert.deepEqual(parseDateTime('2026-09-21'), {
    year: 2026,
    month: 9,
    day: 21,
    hour: 0,
    minute: 0,
    hasTime: false,
  });
  assert.deepEqual(parseDateTime('2026-09-21T19:30'), {
    year: 2026,
    month: 9,
    day: 21,
    hour: 19,
    minute: 30,
    hasTime: true,
  });
  assert.equal(parseDateTime('  2026-09-21T19:30  ').hour, 19, 'espaços das pontas são ignorados');
  assert.equal(parseDateTime('2026-09-21 19:30').hasTime, true, 'espaço no lugar do T também vale');
});

test('recusa o que não é uma data válida', () => {
  for (const bad of [
    '2026-02-31', // não existe
    '2026-13-01', // mês fora da faixa
    '2026-09-00', // dia zero
    '2026-09-21T24:00', // hora fora da faixa
    '2026-09-21T19:60', // minuto fora da faixa
    '21/09/2026', // formato brasileiro
    '2026-9-21', // sem zero à esquerda
    '2026-09-21T19:00:00', // com segundos
    'amanhã',
    '',
    null,
    undefined,
    20260921,
  ]) {
    assert.equal(parseDateTime(bad), null, `deveria recusar ${JSON.stringify(bad)}`);
  }
});

test('a data não escorrega de fuso', () => {
  // O bug clássico: interpretar como horário local e publicar o dia anterior.
  const parts = parseDateTime('2026-09-21T19:00');
  const date = toDate(parts);
  assert.equal(date.toISOString(), '2026-09-21T19:00:00.000Z');
  assert.equal(toIsoString(parts), '2026-09-21T19:00');
  assert.equal(toIsoString(parseDateTime('2026-09-21')), '2026-09-21');
});

test('um evento só sai da agenda depois de terminar', () => {
  const start = parseDateTime('2026-09-21T19:00');
  const end = parseDateTime('2026-09-21T20:00');
  const at = (iso) => new Date(iso).getTime();

  assert.equal(isUpcoming(start, end, at('2026-09-21T18:00:00Z')), true, 'antes de começar');
  assert.equal(isUpcoming(start, end, at('2026-09-21T19:30:00Z')), true, 'durante');
  assert.equal(isUpcoming(start, end, at('2026-09-21T20:00:00Z')), true, 'no minuto exato do fim');
  assert.equal(isUpcoming(start, end, at('2026-09-21T20:01:00Z')), false, 'depois do fim');
});

test('evento sem hora vale o dia inteiro', () => {
  const start = parseDateTime('2026-09-21');
  const at = (iso) => new Date(iso).getTime();

  assert.equal(isUpcoming(start, null, at('2026-09-21T00:00:00Z')), true);
  assert.equal(isUpcoming(start, null, at('2026-09-21T23:00:00Z')), true, 'ainda é hoje');
  assert.equal(isUpcoming(start, null, at('2026-09-22T00:00:00Z')), false, 'já é amanhã');
});

test('temporada continua na agenda até o último dia', () => {
  const start = parseDateTime('2026-09-21T11:00');
  const end = parseDateTime('2026-09-27T17:00');
  const at = (iso) => new Date(iso).getTime();

  assert.equal(isUpcoming(start, end, at('2026-09-24T00:00:00Z')), true, 'no meio da temporada');
  assert.equal(isUpcoming(start, end, at('2026-09-27T18:00:00Z')), false, 'depois do último dia');
});

test('formata data e hora em pt-BR', () => {
  const when = (a, b) => formatEventWhen(parseDateTime(a), b ? parseDateTime(b) : null, 'pt-BR');

  assert.deepEqual(when('2026-09-21T19:00', '2026-09-21T20:00'), {
    date: 'segunda-feira, 21 de setembro',
    time: `19:00${RANGE}20:00`,
  });
  assert.deepEqual(when('2026-09-21', null), {
    date: 'segunda-feira, 21 de setembro',
    time: null,
  });
  assert.deepEqual(when('2026-09-21T11:00', '2026-09-25T17:00'), {
    date: `21${RANGE}25 de setembro`,
    time: `11:00${RANGE}17:00`,
  });
});

test('hora de início e fim iguais não vira intervalo repetido', () => {
  const when = formatEventWhen(
    parseDateTime('2026-09-21T19:00'),
    parseDateTime('2026-09-21T19:00'),
    'pt-BR',
  );
  assert.equal(when.time, '19:00');
});

test('o ladrilho de data traz dia e mês curtos', () => {
  assert.deepEqual(formatDateTile(parseDateTime('2026-09-21'), 'pt-BR'), { day: '21', month: 'SET' });
  assert.deepEqual(formatDateTile(parseDateTime('2026-12-05'), 'pt-BR'), { day: '05', month: 'DEZ' });
});

test('o idioma do config manda na formatação', () => {
  const parts = parseDateTime('2026-09-21T19:00');
  assert.match(formatEventWhen(parts, null, 'en-US').date, /September/);
  assert.match(formatEventWhen(parts, null, 'pt-BR').date, /setembro/);
});

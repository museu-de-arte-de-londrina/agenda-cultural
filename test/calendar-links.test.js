import test from 'node:test';
import assert from 'node:assert/strict';

import { googleCalendarUrl, outlookCalendarUrl } from '../lib/calendar-links.js';
import { parseDateTime } from '../lib/datetime.js';

/** Monta o evento no mesmo formato que o site.js entrega. */
function evento({ title = 'Oficina de gravura', start, end, description, url } = {}) {
  return {
    title,
    start: parseDateTime(start),
    end: end ? parseDateTime(end) : null,
    description,
    url,
  };
}

const LOCAL = { location: 'Rua Sergipe, 640, Centro, Londrina, PR' };

test('Google recebe a hora de parede do museu, com o fuso dito à parte', () => {
  const endereco = googleCalendarUrl(evento({ start: '2026-09-21T19:00', end: '2026-09-21T20:00' }));
  const params = new URL(endereco).searchParams;

  assert.equal(new URL(endereco).origin, 'https://calendar.google.com');
  assert.equal(params.get('action'), 'TEMPLATE');
  assert.equal(params.get('dates'), '20260921T190000/20260921T200000');
  // Sem o ctz, quem clicasse de outro fuso veria 19:00 no relógio errado.
  assert.equal(params.get('ctz'), 'America/Sao_Paulo');
});

test('Outlook recebe a data com o deslocamento colado', () => {
  const endereco = outlookCalendarUrl(evento({ start: '2026-09-21T19:00', end: '2026-09-21T20:00' }));
  const params = new URL(endereco).searchParams;

  assert.equal(new URL(endereco).origin, 'https://outlook.live.com');
  assert.equal(params.get('rru'), 'addevent');
  assert.equal(params.get('startdt'), '2026-09-21T19:00:00-03:00');
  assert.equal(params.get('enddt'), '2026-09-21T20:00:00-03:00');
});

test('evento sem hora de término ganha uma hora, em vez de duração zero', () => {
  const semFim = evento({ start: '2026-09-21T19:00' });

  assert.equal(new URL(googleCalendarUrl(semFim)).searchParams.get('dates'), '20260921T190000/20260921T200000');
  assert.equal(new URL(outlookCalendarUrl(semFim)).searchParams.get('enddt'), '2026-09-21T20:00:00-03:00');
});

test('a hora que vira o dia não estoura para as 24h', () => {
  const tarde = evento({ start: '2026-09-21T23:30' });

  assert.equal(new URL(googleCalendarUrl(tarde)).searchParams.get('dates'), '20260921T233000/20260922T003000');
});

test('evento de dia inteiro termina no dia seguinte, porque o fim é exclusivo', () => {
  const exposicao = evento({ start: '2026-09-21', end: '2026-09-27' });

  assert.equal(new URL(googleCalendarUrl(exposicao)).searchParams.get('dates'), '20260921/20260928');

  const outlook = new URL(outlookCalendarUrl(exposicao)).searchParams;
  assert.equal(outlook.get('allday'), 'true');
  assert.equal(outlook.get('startdt'), '2026-09-21');
  assert.equal(outlook.get('enddt'), '2026-09-28');
});

test('um dia só, sem hora, ocupa exatamente aquele dia', () => {
  const umDia = evento({ start: '2026-09-21' });

  assert.equal(new URL(googleCalendarUrl(umDia)).searchParams.get('dates'), '20260921/20260922');
});

test('descrição e endereço do evento viajam juntos no corpo', () => {
  const completo = evento({
    start: '2026-09-21T19:00',
    end: '2026-09-21T20:00',
    description: 'Tambores japoneses.',
    url: 'https://exemplo.org/taiko',
  });

  assert.equal(
    new URL(googleCalendarUrl(completo, LOCAL)).searchParams.get('details'),
    'Tambores japoneses.\n\nhttps://exemplo.org/taiko',
  );
  assert.equal(new URL(googleCalendarUrl(completo, LOCAL)).searchParams.get('location'), LOCAL.location);
  assert.equal(
    new URL(outlookCalendarUrl(completo, LOCAL)).searchParams.get('body'),
    'Tambores japoneses.\n\nhttps://exemplo.org/taiko',
  );
});

test('sem descrição nem endereço, os campos nem aparecem', () => {
  const seco = new URL(googleCalendarUrl(evento({ start: '2026-09-21T19:00' })));

  assert.equal(seco.searchParams.get('details'), null);
  assert.equal(seco.searchParams.get('location'), null);
});

test('título com caractere de URL é codificado, não interpretado', () => {
  const perigoso = evento({
    title: 'Mostra & Cia #2 ?x=1',
    start: '2026-09-21T19:00',
    end: '2026-09-21T20:00',
  });

  for (const endereco of [googleCalendarUrl(perigoso), outlookCalendarUrl(perigoso)]) {
    const url = new URL(endereco);
    // O que importa: o título volta inteiro, e nada dele virou parâmetro novo.
    const campo = url.searchParams.get('text') ?? url.searchParams.get('subject');
    assert.equal(campo, 'Mostra & Cia #2 ?x=1');
    assert.equal(url.hash, '');
    assert.equal(url.searchParams.get('x'), null);
  }
});

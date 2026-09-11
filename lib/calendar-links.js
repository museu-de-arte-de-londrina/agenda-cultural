/**
 * Endereços que abrem o evento já preenchido no Google Agenda e no Outlook.
 *
 * Servem o caso que o arquivo .ics atende mal: quem usa calendário no
 * navegador. Baixar um arquivo e depois importar à mão é um passo a mais que
 * quase ninguém dá; estes endereços levam direto para a tela de novo evento,
 * com tudo preenchido, faltando só confirmar.
 *
 * As regras de data são as mesmas de lib/calendar.js de propósito. Se o .ics e
 * o link discordarem sobre quando o evento começa, o visitante tem duas
 * respostas para a mesma pergunta e nenhuma maneira de saber qual vale.
 *
 * Nada aqui é carregado pela página. São endereços em atributo href, que só
 * saem do navegador quando alguém clica.
 */

import { TIMEZONE } from './datetime.js';

/**
 * O Brasil não usa mais horário de verão desde 2019, e o VTIMEZONE escrito no
 * .ics já parte disso, com o mesmo -03:00 o ano inteiro. O Outlook precisa do
 * deslocamento junto da data: sem ele, ele lê a hora no fuso do perfil de quem
 * clicou, e um evento de 19h vira 19h em Lisboa.
 */
const FUSO = '-03:00';

/**
 * Evento com hora de início e sem hora de término.
 *
 * O .ics simplesmente omite o DTEND e deixa cada aplicativo decidir. Um
 * endereço não tem esse luxo: o Google e o Outlook precisam dos dois lados, e
 * mandar o mesmo instante nos dois cria um evento de duração zero, que alguns
 * calendários escondem.
 */
const DURACAO_PADRAO_EM_MINUTOS = 60;

const pad = (valor) => String(valor).padStart(2, '0');

/** @typedef {import('./datetime.js').DateParts} DateParts */

/** `20260921` */
function dataCompacta(partes) {
  return `${partes.year}${pad(partes.month)}${pad(partes.day)}`;
}

/** `20260921T190000`, que é o formato de data do Google. */
function carimboCompacto(partes) {
  return `${dataCompacta(partes)}T${pad(partes.hour)}${pad(partes.minute)}00`;
}

/** `2026-09-21T19:00:00`, que é o formato do Outlook. */
function carimboIso(partes) {
  return `${partes.year}-${pad(partes.month)}-${pad(partes.day)}T${pad(partes.hour)}:${pad(partes.minute)}:00`;
}

/**
 * O dia seguinte, porque nos dois serviços o fim de um evento de dia inteiro é
 * exclusivo: uma exposição que termina no dia 27 vai até o dia 28.
 * @param {DateParts} partes
 */
function diaSeguinte(partes) {
  const data = new Date(Date.UTC(partes.year, partes.month - 1, partes.day + 1));
  return {
    year: data.getUTCFullYear(),
    month: data.getUTCMonth() + 1,
    day: data.getUTCDate(),
    hour: 0,
    minute: 0,
    hasTime: false,
  };
}

/** @param {DateParts} partes */
function somarMinutos(partes, minutos) {
  const data = new Date(
    Date.UTC(partes.year, partes.month - 1, partes.day, partes.hour, partes.minute + minutos),
  );
  return {
    year: data.getUTCFullYear(),
    month: data.getUTCMonth() + 1,
    day: data.getUTCDate(),
    hour: data.getUTCHours(),
    minute: data.getUTCMinutes(),
    hasTime: true,
  };
}

/**
 * O fim que vale para um evento com hora marcada.
 *
 * Espelha lib/calendar.js, inclusive quando o `end` do config.yaml vem só com
 * a data: ali ele também é lido como meia-noite daquele dia.
 * @param {{start: DateParts, end?: DateParts | null}} evento
 */
function terminoComHora(evento) {
  return evento.end ?? somarMinutos(evento.start, DURACAO_PADRAO_EM_MINUTOS);
}

/**
 * O texto que vai no corpo do evento. Leva o endereço da página quando existe,
 * para quem salvou conseguir voltar à fonte depois.
 * @param {{description?: string, url?: string}} evento
 */
function corpo(evento) {
  return [evento.description, evento.url].filter(Boolean).join('\n\n');
}

/**
 * @param {{title: string, start: DateParts, end?: DateParts | null, description?: string, url?: string}} evento
 * @param {{location?: string}} [opcoes]
 * @returns {string}
 */
export function googleCalendarUrl(evento, { location } = {}) {
  const parametros = new URLSearchParams({ action: 'TEMPLATE', text: evento.title });

  if (evento.start.hasTime) {
    parametros.set('dates', `${carimboCompacto(evento.start)}/${carimboCompacto(terminoComHora(evento))}`);
    // Sem isto o Google lê a hora no fuso de quem clicou.
    parametros.set('ctz', TIMEZONE);
  } else {
    parametros.set('dates', `${dataCompacta(evento.start)}/${dataCompacta(diaSeguinte(evento.end ?? evento.start))}`);
  }

  const texto = corpo(evento);
  if (texto) parametros.set('details', texto);
  if (location) parametros.set('location', location);

  return `https://calendar.google.com/calendar/render?${parametros}`;
}

/**
 * @param {{title: string, start: DateParts, end?: DateParts | null, description?: string, url?: string}} evento
 * @param {{location?: string}} [opcoes]
 * @returns {string}
 */
export function outlookCalendarUrl(evento, { location } = {}) {
  const parametros = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: evento.title,
  });

  if (evento.start.hasTime) {
    parametros.set('startdt', `${carimboIso(evento.start)}${FUSO}`);
    parametros.set('enddt', `${carimboIso(terminoComHora(evento))}${FUSO}`);
  } else {
    parametros.set('allday', 'true');
    parametros.set('startdt', dataCompacta(evento.start).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'));
    const fim = diaSeguinte(evento.end ?? evento.start);
    parametros.set('enddt', `${fim.year}-${pad(fim.month)}-${pad(fim.day)}`);
  }

  const texto = corpo(evento);
  if (texto) parametros.set('body', texto);
  if (location) parametros.set('location', location);

  return `https://outlook.live.com/calendar/0/deeplink/compose?${parametros}`;
}

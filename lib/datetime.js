/**
 * Event dates.
 *
 * Values in config.yaml are wall-clock times at the venue ("21/09 at 19:00"),
 * not instants. Converting them through a timezone would shift them whenever
 * the build machine disagrees with the museum, so every value here is parsed
 * and formatted as UTC: the numbers that come out are exactly the numbers the
 * editor typed.
 */

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/;

/**
 * @typedef {{year: number, month: number, day: number, hour: number, minute: number, hasTime: boolean}} DateParts
 */

/**
 * Parse `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM`, rejecting impossible calendar dates.
 * @param {unknown} value
 * @returns {DateParts | null}
 */
export function parseDateTime(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();

  const match = DATE_TIME.exec(trimmed) ?? DATE_ONLY.exec(trimmed);
  if (!match) return null;

  const [, year, month, day, hour, minute] = match;
  const parts = {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour ?? 0),
    minute: Number(minute ?? 0),
    hasTime: hour !== undefined,
  };

  if (parts.month < 1 || parts.month > 12) return null;
  if (parts.day < 1 || parts.day > 31) return null;
  if (parts.hour > 23 || parts.minute > 59) return null;

  // Rejects 2026-02-31 and friends: the Date would silently roll over.
  const probe = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (probe.getUTCMonth() !== parts.month - 1 || probe.getUTCDate() !== parts.day) return null;

  return parts;
}

/**
 * @param {DateParts} parts
 * @param {{endOfDay?: boolean}} [options] treat a date without time as 23:59
 * @returns {Date}
 */
export function toDate(parts, { endOfDay = false } = {}) {
  const hour = parts.hasTime ? parts.hour : endOfDay ? 23 : 0;
  const minute = parts.hasTime ? parts.minute : endOfDay ? 59 : 0;
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, hour, minute));
}

/** ISO string for the `datetime` attribute of `<time>`. */
export function toIsoString(parts) {
  const pad = (n) => String(n).padStart(2, '0');
  const date = `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
  return parts.hasTime ? `${date}T${pad(parts.hour)}:${pad(parts.minute)}` : date;
}

/**
 * O relógio do museu. As datas do config.yaml são horário de parede daqui, e
 * é contra este relógio que elas precisam ser comparadas.
 */
export const TIMEZONE = 'America/Sao_Paulo';

/**
 * "Agora" traduzido para o mesmo espaço em que toDate coloca as datas do
 * config.yaml.
 *
 * As duas pontas precisam falar a mesma língua. toDate lê "15:00" como 15:00
 * UTC de propósito, para que a máquina que constrói o site não mude a data
 * escrita. Comparar isso com Date.now(), que é UTC de verdade, media horário
 * de parede contra horário universal: em Londrina, três horas de diferença, e
 * todo evento sumia da agenda três horas antes de acabar.
 *
 * @param {string} timeZone
 * @param {number} at epoch ms, injetável para o teste não depender do relógio
 * @returns {number} epoch ms no mesmo espaço de toDate
 */
export function wallClockNow(timeZone = TIMEZONE, at = Date.now()) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(at));

  const campo = (tipo) => Number(partes.find((parte) => parte.type === tipo).value);
  // Meia-noite sai como 24 em algumas versões do ICU.
  return Date.UTC(
    campo('year'),
    campo('month') - 1,
    campo('day'),
    campo('hour') % 24,
    campo('minute'),
    campo('second'),
  );
}

/**
 * An event is upcoming until the moment it ends. A day without a time counts
 * for the whole day, so "today" never disappears from the agenda at midnight.
 * @param {DateParts} start
 * @param {DateParts | null} end
 * @param {number} now epoch ms
 */
export function isUpcoming(start, end, now) {
  const finish = end ?? start;
  return toDate(finish, { endOfDay: !finish.hasTime }).getTime() >= now;
}

/**
 * Human-readable date and time for one event.
 * @param {DateParts} start
 * @param {DateParts | null} end
 * @param {string} locale BCP 47 tag from config.lang
 */
export function formatEventWhen(start, end, locale) {
  const startDate = toDate(start);
  const endDate = end ? toDate(end) : null;

  const dayFormat = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
  const weekdayFormat = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
  const timeFormat = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });

  const sameDay =
    !endDate ||
    (start.year === end.year && start.month === end.month && start.day === end.day);

  const date = sameDay
    ? weekdayFormat.format(startDate)
    : dayFormat.formatRange(startDate, endDate);

  // Joined by hand rather than with formatRange: across different days the
  // range formatter re-introduces the date, which the line above already shows.
  // The separator copies what Intl uses for ranges (thin space, en dash, thin
  // space) so the date line and the time line are punctuated the same way.
  let time = null;
  if (start.hasTime) {
    time = timeFormat.format(startDate);
    if (end?.hasTime && endDate) {
      const finish = timeFormat.format(endDate);
      if (finish !== time) time = `${time}\u2009\u2013\u2009${finish}`;
    }
  }

  return { date, time };
}

/**
 * The parts a day heading needs. The agenda groups by day, so the date is
 * printed once per group instead of once per event.
 */
export function formatDayHeading(parts, locale) {
  const date = toDate(parts);
  const short = (options) => new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(date);
  // The abbreviation keeps its full stop: in Portuguese "set" without one is
  // not an abbreviation of "setembro", it is a misspelling.
  return {
    weekday: short({ weekday: 'short' }),
    day: short({ day: '2-digit' }),
    month: short({ month: 'short' }),
    full: short({ weekday: 'long', day: 'numeric', month: 'long' }),
  };
}

/** "25 de setembro", used to say how long a multi-day event runs. */
export function formatShortDate(parts, locale) {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    toDate(parts),
  );
}

/** Same calendar day? Decides whether an event needs an "until" line. */
export function isSameDay(a, b) {
  return Boolean(b) && a.year === b.year && a.month === b.month && a.day === b.day;
}

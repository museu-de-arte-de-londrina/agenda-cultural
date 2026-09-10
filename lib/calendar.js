/**
 * iCalendar output.
 *
 * Events in config.yaml are wall-clock times at the venue, so they are written
 * with an explicit TZID rather than converted to UTC: "19:00" has to stay
 * 19:00 for someone standing in front of the building, whatever their phone
 * thinks the offset is.
 *
 * RFC 5545: https://www.rfc-editor.org/rfc/rfc5545
 */

import { TIMEZONE } from './datetime.js';

const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  `TZID:${TIMEZONE}`,
  'BEGIN:STANDARD',
  'DTSTART:19700101T000000',
  'TZOFFSETFROM:-0300',
  'TZOFFSETTO:-0300',
  'TZNAME:-03',
  'END:STANDARD',
  'END:VTIMEZONE',
];

/**
 * Escape a text value. Backslash first, or it would double-escape what the
 * later replacements add.
 * @param {string} value
 */
export function escapeText(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Fold a line to 75 octets, as the spec requires. Measured in bytes, not
 * characters: one accented letter is two octets in UTF-8, and folding by
 * character length would overrun on a Portuguese title.
 * @param {string} line
 */
export function foldLine(line) {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;

  const out = [];
  let current = '';
  let bytes = 0;
  // A continuation line starts with a space, which costs one of its 75 octets.
  let limit = 75;

  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > limit) {
      out.push(current);
      current = '';
      bytes = 0;
      limit = 74;
    }
    current += char;
    bytes += size;
  }
  out.push(current);
  return out.join('\r\n ');
}

const pad = (n) => String(n).padStart(2, '0');

/** `20260921T190000`, in the venue's own clock. */
function localStamp(parts) {
  const date = `${parts.year}${pad(parts.month)}${pad(parts.day)}`;
  return `${date}T${pad(parts.hour)}${pad(parts.minute)}00`;
}

/** `20260921`, for an event with no time. */
function dateStamp(parts) {
  return `${parts.year}${pad(parts.month)}${pad(parts.day)}`;
}

/** The day after, because DTEND is exclusive for all-day events. */
function nextDay(parts) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1));
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
}

/**
 * @typedef {object} CalendarEvent
 * @property {string} title
 * @property {string} slug stable identifier, used for the UID
 * @property {{year:number,month:number,day:number,hour:number,minute:number,hasTime:boolean}} start
 * @property {object|null} end same shape, or null
 * @property {string} [description]
 * @property {string} [kind]
 * @property {string} [url]
 */

function eventLines(event, { host, location, stamp }) {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${event.slug}@${host}`,
    `DTSTAMP:${stamp}`,
  ];

  if (event.start.hasTime) {
    lines.push(`DTSTART;TZID=${TIMEZONE}:${localStamp(event.start)}`);
    if (event.end) lines.push(`DTEND;TZID=${TIMEZONE}:${localStamp(event.end)}`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${dateStamp(event.start)}`);
    lines.push(`DTEND;VALUE=DATE:${nextDay(event.end ?? event.start)}`);
  }

  lines.push(`SUMMARY:${escapeText(event.title)}`);
  if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  if (event.kind) lines.push(`CATEGORIES:${escapeText(event.kind)}`);
  if (location) lines.push(`LOCATION:${escapeText(location)}`);
  if (event.url) lines.push(`URL:${event.url}`);
  lines.push('END:VEVENT');

  return lines;
}

/**
 * Build a complete .ics document.
 * @param {CalendarEvent[]} events
 * @param {{name: string, host: string, location?: string, now?: Date}} options
 * @returns {string}
 */
export function buildCalendar(events, { name, host, location, now = new Date() }) {
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(
    now.getUTCHours(),
  )}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${escapeText(name)}//Agenda//PT-BR`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(name)}`,
    `X-WR-TIMEZONE:${TIMEZONE}`,
    ...VTIMEZONE,
    ...events.flatMap((event) => eventLines(event, { host, location, stamp })),
    'END:VCALENDAR',
  ];

  // CRLF throughout, and a trailing one: some parsers drop the last line without it.
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}

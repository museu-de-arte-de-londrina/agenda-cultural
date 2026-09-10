/**
 * Eleventy global data: reads config.yaml at build time, validates it, and
 * derives everything the template needs. A throw here fails the build.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { loadConfigFile } from '../../schema/config.schema.js';
import { resolveIcon } from '../../lib/icons.js';
import { bestContrast, contrastRatio, readableOn } from '../../lib/color.js';
import {
  parseDateTime,
  toDate,
  toIsoString,
  isUpcoming,
  formatEventWhen,
  formatDayHeading,
  formatShortDate,
  isSameDay,
} from '../../lib/datetime.js';

const DEFAULT_CONFIG = new URL('../../config.yaml', import.meta.url);

/**
 * The furthest surface accent-coloured text ever lands on, handed to the
 * stylesheet so the contrast calculation below and the rendered background
 * cannot drift apart. In the light theme the accent is dark, so the deepest
 * tint is its worst case; in the dark theme the accent is light, so the
 * lightest tint is.
 */
const SURFACE_HOVER = { light: '#e8eef7', dark: '#1a2540' };

/**
 * A stable identifier for an event, used to name its calendar file and as the
 * UID a calendar app matches on. The start time is part of it because the same
 * activity repeats on different days.
 */
function slugify(title, start) {
  const base = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
    .replace(/-$/, '');
  // Date and time both: the same activity runs twice on the same day.
  return `${base}-${start.replace(/[-:T ]/g, '')}`;
}

/** Two initials, used when no avatar is set. */
function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => [...word][0].toUpperCase())
    .join('');
}

/**
 * Open Graph needs absolute URLs; relative paths only work with seo.base_url.
 * @returns {string | null}
 */
function absoluteUrl(source, baseUrl) {
  if (!source) return null;
  if (source.startsWith('https://')) return source;
  if (!baseUrl) return null;
  return new URL(source, baseUrl).href;
}

/**
 * The agenda, grouped by day.
 *
 * Only what has not finished yet, soonest first. The cut-off is the build
 * time, so the page is as fresh as its last deploy; the Pages workflow also
 * rebuilds on a schedule to keep this honest between edits.
 *
 * Grouping matters for more than layout: six activities on the same day would
 * otherwise print the same date six times. The date belongs to the day, and
 * each entry only has to say what time it starts.
 */
function buildAgenda(config, now) {
  const upcoming = config.events
    .map((event) => {
      // Already validated by the schema, so these parses cannot fail.
      const start = parseDateTime(event.start);
      const end = event.end ? parseDateTime(event.end) : null;
      const when = formatEventWhen(start, end, config.lang);
      return {
        ...event,
        start,
        end,
        slug: slugify(event.title, event.start),
        iso: toIsoString(start),
        time: when.time,
        // A season spanning several days says so; a one-off does not repeat itself.
        runsUntil: end && !isSameDay(start, end) ? formatShortDate(end, config.lang) : null,
        startsAt: toDate(start).getTime(),
      };
    })
    .filter((event) => isUpcoming(event.start, event.end, now))
    .sort((a, b) => a.startsAt - b.startsAt);

  const days = [];
  for (const event of upcoming) {
    const key = event.iso.slice(0, 10);
    const last = days.at(-1);
    if (last?.key === key) last.events.push(event);
    else days.push({ key, heading: formatDayHeading(event.start, config.lang), events: [event] });
  }
  return days;
}

/**
 * schema.org/Event, so search engines can show the agenda as events rather
 * than as a wall of text.
 *
 * Serialised here instead of in the template because it has to go into the
 * page unescaped: a <script> element holds raw text, so HTML-escaping it would
 * corrupt the JSON rather than protect anything. The three characters that
 * could close the element early are written as unicode escapes, which JSON
 * treats as identical and the HTML parser cannot read as markup.
 */
function structuredData(config, agenda) {
  const absolute = (path) => absoluteUrl(path, config.seo.base_url);
  const offset = '-03:00';
  const at = (parts) => {
    const pad = (n) => String(n).padStart(2, '0');
    const date = `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
    return parts.hasTime ? `${date}T${pad(parts.hour)}:${pad(parts.minute)}:00${offset}` : date;
  };

  const place = config.profile.location
    ? { '@type': 'Place', name: config.profile.name, address: config.profile.location }
    : undefined;

  const events = agenda
    .flatMap((day) => day.events)
    .map((event) => ({
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: event.title,
      startDate: at(event.start),
      ...(event.end ? { endDate: at(event.end) } : {}),
      ...(event.description ? { description: event.description } : {}),
      ...(event.url ? { url: event.url } : {}),
      ...(absolute(event.image) ? { image: absolute(event.image) } : {}),
      ...(place ? { location: place } : {}),
      organizer: { '@type': 'Organization', name: config.profile.name },
    }));

  if (events.length === 0) return null;
  return JSON.stringify(events).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

/**
 * When the programming itself was last edited, taken from the last commit that
 * touched config.yaml.
 *
 * Not the build date: the site rebuilds on a daily schedule, so a build stamp
 * would claim the agenda was updated today no matter how old it is. A visitor
 * deciding whether to trust the page needs the date of the content, not of
 * the deploy. Returns null outside a git checkout, and the line is dropped.
 */
async function programmingUpdatedAt() {
  try {
    const { stdout } = await promisify(execFile)(
      'git',
      ['log', '-1', '--format=%cI', '--', 'config.yaml'],
      { cwd: new URL('../../', import.meta.url) },
    );
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

/**
 * @param {string|null} iso
 * @param {string} locale
 * @returns {{iso: string, label: string} | null}
 */
function formatUpdatedAt(iso, locale) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return {
    iso,
    // The venue's clock, so a late-evening edit does not show tomorrow's date.
    label: new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'America/Sao_Paulo',
    }).format(date),
  };
}

export default async function site() {
  // Read at call time, not import time, so tests can point at a fixture.
  const config = await loadConfigFile(process.env.CONFIG_FILE ?? DEFAULT_CONFIG);
  const { accent } = config.theme;
  const agenda = buildAgenda(config, Date.now());

  return {
    ...config,
    initials: initials(config.profile.name),
    agenda,
    structuredData: structuredData(config, agenda),
    updatedAt: formatUpdatedAt(await programmingUpdatedAt(), config.lang),
    links: config.links.map((link) => ({ ...link, iconData: link.icon ? resolveIcon(link.icon) : null })),
    social: config.social.map((entry) => ({ ...entry, iconData: resolveIcon(entry.platform) })),
    canonical: config.seo.base_url ?? null,
    ogImage: absoluteUrl(config.seo.og_image, config.seo.base_url),
    // Derived so contrast holds for any accent the user picks.
    accentForeground: bestContrast(accent, ['#ffffff', '#0b1120']),
    // The accent doubles as a text colour. On one theme it can be perfectly
    // legible and on the other nearly invisible, so each theme gets a version
    // lightened or darkened until it clears AA against its own surface.
    accentText: {
      light: readableOn(SURFACE_HOVER.light, accent, '#0c1220'),
      dark: readableOn(SURFACE_HOVER.dark, accent, '#e9eff8'),
    },
    surfaceHover: SURFACE_HOVER,
    focusRing: {
      light: contrastRatio(accent, '#ffffff') >= 3 ? accent : '#0f172a',
      dark: contrastRatio(accent, '#0b1120') >= 3 ? accent : '#e8edf7',
    },
  };
}

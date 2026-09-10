/**
 * Eleventy global data: reads config.yaml at build time, validates it, and
 * derives everything the template needs. A throw here fails the build.
 */
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
        iso: toIsoString(start),
        time: when.time,
        // A season spanning several days says so; a one-off does not repeat itself.
        runsUntil: end && !isSameDay(start, end) ? formatShortDate(end, config.lang) : null,
        startsAt: toDate(start).getTime(),
      };
    })
    .filter((event) => isUpcoming(event.start, event.end, now))
    .sort((a, b) => a.startsAt - b.startsAt);

  // The soonest event leads, and is the only one that shows its description.
  if (upcoming.length > 0) upcoming[0].featured = true;

  const days = [];
  for (const event of upcoming) {
    const key = event.iso.slice(0, 10);
    const last = days.at(-1);
    if (last?.key === key) last.events.push(event);
    else days.push({ key, heading: formatDayHeading(event.start, config.lang), events: [event] });
  }
  return days;
}

export default async function site() {
  // Read at call time, not import time, so tests can point at a fixture.
  const config = await loadConfigFile(process.env.CONFIG_FILE ?? DEFAULT_CONFIG);
  const { accent } = config.theme;

  return {
    ...config,
    initials: initials(config.profile.name),
    agenda: buildAgenda(config, Date.now()),
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
      light: readableOn('#f5f8fc', accent, '#0c1220'),
      dark: readableOn('#121c2f', accent, '#e9eff8'),
    },
    focusRing: {
      light: contrastRatio(accent, '#ffffff') >= 3 ? accent : '#0f172a',
      dark: contrastRatio(accent, '#0b1120') >= 3 ? accent : '#e8edf7',
    },
  };
}

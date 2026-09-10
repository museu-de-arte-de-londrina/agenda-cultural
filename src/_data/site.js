/**
 * Eleventy global data: reads config.yaml at build time, validates it, and
 * derives everything the template needs. A throw here fails the build.
 */
import { loadConfigFile } from '../../schema/config.schema.js';
import { resolveIcon } from '../../lib/icons.js';
import { bestContrast, contrastRatio } from '../../lib/color.js';
import {
  parseDateTime,
  toDate,
  toIsoString,
  isUpcoming,
  formatEventWhen,
  formatDateTile,
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
 * The agenda: only what has not finished yet, soonest first.
 *
 * The cut-off is the build time, so the page is as fresh as its last deploy.
 * The Pages workflow also rebuilds on a schedule to keep this honest between
 * edits — see .github/workflows/deploy.yml.
 */
function buildAgenda(config, now) {
  return config.events
    .map((event) => {
      // Already validated by the schema, so these parses cannot fail.
      const start = parseDateTime(event.start);
      const end = event.end ? parseDateTime(event.end) : null;
      return {
        ...event,
        start,
        end,
        when: formatEventWhen(start, end, config.lang),
        tile: formatDateTile(start, config.lang),
        iso: toIsoString(start),
        startsAt: toDate(start).getTime(),
      };
    })
    .filter((event) => isUpcoming(event.start, event.end, now))
    .sort((a, b) => a.startsAt - b.startsAt);
}

export default async function site() {
  // Read at call time, not import time, so tests can point at a fixture.
  const config = await loadConfigFile(process.env.CONFIG_FILE ?? DEFAULT_CONFIG);
  const { accent } = config.theme;

  return {
    ...config,
    initials: initials(config.profile.name),
    events: buildAgenda(config, Date.now()),
    links: config.links.map((link) => ({ ...link, iconData: link.icon ? resolveIcon(link.icon) : null })),
    social: config.social.map((entry) => ({ ...entry, iconData: resolveIcon(entry.platform) })),
    canonical: config.seo.base_url ?? null,
    ogImage: absoluteUrl(config.seo.og_image, config.seo.base_url),
    // Derived so contrast holds for any accent the user picks.
    accentForeground: bestContrast(accent, ['#ffffff', '#0b1120']),
    focusRing: {
      light: contrastRatio(accent, '#ffffff') >= 3 ? accent : '#0f172a',
      dark: contrastRatio(accent, '#0b1120') >= 3 ? accent : '#e8edf7',
    },
  };
}

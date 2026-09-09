/**
 * Eleventy global data: reads config.yaml at build time, validates it, and
 * derives everything the template needs. A throw here fails the build.
 */
import { loadConfigFile } from '../../schema/config.schema.js';
import { resolveIcon } from '../../lib/icons.js';
import { bestContrast, contrastRatio } from '../../lib/color.js';

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

export default async function site() {
  // Read at call time, not import time, so tests can point at a fixture.
  const config = await loadConfigFile(process.env.CONFIG_FILE ?? DEFAULT_CONFIG);
  const { accent } = config.theme;

  return {
    ...config,
    initials: initials(config.profile.name),
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

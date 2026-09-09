/**
 * Icon resolution.
 *
 * Icons are shipped as plain SVG path `d` strings so the template can render
 * them with `<path d="{{ d }}">` under Nunjucks autoescaping. No raw HTML is
 * ever injected into the page — see SECURITY.md.
 *
 * Two sources:
 *  - brand icons: any slug from the `simple-icons` package (build-time only,
 *    self-hosted output, no CDN).
 *  - generic icons: the small hand-written set below, for things brands don't
 *    cover (email, website, link).
 */
import * as simpleIcons from 'simple-icons';

/** Generic stroke icons (24x24 grid, stroke-based, no fill). */
const GENERIC_ICONS = {
  email: {
    title: 'Email',
    fill: false,
    paths: ['M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z', 'm22 7-10 6.5L2 7'],
  },
  website: {
    title: 'Website',
    fill: false,
    paths: [
      'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z',
      'M2 12h20',
      'M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10Z',
    ],
  },
  link: {
    title: 'Link',
    fill: false,
    paths: [
      'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71',
      'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
    ],
  },
};

/** simple-icons exports `siGithub` for slug `github`. */
function brandExportName(slug) {
  return `si${slug.charAt(0).toUpperCase()}${slug.slice(1)}`;
}

/**
 * Resolve an icon name to renderable data.
 * @param {unknown} name icon slug from config.yaml
 * @returns {{title: string, fill: boolean, paths: string[]} | null} null when unknown
 */
export function resolveIcon(name) {
  if (typeof name !== 'string') return null;
  const slug = name.trim().toLowerCase();
  if (slug === '') return null;

  if (Object.hasOwn(GENERIC_ICONS, slug)) return GENERIC_ICONS[slug];

  // Only plain slugs may reach the simple-icons namespace lookup.
  if (!/^[a-z0-9.+-]+$/.test(slug)) return null;
  const brand = simpleIcons[brandExportName(slug)];
  if (!brand || typeof brand.path !== 'string') return null;

  return { title: brand.title, fill: true, paths: [brand.path] };
}

export const GENERIC_ICON_NAMES = Object.freeze(Object.keys(GENERIC_ICONS));

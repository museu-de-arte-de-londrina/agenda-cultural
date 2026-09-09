/**
 * Minimal WCAG contrast helpers.
 *
 * `theme.accent` comes from config.yaml, so nothing about its contrast can be
 * assumed. These helpers pick a readable foreground and a visible focus ring
 * at build time, keeping the AA guarantee true for any accent.
 */

/** @param {string} hex `#rgb` or `#rrggbb` @returns {[number, number, number]} */
function toRgb(hex) {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? [...value].map((c) => c + c).join('') : value;
  return [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16));
}

/** WCAG relative luminance. @param {string} hex */
export function luminance(hex) {
  const [r, g, b] = toRgb(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colors, from 1 to 21. */
export function contrastRatio(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/**
 * Pick whichever candidate reads best on `background`.
 * @param {string} background hex
 * @param {string[]} candidates hex colors, best-first among equals
 */
export function bestContrast(background, candidates) {
  return candidates.reduce((best, candidate) =>
    contrastRatio(background, candidate) > contrastRatio(background, best) ? candidate : best,
  );
}

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

/** @param {string} hex @returns {string} normalized `#rrggbb` */
function toHex([r, g, b]) {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Blend `hex` toward `target` by `amount` (0..1).
 * @param {string} hex
 * @param {string} target
 * @param {number} amount
 */
export function mix(hex, target, amount) {
  const a = toRgb(hex);
  const b = toRgb(target);
  return toHex(a.map((channel, i) => channel + (b[i] - channel) * amount));
}

/** @param {string} hex @returns {[number, number, number]} h 0..1, s 0..1, l 0..1 */
function toHsl(hex) {
  const [r, g, b] = toRgb(hex).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return [0, 0, lightness];

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  return [(((hue * 60) % 360) + 360) % 360 / 360, saturation, lightness];
}

/** @returns {string} `#rrggbb` */
function fromHsl(hue, saturation, lightness) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const sector = hue * 6;
  const second = chroma * (1 - Math.abs((sector % 2) - 1));
  const rgb =
    sector < 1 ? [chroma, second, 0]
    : sector < 2 ? [second, chroma, 0]
    : sector < 3 ? [0, chroma, second]
    : sector < 4 ? [0, second, chroma]
    : sector < 5 ? [second, 0, chroma]
    : [chroma, 0, second];
  const offset = lightness - chroma / 2;
  return toHex(rgb.map((channel) => (channel + offset) * 255));
}

/**
 * A version of `color` that is actually readable as text on `background`.
 *
 * The accent comes from config.yaml, so on one theme it can be perfectly
 * legible and on the other nearly invisible — a dark brand blue on a dark
 * surface, for instance. This walks the colour toward white or black (away
 * from the background) until it clears the ratio, and only then gives up and
 * returns the plain foreground.
 *
 * @param {string} background hex
 * @param {string} color hex
 * @param {string} fallback hex used if even full white/black is not enough
 * @param {number} [minRatio] WCAG ratio to clear, AA body text by default
 */
export function readableOn(background, color, fallback, minRatio = 4.5) {
  if (contrastRatio(background, color) >= minRatio) return color;

  // Move lightness away from the background while keeping hue and chroma:
  // blending toward flat white would wash the brand colour out to grey.
  const [hue, saturation, lightness] = toHsl(color);
  const towardLight = luminance(background) < 0.5;
  for (let step = 1; step <= 20; step += 1) {
    const next = towardLight ? lightness + step * 0.04 : lightness - step * 0.04;
    if (next <= 0 || next >= 1) break;
    const candidate = fromHsl(hue, saturation, next);
    if (contrastRatio(background, candidate) >= minRatio) return candidate;
  }
  return fallback;
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

/**
 * Schema and loader for config.yaml.
 *
 * Everything the site renders comes through here. Invalid input fails the
 * build loudly instead of producing a broken (or unsafe) page.
 */
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { parse as parseYaml } from 'yaml';
import { resolveIcon, GENERIC_ICON_NAMES } from '../lib/icons.js';

/** URL schemes allowed anywhere in config.yaml. */
export const ALLOWED_URL_PROTOCOLS = Object.freeze(['https:', 'mailto:', 'tel:']);

export const DEFAULT_ACCENT = '#3b82f6';
export const DEFAULT_THEME_MODE = 'auto';

/** Control characters are stripped by the URL parser and can disguise a scheme. */
// eslint-disable-next-line no-control-regex -- matching them is the whole point
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

/** Thrown for any config problem; carries a message meant for a human. */
export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Parse a URL and enforce the scheme allowlist.
 * @param {unknown} value
 * @returns {string | null} normalized URL, or null when unsafe/invalid
 */
export function parseSafeUrl(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  // e.g. "java\nscript:alert(1)" normalizes to a javascript: URL.
  if (CONTROL_CHARS.test(trimmed)) return null;

  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (!ALLOWED_URL_PROTOCOLS.includes(url.protocol)) return null;
  return url.href;
}

/**
 * Accept an https URL or a repo-relative path (for avatars / og images).
 * @param {unknown} value
 * @returns {string | null} normalized source, or null when unsafe/invalid
 */
export function parseImageSource(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (CONTROL_CHARS.test(trimmed)) return null;
  if (trimmed.includes('\\')) return null;
  // Protocol-relative URLs inherit the page scheme and dodge the allowlist.
  if (trimmed.startsWith('//')) return null;

  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed);
  if (!hasScheme) return trimmed;

  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  return url.protocol === 'https:' ? url.href : null;
}

const ALLOWED_SCHEMES_HINT = ALLOWED_URL_PROTOCOLS.join(', ');

const urlField = z
  .string({ invalid_type_error: 'deve ser um texto com a URL', required_error: 'campo obrigatório' })
  .transform((value, ctx) => {
    const safe = parseSafeUrl(value);
    if (safe === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `URL inválida ou com esquema não permitido: ${JSON.stringify(value)}. Esquemas aceitos: ${ALLOWED_SCHEMES_HINT}`,
      });
      return z.NEVER;
    }
    return safe;
  });

const imageField = z
  .string({ invalid_type_error: 'deve ser um texto com o caminho ou a URL da imagem', required_error: 'campo obrigatório' })
  .transform((value, ctx) => {
    const safe = parseImageSource(value);
    if (safe === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `imagem inválida: ${JSON.stringify(value)}. Use um caminho relativo (ex: assets/avatar.svg) ou uma URL https://`,
      });
      return z.NEVER;
    }
    return safe;
  });

const iconField = z
  .string({ invalid_type_error: 'deve ser um texto com o nome do ícone', required_error: 'campo obrigatório' })
  .transform((value, ctx) => {
    const slug = value.trim().toLowerCase();
    if (resolveIcon(slug) === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `ícone desconhecido: ${JSON.stringify(value)}. Use um slug listado em simpleicons.org, ou um genérico: ${GENERIC_ICON_NAMES.join(', ')}`,
      });
      return z.NEVER;
    }
    return slug;
  });

const text = (max) =>
  z
    .string({ invalid_type_error: 'deve ser um texto', required_error: 'campo obrigatório' })
    .trim()
    .min(1, 'não pode ficar vazio')
    .max(max, `passou de ${max} caracteres`);

const profileSchema = z
  .object({
    name: text(80),
    tagline: text(160).optional(),
    avatar: imageField.optional(),
    // A circle crops the corners, which eats the wordmark on most logos.
    avatar_shape: z
      .enum(['circle', 'square'], {
        errorMap: () => ({ message: "deve ser 'circle' ou 'square'" }),
      })
      .default('circle'),
  })
  .strict();

const themeSchema = z
  .object({
    mode: z
      .enum(['light', 'dark', 'auto'], {
        errorMap: () => ({ message: "deve ser 'light', 'dark' ou 'auto'" }),
      })
      .default(DEFAULT_THEME_MODE),
    accent: z
      .string({ invalid_type_error: 'deve ser um texto' })
      .trim()
      .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'deve ser uma cor hex, ex: #3b82f6')
      .default(DEFAULT_ACCENT),
  })
  .strict()
  .default({});

const linkSchema = z
  .object({
    label: text(80),
    url: urlField,
    icon: iconField.optional(),
    highlight: z.boolean({ invalid_type_error: 'deve ser true ou false' }).default(false),
  })
  .strict();

/** Institutional mark shown under the card. */
const footerSchema = z
  .object({
    logo: imageField.optional(),
    text: text(120).optional(),
    url: urlField.optional(),
  })
  .strict()
  .optional();

const socialSchema = z
  .object({
    platform: iconField,
    url: urlField,
  })
  .strict();

const seoSchema = z
  .object({
    title: text(70).optional(),
    description: text(200).optional(),
    og_image: imageField.optional(),
    // Not in the minimum contract, but Open Graph requires absolute URLs and a
    // static site cannot know its own origin. Optional: without it, og:image
    // and <link rel="canonical"> are omitted for relative paths.
    // Normalized with a trailing slash: without it, `new URL('a', base)`
    // resolves against the parent path and silently drops the last segment.
    base_url: urlField
      .transform((value) => (value.endsWith('/') ? value : `${value}/`))
      .optional(),
  })
  .strict()
  .default({});

/** Fill in the defaults that depend on other fields. */
function applyDerivedDefaults(config) {
  const seo = {
    ...config.seo,
    title: config.seo.title ?? config.profile.name,
    description: config.seo.description ?? config.profile.tagline ?? config.profile.name,
    og_image: config.seo.og_image ?? config.profile.avatar,
  };
  return { ...config, seo };
}

export const configSchema = z
  .object({
    // Needed for assistive tech and correct hyphenation; cannot be derived.
    lang: z
      .string({ invalid_type_error: 'deve ser um texto' })
      .trim()
      .regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/, 'deve ser uma tag BCP 47, ex: pt-BR')
      .default('pt-BR'),
    profile: profileSchema,
    links: z.array(linkSchema, { invalid_type_error: 'deve ser uma lista de links' }).default([]),
    social: z.array(socialSchema, { invalid_type_error: 'deve ser uma lista' }).default([]),
    theme: themeSchema,
    seo: seoSchema,
    footer: footerSchema,
  })
  .strict()
  .transform(applyDerivedDefaults);

function formatPath(path) {
  if (path.length === 0) return '(raiz)';
  return path.reduce(
    (acc, part) => (typeof part === 'number' ? `${acc}[${part}]` : acc ? `${acc}.${part}` : String(part)),
    '',
  );
}

function formatIssues(issues, source) {
  const lines = issues.map((issue) => `  - ${formatPath(issue.path)}: ${issue.message}`);
  return `${source} é inválido:\n${lines.join('\n')}`;
}

/**
 * Validate an already-parsed config object.
 * @param {unknown} raw
 * @param {{source?: string}} [options]
 * @throws {ConfigError} listing every problem found
 */
export function parseConfig(raw, { source = 'config.yaml' } = {}) {
  if (raw === null || raw === undefined) {
    throw new ConfigError(`${source} está vazio. Comece a partir do config.example.yaml.`);
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ConfigError(`${source} deve conter um objeto YAML no nível raiz.`);
  }

  const result = configSchema.safeParse(raw);
  if (!result.success) throw new ConfigError(formatIssues(result.error.issues, source));
  return result.data;
}

/**
 * Read, parse and validate a config file.
 * @param {string | URL} filePath
 * @throws {ConfigError}
 */
export async function loadConfigFile(filePath) {
  const source = typeof filePath === 'string' ? filePath : decodeURIComponent(filePath.pathname).split('/').pop();

  let raw;
  try {
    raw = await readFile(filePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new ConfigError(`${source} não encontrado. Copie o config.example.yaml para config.yaml.`);
    }
    throw new ConfigError(`não foi possível ler ${source}: ${error.message}`);
  }

  let parsed;
  try {
    parsed = parseYaml(raw);
  } catch (error) {
    throw new ConfigError(`${source} não é YAML válido:\n  ${error.message}`);
  }

  return parseConfig(parsed, { source });
}

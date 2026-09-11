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
import { parseDateTime, toDate } from '../lib/datetime.js';

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

/**
 * zod 4 replaced required_error/invalid_type_error with a single `error` hook.
 * It fires for every issue on the field, so anything we do not translate must
 * return undefined, otherwise a generic message would bury the specific one
 * (a typo'd key reported as "wrong type", for instance).
 */
const message = (wrongType) => (issue) => {
  if (issue.code === 'invalid_type') return issue.input === undefined ? 'campo obrigatório' : wrongType;
  if (issue.code === 'unrecognized_keys') {
    return `chave desconhecida: ${issue.keys.map((key) => JSON.stringify(key)).join(', ')}`;
  }
  return undefined;
};

/** Same treatment for object fields, so a missing block reads like the rest. */
const objectError = { error: message('deve ser um bloco de configuração') };

const urlField = z
  .string({ error: message('deve ser um texto com a URL') })
  .transform((value, ctx) => {
    const safe = parseSafeUrl(value);
    if (safe === null) {
      ctx.addIssue({
        code: 'custom',
        message: `URL inválida ou com esquema não permitido: ${JSON.stringify(value)}. Esquemas aceitos: ${ALLOWED_SCHEMES_HINT}`,
      });
      return z.NEVER;
    }
    return safe;
  });

const imageField = z
  .string({ error: message('deve ser um texto com o caminho ou a URL da imagem') })
  .transform((value, ctx) => {
    const safe = parseImageSource(value);
    if (safe === null) {
      ctx.addIssue({
        code: 'custom',
        message: `imagem inválida: ${JSON.stringify(value)}. Use um caminho relativo (ex: assets/avatar.svg) ou uma URL https://`,
      });
      return z.NEVER;
    }
    return safe;
  });

const iconField = z
  .string({ error: message('deve ser um texto com o nome do ícone') })
  .transform((value, ctx) => {
    const slug = value.trim().toLowerCase();
    if (resolveIcon(slug) === null) {
      ctx.addIssue({
        code: 'custom',
        message: `ícone desconhecido: ${JSON.stringify(value)}. Use um slug listado em simpleicons.org, ou um genérico: ${GENERIC_ICON_NAMES.join(', ')}`,
      });
      return z.NEVER;
    }
    return slug;
  });

const dateTimeField = z
  .string({ error: message('deve ser um texto com a data') })
  .transform((value, ctx) => {
    if (parseDateTime(value) === null) {
      ctx.addIssue({
        code: 'custom',
        message: `data inválida: ${JSON.stringify(value)}. Use AAAA-MM-DD ou AAAA-MM-DDTHH:MM (ex: 2026-09-21T19:00)`,
      });
      return z.NEVER;
    }
    return value.trim();
  });

const text = (max) =>
  z
    .string({ error: message('deve ser um texto') })
    .trim()
    .min(1, 'não pode ficar vazio')
    .max(max, `passou de ${max} caracteres`);

const profileSchema = z
  .object(
    {
    name: text(80),
    tagline: text(160).optional(),
    avatar: imageField.optional(),
    // A faixa larga do topo. Quando existe, ela substitui o avatar no
    // cabeçalho; o avatar continua servindo de favicon e de imagem de
    // compartilhamento, para os quais uma faixa 2:1 não serve.
    hero: imageField.optional(),
    // Only surfaces in the calendar files, so a visitor who saves an event
    // gets the address with it.
    location: text(160).optional(),
    handle: z
      .string({ error: message('deve ser um texto') })
      .trim()
      .regex(/^@[A-Za-z0-9._]{1,40}$/, 'deve começar com @, ex: @museudeartedelondrina')
      .optional(),
    handle_url: urlField.optional(),
    // A circle crops the corners, which eats the wordmark on most logos.
    avatar_shape: z
      .enum(['circle', 'square'], { error: "deve ser 'circle' ou 'square'" })
      .default('circle'),
    },
    objectError,
  )
  .strict();

const themeSchema = z
  .object(
    {
    mode: z
      .enum(['light', 'dark', 'auto'], { error: "deve ser 'light', 'dark' ou 'auto'" })
      .default(DEFAULT_THEME_MODE),
    accent: z
      .string({ error: message('deve ser um texto') })
      .trim()
      .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'deve ser uma cor hex, ex: #3b82f6')
      .default(DEFAULT_ACCENT),
    },
    objectError,
  )
  .strict()
  // zod 4: .default() hands the value back untouched, so nested defaults never
  // run. .prefault() feeds it through the schema, which is what we want here.
  .prefault({});

const linkSchema = z
  .object(
    {
    label: text(80),
    url: urlField,
    icon: iconField.optional(),
    highlight: z.boolean({ error: message('deve ser true ou false') }).default(false),
    },
    objectError,
  )
  .strict();

/** One item of the agenda: what it is, when it happens, and where to read more. */
const eventSchema = z
  .object(
    {
      title: text(140),
      start: dateTimeField,
      end: dateTimeField.optional(),
      kind: text(40).optional(),
      image: imageField.optional(),
      url: urlField.optional(),
      description: text(300).optional(),
    },
    objectError,
  )
  .strict()
  .superRefine((event, ctx) => {
    if (!event.end) return;
    const start = parseDateTime(event.start);
    const end = parseDateTime(event.end);
    if (toDate(end, { endOfDay: !end.hasTime }) < toDate(start)) {
      ctx.addIssue({ code: 'custom', path: ['end'], message: 'termina antes de começar' });
    }
  });

/**
 * Uma faixa de horário de funcionamento.
 *
 * Em duas partes porque a página alinha os horários em coluna, e para isso
 * precisa saber onde termina o dia e começa a hora. `note` carrega a condição
 * que não cabe no nome dos dias, como "a partir do 5º dia útil".
 */
const hoursSchema = z
  .object(
    {
      days: text(60),
      time: text(40),
      note: text(80).optional(),
    },
    objectError,
  )
  .strict();

/** One institutional mark in the footer strip. */
const footerLogoSchema = z
  .object(
    {
      image: imageField,
      // With more than one mark, the caption cannot name them all, so each
      // logo carries its own alternative text.
      alt: text(80).optional(),
    },
    objectError,
  )
  .strict();

/** Institutional marks shown under the card. */
const footerSchema = z
  .object(
    {
      logos: z
        .array(footerLogoSchema, { error: message('deve ser uma lista de logotipos') })
        .max(4, 'no máximo 4 logotipos')
        .default([]),
      text: text(120).optional(),
      url: urlField.optional(),
    },
    objectError,
  )
  .strict()
  .optional();

const socialSchema = z
  .object(
    {
    platform: iconField,
    url: urlField,
    },
    objectError,
  )
  .strict();

const seoSchema = z
  .object(
    {
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
    },
    objectError,
  )
  .strict()
  // zod 4: .default() hands the value back untouched, so nested defaults never
  // run. .prefault() feeds it through the schema, which is what we want here.
  .prefault({});

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
  .object(
    {
    // Needed for assistive tech and correct hyphenation; cannot be derived.
    lang: z
      .string({ error: message('deve ser um texto') })
      .trim()
      .regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/, 'deve ser uma tag BCP 47, ex: pt-BR')
      .default('pt-BR'),
    profile: profileSchema,
    hours: z
      .array(hoursSchema, { error: message('deve ser uma lista de horários') })
      .max(4, 'no máximo 4 faixas de horário')
      .default([]),
    events: z.array(eventSchema, { error: message('deve ser uma lista de eventos') }).default([]),
    links: z.array(linkSchema, { error: message('deve ser uma lista de links') }).default([]),
    social: z.array(socialSchema, { error: message('deve ser uma lista') }).default([]),
    theme: themeSchema,
    seo: seoSchema,
    footer: footerSchema,
    },
    objectError,
  )
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

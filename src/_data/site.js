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
  wallClockNow,
} from '../../lib/datetime.js';
import { slugify } from '../../lib/slug.js';
import { googleCalendarUrl, outlookCalendarUrl } from '../../lib/calendar-links.js';

const DEFAULT_CONFIG = new URL('../../config.yaml', import.meta.url);

/**
 * The furthest surface accent-coloured text ever lands on, handed to the
 * stylesheet so the contrast calculation below and the rendered background
 * cannot drift apart. In the light theme the accent is dark, so the deepest
 * tint is its worst case; in the dark theme the accent is light, so the
 * lightest tint is.
 */
const SURFACE_HOVER = { light: '#e8eef7', dark: '#1a2540' };

/** A cor do próprio cartão, entregue ao CSS e ao <meta name="theme-color">. */
const SURFACE = { light: '#ffffff', dark: '#0d1524' };


/**
 * O domínio para onde um link leva, para o texto de ajuda dizer onde a pessoa
 * vai parar antes de ela clicar. Sem o "www.", que não informa nada.
 * @param {string} url
 * @returns {string | null}
 */
function dominio(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * O texto que aparece ao passar o mouse por cima de um contato do topo.
 *
 * O rótulo sozinho diz o nome do serviço e não o que o botão faz. Aqui o
 * esquema do endereço decide o verbo: escrever, ligar ou abrir.
 * @param {{url: string, iconData: {title: string}}} entrada
 */
function dicaDoContato(entrada) {
  if (entrada.url.startsWith('mailto:')) return 'Escrever para o museu por e-mail';
  if (entrada.url.startsWith('tel:')) return 'Ligar para o museu';
  return `Abrir o ${entrada.iconData.title} do museu`;
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
  const local = { location: config.profile.location };
  const upcoming = config.events
    .map((event) => {
      // Already validated by the schema, so these parses cannot fail.
      const start = parseDateTime(event.start);
      const end = event.end ? parseDateTime(event.end) : null;
      const when = formatEventWhen(start, end, config.lang);
      const comDatas = { ...event, start, end };
      return {
        ...event,
        start,
        end,
        slug: slugify(event.title, event.start),
        iso: toIsoString(start),
        time: when.time,
        // Os dois calendários de navegador mais usados por aqui. Quem usa
        // outro continua tendo o arquivo .ics no mesmo menu.
        dicaDoLink: event.url ? `Abrir a página do evento em ${dominio(event.url)}` : null,
        googleUrl: googleCalendarUrl(comDatas, local),
        outlookUrl: outlookCalendarUrl(comDatas, local),
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

  // A instituição, além dos eventos: é a entidade que um buscador usa para
  // montar o painel do museu, com endereço, logotipo e perfis oficiais.
  const perfis = config.social.map((s) => s.url).filter((u) => u.startsWith('https://'));
  const telefone = config.social.find((s) => s.url.startsWith('tel:'))?.url.slice(4);
  const email = config.social.find((s) => s.url.startsWith('mailto:'))?.url.slice(7);

  const museu = {
    '@context': 'https://schema.org',
    '@type': 'Museum',
    name: config.profile.name,
    ...(config.seo.base_url ? { url: config.seo.base_url } : {}),
    ...(config.seo.description ? { description: config.seo.description } : {}),
    ...(absolute(config.profile.avatar) ? { logo: absolute(config.profile.avatar) } : {}),
    ...(absolute(config.seo.og_image) ? { image: absolute(config.seo.og_image) } : {}),
    ...(config.profile.location ? { address: config.profile.location } : {}),
    ...(telefone ? { telephone: telefone } : {}),
    ...(email ? { email } : {}),
    ...(perfis.length > 0 ? { sameAs: perfis } : {}),
  };

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

  const entidades = [museu, ...events];
  return JSON.stringify(entidades).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

export default async function site() {
  // Read at call time, not import time, so tests can point at a fixture.
  const config = await loadConfigFile(process.env.CONFIG_FILE ?? DEFAULT_CONFIG);
  const { accent } = config.theme;
  const agenda = buildAgenda(config, wallClockNow());

  return {
    ...config,
    initials: initials(config.profile.name),
    agenda,
    structuredData: structuredData(config, agenda),
    links: config.links.map((link) => ({
      ...link,
      iconData: link.icon ? resolveIcon(link.icon) : null,
      dica: dominio(link.url) ? `Abrir em ${dominio(link.url)}, numa nova aba` : 'Abrir numa nova aba',
    })),
    social: config.social.map((entry) => {
      const iconData = resolveIcon(entry.platform);
      return { ...entry, iconData, dica: dicaDoContato({ ...entry, iconData }) };
    }),
    footerDica: config.footer?.url ? `Abrir ${dominio(config.footer.url)}, numa nova aba` : null,
    handleDica: config.profile.handle_url
      ? `Abrir o perfil do museu em ${dominio(config.profile.handle_url)}`
      : null,
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
    surface: SURFACE,
    focusRing: {
      light: contrastRatio(accent, '#ffffff') >= 3 ? accent : '#0f172a',
      dark: contrastRatio(accent, '#0b1120') >= 3 ? accent : '#e8edf7',
    },
  };
}

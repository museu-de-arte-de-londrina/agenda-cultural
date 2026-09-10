import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { parseConfig, loadConfigFile, ConfigError, DEFAULT_ACCENT } from '../schema/config.schema.js';

const minimal = () => ({
  profile: { name: 'Ada Lovelace' },
  links: [{ label: 'Site', url: 'https://example.com/' }],
});

/** Assert the config is rejected and the message points at `expected`. */
function rejects(config, expected) {
  let error;
  try {
    parseConfig(config);
  } catch (thrown) {
    error = thrown;
  }
  assert.ok(error, `esperava um erro para ${JSON.stringify(config)}`);
  assert.ok(error instanceof ConfigError, `esperava ConfigError, veio ${error}`);
  assert.match(error.message, expected);
  return error;
}

test('config válido é aceito e normalizado', () => {
  const config = parseConfig({
    lang: 'en',
    profile: { name: '  Ada Lovelace  ', tagline: 'Matemática', avatar: 'assets/avatar.svg' },
    theme: { mode: 'dark', accent: '#2563eb' },
    links: [{ label: 'Site', url: 'https://example.com', icon: 'github', highlight: true }],
    social: [{ platform: 'mastodon', url: 'https://mastodon.social/@ada' }],
    seo: { title: 'Ada', description: 'links', base_url: 'https://ada.example.com/links' },
  });

  assert.equal(config.profile.name, 'Ada Lovelace', 'espaços das pontas são removidos');
  assert.equal(config.theme.mode, 'dark');
  assert.equal(config.links[0].highlight, true);
  assert.equal(config.seo.base_url, 'https://ada.example.com/links/', 'barra final é garantida');
});

test('defaults documentados são aplicados', () => {
  const config = parseConfig(minimal());

  assert.equal(config.lang, 'pt-BR');
  assert.equal(config.theme.mode, 'auto');
  assert.equal(config.theme.accent, DEFAULT_ACCENT);
  assert.equal(config.links[0].highlight, false);
  assert.equal(config.social.length, 0);
  assert.equal(config.seo.title, 'Ada Lovelace', 'title cai para profile.name');
  assert.equal(config.seo.description, 'Ada Lovelace', 'description cai para o name quando não há tagline');
  assert.equal(config.seo.base_url, undefined);
});

test('seo.description cai para a tagline quando existe', () => {
  const config = parseConfig({ ...minimal(), profile: { name: 'Ada', tagline: 'Matemática' } });
  assert.equal(config.seo.description, 'Matemática');
});

test('campo obrigatório faltando quebra o build', () => {
  rejects({ profile: {}, links: [] }, /profile\.name: campo obrigatório/);
  rejects({ links: [] }, /profile: campo obrigatório/);
  rejects({ profile: { name: 'Ada' }, links: [{ label: 'Site' }] }, /links\[0\]\.url: campo obrigatório/);
});

test('tipo errado quebra o build com o caminho do campo', () => {
  rejects({ profile: { name: 42 } }, /profile\.name: deve ser um texto/);
  rejects({ profile: { name: 'Ada' }, links: 'https://example.com' }, /links: deve ser uma lista de links/);
  rejects({ ...minimal(), theme: { mode: 'escuro' } }, /theme\.mode: deve ser 'light', 'dark' ou 'auto'/);
  rejects({ ...minimal(), theme: { accent: 'azul' } }, /theme\.accent: deve ser uma cor hex/);
  rejects({ ...minimal(), lang: 'português' }, /lang: deve ser uma tag BCP 47/);
});

test('URL com javascript: quebra o build em vez de virar página', () => {
  rejects(
    { profile: { name: 'Ada' }, links: [{ label: 'x', url: 'javascript:alert(1)' }] },
    /links\[0\]\.url: URL inválida ou com esquema não permitido/,
  );
  rejects(
    { profile: { name: 'Ada' }, social: [{ platform: 'github', url: 'data:text/html,<script>' }] },
    /social\[0\]\.url: URL inválida/,
  );
  rejects({ profile: { name: 'Ada', avatar: 'javascript:alert(1)' } }, /profile\.avatar: imagem inválida/);
});

test('avatar_shape tem default e recusa valor fora do enum', () => {
  assert.equal(parseConfig(minimal()).profile.avatar_shape, 'circle');
  assert.equal(
    parseConfig({ ...minimal(), profile: { name: 'Ada', avatar_shape: 'square' } }).profile.avatar_shape,
    'square',
  );
  rejects(
    { ...minimal(), profile: { name: 'Ada', avatar_shape: 'redondo' } },
    /profile\.avatar_shape: deve ser 'circle' ou 'square'/,
  );
});

test('events é opcional e valida data, ordem e chaves', () => {
  assert.deepEqual(parseConfig(minimal()).events, [], 'sem agenda, lista vazia');

  const config = parseConfig({
    ...minimal(),
    events: [{ title: 'Abertura', start: '2026-09-21T19:00', end: '2026-09-21T20:00', kind: 'Show' }],
  });
  assert.equal(config.events[0].title, 'Abertura');
  assert.equal(config.events[0].start, '2026-09-21T19:00');

  rejects({ ...minimal(), events: [{ start: '2026-09-21' }] }, /events\[0\]\.title: campo obrigatório/);
  rejects({ ...minimal(), events: [{ title: 'x' }] }, /events\[0\]\.start: campo obrigatório/);
  rejects(
    { ...minimal(), events: [{ title: 'x', start: '21/09/2026' }] },
    /events\[0\]\.start: data inválida/,
  );
  rejects(
    { ...minimal(), events: [{ title: 'x', start: '2026-02-31' }] },
    /events\[0\]\.start: data inválida/,
  );
  rejects(
    { ...minimal(), events: [{ title: 'x', start: '2026-09-25', end: '2026-09-21' }] },
    /events\[0\]\.end: termina antes de começar/,
  );
  rejects(
    { ...minimal(), events: [{ title: 'x', start: '2026-09-21', url: 'javascript:alert(1)' }] },
    /events\[0\]\.url: URL inválida/,
  );
  rejects({ ...minimal(), events: [{ title: 'x', start: '2026-09-21', img: 'a.png' }] }, /chave desconhecida/);
  rejects({ ...minimal(), events: 'nenhum' }, /events: deve ser uma lista de eventos/);
});

test('o mesmo dia inteiro como início e fim é aceito', () => {
  const config = parseConfig({
    ...minimal(),
    events: [{ title: 'Temporada', start: '2026-09-21', end: '2026-09-27' }],
  });
  assert.equal(config.events[0].end, '2026-09-27');
});

test('handle precisa da arroba', () => {
  assert.equal(
    parseConfig({ ...minimal(), profile: { name: 'Museu', handle: '@museu.londrina' } }).profile.handle,
    '@museu.londrina',
  );
  rejects({ ...minimal(), profile: { name: 'Museu', handle: 'museu' } }, /handle: deve começar com @/);
  rejects({ ...minimal(), profile: { name: 'Museu', handle: '@com espaço' } }, /handle: deve começar com @/);
  rejects(
    { ...minimal(), profile: { name: 'Museu', handle_url: 'javascript:alert(1)' } },
    /handle_url: URL inválida/,
  );
});

test('footer é opcional e passa pela mesma allowlist de URL', () => {
  assert.equal(parseConfig(minimal()).footer, undefined);

  const config = parseConfig({
    ...minimal(),
    footer: {
      logos: [{ image: 'assets/orgao.png', alt: 'Órgão' }, { image: 'assets/museu.webp' }],
      text: 'Secretaria',
      url: 'https://example.org',
    },
  });
  assert.equal(config.footer.text, 'Secretaria');
  assert.equal(config.footer.url, 'https://example.org/');
  assert.equal(config.footer.logos.length, 2);
  assert.equal(config.footer.logos[0].alt, 'Órgão');
  assert.equal(config.footer.logos[1].alt, undefined, 'alt é opcional');

  assert.deepEqual(parseConfig({ ...minimal(), footer: { text: 'Só texto' } }).footer.logos, []);

  rejects({ ...minimal(), footer: { url: 'javascript:alert(1)' } }, /footer\.url: URL inválida/);
  rejects(
    { ...minimal(), footer: { logos: [{ image: '//evil.example.com/a.png' }] } },
    /footer\.logos\[0\]\.image: imagem inválida/,
  );
  rejects({ ...minimal(), footer: { logos: [{}] } }, /footer\.logos\[0\]\.image: campo obrigatório/);
  rejects({ ...minimal(), footer: { logos: [{ image: 'a.png', src: 'b' }] } }, /chave desconhecida: "src"/);
  rejects({ ...minimal(), footer: { txt: 'x' } }, /footer: chave desconhecida: "txt"/);
});

test('ícone desconhecido quebra o build e sugere alternativas', () => {
  rejects(
    { ...minimal(), links: [{ label: 'x', url: 'https://a.example.com', icon: 'naoexiste' }] },
    /icon: ícone desconhecido: "naoexiste".+email, website, link/s,
  );
});

test('chave desconhecida quebra o build (pega erro de digitação)', () => {
  rejects({ ...minimal(), profiel: {} }, /\(raiz\): chave desconhecida: "profiel"/);
  rejects({ ...minimal(), profile: { name: 'Ada', taglines: 'x' } }, /profile: chave desconhecida: "taglines"/);
});

test('todos os problemas são reportados de uma vez', () => {
  const error = rejects(
    { profile: {}, links: [{ label: 'x', url: 'javascript:alert(1)' }], theme: { mode: 'nope' } },
    /profile\.name/,
  );
  assert.match(error.message, /links\[0\]\.url/);
  assert.match(error.message, /theme\.mode/);
});

test('config vazio ou não-objeto tem mensagem própria', () => {
  rejects(null, /está vazio/);
  rejects([{ profile: {} }], /objeto YAML no nível raiz/);
});

test('loadConfigFile reporta arquivo ausente e YAML quebrado', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'linkcfg-'));
  try {
    await assert.rejects(() => loadConfigFile(join(dir, 'nao-existe.yaml')), /não encontrado/);

    const broken = join(dir, 'broken.yaml');
    await writeFile(broken, 'profile:\n  name: "sem fechar\n   - [\n');
    await assert.rejects(() => loadConfigFile(broken), /não é YAML válido/);

    const good = join(dir, 'good.yaml');
    await writeFile(good, 'profile:\n  name: Ada\nlinks:\n  - label: Site\n    url: https://example.com/\n');
    const config = await loadConfigFile(good);
    assert.equal(config.profile.name, 'Ada');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('o config.yaml e o config.example.yaml do repo são válidos', async () => {
  for (const file of ['config.yaml', 'config.example.yaml']) {
    const config = await loadConfigFile(new URL(`../${file}`, import.meta.url));
    assert.ok(config.profile.name.length > 0, `${file} sem nome`);
  }
});

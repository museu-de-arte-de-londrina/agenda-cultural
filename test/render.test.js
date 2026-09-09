import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import Eleventy from '@11ty/eleventy';

/**
 * Build the real site against a fixture config and return the rendered HTML.
 * This is the end-to-end guarantee: whatever escaping the template relies on
 * has to hold in the actual output, not just in theory.
 */
async function render(configYaml) {
  const dir = await mkdtemp(join(tmpdir(), 'linkrender-'));
  const configFile = join(dir, 'config.yaml');
  await writeFile(configFile, configYaml);

  const previous = process.env.CONFIG_FILE;
  process.env.CONFIG_FILE = configFile;
  try {
    const eleventy = new Eleventy(null, null, { configPath: 'eleventy.config.js', quietMode: true });
    const results = await eleventy.toJSON();
    const page = results.find((result) => result.outputPath.endsWith('index.html'));
    assert.ok(page, 'index.html não foi gerado');
    return page.content;
  } finally {
    if (previous === undefined) delete process.env.CONFIG_FILE;
    else process.env.CONFIG_FILE = previous;
    await rm(dir, { recursive: true, force: true });
  }
}

const PAYLOAD = '<script>alert("xss")</script>';

test('valores do YAML são escapados no HTML final', async () => {
  const html = await render(`
profile:
  name: '${PAYLOAD} & Cia'
  tagline: '"aspas" & <b>negrito</b>'
links:
  - label: '<img src=x onerror=alert(1)>'
    url: https://example.com/
social:
  - platform: github
    url: https://github.com/octocat
seo:
  title: "<title-injection>"
  description: "fim </head><script>alert(2)</script>"
`);

  assert.ok(!html.includes(PAYLOAD), 'o payload apareceu cru no HTML');
  assert.ok(!html.includes('<img src=x'), 'a tag img apareceu crua');
  // `onerror=` still appears as text inside the escaped label; what matters
  // is that it is not inside a tag, which the escaped-form match below proves.
  assert.ok(!html.includes('<script'), 'nenhuma tag script deve existir na página');
  assert.ok(!html.includes('</head><script>'), 'a meta description escapou do atributo');

  assert.match(html, /&lt;script&gt;alert\((?:&quot;|&#34;)xss(?:&quot;|&#34;)\)&lt;\/script&gt; &amp; Cia/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /&lt;title-injection&gt;/);
});

test('links externos saem com target e rel seguros', async () => {
  const html = await render(`
profile:
  name: Ada
links:
  - label: Site
    url: https://example.com/
social:
  - platform: github
    url: https://github.com/octocat
`);

  const anchors = html.match(/<a class="(?:link|social__link)[^"]*"[^>]*>/g) ?? [];
  assert.equal(anchors.length, 2);
  for (const anchor of anchors) {
    assert.match(anchor, /target="_blank"/);
    assert.match(anchor, /rel="noopener noreferrer"/);
  }
});

test('a CSP não abre exceção para inline', async () => {
  const html = await render('profile:\n  name: Ada\n');

  const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/);
  assert.ok(csp, 'meta CSP ausente');
  assert.ok(!csp[1].includes('unsafe-inline'), 'CSP com unsafe-inline');
  assert.ok(!csp[1].includes('unsafe-eval'), 'CSP com unsafe-eval');
  assert.match(csp[1], /script-src 'none'/);
  assert.ok(!html.includes('<style'), 'CSS inline quebraria a CSP');
  assert.ok(!/<[a-z]+[^>]*\sstyle="/.test(html), 'atributo style quebraria a CSP');
});

test('sem avatar, cai para as iniciais e não gera img quebrada', async () => {
  const html = await render('profile:\n  name: Ada Lovelace\n');

  assert.ok(!html.includes('<img'), 'não deveria haver img sem avatar');
  assert.match(html, /avatar--initials[^>]*>AL</);
});

test('config inválido derruba o build em vez de renderizar', async () => {
  await assert.rejects(
    () => render('profile:\n  name: Ada\nlinks:\n  - label: x\n    url: "javascript:alert(1)"\n'),
    /URL inválida ou com esquema não permitido/,
  );
});

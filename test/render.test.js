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
  // JSON-LD é bloco de dados, não script executável, e por isso não conta aqui.
  const inline = /<script(?![^>]*(?:src=|type="application\/ld\+json"))/;
  assert.ok(!inline.test(html), 'nenhum script inline executável deve existir na página');
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
  assert.match(csp[1], /script-src 'self'/);
  assert.ok(!html.includes('<style'), 'CSS inline quebraria a CSP');
  assert.ok(!/<[a-z]+[^>]*\sstyle="/.test(html), 'atributo style quebraria a CSP');

  // Todo script executável precisa vir de arquivo do próprio site. A asserção
  // é sobre isso, e não sobre quantos são, para continuar valendo quando um
  // terceiro aparecer. O elemento JSON-LD é bloco de dados e não conta.
  const executaveis = [
    ...html.matchAll(/<script(?![^>]*type="application\/ld\+json")([^>]*)>/g),
  ].map((m) => m[1]);
  assert.ok(executaveis.length > 0, 'nenhum script encontrado');
  for (const atributos of executaveis) {
    assert.match(atributos, /\ssrc="[^":]+"/, `script inline ou de outro domínio: ${atributos}`);
  }

  const tema = executaveis.find((a) => /src="theme\.js"/.test(a));
  assert.ok(tema, 'o script de tema sumiu');
  assert.ok(!tema.includes('defer'), 'defer faria o tema piscar antes de aplicar');
});

test('sem avatar, cai para as iniciais e não gera img quebrada', async () => {
  const html = await render('profile:\n  name: Ada Lovelace\n');

  assert.ok(!html.includes('<img'), 'não deveria haver img sem avatar');
  assert.match(html, /avatar--initials[^>]*>AL</);
});

test('cada logotipo do rodapé carrega seu próprio texto alternativo', async () => {
  const html = await render(`
profile:
  name: Museu
footer:
  logos:
    - image: assets/avatar.svg
      alt: Prefeitura
    - image: assets/avatar.svg
  text: Secretaria Municipal de Cultura
  url: https://example.org
`);

  const logos = html.match(/<img class="footer__logo"[^>]*>/g) ?? [];
  assert.equal(logos.length, 2, 'os dois logotipos devem ser renderizados');
  assert.match(logos[0], /alt="Prefeitura"/, 'com alt declarado, ele é usado');
  assert.match(logos[1], /alt=""/, 'sem alt declarado, o logotipo é decorativo');
  for (const logo of logos) assert.match(logo, /width="88"[^>]*height="32"/, 'espaço reservado');

  assert.match(html, /class="footer__inner" href="https:\/\/example\.org\/"[^>]*rel="noopener noreferrer"/);
});

test('rodapé sem link não vira âncora vazia', async () => {
  const html = await render('profile:\n  name: Museu\nfooter:\n  text: Secretaria\n');
  assert.match(html, /<div class="footer__inner">/);
  assert.ok(!/<a class="footer__inner"/.test(html));
});

test('a agenda mostra só o que ainda não terminou, do mais próximo ao mais distante', async () => {
  const html = await render(`
profile:
  name: Museu
events:
  - title: Evento de 2099
    start: 2099-12-01T19:00
  - title: Evento que já passou
    start: 2000-01-01T19:00
    end: 2000-01-01T20:00
  - title: Evento de 2098
    start: 2098-03-05T10:00
    end: 2098-03-05T12:00
    kind: Oficina
`);

  assert.ok(!html.includes('Evento que já passou'), 'evento encerrado não deveria aparecer');

  const ordem = [...html.matchAll(/class="entry__title">\s*(?:<a[^>]*>)?([^<\n]+)/g)].map((m) => m[1].trim());
  assert.deepEqual(ordem, ['Evento de 2098', 'Evento de 2099'], 'ordenado por data, não pela ordem do arquivo');

  assert.match(html, /<time datetime="2098-03-05T10:00">/);
  assert.match(html, /class="entry__kind">Oficina</);
});

test('a data aparece uma vez por dia, não uma vez por evento', async () => {
  const html = await render(`
profile:
  name: Museu
events:
  - title: Manhã
    start: 2099-05-04T09:00
  - title: Tarde
    start: 2099-05-04T14:00
  - title: Noite
    start: 2099-05-04T20:00
  - title: Outro dia
    start: 2099-05-05T10:00
`);

  // Três eventos no mesmo dia compartilham um único trilho de data.
  assert.equal((html.match(/class="day__rail"/g) ?? []).length, 2, 'um trilho por dia');
  assert.equal((html.match(/class="day__number">04</g) ?? []).length, 1, 'o dia 04 é impresso uma vez');
  assert.equal((html.match(/class="entry__title"/g) ?? []).length, 4);
});

test('todo evento mostra sua descrição', async () => {
  const html = await render(`
profile:
  name: Museu
events:
  - title: Primeiro
    start: 2099-05-04T09:00
    description: Contexto do primeiro.
  - title: Segundo
    start: 2099-05-04T14:00
    description: Contexto do segundo.
  - title: Terceiro
    start: 2099-05-04T18:00
`);

  assert.ok(html.includes('Contexto do primeiro.'));
  assert.ok(html.includes('Contexto do segundo.'), 'a descrição não é privilégio do primeiro');
  assert.equal((html.match(/class="entry__description"/g) ?? []).length, 2, 'sem description, nada é renderizado');

  // Nenhum evento recebe tratamento visual próprio.
  assert.ok(!html.includes('entry--featured'));
});

test('a lista de links não carrega descrição', async () => {
  const html = await render(
    'profile:\n  name: Museu\nlinks:\n  - label: Portal\n    url: https://example.org\n',
  );
  assert.match(html, /class="link__label">Portal</);
  assert.ok(!html.includes('link__description'));
});

test('temporada de vários dias diz até quando vai', async () => {
  const html = await render(
    'profile:\n  name: Museu\nevents:\n  - title: Mostra\n    start: 2099-05-04\n    end: 2099-05-20\n',
  );
  assert.match(html, /class="entry__until">até 20 de maio</);
});

test('agenda vazia mostra um aviso em vez de sumir', async () => {
  const html = await render('profile:\n  name: Museu\n');
  assert.match(html, /class="empty"/);
  assert.ok(!html.includes('class="day__rail"'));
});

test('o título do evento é escapado como todo o resto', async () => {
  const html = await render(`
profile:
  name: Museu
events:
  - title: '<script>alert(1)</script> & cia'
    start: 2099-01-01T10:00
    kind: '<b>tipo</b>'
`);

  assert.ok(!html.includes('<script>alert(1)'), 'payload cru no HTML');
  assert.ok(!html.includes('<b>tipo</b>'), 'markup cru na etiqueta');
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; cia/);
});

test('o JSON-LD descreve os eventos e não dá para escapar dele', async () => {
  const html = await render(`
profile:
  name: Museu
  location: Rua Sergipe, 640
events:
  - title: 'Fuga </script><script>alert(1)</script> & cia'
    start: 2099-05-04T19:00
    end: 2099-05-04T21:00
    kind: Teatro
`);

  const bloco = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(bloco, 'bloco de dados ausente');

  // Se o payload tivesse fechado o elemento, este parse falharia.
  const dados = JSON.parse(bloco[1]);
  const eventos = dados.filter((d) => d['@type'] === 'Event');
  assert.equal(eventos.length, 1);
  assert.equal(eventos[0].name, 'Fuga </script><script>alert(1)</script> & cia', 'o título sobrevive intacto no JSON');
  assert.equal(eventos[0].startDate, '2099-05-04T19:00:00-03:00', 'horário de parede, com o deslocamento do local');
  assert.equal(eventos[0].location.address, 'Rua Sergipe, 640');

  const museu = dados.find((d) => d['@type'] === 'Museum');
  assert.ok(museu, 'a instituição também é declarada, para o painel do buscador');
  assert.equal(museu.name, 'Museu');

  assert.ok(!bloco[1].includes('</script'), 'nenhum fechamento de elemento pode sobreviver cru');
  assert.equal(
    (html.match(/type="application\/ld\+json"/g) ?? []).length,
    1,
    'um bloco de dados só, senão o buscador vê a agenda duas vezes',
  );
});

test('sem eventos, a instituição continua declarada', async () => {
  // O museu existe mesmo com a agenda vazia, e é a entidade que o buscador usa
  // para montar o painel do lugar.
  const html = await render('profile:\n  name: Museu\n');
  const bloco = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(bloco);
  const dados = JSON.parse(bloco[1]);
  assert.deepEqual(
    dados.map((d) => d['@type']),
    ['Museum'],
  );
});

test('cada evento oferece o próprio arquivo de calendário', async () => {
  const html = await render(
    'profile:\n  name: Museu\nevents:\n  - title: Show de Taiko\n    start: 2099-05-04T19:00\n',
  );

  const botao = html.match(/<a\b[^>]*class="entry__calendar"[\s\S]*?>/);
  assert.ok(botao, 'botão de calendário ausente');
  assert.match(botao[0], /href="eventos\/show-de-taiko-209905041900\.ics"/);
  assert.match(botao[0], /\bdownload\b/);
  // Só o ícone, então o rótulo precisa vir por aria-label.
  assert.match(botao[0], /aria-label="Adicionar [^"]*Show de Taiko[^"]*"/);

  assert.match(html, /href="agenda\.ics" download/);
});

test('o botão de tema começa escondido e traz os dois rótulos', async () => {
  const html = await render('profile:\n  name: Museu\n');

  const button = html.match(/<button[^>]*id="theme-toggle"[\s\S]*?>/);
  assert.ok(button, 'botão de tema ausente');
  assert.match(button[0], /\shidden/, 'sem JS o botão não faz nada, então nasce escondido');
  assert.match(button[0], /data-label-dark="[^"]+"/);
  assert.match(button[0], /data-label-light="[^"]+"/);
  assert.match(button[0], /aria-pressed="false"/);
});

test('o botão de tema fica dentro do frame, não solto sobre a página', async () => {
  const html = await render('profile:\n  name: Museu\n');

  // Fixo no canto da viewport ele montava na borda arredondada do cartão em
  // qualquer largura de celular, e ficava lá cobrindo conteúdo o scroll todo.
  const frame = html.slice(html.indexOf('<div class="frame">'));
  assert.ok(frame.includes('id="theme-toggle"'), 'o botão precisa estar dentro do frame');

  const antes = html.slice(0, html.indexOf('<div class="frame">'));
  assert.ok(!antes.includes('id="theme-toggle"'), 'nada de botão solto antes do frame');
});

test('theme.mode fixo vira data-theme no html, e auto não', async () => {
  const escuro = await render('profile:\n  name: Museu\ntheme:\n  mode: dark\n');
  assert.match(escuro, /<html lang="pt-BR" data-theme="dark">/);

  const automatico = await render('profile:\n  name: Museu\ntheme:\n  mode: auto\n');
  assert.ok(!automatico.includes('data-theme='), 'em auto quem manda é o prefers-color-scheme');
});

test('config inválido derruba o build em vez de renderizar', async () => {
  await assert.rejects(
    () => render('profile:\n  name: Ada\nlinks:\n  - label: x\n    url: "javascript:alert(1)"\n'),
    /URL inválida ou com esquema não permitido/,
  );
});

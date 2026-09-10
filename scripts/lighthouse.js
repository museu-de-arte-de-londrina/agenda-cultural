#!/usr/bin/env node
/**
 * Lighthouse against the built site: `npm run lighthouse`.
 *
 * Serves _site itself and shuts the server down afterwards, so the same
 * command works locally and on CI without anything left running.
 *
 * The robots-txt audit is skipped on purpose. Lighthouse fetches robots.txt
 * with fetch() from inside the page, and this site's CSP sets
 * connect-src 'none', so the request never leaves. A real crawler asks the
 * server directly and is unaffected; relaxing the policy to satisfy the audit
 * would trade real hardening for a number. The file's contents are checked in
 * test/browser/site.test.js instead.
 */
import process from 'node:process';
import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';

import { servirSite } from './servir.js';

const RAIZ = new URL('../_site/', import.meta.url).pathname;

/**
 * Nota mínima por categoria, de 0 a 100.
 *
 * Performance entra mais baixa de propósito. A nota composta depende da CPU
 * disponível no momento da medição, e o próprio relatório expõe isso no
 * benchmarkIndex, que nesta base variou de 840 a 1506 entre execuções da mesma
 * página sem uma linha de diferença. Um limite de 95 ali reprovaria por ruído,
 * e um limite que reprova sozinho ensina a ignorar a esteira. 80 continua
 * pegando o que importa: uma imagem gigante, um script novo que trava a
 * thread, uma fonte que passou a bloquear o render.
 *
 * As outras três não dependem de CPU e ficam onde o projeto se comprometeu.
 */
const MINIMOS = {
  performance: 80,
  accessibility: 95,
  'best-practices': 95,
  seo: 95,
};

const site = await servirSite(RAIZ);

const chrome = await launch({
  chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
  chromePath: process.env.CHROME_PATH || undefined,
});

let falhou = false;
try {
  const { lhr } = await lighthouse(
    site.url,
    { port: chrome.port, output: 'json', logLevel: 'error' },
    { extends: 'lighthouse:default', settings: { skipAudits: ['robots-txt'] } },
  );

  console.log(`\nMáquina: benchmarkIndex ${lhr.environment.benchmarkIndex}\n`);
  for (const [chave, minimo] of Object.entries(MINIMOS)) {
    const nota = Math.round(lhr.categories[chave].score * 100);
    const ok = nota >= minimo;
    if (!ok) falhou = true;
    console.log(`  ${ok ? 'ok  ' : 'FALHA'} ${lhr.categories[chave].title.padEnd(16)} ${String(nota).padStart(3)}  (mínimo ${minimo})`);
  }

  const erros = lhr.audits['errors-in-console'].details?.items ?? [];
  if (erros.length > 0) {
    falhou = true;
    console.log('\n  Erros no console do navegador:');
    for (const erro of erros) console.log(`    ${erro.description}`);
  }
} finally {
  await chrome.kill();
  site.fechar();
}

process.exit(falhou ? 1 : 0);

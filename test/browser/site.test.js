/**
 * Regressões de layout e acessibilidade, medidas num navegador de verdade.
 *
 * Deliberadamente não são comparações de pixel: a fonte renderiza diferente
 * entre a máquina de quem desenvolve e a esteira, e a linha de base viveria
 * quebrando por motivo nenhum. O que está aqui são as invariantes que de fato
 * quebraram enquanto esta página foi construída: botão montado na borda do
 * cartão, texto cortado, alvo de toque pequeno demais, contraste abaixo de AA.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { chromium } from 'playwright';

import { servirSite } from '../../scripts/servir.js';

const SITE = new URL('../../_site/', import.meta.url);

let navegador;
let site;

before(async () => {
  // Por HTTP, e não file://: a fonte é servida com CORS e por file:// o
  // navegador a recusa, medindo uma página que ninguém recebe.
  site = await servirSite(SITE.pathname);
  navegador = await chromium.launch({
    // Usa o Chrome da máquina quando existe, para a esteira não precisar
    // baixar um navegador inteiro só para isto.
    executablePath: process.env.CHROME_PATH || undefined,
    channel: process.env.CHROME_PATH ? undefined : 'chrome',
    args: ['--no-sandbox'],
  });
});

after(async () => {
  await navegador?.close();
  site?.fechar();
});

/** @param {{largura?: number, altura?: number, tema?: 'light'|'dark'}} opcoes */
async function abrir(opcoes = {}) {
  const contexto = await navegador.newContext({
    viewport: { width: opcoes.largura ?? 390, height: opcoes.altura ?? 844 },
    colorScheme: opcoes.tema ?? 'light',
  });
  const pagina = await contexto.newPage();
  const erros = [];
  pagina.on('console', (m) => m.type() === 'error' && erros.push(m.text()));
  pagina.on('pageerror', (e) => erros.push(String(e)));
  await pagina.goto(site.url, { waitUntil: 'load' });
  await pagina.evaluate(() =>
    document.querySelectorAll('img[loading="lazy"]').forEach((i) => i.setAttribute('loading', 'eager')),
  );
  return { contexto, pagina, erros };
}

const LARGURAS = [320, 360, 390, 768, 1280];

test('nenhuma largura provoca rolagem horizontal', async () => {
  for (const largura of LARGURAS) {
    const { contexto, pagina } = await abrir({ largura });
    const transbordo = await pagina.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    assert.equal(transbordo, 0, `${largura}px transborda ${transbordo}px na horizontal`);
    await contexto.close();
  }
});

test('nada escapa das bordas do cartão', async () => {
  for (const largura of LARGURAS) {
    const { contexto, pagina } = await abrir({ largura });
    const fugas = await pagina.evaluate(() => {
      const frame = document.querySelector('.frame').getBoundingClientRect();
      return [...document.querySelectorAll('.frame *')]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return false;
          return r.left < frame.left - 0.5 || r.right > frame.right + 0.5;
        })
        .map((el) => el.className || el.tagName)
        .slice(0, 5);
    });
    assert.deepEqual(fugas, [], `em ${largura}px, elementos saem do cartão`);
    await contexto.close();
  }
});

test('todo alvo de toque cabe num polegar', async () => {
  // Sem exceção: qualquer coisa clicável precisa dos 44px, inclusive o título
  // do evento, que é a ação principal do cartão.
  for (const largura of [320, 390]) {
    const { contexto, pagina } = await abrir({ largura });
    const pequenos = await pagina.evaluate(() =>
      [...document.querySelectorAll('a, button')]
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.width > 0 && r.height > 0 && Math.min(r.width, r.height) < 44)
        .map(({ el, r }) => `${el.className || el.tagName}: ${Math.round(r.width)}x${Math.round(r.height)}`),
    );
    assert.deepEqual(pequenos, [], `alvos abaixo de 44px em ${largura}px`);
    await contexto.close();
  }
});

test('o cartão inteiro do evento é clicável', async () => {
  // Varre o cartão numa grade em vez de conferir uns poucos pontos: o buraco
  // que existia ficava justamente sobre a foto, que uma amostra rala não pega.
  for (const largura of [320, 390, 1280]) {
    const { contexto, pagina } = await abrir({ largura, altura: 900 });
    const resultado = await pagina.evaluate(() => {
      const cartao = document.querySelector('.entry');
      const contagem = { evento: 0, calendario: 0, morto: 0 };
      const tela = window.innerHeight;

      // Em faixas, rolando entre uma e outra: elementFromPoint só responde por
      // coordenada que está na tela, e devolve null para o resto. Um cartão com
      // descrição longa passa da altura da janela em tela estreita, e varrer a
      // altura inteira de uma vez contava como ponto morto tudo o que estava
      // abaixo da dobra, sem que houvesse buraco nenhum ali.
      const inicio = cartao.getBoundingClientRect().top + window.scrollY;
      const altura = cartao.getBoundingClientRect().height;

      for (let faixa = 0; faixa < altura; faixa += tela) {
        window.scrollTo(0, inicio + faixa);
        const caixa = cartao.getBoundingClientRect();
        const topo = Math.max(caixa.top + 4, 0);
        const base = Math.min(caixa.bottom - 4, tela);

        for (let x = caixa.left + 4; x < caixa.right - 4; x += 12) {
          for (let y = topo; y < base; y += 10) {
            const alvo = document.elementFromPoint(x, y);
            const link = alvo && alvo.closest('a');
            if (!link) contagem.morto += 1;
            else if (link.classList.contains('entry__calendar')) contagem.calendario += 1;
            else contagem.evento += 1;
          }
        }
      }

      window.scrollTo(0, 0);
      return contagem;
    });

    assert.equal(resultado.morto, 0, `${largura}px tem ponto do cartão que não leva a lugar nenhum`);
    assert.ok(resultado.evento > 0, 'o cartão precisa abrir o evento');
    assert.ok(resultado.calendario > 0, 'o botão de calendário precisa continuar recebendo o próprio clique');
    await contexto.close();
  }
});

test('nenhuma área clicável fica por cima de outra', async () => {
  // Dois links empilhados são difíceis de acertar no toque e o leitor de tela
  // anuncia a região errada.
  const { contexto, pagina } = await abrir({ largura: 390 });
  const aninhados = await pagina.evaluate(() =>
    [...document.querySelectorAll('a, button')]
      .filter((el) => el.parentElement.closest('a, button'))
      .map((el) => el.className || el.tagName),
  );
  assert.deepEqual(aninhados, [], 'há elemento clicável dentro de outro');
  await contexto.close();
});

test('o axe não encontra violação de acessibilidade', async () => {
  for (const tema of ['light', 'dark']) {
    for (const largura of [320, 390, 1280]) {
      // bypassCSP só para conseguir injetar o axe: a política da página é
      // verificada pelo teste de CSP, e é ela que barra a injeção aqui.
      const contexto = await navegador.newContext({
        viewport: { width: largura, height: 900 },
        colorScheme: tema,
        bypassCSP: true,
      });
      const pagina = await contexto.newPage();
      await pagina.goto(site.url, { waitUntil: 'load' });
      await pagina.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
      const resultado = await pagina.evaluate(() =>
        window.axe.run(document, { resultTypes: ['violations'] }),
      );
      const violacoes = resultado.violations.map((v) => `[${v.impact}] ${v.id}: ${v.help}`);
      assert.deepEqual(violacoes, [], `axe em ${largura}px, tema ${tema}`);
      await contexto.close();
    }
  }
});

test('todo texto passa em AA nos dois temas', async () => {
  for (const tema of ['light', 'dark']) {
    const { contexto, pagina } = await abrir({ largura: 1280, altura: 900, tema });
    const reprovados = await pagina.evaluate(() => {
      const canal = (c) => {
        c /= 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      const lum = ([r, g, b]) => 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
      const nums = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
      const razao = (a, b) => {
        const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
        return (x + 0.05) / (y + 0.05);
      };
      const fundoDe = (el) => {
        for (let n = el; n; n = n.parentElement) {
          const c = getComputedStyle(n).backgroundColor;
          const p = nums(c);
          if (p.length === 3 && !/rgba\(.*,\s*0\)/.test(c)) return p;
        }
        return [255, 255, 255];
      };

      const fora = [];
      for (const el of document.querySelectorAll('body *')) {
        const texto = [...el.childNodes]
          .filter((n) => n.nodeType === 3)
          .map((n) => n.textContent.trim())
          .join('');
        if (!texto) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none' || el.closest('[hidden]')) continue;
        const tamanho = Number.parseFloat(cs.fontSize);
        const grande = tamanho >= 24 || (tamanho >= 18.66 && Number(cs.fontWeight) >= 700);
        const precisa = grande ? 3 : 4.5;
        const obtido = razao(nums(cs.color), fundoDe(el));
        if (obtido < precisa) fora.push(`${texto.slice(0, 24)}: ${obtido.toFixed(2)} < ${precisa}`);
      }
      return fora;
    });
    assert.deepEqual(reprovados, [], `contraste abaixo de AA no tema ${tema}`);
    await contexto.close();
  }
});

test('o botão de tema não monta na borda do cartão', async () => {
  for (const largura of [320, 390, 1280]) {
    const { contexto, pagina } = await abrir({ largura });
    const dentro = await pagina.evaluate(() => {
      const b = document.getElementById('theme-toggle').getBoundingClientRect();
      const f = document.querySelector('.frame').getBoundingClientRect();
      return b.left >= f.left && b.right <= f.right && b.top >= f.top;
    });
    assert.ok(dentro, `em ${largura}px o botão sai do cartão`);
    await contexto.close();
  }
});

test('a página não registra erro no console', async () => {
  const { contexto, pagina, erros } = await abrir({ largura: 1280 });
  await pagina.waitForTimeout(300);
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('compartilhar usa a folha do sistema quando ela existe', async () => {
  const contexto = await navegador.newContext({ viewport: { width: 390, height: 844 } });
  const pagina = await contexto.newPage();
  await pagina.addInitScript(() => {
    window.__compartilhado = null;
    navigator.share = (dados) => {
      window.__compartilhado = dados;
      return Promise.resolve();
    };
  });
  await pagina.goto(site.url, { waitUntil: 'load' });

  const botao = pagina.locator('#compartilhar');
  assert.equal(await botao.isVisible(), true, 'o botão precisa aparecer quando dá para compartilhar');
  await botao.click();

  const recebido = await pagina.evaluate(() => window.__compartilhado);
  assert.ok(recebido, 'nada chegou em navigator.share');
  assert.ok(recebido.title.length > 0);
  assert.match(recebido.url, /^https:\/\//, 'compartilha o endereço público, não o do servidor de teste');
  await contexto.close();
});

test('sem a folha do sistema, copia o endereço e avisa', async () => {
  const contexto = await navegador.newContext({
    viewport: { width: 1280, height: 800 },
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const pagina = await contexto.newPage();
  await pagina.goto(site.url, { waitUntil: 'load' });
  await pagina.locator('#compartilhar').click();
  await pagina.waitForTimeout(200);

  assert.match(await pagina.evaluate(() => navigator.clipboard.readText()), /^https:\/\//);
  // role=status com aria-live: quem usa leitor de tela precisa saber que copiou.
  assert.match(await pagina.locator('#compartilhar-aviso').textContent(), /copiado/i);
  await contexto.close();
});

test('sem suporte nenhum, o botão de compartilhar nem aparece', async () => {
  // Controle que não faz nada é pior que controle nenhum.
  const contexto = await navegador.newContext({ viewport: { width: 1280, height: 800 } });
  const pagina = await contexto.newPage();
  await pagina.addInitScript(() => {
    // Os dois, explicitamente: o Chrome expõe um ou outro conforme a versão e
    // o contexto, e o teste precisa valer para o caso em que falta tudo.
    Object.defineProperty(Navigator.prototype, 'clipboard', { get: () => undefined, configurable: true });
    Object.defineProperty(Navigator.prototype, 'share', { get: () => undefined, configurable: true });
  });
  await pagina.goto(site.url, { waitUntil: 'load' });
  await pagina.waitForTimeout(200);

  // isHidden, e não a propriedade hidden: o atributo só esconde de verdade se
  // nenhuma classe sobrepuser o display, que foi exatamente o que aconteceu.
  assert.equal(await pagina.locator('#compartilhar').isHidden(), true);
  await contexto.close();
});

test('sem JavaScript, nenhum botão morto aparece na tela', async () => {
  const contexto = await navegador.newContext({
    viewport: { width: 1280, height: 800 },
    javaScriptEnabled: false,
  });
  const pagina = await contexto.newPage();
  await pagina.goto(site.url, { waitUntil: 'load' });

  for (const id of ['theme-toggle', 'compartilhar']) {
    assert.equal(
      await pagina.locator(`#${id}`).isHidden(),
      true,
      `#${id} aparece sem JavaScript e não faz nada`,
    );
  }

  // E o conteúdo continua todo lá: a página não depende de script para servir.
  assert.ok((await pagina.locator('.entry').count()) > 0, 'a agenda precisa aparecer sem JavaScript');
  await contexto.close();
});

test('robots.txt e sitemap saem prontos para o crawler', async () => {
  const robots = await readFile(new URL('robots.txt', SITE), 'utf8');
  assert.match(robots, /^User-agent: \*$/m);
  assert.match(robots, /^Allow: \/$/m);
  assert.match(robots, /^Sitemap: https:\/\/\S+sitemap\.xml$/m);

  const sitemap = await readFile(new URL('sitemap.xml', SITE), 'utf8');
  assert.match(sitemap, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(sitemap, /<loc>https:\/\/\S+<\/loc>/);
});

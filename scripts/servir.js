/**
 * Um servidor estático mínimo para _site, usado pelo Lighthouse e pelos testes
 * de navegador.
 *
 * Existe porque abrir a página por file:// não reproduz a produção: fonte com
 * CORS não carrega, e um teste que roda assim mede uma página diferente da que
 * o visitante recebe.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ics': 'text/calendar; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
};

function servir(raiz) {
  const server = createServer(async (req, res) => {
    // normalize + o prefixo obrigatório impedem sair da pasta com ../
    const caminho = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
    const arquivo = join(raiz, caminho.endsWith('/') ? `${caminho}index.html` : caminho);
    if (!arquivo.startsWith(raiz)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const corpo = await readFile(arquivo);
      res.writeHead(200, { 'content-type': TIPOS[extname(arquivo)] ?? 'application/octet-stream' });
      res.end(corpo);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('404');
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

/**
 * @param {string} raiz caminho absoluto da pasta a servir
 * @returns {Promise<{url: string, fechar: () => void}>}
 */
export async function servirSite(raiz) {
  const server = await servir(raiz);
  const { port } = server.address();
  return { url: `http://127.0.0.1:${port}/`, fechar: () => server.close() };
}

/**
 * `npm audit`, menos os avisos listados abaixo.
 *
 * O npm não tem como ignorar um aviso específico: ou barra tudo, ou nada.
 * Quando sai um aviso sem versão corrigida numa dependência que só roda no
 * build, o CI ficaria vermelho até alguém publicar a correção, e um CI que
 * vive vermelho deixa de avisar o que importa. Então os avisos aceitos ficam
 * nomeados aqui, cada um com o motivo, e qualquer outro continua barrando.
 *
 * Revise a lista quando o Eleventy atualizar: se a dependência sair da árvore
 * ou ganhar correção, o aviso não aparece mais e o script diz para tirá-lo.
 */
import { execFileSync } from 'node:child_process';

const ACEITOS = {
  // braces <=3.0.3, sem versão corrigida. Vem do Eleventy via chokidar, que
  // só observa arquivos no `npm run dev`. Os padrões que ele lê são os do
  // próprio repositório, nunca algo vindo de fora.
  'GHSA-vfj7-8cjw-p6xm': 'braces, só no servidor local do Eleventy',
  // sprintf-js <=1.1.3, sem versão corrigida. Vem do Eleventy via gray-matter,
  // js-yaml 3 e argparse, no build. Não recebe entrada de fora.
  'GHSA-hp3w-g68c-fv3c': 'sprintf-js, só no build do Eleventy',
};

function auditoria() {
  try {
    return execFileSync('npm', ['audit', '--json'], { encoding: 'utf8' });
  } catch (erro) {
    // O npm sai com código 1 quando acha algo, com o JSON na saída normal.
    if (erro.stdout) return erro.stdout;
    throw erro;
  }
}

const relatorio = JSON.parse(auditoria());
const avisos = new Map();
for (const pacote of Object.values(relatorio.vulnerabilities ?? {})) {
  // `via` mistura avisos (objetos) com nomes de pacote que só repassam um
  // aviso de mais abaixo; os nomes já aparecem pelo próprio pacote.
  for (const via of pacote.via) {
    if (typeof via === 'string') continue;
    const id = via.url.split('/').pop();
    avisos.set(id, `${via.name} ${via.range} (${via.severity}): ${via.title}`);
  }
}

const novos = [...avisos].filter(([id]) => !(id in ACEITOS));
const sobrando = Object.keys(ACEITOS).filter((id) => !avisos.has(id));

for (const [id] of avisos) {
  if (id in ACEITOS) console.log(`aceito  ${id}  ${ACEITOS[id]}`);
}
for (const id of sobrando) {
  console.log(`não aparece mais: ${id}. Pode tirar de scripts/auditar.js.`);
}

if (novos.length > 0) {
  console.error('\nAvisos de segurança novos nas dependências:');
  for (const [id, texto] of novos) console.error(`  ${id}  ${texto}`);
  console.error('\nRode `npm audit` para os detalhes e `npm audit fix` para corrigir.');
  process.exit(1);
}
console.log('✓ nenhum aviso de segurança fora da lista de aceitos.');

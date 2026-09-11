import test from 'node:test';
import assert from 'node:assert/strict';
import { parse as parseYaml } from 'yaml';

import { explicarErroDeYaml } from '../lib/yaml-erro.js';

/** Quebra o YAML de propósito e devolve a explicação em português. */
function explicar(texto) {
  try {
    parseYaml(texto);
  } catch (erro) {
    return explicarErroDeYaml(erro, texto);
  }
  throw new Error('esse YAML não quebrou, e o teste depende disso');
}

test('texto depois da aspa que fecha, que foi o erro que derrubou a publicação', () => {
  const aviso = explicar(
    "events:\n  - title: '“BRISA: Saraus” - 6ª Temporada'- 20ª Primavera\n    start: 2026-09-24\n",
  );

  assert.match(aviso, /Linha 2/);
  assert.match(aviso, /sobrou texto solto depois do valor/);
  // A linha citada aparece inteira, para a pessoa reconhecer o lugar.
  assert.match(aviso, /- title: '“BRISA: Saraus” - 6ª Temporada'- 20ª Primavera/);
  // E o conserto vem escrito, não só o diagnóstico.
  assert.match(aviso, /Certo: {3}- title: 'Sarau de outono - 20ª Primavera'/);
  assert.match(aviso, /a página no ar continua a de antes/);
});

test('dois-pontos dentro do título sem aspas em volta', () => {
  const aviso = explicar('events:\n  - title: BRISA: Saraus Artísticos\n    start: 2026-09-24\n');

  assert.match(aviso, /Linha 2/);
  assert.match(aviso, /precisa de aspas em volta/);
});

test('aspa aberta e não fechada', () => {
  const aviso = explicar("events:\n  - title: 'Sarau de outono\n    start: 2026-09-24\n");

  assert.match(aviso, /aspa foi aberta e não foi fechada/);
});

test('tabulação no lugar de espaços', () => {
  const aviso = explicar('events:\n\t- title: Sarau\n');

  assert.match(aviso, /tabulação/);
  assert.match(aviso, /dois por nível/);
});

test('o mesmo campo duas vezes no mesmo evento', () => {
  const aviso = explicar('events:\n  - title: A\n    title: B\n    start: 2026-09-24\n');

  assert.match(aviso, /aparece duas vezes/);
});

test('erro sem tradução mostra o que o verificador disse, em vez de esconder', () => {
  const erro = Object.assign(new Error('Something odd at line 1'), {
    code: 'CODIGO_QUE_NAO_EXISTE',
    linePos: [{ line: 1, col: 1 }],
  });

  const aviso = explicarErroDeYaml(erro, 'events:\n');
  assert.match(aviso, /O verificador disse: Something odd at line 1/);
  assert.match(aviso, /a página no ar continua a de antes/);
});

test('sem posição no erro, ainda explica sem inventar uma linha', () => {
  const erro = Object.assign(new Error('sem posição'), { code: 'TAB_AS_INDENT' });

  const aviso = explicarErroDeYaml(erro, 'events:\n');
  assert.match(aviso, /^O arquivo: a linha começa com tabulação/);
  assert.ok(!aviso.includes('Linha'), 'não deveria citar linha nenhuma');
});

test('a seta cai embaixo da coluna que o parser apontou', () => {
  const aviso = explicar("events:\n  - title: 'Sarau'- extra\n    start: 2026-09-24\n");

  const linhas = aviso.split('\n');
  const iLinha = linhas.findIndex((l) => l.includes("- title: 'Sarau'- extra"));
  const seta = linhas[iLinha + 1];

  assert.equal(seta.indexOf('^'), linhas[iLinha].indexOf("'- extra") + 1);
});

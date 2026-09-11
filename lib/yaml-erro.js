/**
 * Traduz o erro do parser de YAML para uma frase que quem cuida da
 * programação consiga agir em cima.
 *
 * Quem edita o config.yaml não programa. "Unexpected seq-item-ind at node end"
 * é verdade e é inútil: não diz o que fazer. Cada caso aqui vira uma frase que
 * nomeia o engano e mostra o conserto, com a linha em volta para a pessoa
 * achar o lugar sem contar linhas na mão.
 *
 * Os códigos vêm do pacote `yaml`. Um código que não estiver mapeado cai no
 * texto original do parser, que é pior mas nunca é mentira.
 */

/**
 * Cada entrada devolve o que aconteceu e como arrumar. A separação existe para
 * a mensagem final poder ser montada de jeitos diferentes, no terminal e no
 * comentário de uma issue.
 */
const CASOS = {
  UNEXPECTED_TOKEN: {
    o_que: 'sobrou texto solto depois do valor.',
    como: [
      'Isso quase sempre é texto acrescentado depois da aspa que fecha, em vez de dentro dela.',
      'Errado:  - title: \'Sarau de outono\'- 20ª Primavera',
      'Certo:   - title: \'Sarau de outono - 20ª Primavera\'',
    ],
  },
  MISSING_CHAR: {
    o_que: 'uma aspa foi aberta e não foi fechada.',
    como: [
      'Todo texto que começa com aspa precisa terminar com a mesma aspa, na mesma linha.',
    ],
  },
  TAB_AS_INDENT: {
    o_que: 'a linha começa com tabulação.',
    como: [
      'YAML só aceita espaços para alinhar. Apague a tabulação e use espaços,',
      'dois por nível, como nas linhas vizinhas.',
    ],
  },
  BLOCK_AS_IMPLICIT_KEY: {
    o_que: 'o alinhamento da linha não bate com o do bloco.',
    como: [
      'Duas causas explicam quase todos os casos.',
      '1. O texto tem dois-pontos e precisa de aspas em volta:',
      "   Errado:  - title: BRISA: Saraus Artísticos",
      "   Certo:   - title: 'BRISA: Saraus Artísticos'",
      '2. A linha está com mais ou menos espaços à esquerda que as linhas vizinhas.',
    ],
  },
  DUPLICATE_KEY: {
    o_que: 'o mesmo campo aparece duas vezes no mesmo evento.',
    como: ['Apague a linha repetida. Cada campo entra uma vez só por evento.'],
  },
  BAD_INDENT: {
    o_que: 'o alinhamento da linha não bate com o do bloco.',
    como: ['Confira os espaços à esquerda: eles precisam bater com os das linhas vizinhas.'],
  },
};

/**
 * A linha do erro com uma seta embaixo, na coluna certa.
 * @param {string} texto o arquivo inteiro
 * @param {{line: number, col: number}} posicao
 */
function trecho(texto, posicao) {
  const linha = texto.split('\n')[posicao.line - 1];
  if (linha === undefined) return null;

  const numero = String(posicao.line);
  const recuo = ' '.repeat(numero.length);
  // col é 1-based, e a seta fica sob o caractere que o parser apontou.
  const seta = ' '.repeat(Math.max(0, posicao.col - 1)) + '^';
  return [`  ${numero} | ${linha}`, `  ${recuo} | ${seta}`].join('\n');
}

/**
 * @param {Error & {code?: string, linePos?: Array<{line: number, col: number}>}} erro
 * @param {string} texto conteúdo do arquivo, para recortar a linha citada
 * @returns {string}
 */
export function explicarErroDeYaml(erro, texto) {
  const posicao = erro.linePos?.[0] ?? null;
  const caso = erro.code ? CASOS[erro.code] : undefined;

  const partes = [];
  const onde = posicao ? `Linha ${posicao.line}` : 'O arquivo';

  if (caso) {
    partes.push(`${onde}: ${caso.o_que}`);
  } else {
    // Sem tradução, o texto do parser é o que há. Fica em inglês, mas dizer
    // "erro desconhecido" seria menos útil do que mostrar o que ele achou.
    partes.push(`${onde}: o arquivo não é YAML válido.`);
    partes.push(`  O verificador disse: ${erro.message.split('\n')[0]}`);
  }

  if (posicao) {
    const recorte = trecho(texto, posicao);
    if (recorte) partes.push('', recorte);
  }

  if (caso) partes.push('', ...caso.como);

  partes.push(
    '',
    'Nada foi publicado: a página no ar continua a de antes, e volta ao normal',
    'assim que o arquivo for corrigido.',
  );

  return partes.join('\n');
}

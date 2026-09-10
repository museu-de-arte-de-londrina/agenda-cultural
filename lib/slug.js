/**
 * Identificador estável de um evento, usado no endereço da âncora, no nome do
 * arquivo de calendário e no nome da foto baixada do formulário.
 *
 * Leva data e hora, e não só o título: a mesma atividade se repete ao longo da
 * semana, e sem o horário duas sessões do mesmo programa disputariam o mesmo
 * nome de arquivo.
 *
 * @param {string} title
 * @param {string} start data ou data e hora, como está escrita no config.yaml
 */
export function slugify(title, start) {
  const base = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
    .replace(/-$/, '');
  return `${base}-${start.replace(/[-:T ]/g, '')}`;
}

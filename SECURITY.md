# Política de segurança

## Como reportar

Encontrou uma vulnerabilidade? **Não abra uma issue pública.**

Use o **GitHub Security Advisories**: aba *Security* > *Report a
vulnerability*, neste repositório. O relato fica privado entre você e os
mantenedores até existir correção, e não expõe endereço de e-mail de ninguém.

Ajuda muito incluir: o que acontece, como reproduzir, versão/commit afetado e
o impacto que você enxerga.

### O que esperar

| Etapa | Prazo alvo |
| --- | --- |
| Confirmação de recebimento | 5 dias corridos |
| Avaliação inicial e severidade | 10 dias corridos |
| Correção ou plano público | 30 dias corridos |

São prazos de um projeto mantido por voluntários, não um SLA contratual. Se o
prazo estourar, cobre. Não é falta de interesse.

Divulgação coordenada: peço que o relato só vire público depois da correção,
ou após 90 dias, o que vier primeiro. Crédito no changelog se você quiser.

## Escopo

Está no escopo tudo que este repositório gera ou executa:

- geração de HTML a partir do `config.yaml` (escape, injeção, sanitização de URL);
- a política CSP e os demais cabeçalhos do `<head>`;
- os workflows do GitHub Actions e suas permissões;
- as dependências de build declaradas no `package.json`.

Está **fora** do escopo:

- os sites de terceiros para onde os links apontam;
- a infraestrutura do GitHub Pages em si (reporte ao GitHub);
- conteúdo que o próprio dono do site escreveu no `config.yaml`, já que quem
  edita o config controla a página.

## Modelo de ameaça

O site é estático, sem backend, sem banco e sem sessão de usuário. Não há dado
de visitante para vazar: nenhum cookie é gravado, e por padrão nenhuma
requisição sai para terceiros.

Os scripts próprios são três, todos servidos pelo próprio site. O `theme.js` lê
e grava a preferência de tema em `localStorage`. O `compartilhar.js` chama a
folha de compartilhamento do sistema, ou copia o endereço. O `calendario.js`
fecha o menu de calendário ao clicar fora. Nenhum deles faz requisição, lê
conteúdo da página ou recebe entrada de fora.

### Medição de acesso

A chave `analytics.goatcounter` no `config.yaml` é a única coisa que faz o
navegador de quem visita falar com um terceiro. Ela vem vazia, e enquanto
estiver vazia a política continua em `script-src 'self'` e `connect-src 'none'`:
nada de fora carrega e nada sai da página.

Preenchida, ela abre exatamente duas origens, e a CSP é montada para não abrir
mais que isso:

- `script-src` passa a aceitar `https://gc.zgo.at`, de onde vem o `count.js`;
- `connect-src` passa a aceitar `https://<código>.goatcounter.com`, para onde a
  contagem é enviada.

O código do site é validado como slug (`^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$`)
justamente porque entra dentro da própria política: um ponto ou uma barra ali
deixariam de nomear uma origem só.

O que o GoatCounter recebe: caminho da página, referência, título, largura da
tela, string de consulta e um sinal de robô. Ele não grava cookie, e o
`localStorage` que usa serve só para a opção de não contar a própria visita,
acessando a página com `#toggle-goatcounter` no fim do endereço. O IP chega ao
servidor dele, como em qualquer requisição, e é descartado depois de virar hash
para separar visitas do mesmo dia.

Ligar isso é uma decisão de quem cuida do site, e muda o que este documento
promete. Desligar é apagar a chave.

A superfície real é o `config.yaml` virando HTML. As defesas são:

| Risco | Defesa | Onde |
| --- | --- | --- |
| XSS via campo do YAML | autoescape do Nunjucks em todo valor | `src/index.njk` |
| Fuga do bloco JSON-LD | `<`, `>` e `&` viram escapes unicode antes de entrar no `<script>`, então nenhum título consegue fechar o elemento | `src/_data/site.js` |
| XSS via `javascript:` / `data:` | allowlist de esquemas (`https:`, `mailto:`, `tel:`); build falha | `schema/config.schema.js` |
| Esquema disfarçado (`java\nscript:`) | rejeição de caracteres de controle antes do parse | `schema/config.schema.js` |
| URL protocol-relative (`//host`) em imagem | rejeitada; imagem remota só via `https://` | `schema/config.schema.js` |
| Ícone como vetor de markup | ícones são dados de path validados, nunca HTML vindo do config | `lib/icons.js` |
| `window.opener` em link externo | `rel="noopener noreferrer"` em todos os links | `src/index.njk` |
| Script injetado na página | CSP com `script-src 'self'`, sem `unsafe-inline` nem `unsafe-eval` | `<meta>` em `src/index.njk` |
| Script de terceiro | Só existe um arquivo JS, próprio e versionado (`src/theme.js`) | `src/theme.js` |
| Data forjada no YAML | Parse estrito de `AAAA-MM-DD[THH:MM]`, com rejeição de data de calendário impossível | `lib/datetime.js` |
| Vazamento de IP do visitante para CDN | zero recursos externos; fonte hospedada no repositório, ícones embutidos | `src/styles.css.njk` |
| Referrer vazando para o destino | `<meta name="referrer" content="no-referrer">` | `src/index.njk` |
| Action comprometida por tag movida | actions pinadas por SHA completo | `.github/workflows/` |
| Token com poder demais no CI | `permissions` mínimas por job; só o job de deploy tem `pages: write` | `.github/workflows/` |
| Dependência vulnerável | Dependabot semanal + `npm audit --audit-level=high` no CI | `.github/` |

### Limitação conhecida: CSP por `<meta>`

O GitHub Pages não permite cabeçalhos HTTP customizados, então a CSP vai numa
tag `<meta http-equiv>`. Duas consequências, ambas aceitas conscientemente:

- as diretivas `frame-ancestors`, `report-uri` e `sandbox` **são ignoradas**
  quando entregues por `<meta>`. Contra clickjacking não há defesa possível
  aqui sem um proxy na frente. `frame-ancestors` foi retirada da política:
  além de não valer, ela registrava um erro no console de cada visitante;
- a política só passa a valer quando o parser chega na tag. Como não existe
  script algum na página e a CSP é o primeiro `<meta>` depois de `charset` e
  `viewport`, a janela é irrelevante na prática.

Quem quiser cabeçalhos de verdade precisa servir o site atrás de um CDN que
permita configurá-los (Cloudflare, Netlify, etc.).

## Segredos

O repositório não contém segredo nenhum e não precisa de nenhum. O deploy usa
apenas o `GITHUB_TOKEN` efêmero do próprio workflow. Se você forkou e adicionou
um secret, ele não é usado por nada aqui.

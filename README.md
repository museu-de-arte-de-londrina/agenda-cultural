# Agenda Cultural

Uma página só, estática, com a **agenda de eventos** em primeiro plano e os
canais de contato logo abaixo do título. O conteúdo é seu: mora no seu
repositório, publica no GitHub Pages e **tudo que aparece na tela vem de um
único arquivo, o `config.yaml`**.

Você nunca precisa abrir HTML, CSS ou JavaScript para usar.

```yaml
profile:
  name: Museu de Arte de Londrina
  handle: "@museudeartedelondrina"

events:
  - title: Apresentação de Taiko
    start: 2026-09-21T19:00
    end: 2026-09-21T20:00
    kind: Show Musical
    image: assets/taiko.png
```

Cada evento vira um cartão com miniatura, data, hora e título. Quem já passou
some sozinho no build seguinte.

## Preview

No ar: <https://museu-de-arte-de-londrina.github.io/agenda-cultural/>

Rodando local: `npm ci && npm run dev`, depois abra <http://localhost:8080>.

## Começando em 3 passos

### 1. Faça um fork

Botão **Fork** no topo desta página. O repositório vai para a sua conta.

### 2. Edite o `config.yaml`

Direto pelo GitHub: abra o arquivo, clique no lápis, edite, **Commit changes**.

Comece copiando o [`config.example.yaml`](config.example.yaml), que está
comentado campo a campo. O mínimo que funciona é isto:

```yaml
profile:
  name: Seu Nome

links:
  - label: Meu site
    url: https://example.com
```

### 3. Ligue o GitHub Pages

**Settings → Pages → Build and deployment → Source: `GitHub Actions`**.

Pronto. A cada push na `main` o site é reconstruído e publicado em
`https://SEU-USUARIO.github.io/NOME-DO-REPO/`.

> Se o build falhar, a aba **Actions** mostra exatamente qual campo do
> `config.yaml` está errado. A página no ar não é substituída por uma quebrada.

## Publicando um evento sem mexer em código

Abra uma issue pelo modelo **Publicar evento na agenda**, preencha os campos e
envie. Enviar deixa o evento em rascunho; quem preencheu revisa e, quando está
certo, fecha a issue. O fechamento é o gesto que manda publicar. Aí uma
automação confere os dados, reconstrói o site para garantir que o evento não
quebra a página, escreve no `config.yaml` e publica, cerca de um minuto do
fechamento até o ar. A foto do evento pode ser arrastada para dentro do
formulário: a automação baixa a imagem e guarda no repositório, em vez de deixar
a página do museu dependendo de um servidor de terceiro. Se algum campo estiver
errado, nada é publicado e ela comenta na própria issue dizendo o quê.

Fechar por **Close as not planned** recusa o pedido sem publicar nada.

A automação só roda para quem tem acesso de escrita no repositório. O
repositório é público e qualquer pessoa pode abrir issue; vindo de fora, ela
vira um pedido para alguém ler, nunca uma alteração automática.

Editar o `config.yaml` na mão continua funcionando, e é o caminho para mexer em
qualquer coisa que não seja evento.

O [`MANUTENCAO.md`](MANUTENCAO.md) descreve esse ciclo inteiro passo a passo,
para quem cuida da programação e não mexe em código: o que acontece depois que a
issue é fechada, como acrescentar a foto, como cancelar um evento e por que os
que já passaram somem sozinhos.

## Referência do `config.yaml`

Campos sem "obrigatório" podem ser omitidos: o default entra no lugar.

### `lang`

| Campo | Tipo | Obrigatório | Default | Descrição |
| --- | --- | --- | --- | --- |
| `lang` | tag BCP 47 | não | `pt-BR` | Vira o `<html lang>`. Importante para leitor de tela. |

### `profile`

| Campo | Tipo | Obrigatório | Default | Descrição |
| --- | --- | --- | --- | --- |
| `profile.name` | texto, até 80 | **sim** | (sem default) | Título da página e `<h1>`. |
| `profile.tagline` | texto, até 160 | não | vazio | Linha sob o nome. Omitida, o parágrafo some. |
| `profile.handle` | texto começando com `@` | não | nenhum | Arroba mostrada abaixo do nome. Precisa de aspas no YAML. |
| `profile.handle_url` | URL `https:`, `mailto:` ou `tel:` | não | nenhum | Destino da arroba. Sem isso, ela é só texto. |
| `profile.avatar` | caminho ou URL `https://` | não | nenhum | Sem avatar, aparece um círculo com as iniciais do nome. |
| `profile.hero` | caminho ou URL `https://` | não | nenhum | Faixa larga no topo do cartão, no lugar do avatar. Veja [A faixa do topo](#a-faixa-do-topo). |
| `profile.location` | texto, até 160 | não | nenhum | Endereço do local. Só aparece nos arquivos de calendário, junto do evento salvo. |
| `profile.avatar_shape` | `circle` \| `square` | não | `circle` | `square` para logotipos: o círculo corta os cantos e come o nome da marca. |

Imagens locais vão em `src/assets/` e são referenciadas como
`assets/nome-do-arquivo.png`.

### `hours`

Lista do horário de funcionamento, mostrada logo abaixo dos ícones de contato.
No máximo 4 faixas. Sem a chave, a seção inteira não aparece.

| Campo | Tipo | Obrigatório | Default | O que faz |
| --- | --- | --- | --- | --- |
| `days` | texto, até 60 | **sim** | (sem default) | Os dias, como se fala. Fica na coluna da esquerda. |
| `time` | texto, até 40 | **sim** | (sem default) | O horário. Fica alinhado na coluna da direita. |
| `note` | texto, até 80 | não | nenhum | A condição que não cabe no nome dos dias, em letra menor embaixo. |

```yaml
hours:
  - days: Terça a sexta
    time: 11h às 17h
  - days: 2 primeiros sábados do mês
    time: 9h às 13h
    note: a partir do 5º dia útil
```

#### A faixa do topo

`profile.hero` troca o avatar redondo por uma faixa que sangra até a borda do
cartão. Serve para a arte que o museu já tem pronta, com o nome desenhado nela.

A imagem entra inteira, na proporção do arquivo, sem recorte. É de propósito:
a arte institucional costuma ter o letreiro embaixo e a marca da Prefeitura em
cima, e recortar por cima ou por baixo tira uma das duas. Uma faixa 16:9 ou 2:1
fecha bem, e 1600 pixels de largura bastam.

Com a faixa no lugar, o `<h1>` continua na página com o nome do museu, mas sai
da tela: a arte já desenha o nome, e repetir em texto logo abaixo seria dizer
duas vezes a mesma coisa. Quem usa leitor de tela e os buscadores continuam
recebendo o nome normalmente.

Uma marca sobre fundo branco no alto da arte aparece como um bloco claro no
tema escuro. É assim que a arte foi feita, e ela vai para a página como está;
quem for trocar o arquivo pode contar com isso em vez de se assustar.

`profile.avatar` continua valendo mesmo com a faixa: é ele que vira favicon e
imagem de compartilhamento, para os quais uma faixa deitada não serve.

### `theme`

| Campo | Tipo | Obrigatório | Default | Descrição |
| --- | --- | --- | --- | --- |
| `theme.mode` | `light` \| `dark` \| `auto` | não | `auto` | `auto` segue o `prefers-color-scheme` do visitante. |
| `theme.accent` | cor hex (`#rgb` ou `#rrggbb`) | não | `#3b82f6` | Cor dos botões em destaque e do anel de foco. |

A cor do texto sobre o `accent` é calculada no build (preto ou branco, o que
tiver mais contraste), então o contraste AA vale para qualquer accent
escolhido. Aspas no YAML são necessárias: `accent: "#a4343a"`.

### `events[]`

A agenda, o miolo da página. Cada evento vira um cartão com miniatura, data,
hora e título.

| Campo | Tipo | Obrigatório | Default | Descrição |
| --- | --- | --- | --- | --- |
| `title` | texto, até 140 | **sim** | (sem default) | Título do evento. |
| `start` | `AAAA-MM-DD` ou `AAAA-MM-DDTHH:MM` | **sim** | (sem default) | Início. Data impossível (`2026-02-31`) quebra o build. |
| `end` | mesmo formato | não | nenhum | Fim. Precisa ser depois do `start`. |
| `kind` | texto, até 40 | não | nenhum | Etiqueta do tipo (Oficina, Exposição...). |
| `image` | caminho ou URL `https://` | não | ladrilho com a data | Miniatura quadrada; 320×320 basta. |
| `url` | URL `https:`, `mailto:` ou `tel:` | não | nenhum | Página do evento. Com ela, o cartão inteiro vira clicável. |
| `description` | texto, até 300 | não | nenhum | Uma ou duas frases sobre o que acontece. Aparece em todos os eventos, então não repita o título. |

Três comportamentos que valem saber:

- **A ordem no arquivo não importa.** A lista é ordenada por data.
- **Eventos que já terminaram não aparecem.** O corte usa o horário do build,
  e o workflow de deploy roda diariamente para isso não envelhecer. O GitHub
  desativa workflows agendados após 60 dias sem atividade no repositório.
- **Horário é horário de parede do local.** `19:00` é 19:00 no museu; nada é
  convertido de fuso, então a máquina que builda não muda o que está escrito.

### `links[]`

Links secundários, abaixo da agenda, na ordem em que aparecem.

Um link que aponta para o mesmo endereço de um ícone de `social` mostra o
mesmo destino duas vezes na página. `npm run validate` avisa quando isso
acontece. Avisa, não quebra: um ícone mais um botão em destaque é uma
escolha legítima.

| Campo | Tipo | Obrigatório | Default | Descrição |
| --- | --- | --- | --- | --- |
| `label` | texto, até 80 | **sim** | (sem default) | Texto do botão. |
| `url` | URL `https:`, `mailto:` ou `tel:` | **sim** | (sem default) | Qualquer outro esquema **quebra o build**. |
| `icon` | nome de ícone | não | sem ícone | Veja [Ícones](#ícones). |
| `highlight` | `true` \| `false` | não | `false` | Pinta o botão com a cor de destaque. |

### `social[]`

Os ícones redondos no rodapé do cartão.

| Campo | Tipo | Obrigatório | Default | Descrição |
| --- | --- | --- | --- | --- |
| `platform` | nome de ícone | **sim** | (sem default) | Vira também o rótulo acessível do link. |
| `url` | URL `https:`, `mailto:` ou `tel:` | **sim** | (sem default) | Mesma allowlist dos links. |

### `seo`

| Campo | Tipo | Obrigatório | Default | Descrição |
| --- | --- | --- | --- | --- |
| `seo.title` | texto, até 70 | não | `profile.name` | `<title>` e `og:title`. |
| `seo.description` | texto, até 200 | não | `profile.tagline`, ou `profile.name` | `<meta description>` e `og:description`. |
| `seo.og_image` | caminho ou URL `https://` | não | `profile.avatar` | Imagem do card ao compartilhar. |
| `seo.base_url` | URL `https://` | não | nenhum | Endereço final do site. |

Sobre `og_image`: WhatsApp, Facebook e X **não renderizam SVG** em card de
compartilhamento. Use PNG ou JPG, idealmente 1200×630.

Sobre `base_url`: Open Graph exige URL absoluta, e um site estático não tem
como descobrir o próprio endereço. Sem esse campo, `og:image` e
`<link rel="canonical">` são omitidos quando as imagens são caminhos
relativos. Com ele, tudo é resolvido corretamente:

```yaml
seo:
  base_url: https://seu-usuario.github.io/nome-do-repo
```

### `footer`

Selo institucional abaixo do cartão, útil quando a página pertence a um órgão
ou a uma organização maior. O bloco inteiro é opcional.

| Campo | Tipo | Obrigatório | Default | Descrição |
| --- | --- | --- | --- | --- |
| `footer.logos` | lista, até 4 | não | vazio | Logotipos lado a lado. Cada item tem `image` (obrigatório) e `alt` (opcional). Box de tamanho fixo, então não causa layout shift. |
| `footer.text` | texto, até 120 | não | nenhum | Legenda abaixo dos logotipos. Um logotipo sem `alt` é tratado como decorativo, então a legenda não é lida duas vezes. |
| `footer.url` | URL `https:`, `mailto:` ou `tel:` | não | nenhum | Havendo URL, o selo inteiro vira link. Mesma allowlist dos demais campos. |

### Ícones

O campo `icon` (em `links`) e `platform` (em `social`) aceitam:

- **qualquer slug do [Simple Icons](https://simpleicons.org)**: `github`,
  `instagram`, `whatsapp`, `youtube`, `mastodon`, `spotify`, `bluesky`,
  `tiktok`, `telegram`, e mais de 3 mil outros;
- **três genéricos**, para o que não é marca: `email`, `website`, `link`.

Os ícones são embutidos no HTML durante o build. Nada é baixado de CDN, então
o IP do visitante nunca chega a um terceiro.

Nome errado quebra o build com a lista de alternativas, sem ícone fantasma.

> Marcas entram e saem do Simple Icons: a LinkedIn, por exemplo, pediu a
> remoção do próprio logo e ele não existe mais a partir da versão 14. Quando
> uma atualização remove um ícone que você usa, o build falha apontando o
> campo. Troque por outro slug ou por um genérico.

## Desenvolvimento local

Requer Node 20 ou superior.

```bash
git clone https://github.com/SEU-USUARIO/NOME-DO-REPO.git
cd NOME-DO-REPO
npm ci

npm run dev        # servidor com hot reload em http://localhost:8080
npm run validate   # só confere o config.yaml, sem gerar nada
npm test           # testes do validador, do sanitizador e do escape do HTML
npm run lint
npm run build        # valida e gera o site em _site/
npm run test:browser # layout, alvos de toque, contraste e axe-core num Chrome
npm run lighthouse   # performance, acessibilidade, boas práticas e SEO
```

`npm run build` roda o `validate` antes: config inválido nunca vira página.

| Caminho | O que é |
| --- | --- |
| `config.yaml` | O único arquivo que você edita no uso normal. |
| `config.example.yaml` | Modelo comentado campo a campo. |
| `src/index.njk` | Template da página. |
| `src/theme.js` | Botão de tema claro/escuro. Carrega sem defer, para o tema não piscar. |
| `src/compartilhar.js` | Botão de compartilhar. Com defer, porque nada aqui precede a pintura. |
| `src/styles.css.njk` | CSS, gerado no build para embutir o `accent`. |
| `src/_data/site.js` | Carrega o YAML, valida e monta os dados do template. |
| `src/assets/` | Imagens suas. Copiadas para `/assets/` no site. |
| `schema/config.schema.js` | O schema (Zod) e a allowlist de esquemas de URL. |
| `lib/icons.js` | Resolução de ícones para dados de path SVG. |
| `lib/color.js` | Contraste WCAG, para garantir AA sobre qualquer accent. |
| `lib/datetime.js` | Datas dos eventos: parse, ordenação e formatação. |
| `src/assets/fonts/` | Archivo (OFL), hospedada aqui. Nenhuma requisição sai para CDN de fonte. |
| `src/assets/fundo-museu.webp` | Fachada do museu, desfocada, atrás da página. Foto de Emerson Dias, do portal da Prefeitura. |
| `scripts/validate-config.js` | O `npm run validate`. |
| `scripts/evento-da-issue.js` | Transforma a issue do formulário em evento. |
| `scripts/lighthouse.js` | O `npm run lighthouse`, com os mínimos por categoria. |
| `scripts/servir.js` | Servidor estático usado pelo Lighthouse e pelos testes. |
| `lib/calendar.js` | Geração dos arquivos `.ics`. |
| `test/browser/` | Regressões de layout e acessibilidade, num navegador. |
| `eleventy.config.js` | Configuração do build; gera também os QR codes. |
| `test/` | Testes com `node:test`, sem framework. |

`_site/` é gerado e não vai para o repositório. O deploy publica o artefato
direto pelo `actions/deploy-pages`, sem branch `gh-pages`.

## Calendário

O botão de cada evento abre um menu com três caminhos: Google Agenda, Outlook e
baixar o arquivo. Os dois primeiros levam direto para a tela de novo evento já
preenchida, que é o que resolve para quem usa calendário no navegador; o
arquivo continua ali para Apple Calendar e para qualquer outro aplicativo.

O menu é um `<details>`, então abre, fecha e anda pelo teclado sem script. O
`calendario.js` só acrescenta fechar ao clicar fora, fechar no Esc e fechar o
anterior quando outro abre.

Os endereços do Google e do Outlook ficam em atributo `href` e só saem do
navegador quando alguém clica. Nada é carregado desses domínios ao abrir a
página, e a CSP continua em `default-src 'self'`.

Fora do menu, cada evento publica um arquivo `.ics` próprio, e a agenda inteira
publica um feed em `agenda.ics` que pode ser assinado num aplicativo de
calendário.

Os horários levam o fuso do local em vez de serem convertidos para UTC: 19:00
continua 19:00 para quem está na porta do museu, não importa o que o celular
da pessoa ache do assunto. As mesmas regras de data valem para os três
caminhos, escritas uma vez em `lib/calendar.js` e espelhadas em
`lib/calendar-links.js`: se o arquivo e o link discordassem sobre quando o
evento começa, o visitante teria duas respostas para a mesma pergunta.

Evento com hora de início e sem hora de término é o único ponto em que eles
divergem, por imposição de fora: o `.ics` omite o fim e deixa cada aplicativo
decidir, enquanto o Google e o Outlook exigem os dois lados, e ali ele recebe
uma hora de duração.

## Dados estruturados

A página declara duas coisas em schema.org: cada atividade como `Event`, para
o buscador mostrar a agenda como eventos e não como um bloco de texto, e o
museu como `Museum`, com endereço, logotipo, contato e os perfis oficiais em
`sameAs`. É essa segunda entidade que alimenta o painel do lugar na busca e no
mapa.

Esse é o único valor da página marcado como `safe` no template, e precisa ser:
um `<script>` guarda texto cru, então escapar o conteúdo corromperia o JSON em
vez de proteger alguma coisa. Os caracteres que poderiam fechar o elemento
antes da hora viram escapes unicode em `src/_data/site.js`, e há teste
alimentando um título com `</script>` dentro para provar que não dá para sair.

## QR code

O build gera um QR code apontando para o endereço em `seo.base_url`, publicado
em dois formatos:

- `qrcode.svg`: vetorial, para impressão em qualquer tamanho (cartaz, etiqueta
  de parede, folder);
- `qrcode.png`: 1024×1024, para slide, story ou apresentação.

No site publicado eles ficam em `SEU-ENDERECO/qrcode.svg` e `.../qrcode.png`.
São regerados a cada build, então mudar `seo.base_url` já corrige o código, e
não existe cópia antiga para esquecer de atualizar. Sem `seo.base_url`, nada é
gerado: um QR para um endereço desconhecido é pior que nenhum.

## Domínio próprio

1. No seu provedor de DNS, aponte o domínio para o GitHub Pages:
   - **subdomínio** (`links.seudominio.com`): um registro `CNAME` para
     `SEU-USUARIO.github.io`;
   - **domínio raiz** (`seudominio.com`): registros `A` para `185.199.108.153`,
     `185.199.109.153`, `185.199.110.153` e `185.199.111.153`.
2. **Settings → Pages → Custom domain**: escreva o domínio e salve. Espere o
   certificado sair e marque **Enforce HTTPS**.
3. Atualize o `seo.base_url` no `config.yaml` para o novo endereço, senão o
   `og:image` e o canonical continuam apontando para o `github.io`.

Se preferir versionar o domínio junto com o código, crie um arquivo
`src/CNAME` com o domínio em uma linha, que é copiado para a raiz do site.

## Limitações conhecidas

- **Os textos da interface são fixos em português.** `lang` muda o atributo do
  `<html>`, mas o skip link e os rótulos de navegação continuam em pt-BR.
  Traduzi-los exige editar `src/index.njk`. i18n de verdade está fora do escopo.
- **A auditoria do axe roda com a CSP desligada.** É a única forma de injetar o
  axe na página, e é a própria CSP que impede a injeção. A política em si é
  verificada por outro teste, que confere que nada inline passa.
- **O mínimo de Performance no CI é 80, não 95.** A nota composta depende da
  CPU disponível na hora da medição: nesta base o `benchmarkIndex` do próprio
  relatório variou de 840 a 1506 entre execuções da mesma página, sem uma linha
  de diferença, e a nota foi de 70 a 99 junto. As outras três categorias não
  dependem de CPU e ficam em 95.
- **A auditoria de `robots.txt` do Lighthouse é pulada de propósito.** Ela busca
  o arquivo com `fetch()` de dentro da página, e a CSP daqui usa
  `connect-src 'none'`. Um crawler de verdade pede direto ao servidor e não é
  afetado; afrouxar a política para satisfazer a auditoria trocaria proteção
  real por um número. O conteúdo do arquivo é conferido em
  `test/browser/site.test.js`.
- **CSP por `<meta>`** não aplica `frame-ancestors`
  ([detalhes](SECURITY.md#limitação-conhecida-csp-por-meta)).
- **A agenda é tão fresca quanto o último build.** É um site estático: sem
  rebuild, um evento encerrado continua na página. Daí o agendamento diário.

## Notas de design

Decisões que não são óbvias lendo o CSS:

- **A agenda é agrupada por dia.** A data fica num trilho à esquerda e é
  impressa uma vez por dia, não uma vez por evento: seis atividades no mesmo
  dia imprimiam a mesma data seis vezes.
- **Nenhum evento recebe tratamento visual próprio.** Os dias são separados
  por um fio e pelo trilho de data; dentro do dia, todas as linhas são iguais.
- **Os tons extremos de superfície moram no `src/_data/site.js`, não no CSS.**
  O cálculo do accent legível precisa do valor exato que a linha vai usar, e
  manter uma segunda cópia no CSS já deixou os horários escorregarem para
  4,41:1 sem ninguém notar.
- **Profundidade é uma escala de três níveis**, com sombra tingida do ink da
  paleta e um filete de luz no topo das superfícies elevadas. Só o frame, o
  destaque e o botão de tema sobem; o resto fica plano.
- **O accent também é cor de texto**, e um accent escuro fica ilegível no tema
  escuro. `lib/color.js` clareia ou escurece a cor preservando o matiz até
  passar em AA, então qualquer `theme.accent` continua legível nos dois temas.
- **Botão que depende de JavaScript nasce escondido de verdade.** O atributo
  `hidden` esconde pelo `display: none` da folha do navegador, e qualquer
  `display` numa classe sobrepõe isso: os botões de tema e de compartilhar
  apareciam para quem está sem JavaScript, ocupando espaço e sem fazer nada.
  Uma regra `[hidden] { display: none !important }` resolve, e um teste carrega
  a página com JavaScript desligado para conferir.
- **Compartilhar usa a folha do sistema quando ela existe** e copia o endereço
  quando não existe. Faltando os dois, o botão nem aparece.
- **O cartão inteiro do evento é clicável**, e o botão de calendário fica acima
  dessa camada com a própria área. No DOM os dois são irmãos, e não um dentro
  do outro, então o leitor de tela encontra dois links distintos e há teste que
  reprova qualquer clicável aninhado. O botão tem 48px de lado, alvo de sobra,
  ao contrário do link de texto miúdo que ocupava esse papel antes.
- **A foto deixa o clique passar.** A coluna da mídia vem depois no DOM e pinta
  acima da camada do link, então clicar em cima da foto não levava a lugar
  nenhum. O teste varre o cartão numa grade de centenas de pontos justamente
  porque uma amostra rala não pegava esse buraco.
- **O botão de calendário do evento é só o ícone.** Com rótulo em texto, cada
  cartão ganhava uma linha inteira e a agenda voltava a caber um evento por
  tela de celular. O rótulo vai no `aria-label`, e o alvo continua com 44px.
- **Alvo de toque mínimo de 44px.** Os ícones de contato têm 48px (o mínimo do
  Android), e a arroba ganha preenchimento com margem negativa, que cresce o alvo
  sem mexer no layout. O cartão de evento inteiro é clicável por um `::after`
  que cobre a linha, então o alvo real é a linha, não o texto do título.
- **O botão de tema é ancorado no cartão, não na viewport.** Fixo no canto da
  tela ele montava na borda arredondada do cartão em toda largura de celular,
  onde o cartão ocupa quase toda a tela e não sobra canto livre. Dentro do
  cartão ele sai de cena junto com o cabeçalho, o que é aceitável para um
  controle que se ajusta uma vez.
- **O fundo é a fachada do museu, fora de foco.** O desfoque está assado no
  arquivo (19 KB), não em `filter: blur()`, porque filtrar uma camada do tamanho da
  viewport faria o compositor refazer o borrão a cada scroll. Sobre a foto vai
  um véu que escurece de cima para baixo, e todo o conteúdo fica em superfícies
  opacas, então o contraste do texto não depende da imagem.
- **A tipografia usa uma família só** (Archivo, variável) para títulos,
  horários e o trilho de data; o texto corrido fica na pilha do sistema, que
  não custa download.

## Semântica da página

O que o HTML carrega além do texto, e por quê:

| Recurso | Onde | Para quê |
| --- | --- | --- |
| `<article>` por evento | cada item da agenda | Conteúdo autocontido: sai da lista e continua fazendo sentido |
| `<time datetime>` | horário e data de atualização | Data legível por máquina, não só por gente |
| `<header>`, `<main>`, `<nav>`, `<footer>` | estrutura | Landmarks de navegação para leitor de tela |
| `aria-label` na seção do dia | cada grupo | Anuncia "segunda-feira, 21 de setembro" em vez de "seg. 21 set." |
| `aria-hidden` no trilho da data | coluna da data | Evita o leitor repetir a data que o rótulo da seção já deu |
| `og:*` e `twitter:*` completos | `<head>` | Cartão de compartilhamento com título, imagem, texto alternativo e URL |
| `theme-color` por tema | `<head>` | A barra do navegador no celular acompanha o tema da página |
| `rel="alternate" type="text/calendar"` | `<head>` | Deixa a agenda descobrível sem caçar o link |
| `robots.txt` e `sitemap.xml` | gerados no build | Rastreamento previsível, com a data da última alteração |

## Segurança e acessibilidade

Detalhe completo em [SECURITY.md](SECURITY.md). Em resumo:

- todo valor do YAML é escapado no HTML, e nenhum campo é interpolado como
  markup, nada usa `| safe`;
- URLs passam por allowlist de esquema (`https:`, `mailto:`, `tel:`);
  `javascript:`, `data:` e `vbscript:` **quebram o build**;
- o JavaScript da página são dois arquivos próprios e pequenos, o botão de tema
  e o de compartilhar; a CSP fica em `script-src 'self'`, sem `unsafe-inline` e
  sem `unsafe-eval`
  ([limitações do `<meta>`](SECURITY.md#limitação-conhecida-csp-por-meta));
- links externos sempre com `rel="noopener noreferrer"`;
- zero recursos externos: sem CDN, sem analytics, e a fonte é servida do próprio repositório;
- actions pinadas por SHA, `permissions` mínimas por job, Dependabot e
  `npm audit` no CI;
- HTML semântico, contraste AA calculado, foco visível, navegação por teclado
  com skip link, `prefers-color-scheme` e `prefers-reduced-motion` respeitados.

## Créditos e licenças dos arquivos

A [licença MIT](LICENSE) cobre o **código**. Os arquivos em `src/assets/` não
são todos do museu e têm termos próprios:

| Arquivo | Origem | Termos |
| --- | --- | --- |
| `fonts/archivo-*.woff2` | Archivo, da Omnibus-Type | SIL Open Font License 1.1, texto em [`fonts/OFL.txt`](src/assets/fonts/OFL.txt) |
| `museu-33-anos.webp`, `museu-de-arte-de-londrina.webp`, `og-museu-33-anos.jpg`, `museu-hero.webp` | Museu de Arte de Londrina | Marca do museu |
| `prefeitura-londrina.png` | Prefeitura de Londrina | Marca do município |
| `fundo-museu.webp` | Foto de Emerson Dias, do portal da Prefeitura | Direitos do autor e da Prefeitura |
| `eventos/*.webp` | Fichas do museu no catálogo da Primavera dos Museus (IBRAM) | Direitos dos respectivos autores |
| `avatar.svg` | Deste repositório | MIT, como o código |

Os ícones de marcas no HTML vêm do [Simple Icons](https://simpleicons.org)
(CC0). Os logotipos em si continuam sendo marcas de seus donos.

Quem for reaproveitar este projeto deve trocar as imagens pelas suas: elas
estão aqui porque são do museu ou porque ele tem autorização de uso, o que não
se transfere junto com o código.

## Licença

[MIT](LICENSE) para o código. Veja a seção acima para os demais arquivos.

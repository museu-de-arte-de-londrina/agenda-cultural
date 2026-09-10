# Como manter a agenda atualizada

Este documento é para quem cuida da programação do museu, não para quem
programa. Não é preciso instalar nada nem saber mexer em código.

## A ideia em uma frase

Toda a página nasce de um arquivo só, o `config.yaml`. Os eventos, os links, as
redes sociais, o texto do rodapé: está tudo lá. Mudou o arquivo, o site se
reconstrói sozinho e vai para o ar em cerca de um minuto.

Você quase nunca vai abrir esse arquivo. O caminho normal é preencher um
formulário, e o resto acontece sem você.

## O caminho normal: publicar um evento

### 1. Abra o formulário

Na página do repositório, vá em **Issues**, clique em **New issue** e escolha
**Publicar evento na agenda**.

Preencha o que souber. Só o título e a data são obrigatórios:

| Campo | Obrigatório | Formato |
| --- | --- | --- |
| Título do evento | sim | texto, até 140 caracteres |
| Data | sim | `21/09/2026` |
| Hora de início | não | `19:00`. Em branco se durar o dia todo |
| Hora de término | não | `20:00` |
| Último dia | não | só para o que dura vários dias, como exposição |
| Tipo de atividade | não | escolha da lista |
| Descrição | não | uma ou duas frases, até 300 caracteres |
| Foto do evento | não | arraste a imagem para a caixa, ou cole o endereço |
| Link para mais informações | não | endereço começando com `https://` |

Clique em **Submit new issue**. Nada é publicado ainda: o formulário enviado é
um rascunho.

### 2. Confira e feche a issue

Releia o que ficou registrado. Achou erro, clique nos três pontinhos, escolha
**Edit** e corrija quantas vezes precisar.

Quando estiver do jeito certo, clique em **Close issue**, ao pé da página.
Fechar a issue é o gesto que manda publicar: quer dizer "conferi os dados,
pode ir para o ar".

### 3. O resto acontece sozinho

Assim que você fecha, a automação:

1. Lê os campos e confere se as datas fazem sentido.
2. Reconstrói o site inteiro com o evento novo, para garantir que ele não quebra
   a página.
3. Escreve o evento no `config.yaml` e publica.

O site fica no ar cerca de um minuto depois de você fechar a issue. A automação
comenta ali com o endereço da página.

**Se algo estiver errado**, nada é publicado. Em vez disso, ela escreve um
comentário na sua própria issue dizendo o que não entendeu, em português. Para
tentar de novo: clique em **Reopen issue**, corrija o formulário pelo **Edit** e
feche outra vez.

Para **recusar** um pedido sem publicar nada, feche pela setinha ao lado do
botão, escolhendo **Close as not planned**. A automação entende isso como
recusa e não mexe no site.

Reabrir e fechar de novo uma issue já publicada não duplica o evento: a
automação compara com o que já está na agenda e avisa que não há o que fazer.
Para mexer em um evento que já está no ar, veja
[Tirar ou corrigir um evento](#tirar-ou-corrigir-um-evento-antes-da-data).

## A foto do evento

Arraste o arquivo para dentro da caixa **Foto do evento**, no formulário. O
GitHub envia a imagem e deixa um endereço no lugar; pode parecer estranho, mas é
só isso mesmo. Se a foto já estiver publicada em algum lugar, colar o endereço
dela funciona igual.

A automação baixa essa imagem e guarda junto com o site, então a miniatura
continua funcionando mesmo que a foto saia do ar na origem, e o navegador de
quem visita a agenda não precisa buscar nada em servidor de terceiro.

Aceita JPG, PNG e WebP, até 5 MB. Uma imagem de 800 pixels de largura já é mais
que suficiente para a miniatura.

Se o endereço não devolver uma imagem, se a foto passar do limite de peso ou se
o link for privado, nada é publicado e a automação comenta na issue explicando o
caso. Para publicar sem foto, apague o conteúdo do campo e envie de novo: o
cartão funciona do mesmo jeito, só fica sem miniatura.

### Acrescentar a foto depois

Se o evento já foi publicado sem foto, o caminho é editar o `config.yaml` na
mão. Suba a imagem para a pasta `src/assets/eventos/` com **Add file → Upload
files**, depois acrescente uma linha `image:` no bloco do evento:

```yaml
  - title: Oficina de gravura
    start: 2026-10-03T14:00
    end: 2026-10-03T17:00
    kind: Oficina
    image: assets/eventos/oficina-de-gravura.webp
    url: https://exemplo.org/oficina
    description: Uma frase sobre a atividade.
```

Repare que o caminho escrito no `config.yaml` começa em `assets/`, e não em
`src/assets/`. O `src` fica de fora.

## Os eventos somem sozinhos

Você não precisa tirar nada da agenda depois que a data passa. O site publica só
o que ainda está por vir.

Como a conta é feita:

- Evento com hora de término some depois dessa hora.
- Evento sem hora de término some no fim do dia da data marcada.
- Evento com **último dia** preenchido, como uma exposição, fica na página até o
  fim daquele último dia.

O site se reconstrói todo dia às 3h17 da manhã, e é nesse momento que o que
passou cai da lista. Ou seja: um evento de terça à noite ainda aparece na
madrugada de terça para quarta, e some na primeira reconstrução seguinte.

Quando não sobra nenhum evento futuro, a página não fica quebrada nem vazia. Ela
mostra um aviso dizendo que não há atividade marcada por enquanto e aponta para
as páginas oficiais logo abaixo.

## Tirar ou corrigir um evento antes da data

Isto acontece quando algo é cancelado, adiado ou saiu com erro. Aqui não tem
formulário, é edição direta do arquivo, e continua sendo simples.

1. Na página do repositório, abra o arquivo `config.yaml`.
2. Clique no ícone de lápis, no canto superior direito.
3. Ache o bloco do evento. Cada um começa com `- title:` e vai até a linha antes
   do próximo `- title:`.
4. Para **cancelar**, apague o bloco inteiro. Para **corrigir**, mude só o que
   está errado.
5. Desça até o fim da página, escreva uma frase no campo de descrição da
   mudança, por exemplo "cancelar a oficina de 3 de outubro", e clique em
   **Commit changes**.

O site se reconstrói e publica em cerca de um minuto.

> Se você errar a digitação e o arquivo ficar inválido, a publicação falha e a
> página que está no ar **não** é substituída por uma quebrada. A aba
> **Actions** mostra em vermelho qual campo está errado, com o número da linha.

## Mudar o resto da página

Tudo o que não é evento também mora no `config.yaml` e se edita do mesmo jeito:

| O que você quer mudar | Onde |
| --- | --- |
| Nome, frase de apresentação, endereço | `profile` |
| Foto redonda do topo | `profile.avatar` |
| Ícones de contato do topo | `social` |
| Links das páginas oficiais, lá embaixo | `links` |
| Logotipos e link do rodapé | `footer` |
| Cor de destaque do site | `theme.accent` |

O `README.md` explica campo por campo, com exemplos, na seção **Referência do
`config.yaml`**.

## Quem pode fazer o quê

O repositório é público, então qualquer pessoa consegue abrir uma issue. Isso é
proposital: serve para o público avisar de um erro ou sugerir algo.

A publicação automática, porém, só roda para quem tem acesso de escrita no
repositório. Vindo de fora, o formulário vira um pedido para alguém da equipe
ler, e nunca uma alteração automática no site. A issue fica aberta esperando
alguém do museu; se a própria pessoa fechar, recebe um comentário explicando
que a revisão é humana.

Para dar acesso a alguém da equipe: **Settings → Collaborators and teams → Add
people**, com a permissão **Write**.

## Quando alguma coisa não anda

Quase tudo aparece na aba **Actions**, que é o histórico de tudo o que rodou.
Verde é sucesso, vermelho é falha, e clicar na linha mostra o motivo.

**Enviei o formulário e nada aconteceu.** Enviar não publica. Falta fechar a
issue, no **Close issue**. Se você já fechou e mesmo assim nada rodou, veja se a
issue está com a etiqueta `evento`: usando o formulário ela entra sozinha, mas
numa issue escrita à mão a automação não reconhece os campos e não faz nada.

**A automação comentou que não entendeu a data.** O formato é dia/mês/ano com
quatro dígitos no ano, como `03/10/2026`. Hora é `19:00`, com dois pontos.

**A automação disse que publicou, mas o site continua igual.** Espere um minuto
e recarregue a página segurando Shift, para forçar o navegador a buscar a versão
nova em vez de usar a que ele guardou.

**Enviei o mesmo evento duas vezes.** Ele entra uma vez só. A automação compara
título e horário de início com o que já está na agenda, avisa na issue e não
escreve nada.

**Está tudo vermelho na aba Actions.** Abra a linha mais recente e leia a última
mensagem. Se não fizer sentido, o `SECURITY.md` explica como pedir ajuda.

## Manutenção que aparece de vez em quando

**A reconstrução diária pode ser desligada sozinha.** O GitHub desativa tarefas
agendadas em repositórios que passam 60 dias sem nenhuma atividade, e avisa por
e-mail quando faz isso. Publicar qualquer evento já conta como atividade e
mantém tudo funcionando. Se acontecer, a aba **Actions** tem um botão para
reativar.

Vale notar que isso não derruba o site. A página no ar continua publicada; o que
para é a reconstrução automática que remove eventos vencidos.

**Propostas de atualização de dependências.** De tempos em tempos aparecem
propostas abertas por um robô chamado `dependabot`, atualizando bibliotecas
usadas para construir o site. Elas não mudam nada do conteúdo. Se a verificação
automática estiver verde, podem ser integradas sem medo.

## Resumo do ciclo

```
formulário  ->  você confere  ->  fecha a issue  ->  robô publica  ->  site no ar
                                                        ~30s             ~40s

                    o robô só entra depois que você fecha
                                    |
               evento some sozinho depois que a data passa
```

# Como manter a agenda atualizada

Este documento é para quem cuida da programação do museu, não para quem
programa. Não é preciso instalar nada nem saber mexer em código.

## A ideia em uma frase

Toda a página nasce de um arquivo só, o `config.yaml`. Os eventos, os links, as
redes sociais, o texto do rodapé: está tudo lá. Mudou o arquivo, o site se
reconstrói sozinho e vai para o ar em poucos minutos.

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
| Link para mais informações | não | endereço começando com `https://` |

Clique em **Submit new issue**.

### 2. A conferência automática, que leva cerca de um minuto

Assim que você envia, uma automação lê o formulário e faz três coisas:

1. Confere se as datas fazem sentido e se os campos cabem nos limites.
2. Reconstrói o site inteiro com o evento novo, para garantir que ele não quebra
   a página.
3. Abre uma **proposta de alteração**, que no GitHub se chama *pull request*.

**Se algo estiver errado**, ela não abre proposta nenhuma. Em vez disso, escreve
um comentário na sua própria issue dizendo o que não entendeu, em português. Aí
é só clicar nos três pontinhos do formulário, escolher **Edit**, corrigir e
salvar. A conferência roda de novo sozinha.

**Se estiver tudo certo**, ela comenta na issue com o endereço da proposta:

> Proposta aberta: https://github.com/museu-de-arte-de-londrina/agenda-cultural/pull/…

### 3. Revisar e publicar

Esta é a parte que continua sendo humana, de propósito. Nada vai ao ar sem
alguém olhar.

Abra o endereço da proposta. Na aba **Files changed** você vê exatamente o que
vai mudar no arquivo: umas cinco linhas, o evento novo e nada mais.

Confira data, hora e descrição. Se estiver bom, volte para a aba
**Conversation** e clique em **Merge pull request**, depois em **Confirm
merge**.

A issue do formulário fecha sozinha junto com a proposta.

### 4. O site vai ao ar

A publicação leva cerca de dois minutos depois da integração. Não precisa fazer
nada. Se quiser acompanhar, a aba **Actions** mostra a tarefa **Deploy**
rodando; quando ficar verde, a página já está atualizada.

## A foto do evento

O formulário ainda não recebe imagem, então o evento entra sem foto. O cartão
funciona do mesmo jeito, só fica sem miniatura.

Para colocar a foto, faça isso **na proposta, antes de integrar**:

1. Na proposta aberta, vá na aba **Files changed** e depois em **Add files →
   Upload files**, ou navegue até a pasta `src/assets/eventos/` no ramo da
   proposta.
2. Envie a imagem com um nome curto, sem acento e sem espaço, por exemplo
   `oficina-de-gravura.webp`.
3. Edite o `config.yaml` na mesma proposta e acrescente uma linha `image:` no
   bloco do evento, logo abaixo de `kind:`:

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

Formatos aceitos: `.webp`, `.jpg` e `.png`. Prefira `.webp`, que pesa bem menos.
Uma imagem de 800 pixels de largura já é mais que suficiente para a miniatura.

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

O site se reconstrói e publica em cerca de dois minutos.

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
ler, e a pessoa recebe um comentário explicando que a revisão é humana. Nunca
vira uma alteração automática no site.

Para dar acesso a alguém da equipe: **Settings → Collaborators and teams → Add
people**, com a permissão **Write**.

## Quando alguma coisa não anda

Quase tudo aparece na aba **Actions**, que é o histórico de tudo o que rodou.
Verde é sucesso, vermelho é falha, e clicar na linha mostra o motivo.

**Enviei o formulário e nada aconteceu.** Veja se a issue está com a etiqueta
`evento`. Se o formulário foi usado, ela entra sozinha. Se a issue foi escrita à
mão, sem o formulário, a automação não reconhece os campos e não faz nada.

**A automação comentou que não entendeu a data.** O formato é dia/mês/ano com
quatro dígitos no ano, como `03/10/2026`. Hora é `19:00`, com dois pontos.

**A proposta foi aberta, mas o evento não apareceu no site.** A proposta precisa
ser integrada com **Merge pull request**. Enquanto ela estiver aberta, a mudança
existe só na proposta, e não no site.

**Integrei e o site continua igual.** Espere uns dois minutos e recarregue a
página segurando Shift, para forçar o navegador a buscar a versão nova em vez de
usar a que ele guardou.

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
formulário  ->  conferência automática  ->  proposta de alteração
                                                    |
                                            revisão de alguém
                                                    |
                                                 integrar
                                                    |
                                          site no ar em ~2 min
                                                    |
                              evento some sozinho depois que a data passa
```

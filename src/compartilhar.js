/**
 * Botão de compartilhar.
 *
 * Carregado com defer, ao contrário do script de tema: nada aqui precisa
 * acontecer antes da primeira pintura, e adiar deixa o caminho de renderização
 * livre.
 *
 * No celular abre a folha de compartilhamento do próprio sistema. Onde ela não
 * existe, copia o endereço. Onde nenhum dos dois existe, o botão continua
 * escondido, porque um controle que não faz nada é pior que controle nenhum.
 */
(function () {
  'use strict';

  var botao = document.getElementById('compartilhar');
  if (!botao) return;

  var podeCompartilhar = typeof navigator.share === 'function';
  var podeCopiar = !!(navigator.clipboard && navigator.clipboard.writeText);
  if (!podeCompartilhar && !podeCopiar) return;

  var aviso = document.getElementById('compartilhar-aviso');
  var rotuloOriginal = botao.getAttribute('aria-label');
  var temporizador;

  function avisar(texto) {
    if (aviso) aviso.textContent = texto;
    botao.setAttribute('aria-label', texto);
    clearTimeout(temporizador);
    temporizador = setTimeout(function () {
      if (aviso) aviso.textContent = '';
      botao.setAttribute('aria-label', rotuloOriginal);
    }, 4000);
  }

  botao.hidden = false;

  botao.addEventListener('click', function () {
    var dados = {
      title: botao.dataset.titulo || document.title,
      text: botao.dataset.texto || '',
      url: botao.dataset.url || location.href,
    };

    if (podeCompartilhar) {
      // Cancelar a folha de compartilhamento rejeita a promessa, e isso não é
      // um erro que mereça aviso na tela.
      navigator.share(dados).catch(function () {});
      return;
    }

    navigator.clipboard.writeText(dados.url).then(
      function () {
        avisar(botao.dataset.copiado || 'Endereço copiado');
      },
      function () {
        avisar(botao.dataset.falhou || 'Não consegui copiar o endereço');
      },
    );
  });
})();

/**
 * Acabamento do menu de calendário de cada evento.
 *
 * O menu é um <details>, então ele abre, fecha e anda pelo teclado sem
 * script nenhum. Isto aqui só acrescenta o que um <details> sozinho não faz e
 * quem usa um menu espera: fechar ao clicar fora, fechar no Esc, e fechar o
 * anterior quando outro abre.
 *
 * Com defer, como o de compartilhar: nada aqui precisa acontecer antes da
 * primeira pintura. Sem JavaScript, o menu continua inteiro; só fica aberto
 * até alguém tocar no botão de novo.
 */
(function () {
  'use strict';

  var SELETOR = '.entry__cal';

  function abertos() {
    return Array.prototype.slice.call(document.querySelectorAll(SELETOR + '[open]'));
  }

  function fechar(exceto) {
    abertos().forEach(function (menu) {
      if (menu !== exceto) menu.open = false;
    });
  }

  // Na fase de captura: um clique num item do menu navega para fora, e no
  // borbulhamento o fechamento chegaria tarde ou nem chegaria.
  document.addEventListener(
    'toggle',
    function (evento) {
      var alvo = evento.target;
      if (alvo.matches && alvo.matches(SELETOR) && alvo.open) fechar(alvo);
    },
    true,
  );

  document.addEventListener('click', function (evento) {
    var dentro = evento.target.closest && evento.target.closest(SELETOR);
    if (!dentro) fechar(null);
  });

  document.addEventListener('keydown', function (evento) {
    if (evento.key !== 'Escape') return;
    var lista = abertos();
    if (lista.length === 0) return;

    // Devolve o foco ao botão que abriu, senão o Esc deixaria o teclado
    // perdido no começo da página.
    var botao = lista[lista.length - 1].querySelector('summary');
    fechar(null);
    if (botao) botao.focus();
  });
})();

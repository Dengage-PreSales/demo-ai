/* ============================================================================
   Convivência entre banners On-Site da Dengage e o cabeçalho fixo do site

   O layout Banner do painel injeta um contêiner próprio (classe/id
   "_dn_onsite-banner"), com position:fixed, colado no TOPO ou no RODAPÉ
   da janela. No topo ele cobriria o cabeçalho fixo do site.

   Este observador faz UMA única coisa: enquanto existir um banner da
   Dengage visível encostado no topo, desce o .site-header exatamente a
   altura do banner; quando o banner fecha ou some, devolve o cabeçalho
   ao lugar. Popups, overlays, barras no rodapé e todo o resto ficam
   intocados. Funciona mesmo com o conteúdo do banner dentro de iframe,
   porque mede o contêiner do motor, não o conteúdo.
   ========================================================================== */
(function () {
    'use strict';

    var SEL = '#_dn_onsite-banner, ._dn_onsite-banner, [id^="_dn_onsite-banner"]';

    var timer = null;

    function topBannerHeight() {
        var max = 0;
        var els = document.querySelectorAll(SEL);
        for (var i = 0; i < els.length; i++) {
            var r = els[i].getBoundingClientRect();
            if (!r.height || !r.width) continue;
            /* encostado (ou animando a partir de cima): banner de topo.
               r.bottom é o quanto ele ocupa abaixo da borda da janela.
               Banners de rodapé têm top perto da base e ficam de fora. */
            if (r.top <= 2) max = Math.max(max, r.bottom);
        }
        return Math.max(0, Math.round(max));
    }

    function sync() {
        var header = document.querySelector('.site-header');
        if (!header) return;

        var offset = document.querySelector(SEL) ? topBannerHeight() : 0;

        if (offset > 0) {
            if (header.style.top !== offset + 'px') {
                header.style.transition = 'top .25s ease';
                header.style.top = offset + 'px';
            }
        } else if (header.style.top) {
            header.style.top = '';
        }

        /* enquanto houver banner na página, re-mede a cada 400ms: cobre a
           animação de entrada, o fechar via CSS do conteúdo (que muda a
           altura sem disparar mutação de atributos) e redimensionamentos */
        var active = document.querySelector(SEL) !== null;
        if (active && !timer) timer = setInterval(sync, 400);
        if (!active && timer) { clearInterval(timer); timer = null; }
    }

    var debounce = null;
    function queueSync() {
        clearTimeout(debounce);
        /* espera a animação de entrada do motor terminar antes de medir */
        debounce = setTimeout(sync, 350);
    }

    function start() {
        var mo = new MutationObserver(queueSync);
        mo.observe(document.body, { childList: true, subtree: true });
        window.addEventListener('resize', queueSync);
        sync();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();

/* ============================================================================
   Fonte dos widgets de recomendação

   Por padrão os cinco widgets leem o catálogo local (cantu_prod_example.json),
   para que a demo funcione antes de qualquer configuração no painel.

   Preencha um containerKey abaixo e aquele widget passa a usar a engine de
   recomendação da Dengage:

     dengage('getRecommendation', containerKey, opts, callback)

   O painel fornece o containerKey de cada container de recomendação criado.
   A resposta é convertida para o mesmo formato do catálogo local, então os
   widgets não precisam saber de onde vieram os produtos. Se a chamada falhar
   ou vier vazia, o widget cai de volta no catálogo local em vez de sumir.
============================================================================ */
var CANTU_RECO_CONTAINERS = {
  classicWidget:    '',
  bannerWidget:     '',
  tabWidget:        '',
  mostViewedWidget: '',
  popupWidget:      ''
};

/* Resposta da Dengage -> formato do catálogo local. */
function cantuMapRecommendation(list) {
  return (list || []).map(function (p) {
    return {
      id: String(p.id || p.productId || ''),
      name: p.title || p.name || '',
      desc: p.description || '',
      price: String(p.price != null ? p.price : ''),
      oldPrice: String(p.originalPrice != null ? p.originalPrice : ''),
      currency: p.currency || 'BRL',
      image: [p.imageUrl || p.image || ''],
      link: p.link || '',
      category: p.category || '',
      brand: p.brand || '',
      availability: p.stockStatus ? p.stockStatus !== 'out_of_stock' : (Number(p.stock) > 0),
      colors: p.colors || []
    };
  }).filter(function (p) { return p.id && p.name; });
}

/* Carrega produtos para um widget: engine da Dengage quando configurada,
   catálogo local caso contrário. */
function cantuLoadProducts(widgetId, productsUrl, onReady, label) {
  var containerKey = CANTU_RECO_CONTAINERS[widgetId];

  function local() {
    fetch(productsUrl)
      .then(function (res) {
        if (!res.ok) throw new Error('Catalog unavailable');
        return res.json();
      })
      .then(function (data) { onReady(Array.isArray(data) ? data : []); })
      .catch(function (err) { console.error(label + ':', err); });
  }

  if (!containerKey || typeof window.dengage !== 'function') { local(); return; }

  var settled = false;
  function finish(list) {
    if (settled) return;
    settled = true;
    var mapped = cantuMapRecommendation(list);
    if (mapped.length) onReady(mapped); else local();
  }

  try {
    window.dengage('getRecommendation', containerKey, {}, finish);
    /* a engine não garante callback; sem isso o widget ficaria vazio */
    setTimeout(function () { if (!settled) { settled = true; local(); } }, 3000);
  } catch (err) {
    console.error(label + ': getRecommendation failed, using the local catalog', err);
    local();
  }
}

function ClassicWidget() {
    const PRODUCTS_URL = 'cantu_prod_example.json';
    const WIDGET_ID = 'classicWidget';
    const SWIPER_CLASS = 'classicWidgetSwiper';

    function getCollectionsSection() {
        return document.querySelector('.collections');
    }

    function mountWidget(widgetEl) {
        const collections = getCollectionsSection();
        if (!collections) {
            console.warn('ClassicWidget: .collections section not found');
            return false;
        }
        collections.insertAdjacentElement('beforebegin', widgetEl);
        return true;
    }

    function injectStyles() {
        if (document.getElementById('classic-widget-styles')) return;

        const style = document.createElement('style');
        style.id = 'classic-widget-styles';
        style.textContent = `
            #${WIDGET_ID} {
                padding: var(--space-xl, 6rem) 0;
                background: var(--color-ivory, #EDE9F5);
            }
            #${WIDGET_ID} .reco-widget-header {
                display: flex;
                align-items: flex-end;
                justify-content: space-between;
                gap: var(--space-md, 2rem);
                margin-bottom: var(--space-md, 2rem);
            }
            #${WIDGET_ID} .reco-widget-title {
                font-family: var(--font-display, 'Barlow Condensed', Georgia, serif);
                font-size: clamp(2rem, 4vw, 2.75rem);
                font-weight: 300;
                color: var(--color-charcoal, #1A1030);
                line-height: 1.1;
            }
            #${WIDGET_ID} .reco-widget-subtitle {
                margin-top: 0.5rem;
                color: var(--color-taupe, #7A8492);
                font-size: 1rem;
            }
            #${WIDGET_ID} .reco-slider-shell {
                display: flex;
                align-items: center;
                gap: 1rem;
            }
            #${WIDGET_ID} .reco-slider-shell .reco-swiper {
                flex: 1;
                min-width: 0;
                overflow: hidden;
            }
            #${WIDGET_ID} .reco-nav-btn.swiper-button-next,
            #${WIDGET_ID} .reco-nav-btn.swiper-button-prev {
                --swiper-navigation-size: 48px;
                width: 48px !important;
                height: 48px !important;
                min-width: 48px !important;
                min-height: 48px !important;
                position: relative !important;
                top: auto !important;
                left: auto !important;
                right: auto !important;
                bottom: auto !important;
                margin: 0 !important;
                border: 1px solid var(--color-gold-light, #4E018F);
                border-radius: 50%;
                background: #fff;
                color: var(--color-gold, #4E018F);
                cursor: pointer;
                display: inline-flex !important;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                box-shadow: 0 4px 14px rgba(28, 28, 28, 0.08);
            }
            #${WIDGET_ID} .reco-nav-btn:hover {
                background: var(--color-gold-dark, #35015F);
                border-color: var(--color-gold-dark, #35015F);
                color: #fff;
            }
            #${WIDGET_ID} .reco-nav-btn::after { display: none !important; content: none !important; }
            #${WIDGET_ID} .reco-nav-btn svg {
                width: 22px; height: 22px; stroke: var(--color-gold, #4E018F);
                fill: none; stroke-width: 2.25; pointer-events: none;
            }
            #${WIDGET_ID} .reco-nav-btn:hover svg { stroke: #fff; }
            #${WIDGET_ID} .reco-widget-footer {
                margin-top: 1.75rem;
                display: flex;
                justify-content: center;
            }
            #${WIDGET_ID} .reco-widget-pagination {
                position: static !important;
                width: auto !important;
                transform: none !important;
                display: flex !important;
                gap: 10px;
            }
            #${WIDGET_ID} .swiper-pagination-bullet {
                width: 9px; height: 9px; margin: 0 !important;
                background: rgba(184, 134, 11, 0.35); opacity: 1;
            }
            #${WIDGET_ID} .swiper-pagination-bullet-active {
                background: var(--color-gold-dark, #35015F);
            }
            #${WIDGET_ID} .reco-product-card {
                background: var(--color-warm-white, #FEFCF9);
                border: 1px solid rgba(166, 144, 128, 0.2);
                border-radius: 12px;
                overflow: hidden;
                height: 100%;
                display: flex;
                flex-direction: column;
            }
            #${WIDGET_ID} .reco-product-image {
                display: block;
                aspect-ratio: 4 / 5;
                overflow: hidden;
                background: #fff;
            }
            #${WIDGET_ID} .reco-product-image img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            #${WIDGET_ID} .reco-product-body {
                padding: 1rem;
                display: flex;
                flex-direction: column;
                flex: 1;
                gap: 0.5rem;
            }
            #${WIDGET_ID} .reco-product-brand {
                font-size: 0.72rem;
                letter-spacing: 0.12em;
                text-transform: uppercase;
                color: var(--color-taupe, #7A8492);
            }
            #${WIDGET_ID} .reco-product-name {
                font-family: var(--font-display, 'Barlow Condensed', Georgia, serif);
                font-size: 1.2rem;
                font-weight: 500;
                line-height: 1.3;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
                text-overflow: ellipsis;
                min-height: calc(1.3em * 2);
            }
            #${WIDGET_ID} .reco-product-name-link {
                color: inherit;
                text-decoration: none;
                transition: color 0.2s ease;
            }
            #${WIDGET_ID} .reco-product-name-link:hover {
                color: var(--color-gold-dark, #35015F);
            }
            #${WIDGET_ID} .reco-product-image { display: block; }
            #${WIDGET_ID} .reco-product-price {
                font-weight: 600;
                color: var(--color-gold-dark, #35015F);
            }
            #${WIDGET_ID} .reco-product-old-price {
                margin-left: 0.5rem;
                font-size: 0.85rem;
                color: var(--color-taupe, #7A8492);
                text-decoration: line-through;
            }
            #${WIDGET_ID} .reco-product-cart-btn {
                margin-top: auto;
                width: 100%;
                border: none;
                border-radius: 8px;
                padding: 0.7rem 1rem;
                background: var(--color-gold-dark, #35015F);
                color: #fff;
                font-size: 0.85rem;
                font-weight: 600;
                text-transform: uppercase;
                cursor: pointer;
            }
            #${WIDGET_ID} .reco-product-cart-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        `;
        document.head.appendChild(style);
    }

    function loadSwiper(onReady) {
        if (!document.querySelector('link[href*="swiper"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'vendor/swiper-bundle.min.css';
            document.head.appendChild(link);
        }
        if (typeof Swiper !== 'undefined') {
            onReady();
            return;
        }
        const script = document.createElement('script');
        script.src = 'vendor/swiper-bundle.min.js';
        script.onload = onReady;
        document.head.appendChild(script);
    }

    function loadProducts(onReady) {
        cantuLoadProducts(WIDGET_ID, PRODUCTS_URL, onReady, 'ClassicWidget');
    }

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    function formatPrice(value, currency) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: currency || 'BRL'
        }).format(Number(value) || 0);
    }

    function shuffleArray(items) {
        const list = items.slice();
        for (let i = list.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [list[i], list[j]] = [list[j], list[i]];
        }
        return list;
    }

    function buildProductCard(product) {
        const image = Array.isArray(product.image) ? product.image[0] : product.image;
        const oldPrice = Number(product.oldPrice) > Number(product.price)
            ? `<span class="reco-product-old-price">${formatPrice(product.oldPrice, product.currency)}</span>`
            : '';

        return `
            <div class="swiper-slide">
                <article class="reco-product-card">
                    <a href="product.html?id=${encodeURIComponent(product.id)}" class="reco-product-image">
                        <img src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" loading="lazy">
                    </a>
                    <div class="reco-product-body">
                        <p class="reco-product-brand">${escapeHtml(product.brand)}</p>
                        <h3 class="reco-product-name"><a class="reco-product-name-link" href="product.html?id=${encodeURIComponent(product.id)}">${escapeHtml(product.name)}</a></h3>
                        <p class="reco-product-price">${formatPrice(product.price, product.currency)} ${oldPrice}</p>
                        <button class="reco-product-cart-btn" type="button" data-cart-add
                            data-product-id="${escapeHtml(product.id)}"
                            data-product-variant-id="${escapeHtml(product.id)}"
                            data-product-name="${escapeHtml(product.name)}"
                            data-product-price="${escapeHtml(product.price)}"
                            data-product-old-price="${escapeHtml(product.oldPrice || '')}"
                            data-product-currency="${escapeHtml(product.currency || 'BRL')}"
                            data-product-image="${escapeHtml(image)}"
                            data-product-category="${escapeHtml(product.category)}"
                            ${product.availability ? '' : 'disabled'}
                        >${product.availability ? 'Add to cart' : 'Out of stock'}</button>
                    </div>
                </article>
            </div>
        `;
    }

    function bindCartButtons(root) {
        if (!window.CantuCart || !root) return;
        root.querySelectorAll('[data-cart-add]:not([data-reco-bound])').forEach((btn) => {
            btn.dataset.recoBound = 'true';
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                window.CantuCart.addItem({
                    id: btn.dataset.productId,
                    name: btn.dataset.productName,
                    price: btn.dataset.productPrice,
                    currency: btn.dataset.productCurrency || 'BRL',
                    image: btn.dataset.productImage,
                    category: btn.dataset.productCategory
                });
                window.dispatchEvent(new CustomEvent('cantupneus:cart:updated'));
                const toast = document.getElementById('loginSuccessMessage');
                if (toast) {
                    toast.textContent = 'Added to cart.';
                    toast.classList.add('active');
                    clearTimeout(window.dPneusToastTimer);
                    window.dPneusToastTimer = setTimeout(() => toast.classList.remove('active'), 2000);
                }
            });
        });
    }

    function render(products) {
        const selected = shuffleArray(products).slice(0, 10);
        if (!selected.length) return;

        const widget = document.createElement('section');
        widget.className = 'reco-widget';
        widget.id = WIDGET_ID;
        widget.innerHTML = `
            <div class="container">
                <div class="reco-widget-header">
                    <div>
                        <p class="text-label">Selected for you</p>
                        <h2 class="reco-widget-title">Bestseller</h2>
                        <p class="reco-widget-subtitle">The fastest-moving sizes this season</p>
                    </div>
                </div>
                <div class="reco-slider-shell">
                    <button class="reco-nav-btn swiper-button-prev swiper-button-prev-${SWIPER_CLASS}" type="button" aria-label="Previous">
                        <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2"/></svg>
                    </button>
                    <div class="swiper reco-swiper ${SWIPER_CLASS}">
                        <div class="swiper-wrapper">${selected.map(buildProductCard).join('')}</div>
                    </div>
                    <button class="reco-nav-btn swiper-button-next swiper-button-next-${SWIPER_CLASS}" type="button" aria-label="Next">
                        <svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" fill="none" stroke="currentColor" stroke-width="2"/></svg>
                    </button>
                </div>
                <div class="reco-widget-footer">
                    <div class="swiper-pagination swiper-pagination-${SWIPER_CLASS}"></div>
                </div>
            </div>
        `;

        if (!mountWidget(widget)) return;

        new Swiper(`#${WIDGET_ID} .${SWIPER_CLASS}`, {
            slidesPerView: 5,
            slidesPerGroup: 1,
            spaceBetween: 24,
            speed: 600,
            loop: selected.length > 5,
            grabCursor: true,
            pagination: {
                el: `#${WIDGET_ID} .swiper-pagination-${SWIPER_CLASS}`,
                clickable: true
            },
            navigation: {
                nextEl: `#${WIDGET_ID} .swiper-button-next-${SWIPER_CLASS}`,
                prevEl: `#${WIDGET_ID} .swiper-button-prev-${SWIPER_CLASS}`
            },
            breakpoints: {
                0: { slidesPerView: 1.15, spaceBetween: 16 },
                576: { slidesPerView: 2, spaceBetween: 18 },
                768: { slidesPerView: 3, spaceBetween: 20 },
                992: { slidesPerView: 4, spaceBetween: 22 },
                1200: { slidesPerView: 5, spaceBetween: 24 }
            }
        });

        bindCartButtons(widget);
    }

    injectStyles();
    loadSwiper(() => loadProducts(render));
}




function BannerWidget() {
    const PRODUCTS_URL = 'cantu_prod_example.json';
    const WIDGET_ID = 'bannerWidget';
    const SWIPER_CLASS = 'bannerWidgetSwiper';

    function mountWidget(widgetEl) {
        const classicEl = document.getElementById('classicWidget');
        if (classicEl) {
            classicEl.insertAdjacentElement('afterend', widgetEl);
            return true;
        }
        const collections = document.querySelector('.collections');
        if (!collections) {
            console.warn('BannerWidget: anchor not found');
            return false;
        }
        collections.insertAdjacentElement('beforebegin', widgetEl);
        return true;
    }

    function injectStyles() {
        if (document.getElementById('banner-widget-styles')) return;

        const style = document.createElement('style');
        style.id = 'banner-widget-styles';
        style.textContent = `
            #${WIDGET_ID} {
                padding: var(--space-xl, 6rem) 0;
                background: var(--color-cream, #F6F4FA);
            }
            #${WIDGET_ID} .banner-widget-header {
                display: flex;
                align-items: flex-start;
                justify-content: center;
                position: relative;
                margin-bottom: var(--space-md, 2rem);
                min-height: 48px;
            }
            #${WIDGET_ID} .banner-widget-heading {
                text-align: center;
                max-width: 640px;
            }
            #${WIDGET_ID} .banner-widget-title {
                font-family: var(--font-display, 'Barlow Condensed', Georgia, serif);
                font-size: clamp(2rem, 4vw, 2.75rem);
                font-weight: 300;
                color: var(--color-charcoal, #1A1030);
                line-height: 1.1;
            }
            #${WIDGET_ID} .banner-widget-subtitle {
                margin-top: 0.5rem;
                color: var(--color-taupe, #7A8492);
                font-size: 1rem;
            }
            #${WIDGET_ID} .banner-widget-nav {
                position: absolute;
                right: 0;
                top: 50%;
                transform: translateY(-50%);
                display: flex;
                gap: 0.75rem;
            }
            #${WIDGET_ID} .banner-nav-btn {
                --swiper-navigation-size: 48px;
                width: 48px !important;
                height: 48px !important;
                position: relative !important;
                top: auto !important;
                left: auto !important;
                right: auto !important;
                bottom: auto !important;
                margin: 0 !important;
                border: 1px solid var(--color-gold-light, #4E018F);
                border-radius: 50%;
                background: #fff;
                color: var(--color-gold, #4E018F);
                cursor: pointer;
                display: inline-flex !important;
                align-items: center;
                justify-content: center;
                box-shadow: 0 4px 14px rgba(28, 28, 28, 0.08);
            }
            #${WIDGET_ID} .banner-nav-btn:hover {
                background: var(--color-gold-dark, #35015F);
                border-color: var(--color-gold-dark, #35015F);
                color: #fff;
            }
            #${WIDGET_ID} .banner-nav-btn::after { display: none !important; content: none !important; }
            #${WIDGET_ID} .banner-nav-btn svg {
                width: 22px; height: 22px;
                stroke: var(--color-gold, #4E018F);
                fill: none; stroke-width: 2.25;
                pointer-events: none;
            }
            #${WIDGET_ID} .banner-nav-btn:hover svg { stroke: #fff; }
            #${WIDGET_ID} .banner-widget-body {
                display: grid;
                grid-template-columns: minmax(260px, 340px) 1fr;
                gap: 1.5rem;
                align-items: stretch;
            }
            #${WIDGET_ID} .banner-widget-banner {
                position: relative;
                border-radius: 14px;
                overflow: hidden;
                min-height: 420px;
            }
            #${WIDGET_ID} .banner-widget-banner img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            #${WIDGET_ID} .banner-widget-banner-overlay {
                position: absolute;
                inset: 0;
                background: linear-gradient(180deg, rgba(28,28,28,0.05) 0%, rgba(28,28,28,0.72) 100%);
                display: flex;
                flex-direction: column;
                justify-content: flex-end;
                padding: 1.75rem;
                color: #fff;
            }
            #${WIDGET_ID} .banner-widget-banner-label {
                font-size: 0.72rem;
                letter-spacing: 0.14em;
                text-transform: uppercase;
                margin-bottom: 0.5rem;
            }
            #${WIDGET_ID} .banner-widget-banner-title {
                font-family: var(--font-display, 'Barlow Condensed', Georgia, serif);
                font-size: clamp(1.6rem, 2.5vw, 2.1rem);
                margin-bottom: 0.75rem;
            }
            #${WIDGET_ID} .banner-widget-banner-link {
                display: inline-block;
                font-size: 0.85rem;
                font-weight: 600;
                letter-spacing: 0.06em;
                text-transform: uppercase;
                color: #fff;
                border-bottom: 1px solid rgba(255,255,255,0.65);
                width: fit-content;
            }
            #${WIDGET_ID} .banner-widget-reco { min-width: 0; }
            #${WIDGET_ID} .swiper { overflow: hidden; }
            #${WIDGET_ID} .reco-product-card {
                background: var(--color-warm-white, #FEFCF9);
                border: 1px solid rgba(166, 144, 128, 0.2);
                border-radius: 12px;
                overflow: hidden;
                height: 100%;
                display: flex;
                flex-direction: column;
            }
            #${WIDGET_ID} .reco-product-image {
                display: block;
                aspect-ratio: 1 / 1;
                overflow: hidden;
                background: #fff;
            }
            #${WIDGET_ID} .reco-product-image img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            #${WIDGET_ID} .reco-product-body {
                padding: 1rem;
                display: flex;
                flex-direction: column;
                flex: 1;
                gap: 0.5rem;
            }
            #${WIDGET_ID} .reco-product-brand {
                font-size: 0.72rem;
                letter-spacing: 0.12em;
                text-transform: uppercase;
                color: var(--color-taupe, #7A8492);
            }
            #${WIDGET_ID} .reco-product-name {
                font-family: var(--font-display, 'Barlow Condensed', Georgia, serif);
                font-size: 1.05rem;
                font-weight: 500;
                line-height: 1.3;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
                text-overflow: ellipsis;
                min-height: calc(1.3em * 2);
            }
            #${WIDGET_ID} .reco-product-name-link {
                color: inherit;
                text-decoration: none;
                transition: color 0.2s ease;
            }
            #${WIDGET_ID} .reco-product-name-link:hover {
                color: var(--color-gold-dark, #35015F);
            }
            #${WIDGET_ID} .reco-product-image { display: block; }
            #${WIDGET_ID} .reco-product-price {
                font-weight: 600;
                color: var(--color-gold-dark, #35015F);
            }
            #${WIDGET_ID} .reco-product-old-price {
                margin-left: 0.5rem;
                font-size: 0.85rem;
                color: var(--color-taupe, #7A8492);
                text-decoration: line-through;
            }
            #${WIDGET_ID} .reco-product-cart-btn {
                margin-top: auto;
                width: 100%;
                border: none;
                border-radius: 8px;
                padding: 0.7rem 1rem;
                background: var(--color-gold-dark, #35015F);
                color: #fff;
                font-size: 0.85rem;
                font-weight: 600;
                text-transform: uppercase;
                cursor: pointer;
            }
            #${WIDGET_ID} .reco-product-cart-btn:disabled { opacity: 0.55; cursor: not-allowed; }

            @media (max-width: 992px) {
                #${WIDGET_ID} .banner-widget-body { grid-template-columns: 1fr; }
                #${WIDGET_ID} .banner-widget-banner { min-height: 280px; }
                #${WIDGET_ID} .banner-widget-nav {
                    position: static;
                    transform: none;
                    justify-content: center;
                    margin-top: 1rem;
                    width: 100%;
                }
                #${WIDGET_ID} .banner-widget-header { flex-direction: column; align-items: center; }
            }
        `;
        document.head.appendChild(style);
    }

    function loadSwiper(onReady) {
        if (!document.querySelector('link[href*="swiper"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'vendor/swiper-bundle.min.css';
            document.head.appendChild(link);
        }
        if (typeof Swiper !== 'undefined') {
            onReady();
            return;
        }
        const script = document.createElement('script');
        script.src = 'vendor/swiper-bundle.min.js';
        script.onload = onReady;
        document.head.appendChild(script);
    }

    function loadProducts(onReady) {
        cantuLoadProducts(WIDGET_ID, PRODUCTS_URL, onReady, 'BannerWidget');
    }

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    function formatPrice(value, currency) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: currency || 'BRL'
        }).format(Number(value) || 0);
    }

    function shuffleArray(items) {
        const list = items.slice();
        for (let i = list.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [list[i], list[j]] = [list[j], list[i]];
        }
        return list;
    }

    function buildProductCard(product) {
        const image = Array.isArray(product.image) ? product.image[0] : product.image;
        const oldPrice = Number(product.oldPrice) > Number(product.price)
            ? `<span class="reco-product-old-price">${formatPrice(product.oldPrice, product.currency)}</span>`
            : '';

        return `
            <div class="swiper-slide">
                <article class="reco-product-card">
                    <a href="product.html?id=${encodeURIComponent(product.id)}" class="reco-product-image">
                        <img src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" loading="lazy">
                    </a>
                    <div class="reco-product-body">
                        <p class="reco-product-brand">${escapeHtml(product.brand)}</p>
                        <h3 class="reco-product-name"><a class="reco-product-name-link" href="product.html?id=${encodeURIComponent(product.id)}">${escapeHtml(product.name)}</a></h3>
                        <p class="reco-product-price">${formatPrice(product.price, product.currency)} ${oldPrice}</p>
                        <button class="reco-product-cart-btn" type="button" data-cart-add
                            data-product-id="${escapeHtml(product.id)}"
                            data-product-variant-id="${escapeHtml(product.id)}"
                            data-product-name="${escapeHtml(product.name)}"
                            data-product-price="${escapeHtml(product.price)}"
                            data-product-old-price="${escapeHtml(product.oldPrice || '')}"
                            data-product-currency="${escapeHtml(product.currency || 'BRL')}"
                            data-product-image="${escapeHtml(image)}"
                            data-product-category="${escapeHtml(product.category)}"
                            ${product.availability ? '' : 'disabled'}
                        >${product.availability ? 'Add to cart' : 'Out of stock'}</button>
                    </div>
                </article>
            </div>
        `;
    }

    function bindCartButtons(root) {
        if (!window.CantuCart || !root) return;
        root.querySelectorAll('[data-cart-add]:not([data-reco-bound])').forEach((btn) => {
            btn.dataset.recoBound = 'true';
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                window.CantuCart.addItem({
                    id: btn.dataset.productId,
                    name: btn.dataset.productName,
                    price: btn.dataset.productPrice,
                    currency: btn.dataset.productCurrency || 'BRL',
                    image: btn.dataset.productImage,
                    category: btn.dataset.productCategory
                });
                window.dispatchEvent(new CustomEvent('cantupneus:cart:updated'));
                const toast = document.getElementById('loginSuccessMessage');
                if (toast) {
                    toast.textContent = 'Added to cart.';
                    toast.classList.add('active');
                    clearTimeout(window.dPneusToastTimer);
                    window.dPneusToastTimer = setTimeout(() => toast.classList.remove('active'), 2000);
                }
            });
        });
    }

    function render(products) {
        const selected = shuffleArray(products).slice(0, 12);
        if (selected.length < 4) return;

        const bannerProduct = selected[0];
        const recoProducts = selected.slice(1);
        const bannerImage = Array.isArray(bannerProduct.image) ? bannerProduct.image[0] : bannerProduct.image;

        const widget = document.createElement('section');
        widget.className = 'reco-widget';
        widget.id = WIDGET_ID;
        widget.innerHTML = `
            <div class="container">
                <div class="banner-widget-header">
                    <div class="banner-widget-heading">
                        <p class="text-label">Advisor's pick</p>
                        <h2 class="banner-widget-title">Recommended for you</h2>
                        <p class="banner-widget-subtitle">Tires recommended for your operating profile</p>
                    </div>
                    <div class="banner-widget-nav">
                        <button class="banner-nav-btn swiper-button-prev swiper-button-prev-${SWIPER_CLASS}" type="button" aria-label="Previous">
                            <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2"/></svg>
                        </button>
                        <button class="banner-nav-btn swiper-button-next swiper-button-next-${SWIPER_CLASS}" type="button" aria-label="Next">
                            <svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" fill="none" stroke="currentColor" stroke-width="2"/></svg>
                        </button>
                    </div>
                </div>
                <div class="banner-widget-body">
                    <aside class="banner-widget-banner">
                        <img src="${escapeHtml(bannerImage)}" alt="${escapeHtml(bannerProduct.name)}" loading="lazy">
                        <div class="banner-widget-banner-overlay">
                            <p class="banner-widget-banner-label">Expert pick</p>
                            <h3 class="banner-widget-banner-title">${escapeHtml(bannerProduct.name)}</h3>
                            <a href="#collections" class="banner-widget-banner-link">View the full line</a>
                        </div>
                    </aside>
                    <div class="banner-widget-reco">
                        <div class="swiper ${SWIPER_CLASS}">
                            <div class="swiper-wrapper">${recoProducts.map(buildProductCard).join('')}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        if (!mountWidget(widget)) return;

        new Swiper(`#${WIDGET_ID} .${SWIPER_CLASS}`, {
            slidesPerView: 3,
            slidesPerGroup: 1,
            spaceBetween: 20,
            speed: 600,
            loop: recoProducts.length > 3,
            grabCursor: true,
            navigation: {
                nextEl: `#${WIDGET_ID} .swiper-button-next-${SWIPER_CLASS}`,
                prevEl: `#${WIDGET_ID} .swiper-button-prev-${SWIPER_CLASS}`
            },
            breakpoints: {
                0: { slidesPerView: 1.1, spaceBetween: 14 },
                576: { slidesPerView: 2, spaceBetween: 16 },
                992: { slidesPerView: 3, spaceBetween: 20 }
            }
        });

        bindCartButtons(widget);
    }

    injectStyles();
    loadSwiper(() => loadProducts(render));
}


function TabWidget() {
    const PRODUCTS_URL = 'cantu_prod_example.json';
    const WIDGET_ID = 'tabWidget';
    const SWIPER_CLASS = 'tabWidgetSwiper';

    /* match is tested against the feed's category path, for example
       "Tires > Truck > Lug". Keep these in step with
       cantu_prod_example.json or a tab renders empty. */
    const CATEGORIES = [
        { id: 'carga', label: 'Truck', match: '> Truck >' },
        { id: 'passeio', label: 'Passenger', match: '> Passenger >' },
        { id: 'agricola', label: 'Agricultural', match: '> Agricultural >' },
        { id: 'industrial', label: 'Industrial & OTR', match: '> Industrial & OTR >' }
    ];

    function mountWidget(widgetEl) {
        const bannerEl = document.getElementById('bannerWidget');
        if (bannerEl) {
            bannerEl.insertAdjacentElement('afterend', widgetEl);
            return true;
        }
        const classicEl = document.getElementById('classicWidget');
        if (classicEl) {
            classicEl.insertAdjacentElement('afterend', widgetEl);
            return true;
        }
        const collections = document.querySelector('.collections');
        if (!collections) {
            console.warn('TabWidget: anchor not found');
            return false;
        }
        collections.insertAdjacentElement('beforebegin', widgetEl);
        return true;
    }

    function injectStyles() {
        if (document.getElementById('tab-widget-styles')) return;

        const style = document.createElement('style');
        style.id = 'tab-widget-styles';
        style.textContent = `
            #${WIDGET_ID} {
                padding: var(--space-xl, 6rem) 0;
                background: var(--color-ivory, #EDE9F5);
            }
            #${WIDGET_ID} .tab-widget-header {
                display: flex;
                align-items: center;
                justify-content: center;
                margin-bottom: 1.25rem;
            }
            #${WIDGET_ID} .tab-widget-heading {
                text-align: center;
                max-width: 640px;
            }
            #${WIDGET_ID} .tab-widget-title {
                font-family: var(--font-display, 'Barlow Condensed', Georgia, serif);
                font-size: clamp(2rem, 4vw, 2.75rem);
                font-weight: 300;
                color: var(--color-charcoal, #1A1030);
                line-height: 1.1;
            }
            #${WIDGET_ID} .tab-widget-subtitle {
                margin-top: 0.5rem;
                color: var(--color-taupe, #7A8492);
                font-size: 1rem;
            }
            #${WIDGET_ID} .tab-slider-shell {
                display: flex;
                align-items: center;
                gap: 1rem;
            }
            #${WIDGET_ID} .tab-slider-shell .swiper {
                flex: 1;
                min-width: 0;
                overflow: hidden;
            }
            #${WIDGET_ID} .tab-nav-btn {
                --swiper-navigation-size: 48px;
                width: 48px !important;
                height: 48px !important;
                position: relative !important;
                top: auto !important;
                left: auto !important;
                right: auto !important;
                bottom: auto !important;
                margin: 0 !important;
                border: 1px solid var(--color-gold-light, #4E018F);
                border-radius: 50%;
                background: #fff;
                color: var(--color-gold, #4E018F);
                cursor: pointer;
                display: inline-flex !important;
                align-items: center;
                justify-content: center;
                box-shadow: 0 4px 14px rgba(28, 28, 28, 0.08);
            }
            #${WIDGET_ID} .tab-nav-btn:hover {
                background: var(--color-gold-dark, #35015F);
                border-color: var(--color-gold-dark, #35015F);
                color: #fff;
            }
            #${WIDGET_ID} .tab-nav-btn::after { display: none !important; content: none !important; }
            #${WIDGET_ID} .tab-nav-btn svg {
                width: 22px; height: 22px;
                stroke: var(--color-gold, #4E018F);
                fill: none; stroke-width: 2.25;
                pointer-events: none;
            }
            #${WIDGET_ID} .tab-nav-btn:hover svg { stroke: #fff; }
            #${WIDGET_ID} .tab-widget-tabs {
                display: flex;
                flex-wrap: wrap;
                justify-content: center;
                gap: 0.65rem;
                margin-bottom: var(--space-md, 2rem);
            }
            #${WIDGET_ID} .tab-widget-tab {
                border: 1px solid rgba(184, 134, 11, 0.35);
                border-radius: 999px;
                padding: 0.55rem 1.25rem;
                background: #fff;
                color: var(--color-charcoal-soft, #3A3A3A);
                font-size: 0.82rem;
                font-weight: 600;
                letter-spacing: 0.06em;
                text-transform: uppercase;
                cursor: pointer;
                transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
            }
            #${WIDGET_ID} .tab-widget-tab:hover {
                border-color: var(--color-gold, #4E018F);
                color: var(--color-gold-dark, #35015F);
            }
            #${WIDGET_ID} .tab-widget-tab.active {
                background: var(--color-gold-dark, #35015F);
                border-color: var(--color-gold-dark, #35015F);
                color: #fff;
            }
            #${WIDGET_ID} .tab-widget-panel { min-width: 0; }
            #${WIDGET_ID} .swiper { overflow: hidden; }
            #${WIDGET_ID} .reco-product-card {
                background: var(--color-warm-white, #FEFCF9);
                border: 1px solid rgba(166, 144, 128, 0.2);
                border-radius: 12px;
                overflow: hidden;
                height: 100%;
                display: flex;
                flex-direction: column;
            }
            #${WIDGET_ID} .reco-product-image {
                display: block;
                aspect-ratio: 4 / 5;
                overflow: hidden;
                background: #fff;
            }
            #${WIDGET_ID} .reco-product-image img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            #${WIDGET_ID} .reco-product-body {
                padding: 1rem;
                display: flex;
                flex-direction: column;
                flex: 1;
                gap: 0.5rem;
            }
            #${WIDGET_ID} .reco-product-brand {
                font-size: 0.72rem;
                letter-spacing: 0.12em;
                text-transform: uppercase;
                color: var(--color-taupe, #7A8492);
            }
            #${WIDGET_ID} .reco-product-name {
                font-family: var(--font-display, 'Barlow Condensed', Georgia, serif);
                font-size: 1.15rem;
                font-weight: 500;
                line-height: 1.3;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
                text-overflow: ellipsis;
                min-height: calc(1.3em * 2);
            }
            #${WIDGET_ID} .reco-product-name-link {
                color: inherit;
                text-decoration: none;
                transition: color 0.2s ease;
            }
            #${WIDGET_ID} .reco-product-name-link:hover {
                color: var(--color-gold-dark, #35015F);
            }
            #${WIDGET_ID} .reco-product-image { display: block; }
            #${WIDGET_ID} .reco-product-price {
                font-weight: 600;
                color: var(--color-gold-dark, #35015F);
            }
            #${WIDGET_ID} .reco-product-old-price {
                margin-left: 0.5rem;
                font-size: 0.85rem;
                color: var(--color-taupe, #7A8492);
                text-decoration: line-through;
            }
            #${WIDGET_ID} .reco-product-cart-btn {
                margin-top: auto;
                width: 100%;
                border: none;
                border-radius: 8px;
                padding: 0.7rem 1rem;
                background: var(--color-gold-dark, #35015F);
                color: #fff;
                font-size: 0.85rem;
                font-weight: 600;
                text-transform: uppercase;
                cursor: pointer;
            }
            #${WIDGET_ID} .reco-product-cart-btn:disabled { opacity: 0.55; cursor: not-allowed; }

            @media (max-width: 768px) {
                #${WIDGET_ID} .tab-slider-shell { gap: 0.5rem; }
                #${WIDGET_ID} .tab-nav-btn { width: 40px !important; height: 40px !important; }
                #${WIDGET_ID} .tab-nav-btn svg { width: 18px; height: 18px; }
            }
        `;
        document.head.appendChild(style);
    }

    function loadSwiper(onReady) {
        if (!document.querySelector('link[href*="swiper"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'vendor/swiper-bundle.min.css';
            document.head.appendChild(link);
        }
        if (typeof Swiper !== 'undefined') {
            onReady();
            return;
        }
        const script = document.createElement('script');
        script.src = 'vendor/swiper-bundle.min.js';
        script.onload = onReady;
        document.head.appendChild(script);
    }

    function loadProducts(onReady) {
        cantuLoadProducts(WIDGET_ID, PRODUCTS_URL, onReady, 'TabWidget');
    }

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    function formatPrice(value, currency) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: currency || 'BRL'
        }).format(Number(value) || 0);
    }

    function buildProductCard(product) {
        const image = Array.isArray(product.image) ? product.image[0] : product.image;
        const oldPrice = Number(product.oldPrice) > Number(product.price)
            ? `<span class="reco-product-old-price">${formatPrice(product.oldPrice, product.currency)}</span>`
            : '';

        return `
            <div class="swiper-slide">
                <article class="reco-product-card">
                    <a href="product.html?id=${encodeURIComponent(product.id)}" class="reco-product-image">
                        <img src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" loading="lazy">
                    </a>
                    <div class="reco-product-body">
                        <p class="reco-product-brand">${escapeHtml(product.brand)}</p>
                        <h3 class="reco-product-name"><a class="reco-product-name-link" href="product.html?id=${encodeURIComponent(product.id)}">${escapeHtml(product.name)}</a></h3>
                        <p class="reco-product-price">${formatPrice(product.price, product.currency)} ${oldPrice}</p>
                        <button class="reco-product-cart-btn" type="button" data-cart-add
                            data-product-id="${escapeHtml(product.id)}"
                            data-product-variant-id="${escapeHtml(product.id)}"
                            data-product-name="${escapeHtml(product.name)}"
                            data-product-price="${escapeHtml(product.price)}"
                            data-product-old-price="${escapeHtml(product.oldPrice || '')}"
                            data-product-currency="${escapeHtml(product.currency || 'BRL')}"
                            data-product-image="${escapeHtml(image)}"
                            data-product-category="${escapeHtml(product.category)}"
                            ${product.availability ? '' : 'disabled'}
                        >${product.availability ? 'Add to cart' : 'Out of stock'}</button>
                    </div>
                </article>
            </div>
        `;
    }

    function bindCartButtons(root) {
        if (!window.CantuCart || !root) return;
        root.querySelectorAll('[data-cart-add]:not([data-reco-bound])').forEach((btn) => {
            btn.dataset.recoBound = 'true';
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                window.CantuCart.addItem({
                    id: btn.dataset.productId,
                    name: btn.dataset.productName,
                    price: btn.dataset.productPrice,
                    currency: btn.dataset.productCurrency || 'BRL',
                    image: btn.dataset.productImage,
                    category: btn.dataset.productCategory
                });
                window.dispatchEvent(new CustomEvent('cantupneus:cart:updated'));
                const toast = document.getElementById('loginSuccessMessage');
                if (toast) {
                    toast.textContent = 'Added to cart.';
                    toast.classList.add('active');
                    clearTimeout(window.dPneusToastTimer);
                    window.dPneusToastTimer = setTimeout(() => toast.classList.remove('active'), 2000);
                }
            });
        });
    }

    function render(products) {
        const byCategory = {};
        CATEGORIES.forEach((cat) => {
            byCategory[cat.id] = products
                .filter((p) => String(p.category || '').includes(cat.match))
                .slice(0, 10);
        });

        const firstCat = CATEGORIES.find((cat) => byCategory[cat.id].length) || CATEGORIES[0];
        const initial = byCategory[firstCat.id] || [];
        if (!initial.length) return;

        const widget = document.createElement('section');
        widget.className = 'reco-widget';
        widget.id = WIDGET_ID;
        widget.innerHTML = `
            <div class="container">
                <div class="tab-widget-header">
                    <div class="tab-widget-heading">
                        <p class="text-label">Em alta agora</p>
                        <h2 class="tab-widget-title">Category bestsellers</h2>
                        <p class="tab-widget-subtitle">The fastest-moving sizes in the most requested lines</p>
                    </div>
                </div>
                <div class="tab-widget-tabs" role="tablist">
                    ${CATEGORIES.map((cat) => `
                        <button type="button"
                            class="tab-widget-tab${cat.id === firstCat.id ? ' active' : ''}"
                            role="tab"
                            aria-selected="${cat.id === firstCat.id}"
                            data-tab="${cat.id}"
                        >${cat.label}</button>
                    `).join('')}
                </div>
                <div class="tab-widget-panel">
                    <div class="tab-slider-shell">
                        <button class="tab-nav-btn swiper-button-prev swiper-button-prev-${SWIPER_CLASS}" type="button" aria-label="Previous">
                            <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2"/></svg>
                        </button>
                        <div class="swiper ${SWIPER_CLASS}">
                            <div class="swiper-wrapper">${initial.map(buildProductCard).join('')}</div>
                        </div>
                        <button class="tab-nav-btn swiper-button-next swiper-button-next-${SWIPER_CLASS}" type="button" aria-label="Next">
                            <svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" fill="none" stroke="currentColor" stroke-width="2"/></svg>
                        </button>
                    </div>
                </div>
            </div>
        `;

        if (!mountWidget(widget)) return;

        let swiperInstance = null;

        function getOptions(itemCount) {
            return {
                slidesPerView: 4,
                slidesPerGroup: 1,
                spaceBetween: 20,
                speed: 600,
                loop: itemCount > 4,
                grabCursor: true,
                navigation: {
                    nextEl: `#${WIDGET_ID} .swiper-button-next-${SWIPER_CLASS}`,
                    prevEl: `#${WIDGET_ID} .swiper-button-prev-${SWIPER_CLASS}`
                },
                breakpoints: {
                    0: { slidesPerView: 1.15, spaceBetween: 14 },
                    576: { slidesPerView: 2, spaceBetween: 16 },
                    768: { slidesPerView: 3, spaceBetween: 18 },
                    1200: { slidesPerView: 4, spaceBetween: 20 }
                }
            };
        }

        function mountSwiper(itemCount) {
            if (swiperInstance) swiperInstance.destroy(true, true);
            swiperInstance = new Swiper(`#${WIDGET_ID} .${SWIPER_CLASS}`, getOptions(itemCount));
        }

        mountSwiper(initial.length);
        bindCartButtons(widget);

        widget.querySelectorAll('[data-tab]').forEach((tab) => {
            tab.addEventListener('click', () => {
                const categoryId = tab.dataset.tab;
                const list = byCategory[categoryId] || [];
                if (!list.length) return;

                widget.querySelectorAll('[data-tab]').forEach((btn) => {
                    const isActive = btn.dataset.tab === categoryId;
                    btn.classList.toggle('active', isActive);
                    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
                });

                const wrapper = widget.querySelector(`.${SWIPER_CLASS} .swiper-wrapper`);
                wrapper.innerHTML = list.map(buildProductCard).join('');
                mountSwiper(list.length);
                bindCartButtons(widget);
            });
        });
    }

    injectStyles();
    loadSwiper(() => loadProducts(render));
}




function SideBarWidget() {
    const PRODUCTS_URL = 'cantu_prod_example.json';
    const WIDGET_ID = 'mostViewedWidget';

    function injectStyles() {
        if (document.getElementById('most-viewed-widget-styles')) return;

        const style = document.createElement('style');
        style.id = 'most-viewed-widget-styles';
        style.textContent = `
            #${WIDGET_ID} {
                position: fixed;
                top: 50%;
                right: 0;
                transform: translateY(-50%);
                z-index: 9998;
                display: flex;
                align-items: stretch;
                font-family: var(--font-body, 'Inter', sans-serif);
                transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
            }
            #${WIDGET_ID}.closed {
                transform: translateY(-50%) translateX(calc(100% - 44px));
            }
            #${WIDGET_ID} .mv-tab {
                writing-mode: vertical-rl;
                text-orientation: mixed;
                background: var(--color-gold-dark, #35015F);
                color: #fff;
                padding: 20px 12px;
                border-radius: 12px 0 0 12px;
                border: none;
                cursor: pointer;
                font-size: 13px;
                font-weight: 600;
                letter-spacing: 1.4px;
                text-transform: uppercase;
                display: flex;
                align-items: center;
                gap: 10px;
                box-shadow: -4px 4px 16px rgba(28, 28, 28, 0.18);
                white-space: nowrap;
                transition: background 0.2s ease;
            }
            #${WIDGET_ID} .mv-tab:hover {
                background: var(--color-gold, #4E018F);
            }
            #${WIDGET_ID} .mv-tab-icon {
                font-size: 14px;
                line-height: 1;
                transform: rotate(90deg);
                display: inline-block;
                transition: transform 0.3s ease;
            }
            #${WIDGET_ID}.closed .mv-tab-icon {
                transform: rotate(-90deg);
            }
            #${WIDGET_ID} .mv-panel {
                width: 300px;
                background: var(--color-warm-white, #FEFCF9);
                border: 1px solid rgba(184, 134, 11, 0.25);
                border-right: none;
                border-radius: 14px 0 0 14px;
                box-shadow: -8px 8px 28px rgba(28, 28, 28, 0.18);
                padding: 1.25rem 1rem;
                display: flex;
                flex-direction: column;
                gap: 1rem;
            }
            #${WIDGET_ID} .mv-panel-title {
                font-family: var(--font-display, 'Barlow Condensed', Georgia, serif);
                font-size: 1.4rem;
                font-weight: 500;
                color: var(--color-charcoal, #1A1030);
                line-height: 1.2;
                margin: 0;
            }
            #${WIDGET_ID} .mv-panel-subtitle {
                font-size: 0.72rem;
                letter-spacing: 0.14em;
                text-transform: uppercase;
                color: var(--color-taupe, #7A8492);
                margin: -0.35rem 0 0;
            }
            #${WIDGET_ID} .mv-list {
                display: flex;
                flex-direction: column;
                gap: 0.85rem;
            }
            #${WIDGET_ID} .mv-card {
                display: grid;
                grid-template-columns: 80px 1fr;
                gap: 0.75rem;
                align-items: center;
                background: #fff;
                border: 1px solid rgba(166, 144, 128, 0.2);
                border-radius: 10px;
                overflow: hidden;
                padding: 0.5rem;
                transition: border-color 0.2s ease, box-shadow 0.2s ease;
            }
            #${WIDGET_ID} .mv-card:hover {
                border-color: var(--color-gold-light, #4E018F);
                box-shadow: 0 6px 16px rgba(28, 28, 28, 0.08);
            }
            #${WIDGET_ID} .mv-card-image {
                width: 80px;
                height: 80px;
                border-radius: 8px;
                overflow: hidden;
                background: #ede9f5;
            }
            #${WIDGET_ID} .mv-card-image img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            #${WIDGET_ID} .mv-card-body {
                display: flex;
                flex-direction: column;
                gap: 0.25rem;
                min-width: 0;
            }
            #${WIDGET_ID} .mv-card-brand {
                font-size: 0.65rem;
                letter-spacing: 0.12em;
                text-transform: uppercase;
                color: var(--color-taupe, #7A8492);
            }
            #${WIDGET_ID} .mv-card-name {
                font-family: var(--font-display, 'Barlow Condensed', Georgia, serif);
                font-size: 0.95rem;
                font-weight: 500;
                color: var(--color-charcoal, #1A1030);
                line-height: 1.25;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            #${WIDGET_ID} .mv-card-name-link {
                color: inherit;
                text-decoration: none;
                transition: color 0.2s ease;
            }
            #${WIDGET_ID} .mv-card-name-link:hover {
                color: var(--color-gold-dark, #35015F);
            }
            #${WIDGET_ID} .mv-card-image { display: block; }
            #${WIDGET_ID} .mv-card-price {
                font-size: 0.85rem;
                font-weight: 600;
                color: var(--color-gold-dark, #35015F);
            }
            #${WIDGET_ID} .mv-card-cart {
                margin-top: 0.35rem;
                width: 100%;
                border: none;
                border-radius: 6px;
                padding: 0.45rem 0.5rem;
                background: var(--color-gold-dark, #35015F);
                color: #fff;
                font-size: 0.7rem;
                font-weight: 600;
                letter-spacing: 0.06em;
                text-transform: uppercase;
                cursor: pointer;
                transition: background 0.2s ease;
            }
            #${WIDGET_ID} .mv-card-cart:hover {
                background: var(--color-gold, #4E018F);
            }
            #${WIDGET_ID} .mv-card-cart:disabled {
                opacity: 0.55;
                cursor: not-allowed;
            }

            @media (max-width: 768px) {
                #${WIDGET_ID} .mv-panel { width: 260px; }
                #${WIDGET_ID} .mv-card-image { width: 64px; height: 64px; }
                #${WIDGET_ID} .mv-card { grid-template-columns: 64px 1fr; }
            }
        `;
        document.head.appendChild(style);
    }

    function loadProducts(onReady) {
        cantuLoadProducts(WIDGET_ID, PRODUCTS_URL, onReady, 'MostViewedWidget');
    }

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    function formatPrice(value, currency) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: currency || 'BRL'
        }).format(Number(value) || 0);
    }

    function shuffleArray(items) {
        const list = items.slice();
        for (let i = list.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [list[i], list[j]] = [list[j], list[i]];
        }
        return list;
    }

    function buildCard(product) {
        const image = Array.isArray(product.image) ? product.image[0] : product.image;
        return `
            <article class="mv-card">
                <a href="product.html?id=${encodeURIComponent(product.id)}" class="mv-card-image" aria-label="${escapeHtml(product.name)}">
                    <img src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" loading="lazy">
                </a>
                <div class="mv-card-body">
                    <p class="mv-card-brand">${escapeHtml(product.brand)}</p>
                    <h4 class="mv-card-name"><a class="mv-card-name-link" href="product.html?id=${encodeURIComponent(product.id)}">${escapeHtml(product.name)}</a></h4>
                    <p class="mv-card-price">${formatPrice(product.price, product.currency)}</p>
                    <button class="mv-card-cart" type="button" data-cart-add
                        data-product-id="${escapeHtml(product.id)}"
                        data-product-variant-id="${escapeHtml(product.id)}"
                        data-product-name="${escapeHtml(product.name)}"
                        data-product-price="${escapeHtml(product.price)}"
                        data-product-old-price="${escapeHtml(product.oldPrice || '')}"
                        data-product-currency="${escapeHtml(product.currency || 'BRL')}"
                        data-product-image="${escapeHtml(image)}"
                        data-product-category="${escapeHtml(product.category)}"
                        ${product.availability ? '' : 'disabled'}
                    >${product.availability ? 'Add to cart' : 'Out of stock'}</button>
                </div>
            </article>
        `;
    }

    function bindCartButtons(root) {
        if (!window.CantuCart || !root) return;
        root.querySelectorAll('[data-cart-add]:not([data-reco-bound])').forEach((btn) => {
            btn.dataset.recoBound = 'true';
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.CantuCart.addItem({
                    id: btn.dataset.productId,
                    name: btn.dataset.productName,
                    price: btn.dataset.productPrice,
                    currency: btn.dataset.productCurrency || 'BRL',
                    image: btn.dataset.productImage,
                    category: btn.dataset.productCategory
                });
                window.dispatchEvent(new CustomEvent('cantupneus:cart:updated'));
                const toast = document.getElementById('loginSuccessMessage');
                if (toast) {
                    toast.textContent = 'Added to cart.';
                    toast.classList.add('active');
                    clearTimeout(window.dPneusToastTimer);
                    window.dPneusToastTimer = setTimeout(() => toast.classList.remove('active'), 2000);
                }
            });
        });
    }

    function render(products) {
        const selected = shuffleArray(products).slice(0, 2);
        if (selected.length < 2) return;

        const widget = document.createElement('aside');
        widget.id = WIDGET_ID;
        widget.className = 'closed';
        widget.innerHTML = `
            <button class="mv-tab" type="button" aria-label="Open and close Most Viewed">
                <span class="mv-tab-icon">›</span>
                <span>Most viewed</span>
            </button>
            <div class="mv-panel">
                <p class="mv-panel-subtitle">Trending</p>
                <h3 class="mv-panel-title">Most viewed</h3>
                <div class="mv-list">
                    ${selected.map(buildCard).join('')}
                </div>
            </div>
        `;

        document.body.appendChild(widget);

        const tabBtn = widget.querySelector('.mv-tab');
        tabBtn.addEventListener('click', () => {
            widget.classList.toggle('closed');
        });

        bindCartButtons(widget);
    }

    injectStyles();
    loadProducts(render);
}





function PopupWidget() {
    const PRODUCTS_URL = 'cantu_prod_example.json';
    const WIDGET_ID = 'popupWidget';
    const SWIPER_CLASS = 'popupWidgetSwiper';
    const OPEN_DELAY = 2000;

    function injectStyles() {
        if (document.getElementById('popup-widget-styles')) return;

        const style = document.createElement('style');
        style.id = 'popup-widget-styles';
        style.textContent = `
            #${WIDGET_ID}-overlay {
                position: fixed;
                inset: 0;
                background: rgba(28, 28, 28, 0.55);
                backdrop-filter: blur(3px);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 1.25rem;
                opacity: 0;
                visibility: hidden;
                transition: opacity 0.3s ease, visibility 0.3s ease;
            }
            #${WIDGET_ID}-overlay.active {
                opacity: 1;
                visibility: visible;
            }
            #${WIDGET_ID} {
                position: relative;
                width: min(960px, 100%);
                max-height: 90vh;
                overflow-y: auto;
                background: var(--color-cream, #F6F4FA);
                border-radius: 18px;
                box-shadow: 0 30px 60px rgba(28, 28, 28, 0.35);
                padding: 2rem 2rem 2.5rem;
                transform: translateY(20px) scale(0.97);
                transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
                font-family: var(--font-body, 'Inter', sans-serif);
            }
            #${WIDGET_ID}-overlay.active #${WIDGET_ID} {
                transform: translateY(0) scale(1);
            }
            #${WIDGET_ID} .popup-close {
                position: absolute;
                top: 0.85rem;
                right: 0.85rem;
                width: 36px;
                height: 36px;
                border-radius: 50%;
                border: 1px solid rgba(184, 134, 11, 0.35);
                background: #fff;
                color: var(--color-charcoal, #1A1030);
                font-size: 20px;
                line-height: 1;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
            }
            #${WIDGET_ID} .popup-close:hover {
                background: var(--color-gold-dark, #35015F);
                border-color: var(--color-gold-dark, #35015F);
                color: #fff;
            }
            #${WIDGET_ID} .popup-header {
                text-align: center;
                margin-bottom: 1.5rem;
            }
            #${WIDGET_ID} .popup-label {
                font-size: 0.72rem;
                letter-spacing: 0.18em;
                text-transform: uppercase;
                color: var(--color-taupe, #7A8492);
                margin-bottom: 0.45rem;
            }
            #${WIDGET_ID} .popup-title {
                font-family: var(--font-display, 'Barlow Condensed', Georgia, serif);
                font-size: clamp(1.8rem, 3vw, 2.4rem);
                font-weight: 300;
                line-height: 1.1;
                color: var(--color-charcoal, #1A1030);
                margin: 0;
            }
            #${WIDGET_ID} .popup-subtitle {
                margin-top: 0.5rem;
                color: var(--color-taupe, #7A8492);
                font-size: 0.95rem;
            }
            #${WIDGET_ID} .popup-slider-shell {
                display: flex;
                align-items: center;
                gap: 0.85rem;
            }
            #${WIDGET_ID} .popup-slider-shell .swiper {
                flex: 1;
                min-width: 0;
                overflow: hidden;
            }
            #${WIDGET_ID} .popup-nav-btn {
                --swiper-navigation-size: 44px;
                width: 44px !important;
                height: 44px !important;
                position: relative !important;
                top: auto !important;
                left: auto !important;
                right: auto !important;
                bottom: auto !important;
                margin: 0 !important;
                border: 1px solid var(--color-gold-light, #4E018F);
                border-radius: 50%;
                background: #fff;
                color: var(--color-gold, #4E018F);
                cursor: pointer;
                display: inline-flex !important;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                box-shadow: 0 4px 14px rgba(28, 28, 28, 0.08);
            }
            #${WIDGET_ID} .popup-nav-btn:hover {
                background: var(--color-gold-dark, #35015F);
                border-color: var(--color-gold-dark, #35015F);
                color: #fff;
            }
            #${WIDGET_ID} .popup-nav-btn::after { display: none !important; content: none !important; }
            #${WIDGET_ID} .popup-nav-btn svg {
                width: 20px; height: 20px;
                stroke: var(--color-gold, #4E018F);
                fill: none; stroke-width: 2.25;
                pointer-events: none;
            }
            #${WIDGET_ID} .popup-nav-btn:hover svg { stroke: #fff; }
            #${WIDGET_ID} .popup-pagination {
                position: static !important;
                width: auto !important;
                margin-top: 1.25rem;
                display: flex !important;
                justify-content: center;
                gap: 8px;
            }
            #${WIDGET_ID} .popup-pagination .swiper-pagination-bullet {
                width: 9px;
                height: 9px;
                margin: 0 !important;
                background: rgba(184, 134, 11, 0.35);
                opacity: 1;
            }
            #${WIDGET_ID} .popup-pagination .swiper-pagination-bullet-active {
                background: var(--color-gold-dark, #35015F);
                transform: scale(1.2);
            }
            #${WIDGET_ID} .popup-card {
                background: #fff;
                border: 1px solid rgba(166, 144, 128, 0.2);
                border-radius: 12px;
                overflow: hidden;
                height: 100%;
                display: flex;
                flex-direction: column;
            }
            #${WIDGET_ID} .popup-card-image {
                display: block;
                aspect-ratio: 1 / 1;
                overflow: hidden;
                background: #ede9f5;
            }
            #${WIDGET_ID} .popup-card-image img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            #${WIDGET_ID} .popup-card-body {
                padding: 0.9rem;
                display: flex;
                flex-direction: column;
                gap: 0.35rem;
                flex: 1;
            }
            #${WIDGET_ID} .popup-card-brand {
                font-size: 0.68rem;
                letter-spacing: 0.12em;
                text-transform: uppercase;
                color: var(--color-taupe, #7A8492);
            }
            #${WIDGET_ID} .popup-card-name {
                font-family: var(--font-display, 'Barlow Condensed', Georgia, serif);
                font-size: 1rem;
                font-weight: 500;
                color: var(--color-charcoal, #1A1030);
                line-height: 1.3;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
                text-overflow: ellipsis;
                min-height: calc(1.3em * 2);
            }
            #${WIDGET_ID} .popup-card-name-link {
                color: inherit;
                text-decoration: none;
                transition: color 0.2s ease;
            }
            #${WIDGET_ID} .popup-card-name-link:hover {
                color: var(--color-gold-dark, #35015F);
            }
            #${WIDGET_ID} .popup-card-image { display: block; }
            #${WIDGET_ID} .popup-card-price {
                font-size: 0.9rem;
                font-weight: 600;
                color: var(--color-gold-dark, #35015F);
            }
            #${WIDGET_ID} .popup-card-old-price {
                margin-left: 0.4rem;
                font-size: 0.78rem;
                color: var(--color-taupe, #7A8492);
                text-decoration: line-through;
            }
            #${WIDGET_ID} .popup-card-cart {
                margin-top: auto;
                width: 100%;
                border: none;
                border-radius: 8px;
                padding: 0.6rem 0.75rem;
                background: var(--color-gold-dark, #35015F);
                color: #fff;
                font-size: 0.75rem;
                font-weight: 600;
                letter-spacing: 0.06em;
                text-transform: uppercase;
                cursor: pointer;
                transition: background 0.2s ease;
            }
            #${WIDGET_ID} .popup-card-cart:hover {
                background: var(--color-gold, #4E018F);
            }
            #${WIDGET_ID} .popup-card-cart:disabled {
                opacity: 0.55;
                cursor: not-allowed;
            }

            @media (max-width: 768px) {
                #${WIDGET_ID} { padding: 1.5rem 1rem 2rem; }
                #${WIDGET_ID} .popup-slider-shell { gap: 0.5rem; }
                #${WIDGET_ID} .popup-nav-btn { width: 38px !important; height: 38px !important; }
                #${WIDGET_ID} .popup-nav-btn svg { width: 16px; height: 16px; }
            }
        `;
        document.head.appendChild(style);
    }

    function loadSwiper(onReady) {
        if (!document.querySelector('link[href*="swiper"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'vendor/swiper-bundle.min.css';
            document.head.appendChild(link);
        }
        if (typeof Swiper !== 'undefined') {
            onReady();
            return;
        }
        const script = document.createElement('script');
        script.src = 'vendor/swiper-bundle.min.js';
        script.onload = onReady;
        document.head.appendChild(script);
    }

    function loadProducts(onReady) {
        cantuLoadProducts(WIDGET_ID, PRODUCTS_URL, onReady, 'PopupWidget');
    }

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    function formatPrice(value, currency) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: currency || 'BRL'
        }).format(Number(value) || 0);
    }

    function shuffleArray(items) {
        const list = items.slice();
        for (let i = list.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [list[i], list[j]] = [list[j], list[i]];
        }
        return list;
    }

    function buildCard(product) {
        const image = Array.isArray(product.image) ? product.image[0] : product.image;
        const oldPrice = Number(product.oldPrice) > Number(product.price)
            ? `<span class="popup-card-old-price">${formatPrice(product.oldPrice, product.currency)}</span>`
            : '';

        return `
            <div class="swiper-slide">
                <article class="popup-card">
                    <a href="product.html?id=${encodeURIComponent(product.id)}" class="popup-card-image">
                        <img src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" loading="lazy">
                    </a>
                    <div class="popup-card-body">
                        <p class="popup-card-brand">${escapeHtml(product.brand)}</p>
                        <h3 class="popup-card-name"><a class="popup-card-name-link" href="product.html?id=${encodeURIComponent(product.id)}">${escapeHtml(product.name)}</a></h3>
                        <p class="popup-card-price">${formatPrice(product.price, product.currency)} ${oldPrice}</p>
                        <button class="popup-card-cart" type="button" data-cart-add
                            data-product-id="${escapeHtml(product.id)}"
                            data-product-variant-id="${escapeHtml(product.id)}"
                            data-product-name="${escapeHtml(product.name)}"
                            data-product-price="${escapeHtml(product.price)}"
                            data-product-old-price="${escapeHtml(product.oldPrice || '')}"
                            data-product-currency="${escapeHtml(product.currency || 'BRL')}"
                            data-product-image="${escapeHtml(image)}"
                            data-product-category="${escapeHtml(product.category)}"
                            ${product.availability ? '' : 'disabled'}
                        >${product.availability ? 'Add to cart' : 'Out of stock'}</button>
                    </div>
                </article>
            </div>
        `;
    }

    function bindCartButtons(root) {
        if (!window.CantuCart || !root) return;
        root.querySelectorAll('[data-cart-add]:not([data-reco-bound])').forEach((btn) => {
            btn.dataset.recoBound = 'true';
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.CantuCart.addItem({
                    id: btn.dataset.productId,
                    name: btn.dataset.productName,
                    price: btn.dataset.productPrice,
                    currency: btn.dataset.productCurrency || 'BRL',
                    image: btn.dataset.productImage,
                    category: btn.dataset.productCategory
                });
                window.dispatchEvent(new CustomEvent('cantupneus:cart:updated'));
                const toast = document.getElementById('loginSuccessMessage');
                if (toast) {
                    toast.textContent = 'Added to cart.';
                    toast.classList.add('active');
                    clearTimeout(window.dPneusToastTimer);
                    window.dPneusToastTimer = setTimeout(() => toast.classList.remove('active'), 2000);
                }
            });
        });
    }

    function render(products) {
        const selected = shuffleArray(products).slice(0, 9);
        if (selected.length < 3) return;

        const overlay = document.createElement('div');
        overlay.id = `${WIDGET_ID}-overlay`;
        overlay.innerHTML = `
            <div id="${WIDGET_ID}" role="dialog" aria-modal="true" aria-labelledby="${WIDGET_ID}-title">
                <button class="popup-close" type="button" aria-label="Close">×</button>
                <div class="popup-header">
                    <p class="popup-label">Personalised for you</p>
                    <h2 class="popup-title" id="${WIDGET_ID}-title">Recommended for you</h2>
                    <p class="popup-subtitle">Sizes selected from your purchase history</p>
                </div>
                <div class="popup-slider-shell">
                    <button class="popup-nav-btn swiper-button-prev swiper-button-prev-${SWIPER_CLASS}" type="button" aria-label="Previous">
                        <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2"/></svg>
                    </button>
                    <div class="swiper ${SWIPER_CLASS}">
                        <div class="swiper-wrapper">${selected.map(buildCard).join('')}</div>
                    </div>
                    <button class="popup-nav-btn swiper-button-next swiper-button-next-${SWIPER_CLASS}" type="button" aria-label="Next">
                        <svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" fill="none" stroke="currentColor" stroke-width="2"/></svg>
                    </button>
                </div>
                <div class="swiper-pagination popup-pagination swiper-pagination-${SWIPER_CLASS}"></div>
            </div>
        `;

        document.body.appendChild(overlay);

        const widget = overlay.querySelector(`#${WIDGET_ID}`);
        const closeBtn = overlay.querySelector('.popup-close');

        function open() {
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        }

        function close() {
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        }

        closeBtn.addEventListener('click', close);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay.classList.contains('active')) close();
        });

        new Swiper(`#${WIDGET_ID} .${SWIPER_CLASS}`, {
            slidesPerView: 3,
            slidesPerGroup: 3,
            spaceBetween: 16,
            speed: 500,
            loop: false,
            grabCursor: true,
            pagination: {
                el: `#${WIDGET_ID} .swiper-pagination-${SWIPER_CLASS}`,
                clickable: true
            },
            navigation: {
                nextEl: `#${WIDGET_ID} .swiper-button-next-${SWIPER_CLASS}`,
                prevEl: `#${WIDGET_ID} .swiper-button-prev-${SWIPER_CLASS}`
            },
            breakpoints: {
                0: { slidesPerView: 1, slidesPerGroup: 1, spaceBetween: 12 },
                576: { slidesPerView: 2, slidesPerGroup: 2, spaceBetween: 14 },
                768: { slidesPerView: 3, slidesPerGroup: 3, spaceBetween: 16 }
            }
        });

        bindCartButtons(widget);

        setTimeout(open, OPEN_DELAY);
    }

    injectStyles();
    loadSwiper(() => loadProducts(render));
}



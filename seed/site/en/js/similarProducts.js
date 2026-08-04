(function () {
    const WIDGET_ID = 'similarProductsWidget';
    const SWIPER_CLASS = 'similarProductsSwiper';

    function getMountTarget() {
        return document.getElementById('productDetailPage');
    }

    function mountWidget(widgetEl) {
        const target = getMountTarget();
        if (!target) return false;

        const existing = document.getElementById(WIDGET_ID);
        if (existing) existing.remove();

        target.insertAdjacentElement('afterend', widgetEl);
        return true;
    }

    function injectStyles() {
        if (document.getElementById('similar-products-widget-styles')) return;

        const style = document.createElement('style');
        style.id = 'similar-products-widget-styles';
        style.textContent = `
            #${WIDGET_ID} {
                padding: var(--space-xl, 6rem) 0;
                background: var(--color-ivory, #F7F3ED);
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
                color: var(--color-taupe, #A69080);
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
                border: 1px solid var(--color-gold-light, #6E22B4);
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
                color: var(--color-taupe, #A69080);
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
            #${WIDGET_ID} .reco-product-price {
                font-weight: 600;
                color: var(--color-gold-dark, #35015F);
            }
            #${WIDGET_ID} .reco-product-old-price {
                margin-left: 0.5rem;
                font-size: 0.85rem;
                color: var(--color-taupe, #A69080);
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

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, function (c) {
            return ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
            })[c];
        });
    }

    function formatPrice(value, currency) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: currency || 'BRL'
        }).format(Number(value) || 0);
    }

    function buildProductCard(product) {
        const image = product.image || (Array.isArray(product.images) ? product.images[0] : '');
        const oldPrice = Number(product.oldPrice) > Number(product.price)
            ? '<span class="reco-product-old-price">' + formatPrice(product.oldPrice, product.currency) + '</span>'
            : '';
        const detailUrl = window.CantuCatalogData
            ? window.CantuCatalogData.buildProductUrl(product.id)
            : 'product.html?id=' + encodeURIComponent(product.id);

        return ''
            + '<div class="swiper-slide">'
            + '  <article class="reco-product-card">'
            + '    <a href="' + escapeHtml(detailUrl) + '" class="reco-product-image">'
            + '      <img src="' + escapeHtml(image) + '" alt="' + escapeHtml(product.name) + '" loading="lazy">'
            + '    </a>'
            + '    <div class="reco-product-body">'
            + '      <p class="reco-product-brand">' + escapeHtml(product.brand || '') + '</p>'
            + '      <h3 class="reco-product-name"><a href="' + escapeHtml(detailUrl) + '">' + escapeHtml(product.name) + '</a></h3>'
            + '      <p class="reco-product-price">' + formatPrice(product.price, product.currency) + ' ' + oldPrice + '</p>'
            + '      <button class="reco-product-cart-btn" type="button" data-cart-add'
            + '        data-product-id="' + escapeHtml(product.id) + '"'
            + '        data-product-variant-id="' + escapeHtml(product.id) + '"'
            + '        data-product-name="' + escapeHtml(product.name) + '"'
            + '        data-product-price="' + escapeHtml(product.price) + '"'
            + '        data-product-old-price="' + escapeHtml(product.oldPrice || '') + '"'
            + '        data-product-currency="' + escapeHtml(product.currency || 'BRL') + '"'
            + '        data-product-image="' + escapeHtml(image) + '"'
            + '        data-product-category="' + escapeHtml(product.category || '') + '"'
            + (product.availability ? '' : ' disabled')
            + '>' + (product.availability ? 'Add to cart' : 'Unavailable')
            + '</button>'
            + '    </div>'
            + '  </article>'
            + '</div>';
    }

    function getCategoryLabel(category) {
        if (!category) return '';
        const parts = String(category).split('>').map(function (part) {
            return part.trim();
        }).filter(Boolean);
        return parts[parts.length - 1] || '';
    }

    function filterSimilarProducts(allProducts, currentProduct) {
        if (!currentProduct || !Array.isArray(allProducts)) return [];

        const targetCategory = (currentProduct.category || '').trim();
        if (!targetCategory) return [];

        const sameCategory = allProducts.filter(function (item) {
            if (!item || !item.id || item.id === currentProduct.id) return false;
            return (item.category || '').trim() === targetCategory;
        });

        if (sameCategory.length) return sameCategory;

        const parentCategory = targetCategory.split('>').slice(0, -1).join('>').trim();
        if (!parentCategory) return [];

        return allProducts.filter(function (item) {
            if (!item || !item.id || item.id === currentProduct.id) return false;
            const cat = (item.category || '').trim();
            return cat === parentCategory || cat.indexOf(parentCategory) === 0;
        });
    }

    function render(currentProduct) {
        if (!window.CantuCatalogData) return;

        window.CantuCatalogData.loadProducts()
            .then(function (allProducts) {
                const similar = filterSimilarProducts(allProducts, currentProduct).slice(0, 12);
                if (!similar.length) return;

                const categoryLabel = getCategoryLabel(currentProduct.category);
                const title = categoryLabel
                    ? 'Similar: ' + categoryLabel
                    : 'Similar products';
                const subtitle = categoryLabel
                    ? 'More sizes of ' + categoryLabel
                    : 'More sizes from the same line';

                const widget = document.createElement('section');
                widget.className = 'reco-widget';
                widget.id = WIDGET_ID;
                widget.innerHTML = ''
                    + '<div class="container">'
                    + '  <div class="reco-widget-header">'
                    + '    <div>'
                    + '      <p class="text-label">You might also like</p>'
                    + '      <h2 class="reco-widget-title">' + escapeHtml(title) + '</h2>'
                    + '      <p class="reco-widget-subtitle">' + escapeHtml(subtitle) + '</p>'
                    + '    </div>'
                    + '  </div>'
                    + '  <div class="reco-slider-shell">'
                    + '    <button class="reco-nav-btn swiper-button-prev swiper-button-prev-' + SWIPER_CLASS + '" type="button" aria-label="Previous">'
                    + '      <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2"/></svg>'
                    + '    </button>'
                    + '    <div class="swiper reco-swiper ' + SWIPER_CLASS + '">'
                    + '      <div class="swiper-wrapper">' + similar.map(buildProductCard).join('') + '</div>'
                    + '    </div>'
                    + '    <button class="reco-nav-btn swiper-button-next swiper-button-next-' + SWIPER_CLASS + '" type="button" aria-label="Next">'
                    + '      <svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" fill="none" stroke="currentColor" stroke-width="2"/></svg>'
                    + '    </button>'
                    + '  </div>'
                    + '  <div class="reco-widget-footer">'
                    + '    <div class="swiper-pagination swiper-pagination-' + SWIPER_CLASS + '"></div>'
                    + '  </div>'
                    + '</div>';

                if (!mountWidget(widget)) return;

                loadSwiper(function () {
                    if (typeof Swiper === 'undefined') return;

                    new Swiper('#' + WIDGET_ID + ' .' + SWIPER_CLASS, {
                        slidesPerView: 5,
                        slidesPerGroup: 1,
                        spaceBetween: 24,
                        speed: 600,
                        loop: similar.length > 5,
                        grabCursor: true,
                        pagination: {
                            el: '#' + WIDGET_ID + ' .swiper-pagination-' + SWIPER_CLASS,
                            clickable: true
                        },
                        navigation: {
                            nextEl: '#' + WIDGET_ID + ' .swiper-button-next-' + SWIPER_CLASS,
                            prevEl: '#' + WIDGET_ID + ' .swiper-button-prev-' + SWIPER_CLASS
                        },
                        breakpoints: {
                            0: { slidesPerView: 1.15, spaceBetween: 16 },
                            576: { slidesPerView: 2, spaceBetween: 18 },
                            768: { slidesPerView: 3, spaceBetween: 20 },
                            992: { slidesPerView: 4, spaceBetween: 22 },
                            1200: { slidesPerView: 5, spaceBetween: 24 }
                        }
                    });
                });
            })
            .catch(function (err) {
                console.error('SimilarProductsWidget:', err);
            });
    }

    injectStyles();

    window.addEventListener('cantupneus:product:loaded', function (event) {
        const product = event && event.detail && event.detail.product;
        if (product) {
            render(product);
        }
    });
})();

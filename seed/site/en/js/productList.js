(function () {
    const PRODUCT_LIMIT = 12;

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, function (char) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[char];
        });
    }

    function getCategoryLabel(category) {
        if (!category) return '';
        const parts = String(category).split('>').map(function (part) {
            return part.trim();
        });
        return parts[parts.length - 1] || '';
    }

    function renderCard(product) {
        const detailUrl = window.CantuCatalogData.buildProductUrl(product.id);
        const price = window.CantuCatalogData.formatPrice(product.price, product.currency);
        const oldPrice = product.oldPrice
            ? '<span class="product-card-old-price">' + escapeHtml(window.CantuCatalogData.formatPrice(product.oldPrice, product.currency)) + '</span>'
            : '';
        const availability = product.availability
            ? ''
            : '<span class="product-card-badge product-card-badge-out">Sold Out</span>';
        const categoryLabel = getCategoryLabel(product.category);

        return ''
            + '<article class="product-card">'
            + '  <a class="product-card-media" href="' + escapeHtml(detailUrl) + '" aria-label="View ' + escapeHtml(product.name) + '">'
            + '    <img src="' + escapeHtml(product.image) + '" alt="' + escapeHtml(product.name) + '" loading="lazy">'
            + (availability || '')
            + '  </a>'
            + '  <div class="product-card-body">'
            + (categoryLabel ? '<p class="product-card-category">' + escapeHtml(categoryLabel) + '</p>' : '')
            + '    <h3 class="product-card-name"><a href="' + escapeHtml(detailUrl) + '">' + escapeHtml(product.name) + '</a></h3>'
            + '    <div class="product-card-prices">'
            + '      <span class="product-card-price">' + escapeHtml(price) + '</span>'
            + oldPrice
            + '    </div>'
            + '    <div class="product-card-actions">'
            + '      <a class="btn-primary product-card-view" href="' + escapeHtml(detailUrl) + '">View details</a>'
            + '      <button class="product-card-cart-btn" type="button"'
            + '        data-cart-add'
            + '        data-product-id="' + escapeHtml(product.id) + '"'
            + '        data-product-variant-id="' + escapeHtml(product.id) + '"'
            + '        data-product-name="' + escapeHtml(product.name) + '"'
            + '        data-product-price="' + escapeHtml(product.price) + '"'
            + '        data-product-old-price="' + escapeHtml(product.oldPrice || '') + '"'
            + '        data-product-currency="' + escapeHtml(product.currency) + '"'
            + '        data-product-image="' + escapeHtml(product.image) + '"'
            + '        data-product-category="' + escapeHtml(categoryLabel || product.category) + '"'
            + (product.availability ? '' : ' disabled')
            + '>'
            + (product.availability ? 'Add to cart' : 'Unavailable')
            + '      </button>'
            + '    </div>'
            + '  </div>'
            + '</article>';
    }

    function setStatus(statusEl, message) {
        if (statusEl) {
            statusEl.textContent = message;
        }
    }

    function init() {
        const grid = document.getElementById('productGrid');
        if (!grid || !window.CantuCatalogData) return;

        const statusEl = grid.querySelector('[data-product-grid-status]');

        window.CantuCatalogData.loadProducts()
            .then(function (products) {
                const visible = products.slice(0, PRODUCT_LIMIT);
                if (!visible.length) {
                    setStatus(statusEl, 'No products available.');
                    return;
                }

                /* Dengage inline target slot, appended as the last grid cell.
                   It cannot live in index.html because this assignment replaces
                   everything inside the grid. Empty and hidden until an inline
                   On-Site campaign fills it. */
                grid.innerHTML = visible.map(renderCard).join('')
                    + '<div id="dn_inline_target_in_grid" class="dn-inline-slot"></div>';
            })
            .catch(function (error) {
                console.error('CantuCatalogData load failed', error);
                setStatus(statusEl, 'Unable to load products right now.');
            });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

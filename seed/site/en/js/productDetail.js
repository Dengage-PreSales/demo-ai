(function () {
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

    function getQueryParam(name) {
        try {
            const params = new URLSearchParams(window.location.search);
            return params.get(name);
        } catch (error) {
            return null;
        }
    }

    function getCategoryParts(category) {
        return String(category || '')
            .split('>')
            .map(function (part) { return part.trim(); })
            .filter(Boolean);
    }

    function renderBreadcrumb(product) {
        const breadcrumbEl = document.querySelector('[data-product-breadcrumb]');
        if (breadcrumbEl) {
            breadcrumbEl.textContent = product.name;
        }
        document.title = 'CantuPneus | ' + product.name;
    }

    function renderGallery(images, name) {
        if (!images.length) {
            return '<div class="product-detail-image product-detail-image-placeholder" aria-hidden="true"></div>';
        }

        const main = images[0];
        const thumbs = images.map(function (src, index) {
            return ''
                + '<button class="product-detail-thumb' + (index === 0 ? ' is-active' : '') + '"'
                + ' type="button"'
                + ' data-product-thumb="' + escapeHtml(src) + '"'
                + ' aria-label="Show image ' + (index + 1) + '">'
                + '<img src="' + escapeHtml(src) + '" alt="' + escapeHtml(name) + ' image ' + (index + 1) + '">'
                + '</button>';
        }).join('');

        return ''
            + '<div class="product-detail-gallery">'
            + '  <div class="product-detail-image">'
            + '    <img id="productDetailMainImage" src="' + escapeHtml(main) + '" alt="' + escapeHtml(name) + '">'
            + '  </div>'
            + (images.length > 1 ? '<div class="product-detail-thumbs">' + thumbs + '</div>' : '')
            + '</div>';
    }

    function renderProduct(product) {
        const container = document.querySelector('[data-product-detail]');
        if (!container) return;

        const price = window.CantuCatalogData.formatPrice(product.price, product.currency);
        const oldPrice = product.oldPrice
            ? '<span class="product-detail-old-price">' + escapeHtml(window.CantuCatalogData.formatPrice(product.oldPrice, product.currency)) + '</span>'
            : '';

        const categories = getCategoryParts(product.category);
        const categoryHtml = categories.length
            ? '<p class="product-detail-category">' + categories.map(escapeHtml).join(' / ') + '</p>'
            : '';

        const colorsHtml = product.colors && product.colors.length
            ? '<div class="product-detail-meta-row">'
              + '<span class="product-detail-meta-label">Construction</span>'
              + '<span class="product-detail-meta-value">' + product.colors.map(escapeHtml).join(', ') + '</span>'
              + '</div>'
            : '';

        const brandHtml = product.brand
            ? '<div class="product-detail-meta-row">'
              + '<span class="product-detail-meta-label">Brand</span>'
              + '<span class="product-detail-meta-value">' + escapeHtml(product.brand) + '</span>'
              + '</div>'
            : '';

        const availabilityHtml = '<div class="product-detail-meta-row">'
            + '<span class="product-detail-meta-label">Availability</span>'
            + '<span class="product-detail-meta-value ' + (product.availability ? 'is-available' : 'is-unavailable') + '">'
            + (product.availability ? 'In stock' : 'Sold out')
            + '</span>'
            + '</div>';

        container.innerHTML = ''
            + '<div class="product-detail-grid">'
            + renderGallery(product.images, product.name)
            + '  <div class="product-detail-info">'
            + categoryHtml
            + '    <h1 class="heading-display product-detail-name">' + escapeHtml(product.name) + '</h1>'
            + '    <div class="product-detail-prices">'
            + '      <span class="product-detail-price">' + escapeHtml(price) + '</span>'
            + oldPrice
            + '    </div>'
            /* Dengage inline target slot, directly under the price. Same reason
               it is here and not in product.html: this innerHTML assignment
               replaces the whole detail block on every render. */
            + '    <div id="dn_inline_target_pdp_below_price" class="dn-inline-slot"></div>'
            + (product.desc ? '<p class="text-body product-detail-desc">' + escapeHtml(product.desc) + '</p>' : '')
            + '    <div class="product-detail-meta">'
            + brandHtml
            + colorsHtml
            + availabilityHtml
            + '      <div class="product-detail-meta-row">'
            + '        <span class="product-detail-meta-label">SKU</span>'
            + '        <span class="product-detail-meta-value">' + escapeHtml(product.id) + '</span>'
            + '      </div>'
            + '    </div>'
            + '    <div class="product-detail-actions">'
            + '      <div class="product-detail-quantity">'
            + '        <button class="cart-qty-btn" type="button" data-product-qty-decrement aria-label="Decrease quantity">−</button>'
            + '        <span data-product-qty>1</span>'
            + '        <button class="cart-qty-btn" type="button" data-product-qty-increment aria-label="Increase quantity">+</button>'
            + '      </div>'
            + '      <button class="btn-primary product-detail-add-btn" type="button" data-product-add-to-cart'
            + (product.availability ? '' : ' disabled')
            + '>'
            + (product.availability ? 'Add to cart' : 'Unavailable')
            + '      </button>'
            + '    </div>'
            + '    <a class="btn-text" href="index.html#products">← Back to all products</a>'
            + '  </div>'
            + '</div>';

        bindGallery(container);
        bindActions(container, product);
    }

    function bindGallery(container) {
        const mainImage = document.getElementById('productDetailMainImage');
        if (!mainImage) return;

        container.querySelectorAll('[data-product-thumb]').forEach(function (thumb) {
            thumb.addEventListener('click', function () {
                container.querySelectorAll('[data-product-thumb]').forEach(function (other) {
                    other.classList.remove('is-active');
                });
                thumb.classList.add('is-active');
                mainImage.src = thumb.dataset.productThumb;
            });
        });
    }

    function bindActions(container, product) {
        const qtyEl = container.querySelector('[data-product-qty]');
        const decrementBtn = container.querySelector('[data-product-qty-decrement]');
        const incrementBtn = container.querySelector('[data-product-qty-increment]');
        const addBtn = container.querySelector('[data-product-add-to-cart]');

        let quantity = 1;

        function updateQty() {
            if (qtyEl) {
                qtyEl.textContent = quantity;
            }
        }

        if (decrementBtn) {
            decrementBtn.addEventListener('click', function () {
                quantity = Math.max(1, quantity - 1);
                updateQty();
            });
        }

        if (incrementBtn) {
            incrementBtn.addEventListener('click', function () {
                quantity += 1;
                updateQty();
            });
        }

        if (addBtn) {
            addBtn.addEventListener('click', function () {
                if (addBtn.disabled || !window.CantuCart) return;

                window.CantuCart.addItem({
                    id: product.id,
                    productId: product.id,
                    productVariantId: product.id,
                    name: product.name,
                    price: product.price,
                    oldPrice: product.oldPrice,
                    currency: product.currency,
                    image: product.image,
                    category: getCategoryParts(product.category).pop() || 'Tires'
                }, quantity);
            });
        }
    }

    function renderError(message) {
        const container = document.querySelector('[data-product-detail]');
        if (!container) return;

        container.innerHTML = ''
            + '<div class="product-detail-empty">'
            + '  <p>' + escapeHtml(message) + '</p>'
            + '  <a class="btn-primary" href="index.html#products">Back to catalog</a>'
            + '</div>';
    }

    function init() {
        const productId = getQueryParam('id');
        if (!productId) {
            renderError('No product selected.');
            return;
        }

        if (!window.CantuCatalogData) {
            renderError('Catalog is not available.');
            return;
        }

        window.CantuCatalogData.getProductById(productId)
            .then(function (product) {
                if (!product) {
                    renderError('Product not found.');
                    return;
                }
                renderBreadcrumb(product);
                renderProduct(product);
                window.dispatchEvent(new CustomEvent('cantupneus:product:loaded', { detail: { product: product } }));
            })
            .catch(function (error) {
                console.error('Could not load the product', error);
                renderError('Could not load this product right now.');
            });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

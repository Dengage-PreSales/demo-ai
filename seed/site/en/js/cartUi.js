(function () {
    function formatMoney(value, currency) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: currency || 'BRL'
        }).format(value || 0);
    }

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

    function getProductFromButton(button) {
        return {
            id: button.dataset.productId,
            productId: button.dataset.productId,
            productVariantId: button.dataset.productVariantId || button.dataset.productId,
            name: button.dataset.productName,
            price: button.dataset.productPrice,
            oldPrice: button.dataset.productOldPrice,
            currency: button.dataset.productCurrency || 'BRL',
            image: button.dataset.productImage,
            category: button.dataset.productCategory
        };
    }

    function showToast(message) {
        const toast = document.getElementById('loginSuccessMessage');
        if (!toast) return;

        clearTimeout(window.dPneusToastTimer);
        toast.textContent = message;
        toast.classList.add('active');

        window.dPneusToastTimer = setTimeout(() => {
            toast.classList.remove('active');
        }, 2000);
    }

    document.addEventListener('DOMContentLoaded', function () {
        if (!window.CantuCart) return;

        const cartDrawer = document.getElementById('cartDrawer');
        const cartItemsEl = document.querySelector('[data-cart-items]');
        const cartEmptyEl = document.querySelector('[data-cart-empty]');
        const cartTotalEl = document.querySelector('[data-cart-total]');
        const checkoutBtn = document.querySelector('[data-cart-checkout]');
        const cartCountEls = document.querySelectorAll('[data-cart-count]');

        function closeMobileNavIfOpen() {
            const mobileNav = document.getElementById('mobileNav');
            const mobileOverlay = document.getElementById('mobileOverlay');

            if (mobileNav) {
                mobileNav.classList.remove('active');
            }

            if (mobileOverlay) {
                mobileOverlay.classList.remove('active');
            }
        }

        function openCart() {
            if (!cartDrawer) return;
            closeMobileNavIfOpen();
            cartDrawer.classList.add('active');
            cartDrawer.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
        }

        function closeCart() {
            if (!cartDrawer) return;
            cartDrawer.classList.remove('active');
            cartDrawer.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
        }

        function renderCart() {
            const summary = window.CantuCart.getSummary();

            cartCountEls.forEach(element => {
                element.textContent = summary.itemCount;
            });

            if (cartTotalEl) {
                cartTotalEl.textContent = formatMoney(summary.total, summary.currency);
            }

            if (checkoutBtn) {
                checkoutBtn.disabled = summary.itemCount === 0;
            }

            if (cartEmptyEl) {
                cartEmptyEl.classList.toggle('active', summary.itemCount === 0);
            }

            if (!cartItemsEl) return;

            cartItemsEl.innerHTML = summary.items.map(item => `
                <article class="cart-item" data-cart-item-id="${item.id}">
                    <img class="cart-item-image" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}">
                    <div>
                        <h3 class="cart-item-name">${escapeHtml(item.name)}</h3>
                        <p class="cart-item-meta">${escapeHtml(item.category || 'Tires')}</p>
                        <p class="cart-item-price">${formatMoney(item.price, item.currency)} × ${item.quantity}</p>
                        <div class="cart-item-actions">
                            <button class="cart-qty-btn" type="button" data-cart-decrement="${escapeHtml(item.id)}" aria-label="Decrease quantity">−</button>
                            <span>${item.quantity}</span>
                            <button class="cart-qty-btn" type="button" data-cart-increment="${escapeHtml(item.id)}" aria-label="Increase quantity">+</button>
                            <button class="cart-remove-btn" type="button" data-cart-remove="${escapeHtml(item.id)}">Remove</button>
                        </div>
                    </div>
                </article>
            `).join('');
        }

        document.querySelectorAll('[data-cart-open]').forEach(button => {
            button.addEventListener('click', openCart);
        });

        document.querySelectorAll('[data-cart-close]').forEach(button => {
            button.addEventListener('click', closeCart);
        });

        document.body.addEventListener('click', function (event) {
            const addBtn = event.target.closest('[data-cart-add]');
            if (!addBtn || addBtn.disabled || addBtn.dataset.cartBound === 'true') return;

            event.preventDefault();
            event.stopPropagation();

            window.CantuCart.addItem(getProductFromButton(addBtn));
        });

        if (cartItemsEl) {
            cartItemsEl.addEventListener('click', function (event) {
                const incrementBtn = event.target.closest('[data-cart-increment]');
                const decrementBtn = event.target.closest('[data-cart-decrement]');
                const removeBtn = event.target.closest('[data-cart-remove]');

                if (incrementBtn) {
                    const item = window.CantuCart.getSummary().items.find(cartItem => cartItem.id === incrementBtn.dataset.cartIncrement);
                    if (item) {
                        window.CantuCart.addItem(item, 1);
                    }
                }

                if (decrementBtn) {
                    window.CantuCart.decrementItem(decrementBtn.dataset.cartDecrement);
                }

                if (removeBtn) {
                    window.CantuCart.removeItem(removeBtn.dataset.cartRemove);
                }
            });
        }

        if (checkoutBtn) {
            checkoutBtn.addEventListener('click', function () {
                const order = window.CantuCart.checkout({ source: 'cart_drawer' });
                if (!order) {
                    showToast('Your cart is empty.');
                    return;
                }

                closeCart();
                showToast('Purchase successful.');
            });
        }

        window.addEventListener('cantupneus:cart:updated', function (event) {
            renderCart();

            const action = event && event.detail && event.detail.action;
            if (action === 'add') {
                showToast('Added to cart.');
            } else if (action === 'remove') {
                showToast('Removed from cart.');
            }
        });
        window.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && cartDrawer && cartDrawer.classList.contains('active')) {
                closeCart();
            }
        });

        renderCart();
    });
})();

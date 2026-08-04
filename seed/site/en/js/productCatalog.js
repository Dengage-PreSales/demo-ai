(function () {
    const SOURCE_URL = 'cantu_prod_example.json';

    let productsPromise = null;
    let productsById = new Map();

    function normalizeProduct(raw) {
        if (!raw || !raw.id) return null;

        const price = Number(raw.price);
        const oldPrice = raw.oldPrice !== undefined ? Number(raw.oldPrice) : null;
        const stock = raw.stock !== undefined ? Number(raw.stock) : NaN;
        const images = Array.isArray(raw.image) ? raw.image.filter(Boolean) : [];
        const colors = Array.isArray(raw.colors) ? raw.colors.filter(Boolean) : [];

        return {
            id: String(raw.id),
            name: raw.name || 'CantuPneus Piece',
            desc: raw.desc || '',
            price: Number.isFinite(price) ? price : 0,
            oldPrice: Number.isFinite(oldPrice) && oldPrice > 0 ? oldPrice : null,
            currency: raw.currency || 'BRL',
            images,
            image: images[0] || '',
            category: raw.category || '',
            brand: raw.brand || '',
            availability: raw.availability !== false,
            /* Units in stock. Feeds stock_count on ec:addToWishlist, which the
               docs call out as the field a back-in-stock campaign needs, and the
               low-stock line in search results.

               null when the catalogue does not track stock, and the wishlist
               payload then omits stock_count rather than inventing one. The
               fintech and banking catalogues are deliberately in that case: a
               card or a mortgage has no unit count. Those two send price and
               discounted_price only, which is what a rate-drop alert needs. */
            stock: Number.isFinite(stock) && stock >= 0 ? stock : null,
            colors,
            url: 'product.html?id=' + encodeURIComponent(String(raw.id))
        };
    }

    function loadProducts() {
        if (!productsPromise) {
            productsPromise = fetch(SOURCE_URL, { cache: 'no-store' })
                .then(function (response) {
                    if (!response.ok) {
                        throw new Error('Failed to load products (' + response.status + ')');
                    }
                    return response.json();
                })
                .then(function (data) {
                    const list = Array.isArray(data) ? data : [];
                    const normalized = list
                        .map(normalizeProduct)
                        .filter(Boolean);

                    productsById = new Map();
                    normalized.forEach(function (product) {
                        productsById.set(product.id, product);
                    });

                    return normalized;
                })
                .catch(function (error) {
                    productsPromise = null;
                    throw error;
                });
        }

        return productsPromise;
    }

    function getProductById(id) {
        return loadProducts().then(function () {
            return productsById.get(String(id)) || null;
        });
    }

    function formatPrice(value, currency) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: currency || 'BRL'
        }).format(Number(value) || 0);
    }

    function buildProductUrl(id) {
        return 'product.html?id=' + encodeURIComponent(String(id));
    }

    window.CantuCatalogData = {
        loadProducts,
        getProductById,
        formatPrice,
        buildProductUrl
    };
})();

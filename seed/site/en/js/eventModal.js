/* Dengage Event Modal Controller - Pneus Edition
 * Clean, simple and performant event management system for pneus business
 */
(function () {
    'use strict';

    // ==================== LANGUAGE CONFIG ====================
    const LANGUAGES = {
        pt: {
            modalTitle: 'Eventos Dengage',
            modalSubtitle: 'Edite os payloads e dispare eventos de dispositivo rapidamente.',
            helpTitle: '// eventos nativos do SDK -> tabelas padrão do Data Space',
            helpText: 'Os seis primeiros cartões disparam as ações nativas do SDK (<em>pageView</em>, <em>ec:addToCart</em>, <em>ec:beginCheckout</em>, <em>ec:addToWishlist</em>, <em>ec:order</em>), que gravam nas tabelas padrão com todas as colunas. <em>key</em>, <em>event_date</em> e <em>session_id</em> são preenchidos pelo SDK. Os dois últimos usam sendDeviceEvent para tabelas personalizadas.',
            addCustomBtn: 'Criar novo evento personalizado',
            addFieldBtn: '+ Adicionar campo',
            sendBtn: 'Enviar evento',
            statusReady: 'Pronto para enviar',
            statusSending: 'Enviando...',
            statusSent: 'Enviado',
            statusError: 'Ocorreu um erro',
            tableNameLabel: 'Nome da tabela:',
            keyPlaceholder: 'nome_do_campo',
            valuePlaceholder: 'valor',
            errorEmptyTable: 'O nome da tabela não pode ficar vazio.',
            errorEmptyKey: 'Os nomes dos campos não podem ficar vazios.',
            iconTitle: 'Eventos',
            iconSubtitle: 'Painel de controle',

            events: [
                { title: 'Produto visualizado', description: 'pageView com todas as colunas → tabela page_view_events.' },
                { title: 'Linha visualizada', description: 'pageView de categoria → tabela page_view_events.' },
                { title: 'Adicionado ao carrinho', description: 'ec:addToCart com cartItems → tabela shopping_cart_events.' },
                { title: 'Adicionado aos favoritos', description: 'ec:addToWishlist → tabela wishlist_events.' },
                { title: 'Checkout iniciado', description: 'ec:beginCheckout com cartItems → tabela shopping_cart_events.' },
                { title: 'Pagamento concluído', description: 'ec:order com cartItems → tabelas order_events e order_events_detail.' },
                { title: 'Contato com consultor', description: 'sendDeviceEvent → tabela personalizada events.' },
                { title: 'Simulação de carga fechada', description: 'sendDeviceEvent → tabela personalizada events.' }
            ]
        },
        en: {
            modalTitle: 'Dengage Events',
            modalSubtitle: 'Edit payloads and fire device events quickly.',
            helpTitle: '// native SDK events -> standard Data Space tables',
            helpText: 'The first six cards fire the SDK\'s native actions (<em>pageView</em>, <em>ec:addToCart</em>, <em>ec:beginCheckout</em>, <em>ec:addToWishlist</em>, <em>ec:order</em>), which write to the standard tables with all their columns. <em>key</em>, <em>event_date</em> and <em>session_id</em> are filled by the SDK. The last two use sendDeviceEvent to custom tables.',
            addCustomBtn: 'Create new custom event',
            addFieldBtn: '+ Add field',
            sendBtn: 'Send event',
            statusReady: 'Ready to send',
            statusSending: 'Sending...',
            statusSent: 'Sent',
            statusError: 'An error occurred',
            tableNameLabel: 'Table name:',
            keyPlaceholder: 'field_name',
            valuePlaceholder: 'value',
            errorEmptyTable: 'The table name cannot be empty.',
            errorEmptyKey: 'Field names cannot be empty.',
            iconTitle: 'Events',
            iconSubtitle: 'Control panel',

            events: [
                { title: 'Product viewed', description: 'pageView with all columns → page_view_events table.' },
                { title: 'Category viewed', description: 'category pageView → page_view_events table.' },
                { title: 'Added to cart', description: 'ec:addToCart with cartItems → shopping_cart_events table.' },
                { title: 'Added to wishlist', description: 'ec:addToWishlist → wishlist_events table.' },
                { title: 'Checkout started', description: 'ec:beginCheckout with cartItems → shopping_cart_events table.' },
                { title: 'Payment completed', description: 'ec:order with cartItems → order_events and order_events_detail tables.' },
                { title: 'Advisor contact', description: 'sendDeviceEvent → custom events table.' },
                { title: 'Full-load quote', description: 'sendDeviceEvent → custom events table.' }
            ]
        }
    };

    let currentLang = 'en';

    // ==================== EVENT DATA ====================
    /* The first six cards fire the SDK's FIRST-CLASS actions (pageView and
       ec:*), which is what actually populates the standard Data Space tables
       (page_view_events, shopping_cart_events, wishlist_events, order_events)
       with the exact column set those tables define. key, event_date and
       session_id are filled by the SDK; the fields below are the remaining
       columns, pre-populated with real catalogue data so a tester only has
       to press Send and watch the row land in the right table.

       `action` picks the SDK verb; without it the card falls back to
       sendDeviceEvent(tableName, payload) for custom tables. `cartItems:
       'fromFields'` builds the cartItems array the ec:* cart calls expect
       out of the item fields on the card. */
    const EVENT_TEMPLATES = [
        {
            /* Product viewed -> page_view_events (all columns) */
            action: 'pageView',
            tableName: 'page_view_events',
            properties: [
                { key: 'page_type', value: 'product' },
                { key: 'page_url', value: 'https://salil-dengage.github.io/dengage-demos/cantu-pneus/product.html?id=CNT-CRG-29580-KLD01' },
                { key: 'page_title', value: 'Marshal KLD01 295/80 R22.5 | CantuPneus' },
                { key: 'product_id', value: 'CNT-CRG-29580-KLD01' },
                { key: 'category_id', value: 'TRK-LUG' },
                { key: 'promotion_id', value: 'OFFER-OF-THE-WEEK' },
                { key: 'price', value: '2090.00' },
                { key: 'discounted_price', value: '1890.00' },
                { key: 'stock_count', value: '12' },
                { key: 'category_path', value: 'Tires > Truck > Lug' }
            ]
        },
        {
            /* Category viewed -> page_view_events (category columns) */
            action: 'pageView',
            tableName: 'page_view_events',
            properties: [
                { key: 'page_type', value: 'category' },
                { key: 'page_url', value: 'https://salil-dengage.github.io/dengage-demos/cantu-pneus/index.html#products' },
                { key: 'page_title', value: 'Truck Line | CantuPneus' },
                { key: 'category_id', value: 'TRUCK-LINE' },
                { key: 'category_path', value: 'Tires > Truck' },
                { key: 'promotion_id', value: 'FREE-FREIGHT-5000' }
            ]
        },
        {
            /* Added to cart -> shopping_cart_events */
            action: 'ec:addToCart',
            tableName: 'shopping_cart_events',
            cartItems: 'fromFields',
            properties: [
                { key: 'product_id', value: 'CNT-CRG-29580-HN08' },
                { key: 'product_variant_id', value: 'CNT-CRG-29580-HN08' },
                { key: 'quantity', value: '2' },
                { key: 'unit_price', value: '1890.00' },
                { key: 'discounted_price', value: '1740.00' }
            ]
        },
        {
            /* Saved -> wishlist_events.

               No `action` here, on purpose: the wishlist card writes its table
               directly with sendDeviceEvent, carrying event_type and is_used
               explicitly, exactly as js/wishlist.js does. Do not switch it to
               the ec: form. Background: Salil. */
            tableName: 'wishlist_events',
            properties: [
                { key: 'event_type', value: 'add' },
                { key: 'is_used', value: 'false' },
                { key: 'product_id', value: 'CNT-AGR-1834-R1W' },
                { key: 'product_variant_id', value: 'CNT-AGR-1834-R1W' },
                { key: 'price', value: '3980.00' },
                { key: 'discounted_price', value: '3980.00' },
                { key: 'stock_count', value: '6' },
                { key: 'list_name', value: 'favorite-sizes' }
            ]
        },
        {
            /* Checkout started -> shopping_cart_events */
            action: 'ec:beginCheckout',
            tableName: 'shopping_cart_events',
            cartItems: 'fromFields',
            properties: [
                { key: 'product_id', value: 'CNT-CRG-29580-HN08' },
                { key: 'product_variant_id', value: 'CNT-CRG-29580-HN08' },
                { key: 'quantity', value: '2' },
                { key: 'unit_price', value: '1890.00' },
                { key: 'discounted_price', value: '1740.00' }
            ]
        },
        {
            /* Payment completed -> order_events (+ order_events_detail) */
            action: 'ec:order',
            tableName: 'order_events',
            cartItems: 'fromFields',
            properties: [
                { key: 'order_id', value: 'ORD-' + Date.now() },
                { key: 'item_count', value: '2' },
                { key: 'total_amount', value: '3780.00' },
                { key: 'payment_method', value: 'credit_card' },
                { key: 'shipping', value: 'cif_freight' },
                { key: 'coupon_code', value: 'FROTA10' },
                { key: 'product_id', value: 'CNT-CRG-29580-HN08' },
                { key: 'product_variant_id', value: 'CNT-CRG-29580-HN08' },
                { key: 'quantity', value: '2' },
                { key: 'unit_price', value: '1890.00' },
                { key: 'discounted_price', value: '1740.00' }
            ]
        },
        {
            tableName: 'events',
            properties: [
                { key: 'event_name', value: 'advisor_appointment' },
                { key: 'appointment_id', value: 'APT-' + Date.now() },
                { key: 'store_location', value: 'Itajai Branch' },
                { key: 'appointment_type', value: 'advisor_contact' },
                { key: 'preferred_date', value: '2026-06-15' },
                { key: 'preferred_time', value: '14:30' }
            ]
        },
        {
            tableName: 'events',
            properties: [
                { key: 'event_name', value: 'full_load_quote' },
                { key: 'request_id', value: 'CUS-' + Date.now() },
                { key: 'load_type', value: 'full_load' },
                { key: 'line', value: 'truck' },
                { key: 'size', value: '295/80 R22.5' },
                { key: 'budget_range', value: '50000-120000 BRL' }
            ]
        }
    ];

    // ==================== STATE ====================
    let tableFieldSeq = 0;
    let allCards = [];
    let elements = {};

    // ==================== STYLES ====================
    function injectStyles() {
        if (document.getElementById('event-modal-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'event-modal-styles';
        style.textContent = `
            #event-modal-icon {
                position: fixed; left: 30px; bottom: 110px; min-width: 200px;
                background: linear-gradient(135deg, #125cfa 0%, #0d4bc4 100%);
                color: #fff; border-radius: 16px; padding: 14px 16px;
                box-shadow: 0 6px 20px rgba(18, 92, 250, 0.4);
                cursor: pointer; display: flex; align-items: center; gap: 12px;
                z-index: 1200; transition: transform 0.15s ease, opacity 0.15s ease;
            }
            #event-modal-icon:hover { transform: translateY(-2px); }
            #event-modal-icon.hidden { opacity: 0; pointer-events: none; }
            #event-modal-icon .icon-badge {
                width: 42px; height: 42px; border-radius: 12px;
                background: rgba(255,255,255,0.2); display: flex;
                align-items: center; justify-content: center;
                font-size: 22px; flex-shrink: 0;
            }
            #event-modal-icon .icon-content { flex: 1; }
            #event-modal-icon strong {
                display: block; font-size: 15px; font-weight: 700;
                color: #fff; line-height: 1.3; margin-bottom: 2px;
            }
            #event-modal-icon small {
                display: block; font-size: 12px; font-weight: 400;
                color: rgba(255,255,255,0.85); line-height: 1.2;
            }
            
            #event-modal-overlay {
                position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5);
                opacity: 0; visibility: hidden; transition: opacity 0.2s ease;
                z-index: 99998;
            }
            #event-modal-overlay.visible { opacity: 1; visibility: visible; }
            
            #event-manager-modal {
                position: fixed; top: 0; left: -720px; width: 720px; height: 100vh;
                background: #fff; box-shadow: 5px 0 20px rgba(0,0,0,0.15);
                padding: 24px; box-sizing: border-box; overflow-y: auto;
                z-index: 99999; transition: left 0.25s ease-out;
            }
            #event-manager-modal.visible { left: 0; }
            
            .modal-header {
                display: flex; justify-content: space-between; align-items: flex-start;
                gap: 12px; margin-bottom: 16px;
            }
            .modal-header-left { flex: 1; }
            .modal-header h2 {
                margin: 0; font-size: 22px; color: #0f172a; font-weight: 700;
            }
            .modal-header p {
                margin: 6px 0 0; font-size: 14px; color: #64748b; line-height: 1.4;
            }
            .modal-header-right {
                display: flex; gap: 6px; align-items: center; flex-shrink: 0;
            }
            
            .lang-btn {
                background: #f1f5f9; border: 1px solid #cbd5e1;
                padding: 7px 12px; border-radius: 8px; cursor: pointer;
                font-size: 12px; font-weight: 600; color: #475569;
                transition: all 0.15s ease;
            }
            .lang-btn:hover { background: #e2e8f0; transform: translateY(-1px); }
            .lang-btn.active {
                background: linear-gradient(135deg, #125cfa 0%, #0d4bc4 100%);
                color: #fff; border-color: #125cfa;
            }
            
            .close-btn {
                background: #f1f5f9; border: 1px solid #cbd5e1;
                width: 32px; height: 32px; border-radius: 10px; cursor: pointer;
                display: flex; align-items: center; justify-content: center;
                color: #475569; transition: all 0.15s ease;
            }
            .close-btn:hover {
                background: #fee2e2; border-color: #fecaca; color: #dc2626;
            }
            
            .help-box {
                margin: 16px 0; padding: 14px; border-radius: 12px;
                background: #eff6ff; border: 1px solid #dbeafe;
            }
            .help-box strong {
                display: block; color: #1d4ed8; margin-bottom: 4px;
                font-size: 13px; font-weight: 600;
            }
            .help-box p {
                margin: 0; color: #64748b; font-size: 13px; line-height: 1.5;
            }
            .help-box em { color: #1d4ed8; font-style: italic; }
            
            .events-container {
                display: flex; flex-direction: column; gap: 14px; margin: 16px 0;
            }
            
            .event-card {
                background: #fff; border-radius: 14px;
                border: 1px solid #e5e7eb;
                box-shadow: 0 2px 6px rgba(0,0,0,0.06);
                overflow: hidden;
            }
            
            .event-header {
                width: 100%; background: transparent; border: none;
                padding: 14px 16px; display: flex; justify-content: space-between;
                align-items: center; cursor: pointer; text-align: left;
                transition: background 0.15s ease;
            }
            .event-header:hover { background: #f9fafb; }
            .event-card.open .event-header { background: #eff6ff; }
            
            .event-header-text { flex: 1; }
            .event-header strong {
                display: block; font-size: 14px; color: #0f172a;
                font-weight: 600; margin-bottom: 2px;
            }
            .event-header span {
                 font-size: 12px; color: #64748b;
            }
            
            .event-chevron {
                width: 26px; height: 26px; border-radius: 8px;
                background: #f1f5f9; display: flex;
                align-items: center; justify-content: center;
                color: #475569; transition: transform 0.2s ease, background 0.2s ease;
            }
            .event-card.open .event-chevron {
                transform: rotate(180deg); background: #dbeafe; color: #1d4ed8;
            }
            
            .event-body {
                max-height: 0; overflow: hidden;
                transition: max-height 0.25s ease, padding 0.25s ease;
            }
            .event-card.open .event-body {
                padding: 0 16px 14px 16px;
            }
            
            .table-name-row {
                display: flex; align-items: center; gap: 8px;
                padding: 10px; background: #eff6ff; border-radius: 10px;
                border: 1px solid #dbeafe; margin-bottom: 10px;
            }
            .table-name-row label {
                font-size: 12px; font-weight: 600; color: #1d4ed8;
                white-space: nowrap;
            }
            .table-name-row input {
                flex: 1; border: 1px solid #cbd5e1; border-radius: 8px;
                padding: 6px 10px; font-size: 13px; background: #fff;
                transition: border 0.15s;
            }
            .table-name-row input:focus {
                border-color: #125cfa; outline: none;
            }
            .table-name-row input.invalid { border-color: #dc2626; }
            .table-name-row input[readonly] {
                background: #f1f5f9; color: #475569; cursor: default;
            }
            
            .fields-container {
                display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px;
            }
            
            .field-row {
                display: grid; grid-template-columns: 1fr 1fr auto;
                gap: 6px; align-items: center;
            }
            .field-row input {
                border: 1px solid #cbd5e1; border-radius: 8px;
                padding: 8px 10px; font-size: 13px; background: #f8fafc;
                transition: border 0.15s;
                color: #000;
            
            }
            .field-row input:focus {
                border-color: #125cfa; outline: none; background: #fff;
            }
            .field-row input.invalid { border-color: #dc2626; }
            
            .remove-btn {
                border: none; background: #f1f5f9; color: #475569;
                width: 32px; height: 32px; border-radius: 8px;
                font-size: 16px; cursor: pointer; transition: all 0.15s ease;
            }
            .remove-btn:hover { background: #fee2e2; color: #dc2626; }
            
            .add-field-btn {
                border: 1px dashed #93c5fd; background: #eff6ff;
                color: #1d4ed8; border-radius: 10px; padding: 8px 12px;
                cursor: pointer; font-weight: 600; font-size: 12px;
                transition: all 0.15s ease; margin-bottom: 10px;
            }
            .add-field-btn:hover {
                background: #dbeafe; border-color: #60a5fa;
            }
            
            .event-footer {
                display: flex; justify-content: space-between;
                align-items: center; gap: 10px;
            }
            .event-status {
                font-size: 12px; color: #64748b;
            }
            .event-status.error { color: #dc2626; }
            
            .send-btn {
                border: none;
                background: linear-gradient(135deg, #125cfa 0%, #0d4bc4 100%);
                color: #fff; border-radius: 10px; padding: 8px 14px;
                font-weight: 600; font-size: 12px; cursor: pointer;
                box-shadow: 0 3px 10px rgba(18, 92, 250, 0.25);
                transition: transform 0.15s ease, box-shadow 0.15s ease;
            }
            .send-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 5px 14px rgba(18, 92, 250, 0.35);
            }
            
            .add-custom-btn {
                width: 100%; border: 1px solid #93c5fd; border-radius: 12px;
                padding: 12px; font-weight: 600; color: #1d4ed8;
                background: #eff6ff; cursor: pointer; font-size: 13px;
                transition: all 0.15s ease;
            }
            .add-custom-btn:hover {
                background: #dbeafe; border-color: #60a5fa;
            }
            
            @media (max-width: 768px) {
                #event-manager-modal { width: 100%; left: -100%; }
                /* Collapse to the badge alone. At full width the pill covered
                   a third of a phone screen and sat on top of the page copy. */
                #event-modal-icon {
                    left: 16px; bottom: 100px; min-width: 0;
                    padding: 10px; border-radius: 14px;
                }
                #event-modal-icon .icon-content { display: none; }
                #event-modal-icon .icon-badge { width: 38px; height: 38px; font-size: 20px; }
                .modal-header { flex-direction: column; gap: 10px; }
                .modal-header-right { width: 100%; }
                .field-row { grid-template-columns: 1fr; }
                .remove-btn { width: 100%; }
            }
            
            /* Scrollbar */
            #event-manager-modal::-webkit-scrollbar { width: 6px; }
            #event-manager-modal::-webkit-scrollbar-track { background: #f1f5f9; }
            #event-manager-modal::-webkit-scrollbar-thumb {
                background: rgba(18, 92, 250, 0.3); border-radius: 3px;
            }
            #event-manager-modal::-webkit-scrollbar-thumb:hover {
                background: rgba(18, 92, 250, 0.5);
            }
        `;
        document.head.appendChild(style);
    }

    // ==================== FIELD FUNCTIONS ====================
    function createField(key = '', value = '', onRemove) {
        const lang = LANGUAGES[currentLang];
        const row = document.createElement('div');
        row.className = 'field-row';

        const keyInput = document.createElement('input');
        keyInput.name = 'dng-field-key';
        keyInput.setAttribute('aria-label', lang.keyPlaceholder);
        keyInput.type = 'text';
        keyInput.value = key;
        keyInput.placeholder = lang.keyPlaceholder;
        keyInput.className = 'field-key';

        const valueInput = document.createElement('input');
        valueInput.name = 'dng-field-value';
        valueInput.setAttribute('aria-label', lang.valuePlaceholder);
        valueInput.type = 'text';
        valueInput.value = value;
        valueInput.placeholder = lang.valuePlaceholder;
        valueInput.className = 'field-value';

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.textContent = '×';
        removeBtn.onclick = () => {
            row.remove();
            if (onRemove) onRemove();
        };

        row.appendChild(keyInput);
        row.appendChild(valueInput);
        row.appendChild(removeBtn);

        return row;
    }

    function getFieldData(row) {
        return {
            key: row.querySelector('.field-key').value.trim(),
            value: row.querySelector('.field-value').value.trim()
        };
    }

    function validateField(row) {
        const keyInput = row.querySelector('.field-key');
        const key = keyInput.value.trim();
        if (!key) {
            keyInput.classList.add('invalid');
            return false;
        }
        keyInput.classList.remove('invalid');
        return true;
    }

    // ==================== CARD FUNCTIONS ====================
    function createEventCard(eventTemplate, index) {
        const lang = LANGUAGES[currentLang];
        const eventLangData = lang.events[index];
        
        const card = document.createElement('div');
        card.className = 'event-card';
        card.dataset.index = index;
        card._template = eventTemplate;

        // Header
        const header = document.createElement('button');
        header.className = 'event-header';
        header.type = 'button';

        const headerText = document.createElement('div');
        headerText.className = 'event-header-text';

        const title = document.createElement('strong');
        title.className = 'event-title';
        title.textContent = eventLangData.title;

        const desc = document.createElement('span');
        desc.className = 'event-desc';
        desc.textContent = eventLangData.description;

        headerText.appendChild(title);
        headerText.appendChild(desc);

        const chevron = document.createElement('span');
        chevron.className = 'event-chevron';
        chevron.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
            </svg>
        `;

        header.appendChild(headerText);
        header.appendChild(chevron);

        // Body
        const body = document.createElement('div');
        body.className = 'event-body';

        // Table name
        const tableRow = document.createElement('div');
        tableRow.className = 'table-name-row';

        /* one id per card: the modal renders a table-name field for every
           event template, and a shared id is a duplicate-id violation that
           also breaks label association and autofill */
        const tableInputId = 'dng-table-name-' + (++tableFieldSeq);

        const tableLabel = document.createElement('label');
        tableLabel.textContent = lang.tableNameLabel;
        tableLabel.htmlFor = tableInputId;

        const tableInput = document.createElement('input');
        tableInput.name = 'dng-table-name';
        tableInput.id = tableInputId;
        tableInput.setAttribute('aria-label', lang.tableNameLabel);
        tableInput.type = 'text';
        tableInput.value = eventTemplate.tableName;
        tableInput.className = 'table-name-input';
        /* first-class actions route to their standard table by themselves;
           the field is shown for clarity but editing it would do nothing */
        if (eventTemplate.action) tableInput.readOnly = true;

        tableRow.appendChild(tableLabel);
        tableRow.appendChild(tableInput);

        // Fields container
        const fieldsContainer = document.createElement('div');
        fieldsContainer.className = 'fields-container';

        eventTemplate.properties.forEach(prop => {
            const field = createField(prop.key, prop.value, () => syncCardHeight(card));
            fieldsContainer.appendChild(field);
        });

        // Add field button
        const addFieldBtn = document.createElement('button');
        addFieldBtn.className = 'add-field-btn';
        addFieldBtn.textContent = lang.addFieldBtn;
        addFieldBtn.onclick = () => {
            const newField = createField('', '', () => syncCardHeight(card));
            fieldsContainer.appendChild(newField);
            newField.querySelector('.field-key').focus();
            syncCardHeight(card);
        };

        // Footer
        const footer = document.createElement('div');
        footer.className = 'event-footer';

        const status = document.createElement('span');
        status.className = 'event-status';
        status.textContent = lang.statusReady;

        const sendBtn = document.createElement('button');
        sendBtn.className = 'send-btn';
        sendBtn.textContent = lang.sendBtn;
        sendBtn.onclick = () => sendEvent(card, tableInput, fieldsContainer, status);

        footer.appendChild(status);
        footer.appendChild(sendBtn);

        // Assemble
        body.appendChild(tableRow);
        body.appendChild(fieldsContainer);
        body.appendChild(addFieldBtn);
        body.appendChild(footer);

        card.appendChild(header);
        card.appendChild(body);

        // Toggle handler
        header.onclick = () => toggleCard(card);

        return card;
    }

    function toggleCard(targetCard) {
        const isOpen = targetCard.classList.contains('open');
        
        // Close all cards
        allCards.forEach(card => {
            card.classList.remove('open');
            card.querySelector('.event-body').style.maxHeight = '0';
        });

        // Open target if it was closed
        if (!isOpen) {
            targetCard.classList.add('open');
            syncCardHeight(targetCard);
        }
    }

    function syncCardHeight(card) {
        if (card.classList.contains('open')) {
            const body = card.querySelector('.event-body');
            body.style.maxHeight = body.scrollHeight + 'px';
        }
    }

    /* Values are typed into text inputs, but the standard tables have real
       number columns, so anything that looks numeric is sent as a Number. */
    const NUMERIC_RE = /^-?\d+(\.\d+)?$/;
    function coerceValue(value) {
        return NUMERIC_RE.test(value) ? Number(value) : value;
    }

    /* The ec:* cart calls expect the whole basket as a cartItems array; build
       a one-item basket from the item fields already present on the card. */
    const CART_ITEM_KEYS = ['product_id', 'product_variant_id', 'quantity', 'unit_price', 'discounted_price'];
    function cartItemsFromPayload(payload) {
        const item = {};
        CART_ITEM_KEYS.forEach(key => {
            if (payload[key] !== undefined) item[key] = payload[key];
        });
        return [item];
    }

    function sendEvent(card, tableInput, fieldsContainer, statusEl) {
        const lang = LANGUAGES[currentLang];
        const template = card._template || {};
        const tableName = tableInput.value.trim();

        if (!tableName) {
            setStatus(statusEl, lang.errorEmptyTable, true);
            tableInput.classList.add('invalid');
            return;
        }

        tableInput.classList.remove('invalid');

        const payload = {};
        let valid = true;

        const fieldRows = fieldsContainer.querySelectorAll('.field-row');
        fieldRows.forEach(row => {
            if (!validateField(row)) {
                valid = false;
                return;
            }
            const data = getFieldData(row);
            if (data.key && data.value !== '') {
                payload[data.key] = coerceValue(data.value);
            }
        });

        if (!valid) {
            setStatus(statusEl, lang.errorEmptyKey, true);
            return;
        }

        if (template.cartItems === 'fromFields') {
            payload.cartItems = cartItemsFromPayload(payload);
        }

        setStatus(statusEl, lang.statusSending, false);

        try {
            if (typeof window.dengage === 'function') {
                if (template.action) {
                    /* first-class SDK verb: the SDK routes it to the standard
                       table itself and fills key/event_date/session_id */
                    window.dengage(template.action, payload);
                    setStatus(statusEl, `${lang.statusSent} (${template.action} → ${tableName})`, false);
                } else {
                    window.dengage('sendDeviceEvent', tableName, payload);
                    setStatus(statusEl, `${lang.statusSent} (${payload.event_name || 'event'} → ${tableName})`, false);
                }
            } else {
                console.log('Dengage mock event:', { action: template.action || 'sendDeviceEvent', tableName, payload });
                setStatus(statusEl, 'dengage undefined, logged to console', false);
            }
        } catch (err) {
            console.error(err);
            setStatus(statusEl, lang.statusError, true);
            return;
        }

        setTimeout(() => {
            setStatus(statusEl, lang.statusReady, false);
        }, 3000);
    }

    function setStatus(statusEl, message, isError) {
        statusEl.textContent = message;
        statusEl.classList.toggle('error', isError);
    }

    // ==================== UI FUNCTIONS ====================
    function showIdentity(el, lang) {
        if (typeof window.dengage !== 'function') return;
        const short = v => (v && v.length > 22) ? v.slice(0, 10) + '…' + v.slice(-8) : v;
        try {
            window.dengage('getContactKey', function (contactKey) {
                if (contactKey) { el.textContent = short(String(contactKey)); return; }
                window.dengage('getDeviceId', function (deviceId) {
                    el.textContent = deviceId ? 'ID: ' + short(String(deviceId)) : lang.iconSubtitle;
                });
            });
        } catch (err) {
            /* identity is a nicety; never let it break the launcher */
        }
    }

    function createIcon() {
        const lang = LANGUAGES[currentLang];
        const icon = document.createElement('div');
        icon.id = 'event-modal-icon';

        /* The badge is what remains when the label is hidden on narrow
           viewports, so the control stays visible and tappable. */
        const badge = document.createElement('div');
        badge.className = 'icon-badge';
        badge.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
            'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            '<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/></svg>';
        icon.appendChild(badge);

        const content = document.createElement('div');
        content.className = 'icon-content';

        const title = document.createElement('strong');
        title.textContent = lang.iconTitle;

        const subtitle = document.createElement('small');
        subtitle.textContent = lang.iconSubtitle;

        content.appendChild(title);
        content.appendChild(subtitle);
        icon.appendChild(content);

        /* Show who the SDK thinks this visitor is. During a demo it is the
           quickest way to prove setContactKey landed and that the device is
           identified, without opening devtools. */
        showIdentity(subtitle, lang);

        return icon;
    }

    function createModal() {
        const lang = LANGUAGES[currentLang];
        const modal = document.createElement('div');
        modal.id = 'event-manager-modal';

        // Header
        const header = document.createElement('div');
        header.className = 'modal-header';

        const headerLeft = document.createElement('div');
        headerLeft.className = 'modal-header-left';

        const h2 = document.createElement('h2');
        h2.textContent = lang.modalTitle;

        const p = document.createElement('p');
        p.textContent = lang.modalSubtitle;

        headerLeft.appendChild(h2);
        headerLeft.appendChild(p);

        const headerRight = document.createElement('div');
        headerRight.className = 'modal-header-right';

        const langBtnTr = document.createElement('button');
        langBtnTr.className = 'lang-btn' + (currentLang === 'pt' ? ' active' : '');
        langBtnTr.textContent = '🇧🇷 PT';
        langBtnTr.onclick = () => switchLanguage('pt');

        const langBtnEn = document.createElement('button');
        langBtnEn.className = 'lang-btn' + (currentLang === 'en' ? ' active' : '');
        langBtnEn.textContent = '🇬🇧 EN';
        langBtnEn.onclick = () => switchLanguage('en');

        const closeBtn = document.createElement('button');
        closeBtn.className = 'close-btn';
        closeBtn.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
            </svg>
        `;
        closeBtn.onclick = closeModal;

        headerRight.appendChild(langBtnTr);
        headerRight.appendChild(langBtnEn);
        headerRight.appendChild(closeBtn);

        header.appendChild(headerLeft);
        header.appendChild(headerRight);

        // Help box
        const helpBox = document.createElement('div');
        helpBox.className = 'help-box';
        helpBox.innerHTML = `
            <strong>${lang.helpTitle}</strong>
            <p>${lang.helpText}</p>
        `;

        // Events container
        const eventsContainer = document.createElement('div');
        eventsContainer.className = 'events-container';

        // Add custom button
        const addCustomBtn = document.createElement('button');
        addCustomBtn.className = 'add-custom-btn';
        addCustomBtn.textContent = lang.addCustomBtn;
        addCustomBtn.onclick = addCustomEvent;

        modal.appendChild(header);
        modal.appendChild(helpBox);
        modal.appendChild(eventsContainer);
        modal.appendChild(addCustomBtn);

        return { modal, eventsContainer, langBtnTr, langBtnEn, helpBox, addCustomBtn };
    }

    function createOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'event-modal-overlay';
        overlay.onclick = closeModal;
        return overlay;
    }

    // ==================== MODAL CONTROL ====================
    let isModalOpen = false;

    function openModal() {
        if (isModalOpen) return;
        isModalOpen = true;
        elements.modal.classList.add('visible');
        elements.overlay.classList.add('visible');
        elements.icon.classList.add('hidden');
    }

    function closeModal() {
        if (!isModalOpen) return;
        isModalOpen = false;
        elements.modal.classList.remove('visible');
        elements.overlay.classList.remove('visible');
        setTimeout(() => {
            elements.icon.classList.remove('hidden');
        }, 100);
    }

    function addCustomEvent() {
        const lang = LANGUAGES[currentLang];
        const customTemplate = {
            tableName: 'events',
            properties: [
                { key: 'event_name', value: '' },
                { key: 'product_id', value: '' },
                { key: 'collection_name', value: '' },
                { key: 'amount', value: '' },
                { key: 'currency', value: 'BRL' }
            ]
        };

        const customCard = createEventCard(customTemplate, 0);
        customCard.querySelector('.event-title').textContent = lang.events[0].title;
        customCard.querySelector('.event-desc').textContent = lang.events[0].description;
        
        elements.eventsContainer.prepend(customCard);
        allCards.push(customCard);
        
        toggleCard(customCard);
        customCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // ==================== LANGUAGE SWITCH ====================
    function switchLanguage(lang) {
        if (currentLang === lang) return;
        currentLang = lang;

        const langData = LANGUAGES[currentLang];

        // Update buttons
        elements.langBtnTr.classList.toggle('active', lang === 'pt');
        elements.langBtnEn.classList.toggle('active', lang === 'en');

        // Update header
        const modalHeader = elements.modal.querySelector('.modal-header-left');
        modalHeader.querySelector('h2').textContent = langData.modalTitle;
        modalHeader.querySelector('p').textContent = langData.modalSubtitle;

        // Update help box
        elements.helpBox.innerHTML = `
            <strong>${langData.helpTitle}</strong>
            <p>${langData.helpText}</p>
        `;

        // Update add custom button
        elements.addCustomBtn.textContent = langData.addCustomBtn;

        // Update icon
        const iconContent = elements.icon.querySelector('.icon-content');
        iconContent.querySelector('strong').textContent = langData.iconTitle;
        iconContent.querySelector('small').textContent = langData.iconSubtitle;

        // Update all event cards
        allCards.forEach(card => {
            const index = parseInt(card.dataset.index);
            if (index >= 0 && index < langData.events.length) {
                const eventData = langData.events[index];
                card.querySelector('.event-title').textContent = eventData.title;
                card.querySelector('.event-desc').textContent = eventData.description;
            }

            // Update table label
            const tableLabel = card.querySelector('.table-name-row label');
            if (tableLabel) tableLabel.textContent = langData.tableNameLabel;

            // Update add field button
            const addBtn = card.querySelector('.add-field-btn');
            if (addBtn) addBtn.textContent = langData.addFieldBtn;

            // Update send button
            const sendBtn = card.querySelector('.send-btn');
            if (sendBtn) sendBtn.textContent = langData.sendBtn;

            // Update status
            const status = card.querySelector('.event-status');
            if (status && !status.classList.contains('error')) {
                status.textContent = langData.statusReady;
            }

            // Update field placeholders
            const fieldRows = card.querySelectorAll('.field-row');
            fieldRows.forEach(row => {
                row.querySelector('.field-key').placeholder = langData.keyPlaceholder;
                row.querySelector('.field-value').placeholder = langData.valuePlaceholder;
            });
        });
    }

    // ==================== INIT ====================
    function init() {
        if (document.getElementById('event-modal-icon')) return;

        injectStyles();

        // Create UI
        elements.icon = createIcon();
        elements.overlay = createOverlay();
        const modalData = createModal();
        elements.modal = modalData.modal;
        elements.eventsContainer = modalData.eventsContainer;
        elements.langBtnTr = modalData.langBtnTr;
        elements.langBtnEn = modalData.langBtnEn;
        elements.helpBox = modalData.helpBox;
        elements.addCustomBtn = modalData.addCustomBtn;

        // Append to DOM
        document.body.appendChild(elements.icon);
        document.body.appendChild(elements.overlay);
        document.body.appendChild(elements.modal);

        // Create event cards
        EVENT_TEMPLATES.forEach((template, index) => {
            const card = createEventCard(template, index);
            elements.eventsContainer.appendChild(card);
            allCards.push(card);
        });

        // Icon click
        elements.icon.onclick = openModal;

        // ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeModal();
        });
    }

    // Auto init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();


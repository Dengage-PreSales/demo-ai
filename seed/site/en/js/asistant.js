function BottomAssistant() {
    // Eğer assistant zaten varsa, tekrar oluşturma
    if (document.getElementById('bottom-assistant')) {
        return;
    }

    // Assistant container oluştur
    const assistant = document.createElement('div');
    assistant.id = 'bottom-assistant';

    // Assistant header (kapalı halde görünecek)
    const assistantHeader = document.createElement('div');
    assistantHeader.id = 'bottom-assistant-header';
    assistantHeader.innerHTML = `
        <div class="assistant-header-content">
            <div class="assistant-header-icon">◆</div>
            <div class="assistant-header-text">
                <div class="assistant-header-title">CantuPneus Advisor</div>
                <div class="assistant-header-subtitle">Sizes, availability per branch and payment terms.</div>
            </div>
            <div class="assistant-header-actions">
                <div class="assistant-header-arrow">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M7 14L12 9L17 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <button class="assistant-close-btn" aria-label="Close">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
            </div>
        </div>
    `;

    // Assistant content (açıldığında görünecek)
    const assistantContent = document.createElement('div');
    assistantContent.id = 'bottom-assistant-content';
    assistantContent.innerHTML = `
        <div class="assistant-content-wrapper">

            <div class="assistant-spotlight-section">
                <span class="assistant-eyebrow">Support</span>
                <h3>Find the right size with CantuPneus.</h3>
                <p>Browse the lines in stock, simulate a full load or talk to an advisor about company credit.</p>
            </div>

            <div class="assistant-action-buttons">
                <a href="#collections"
                   class="assistant-action-btn assistant-action-primary"
                   data-action="explore-collections">
                    View catalog
                </a>
                <a href="#contact"
                   class="assistant-action-btn"
                   data-action="book-consultation">
                    Book Private Consultation
                </a>
                <a href="#craftsmanship"
                   class="assistant-action-btn"
                   data-action="pneus-care">
                    Pós-venda & Craft
                </a>
            </div>

        </div>
    `;

    assistant.appendChild(assistantHeader);
    assistant.appendChild(assistantContent);

    // Styles - CantuPneus gold/ivory theme
    const style = document.createElement('style');
    style.textContent = `
        #bottom-assistant {
            position: fixed;
            bottom: 0;
            right: 30px;
            width: 400px;
            max-width: calc(100vw - 60px);
            background: #f6f4fa;
            border-radius: 16px 16px 0 0;
            box-shadow: 0 -8px 32px rgba(28, 28, 28, 0.18);
            border: 1px solid rgba(184, 134, 11, 0.25);
            border-bottom: none;
            z-index: 9999;
            transform: translateY(calc(100% - 106px));
            transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            overflow: hidden;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }

        #bottom-assistant.assistant-open {
            transform: translateY(0);
        }

        #bottom-assistant.assistant-dismissed {
            display: none;
        }

        #bottom-assistant-header {
            background: linear-gradient(135deg, #1A1030 0%, #35015F 58%, #4E018F 100%);
            color: #fff;
            padding: 18px 24px;
            cursor: pointer;
            user-select: none;
            transition: background 0.2s ease;
            border-radius: 16px 16px 0 0;
        }

        #bottom-assistant-header:hover {
            background: linear-gradient(135deg, #1A1030 0%, #4E018F 58%, #4E018F 100%);
        }

        .assistant-header-content {
            display: flex;
            align-items: center;
            gap: 16px;
        }

        .assistant-header-icon {
            width: 42px;
            height: 42px;
            border-radius: 50%;
            border: 1px solid rgba(255, 255, 255, 0.45);
            background: rgba(255, 255, 255, 0.14);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 22px;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
            animation: bounce 2s infinite;
        }

        @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-5px); }
        }

        .assistant-header-text {
            flex: 1;
        }

        .assistant-header-title {
            font-size: 18px;
            font-weight: 700;
            color: #fff;
            margin-bottom: 4px;
            letter-spacing: 0.04em;
        }

        .assistant-header-subtitle {
            font-size: 13px;
            color: rgba(255, 255, 255, 0.9);
            font-weight: 500;
        }

        .assistant-header-actions {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .assistant-header-arrow {
            color: #fff;
            transition: transform 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        #bottom-assistant.assistant-open .assistant-header-arrow {
            transform: rotate(180deg);
        }

        .assistant-close-btn {
            background: rgba(255, 255, 255, 0.2);
            border: none;
            width: 32px;
            height: 32px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            color: #fff;
            transition: all 0.2s ease;
            padding: 0;
            position: relative;
            z-index: 10;
            flex-shrink: 0;
        }

        .assistant-close-btn svg {
            pointer-events: none;
        }

        .assistant-close-btn:hover {
            background: rgba(255, 255, 255, 0.3);
        }

        .assistant-close-btn:active {
            background: rgba(255, 255, 255, 0.15);
        }

        #bottom-assistant-content {
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            background: #f6f4fa;
        }

        #bottom-assistant.assistant-open #bottom-assistant-content {
            max-height: 600px;
        }

        .assistant-content-wrapper {
            padding: 24px 24px;
        }

        .assistant-spotlight-section {
            margin-bottom: 24px;
            padding: 20px;
            background: #ffffff;
            border: 1px solid rgba(184, 134, 11, 0.2);
            border-radius: 14px;
            box-shadow: inset 0 0 0 1px rgba(255,255,255,0.5);
        }

        .assistant-eyebrow {
            display: inline-block;
            margin-bottom: 10px;
            color: #35015F;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.14em;
            text-transform: uppercase;
        }

        .assistant-spotlight-section h3 {
            margin: 0 0 8px;
            color: #1A1030;
            font-family: 'Barlow Condensed', Georgia, serif;
            font-size: 25px;
            font-weight: 500;
            line-height: 1.15;
        }

        .assistant-spotlight-section p {
            font-size: 14px;
            margin: 0;
            line-height: 1.5;
            color: #3A3A3A;
        }

        .assistant-action-buttons {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-bottom: 0;
        }

        .assistant-action-btn {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 14px 16px;
            color: #1A1030;
            background: #ffffff;
            border: 1px solid rgba(166, 144, 128, 0.28);
            border-radius: 12px;
            font-size: 14px;
            font-weight: 700;
            text-decoration: none;
            transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
            overflow: hidden;
        }

        .assistant-action-btn::after {
            content: '→';
            color: #35015F;
            font-size: 16px;
        }

        .assistant-action-btn:hover {
            border-color: #4E018F;
            box-shadow: 0 6px 18px rgba(184, 134, 11, 0.16);
            transform: translateY(-2px);
        }

        .assistant-action-primary {
            background: #1A1030;
            color: #F6F4FA;
            border-color: #1A1030;
        }

        .assistant-action-primary::after {
            color: #4E018F;
        }

        /* Desktop */
        @media (min-width: 769px) {
            .assistant-spotlight-section {
                display: block;
            }
        }

        /* Mobile */
        @media (max-width: 768px) {
            #bottom-assistant {
                right: 15px;
                width: calc(100vw - 30px);
                max-width: 400px;
            }

            .assistant-action-buttons {
                margin-bottom: 0;
            }

            .assistant-content-wrapper {
                padding: 24px 20px;
            }
        }

        @media (max-width: 480px) {
            #bottom-assistant {
                right: 10px;
                width: calc(100vw - 20px);
            }

            #bottom-assistant-header {
                padding: 14px 18px;
            }

            .assistant-header-title {
                font-size: 16px;
            }

            .assistant-header-subtitle {
                font-size: 12px;
            }
        }
    `;
    document.head.appendChild(style);

    // Assistant'ı sayfaya ekle
    document.body.appendChild(assistant);

    // Toggle fonksiyonu
    let isOpen = false;
    let isDismissed = false;

    function openAssistant() {
        if (isOpen || isDismissed) return;
        isOpen = true;
        assistant.classList.add('assistant-open');

        if (typeof window.dataLayer !== 'undefined') {
            window.dataLayer.push({
                event: 'dengage',
                actionType: 'bottom-assistant-opened',
                widgetName: 'Bottom Assistant',
                category: 'On Site Scenarios'
            });
        }
    }

    function closeAssistant() {
        if (!isOpen) return;
        isOpen = false;
        assistant.classList.remove('assistant-open');

        if (typeof window.dataLayer !== 'undefined') {
            window.dataLayer.push({
                event: 'dengage',
                actionType: 'bottom-assistant-closed',
                widgetName: 'Bottom Assistant',
                category: 'On Site Scenarios'
            });
        }
    }

    function dismissAssistant() {
        isDismissed = true;
        isOpen = false;
        assistant.classList.remove('assistant-open');
        assistant.classList.add('assistant-dismissed');

        if (typeof window.dataLayer !== 'undefined') {
            window.dataLayer.push({
                event: 'dengage',
                actionType: 'bottom-assistant-dismissed',
                widgetName: 'Bottom Assistant',
                category: 'On Site Scenarios'
            });
        }
    }

    const closeBtn = assistant.querySelector('.assistant-close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            dismissAssistant();
        });
    }

    assistantHeader.addEventListener('click', function(e) {
        if (e.target.closest('.assistant-close-btn') || e.target.closest('button.assistant-close-btn')) {
            return;
        }
        if (isDismissed) {
            return;
        }
        if (isOpen) {
            closeAssistant();
        } else {
            openAssistant();
        }
    });

    const actionButtons = assistant.querySelectorAll('.assistant-action-btn');
    actionButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const actionType = this.getAttribute('data-action');
            if (typeof window.dataLayer !== 'undefined') {
                window.dataLayer.push({
                    event: 'dengage',
                    actionType: actionType,
                    widgetName: 'CantuPneus Advisor',
                    category: 'On Site Scenarios',
                    assistantAction: actionType
                });
            }
        });
    });

    window.openBottomAssistant = function() {
        if (!isDismissed && !isOpen) {
            openAssistant();
        }
    };
}


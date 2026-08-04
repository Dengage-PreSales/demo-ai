function earingWidget() {
    // Konfigürasyon
    const config = {
        position: 'left', // 'left' veya 'right'
        menuItems: [
            { text: "View catalog", url: "#collections" },
            { text: "Truck highlights", url: "#collections" },
            { text: "Qualidade", url: "#craftsmanship" },
            { text: "Our story", url: "#story" },
            { text: "Talk to an advisor", url: "#contact" }
        ],
        tabText: "CantuPneus Advisor",
        tabColor: "#35015F", // CantuPneus gold
        closedOffset: -280 // Kapalıyken kaydırma mesafesi
    };

    // State
    let isOpen = false;
    let widget = null;
    let menu = null;
    let tab = null;

    // Stil enjekte et
    function injectStyles() {
        const styleId = 'earing-widget-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            #earing-widget {
                position: fixed;
                top: 50%;
                transform: translateY(-50%);
                z-index: 9999;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                display: flex;
                align-items: center;
                transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }

            #earing-widget.position-left.open {
                left: 0;
            }

            #earing-widget.position-left {
                left: 40px;
            }

            #earing-widget.position-right {
                right: 40px;
                flex-direction: row-reverse;
            }
            #earing-widget.position-right.open {
                right: 0;
            }
            #earing-widget.closed.position-left {
                transform: translateY(-50%) translateX(calc(-240px - 40px));
            }

            #earing-widget.closed.position-right {
                transform: translateY(-50%) translateX(calc(240px + 40px));
            }

            #earing-menu {
                background: #f6f4fa;
                border-radius: 12px 0 0 12px;
                box-shadow: 0 8px 28px rgba(28, 28, 28, 0.18);
                border: 1px solid rgba(184, 134, 11, 0.24);
                padding: 20px 16px;
                min-width: 240px;
                display: flex;
                flex-direction: column;
                gap: 12px;
            }

            #earing-widget.position-right #earing-menu {
                border-radius: 0 12px 12px 0;
            }

            #earing-menu-item {
                background: #ffffff;
                border: 1px solid rgba(166, 144, 128, 0.25);
                border-radius: 8px;
                padding: 14px 16px;
                text-align: left;
                cursor: pointer;
                font-size: 14px;
                font-weight: 600;
                color: #1A1030;
                transition: all 0.2s ease;
                text-decoration: none;
                display: block;
                line-height: 1.4;
            }

            #earing-menu-item:hover {
                background: #ede9f5;
                border-color: rgba(184, 134, 11, 0.55);
                color: #35015F;
                transform: translateX(2px);
            }

            #earing-widget.position-right #earing-menu-item:hover {
                transform: translateX(-2px);
            }

            #earing-tab {
                background: ${config.tabColor};
                color: #ffffff;
                writing-mode: vertical-rl;
                text-orientation: mixed;
                padding: 24px 12px;
                border-radius: 0 12px 12px 0;
                cursor: pointer;
                font-size: 14px;
                font-weight: 600;
                letter-spacing: 1.2px;
                text-transform: uppercase;
                display: flex;
                align-items: center;
                justify-content: center;
                user-select: none;
                transition: background 0.2s ease;
                box-shadow: 2px 0 14px rgba(139, 105, 20, 0.25);
                min-height: 120px;
            }

            #earing-widget.position-right #earing-tab {
                border-radius: 12px 0 0 12px;
                box-shadow: -2px 0 10px rgba(0, 0, 0, 0.1);
            }

            #earing-tab:hover {
                background: #4E018F;
            }

            @media (max-width: 768px) {
                #earing-menu {
                    min-width: 200px;
                    padding: 16px 12px;
                }

                #earing-menu-item {
                    padding: 12px 14px;
                    font-size: 13px;
                }

                #earing-tab {
                    padding: 20px 10px;
                    font-size: 12px;
                }

                #earing-widget.closed.position-left {
                    transform: translateY(-50%) translateX(calc(-200px - 35px));
                }

                #earing-widget.closed.position-right {
                    transform: translateY(-50%) translateX(calc(200px + 35px));
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Menü oluştur
    function createMenu() {
        menu = document.createElement('div');
        menu.id = 'earing-menu';

        config.menuItems.forEach(item => {
            const menuItem = document.createElement('a');
            menuItem.id = 'earing-menu-item';
            menuItem.href = item.url;
            menuItem.textContent = item.text;
            menu.appendChild(menuItem);
        });

        return menu;
    }

    // Tab oluştur
    function createTab() {
        tab = document.createElement('div');
        tab.id = 'earing-tab';
        tab.textContent = config.tabText;
        tab.addEventListener('click', toggleWidget);
        return tab;
    }

    // Widget oluştur
    function createWidget() {
        widget = document.createElement('div');
        widget.id = 'earing-widget';
        widget.className = `position-${config.position} closed`;

        const menuElement = createMenu();
        const tabElement = createTab();

        widget.appendChild(menuElement);
        widget.appendChild(tabElement);

        return widget;
    }

    // Widget'ı aç/kapa
    function toggleWidget() {
        isOpen = !isOpen;
        if (isOpen) {
            widget.classList.remove('closed');
            widget.classList.add('open');
        } else {
            widget.classList.remove('open');
            widget.classList.add('closed');
        }
    }

    // Konum değiştir (sola/sağa)
    function setPosition(position) {
        if (position !== 'left' && position !== 'right') {
            console.warn('CantuPneus concierge widget: position must be "left" or "right"');
            return;
        }
        config.position = position;
        if (widget) {
            widget.className = `position-${position} ${isOpen ? 'open' : 'closed'}`;
        }
    }

    // Menü öğelerini güncelle
    function setMenuItems(items) {
        if (!Array.isArray(items)) {
            console.warn('CantuPneus concierge widget: menuItems must be an array');
            return;
        }
        config.menuItems = items;
        if (menu) {
            menu.innerHTML = '';
            items.forEach(item => {
                const menuItem = document.createElement('a');
                menuItem.id = 'earing-menu-item';
                menuItem.href = item.url || '#';
                menuItem.textContent = item.text;
                menu.appendChild(menuItem);
            });
        }
    }

    // Tab rengini değiştir
    function setTabColor(color) {
        config.tabColor = color;
        if (tab) {
            tab.style.background = color;
        }
        // Stili güncelle
        const styleElement = document.getElementById('earing-widget-styles');
        if (styleElement) {
            styleElement.textContent = styleElement.textContent.replace(
                /background: #35015F/g,
                `background: ${color}`
            );
        }
    }

    // Tab metnini değiştir
    function setTabText(text) {
        config.tabText = text;
        if (tab) {
            tab.textContent = text;
        }
    }

    // İnitialize
    function init() {
        if (document.getElementById('earing-widget')) return;

        injectStyles();
        const widgetElement = createWidget();
        document.body.appendChild(widgetElement);
    }

    // Auto init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Public API
    window.EaringWidget = {
        toggle: toggleWidget,
        open: function() {
            if (!isOpen) toggleWidget();
        },
        close: function() {
            if (isOpen) toggleWidget();
        },
        setPosition: setPosition,
        setMenuItems: setMenuItems,
        setTabColor: setTabColor,
        setTabText: setTabText,
        isOpen: function() {
            return isOpen;
        }
    };
}
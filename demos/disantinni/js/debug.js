/* Dengage eComm Demo. Generated file. Sources and notes live in the factory. */
(function (window, document) {
    'use strict';

    var PARAM = 'debug';
    var MAX_ROWS = 40;

    function slug() {
        return window.DEMO_SLUG || (window.DEMO_CONFIG && window.DEMO_CONFIG.slug) || 'demo';
    }

    function storeKey() { return 'dps:' + slug() + ':debug'; }
    function eventName() { return 'dps:' + slug() + ':event'; }

    function wanted() {
        var value = null;
        try {
            value = new URLSearchParams(window.location.search).get(PARAM);
        } catch (err) { value = null; }

        if (value === '1' || value === 'true' || value === 'on') {
            try { window.sessionStorage.setItem(storeKey(), '1'); } catch (err) {  }
            return true;
        }
        if (value === '0' || value === 'false' || value === 'off') {
            try { window.sessionStorage.removeItem(storeKey()); } catch (err) {  }
            return false;
        }
        try {
            return window.sessionStorage.getItem(storeKey()) === '1';
        } catch (err) {
            return false;
        }
    }

    if (!wanted()) return;

    var rows = [];
    var panel = null;
    var list = null;
    var countEl = null;

    function esc(text) {
        return String(text === null || text === undefined ? '' : text)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function clock(at) {
        var d = new Date(at);
        function two(n) { return (n < 10 ? '0' : '') + n; }
        return two(d.getHours()) + ':' + two(d.getMinutes()) + ':' + two(d.getSeconds());
    }

    var TABLES = {
        'pageView': 'page_view_events',
        'ec:addToCart': 'shopping_cart_events',
        'ec:removeFromCart': 'shopping_cart_events',
        'ec:deleteCart': 'shopping_cart_events',
        'ec:beginCheckout': 'shopping_cart_events',
        'ec:order': 'order_events + order_events_detail',
        'ec:cancelOrder': 'order_events',
        'ec:addToWishlist': 'wishlist_events',
        'ec:removeFromWishlist': 'wishlist_events',
        'ec:search': 'search_events'
    };

    function isDengage(url) {
        return String(url || '').indexOf('dengage.com') !== -1;
    }

    function hostOf(url) {
        try { return new URL(String(url), window.location.href).host; }
        catch (err) { return String(url).split('/')[2] || String(url); }
    }
    function pathOf(url) {
        try { return new URL(String(url), window.location.href).pathname; }
        catch (err) { return ''; }
    }

    function net(method, url, status, reason, at) {
        add({
            kind: 'net',
            method: method,
            host: hostOf(url),
            path: pathOf(url),
            status: status,
            reason: reason || '',
            at: at || Date.now()
        });
    }

    function watchTransport() {
        var originalFetch = window.fetch;
        if (typeof originalFetch === 'function') {
            window.fetch = function (input, init) {
                var url = '';
                try { url = typeof input === 'string' ? input : (input && input.url) || ''; }
                catch (err) { url = ''; }
                if (!isDengage(url)) return originalFetch.apply(this, arguments);
                var method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
                var at = Date.now();
                return originalFetch.apply(this, arguments).then(function (response) {
                    net(method, url, response.status, '', at);
                    return response;
                }, function (err) {
                    net(method, url, 0, (err && err.message) || 'no response', at);
                    throw err;
                });
            };
        }

        var XHR = window.XMLHttpRequest;
        if (XHR && XHR.prototype && XHR.prototype.send && XHR.prototype.open) {
            var open = XHR.prototype.open;
            var send = XHR.prototype.send;
            XHR.prototype.open = function (method, url) {
                this.__dpsMethod = String(method || 'GET').toUpperCase();
                this.__dpsUrl = String(url || '');
                return open.apply(this, arguments);
            };
            XHR.prototype.send = function () {
                var self = this;
                if (isDengage(self.__dpsUrl)) {
                    var at = Date.now();
                    self.addEventListener('load', function () {
                        net(self.__dpsMethod, self.__dpsUrl, self.status, '', at);
                    });
                    self.addEventListener('error', function () {
                        net(self.__dpsMethod, self.__dpsUrl, 0, 'no response', at);
                    });
                    self.addEventListener('timeout', function () {
                        net(self.__dpsMethod, self.__dpsUrl, 0, 'timed out', at);
                    });
                }
                return send.apply(this, arguments);
            };
        }

        var nav = window.navigator;
        if (nav && typeof nav.sendBeacon === 'function') {
            var beacon = nav.sendBeacon.bind(nav);
            nav.sendBeacon = function (url) {
                var queued = beacon.apply(nav, arguments);
                if (isDengage(url)) {
                    net('BEACON', url, queued ? 204 : 0, queued ? '' : 'refused by the browser');
                }
                return queued;
            };
        }
    }

    watchTransport();

    function build() {
        panel = document.createElement('aside');
        panel.id = 'dps-debug';
        panel.setAttribute('aria-label', 'Dengage event readout');
        panel.innerHTML =
            '<div class="dps-debug-head">' +
              '<strong>Events and traffic</strong>' +
              '<span id="dps-debug-count">0</span>' +
              '<button type="button" data-debug-copy title="Copy all as JSON">Copy</button>' +
              '<button type="button" data-debug-clear title="Clear the list">Clear</button>' +
              '<button type="button" data-debug-close title="Hide. Add ?debug=1 to bring it back">&times;</button>' +
            '</div>' +
            '<ol id="dps-debug-list"></ol>' +
            '<p class="dps-debug-foot">What this page sent, and every request to a ' +
            'dengage.com host. An accepted request is still not a stored row: ' +
            'confirm in Data Space.</p>';
        document.body.appendChild(panel);
        list = panel.querySelector('#dps-debug-list');
        countEl = panel.querySelector('#dps-debug-count');

        panel.addEventListener('click', function (event) {
            var t = event.target;
            if (t.hasAttribute && t.hasAttribute('data-debug-close')) {
                try { window.sessionStorage.removeItem(storeKey()); } catch (err) {  }
                panel.remove();
                return;
            }
            if (t.hasAttribute && t.hasAttribute('data-debug-clear')) {
                rows = [];
                render();
                return;
            }
            if (t.hasAttribute && t.hasAttribute('data-debug-copy')) {
                var text = JSON.stringify(rows, null, 2);
                if (window.navigator && window.navigator.clipboard) {
                    window.navigator.clipboard.writeText(text).then(function () {
                        t.textContent = 'Copied';
                        window.setTimeout(function () { t.textContent = 'Copy'; }, 1200);
                    }, function () {  });
                }
            }
        });
    }

    function add(row) {
        rows.unshift(row);
        if (rows.length > MAX_ROWS) rows.length = MAX_ROWS;
        render();
    }

    function renderEvent(row) {
        var table = TABLES[row.action] || '';
        return '<li' + (row.accepted ? '' : ' class="not-sent"') + '>' +
            '<div class="dps-debug-top">' +
              '<code>' + esc(row.action) + '</code>' +
              '<span class="dps-debug-time">' + esc(clock(row.at)) + '</span>' +
            '</div>' +
            (table ? '<div class="dps-debug-table">' + esc(table) + '</div>' : '') +
            (row.accepted
                ? '<div class="dps-debug-table">handed to the SDK. Look for the request below</div>'
                : '<div class="dps-debug-warn">not sent, no application on this page</div>') +
            '<pre>' + esc(JSON.stringify(row.payload)) + '</pre>' +
        '</li>';
    }

    function renderNet(row) {
        var ok = row.status >= 200 && row.status < 400;
        var outcome = row.status
            ? 'HTTP ' + row.status
            : 'no response' + (row.reason ? ', ' + row.reason : '');
        return '<li class="dps-net' + (ok ? '' : ' not-sent') + '">' +
            '<div class="dps-debug-top">' +
              '<code>' + esc(row.method + ' ' + row.host) + '</code>' +
              '<span class="dps-debug-time">' + esc(clock(row.at)) + '</span>' +
            '</div>' +
            '<div class="dps-debug-table">' + esc(row.path) + '</div>' +
            (ok
                ? '<div class="dps-debug-table">' + esc(outcome) + '. Accepted, which is not the same as stored</div>'
                : '<div class="dps-debug-warn">' + esc(outcome) +
                  '. Nothing reached Dengage. A content blocker or a DNS filter on this ' +
                  'device is the usual cause, and it can block one host while allowing ' +
                  'the next</div>') +
        '</li>';
    }

    function render() {
        if (!list) return;
        list.innerHTML = rows.map(function (row) {
            return row.kind === 'net' ? renderNet(row) : renderEvent(row);
        }).join('');
        if (countEl) countEl.textContent = String(rows.length);
    }

    window.addEventListener(eventName(), function (event) {
        var detail = event.detail || {};
        add({
            kind: 'event',
            action: detail.action,
            payload: detail.payload,

            accepted: !!detail.accepted,
            at: detail.at || Date.now()
        });
    });

    if (document.body) build();
    else document.addEventListener('DOMContentLoaded', build);
})(window, document);

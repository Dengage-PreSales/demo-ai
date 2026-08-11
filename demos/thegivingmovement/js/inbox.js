/* Dengage eComm Demo. Generated file. Sources and notes live in the factory. */
(function (window, document) {
    'use strict';

    function config() { return window.DEMO_CONFIG || {}; }
    function copy() { return window.DEMO_COPY || {}; }

    var $ = function (sel, root) { return (root || document).querySelector(sel); };

    function t(key, vars) {
        var text = copy()[key] || key;
        Object.keys(vars || {}).forEach(function (name) {
            text = text.replace('{' + name + '}', vars[name]);
        });
        return text;
    }

    var slug = window.DEMO_SLUG || 'demo';
    var READ_KEY = 'dps:' + slug + ':inbox-read';
    var HIDDEN_KEY = 'dps:' + slug + ':inbox-hidden';

    function read(key) {
        try {
            var raw = window.localStorage.getItem(key);
            var parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (err) { return []; }
    }

    function write(key, value) {
        try { window.localStorage.setItem(key, JSON.stringify(value)); }
        catch (err) {  }
    }

    var readIds = read(READ_KEY);
    var hiddenIds = read(HIDDEN_KEY);
    var messages = [];
    var state = 'starting';
    var reported = {};

    function pick(message, names) {
        var sources = [message, message && message.messageJson, message && message.message_json];
        for (var s = 0; s < sources.length; s++) {
            var source = sources[s];
            if (!source || typeof source !== 'object') continue;
            for (var n = 0; n < names.length; n++) {
                var value = source[names[n]];
                if (value !== null && value !== undefined && value !== '') return value;
            }
        }
        return null;
    }

    function messageId(message) {
        var id = pick(message, ['smsgId', 'smsg_id', 'messageId', 'id']);
        return id === null ? null : String(id);
    }

    function messageTitle(message) {
        var value = pick(message, ['title', 'messageTitle', 'header', 'subject']);
        return value === null ? null : String(value);
    }

    function messageBody(message) {
        var value = pick(message, ['message', 'body', 'messageBody', 'text', 'content']);
        return value === null ? null : String(value);
    }

    function messageMedia(message) {
        var value = pick(message, ['mediaUrl', 'media_url', 'media', 'image',
                                   'imageUrl', 'image_url', 'iconUrl', 'icon']);
        if (value === null) return null;
        var text = String(value);
        return /^https?:\/\//i.test(text) ? text : null;
    }

    function messageUrl(message) {
        var value = pick(message, ['targetUrl', 'target_url', 'url', 'link', 'deepLink']);
        if (value === null) return null;
        var text = String(value);
        return /^https?:\/\//i.test(text) ? text : null;
    }

    function messageDate(message) {
        var value = pick(message, ['sendDate', 'sentDate', 'receivedDate', 'createDate',
                                   'sent_time', 'sentTime', 'eventDate', 'date']);
        if (value === null) return null;
        var when = new Date(value);
        return isFinite(when.getTime()) ? when : null;
    }

    function messageButtons(message) {
        var list = pick(message, ['actionButtons', 'action_buttons', 'buttons', 'actions']);
        if (!Array.isArray(list)) return [];
        return list.map(function (button, index) {
            if (!button || typeof button !== 'object') return null;
            var label = button.text || button.title || button.label || button.caption;
            if (!label) return null;
            return {
                id: String(button.id || button.buttonId || button.action || ('button-' + index)),
                label: String(label),
                url: /^https?:\/\//i.test(String(button.targetUrl || button.url || ''))
                    ? String(button.targetUrl || button.url) : null
            };
        }).filter(Boolean);
    }

    function visible() {
        return messages.filter(function (message) {
            var id = messageId(message);
            return id !== null && hiddenIds.indexOf(id) === -1;
        });
    }

    function unreadCount() {
        return visible().filter(function (message) {
            return readIds.indexOf(messageId(message)) === -1;
        }).length;
    }

    function escapeText(value) {
        return window.Catalog && window.Catalog.escapeText
            ? window.Catalog.escapeText(value)
            : String(value === null || value === undefined ? '' : value)
                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
    }

    function stamp(when) {
        if (!when) return '';
        var mins = Math.round((Date.now() - when.getTime()) / 60000);
        if (mins < 1) return t('inboxJustNow');
        if (mins < 60) return t('inboxMinutes', { n: mins });
        if (mins < 60 * 24) return t('inboxHours', { n: Math.round(mins / 60) });
        try {
            return when.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
        } catch (err) {
            return t('inboxHours', { n: Math.round(mins / 60) });
        }
    }

    function emptyBlock() {
        if (state === 'dry') {
            return '<p class="empty">' + t('inboxNoSdk') + '</p>';
        }
        if (state === 'starting') {
            return '<p class="empty">' + t('inboxStarting') + '</p>';
        }
        if (state === 'error') {
            return '<p class="empty">' + t('inboxError') + '</p>';
        }
        return '<p class="empty">' + t('inboxEmpty') + '</p>' +
               '<p class="empty-hint">' + t('inboxEmptyHint') + '</p>';
    }

    function messageBlock(message) {
        var id = messageId(message);
        var isRead = readIds.indexOf(id) !== -1;
        var title = messageTitle(message);
        var body = messageBody(message);
        var media = messageMedia(message);
        var url = messageUrl(message);
        var when = messageDate(message);
        var buttons = messageButtons(message);

        var html = '<article class="inbox-item' + (isRead ? ' read' : ' unread') +
                   '" data-inbox-id="' + escapeText(id) + '">';

        if (media) {
            html += '<div class="inbox-media"><img src="' + escapeText(media) +
                    '" alt="" loading="lazy"></div>';
        } else {
            html += '<div class="inbox-media empty"></div>';
        }

        html += '<div class="inbox-text">';
        html += '<div class="inbox-top">';

        html += '<h3>' + (isRead ? '' : '<span class="dot" aria-hidden="true"></span>') +
                escapeText(title || t('inboxUntitled')) + '</h3>';
        if (when) html += '<span class="inbox-when">' + escapeText(stamp(when)) + '</span>';
        html += '</div>';
        if (body) html += '<p>' + escapeText(body) + '</p>';

        html += '<div class="inbox-actions">';
        if (url) {

            html += '<a class="btn btn-small" href="' + escapeText(url) +
                    '" target="_blank" rel="noopener"' +
                    ' data-inbox-open="' + escapeText(id) + '">' + t('inboxOpen') + '</a>';
        }
        buttons.forEach(function (button) {
            html += '<button type="button" class="btn btn-small btn-quiet"' +
                    ' data-inbox-button="' + escapeText(button.id) + '"' +
                    ' data-inbox-id="' + escapeText(id) + '"' +
                    (button.url ? ' data-inbox-href="' + escapeText(button.url) + '"' : '') +
                    '>' + escapeText(button.label) + '</button>';
        });

        html += '<button type="button" class="link-btn dismiss" data-inbox-dismiss="' +
                escapeText(id) + '">' + t('inboxDismiss') + '</button>';
        html += '</div>';

        html += '</div></article>';
        return html;
    }

    function render() {
        var body = $('#inbox-body');
        var list = visible();
        var n = unreadCount();

        if (body) {
            body.innerHTML = list.length
                ? list.map(messageBlock).join('')
                : emptyBlock();

            var anyMedia = list.some(function (message) { return !!messageMedia(message); });
            body.classList.toggle('with-media', anyMedia);
        }

        var count = $('#inbox-count');
        if (count) {
            count.textContent = n ? t('inboxUnread', { n: n }) : '';
            count.hidden = n === 0;
        }

        var badge = $('#inbox-badge');
        if (badge) {
            badge.textContent = n;
            badge.hidden = n === 0;
        }

        hideBrokenMedia();

        if (isOpen()) reportImpressions(list);
    }

    function hideBrokenMedia() {
        var images = document.querySelectorAll('#inbox-body .inbox-media img');
        Array.prototype.forEach.call(images, function (img) {

            if (img.complete && img.naturalWidth === 0) { drop(img); return; }
            img.addEventListener('error', function () { drop(img); });
        });
        function drop(img) {
            var holder = img.parentNode;
            if (holder && holder.parentNode) holder.parentNode.removeChild(holder);
        }
    }

    function isOpen() {
        var drawer = $('#inbox');
        return !!(drawer && drawer.classList.contains('open'));
    }

    function reportImpressions(list) {
        list.forEach(function (message) {
            var id = messageId(message);
            if (!id || reported[id]) return;
            reported[id] = true;
            window.DengageEvents.inboxImpression(id);
        });
    }

    var refreshing = false;

    function refresh() {
        if (refreshing) return Promise.resolve(state);
        refreshing = true;
        return window.DengageEvents.inboxMessages().then(function (result) {
            refreshing = false;
            state = result.status;
            messages = result.list;
            if (window.console && messages.length) {

                console.log('[inbox] ' + messages.length + ' message(s), first raw:', messages[0]);
            }
            render();
            return state;
        }, function () {
            refreshing = false;
            state = 'error';
            render();
            return state;
        });
    }

    function settle(tries) {
        tries = tries || 0;
        return refresh().then(function (status) {
            if (status !== 'starting' || tries >= 5) return status;
            return new Promise(function (resolve) {
                window.setTimeout(function () { resolve(settle(tries + 1)); }, 1000 * (tries + 2));
            });
        });
    }

    function markRead(id) {
        if (!id || readIds.indexOf(id) !== -1) return;
        readIds.push(id);
        write(READ_KEY, readIds);
    }

    function open(id) {
        markRead(id);
        window.DengageEvents.inboxOpen(id);
        render();
    }

    function click(id, buttonId) {
        markRead(id);
        window.DengageEvents.inboxClick(id, buttonId);
        render();
    }

    function dismiss(id) {
        if (!id) return;
        if (hiddenIds.indexOf(id) === -1) {
            hiddenIds.push(id);
            write(HIDDEN_KEY, hiddenIds);
        }
        window.DengageEvents.inboxDelete(id);
        render();
    }

    function wire() {
        var body = $('#inbox-body');
        if (!body) return;

        body.addEventListener('click', function (event) {
            var el = event.target.closest
                ? event.target.closest('[data-inbox-open],[data-inbox-button],[data-inbox-dismiss]')
                : null;
            if (!el) return;

            if (el.hasAttribute('data-inbox-dismiss')) {
                event.preventDefault();
                dismiss(el.getAttribute('data-inbox-dismiss'));
                return;
            }
            if (el.hasAttribute('data-inbox-button')) {
                event.preventDefault();
                var buttonId = el.getAttribute('data-inbox-button');
                var owner = el.getAttribute('data-inbox-id');
                click(owner, buttonId);
                var href = el.getAttribute('data-inbox-href');
                if (href) window.open(href, '_blank', 'noopener');
                return;
            }

            open(el.getAttribute('data-inbox-open'));
        });

        var refreshBtn = $('#inbox-refresh');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', function () { refresh(); });
        }

        var trigger = document.querySelector('[data-open="#inbox"]');
        if (trigger) {
            trigger.addEventListener('click', function () {
                refresh();
            });
        }
    }

    function boot() {
        wire();
        render();
        settle();
    }

    window.Inbox = {
        boot: boot,

        refresh: refresh,
        unreadCount: unreadCount,

        parse: {
            id: messageId,
            title: messageTitle,
            body: messageBody,
            media: messageMedia,
            url: messageUrl,
            date: messageDate,
            buttons: messageButtons
        },
        keys: { read: READ_KEY, hidden: HIDDEN_KEY }
    };
})(window, document);

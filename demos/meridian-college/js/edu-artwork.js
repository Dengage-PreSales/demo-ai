/* Every picture on this site is drawn here, as inline SVG, from the theme's own
   colours.

   The storefront template made the same call for product photography and the
   reasoning carries over unchanged: a demo must never depend on a host we do not
   control at call time, and stock photography of students is both the wrong
   students and a question nobody wants to answer on a sales call. Generated
   artwork is always on palette, costs no requests, and is honest about being a
   drawing.

   Two rules it keeps:

   1. No photograph of a real person appears anywhere on this site. Portraits are
      geometric, built from a name, and look like nobody.
   2. Nothing drawn here can be mistaken for data. No figure, no percentage, no
      fee. A drawing is never a claim. */
(function (window, document) {
    'use strict';

    /* Stable per subject, per person, per house. The same name always draws the
       same picture, on every page and every reload, because variation seeded
       from Math.random would change a face while a prospect is looking at it. */
    function seed(text) {
        var hash = 0, i;
        text = String(text || '');
        for (i = 0; i < text.length; i++) {
            hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
        }
        return Math.abs(hash);
    }

    function pick(list, text, offset) {
        return list[(seed(text) + (offset || 0)) % list.length];
    }

    function initials(name) {
        var words = String(name || '').replace(/^(Sir|Miss|Mr|Mrs|Ms|Dr)\.?\s+/i, '').split(/\s+/);
        var first = (words[0] || '?').charAt(0);
        var last = words.length > 1 ? words[words.length - 1].charAt(0) : '';
        return (first + last).toUpperCase();
    }

    var PORTRAIT_INK = ['#622d91', '#4b2170', '#2b1240', '#7a44ab', '#3f1f63'];
    var PORTRAIT_BG = ['#f2ecf8', '#f6f4ee', '#efeaf6', '#f4f1ea'];

    /* -------------------------------------------------------------- hero */

    /* The campus at dusk. Building blocks, lit windows, a moon and a skyline,
       none of it a photograph of anywhere. */
    function heroScene() {
        var windows = '';
        var blocks = [
            { x: 60, y: 300, w: 150, h: 320 },
            { x: 230, y: 220, w: 190, h: 400 },
            { x: 440, y: 340, w: 130, h: 280 },
            { x: 760, y: 260, w: 210, h: 360 },
            { x: 990, y: 330, w: 150, h: 290 },
            { x: 1160, y: 240, w: 180, h: 380 }
        ];
        var shapes = '';
        blocks.forEach(function (b, index) {
            shapes += '<rect x="' + b.x + '" y="' + b.y + '" width="' + b.w + '" height="' + b.h +
                      '" rx="4" fill="url(#eduTower)" opacity="0.92"/>';
            var cols = Math.floor(b.w / 34);
            var rows = Math.floor(b.h / 42);
            for (var r = 0; r < rows; r++) {
                for (var c = 0; c < cols; c++) {
                    var lit = (seed(index + ':' + r + ':' + c) % 10) > 4;
                    if (!lit) continue;
                    windows += '<rect x="' + (b.x + 14 + c * 34) + '" y="' + (b.y + 18 + r * 42) +
                               '" width="13" height="19" rx="2" fill="#f0b323" opacity="' +
                               (0.35 + (seed(index + '-' + r + c) % 50) / 100) + '"/>';
                }
            }
        });
        return '<svg viewBox="0 0 1440 700" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">' +
            '<defs>' +
            '<linearGradient id="eduSky" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0" stop-color="#150a24"/><stop offset="0.55" stop-color="#2b1240"/>' +
            '<stop offset="1" stop-color="#4b2170"/></linearGradient>' +
            '<linearGradient id="eduTower" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0" stop-color="#1d1030"/><stop offset="1" stop-color="#100819"/></linearGradient>' +
            '</defs>' +
            '<rect width="1440" height="700" fill="url(#eduSky)"/>' +
            '<circle cx="1180" cy="130" r="54" fill="#f0b323" opacity="0.18"/>' +
            '<circle cx="1180" cy="130" r="34" fill="#f0b323" opacity="0.55"/>' +
            starField() +
            /* The central hall, the one thing that reads as a college */
            '<path d="M590 620V330l150-96 150 96v290z" fill="url(#eduTower)"/>' +
            '<path d="M560 336 740 218l180 118v16H560z" fill="#622d91" opacity="0.85"/>' +
            '<rect x="700" y="470" width="80" height="150" rx="6" fill="#f0b323" opacity="0.55"/>' +
            '<circle cx="740" cy="300" r="26" fill="#f0b323" opacity="0.75"/>' +
            shapes + windows +
            '<rect y="618" width="1440" height="82" fill="#0a0512"/>' +
            '</svg>';
    }

    function starField() {
        var out = '';
        for (var i = 0; i < 60; i++) {
            var x = (seed('star-x' + i) % 1440);
            var y = (seed('star-y' + i) % 260);
            var r = 0.8 + (seed('star-r' + i) % 12) / 10;
            out += '<circle cx="' + x + '" cy="' + y + '" r="' + r.toFixed(1) +
                   '" fill="#ffffff" opacity="' + (0.15 + (seed('star-o' + i) % 40) / 100).toFixed(2) + '"/>';
        }
        return out;
    }

    /* The campus block that sits beside the introduction. */
    function campusArt() {
        return '<svg viewBox="0 0 640 420" aria-hidden="true" focusable="false">' +
            '<defs><linearGradient id="eduDusk" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0" stop-color="#2b1240"/><stop offset="1" stop-color="#622d91"/>' +
            '</linearGradient></defs>' +
            '<rect width="640" height="420" fill="url(#eduDusk)"/>' +
            '<rect x="80" y="120" width="220" height="240" rx="6" fill="#150a24"/>' +
            '<rect x="320" y="70" width="240" height="290" rx="6" fill="#1d1030"/>' +
            '<path d="M300 120h40v240h-40z" fill="#622d91" opacity="0.5"/>' +
            gridWindows(96, 140, 6, 5, 32, 40) +
            gridWindows(340, 92, 6, 6, 34, 42) +
            '<rect x="392" y="266" width="96" height="94" rx="4" fill="#f0b323" opacity="0.5"/>' +
            '<rect y="358" width="640" height="62" fill="#0a0512"/>' +
            '<circle cx="120" cy="330" r="26" fill="#0a0512"/>' +
            '<rect x="114" y="330" width="12" height="34" fill="#0a0512"/>' +
            '<circle cx="540" cy="322" r="32" fill="#0a0512"/>' +
            '<rect x="533" y="322" width="14" height="40" fill="#0a0512"/>' +
            '</svg>';
    }

    function gridWindows(x, y, cols, rows, dx, dy) {
        var out = '';
        for (var r = 0; r < rows; r++) {
            for (var c = 0; c < cols; c++) {
                if ((seed('w' + x + r + c) % 10) < 4) continue;
                out += '<rect x="' + (x + c * dx) + '" y="' + (y + r * dy) +
                       '" width="16" height="22" rx="2" fill="#f0b323" opacity="' +
                       (0.3 + (seed('wo' + x + r + c) % 50) / 100).toFixed(2) + '"/>';
            }
        }
        return out;
    }

    /* ------------------------------------------------------- subject motifs */

    var MOTIFS = {
        physics: '<circle cx="12" cy="12" r="2.4"/><ellipse cx="12" cy="12" rx="10" ry="4.4"/>' +
                 '<ellipse cx="12" cy="12" rx="10" ry="4.4" transform="rotate(60 12 12)"/>' +
                 '<ellipse cx="12" cy="12" rx="10" ry="4.4" transform="rotate(120 12 12)"/>',
        chemistry: '<path d="M9 3h6"/><path d="M10 3v6.2L4.6 18.4A2 2 0 0 0 6.3 21h11.4a2 2 0 0 0 1.7-2.6L14 9.2V3"/>' +
                   '<path d="M7.4 15h9.2"/>',
        biology: '<path d="M12 21c0-6 4-9 8-10-1 6-4 9-8 10z"/><path d="M12 21c0-6-4-9-8-10 1 6 4 9 8 10z"/>' +
                 '<path d="M12 21V8"/><path d="M12 8a4 4 0 1 1 0-5 4 4 0 0 1 0 5z"/>',
        maths: '<path d="M4 5h7l-4 7 4 7H4"/><path d="M14 8h6"/><path d="M14 12h6"/><path d="M17 16v4"/><path d="M14 18h6"/>',
        computing: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>' +
                   '<path d="M9 9l-2 2 2 2"/><path d="M15 9l2 2-2 2"/>',
        accounting: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8"/><path d="M8 11h3"/>' +
                    '<path d="M13 11h3"/><path d="M8 15h3"/><path d="M13 15v4"/>',
        business: '<path d="M3 20h18"/><rect x="5" y="11" width="4" height="9"/><rect x="10" y="6" width="4" height="14"/>' +
                  '<rect x="15" y="14" width="4" height="6"/>',
        economics: '<path d="M3 18l5-6 4 3 5-8"/><path d="M14 7h4v4"/><path d="M3 21h18"/>',
        law: '<path d="M12 3v18"/><path d="M6 21h12"/><path d="M4 7h16"/><path d="M7 7l-3 6h6z"/><path d="M17 7l-3 6h6z"/>',
        psychology: '<path d="M9 20v-2.6A6 6 0 1 1 17 12c0 1.6 1 2 1 3s-1 1-1 1h-2v2a2 2 0 0 1-2 2z"/>' +
                    '<path d="M12 9.5a1.5 1.5 0 1 1 1.4 1.5c-.8.2-1.4.8-1.4 1.7"/>',
        sociology: '<circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/>' +
                   '<path d="M3 20c0-3 2.2-5 5-5s5 2 5 5"/><path d="M14 20c0-2.4 1.4-4 3-4s3 1.6 3 4"/>',
        media: '<rect x="3" y="6" width="12" height="12" rx="2"/><path d="M15 10l6-3v10l-6-3"/>' +
               '<circle cx="8" cy="12" r="2.2"/>',
        english: '<path d="M6 4h9a4 4 0 0 1 0 8H6z"/><path d="M6 12h10a4 4 0 0 1 0 8H6z"/><path d="M6 4v16"/>',
        project: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5"/><path d="M12 12v9"/><path d="M12 12L4 7.5"/>',
        urdu: '<path d="M4 16c3.5 0 5-2 5-5V6"/><path d="M12 6v6a4 4 0 0 0 8 0"/><circle cx="7" cy="19" r="1"/>' +
              '<circle cx="16" cy="19" r="1"/>',
        history: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
        counselling: '<path d="M20 15a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"/><path d="M9 10h6"/><path d="M9 13h4"/>',
        campus: '<path d="M3 10l9-5 9 5"/><path d="M5 10v10"/><path d="M19 10v10"/><path d="M9 20v-6h6v6"/><path d="M3 20h18"/>',
        scholarship: '<circle cx="12" cy="9" r="5"/><path d="M8.5 13.5L7 21l5-2.5L17 21l-1.5-7.5"/>',
        calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 3v4"/><path d="M16 3v4"/>',
        document: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h4"/>'
    };

    function motif(name, size) {
        var body = MOTIFS[name] || MOTIFS.campus;
        var box = size ? ' width="' + size + '" height="' + size + '"' : '';
        return '<svg viewBox="0 0 24 24"' + box + ' aria-hidden="true" focusable="false">' + body + '</svg>';
    }

    /* ---------------------------------------------------------- portraits */

    /* A person, drawn as shapes and initials. Deliberately not a likeness: this
       site carries no photograph of anybody. */
    function portrait(name) {
        var ink = pick(PORTRAIT_INK, name);
        var bg = pick(PORTRAIT_BG, name, 3);
        var shoulder = 152 + (seed(name) % 14);
        return '<svg viewBox="0 0 240 260" aria-hidden="true" focusable="false">' +
            '<rect width="240" height="260" rx="12" fill="' + bg + '"/>' +
            '<circle cx="120" cy="98" r="46" fill="' + ink + '" opacity="0.16"/>' +
            '<circle cx="120" cy="98" r="34" fill="' + ink + '"/>' +
            '<path d="M120 ' + shoulder + 'c-54 0-92 30-96 70v40h192v-40c-4-40-42-70-96-70z" fill="' + ink + '" opacity="0.85"/>' +
            '<text x="120" y="108" text-anchor="middle" font-family="Inter, sans-serif" font-size="26" ' +
            'font-weight="700" fill="#ffffff">' + initials(name) + '</text>' +
            '</svg>';
    }

    /* ------------------------------------------------------------- crests */

    var CREST_MARK = {
        samurai: '<path d="M60 34l26 22-26 22-26-22z"/><path d="M34 62h52"/>',
        spartan: '<path d="M60 30l24 12v20c0 14-10 24-24 30-14-6-24-16-24-30V42z"/>',
        gladiator: '<path d="M46 34h28v10H46z"/><path d="M60 44v40"/><path d="M44 60h32"/>',
        viking: '<path d="M40 46a20 20 0 0 1 40 0v20H40z"/><path d="M40 46c-8-4-12-12-10-18 8 0 14 4 18 10"/>' +
                '<path d="M80 46c8-4 12-12 10-18-8 0-14 4-18 10"/>'
    };

    function crest(houseId, label) {
        var mark = CREST_MARK[houseId] || CREST_MARK.spartan;
        return '<svg viewBox="0 0 120 150" aria-hidden="true" focusable="false">' +
            '<path d="M10 12h100v78c0 26-22 42-50 48-28-6-50-22-50-48z" fill="#622d91"/>' +
            '<path d="M18 20h84v70c0 21-18 34-42 39-24-5-42-18-42-39z" fill="none" stroke="#f0b323" stroke-width="2"/>' +
            '<g fill="none" stroke="#f0b323" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">' +
            mark + '</g>' +
            '<circle cx="60" cy="104" r="4" fill="#f0b323"/>' +
            '<title>' + String(label || 'House') + '</title>' +
            '</svg>';
    }

    /* ------------------------------------------------------ abstract scenes */

    var SCENE_PALETTE = [
        ['#622d91', '#f0b323'],
        ['#4b2170', '#7a44ab'],
        ['#2b1240', '#f0b323'],
        ['#7a44ab', '#f6f4ee']
    ];

    /* A banner for a card: news, media, a pathway, a showcase. Abstract on
       purpose, and never a stand in for a photograph of a person. */
    function scene(key, ratio) {
        var pair = pick(SCENE_PALETTE, key);
        var h = ratio === 'wide' ? 220 : 300;
        var s = seed(key);
        var bars = '';
        for (var i = 0; i < 7; i++) {
            var x = 40 + i * 78;
            var top = 40 + ((s >> i) % 90);
            bars += '<rect x="' + x + '" y="' + top + '" width="46" height="' + (h - top - 30) +
                    '" rx="8" fill="#ffffff" opacity="' + (0.06 + (i % 3) * 0.05).toFixed(2) + '"/>';
        }
        return '<svg viewBox="0 0 600 ' + h + '" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">' +
            '<rect width="600" height="' + h + '" fill="' + pair[0] + '"/>' +
            bars +
            '<circle cx="' + (120 + s % 320) + '" cy="' + (h - 40) + '" r="' + (70 + s % 60) +
            '" fill="' + pair[1] + '" opacity="0.22"/>' +
            '<circle cx="' + (480 - s % 200) + '" cy="40" r="' + (40 + s % 40) +
            '" fill="' + pair[1] + '" opacity="0.3"/>' +
            '<path d="M0 ' + h + 'L' + (200 + s % 180) + ' ' + (h - 90) + 'L600 ' + h + 'z" fill="#ffffff" opacity="0.07"/>' +
            '</svg>';
    }

    window.EduArtwork = {
        heroScene: heroScene,
        campusArt: campusArt,
        motif: motif,
        portrait: portrait,
        crest: crest,
        scene: scene,
        initials: initials
    };
})(window, document);

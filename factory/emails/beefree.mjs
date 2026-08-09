/* ============================================================================
   A BeeFree template, generated per demo, for uploading straight into the Email
   Builder.

     import { beefreeAbandonedCart } from './beefree.mjs';
     const template = beefreeAbandonedCart({ palette, storeName, storeUrl, ... });

   WHY A GENERATOR RATHER THAN A TEMPLATE TO PICK FROM. Dengage's Email Builder is
   BeeFree, and it imports its own JSON. That import is the only route by which a
   demo's actual brand colour, actual typeface and actual currency arrive in an email
   without anybody styling anything: choosing a stock template means restyling it by
   hand on every build, which is the one thing this factory exists not to do.

   IT IS DELIBERATELY SHORT. Masthead, one line of copy, the basket, the total, one
   button, a footer. Eight rows, and every one of them is a block a salesperson can
   point at and explain in a sentence. A long template demonstrates BeeFree; a short
   one demonstrates that the products in it came from the visitor's own basket, which
   is the thing being sold.

   THE TWO DYNAMIC CONTENT BLOCKS ARE THE POINT OF THE WHOLE FILE. Everything else is
   scaffolding around them. Pass their snippet ids and the template arrives finished;
   pass nothing and each one arrives as a labelled dashed box saying which asset goes
   there, because Dengage assigns snippet_id when an asset is saved and nothing here
   can know it in advance.
   ========================================================================== */

/* BeeFree's own module type names. Wrong here and the import is rejected or, worse,
   accepted with the block dropped, so they are named once. */
const TEXT = 'mailup-bee-newsletter-modules-text';
const HTML = 'mailup-bee-newsletter-modules-html';
const BUTTON = 'mailup-bee-newsletter-modules-button';
const DIVIDER = 'mailup-bee-newsletter-modules-divider';

const WIDTH = 600;

/* Deterministic ids, because two builds of one demo have to produce the same file.
   BeeFree wants uniqueness within the document and nothing more, so a counter is
   enough and a random uuid would only make the output impossible to diff. */
function ids(prefix) {
    let n = 0;
    return () => prefix + '-' + String(++n).padStart(2, '0');
}

function pad(top, right, bottom, left) {
    return {
        'padding-top': top + 'px',
        'padding-right': right + 'px',
        'padding-bottom': bottom + 'px',
        'padding-left': left + 'px'
    };
}

function textModule(uuid, palette, html, style) {
    const size = (style && style.size) || 15;
    return {
        type: TEXT,
        uuid,
        descriptor: {
            text: {
                computedStyle: { linkColor: (style && style.linkColor) || palette.brandText },
                html: '<div class="txtTinyMce-wrapper" style="font-family:' + palette.body +
                      ';font-size:' + size + 'px;line-height:' + ((style && style.leading) || 1.6) +
                      ';color:' + ((style && style.colour) || palette.text) + ';">' + html + '</div>',
                style: {
                    color: (style && style.colour) || palette.text,
                    'font-family': palette.body,
                    'font-size': size + 'px',
                    'line-height': String((style && style.leading) || 1.6)
                }
            },
            style: Object.assign(
                { 'text-align': (style && style.align) || 'left' },
                pad((style && style.top) || 0, 24, (style && style.bottom) || 0, 24)
            ),
            computedStyle: { hideContentOnMobile: false }
        }
    };
}

/* AN HTML MODULE, WHICH IS THE ONLY MODULE THAT LEAVES ITS CONTENT ALONE. A text
   module runs its content through the rich text editor, and a Dengage tag put through
   that comes out escaped or reflowed. So both Dynamic Content blocks are HTML
   modules, and that is not a stylistic choice. */
function htmlModule(uuid, palette, html, bottom) {
    return {
        type: HTML,
        uuid,
        descriptor: {
            html: {
                html,
                style: { 'font-family': palette.body, 'font-size': '15px' },
                computedStyle: { hideContentOnMobile: false }
            },
            style: pad(0, 24, bottom === undefined ? 0 : bottom, 24),
            computedStyle: { hideContentOnMobile: false }
        }
    };
}

function buttonModule(uuid, palette, label, href) {
    return {
        type: BUTTON,
        uuid,
        descriptor: {
            button: {
                label,
                href,
                style: {
                    'background-color': palette.brand,
                    'border-bottom': '0px solid transparent',
                    'border-left': '0px solid transparent',
                    'border-radius': palette.radius + 'px',
                    'border-right': '0px solid transparent',
                    'border-top': '0px solid transparent',
                    color: palette.onBrand,
                    direction: 'ltr',
                    'font-family': palette.body,
                    'font-size': '16px',
                    'font-weight': '700',
                    'line-height': '120%',
                    'max-width': '100%',
                    'padding-bottom': '14px',
                    'padding-left': '30px',
                    'padding-right': '30px',
                    'padding-top': '14px',
                    width: 'auto'
                },
                computedStyle: { width: 'auto', hideContentOnMobile: false }
            },
            style: Object.assign({ 'text-align': 'left' }, pad(0, 24, 0, 24)),
            computedStyle: { hideContentOnMobile: false }
        }
    };
}

function dividerModule(uuid, palette) {
    return {
        type: DIVIDER,
        uuid,
        descriptor: {
            divider: { style: { 'border-top': '1px solid ' + palette.edge, width: '100%' } },
            style: Object.assign({ 'text-align': 'center' }, pad(0, 24, 0, 24)),
            computedStyle: { align: 'center', hideContentOnMobile: false }
        }
    };
}

function row(uuid, palette, columns, options) {
    const o = options || {};
    return {
        type: columns.length === 2 ? 'two-columns-empty' : 'one-column-empty',
        uuid,
        container: { style: { 'background-color': o.behind || 'transparent' } },
        content: {
            computedStyle: { rowColStackOnMobile: true, rowReverseColStackOnMobile: false },
            style: {
                'background-color': o.ground || palette.card,
                color: palette.text,
                width: WIDTH + 'px'
            }
        },
        columns: columns.map((modules, index) => ({
            'grid-columns': columns.length === 2 ? 6 : 12,
            modules,
            style: Object.assign(
                {
                    'background-color': 'transparent',
                    'border-bottom': '0px solid transparent',
                    'border-left': '0px solid transparent',
                    'border-right': '0px solid transparent',
                    'border-top': '0px solid transparent'
                },
                pad(o.top === undefined ? 20 : o.top, 0,
                    o.bottom === undefined ? 20 : o.bottom, 0)
            ),
            uuid: uuid + '-c' + (index + 1)
        }))
    };
}

/* A Dynamic Content block. WITH AN ID it is the real tag and the template is
   finished on upload. WITHOUT ONE it is a dashed box naming the asset, which is what
   the builder shows a person who then clicks it and picks the asset from the list.

   The placeholder is not a comment, deliberately. An HTML comment is invisible in the
   builder, so the block reads as an empty template rather than as a spot with a job. */
function dynamicBlock(palette, asset, id, describe) {
    if (id) {
        return '<snippet snippet_id="' + id + '" snippet_name="' + asset + '"></snippet>';
    }
    return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ' +
        'style="border-collapse:collapse;"><tr><td style="border:2px dashed ' + palette.edge +
        ';border-radius:' + palette.radius + 'px;padding:22px 20px;text-align:center;' +
        'font-family:' + palette.body + ';font-size:13px;line-height:1.6;color:' +
        palette.quiet + ';">' +
        '<strong style="color:' + palette.text + ';font-size:14px;">Dynamic Content: ' +
        asset + '</strong><br>' + describe +
        '<br>Click this block, clear it, then use Insert &gt; Dynamic Content.' +
        '</td></tr></table>';
}

/* A Google Fonts entry, so the builder previews the demo's own typeface rather than
   its fallback. Only for the face the theme actually named: guessing a URL for a font
   nobody asked for would load nothing and say it loaded something. */
function webFonts(theme, palette) {
    const names = [theme && theme.displayFont, theme && theme.bodyFont]
        .filter((name) => typeof name === 'string' && name.trim() !== '');
    const unique = [];
    for (const name of names) if (unique.indexOf(name) === -1) unique.push(name);
    return unique.map((name) => ({
        name,
        fontFamily: "'" + name + "', " + palette.body,
        url: 'https://fonts.googleapis.com/css2?family=' +
            encodeURIComponent(name).replace(/%20/g, '+') +
            ':wght@400;600;700&display=swap'
    }));
}

export function beefreeAbandonedCart(options) {
    const {
        palette, storeName, storeUrl, unsubscribe,
        theme = {}, symbol = '', currency = '', snippets = {}
    } = options;

    const uid = ids('dps-cart');
    const rows = [];

    /* A THEME WHOSE PAGE AND SURFACE ARE THE SAME COLOUR, which several are. The band
       grounds below are the only thing drawing the card, so on such a theme every band
       is the same colour and the masthead, the content and the footer run together into
       one flat block. A hairline replaces the edge the colour change would have made.
       Checked rather than assumed: emailPalette returns whatever the theme gave it. */
    const flat = String(palette.card).toLowerCase() === String(palette.canvas).toLowerCase();
    const hairline = () => rows.push(
        row(uid(), palette, [[dividerModule(uid(), palette)]], { top: 0, bottom: 0 }));

    /* 1. THE MASTHEAD IS THE DENGAGE MARK AND THE STORE'S NAME AS TEXT BESIDE IT.
       Non-negotiable 3, and the same arrangement layout.mjs uses, so the generated
       HTML emails and this one do not disagree about whose email it is. Text rather
       than an image because the logo is an SVG and Gmail drops SVG entirely.

       ON THE CANVAS, NOT THE CARD, and the colours are the canvas-checked pair. A
       BeeFree row is a full width band, so the floating card layout.mjs draws with a
       border and a radius cannot be reproduced here. What reproduces it is the band
       ground: masthead and footer on the canvas, everything between them on the card,
       so the colour change is the card's edge. Using card-checked text out here is how
       a demo whose page and surface differ ends up with quiet text at the wrong
       contrast on the one row nobody re-reads. */
    rows.push(row(uid(), palette, [
        [textModule(uid(), palette,
            '<strong style="font-family:' + palette.display + ';font-size:17px;color:' +
            palette.canvasText + ';letter-spacing:-0.01em;">Dengage</strong>' +
            '<span style="font-size:12px;color:' + palette.canvasQuiet + ';padding-left:6px;">' +
            'eComm Demo</span>', { size: 17, colour: palette.canvasText })],
        [textModule(uid(), palette, storeName,
            { size: 12, colour: palette.canvasQuiet, align: 'right' })]
    ], { ground: palette.canvas, top: 24, bottom: 24 }));

    if (flat) hairline();

    /* 2. One headline and one line of copy. No paragraph explaining the offer,
       because there is no offer: the products are the message. */
    rows.push(row(uid(), palette, [[
        textModule(uid(), palette,
            '<span style="font-family:' + palette.display + ';font-size:26px;font-weight:700;' +
            'line-height:1.25;color:' + palette.text + ';">Still thinking it over?</span>',
            { size: 26, leading: 1.25, bottom: 10 }),
        textModule(uid(), palette,
            'Your basket is saved. Here is what is waiting in it.',
            { size: 15, colour: palette.quiet })
    ]], { top: 30, bottom: 22 }));

    /* 3. THE BASKET. */
    rows.push(row(uid(), palette, [[
        htmlModule(uid(), palette,
            dynamicBlock(palette, 'dps abandoned cart', snippets.items,
                'The visitor\'s own basket, resolved from their cart events.'))
    ]], { top: 0, bottom: 6 }));

    /* 4. THE TOTAL, on the wash so it reads as a summary rather than another product.
       It disappears by itself when the basket has no honest total to show. */
    rows.push(row(uid(), palette, [[
        htmlModule(uid(), palette,
            dynamicBlock(palette, 'dps abandoned cart total', snippets.total,
                'Subtotal, discount and total, computed from the same basket.'))
    ]], { ground: palette.wash, top: 20, bottom: 20 }));

    /* 5. THE CURRENCY, STATED ONCE, BECAUSE NO NUMBER IN THIS EMAIL CARRIES A SYMBOL.
       Both Dynamic Content assets are shared by every demo and dps_product has no
       currency column, so neither one can know which currency it is printing. It says
       so here instead, per demo, which is what an international retailer does anyway,
       and it is the only honest option that does not put a guessed symbol beside a
       real price. Omitted entirely when the demo's locale names neither. */
    const money = symbol || currency;
    if (money) {
        rows.push(row(uid(), palette, [[
            textModule(uid(), palette,
                'All prices in ' + (symbol || currency) +
                (symbol && currency ? ' (' + currency + ')' : '') + '.',
                { size: 12, colour: palette.quiet })
        ]], { top: 0, bottom: 22 }));
    }

    /* 6. ONE BUTTON, AND IT GOES TO THE CART. Not to the home page: the whole
       proposition is that the basket survived. */
    rows.push(row(uid(), palette, [[
        buttonModule(uid(), palette, 'Return to your basket', storeUrl + 'cart.html')
    ]], { top: money ? 0 : 4, bottom: 32 }));

    if (flat) hairline();

    /* 7. The footer, back on the canvas, closing the card. Same wording as the
       generated HTML emails. */
    rows.push(row(uid(), palette, [[
        textModule(uid(), palette,
            'You are receiving this because you shopped with us. ' +
            '<a href="' + unsubscribe + '" style="color:' + palette.canvasQuiet +
            ';text-decoration:underline;">Unsubscribe</a> or ' +
            '<a href="' + storeUrl + '" style="color:' + palette.canvasQuiet +
            ';text-decoration:underline;">visit the store</a>.<br>' +
            'This is a demonstration storefront built for a sales conversation.',
            { size: 12, colour: palette.canvasQuiet, linkColor: palette.canvasQuiet })
    ]], { ground: palette.canvas, top: 20, bottom: 24 }));

    return {
        page: {
            title: 'Abandoned cart, ' + storeName,
            description: 'Dengage eComm Demo. Two Dynamic Content blocks, themed per demo.',
            template: { name: 'template-base', type: 'basic', version: '2.0.0' },
            body: {
                type: 'mailup-bee-newsletter-layout-fixed-width',
                container: { style: { 'background-color': palette.canvas } },
                content: {
                    computedStyle: {
                        linkColor: palette.brandText,
                        messageBackgroundColor: 'transparent',
                        messageWidth: WIDTH + 'px'
                    },
                    style: { color: palette.text, 'font-family': palette.body }
                },
                webFonts: webFonts(theme, palette),
                rows
            }
        },
        comments: {}
    };
}

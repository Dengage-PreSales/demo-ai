/* ============================================================================
   The neutral shell every scenario email is built in, and the blocks that go in it.

     import { document, headline, cardGrid, button } from './scenario-html.mjs';

   TABLES AND INLINE STYLES, because this is email. No stylesheet, no class, no flexbox,
   no custom property: Outlook renders a table and ignores most of the rest, and a demo
   that looks right in Chrome and collapses in Outlook is a demo that breaks on a call.
   600px, one column, and every colour written out where it is used.

   IT NAMES NO STOREFRONT, and that is the same decision the BeeFree template records at
   length. The shell is fixed when this repository builds; the products inside it are
   resolved when the email is sent, from whichever demo the recipient last used. So a
   shell that named a store could contradict its own contents, and did: a Techiestore
   masthead around four garments over a rupee line against dollar prices. Salil's call,
   9 August 2026. The mark is Dengage, the palette is Dengage's, and what adapts is the
   part that arrives with the data.

   WHAT DOES ADAPT, per recipient and per demo, is everything that matters: the product
   names, the photographs, the prices, the category names, and every link, because
   dps_product carries `link` and `image_link` as absolute addresses and the resolution
   block works out which demo's they are.

   THE LOCALS IN HERE ARE NAMED FOR THIS FILE, not for readability alone: qtyOf, wasOf,
   nowOf, keepView. The whole email compiles to one function, so a `var` in a card and a
   `var` in the resolution block are the same variable. A fold is written by hand per
   scenario and this file is not, so the shared side is the side that gets out of the way.
   Three folds used `var q` for a loop counter and a card used `var q` for a quantity;
   scenarios.test.mjs found it and now asserts it cannot come back.

   THE SCENARIO'S OWN LOOK comes from choosing among these blocks rather than from new
   markup per email. A scenario that is about one product uses `heroCard`; one about a
   basket uses `cardGrid` and `totals`; one about a search uses `factStrip`. That is what
   keeps eight emails a family instead of eight one-off files.

   EVERY BLOCK THAT DEPENDS ON DATA SUPPRESSES ITSELF. A button with no address does not
   render, a price that is not a positive number does not render, a card with no
   photograph starts at its name. Nothing here has an "or else" that invents a value:
   CLAUDE.md rule 5, and the reason the totals block exists at all.
   ========================================================================== */

/* THE PREHEADER IS NOT IN HERE. The email editor has its own Pre-header field, which
   takes a Dynamic Content snippet, and putting a hidden div in the body instead would be
   doing by trick what the platform does by design. Salil, 10 August 2026, and the
   BeeFree template lost its hidden row the same day. build-scenarios.mjs prints the
   preheader to paste into that field. */

export function band(palette, inner, options) {
    const o = options || {};
    const ground = o.ground || palette.card;
    const top = o.top === undefined ? 28 : o.top;
    const bottom = o.bottom === undefined ? 28 : o.bottom;
    return '<tr><td align="center" style="background-color:' + ground + ';">' +
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" ' +
        'style="width:600px;max-width:600px;border-collapse:collapse;"><tr>' +
        '<td style="padding:' + top + 'px 24px ' + bottom + 'px 24px;font-family:' +
        palette.body + ';font-size:15px;line-height:1.6;color:' + palette.text + ';">' +
        inner + '</td></tr></table></td></tr>';
}

export function masthead(palette) {
    return band(palette,
        '<strong style="font-family:' + palette.display + ';font-size:18px;color:' +
        palette.canvasText + ';letter-spacing:-0.01em;">Dengage</strong>' +
        '<span style="font-size:12px;color:' + palette.canvasQuiet +
        ';padding-left:6px;">eComm Demo</span>',
        { ground: palette.canvas, top: 24, bottom: 24 });
}

export function footer(palette) {
    return band(palette,
        '<div style="font-size:13px;font-family:' + palette.display + ';color:' +
        palette.canvasText + ';font-weight:bold;padding:0 0 8px 0;">Dengage' +
        '<span style="font-size:12px;font-weight:normal;color:' + palette.canvasQuiet +
        ';padding-left:5px;">eComm Demo</span></div>' +
        '<div style="font-size:12px;line-height:1.6;color:' + palette.canvasQuiet + ';">' +
        'You are receiving this because you shopped with us.<br>' +
        'If you have already completed your purchase, please disregard this email.<br>' +
        'This is a demonstration storefront built for a sales conversation.</div>',
        { ground: palette.canvas, top: 24, bottom: 28 });
}

export function eyebrow(palette, text) {
    return '<div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;' +
        'color:' + palette.brandText + ';font-weight:bold;padding:0 0 10px 0;">' +
        text + '</div>';
}

export function headline(palette, html) {
    return '<div style="font-family:' + palette.display + ';font-size:28px;' +
        'font-weight:700;line-height:1.2;color:' + palette.text + ';padding:0 0 12px 0;">' +
        html + '</div>';
}

export function lede(palette, html) {
    return '<div style="font-size:15px;line-height:1.6;color:' + palette.quiet + ';">' +
        html + '</div>';
}

export function note(palette, html) {
    return '<div style="font-size:12px;line-height:1.5;color:' + palette.quiet +
        ';text-align:center;">' + html + '</div>';
}

/* A band of fact rather than of copy: the search term, the order it follows, the number
   of items. It is on the wash so it reads as evidence rather than as more sentences, and
   the value in it is always something a table actually held. */
export function factStrip(palette, label, valueHtml) {
    return band(palette,
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ' +
        'style="border-collapse:collapse;"><tr>' +
        '<td style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:' +
        palette.quiet + ';padding:0 0 4px 0;">' + label + '</td></tr><tr>' +
        '<td style="font-family:' + palette.display + ';font-size:20px;font-weight:700;' +
        'color:' + palette.text + ';">' + valueHtml + '</td></tr></table>',
        { ground: palette.wash, top: 20, bottom: 20 });
}

/* THE CARD MARKUP IS THE ABANDONED CART EMAIL'S, deliberately unchanged. Centred cards
   two across, a fixed height image frame so two cards in a row start their text at the
   same place, the category as a quiet eyebrow, the name clamped, and the price with a
   struck through original only when there is a genuine reduction. Every one of those is
   a defect that shipped once already; the notes are in
   factory/panel/content/_dynamic/README.md. */
export function cardGrid(palette) {
    return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ' +
        'style="border-collapse:collapse;">' +
        '{% for (var g = 0; g < view.length; g += 2) { %}' +
        '<tr>' +
        '{% for (var col = 0; col < 2; col++) { var card = view[g + col]; if (!card) { %}' +
        '<td width="50%" style="font-size:0;line-height:0;">&nbsp;</td>' +
        '{% continue; } %}' +
        '<td width="50%" align="center" valign="top" style="padding:0 9px 30px 9px;">' +
        '{% if (card.image !== "") { %}' +
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ' +
        'style="border-collapse:collapse;"><tr>' +
        '<td height="200" align="center" valign="middle" style="height:200px;">' +
        '{% if (card.link !== "") { %}<a href="{%= card.link %}" target="_blank" ' +
        'style="text-decoration:none;">{% } %}' +
        '<img src="{%= card.image %}" alt="{%= card.title %}" width="200" ' +
        'style="max-width:200px;max-height:200px;width:100%;height:auto;border:0;' +
        'display:block;margin:0 auto;border-radius:8px;">' +
        '{% if (card.link !== "") { %}</a>{% } %}' +
        '</td></tr></table>{% } %}' +
        '{% if (card.category !== "") { %}' +
        '<div style="font-size:10px;letter-spacing:0.1em;text-transform:uppercase;' +
        'color:' + palette.quiet + ';padding:16px 0 6px 0;">{%= card.category %}</div>{% } %}' +
        '<div style="font-size:15px;line-height:1.4;font-weight:bold;color:' + palette.text +
        ';padding:{%= card.category === "" ? 16 : 0 %}px 0 7px 0;">' +
        '{% if (card.link !== "") { %}<a href="{%= card.link %}" target="_blank" ' +
        'style="color:' + palette.text + ';text-decoration:none;">{%= card.title %}</a>' +
        '{% } else { %}{%= card.title %}{% } %}</div>' +
        '{% if (card.price !== "") { %}<div style="font-size:14px;line-height:1.4;color:' +
        palette.text + ';">' +
        '{% if (card.cut !== "") { %}<span style="font-weight:bold;">{%= card.cut %}</span>' +
        '<span style="text-decoration:line-through;color:' + palette.quiet +
        ';padding-left:7px;">{%= card.price %}</span>' +
        '{% } else { %}<span style="font-weight:bold;">{%= card.price %}</span>{% } %}' +
        '{% var qtyOf = (ctx.qty && ctx.qty[card.id]) ? Number(ctx.qty[card.id]) : 1; %}' +
        '{% if (isFinite(qtyOf) && qtyOf > 1) { %}<span style="color:' + palette.quiet +
        ';padding-left:7px;">Qty {%= qtyOf %}</span>{% } %}' +
        '</div>{% } %}' +
        '</td>{% } %}</tr>{% } %}' +
        '{% if (extra > 0) { %}<tr><td colspan="2" align="center" ' +
        'style="font-size:13px;line-height:1.5;color:' + palette.quiet + ';padding:2px 0 0 0;">' +
        'and {%= extra %} more item{% if (extra > 1) { %}s{% } %}</td></tr>{% } %}' +
        '</table>';
}

/* ONE PRODUCT, WIDE, for a scenario that is genuinely about one thing: a price that
   fell, a saved item back in stock. Two across would bury the point. */
export function heroCard(palette, options) {
    const o = options || {};
    /* THE PRICE A CLAIM IS ABOUT IS NOT ALWAYS THE CATALOGUE'S OWN DISCOUNT, and getting
       that wrong is the most damaging thing an email of this kind can do. "It is cheaper
       than when you saved it" is a comparison between the price on the wishlist row and
       the price in dps_product today; the catalogue's own price against its
       discounted_price is a different comparison entirely. The first render of the price
       drop email showed the second under a headline claiming the first.

       So a scenario that is making a claim passes the expression its claim is about, and
       what is struck through is the number the sentence above it refers to. */
    const wasExpr = o.was || '';
    return '{% if (view.length) { var card = view[0]; ' +
        (wasExpr ? 'var wasOf = Number(' + wasExpr + '); ' : 'var wasOf = 0; ') + '%}' +
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ' +
        'style="border-collapse:collapse;"><tr>' +
        '{% if (card.image !== "") { %}' +
        '<td width="200" valign="middle" style="padding:0 20px 0 0;">' +
        '{% if (card.link !== "") { %}<a href="{%= card.link %}" target="_blank">{% } %}' +
        '<img src="{%= card.image %}" alt="{%= card.title %}" width="200" ' +
        'style="width:200px;max-width:200px;height:auto;border:0;display:block;' +
        'border-radius:8px;">' +
        '{% if (card.link !== "") { %}</a>{% } %}</td>{% } %}' +
        '<td valign="middle">' +
        '{% if (card.category !== "") { %}' +
        '<div style="font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:' +
        palette.quiet + ';padding:0 0 6px 0;">{%= card.category %}</div>{% } %}' +
        '<div style="font-family:' + palette.display + ';font-size:19px;line-height:1.3;' +
        'font-weight:700;color:' + palette.text + ';padding:0 0 8px 0;">' +
        '{% if (card.link !== "") { %}<a href="{%= card.link %}" target="_blank" ' +
        'style="color:' + palette.text + ';text-decoration:none;">{%= card.title %}</a>' +
        '{% } else { %}{%= card.title %}{% } %}</div>' +
        '{% if (card.price !== "") { %}<div style="font-size:17px;line-height:1.4;color:' +
        palette.text + ';">' +
        '{% var nowOf = card.cut !== "" ? card.cut : card.price; %}' +
        '<span style="font-weight:bold;">{%= nowOf %}</span>' +
        '{% if (isFinite(wasOf) && wasOf > 0) { %}' +
        '<span style="text-decoration:line-through;color:' + palette.quiet +
        ';padding-left:8px;">{%= money(wasOf) %}</span>' +
        '{% } else if (card.cut !== "") { %}' +
        '<span style="text-decoration:line-through;color:' + palette.quiet +
        ';padding-left:8px;">{%= card.price %}</span>{% } %}' +
        '</div>{% } %}</td></tr></table>{% } %}';
}

/* THE TOTALS, AND THEY SUPPRESS THEMSELVES ON ANY DOUBT. Number(null) is 0, so one
   product with no price makes a basket look cheaper and entirely plausible. That trap has
   shipped twice on the core repository, so the whole block goes rather than one line of
   it. The arithmetic is in the scenario's own extra block, which sets `priced`. */
export function totals(palette) {
    return '{% if (priced) { %}' +
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ' +
        'style="border-collapse:collapse;">' +
        '<tr><td style="font-size:14px;line-height:1.6;color:' + palette.text +
        ';padding:0 0 4px 0;">Subtotal</td>' +
        '<td align="right" style="font-size:14px;line-height:1.6;color:' + palette.text +
        ';padding:0 0 4px 0;">{%= money(subtotal) %}</td></tr>' +
        '{% if (discount > 0) { %}' +
        '<tr><td style="font-size:14px;line-height:1.6;color:' + palette.text +
        ';padding:0 0 4px 0;">Discount</td>' +
        '<td align="right" style="font-size:14px;line-height:1.6;color:' + palette.text +
        ';padding:0 0 4px 0;">-{%= money(discount) %}</td></tr>{% } %}' +
        '<tr><td style="font-size:16px;font-weight:bold;line-height:1.6;color:' + palette.text +
        ';padding:8px 0 0 0;border-top:1px solid ' + palette.edge + ';">Total</td>' +
        '<td align="right" style="font-size:16px;font-weight:bold;line-height:1.6;color:' +
        palette.text + ';padding:8px 0 0 0;border-top:1px solid ' + palette.edge + ';">' +
        '{%= money(subtotal - discount) %}</td></tr></table>{% } %}';
}

/* A BUTTON THAT CANNOT POINT AT THE WRONG STOREFRONT, because it does not render unless
   the resolution block worked out which storefront this is. There is no address correct
   for every demo, and one that lands a recipient on another prospect's store is worse
   than no button: the wrong one is visible and the missing one is not. */
export function button(palette, label, hrefExpression, secondary) {
    let out = '{% if (root !== "") { %}' +
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ' +
        'style="border-collapse:collapse;"><tr><td align="center" style="padding:0;">' +
        '<a href="{%= ' + hrefExpression + ' %}" target="_blank" ' +
        'style="display:inline-block;background-color:' + palette.brand + ';color:' +
        palette.onBrand + ';font-family:' + palette.body + ';font-size:16px;' +
        'font-weight:bold;line-height:1.2;padding:14px 30px;border-radius:' +
        palette.radius + 'px;text-decoration:none;">' + label + '</a></td></tr>';
    if (secondary) {
        out += '<tr><td align="center" style="padding:12px 0 0 0;font-size:13px;' +
            'line-height:1.5;"><a href="{%= ' + secondary.href + ' %}" target="_blank" ' +
            'style="color:' + palette.quiet + ';text-decoration:underline;">' +
            secondary.label + '</a></td></tr>';
    }
    return out + '</table>{% } %}';
}

/* THE WHOLE DOCUMENT. A table based email, so the outer table carries the canvas and
   every band is a row of it. */
export function document(palette, options) {
    const o = options || {};
    return '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" ' +
        '"https://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">\n' +
        '<html xmlns="https://www.w3.org/1999/xhtml"><head>\n' +
        '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />\n' +
        '<meta name="viewport" content="width=device-width, initial-scale=1" />\n' +
        '<title>' + o.title + '</title>\n' +
        '<style type="text/css">\n' +
        'body{margin:0;padding:0;background-color:' + palette.canvas + ';}\n' +
        'img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;}\n' +
        'table{border-collapse:collapse;}\n' +
        'a{color:' + palette.brandText + ';}\n' +
        '@media only screen and (max-width:620px){\n' +
        '  .dps-band{width:100% !important;}\n' +
        '  .dps-half{display:block !important;width:100% !important;}\n' +
        '}\n' +
        '</style>\n</head>\n' +
        '<body style="margin:0;padding:0;background-color:' + palette.canvas +
        ';font-family:' + palette.body + ';color:' + palette.text + ';">\n' +
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ' +
        'style="background-color:' + palette.canvas + ';">\n' +
        o.rows.join('\n') +
        '\n</table>\n</body></html>\n';
}

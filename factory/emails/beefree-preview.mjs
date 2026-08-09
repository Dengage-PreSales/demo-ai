/* ============================================================================
   Renders a generated BeeFree template to HTML, so it can be looked at before it is
   uploaded.

     import { previewBeefree } from './beefree-preview.mjs';

   IT IS AN APPROXIMATION AND SAYS SO. BeeFree owns the real export, and this does not
   reimplement it: a row becomes a full width table with the row's ground, a column
   becomes a cell, and each module becomes what its descriptor describes. That is
   enough to answer the only question a preview is for, which is whether the demo's
   colours, typeface and proportions came out right. It is not enough to answer how a
   given mail client will render it, and nothing here should be read as if it were.

   THE TWO DYNAMIC CONTENT BLOCKS ARE FILLED WITH REAL PRODUCTS, from the demo's own
   products.json, using the same markup the saved assets emit. That is the whole
   difference between a preview and the placeholder boxes the builder shows: a dashed
   box proves the block is in the right place, and only a filled one shows whether the
   email looks right. The prices are the scraped prices, never invented, and a product
   with no price shows none.
   ========================================================================== */

import { templateRows } from './beefree.mjs';

/* The product row markup from abandoned-cart.html, and the summary from
   abandoned-cart-total.html. Kept deliberately close to those files: this is a preview
   of them, so a divergence here is a preview that flatters the real thing. */
function productRows(products, palette) {
    return products.map((product) => {
        const price = product.price;
        const cut = product.discounted;
        return '<tr>' +
            '<td width="112" valign="top" style="padding:0 18px 22px 0;">' +
            (product.image
                ? '<img src="' + product.image + '" alt="" width="96" ' +
                  'style="width:96px;height:auto;border:0;display:block;">'
                : '') +
            '</td>' +
            '<td valign="top" style="padding:4px 0 22px 0;font-family:inherit;color:inherit;">' +
            (product.category
                ? '<div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;' +
                  'opacity:0.6;padding:0 0 5px 0;">' + product.category + '</div>'
                : '') +
            '<div style="font-size:16px;line-height:1.35;padding:0 0 7px 0;">' +
            '<span style="font-weight:bold;">' + product.name + '</span></div>' +
            (price
                ? '<div style="font-size:16px;font-weight:bold;line-height:1.3;">' +
                  (cut
                      ? '<span>' + cut + '</span><span style="text-decoration:line-through;' +
                        'font-weight:normal;opacity:0.55;font-size:14px;padding-left:8px;">' +
                        price + '</span>'
                      : '<span>' + price + '</span>') +
                  (product.quantity > 1
                      ? '<span style="font-weight:normal;opacity:0.65;font-size:14px;' +
                        'padding-left:8px;">Qty ' + product.quantity + '</span>'
                      : '') +
                  '</div>'
                : '') +
            '</td></tr>';
    }).join('');
}

function summaryRows(totals, palette) {
    if (!totals) return '';
    const line = (label, value, strong) =>
        '<tr><td style="font-size:' + (strong ? 16 : 14) + 'px;' +
        (strong ? 'font-weight:bold;' : '') + 'line-height:1.6;padding:' +
        (strong ? '8px 0 0 0;border-top:1px solid rgba(128,128,128,0.3);' : '0 0 4px 0;') +
        '">' + label + '</td>' +
        '<td align="right" style="font-size:' + (strong ? 16 : 14) + 'px;' +
        (strong ? 'font-weight:bold;' : '') + 'line-height:1.6;padding:' +
        (strong ? '8px 0 0 0;border-top:1px solid rgba(128,128,128,0.3);' : '0 0 4px 0;') +
        '">' + value + '</td></tr>';
    return line('Subtotal', totals.subtotal) +
        (totals.discount ? line('Discount', '-' + totals.discount) : '') +
        line('Total', totals.total, true);
}

function moduleHtml(module, palette, filled) {
    const d = module.descriptor;
    const padding = ['top', 'right', 'bottom', 'left']
        .map((side) => (d.style && d.style['padding-' + side]) || '0px').join(' ');
    const align = (d.style && d.style['text-align']) || 'left';

    if (d.text) {
        return '<div style="padding:' + padding + ';text-align:' + align + ';">' +
            d.text.html + '</div>';
    }
    if (d.html) {
        /* The dashed placeholder is replaced by the real thing when there is one to
           show, which is what makes this a look and feel check rather than a layout
           check. Otherwise the placeholder is shown exactly as the builder shows it. */
        const replacement = filled[module.uuid];
        const body = replacement === undefined ? d.html.html : replacement;
        return '<div style="padding:' + padding + ';font-family:' +
            d.html.style['font-family'] + ';font-size:' + d.html.style['font-size'] +
            ';">' + body + '</div>';
    }
    if (d.button) {
        const b = d.button.style;
        return '<div style="padding:' + padding + ';text-align:' + align + ';">' +
            '<a href="' + d.button.href + '" style="display:inline-block;' +
            'background-color:' + b['background-color'] + ';color:' + b.color +
            ';border-radius:' + b['border-radius'] + ';font-family:' + b['font-family'] +
            ';font-size:' + b['font-size'] + ';font-weight:' + b['font-weight'] +
            ';line-height:' + b['line-height'] + ';padding:' + b['padding-top'] + ' ' +
            b['padding-right'] + ' ' + b['padding-bottom'] + ' ' + b['padding-left'] +
            ';text-decoration:none;">' + d.button.label + '</a></div>';
    }
    if (d.divider) {
        return '<div style="padding:' + padding + ';"><div style="border-top:' +
            d.divider.style['border-top'] + ';width:100%;"></div></div>';
    }
    return '';
}

export function previewBeefree(template, options) {
    const o = options || {};
    const palette = o.palette || {};
    const body = template.page.body;
    const filled = o.filled || {};

    const bands = templateRows(template).map((row) => {
        const ground = row.content.style['background-color'];
        const cells = row.columns.map((column) => {
            const top = column.style['padding-top'];
            const bottom = column.style['padding-bottom'];
            const width = row.columns.length === 2 ? ' width="50%"' : '';
            return '<td valign="top"' + width + ' style="padding:' + top + ' 0 ' +
                bottom + ' 0;">' +
                column.modules.map((module) => moduleHtml(module, palette, filled)).join('') +
                '</td>';
        }).join('');
        return '<tr><td align="center" style="background-color:' + ground + ';">' +
            '<table role="presentation" cellpadding="0" cellspacing="0" border="0" ' +
            'width="600" style="width:600px;max-width:600px;"><tr>' + cells +
            '</tr></table></td></tr>';
    }).join('\n');

    const font = body.webFonts.length
        ? '<link href="' + body.webFonts[0].url + '" rel="stylesheet">'
        : '';

    return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<title>' + template.page.title + ', preview</title>' + font +
        '<style>body{margin:0;padding:0;background:' +
        body.container.style['background-color'] + ';}' +
        'img{border:0;max-width:100%;}</style></head>' +
        '<body style="background-color:' + body.container.style['background-color'] +
        ';color:' + body.content.style.color + ';font-family:' +
        body.content.style['font-family'] + ';">' +
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0" ' +
        'width="100%">\n' + bands + '\n</table></body></html>\n';
}

export { productRows, summaryRows };

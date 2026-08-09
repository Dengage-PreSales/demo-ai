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
    /* CARDS, TWO ACROSS, CENTRED, matching abandoned-cart.html row for row. A 96px
       thumbnail beside left-aligned text read as an order confirmation; the reference
       this was rebuilt against merchandises them instead. */
    const leaf = (path) => String(path || '').split('>').pop().trim();
    /* Same clamp and the same fixed height frame as the asset, or the preview would
       flatter it: ragged card heights are exactly what these two fix. */
    const short = (value) => {
        const t = String(value || '').trim();
        if (!t) return 'Your item';
        return t.length > 60 ? t.substring(0, 57).replace(/[\s,]+$/, '') + '...' : t;
    };

    const card = (product) => {
        if (!product) return '<td width="50%" style="font-size:0;line-height:0;">&nbsp;</td>';
        const category = leaf(product.category);
        return '<td width="50%" align="center" valign="top" ' +
            'style="padding:0 9px 30px 9px;">' +
            (product.image
                ? '<table cellpadding="0" cellspacing="0" border="0" width="100%" ' +
                  'style="border-collapse:collapse;"><tr>' +
                  '<td height="200" align="center" valign="middle" style="height:200px;">' +
                  '<img src="' + product.image + '" alt="" width="200" style="max-width:200px;' +
                  'max-height:200px;width:100%;height:auto;border:0;display:block;' +
                  'margin:0 auto;border-radius:8px;"></td></tr></table>'
                : '') +
            (category
                ? '<div style="font-size:10px;letter-spacing:0.1em;text-transform:uppercase;' +
                  'opacity:0.45;padding:16px 0 6px 0;">' + category + '</div>'
                : '') +
            '<div style="font-size:15px;line-height:1.4;font-weight:bold;padding:' +
            (category ? 0 : 16) + 'px 0 7px 0;">' + short(product.name) + '</div>' +
            (product.price
                ? '<div style="font-size:14px;line-height:1.4;">' +
                  (product.discounted
                      ? '<span style="font-weight:bold;">' + product.discounted + '</span>' +
                        '<span style="text-decoration:line-through;opacity:0.45;' +
                        'padding-left:7px;">' + product.price + '</span>'
                      : '<span style="font-weight:bold;">' + product.price + '</span>') +
                  (product.quantity > 1
                      ? '<span style="opacity:0.55;padding-left:7px;">Qty ' +
                        product.quantity + '</span>'
                      : '') +
                  '</div>'
                : '') +
            '</td>';
    };

    let out = '';
    for (let i = 0; i < products.length; i += 2) {
        out += '<tr>' + card(products[i]) + card(products[i + 1]) + '</tr>';
    }
    return out;
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
        /* THE WRAPPER IS KEPT AND ONLY ITS CONTENTS ARE SUBSTITUTED, which is the whole
           difference between a faithful preview and a flattering one. An earlier version
           replaced the block's entire HTML with the rendered products, wrapper included,
           and then supplied the typeface and the padding from the module's own style. That
           made the preview look correct while a real send was in Times with the totals
           flush against both edges, because BeeFree applies neither to an HTML block.

           So the module contributes nothing here beyond its vertical padding, exactly as
           it does in the real thing, and everything else has to come from inside the
           block's own content or it does not appear. */
        const replacement = filled[module.uuid];
        let body = d.html.html;
        if (replacement !== undefined) {
            const wrapper = /^(<div style="[^"]*">)([\s\S]*)(<\/div>)$/.exec(body);
            body = wrapper ? wrapper[1] + replacement + wrapper[3] : replacement;
        }
        const vertical = (d.style && d.style['padding-top']) || '0px';
        const below = (d.style && d.style['padding-bottom']) || '0px';
        return '<div style="padding:' + vertical + ' 0 ' + below + ' 0;">' + body + '</div>';
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
    if (d.image) {
        const img = '<img src="' + d.image.src + '" alt="' + d.image.alt +
            '" width="' + parseInt(d.image.width, 10) + '" style="width:' +
            d.image.width + ';max-width:100%;height:auto;border:0;display:block;">';
        return '<div style="padding:' + padding + ';text-align:' + align + ';">' +
            (d.image.href ? '<a href="' + d.image.href + '">' + img + '</a>' : img) +
            '</div>';
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

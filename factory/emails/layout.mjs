/* ============================================================================
   The email shell, and the few components every journey is built from.

   WHY IT IS TABLES AND INLINE STYLES. This is not nostalgia. Outlook on Windows
   renders through Word, which supports neither flexbox nor grid nor padding on an
   anchor; Gmail strips anything in <head> in some contexts; several webmail
   clients drop classes entirely. A 600px table with attributes on the cells is
   the only construction that survives all of them. The <style> block below is
   progressive enhancement for mobile and nothing more: remove it and every one of
   these messages still lays out correctly.

   WHAT ADAPTS PER DEMO. Every colour, the corner radius and both font stacks
   arrive as literal values from palette.mjs, which derived them from that demo's
   own theme and checked the contrast. Nothing here reads a custom property,
   because email clients do not resolve them.

   DARK THEMED DEMOS. A demo whose storefront is dark produces a dark email, which
   is the point. Two things make that safe rather than a gamble: the palette has
   already checked every pair, and the meta tags below tell a client the message
   handles both schemes so it does not apply its own inversion on top and land at
   dark text on a dark ground.

   PERSONALISATION IS DENGAGE'S OWN SYNTAX. {%= =%} outputs, {% %} is a JavaScript
   block, and $from("table") queries the Data Space at send time. That is what
   makes these panel-driven rather than static: the marketer edits the copy in the
   Code Editor and the data comes from the same tables the playbook describes.
   ========================================================================== */

/* A button that survives Outlook. The VML rectangle is only parsed by Word, so
   every other client sees the anchor; Outlook sees a rectangle it can fill and
   size, with the anchor's text centred inside it. */
export function button(palette, label, href) {
    return `
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" bgcolor="${palette.brand}" style="border-radius:${palette.radius}px">
                          <!--[if mso]>
                          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
                            href="${href}" style="height:46px;v-text-anchor:middle;width:240px" arcsize="${Math.round(palette.radius / 46 * 100)}%"
                            stroke="f" fillcolor="${palette.brand}">
                            <w:anchorlock/>
                            <center style="color:${palette.onBrand};font-family:${palette.body};font-size:15px;font-weight:bold">${label}</center>
                          </v:roundrect>
                          <![endif]-->
                          <!--[if !mso]><!-- -->
                          <a href="${href}" style="display:inline-block;padding:14px 30px;font-family:${palette.body};font-size:15px;font-weight:bold;color:${palette.onBrand};text-decoration:none;border-radius:${palette.radius}px;background-color:${palette.brand}">${label}</a>
                          <!--<![endif]-->
                        </td>
                      </tr>
                    </table>`;
}

/* One product, as a row. Used for the items a shopper left behind, where the
   values come from a Data Space query rather than from the catalogue. */
export function productRow(palette, product) {
    return `
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse">
                      <tr>
                        <td width="96" valign="top" style="padding:0 16px 0 0">
                          <img src="${product.image}" width="96" height="96" alt="${product.name}"
                            style="display:block;width:96px;height:96px;border:0;border-radius:${palette.radius}px;background-color:${palette.wash};object-fit:cover">
                        </td>
                        <td valign="top" style="font-family:${palette.body};font-size:15px;line-height:1.5;color:${palette.text}">
                          <div style="font-weight:bold">${product.name}</div>
                          <div style="color:${palette.quiet};font-size:13.5px;padding-top:2px">${product.meta}</div>
                          <div style="padding-top:6px;font-weight:bold;font-size:16px">${product.price}</div>
                        </td>
                      </tr>
                    </table>`;
}

/* A three across recommendation strip. In Dengage this is where a Recommendation
   Rule is placed, so the loop below is illustrative of the shape the rule fills:
   the marketer swaps the array for the rule's own output without touching the
   markup around it. */
export function recommendationStrip(palette, heading, items) {
    const cells = items.map((item) => `
                          <td width="33%" valign="top" style="padding:0 6px">
                            <img src="${item.image}" width="168" height="168" alt="${item.name}"
                              style="display:block;width:100%;max-width:168px;height:auto;border:0;border-radius:${palette.radius}px;background-color:${palette.card}">
                            <div style="font-family:${palette.body};font-size:13.5px;line-height:1.45;color:${palette.text};padding-top:8px">${item.name}</div>
                            <div style="font-family:${palette.body};font-size:13.5px;font-weight:bold;color:${palette.text};padding-top:2px">${item.price}</div>
                          </td>`).join('');
    return `
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
                      style="border-collapse:collapse;background-color:${palette.wash};border-radius:${palette.radius}px">
                      <tr><td style="padding:20px 14px 22px">
                        <div style="font-family:${palette.display};font-size:15px;font-weight:bold;color:${palette.text};padding:0 6px 14px">${heading}</div>
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse">
                          <tr class="stack">${cells}</tr>
                        </table>
                      </td></tr>
                    </table>`;
}

/* The masthead. THE DENGAGE MARK, NEVER THE PROSPECT'S: non-negotiable 3. The
   store's name appears as text beside it, which is what the storefront does too. */
function header(palette, storeName) {
    return `
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td style="font-family:${palette.display};font-size:17px;font-weight:bold;color:${palette.canvasText};letter-spacing:-0.01em">
                          Dengage
                          <span style="font-family:${palette.body};font-weight:normal;font-size:12px;color:${palette.canvasQuiet};padding-left:6px">eComm Demo</span>
                        </td>
                        <td align="right" style="font-family:${palette.body};font-size:12px;color:${palette.canvasQuiet}">${storeName}</td>
                      </tr>
                    </table>`;
}

function footer(palette, storeUrl, unsubscribe) {
    return `
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr><td style="font-family:${palette.body};font-size:12px;line-height:1.6;color:${palette.canvasQuiet};padding-top:6px">
                        You are receiving this because you shopped with us.
                        <a href="${unsubscribe}" style="color:${palette.canvasQuiet};text-decoration:underline">Unsubscribe</a>
                        or <a href="${storeUrl}" style="color:${palette.canvasQuiet};text-decoration:underline">visit the store</a>.
                        <br>This is a demonstration storefront built for a sales conversation.
                      </td></tr>
                    </table>`;
}

/* The whole document. `blocks` is an array of HTML strings, stacked inside the
   card with a consistent gap between them. */
export function shell(options) {
    const { palette, subject, preheader, storeName, storeUrl, unsubscribe, blocks } = options;
    const stacked = blocks.map((block) => `
                <tr><td style="padding:0 0 22px">${block}
                </td></tr>`).join('');

    return `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${subject}</title>
<!--[if mso]>
<xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
<![endif]-->
<style>
  /* Progressive enhancement only. Every message lays out correctly without it. */
  body{margin:0;padding:0;width:100%!important;-webkit-text-size-adjust:100%}
  img{border:0;line-height:100%;outline:none;text-decoration:none}
  a{color:${palette.brandText}}
  @media screen and (max-width:620px){
    .frame{width:100%!important}
    .pad{padding-left:20px!important;padding-right:20px!important}
    .stack td{display:block!important;width:100%!important;padding:0 0 18px!important}
    .h1{font-size:24px!important;line-height:1.2!important}
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${palette.canvas}">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${preheader}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${palette.canvas}">
    <tr>
      <td align="center" style="padding:26px 12px 40px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="frame" style="width:600px;max-width:600px">
          <tr><td class="pad" style="padding:0 8px 16px">${header(palette, storeName)}
          </td></tr>
          <tr>
            <td class="pad" style="padding:30px 32px 10px;background-color:${palette.card};border-radius:${palette.radius}px;border:1px solid ${palette.edge}">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${stacked}
              </table>
            </td>
          </tr>
          <tr><td class="pad" style="padding:14px 8px 0">${footer(palette, storeUrl, unsubscribe)}
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

/* Text blocks, kept here so a journey file is content rather than markup. */
export function heading(palette, text) {
    return `
                    <h1 class="h1" style="margin:0;font-family:${palette.display};font-size:27px;line-height:1.18;font-weight:bold;color:${palette.text};letter-spacing:-0.015em">${text}</h1>`;
}

export function paragraph(palette, text) {
    return `
                    <p style="margin:0;font-family:${palette.body};font-size:15.5px;line-height:1.62;color:${palette.text}">${text}</p>`;
}

export function quietLine(palette, text) {
    return `
                    <p style="margin:0;font-family:${palette.body};font-size:13.5px;line-height:1.55;color:${palette.quiet}">${text}</p>`;
}

export function eyebrow(palette, text) {
    return `
                    <div style="font-family:${palette.body};font-size:11.5px;letter-spacing:0.13em;text-transform:uppercase;color:${palette.brandText};font-weight:bold">${text}</div>`;
}

export function divider(palette) {
    return `
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr><td style="border-top:1px solid ${palette.edge};font-size:0;line-height:0">&nbsp;</td></tr>
                    </table>`;
}

/* ============================================================================
   The AMP for Email variant of the cart abandonment message.

   WHY THIS ONE. Cart abandonment is where interactivity earns its place: the
   shopper already chose the items, so the only thing left to do inside the
   message is browse what goes with them. A carousel does that without a click
   through to the site, which is the whole promise of AMP email.

   WHERE IT GOES IN DENGAGE. The Code Editor has two tabs, HTML and AMP. This file
   is the AMP tab; the ordinary cart-abandonment.html is the HTML tab. A client
   that supports AMP renders this one, and every other client falls back to the
   HTML automatically, which is why the fallback is not optional and both files are
   generated together.

   WHAT WORKS HERE AND WHAT DOES NOT, STATED PLAINLY, because the difference
   decides what can be demonstrated.

   Works, and is used below: amp-carousel, amp-img, amp-accordion. All of them are
   client side, so they need nothing but the committed images the demo already
   publishes. That is a genuinely interactive email: swipe the recommendations,
   open the delivery answers, without leaving the inbox.

   Does NOT work from this demo, and is deliberately absent: amp-list and amp-form.
   Both need an HTTPS endpoint that returns the AMP CORS headers, including
   AMP-Email-Allow-Sender for the sending domain. The demos are served from GitHub
   Pages, which cannot set response headers, so a live price feed or an in-email
   submit would fail closed and show nothing. Adding them would demonstrate a
   broken email rather than a dynamic one. They are worth describing on a call as
   the next step once an endpoint exists.

   TWO THINGS TO SAY BEFORE ANYONE OPENS THIS. Gmail, Yahoo and Mail.ru render AMP
   email, and the sending domain has to be registered with each of them first;
   until it is, every recipient sees the HTML fallback, which is the correct and
   safe outcome. And the AMP part must arrive with the message, which is what the
   panel's AMP tab is for.

   THE STRICT PART. amp4email refuses to render at all on a validation error, so
   the rules below are not stylistic: one style block named amp-custom, the
   boilerplate untouched, no external stylesheet, no arbitrary script, every image
   an amp-img with explicit width and height, and no !important anywhere in the
   CSS. factory/emails/emails.test.mjs asserts each of those on the generated file.
   ========================================================================== */

/* THE UNSUBSCRIBE LINK IS ABSOLUTE, AND THAT IS A VALIDATOR RULE RATHER THAN A
   PREFERENCE. amp4email rejects a relative href, and a bare {%= =%} tag in an
   href reads as relative to the validator, so the AMP tab would refuse to save.
   The link below is therefore absolute with the contact key in the query, which
   validates and still resolves per recipient. Swap it for the Code Editor's own
   unsubscribe element if the account requires that instead: the HTML tab, which
   is not validated, keeps the ordinary tag. */

/* amp4email forbids !important and external CSS, so everything here is either in
   the one amp-custom block or an attribute. Sizes are explicit because AMP has to
   know the layout before the image loads. */
export function ampCartAbandonment(palette, ctx, mode) {
    const slides = ctx.related.concat(ctx.similar).slice(0, 6).map((item) => `
        <div class="slide">
          <a href="${item.href}" class="tile" target="_blank">
            <amp-img src="${item.image}" width="240" height="240" layout="fixed" alt="${item.name}"></amp-img>
            <div class="tname">${item.name}</div>
            <div class="tprice">${item.price}</div>
          </a>
        </div>`).join('');

    const cart = ctx.ampCart.map((item) => `
          <div class="row">
            <amp-img src="${item.image}" width="88" height="88" layout="fixed" alt="${item.name}" class="thumb"></amp-img>
            <div class="rowtext">
              <div class="rname">${item.name}</div>
              <div class="rmeta">${item.meta}</div>
              <div class="rprice">${item.price}</div>
            </div>
          </div>`).join('');

    return `<!doctype html>
<html amp4email data-css-strict lang="en">
<head>
<meta charset="utf-8">
<script async src="https://cdn.ampproject.org/v0.js"></script>
<script async custom-element="amp-carousel" src="https://cdn.ampproject.org/v0/amp-carousel-0.2.js"></script>
<script async custom-element="amp-accordion" src="https://cdn.ampproject.org/v0/amp-accordion-0.1.js"></script>
<style amp4email-boilerplate>body{visibility:hidden}</style>
<style amp-custom>
  body{margin:0;padding:0;background-color:${palette.canvas};font-family:${palette.body}}
  .wrap{max-width:600px;margin:0 auto;padding:26px 12px 40px}
  .head{display:flex;justify-content:space-between;align-items:baseline;padding:0 8px 16px}
  .brand{font-family:${palette.display};font-size:17px;font-weight:bold;color:${palette.canvasText}}
  .brand span{font-family:${palette.body};font-weight:normal;font-size:12px;color:${palette.canvasQuiet};padding-left:6px}
  .store{font-size:12px;color:${palette.canvasQuiet}}
  .card{background-color:${palette.card};border:1px solid ${palette.edge};border-radius:${palette.radius}px;padding:30px 26px}
  .eyebrow{font-size:11.5px;letter-spacing:.13em;text-transform:uppercase;color:${palette.brandText};font-weight:bold}
  h1{font-family:${palette.display};font-size:26px;line-height:1.18;color:${palette.text};margin:10px 0 12px}
  p{font-size:15.5px;line-height:1.6;color:${palette.text};margin:0 0 18px}
  .row{display:flex;gap:16px;padding:12px 0;border-bottom:1px solid ${palette.edge}}
  .thumb{border-radius:${palette.radius}px;background-color:${palette.wash}}
  .rname{font-size:15px;font-weight:bold;color:${palette.text}}
  .rmeta{font-size:13.5px;color:${palette.quiet};padding-top:2px}
  .rprice{font-size:16px;font-weight:bold;color:${palette.text};padding-top:6px}
  .cta{display:block;text-align:center;background-color:${palette.brand};color:${palette.onBrand};
       text-decoration:none;font-size:15px;font-weight:bold;padding:14px 20px;
       border-radius:${palette.radius}px;margin:22px 0 8px}
  .strip{background-color:${palette.wash};border-radius:${palette.radius}px;padding:18px 14px;margin-top:22px}
  .striphead{font-family:${palette.display};font-size:15px;font-weight:bold;color:${palette.text};padding:0 4px 12px}
  .swipe{font-size:11.5px;color:${palette.quiet};padding:10px 4px 0;text-align:center}
  .slide{padding:0 6px}
  .tile{display:block;text-decoration:none}
  .tname{font-size:13.5px;line-height:1.4;color:${palette.text};padding-top:8px}
  .tprice{font-size:13.5px;font-weight:bold;color:${palette.text};padding-top:2px}
  amp-accordion section{border:0}
  amp-accordion h4{font-size:14px;color:${palette.text};background-color:${palette.card};
                   border-top:1px solid ${palette.edge};margin:0;padding:13px 2px;font-weight:bold}
  amp-accordion .ans{font-size:13.5px;line-height:1.55;color:${palette.quiet};padding:0 2px 14px;margin:0}
  .foot{font-size:12px;line-height:1.6;color:${palette.canvasQuiet};padding:14px 8px 0}
  .foot a{color:${palette.canvasQuiet}}
</style>
</head>
<body>${ctx.ampPrelude || ''}
  <div class="wrap">
    <div class="head">
      <div class="brand">Dengage<span>eComm Demo</span></div>
      <div class="store">${ctx.storeName}</div>
    </div>

    <div class="card">
      <div class="eyebrow">Your basket</div>
      <h1>Still here whenever you are</h1>
      <p>Hi ${ctx.greetingName},
         your basket is saved. Swipe the row below to see what goes with it, without leaving your inbox.</p>

      ${cart}

      <a class="cta" href="${ctx.storeUrl}cart.html" target="_blank">Return to basket</a>

      <div class="strip">
        <div class="striphead">Often bought with these</div>
        <amp-carousel height="300" layout="fixed-height" type="carousel" role="region" aria-label="Recommended products">
${slides}
        </amp-carousel>
        <div class="swipe">Swipe to see more</div>
      </div>

      <amp-accordion>
        <section>
          <h4>When will it arrive?</h4>
          <p class="ans">The arrival date is shown at checkout before you pay, and it is the date we commit to.</p>
        </section>
        <section>
          <h4>What if it is not right?</h4>
          <p class="ans">Thirty days to change your mind. The return label is already in your account.</p>
        </section>
        <section>
          <h4>How can I pay?</h4>
          <p class="ans">Card, wallet and pay later options are all accepted at checkout.</p>
        </section>
      </amp-accordion>
    </div>

    <div class="foot">
      You are receiving this because you shopped with us.
      <a href="${ctx.unsubscribe}" target="_blank">Unsubscribe</a>.
      <br>This is a demonstration storefront built for a sales conversation.
    </div>
  </div>
</body>
</html>
`;
}

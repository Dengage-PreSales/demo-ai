# The five inline creatives

Paste each file into the campaign named in its header. These are **not** popups and
the contract is different in three ways that matter, all from handoff 12.3 and
confirmed in the SDK bundle.

## Inline is not sandboxed

| | Popup or banner | Inline |
|---|---|---|
| Renders in | cross-origin iframe | **the page itself** |
| `<style>` | scoped to the iframe | **lifted into `document.head`** |
| `<script>` | stripped on save | **run through `new Function()` in page scope** |
| Clicks | need `Dn.sendClick` | **`a[href]` counted automatically** |
| `href` | resolves against the iframe, so unusable | **resolved against the page, so relative works** |
| Can read the page | no | **yes** |

Three consequences:

1. **All CSS must be scoped under the file's root id.** One unscoped selector
   restyles the whole storefront, and it reads as a broken storefront rather than a
   broken creative. `factory/checks/creative.js` refuses a file that does not.
2. **No `Dn` calls.** `Dn` exists inside a creative iframe, and an inline creative
   is not in one. Use `<a href="...">` and the SDK counts the click itself.
3. **These can be prospect specific, and the other 22 cannot.** Script in page
   scope means `window.Catalog` and `window.DEMO_CONFIG` are readable, so an
   inline creative renders the prospect's real products, real images, real
   category names and their theme colours. This is where "personalize the website"
   actually lives.

## Where the images come from

Nowhere new. The generator scrapes the URL pre-sales feeds, commits the product
images into the demo folder, and writes `products.json`. `window.Catalog` loads it.
These creatives read `Catalog`, so the artwork is whatever that demo's catalogue
holds and it changes per prospect with no edit here.

`Catalog.media(product)` is the one function to use: it returns the committed image
when there is one and a generated placeholder when there is not. Never build an
`<img>` by hand, or a product without artwork renders as a broken image on a call.

## Rules these files share with the other 22

Handoff 2.2a still applies. One campaign serves every demo forever, so no file may
name a brand, a price, a currency or a percentage **in its own copy**. Reading a
product name out of the prospect's catalogue at run time is different: that is the
demo's own data, not text baked into a shared campaign.

Prices come from the catalogue or are omitted. Never `Number(null)`, which is 0.
Handoff 1.8.

## The five

| File | Campaign | Target | Shows |
|---|---|---|---|
| `below-header.html` | `dengage_demo_inline-below-header` | `#dn_inline_target_below_header` | affinity strip, category the visitor has been in |
| `below-hero.html` | `dengage_demo_inline-below-hero` | `#dn_inline_target_below_hero` | the prospect's own category tiles |
| `in-grid.html` | `dengage_demo_inline-in-grid` | `#dn_inline_target_in_grid` | one promoted product, in the grid flow |
| `pdp-below-price.html` | `dengage_demo_inline-pdp-below-price` | `#dn_inline_target_pdp_below_price` | cross sell from the same category |
| `above-footer.html` | `dengage_demo_inline-above-footer` | `#dn_inline_target_above_footer` | continue where you left off |

Panel settings for all five:

```
Trigger            Data Layer Event
Event name         dengage_demo_inline-<name>
Content type       Inline
Inline target      the selector above, found with the panel's Inline Target
                   Selector by searching  dn_inline_target
Where to display   /.*/
Status             Active
```

Find the target with the panel's selector tool rather than typing it: it scans for
the search word in a `class` or `id` and prefers an id, which is the form these
targets take. An empty target has no height, so the tool's overlay has nothing to
draw. Pick it from the node list.

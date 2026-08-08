# Known-bad fixture

**Every name and identifier in here is invented.** "Vantoro Tyres", `GTM-0000000`
and the application guid are placeholders, chosen on 6 August 2026 to replace the
real customer name and the real third party ids this fixture used to carry. It is
a public repository, and a known-bad fixture is the last place anyone would think
to look for a live identifier, which is exactly why they should not be here.

`refCatalog.js` stands for the reference build's launcher module, whatever it is
called there.

This tree is deliberately wrong. It is the guard's test input, it is never
served, and it is excluded from the guard's own run over the repository.

A guard that passes on an empty repository proves nothing (handoff 11.1), so
`factory/guard/test.sh` runs the guard against this tree and asserts that every
check reports a failure. If a check ever stops failing here, that check has
stopped working.

It reproduces, in miniature, what a naive copy of the reference build's modules
would put into `template/`. Each violation below is the construct as it appears
in the module named beside it, so the fixture stays meaningful after `seed/` is
deleted at the end of Phase 1.

| Check | What trips it | Reference module |
|---|---|---|
| `core-repo-isolation` | a link to the core repository's Pages origin | `index.html` |
| `ec-calls` | `ec:addToCart`, `ec:search`, `ec:addToWishlist`, `ec:order` | `cartManager.js`, `searchPanel.js`, `wishlist.js` |
| `table-allowlist` | `sendDeviceEvent` targeting a variable rather than a literal | `refCatalog.js`, `wishlist.js`, `eventModal.js` |
| `standard-table-names` | `onsite_events`, `wishlist_events`, `order_events`, `events` | all five |
| `off-origin-assets` | a tag manager and a prospect image CDN | `index.html` |
| `image-locations` | brand artwork committed outside an expected path | `images/` |
| `dashes` | a real em dash and a real en dash | `copy.md` |
| `app-guid` | an application identifier written into page code, and a demo naming a different one | `index.html`, `demo.config.json` |
| `template-purity` | the reference build's brand name, and colours below the `:root` block | `style.css` |
| `seed-removed` | `seed/` still present once `template/` exists | `seed/` |

The two modules worth understanding rather than skimming are `refCatalog.js`
and `eventModal.js`.

`refCatalog.js` makes no `ec:` call and names none of the five standard
ecommerce tables, so a denylist of those five passes it cleanly while it writes
to a core account table on every launcher click. It is the reason the guard
uses an allowlist (handoff 5.3, 11).

`eventModal.js` renders a free-text input for the table name and sends to
whatever is typed. No static check can close that, including this one: the
guard sees a variable and refuses it, but the fix that matters is the fixed
dropdown and the call-site validation in the module itself, asserted by the
smoke test (handoff 5.3, 9).

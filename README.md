# Dengage Demo Factory

Generates a working, themed ecommerce demo storefront from one URL, so a
pre-sales conversation can be held against a store that looks like the
prospect's own.

Demos are live at `https://dengage-presales.github.io/demo-ai/demos/<slug>/`.

---

## Request a demo

1. Open a [new demo request](../../issues/new?template=new-demo.yml).
2. Paste the prospect's website URL. Everything else is optional.
3. Wait. You will get a comment on the issue with the live link, usually within
   half an hour.

That is the whole process. There is nothing to install and no code to write.

**If the build cannot read the store**, the issue comment will say so and ask
for a product list as a CSV. That happens on stores that block automated
readers or that need a login. Twenty to thirty products is plenty.

## What you get

A storefront in the prospect's colours and typography, carrying their real
product names and photographs, with their category structure. It is Dengage
branded, not a copy of their site.

Working in the demo:

- Home, product listing, product detail, cart, checkout, search and a wishlist
- **Eight on-site personalization widgets**, fired on demand from the launcher
  panel in the page, so you control what appears and when
- **Five inline content slots**, targetable from the Dengage panel
- **Web push**, so you can compose a message in the panel during a call and
  have it arrive on screen

Every interaction is recorded against a real Dengage account, so you can open
the panel and show the data landing.

## Good to know before a call

**Widgets can be re-fired.** If one stops appearing, use the reset control in
the launcher panel rather than reloading and hoping.

**Demos expire after 90 days** and are then deleted automatically. You get a
warning on the original issue seven days ahead. If you still need it, say so on
that issue.

**The widget creatives are shared by every demo**, so they are deliberately
generic and never mention a brand, a product or a discount. If a call needs
something specific to that prospect, build it as a one-off campaign in the
Dengage panel. Do not edit the shared eight: they are live on every demo at
once.

---

## For maintainers

Everything about how this works, why it is built this way, and what will break
if you change it is in **[`DEMO-FACTORY-HANDOFF.md`](DEMO-FACTORY-HANDOFF.md)**.
Read it before changing anything.

The one rule that matters most: **this repository must never write to a Dengage
table shared with `salil-dengage/dengage-demos`**, which holds the five core
demo sites and two mobile apps used on live calls. No `ec:*` calls, ever. Table
names are an allowlist of `sandbox_events` and `sandbox_onsite_events`. CI
enforces it, and the reasoning is in the handoff.

This repository lives on its own GitHub account, `Dengage-PreSales`, and that
is deliberate: it gives the factory its own browser origin so it cannot share
storage or notification permission with the core demo sites. Handoff §2.5a is
why, and it should be read before anyone proposes consolidating the accounts.

**The Dengage account is still shared.** The sandbox web application sits inside
account 28, so the tables and contacts are common with the core sites. The
account split protects the browser, not the data.

### First-time setup

GitHub Pages must be on for this repository, main branch, root. Nothing works
before that: no demo is reachable and the push icon URL resolves to nothing.
Handoff §2.0.

| Task | Where |
|---|---|
| Bringing the Dengage panel up from scratch | `factory/phase0/README.md`, handoff §2 |
| How a demo is generated | handoff §7 |
| What the eight creatives may say, and why their CTAs cannot navigate | handoff §2.2a |
| The five modules that cannot be copied unchanged | handoff §5.3 |
| Traps that have already cost somebody a day | handoff §12 |

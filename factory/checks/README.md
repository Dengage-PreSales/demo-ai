# Template checks

Browser checks of `template/` itself. Handoff 9.1.

```bash
npm install playwright        # once
bash factory/checks/run.sh
```

The runner builds its own fixtures, starts its own servers on ports 8101 and
8102, and cleans both up on exit.

---

## What this is not

| | Runs on | Scope | Lives in |
|---|---|---|---|
| `factory/guard/` | every commit, in CI | static analysis of every file | bash, no dependencies |
| `factory/checks/` | before changing `template/` | the template **and every built demo**, in a real browser | node, needs Playwright |
| `factory/checks/smoke.mjs` | after generating a demo | one built demo, thirty seconds | node, needs Playwright |

```bash
node factory/checks/smoke.mjs --url http://localhost:8101/demos/<slug>/
```

The smoke test is the acceptance check for a GENERATED demo, and the build
workflow runs it before anything reaches `main`. Forty-two assertions covering
handoff 9's twelve items. Three of them are never skipped for speed: that every
payload comes from `js/dengageEvents.js`, that every tile resolves locally, and
that no product carries a fabricated price or stock count.

It has been driven against a demo with four defects injected on purpose, and
caught all four: an SDK call from a file that is not the emitter, a price coerced
to zero, a whole catalogue with zero stock, and a hotlinked image. A smoke test
that cannot fail is worth nothing.

`creative.js` is the third check here. It answers "does this creative satisfy the
engine's form contract" **without the panel**, by running the creative against
Dengage's own published on-site form handler with the parent boundary stubbed.
Nothing reaches Dengage and no contact is created.

That check exists because pasting a creative into the panel and clicking submit is
a terrible diagnostic: the card just sits there. Wrong field vocabulary, wrong
nesting, a missing `data-dn-is-enabled`, and a handler that failed to load all look
identical from the outside. It reports which one it is, and prints the exact
payload the creative would send.

It assembles the iframe with a function replacement, so the injected source reaches
the document byte identical to what is served, and reports the exact payload the
creative would send.

### Two checks that exist because looking at it was not enough

`banner.mjs` asks whether a top bar pushes the storefront header down or covers it.
It is here because that bug was fixed twice and shipped broken both times. Both
fixes were verified against a stand-in banner written for the test, a short fixed
div at the top of the page, which is a shape that is easy to imagine and is not the
shape the engine produces. The engine delivers a cross-origin iframe sized by the
engine rather than by its content, so a 56px bar can sit at the top of a frame as
tall as the viewport with transparency below it, and from outside that frame it is
indistinguishable from a modal scrim.

So its first fixture is that iframe, and its assertion is where the header's top
edge ends up rather than whether a variable got written. It also checks the shapes
a panel-authored campaign produces, that a real scrim does **not** move the header,
and that an absurd or non-numeric reported height is refused.

`wheel.mjs` measures the prize wheel's slice labels against the hub and the rim.
Everything else about a creative can be judged by looking at it once; this cannot,
because the labels sit in fixed coordinates and render in a font that arrives from
the prospect's theme at run time. It fetches the real families and measures the
widest, because measuring the font a test machine happens to fall back to reported
a one unit collision that was really five. It skips loudly if it cannot reach
Google Fonts, rather than measuring a fallback and reporting a pass it has not
earned.

The guard reads files and cannot see behaviour. The smoke test checks a demo that
will be deleted in 90 days and deliberately does not earn a regression suite.

**This is the one in the middle, and it is the one that is not disposable.**
Every demo the factory builds is a copy of `template/`, so a defect here ships
five to seven times a month until somebody notices, and the ones that matter are
invisible in a diff.

---

## Why it exists

Three defects in this repository's own code, none of which a diff would show:

**Fourteen campaigns had no way to be fired.** `factory/creatives/` and
`js/panels.js` are two hand-maintained lists of the same campaigns, and they went
out of step: the creatives were written, committed and documented while the
launcher still offered the original eight. Nothing failed. Every check passed, the
site was live, and the only symptom was a group of scenarios no button could reach,
which is invisible unless somebody counts. `launcher.js` counts, in both
directions, against the file names on disk. Handoff 5.1.

**Every demo shared one storage namespace.** `js/identity.js` and `js/store.js`
read the slug from `data-demo-slug`, and `js/boot.js` set that attribute
asynchronously after a fetch. So both read it before it existed and fell back to
a literal default: `dps:demo:cart` for every demo ever built. Two demos open in
one browser shared a cart, a wishlist and a contact. Handoff 12.11.

**An unreachable font stylesheet stalled the SDK.** The font `<link>` sat above
`js/identity.js`, and a browser will not run a script while a stylesheet is still
loading. With Google Fonts unreachable the page sat at `readyState: "loading"`
with `identity.js` never having run, so no `initialize`, no `pageView`, and no
widget that could fire. Corporate networks do block Google Fonts. Handoff 12.12.

---

## Three things about the check itself

**One tab cannot catch the first bug, so section 11 opens two.** The namespacing
looked perfectly correct in a single demo: keys present, storage working, a reload
keeping the identity. It only shows with two demos, different slugs, on **one
origin**, which is how they sit on Pages. Two servers on two ports would pass no
matter how broken it was, because `localStorage` is scoped per origin and they
would be two origins. Anything claiming to prove isolation has to open two.

**An assertion that hard codes a key name can pass by checking nothing.** The
first version compared against `dps:template:ck` while the code was really using
`dps:demo:ck`. It read `null`, compared it to `null`, and passed, in exactly the
situation it existed to catch. Every storage assertion now derives the key name
from the page and asserts the derived value. Same rule as the guard's own suite:
any check that can fail open needs a test that would catch it failing open.

**Half of what `launcher.js` asserts is that a call did NOT happen, so it has to
watch the right channel.** Every campaign here is triggered by a Data Layer Event,
which means `DengageEvents.scenario` pushes onto `window.dataLayer` and never calls
the SDK function. Watching a stub on `window.dengage` records nothing when a
scenario fires, and then reports "the launcher pushed nothing" for the presses that
worked and the presses that were correctly refused alike: the same wrong answer
twice, in a check whose whole job is telling those two apart.

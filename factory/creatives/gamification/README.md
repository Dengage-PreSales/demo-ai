# The gamification creatives

## The mechanism, recovered from the SDK

The engine exposes exactly this inside a creative's iframe, from `shared.js`:

```js
Dn.dismiss()                 Dn.close()
Dn.sendClick(buttonId)       Dn.setTags(tags)
Dn.copyText(text)            -> Promise, clipboard with a textarea fallback
Dn.openUrl(url, newTab)      -> the PARENT navigates, so it is not iframe bound
Dn.getGameWinner(payload)    -> Promise. Resolves with the prize, REJECTS after 3s
Dn.updateHeight()            -> rarely needed, see below
```

`getGameWinner` posts to the parent, which calls the coupon draw endpoint and posts
the result back. That means **a gamification creative needs JavaScript**, and the
panel strips `<script>` on save. So all of it lives in inline `onclick` handlers.
That is not a style choice and it is not negotiable: handlers survive the panel and
script blocks do not. Phase 0 confirmed handlers run.

## Three things that will bite

**It rejects after three seconds.** If no game or coupon is configured in the
panel, or the draw fails, the promise rejects. Every creative here has a `.catch`
that shows a plain fallback state. Without one the wheel spins forever in front of
a prospect, which is the worst outcome available. Test each one **before** a call
with the game actually configured.

**The prize text comes from the server, never from the creative.** The winner
object is whatever the draw endpoint returns, so these files display it rather than
containing it. That is also what keeps them shareable: the prize is configured per
campaign in the panel, so one creative serves every demo without naming a discount.
The fields are read defensively, because the response shape is not documented.

**Height is handled for you.** `shared.js` installs a `ResizeObserver` and a
`MutationObserver` on the document, so revealing a prize resizes the iframe
automatically. `Dn.updateHeight()` exists for the cases those miss; do not sprinkle
it everywhere.

## State without script

Reveal is driven by an attribute the inline handler sets, and CSS reacts:

```
data-state="ready"     the game, before playing
data-state="playing"   the animation
data-state="won"       the prize
data-state="sorry"     the draw failed or timed out
```

Same pattern the engine itself uses for forms with `data-dn-is-submitted`.

## The three

> **CHANGED, 5 August 2026.** Salil removed pick a box, the slot machine and the
> mystery coupon, and replaced all three with **countdown to win**, authored in the
> panel's own builder rather than pasted from here. Five mechanics was more than a
> call needs, and each one carried the same three second draw and the same fallback
> state, so the marginal one cost setup time without showing a prospect anything
> they had not already seen.

| File | Campaign | Mechanic |
|---|---|---|
| `spin-to-win.html` | `dengage_demo_spin-to-win` | wheel, CSS rotation |
| `scratch-card.html` | `dengage_demo_scratch-card` | scratch away a covering panel |
| `countdown-to-win.html` | `dengage_demo_countdown-to-win` | a timed offer, thirty seconds |

> **CHANGED AGAIN, 7 August 2026.** Countdown to win now has a file. It was built in
> the panel's builder and carried `panel: true`, which is what tells
> `factory/checks/launcher.js` to expect a card with no creative on disk. Salil asked
> for a file so the panel's stock template could be replaced with one that matches
> the other two and takes the demo's theme, so the flag is gone from
> `template/js/panels.js` and the check now expects a creative for it like any other
> card. `panel: true` still means what it says for the cards that keep it, and any
> other card without a file is a defect, since it would push an event nothing answers.

## The countdown, and the one thing it does differently

A clock has to tick, ticking needs a timer, and the panel strips `<script>` on save.
The other two games hang their logic on `onclick`, which survives, but a clock has no
click to hang off. So the interval starts from `onload` on a zero-size image, which is
the same mechanism the theme bootstrap uses and the same one Phase 0 proved works.

**The interval is always cleared**, at zero and on a claim. One left running inside a
dismissed creative keeps a dead iframe alive and keeps writing into a card nobody is
looking at.

**It has four states rather than three.** `ready`, `won` and `sorry` match the other
two, and `expired` is its own: the clock stays on screen at zero with the ring and the
digits gone quiet, because a countdown that disappears when it runs out never shows
what expiring looks like, and that is the whole mechanic.

Panel settings for the two files above:

```
Trigger              Data Layer Event
Event name           dengage_demo_<name>
Where to display     /.*/
Status               Active
Show every X minutes 1
Max show count       100
Layout               Popup, width 420 to 470
Design               padding 0, transparent background
Close button         Layout > Close Button > "Add close button to outside"
Coupon / game        configured, or both land in their fallback state
```

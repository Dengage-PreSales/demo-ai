# The shared creatives: mechanics reference

Extracted from the reference creatives in `seed/panel-content/en/` before that
folder was deleted at the end of Phase 1, and confirmed by watching the Phase 0
check card render on screen.

**Twenty two campaigns across four groups**, all in this folder: eleven popups and
banners here at the root, one A/B campaign in `ab-testing/` with three variant arms,
five games in `gamification/` and five inline creatives in `inline/`. Each
subfolder has its own README for the mechanics specific to it. With the five
recommendation strategies, which are computed locally by `template/js/recommend.js`
and need no campaign at all, that is the twenty seven scenarios the launcher offers.
Handoff 2.2c, 5.1.

They are pasted into the Dengage panel, not served by this repository. This file is
the contract they must satisfy. `factory/phase0/creative/phase0-check.html` is a
working example of every rule below except the capture mechanism.

**Every campaign here must have a card in `template/js/panels.js`.** A creative with
no card cannot be demonstrated at all, and it is not an error anywhere:
`factory/checks/launcher.js` counts the two lists against each other in both
directions, because they have already drifted once.

---

## What one creative serving every demo can say

**The hardest constraint in the design.** One creative renders on every demo,
forever, so it cannot name a brand, a product, a price, a currency or a vertical.
"20% off outdoor jackets" is wrong because next week the same campaign renders on
a demo selling industrial fasteners.

`{%= ... %}` customization tags do not rescue it. They resolve in Preview and are
then **not applied on a real-time On-Site Targeting trigger** (handoff 12.8). That
closes the obvious escape route, so design around it from the start.

What is left is enough, because the point of these widgets is to demonstrate the
mechanism, not to sell the product.

---

## Rules that come from the iframe

Popups and banners render in a **cross-origin iframe**. Consequences, none of
them obvious:

| Rule | Why |
|---|---|
| The panel strips `<script>` on save | interactivity is CSS plus inline `onclick`, nothing else |
| Every link needs `target="_top"` | otherwise navigation happens inside the iframe |
| Host page JavaScript cannot see events inside the creative | a listener on the page will never fire |
| CSS is scoped under one root id | `#dnf-check .card`, never a bare `.card` |

**Inline creatives are the opposite** (handoff 12.3): not sandboxed, cloned into
the page, `<style>` lifted into `document.head`, `<script>` run through
`new Function()` in page scope. So their CSS leaks page-wide unless every
selector is namespaced, and their anchor clicks are counted without
`Dn.sendClick`.

---

## Clicks only count if the creative reports them

```html
<button onclick="Dn.sendClick('<scenario>__<action>'); Dn.close();">
```

Exactly once per file. A close control calls `Dn.close()` and **never**
`sendClick`, so a dismissal is not counted as a conversion.

Without it the campaign reads **0 clicks**, and opening that report in front of
a prospect is a bad moment caused entirely by a missing line.

### The CTA reports and dismisses. It never navigates.

Every CTA in the reference creatives is an absolute URL to one specific site,
which cannot survive a creative shared across every demo: the link would send a
prospect looking at their own themed storefront somewhere unrelated.

A relative `href` does not fix it, because it resolves against the **iframe's**
origin rather than the page's. There is no URL that is correct for every demo,
because the shared campaign does not know which demo it is rendering on.

Confirmed working in Phase 0: the check card's button called `Dn.sendClick` then
`Dn.close`, the card dismissed, and the prospect stayed on the storefront.

---

## Layout settings that are not style choices

Confirmed by observation in Phase 0, not just documented:

- **Padding 0 and a transparent background.** The engine's container otherwise
  draws a white box around the card, which reads as an unwanted frame. The
  creative supplies its own white, radius and shadow. The Phase 0 card rendered
  with no frame, so these are right.
- **Popups draw no close control of their own.** The panel supplies one, outside
  the card, via Layout > Close Button > "Add close button to outside". A second
  one inside reads as a duplicate. Observed: the X appeared top right, outside.
- **The two bars are Banner, not Popup.** The Banner container is already fixed
  and full width, so the content fills it. Do not add `position: fixed`.
  Banners keep their own close control, because Banner is not offered the
  setting above.

---

## The capture mechanism, for survey, NPS and subscription

Handoff 12.4: these three do **not** write a table. They use the engine's native
form mechanism, which writes a **contact** and **contact tags**. So results are
read on the contact card and segmented on the tags, and there is nothing to
create in Data Space for them. Building a host-page bridge does not work,
because of the iframe.

### Survey and NPS: `Dn.postQuestion()`

The form carries these attributes, taken verbatim from the reference:

> **Corrected.** An earlier version of this section put `data-dn-name` and the
> selection bounds on the `<form>` element. They belong on the **first
> `.form-block`**, which is what the engine reads. On the form they would produce a
> question with no tag name and no bounds, and nothing would say so.

```html
<form class="form" data-dn-form-id="question_form" data-dn-validation-language="en">
  <div class="container">
    <!-- the FIRST .form-block is the question, and IT carries these -->
    <div class="form-block" data-dn-name="<tag name>"
         data-dn-is-radio="true"              <!-- single choice; omit for multi -->
         data-dn-min-selection="1"
         data-dn-max-selection="3">
      <input type="radio" ...>  <!-- or checkbox -->
      <div class="form-message"></div>        <!-- a DIV: the selector is
                                                   div.form-message -->
    </div>
    <div class="submitted-content" data-dn-is-enabled="true"
         data-dn-is-modal-auto-close-enabled="false"
         data-dn-modal-close-seconds="6"> ... </div>
  </div>
</form>
```

`form.form[data-dn-form-id="question_form"]` is the engine's selector, so
`class="form"` is required as well as the attribute. **One question only:** the
engine reads a single `.form-block` and silently ignores a second.

with `data-dn-invalid="true"` and `data-dn-is-submitted="true"` used for state,
and the submit control calling `Dn.postQuestion()` then
`Dn.sendClick('<scenario>__submit')`.

**In that order, and only on success.** `postQuestion` validates and, if the answer
is good, calls `Dn.setTags` itself. It does **not** report the click, so the button's
handler runs it first, reads `data-dn-invalid` to learn what the engine decided, and
reports only when the engine did not mark the question invalid. Reporting the click
first would count an engagement for an empty submit.

**Neither creative switches on its own confirmation panel, and that is load bearing.**
The write is a round trip: the parent SDK POSTs `/api/setTags` and, on success, posts
`{ action: 'closeForm', status: 'tagsSuccess' }` back into the frame, where the
engine's own listener stamps `data-dn-is-submitted`. A creative that stamps it itself
shows the thank you whether or not anything was stored. Both did for part of
10 August 2026, which is how a capture that was not working looked like one that was.
A failed write now leaves the form on screen with the button disabled and no thank
you, which is the signal.

**It sets `data-dn-invalid="false"` rather than removing the attribute.** Safe only
because every invalid style in both creatives keys on `[data-dn-invalid="true"]`. A
selector on `[data-dn-invalid]` alone would show the error on every valid answer.

**Both creatives were on `Dn.setTags` until 10 August 2026**, validating the question
themselves, because that is the call a question creative's payload ends up at anyway.
They moved to the native call after Dengage fixed form submission and
`factory/checks/creative.js` was re-run against the published handler. The gain is
that the engine reads `data-dn-min-selection` and `data-dn-max-selection`, which the
hand written handler ignored: a question offering eight options and allowing three
would have sent all eight.

`data-dn-name` is the contact tag the answer lands in. It must be generic: the
reference uses `tyre_line_interest`, which is exactly the kind of vertical
specific name a shared creative cannot use. Something like `interest_area`.

### THE VISUALLY-HIDDEN CLASS IS LOAD BEARING

Handoff 12.7, and it has been mistaken for cruft before.

```css
#<root> .vh { position:absolute; width:1px; height:1px; opacity:0; pointer-events:none; }
```

Both creatives hide their real radio inputs behind styled score buttons using
this class. It looks like dead markup and it is not: **remove it and the entire
score row unstyles**, because the visible buttons are `<label>` elements whose
appearance is driven by the hidden input's `:checked` state. The input must stay
in the layout, merely invisible, which is why it is not `display: none`.

### Subscription: `Dn.postSubscription()`

First name, last name, email, mobile and three permissions, submitted with
`Dn.postSubscription()`. This is the one path that creates a contact **with
permissions** without any code on the page.

**The payload is built as `form[data-dn-id] = value`**, read off the handler's own source,
so the field names are ours to choose. That is what makes three permissions possible:

| Field | `data-dn-id` | `data-dn-type` |
|---|---|---|
| First name | `name` | `TEXT` |
| Last name | `surname` | `TEXT` |
| Email | `email` | `EMAIL` |
| Mobile, also WhatsApp | `gsm` | `GSM` |
| Email consent | `emailPermission` | `PERMISSION_CHECKBOX` |
| SMS consent | `gsmPermission` | `PERMISSION_CHECKBOX` |
| WhatsApp consent | `whatsappPermission` | `PERMISSION_CHECKBOX` |

**Three permissions rather than one merged, Salil's call, 10 August 2026.** There is a
shortcut id, `mergedPermission`, which the engine expands into `emailPermission` and
`gsmPermission` before posting. Naming those two directly produces the same two keys and
adds the third, which the merge cannot express. Verified by capturing the real payload:
`factory/checks/creative.js` section 4 prints it.

**`whatsappPermission` is the one key here that is not confirmed against a send.** The
other six are either the documented names or what the merge itself produces. The engine
passes any `data-dn-id` through, so it certainly reaches Dengage; whether the subscription
endpoint honours that particular key is a question only a real send answers.

**Every permission is pre-ticked, and that is the engine's rule rather than a choice.**
`PERMISSION_CHECKBOX` is invalid when unchecked, so an untouched box blocks the submit.

**Fields and message spans are paired BY INDEX.** The handler walks `[data-dn-id]` and
`[data-dn-invalid-message-type]` together, so seven fields need seven spans in the matching
order. Add a field without its span and every message after it belongs to the wrong input.
Section 3 of the check prints the pairing and the word `aligned`.

**The submit is guarded, and reports the click only on a valid submit.** If
`Dn.postSubscription` does not exist, which happens when the SDK's injection gate misses
the file, the handler shows a visible notice instead of doing nothing at all. Unlike the
two question creatives there is no fallback available: creating a contact needs the
engine's endpoint, and `Dn.setTags` cannot do it.

#### The skeleton is part of the contract

This looks like layout and is not. Both of these are load bearing:

```html
<form data-dn-form-id="subscription_form" id="<scope>">   <!-- THE ROOT -->
  <style> ... </style>
  <div class="container">                          <!-- INSIDE the form -->
    ... fields and button ...
    <div class="submitted-content" data-dn-is-enabled="true"
         data-dn-is-modal-auto-close-enabled="true"
         data-dn-modal-close-seconds="6"> ... </div>
  </div>
</form>
```

The form is the outermost element. `.container` sits **inside** it, because
`.container` is what the engine stamps `data-dn-is-submitted="true"` on. Wrap the
form in `.container` instead and there is nothing for the engine to find. The auto
close attributes go on `.submitted-content`, never on the form, and without
`data-dn-is-enabled="true"` there is no confirmation state at all.

**Both of those look like layout rather than contract**, which is why they are
called out. `factory/checks/creative.js` drives the real markup against the engine's
published handler and asserts the payload, the validation and the confirmation state,
so run `bash factory/checks/run.sh` after changing any capture creative. A creative
that does not submit looks exactly like one that does until the contact is checked.

---

## Artwork

Brand-neutral and committed, same rule as the storefront. A creative is pasted
into the panel, so any image it references must be a stable absolute URL on this
Pages origin, never a prospect's CDN. `assets/` is where those live.

---

## On-site messaging, the eleven at the root of this folder

| Trigger | Layout | Demonstrates |
|---|---|---|
| `dengage_demo_survey` | Popup | native input capture into contact tags |
| `dengage_demo_nps-popup` | Popup | NPS capture, 0 to 10, tag based segmentation |
| `dengage_demo_subscription-popup` | Popup | contact creation with permissions |
| `dengage_demo_image-popup` | Popup | rich creative, full bleed image |
| `dengage_demo_horizontal-popup` | Popup | wider layout, image beside copy |
| `dengage_demo_cta-image-popup` | Popup | image plus one measured CTA |
| `dengage_demo_sticky-bar` | Banner, Top | persistent top of page messaging |
| `dengage_demo_image-bar` | Banner, Bottom | bottom banner with artwork |
| `dengage_demo_slide-in` | Popup, bottom right | quieter arrival, stays out of the content |
| `dengage_demo_exit-intent` | Popup | fires on the pointer leaving the window |
| `dengage_demo_scroll-depth` | Popup | fires at 70 percent of page height |

The last two are the only campaigns in this folder the launcher cannot fire, because
each listens for something a person does rather than for a data layer event. Both
still get a card, drawn as a dashed hint that names the gesture, so nobody concludes
the factory does not build them. Handoff 5.1.

Changing one of these changes every live demo at once. If a prospect wants a
creative that speaks to their business specifically, that is a bespoke campaign
built for that call, not an edit to a shared creative.

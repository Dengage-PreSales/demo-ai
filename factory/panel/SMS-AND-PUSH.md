# SMS and web push, from scratch

One page. Three assets, then two messages. Nothing on this page is per demo: do it once and
every demo the factory generates uses it.

For the email, see [`factory/emails/BEEFREE.md`](../emails/BEEFREE.md). Nothing here depends
on it.

---

## Step 1. Three Dynamic Content assets

**Content > Dynamic Content.** Open each link, press **Copy raw file**, paste the whole thing
in as the body. Type **Plain Text** for all three.

| Name it | Type | Body comes from |
|---|---|---|
| `dps abandoned cart line` | Plain Text | [`abandoned-cart.txt`](content/_dynamic/abandoned-cart.txt) |
| `dps abandoned cart image` | Plain Text | [`abandoned-cart-image.txt`](content/_dynamic/abandoned-cart-image.txt) |
| `dps abandoned cart url` | Plain Text | [`abandoned-cart-url.txt`](content/_dynamic/abandoned-cart-url.txt) |

On GitHub:

```
https://github.com/Dengage-PreSales/demo-ai/blob/main/factory/panel/content/_dynamic/abandoned-cart.txt
https://github.com/Dengage-PreSales/demo-ai/blob/main/factory/panel/content/_dynamic/abandoned-cart-image.txt
https://github.com/Dengage-PreSales/demo-ai/blob/main/factory/panel/content/_dynamic/abandoned-cart-url.txt
```

What each one outputs, one line each:

| Asset | Output |
|---|---|
| line | `Oxford Shirt and 3 more items` |
| image | `https://dengage-presales.github.io/demo-ai/demos/<slug>/images/push/p2.jpg` |
| url | `https://dengage-presales.github.io/demo-ai/demos/<slug>/index.html?open=cart` |

All three exist now, under the names you gave them in the panel, and all three ids are in
`factory/sandbox.json` as `abandonedCartLine`, `abandonedCartImage` and `abandonedCartUrl`.
The name in the panel does not have to match the name here: `snippet_id` is what resolves and
`snippet_name` is a label.

**`factory/sandbox.json` is the register.** Nothing else in this repository writes a snippet id
down, and there is a reason it is worth keeping that way. On 10 August one id was sent without
saying which asset it belonged to, was recorded as the line asset, and the email preheader
called the **url** asset for a day: every send would have read
`https://.../index.html?open=cart, one press from checkout.` in the inbox preview line.
Nothing failed and nothing could, because a snippet id is valid or invalid and never wrong.
So an id arriving on its own is worth one sentence saying what it is.

---

## Step 2. The SMS

**Content > SMS.** `DPS - Abandoned Cart V1.0`.

| Field | What goes in it |
|---|---|
| Message Type | SMS |
| Sender Name | `DENGAGE - ecomm-codec` |
| **Message** | `Still in your basket: ` then the **line** snippet, then ` Complete your order: ` then the **url** snippet |
| Concatenated SMS | Enabled |
| Alternate Message | `Your basket is still saved and waiting for you.` |

**Insert each snippet with the tag control on the Message field.** Do not type the tag by
hand. The SMS designer writes its own form, `<snippet snippet_id="4870" ... />`, which is not
the form the email uses.

### Three things that will waste your time if nobody says them

**Nothing with `$Contact` in it.** A demo sets only the contact key, so every other contact
field is empty, and a field name that does not exist can fail the whole message rather than
just itself. `$Contact.name` is not a column: `master_contact` has `first_name`.

**The preview pane does not resolve snippets.** It echoes the body, so it will always show
the raw tag. Only a real send resolves. Ignore the pane.

**"Please add variables to your template first. No variables found"** is the Preview and Test
dialog asking for **variables**, which a snippet is not. It is not about your snippet. To get
past it, either add one contact variable from the field's own list, or skip the dialog and
send a real test message, which is the only thing that proves anything anyway.

---

## Step 3. The web push

**Content > Push.** Platform **WEB**.

| Field | What goes in it |
|---|---|
| Title | `Still in your basket` |
| **Message** | the **line** snippet, then ` are waiting for you.` |
| Select Platform | WEB |
| Notification Type | **Rich** |
| Media | **URL**, and the **image** snippet on its own, nothing else in the field |
| **Target URL** | the **url** snippet on its own, nothing else in the field |
| Badge URL | leave empty |
| Icon | Default |
| Action Buttons | No Action Buttons |
| Custom Parameters | leave as they are. The App Inbox reads whatever Dengage holds for the device, so nothing extra is needed to reach it |

That is the whole difference this makes: the push carries the product the visitor actually
left behind, and lands them back on the basket they left it in, on the right demo, with one
push serving all of them.

### What happens when there is nothing to show

Both assets output an empty string rather than a wrong value. So:

| Case | What the recipient gets |
|---|---|
| No product in the basket has a picture | the push, without an image. A standard notification |
| The picture is `http` rather than `https` | the same. A browser blocks a mixed content push image |
| No page view attributes the basket to a demo | an empty Target URL |

An empty Target URL is deliberate. There is no address that is correct for every demo, and a
push that lands on another prospect's storefront is worse on a call than a push nobody sent.

**Media, Icon and Badge URL do not render in Safari on macOS**, per the note in the editor.
Check the push on Chrome.

### The image is optimized for the band already, so leave the field alone

The image asset does not hand the push the product tile. It hands it a **1200x600 crop made
for that band**, generated at build time and committed with the demo:

| | |
|---|---|
| **2:1** | the ratio the editor asks for, so no client has to pad or crop it and guess |
| **The photograph's own margin is trimmed first** | a studio product shot is mostly background. Fitting the file fits its whitespace too, which is why the first push showed the battery at about a third of the height it could have had |
| **The background is sampled from the photograph** | a white cutout gets a white band and looks full bleed, rather than a white rectangle on a grey field |
| **40 to 70KB** | well inside the 600KB the editor warns about. Size was never the problem, the ratio was |

And for a demo whose scrape found no product photography at all, the same is true of the
shared motif artwork it falls back to: a 2:1 copy of each of the 48 drawings, rendered from
the vector rather than enlarged, so that demo's push is a clean full bleed drawing rather
than a 400x300 tile in a letterbox.

Nothing to set and nothing to upload. The build writes them, and a picture committed without
a banner fails CI rather than becoming a broken image in somebody's notification.

---

## Step 4. When an asset body changes here, re-paste it

That is the only standing obligation, and it is rare. The asset ids never change, so nothing
else comes back to me.

The one that has changed since it was created is `dps abandoned cart image`: it now asks for
the 2:1 banner rather than the square product tile. If a push still shows the product small in
a white box, that body is the old one.

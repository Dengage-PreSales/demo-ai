# Pasting an inline creative into the panel

**Both forms work. Use whichever template you are on.**

| Template | What to paste |
|---|---|
| A plain HTML one, one editor | the whole `<name>.html` |
| **Custom Inline**, three fields | the three files in `<name>/` |

They are generated from the same three sources, so they never disagree, and
`factory/checks/inline-fields.js` renders both and fails if either goes blank.

## One document

Paste `<name>.html` as it is. It carries its own `.dn-inline-html`,
`.dn-inline-style` and `.dn-inline-script` wrappers, which is what the engine
looks for. This is the form the reference banking creative uses.

## Three fields

The **Custom Inline** template supplies those three wrappers itself, so each field
takes only its own content:

| Panel field | File |
|---|---|
| Html | `<name>/html.html` |
| Style | `<name>/style.css` |
| Script | `<name>/script.js` |

Straight to the clipboard, one field at a time:

```bash
pbcopy < factory/creatives/inline/above-footer/html.html
pbcopy < factory/creatives/inline/above-footer/style.css
pbcopy < factory/creatives/inline/above-footer/script.js
```

No `<style>` or `<script>` tags in the Style and Script fields: the panel adds
them. That is the only difference between the two forms. The Html field keeps its own root element, `#dnil-<name>`, because the CSS
and the script both address it by id.

## The Html field is a standing skeleton, not a placeholder

It renders on its own, with generic labels and empty image boxes, and that is
deliberate. The panel preview has no `window.Catalog`, because that object exists
only on a demo page, so a creative that builds everything from script shows a
blank preview and a blank slot the moment the script cannot run. Neither state
reports an error.

So each Html field carries the full layout with neutral copy. On a demo the script
replaces it with the real catalogue; anywhere else the skeleton stands. It names
no brand, product, price or vertical, so it stays shareable across every demo.

**The skeleton must use the same class names the CSS styles.** Invent one and every
rule misses: the layout collapses to unformatted text with a plain link where the
button should be. `factory/checks/inline-fields.js` asserts every class in the Html
field is styled by that creative's own CSS, reassembles all five the way the panel
does, and checks both the live render and the preview.

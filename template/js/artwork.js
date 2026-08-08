/* ============================================================================
   PRODUCT ARTWORK, GENERATED IN THE PAGE FROM THE PRODUCT'S OWN VERTICAL.

   Handoff 7.4. One module, one job: given a product, return an inline SVG that
   looks like the thing it is selling.

   WHY GENERATED RATHER THAN SCRAPED. A demo is themed to a prospect and carries
   their real product names, so a jacket called "Quilted Field Jacket" should not
   render as a grey tile with the letters QF on it. But the alternative is not
   automatically their photography either:

     scraped photos     highest fidelity, and a runtime dependency on the
                        prospect's CDN, which they can change between the build
                        and the call. Committing them fixes that and is Phase 2
     stock photos       wrong products, wrong palette, and a licence question
     generated artwork  always the right vertical, always the prospect's palette,
                        zero requests, and honest about what it is

   Salil's call, 5 August 2026: generated. This is that.

   THE RULES IT HAS TO KEEP.

   1. NOTHING IS FABRICATED THAT COULD BE MISTAKEN FOR DATA. A motif is a
      drawing, not a claim. It never shows a price, a rating, a discount badge or
      a stock figure, because those are numbers and CLAUDE.md 3.5 forbids
      inventing one to fill a column.
   2. NO REQUESTS. Inline SVG only. No third party host can be slow or blocked
      mid call, which is the whole reason product images are committed rather
      than hotlinked.
   3. THE PROSPECT'S PALETTE, NOT OURS. Every stroke and fill is currentColor at
      low opacity, so a motif inherits whatever the theme sets and no colour
      literal appears here at all. The guard's template-purity check enforces
      that, and it should. Which token it lands on is decided in one place, the
      .art rule in style.css, and that rule chooses ink over the accent colour:
      a grid of accent coloured silhouettes reads as icons rather than as
      products. Change the colour of every product tile there, not here.
   4. STABLE PER PRODUCT. The same product draws the same picture on every
      reload, in every rail, on both pages. Variation is seeded from the product
      id, never from Math.random, or a product would change appearance while a
      prospect is looking at it.
   5. IT DEGRADES TO THE OLD BEHAVIOUR. An unclassifiable product falls back to
      the initials tile rather than to nothing, so a catalogue from an unexpected
      vertical is plain instead of broken.

   THE CLASSIFIER IS DELIBERATELY DUMB. Keyword matching over the product's name,
   category and category path. No model, no network, no configuration. It is
   wrong sometimes and that is acceptable: the failure mode is a knitwear item
   drawn as a shirt, which nobody on a call will notice, and the fallback catches
   anything it cannot place at all. A cleverer classifier would be a dependency
   and a latency for no visible gain.

   THE HEAD NOUN WINS, NOT THE LIST ORDER. English puts the head noun last in a
   compound, so the match furthest through the product NAME is the one that
   decides: "Table Lamp" is a lamp, "Camera Bag" is a bag, "Field Jacket" is a
   jacket. That means a motif can be added anywhere in the list below without
   anyone having to reason about where it belongs relative to the others.

   List order still decides the second pass, over category and attributes, because
   those have no dependable word order. There, specific sits above general.
   ========================================================================== */
(function (window) {
    'use strict';

    /* Every path is drawn inside this box, so a motif can be swapped without
       touching the frame around it. */
    var W = 400, H = 300;

    /* The SVG shapes that take a fill. The style block below themes all of them,
       and factory/checks/artwork.js refuses a motif that draws with anything not
       on this list, so neither half can quietly fall out of step with the other. */
    var FILLABLE = ['path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline'];

    /* ------------------------------------------------------------------ */
    /* The motifs                                                          */

    /* Each entry: an id, the words that select it, and the geometry. Geometry is
       a string of SVG elements, drawn in a 400 by 300 box, centred near
       (200, 150) and kept inside roughly x 120 to 280, y 70 to 230 so nothing
       collides with the frame or the corner radius of the card. */
    var MOTIFS = [
        /* ---- apparel ---- */
        { id: 'jacket', words: ['jacket', 'coat', 'parka', 'blazer', 'anorak', 'gilet', 'outerwear'],
          art: '<path d="M168 92l22-14q10 12 20 0l22 14 22 22-16 12-4 96h-68l-4-96-16-12z"/>' +
               '<path d="M190 78l10 30 10-30" class="ln"/>' +
               '<path d="M200 108v114" class="ln"/>' },

        { id: 'knit', words: ['knit', 'sweater', 'jumper', 'cardigan', 'hoodie', 'sweatshirt', 'pullover', 'fleece'],
          art: '<path d="M170 94h60l24 20-14 14-6-8v102h-68V120l-6 8-14-14z"/>' +
               '<path d="M176 214h48" class="ln"/><path d="M176 204h48" class="ln"/>' +
               '<path d="M182 94q18 14 36 0" class="ln"/>' },

        { id: 'shirt', words: ['shirt', 'blouse', 'tee', 't-shirt', 'polo', 'top', 'vest', 'tunic'],
          art: '<path d="M172 92l20-12q8 12 16 0l20 12 24 20-14 14-6-6v96h-64v-96l-6 6-14-14z"/>' +
               '<path d="M192 80l8 18 8-18" class="ln"/>' },

        { id: 'trousers', words: ['trouser', 'pant', 'jean', 'chino', 'short', 'legging', 'jogger'],
          art: '<path d="M172 82h56v26l-6 114h-20l-2-92-2 92h-20l-6-114z"/>' +
               '<path d="M172 100h56" class="ln"/>' },

        { id: 'dress', words: ['dress', 'gown', 'skirt', 'frock'],
          art: '<path d="M180 84h40l6 34 26 104h-104l26-104z"/>' +
               '<path d="M180 118h40" class="ln"/>' },

        /* ---- footwear: boot before shoe, or every boot draws as a sneaker ---- */
        { id: 'boot', words: ['boot', 'chelsea', 'chukka'],
          art: '<path d="M160 96h44v70l52 18q10 4 10 14v14H160z"/>' +
               '<path d="M160 190h106" class="ln"/><path d="M204 130h-44" class="ln"/>' },

        { id: 'shoe', words: ['shoe', 'sneaker', 'trainer', 'loafer', 'sandal', 'heel', 'pump', 'brogue', 'footwear'],
          art: '<path d="M128 196v-24q0-12 14-14l40-6 22-24q8-8 16 0l12 22q28 10 38 22 8 10 8 24z"/>' +
               '<path d="M128 196h150v14H128z"/>' +
               '<path d="M180 152l14 16" class="ln"/><path d="M198 158l14 16" class="ln"/>' },

        /* ---- accessories ---- */
        { id: 'bag', words: ['bag', 'tote', 'backpack', 'purse', 'wallet', 'weekender', 'holdall', 'luggage', 'satchel'],
          art: '<path d="M146 122h108l10 104H136z"/>' +
               '<path d="M174 122v-14q0-26 26-26t26 26v14" class="ln"/>' },

        { id: 'smartwatch', words: ['smartwatch', 'fitness watch', 'fitness tracker', 'wearable', 'tracker'],
          art: '<rect x="168" y="112" width="64" height="76" rx="16"/>' +
               '<path d="M182 112V84h36v28" class="ln"/><path d="M182 188v28h36v-28" class="ln"/>' +
               '<path d="M182 138h36" class="ln"/><path d="M182 158h24" class="ln"/>' },

        { id: 'watch', words: ['watch', 'timepiece', 'chronograph'],
          art: '<circle cx="200" cy="150" r="42"/>' +
               '<path d="M182 108V82h36v26" class="ln"/><path d="M182 192v26h36v-26" class="ln"/>' +
               '<path d="M200 128v22h18" class="ln2"/>' },

        { id: 'glasses', words: ['sunglass', 'glasses', 'eyewear', 'frame', 'spectacle'],
          art: '<rect x="132" y="128" width="56" height="44" rx="14"/>' +
               '<rect x="212" y="128" width="56" height="44" rx="14"/>' +
               '<path d="M188 148h24" class="ln"/><path d="M132 142l-16-10" class="ln"/>' +
               '<path d="M268 142l16-10" class="ln"/>' },

        { id: 'hat', words: ['hat', 'cap', 'beanie', 'fedora', 'bucket'],
          art: '<path d="M156 168q0-52 44-52t44 52z"/>' +
               '<path d="M126 168h148q6 0 6 8t-6 8H126q-6 0-6-8t6-8z"/>' },

        { id: 'scarf', words: ['scarf', 'throw', 'blanket', 'shawl', 'wrap'],
          art: '<path d="M158 92h32l-4 100h-28z"/><path d="M210 92h32l-4 100h-28z"/>' +
               '<path d="M158 92q42-26 84 0" class="ln3"/>' +
               '<path d="M158 192v16M168 192v16M178 192v16M188 192v16" class="ln"/>' +
               '<path d="M212 192v16M222 192v16M232 192v16M242 192v16" class="ln"/>' },

        { id: 'rug', words: ['rug', 'mat', 'carpet', 'runner'],
          art: '<rect x="128" y="102" width="144" height="96" rx="4"/>' +
               '<rect x="146" y="120" width="108" height="60" rx="2" class="ln"/>' +
               '<path d="M128 198v14M164 198v14M200 198v14M236 198v14M272 198v14" class="ln"/>' },

        /* ---- electronics ---- */
        { id: 'laptop', words: ['laptop', 'macbook', 'ultrabook', 'chromebook', 'notebook computer'],
          art: '<path d="M158 100h84q8 0 8 8v66h-100v-66q0-8 8-8z"/>' +
               '<path d="M130 182h140l14 22H116z"/>' +
               '<path d="M170 112h60v50h-60z" class="ln"/>' },

        { id: 'tablet', words: ['tablet', 'ipad', 'e-reader', 'ereader'],
          art: '<rect x="152" y="82" width="96" height="136" rx="10"/>' +
               '<rect x="164" y="96" width="72" height="100" rx="2" class="ln"/>' +
               '<circle cx="200" cy="206" r="5" class="ln"/>' },

        { id: 'phone', words: ['phone', 'mobile', 'smartphone', 'handset'],
          art: '<rect x="164" y="76" width="72" height="148" rx="12"/>' +
               '<rect x="174" y="92" width="52" height="112" rx="2" class="ln"/>' +
               '<path d="M190 84h20" class="ln"/>' },

        { id: 'headphones', words: ['headphone', 'earbud', 'earphone', 'headset', 'over ear', 'on ear'],
          art: '<path d="M144 168v-18a56 56 0 01112 0v18" class="ln3"/>' +
               '<rect x="126" y="152" width="36" height="60" rx="14"/>' +
               '<rect x="238" y="152" width="36" height="60" rx="14"/>' },

        { id: 'speaker', words: ['speaker', 'soundbar', 'subwoofer', 'boombox'],
          art: '<rect x="158" y="80" width="84" height="140" rx="14"/>' +
               '<circle cx="200" cy="126" r="22" class="ln"/><circle cx="200" cy="126" r="8" class="ln"/>' +
               '<circle cx="200" cy="184" r="14" class="ln"/>' },

        { id: 'camera', words: ['camera', 'mirrorless', 'dslr', 'lens', 'camcorder'],
          art: '<path d="M136 116h28l10-14h52l10 14h28q10 0 10 10v78q0 10-10 10H136q-10 0-10-10v-78q0-10 10-10z"/>' +
               '<circle cx="200" cy="165" r="34" class="ln"/><circle cx="200" cy="165" r="16" class="ln"/>' },

        { id: 'tv', words: ['tv', 'television', 'monitor', 'display', 'screen'],
          art: '<rect x="120" y="86" width="160" height="104" rx="8"/>' +
               '<rect x="134" y="100" width="132" height="76" rx="2" class="ln"/>' +
               '<path d="M200 190v22" class="ln"/><path d="M166 214h68" class="ln3"/>' },

        { id: 'console', words: ['console', 'gamepad', 'controller', 'joystick'],
          art: '<path d="M148 122h104q26 0 26 34t-18 34h-16l-14-18h-60l-14 18h-16q-18 0-18-34t26-34z"/>' +
               '<circle cx="174" cy="152" r="9" class="ln"/><circle cx="226" cy="152" r="9" class="ln"/>' },

        /* ---- home ---- */
        { id: 'chair', words: ['chair', 'stool', 'seat', 'bench'],
          art: '<path d="M158 84h12v92h-12z"/><path d="M230 84h12v92h-12z"/>' +
               '<path d="M150 100h100v12h-100z" class="ln"/><path d="M150 128h100v12h-100z" class="ln"/>' +
               '<path d="M140 168h120v14H140z"/>' +
               '<path d="M150 182v42M250 182v42" class="ln3"/>' },

        { id: 'sofa', words: ['sofa', 'couch', 'settee', 'loveseat'],
          art: '<path d="M132 132q0-14 14-14h108q14 0 14 14v30H132z"/>' +
               '<path d="M120 158h160q10 0 10 12v34H110v-34q0-12 10-12z"/>' +
               '<path d="M126 204v18M274 204v18" class="ln3"/>' },

        { id: 'table', words: ['table', 'desk', 'dining', 'console table', 'sideboard'],
          art: '<path d="M116 122h168v16H116z"/>' +
               '<path d="M136 138v82M264 138v82" class="ln3"/>' +
               '<path d="M136 176h128" class="ln"/>' },

        { id: 'lamp', words: ['lamp', 'lighting', 'lantern', 'pendant', 'sconce'],
          art: '<path d="M164 76h72l20 62H144z"/>' +
               '<path d="M200 138v66" class="ln3"/>' +
               '<path d="M164 204h72q6 0 6 8t-6 8h-72q-6 0-6-8t6-8z"/>' },

        { id: 'cookware', words: ['casserole', 'pan', 'pot', 'skillet', 'saucepan', 'cast iron', 'dutch oven', 'cookware'],
          art: '<path d="M142 128h116v46q0 32-32 32h-52q-32 0-32-32z"/>' +
               '<path d="M132 128h136" class="ln3"/>' +
               '<path d="M186 116h28v12h-28z"/><path d="M194 104h12v12h-12z" class="ln"/>' },

        { id: 'mug', words: ['mug', 'cup', 'tumbler', 'glassware', 'flask'],
          art: '<path d="M150 108h84v70q0 26-26 26h-32q-26 0-26-26z"/>' +
               '<path d="M234 128h18q14 0 14 16v10q0 16-14 16h-18" class="ln3"/>' },

        { id: 'plate', words: ['plate', 'bowl', 'dish', 'platter', 'dinnerware'],
          art: '<circle cx="200" cy="150" r="66"/>' +
               '<circle cx="200" cy="150" r="42" class="ln"/>' },

        /* ---- beauty and grocery ---- */
        { id: 'bottle', words: ['serum', 'perfume', 'fragrance', 'eau de', 'oil', 'bottle', 'shampoo', 'conditioner'],
          art: '<path d="M186 74h28v22l14 20v96q0 12-12 12h-32q-12 0-12-12v-96l14-20z"/>' +
               '<path d="M180 140h40" class="ln"/><path d="M180 158h40" class="ln"/>' },

        { id: 'jar', words: ['cream', 'balm', 'jar', 'mask', 'pomade', 'butter'],
          art: '<path d="M158 116h84v72q0 14-14 14h-56q-14 0-14-14z"/>' +
               '<path d="M150 96h100v20H150z"/>' },

        { id: 'tube', words: ['lotion', 'gel', 'cleanser', 'toothpaste', 'tube', 'sunscreen', 'moisturiser', 'moisturizer'],
          art: '<path d="M172 108h56v88q0 12-12 12h-32q-12 0-12-12z"/>' +
               '<path d="M172 108l10-18h36l10 18" class="ln3"/>' +
               '<rect x="190" y="74" width="20" height="18" rx="3"/>' },

        /* ---- sport, leisure, media ---- */
        { id: 'ball', words: ['ball', 'football', 'basketball', 'volleyball', 'tennis'],
          art: '<circle cx="200" cy="150" r="64"/>' +
               '<path d="M144 120q56 22 112 0M144 180q56-22 112 0" class="ln"/>' +
               '<path d="M200 86v128" class="ln"/>' },

        { id: 'dumbbell', words: ['dumbbell', 'kettlebell', 'weight plate', 'barbell'],
          art: '<rect x="150" y="122" width="24" height="56" rx="6"/>' +
               '<rect x="226" y="122" width="24" height="56" rx="6"/>' +
               '<rect x="130" y="134" width="16" height="32" rx="5"/>' +
               '<rect x="254" y="134" width="16" height="32" rx="5"/>' +
               '<path d="M174 142h52v16h-52z"/>' },

        { id: 'bike', words: ['bike', 'bicycle', 'cycle', 'scooter'],
          art: '<circle cx="150" cy="182" r="34" class="ln3"/><circle cx="250" cy="182" r="34" class="ln3"/>' +
               '<path d="M150 182l34-58h40l26 58M184 124h52" class="ln3"/>' },

        { id: 'book', words: ['book', 'novel', 'guide', 'journal', 'notebook', 'diary', 'cookbook'],
          art: '<path d="M132 92h60q8 0 8 8v112h-68z"/>' +
               '<path d="M268 92h-60q-8 0-8 8v112h68z"/>' +
               '<path d="M200 100v112" class="ln"/>' +
               '<path d="M146 122h38M146 142h38M216 122h38M216 142h38" class="ln"/>' },

        { id: 'toy', words: ['toy', 'plush', 'teddy', 'blocks', 'puzzle', 'figurine'],
          art: '<circle cx="200" cy="120" r="34"/>' +
               '<circle cx="166" cy="94" r="14"/><circle cx="234" cy="94" r="14"/>' +
               '<path d="M164 160h72q10 0 10 12v34q0 12-12 12h-68q-12 0-12-12v-34q0-12 10-12z"/>' },

        { id: 'tool', words: ['tool', 'wrench', 'drill', 'screwdriver', 'hammer', 'spanner'],
          art: '<path d="M148 96a26 26 0 0136 24l72 72-18 18-72-72a26 26 0 01-18-42z"/>' +
               '<circle cx="164" cy="112" r="9" class="ln"/>' },

        /* ---- automotive, added 5 August 2026 ----------------------------
           A tyre and parts retailer previously drew its whole catalogue as
           initials tiles, because the vertical had no motifs at all. The floor
           worked, and a grid of thirty initials is still not a storefront.

           THREE KEYWORDS HERE COLLIDE WITH MOTIFS ABOVE, and the collisions are
           resolved with compounds rather than by reordering the list, because
           reordering would fix automotive by breaking a more common vertical:

             oil    'oil' stays with the bottle, so a beauty prospect's face oil
                    is still a bottle. The automotive words are the compounds a
                    parts catalogue actually uses: engine oil, motor oil, gear
                    oil, brake fluid, coolant. "Engine Oil" matches both 'oil'
                    and 'engine oil' ending at the same character, and the longer
                    keyword wins the tie, so it lands here.
             cap    'cap' stays with the hat. 'hub cap' and 'hubcap' come here for
                    the same reason.
             disc   no motif above claims it, so 'disc' and 'rotor' are safe.

           'car', 'tire' and 'rim' are bare words and safe only because matching
           is whole word: 'car' would otherwise sit inside carpet and cardigan,
           'tire' inside entire, 'rim' inside trim and primer. That is the trap
           section 7.3 of the handoff describes, and it is why these are listed
           rather than left to a substring search. */

        /* 'all season' and 'all-season' earn their place because a tyre retailer
           names a whole line that way and nothing in those names says tyre:
           "AllSeasonContact 2" in a category called "All Season" drew initials,
           which was a fifth of one real catalogue.

           Both spellings are listed because keyword matching is literal about the
           separator, so the space form does not match the hyphen form. Clothing is
           safe from it by head noun: "All Season Jacket" matches 'all season'
           early and 'jacket' last, and the match furthest through the name wins.
           Asserted in both directions. */
        { id: 'tyre', words: ['tyre', 'tire', 'all season', 'all-season'],
          /* A donut, drawn as one path with two subpaths and evenodd, because an
             unclassed circle is filled rather than stroked by the style above and
             a filled circle is a ball. */
          art: '<path fill-rule="evenodd" d="M200 150m-76 0a76 76 0 1 0 152 0a76 76 0 1 0-152 0' +
               'M200 150m-44 0a44 44 0 1 0 88 0a44 44 0 1 0-88 0z"/>' +
               '<path d="M200 66v18M200 216v18M116 150h18M266 150h18' +
               'M141 91l13 13M246 196l13 13M259 91l-13 13M154 196l-13 13" class="ln2"/>' +
               '<circle cx="200" cy="150" r="30" class="ln"/>' },

        { id: 'wheel', words: ['rim', 'wheel', 'alloy', 'hubcap', 'hub cap', 'wheel trim'],
          art: '<path fill-rule="evenodd" d="M200 150m-72 0a72 72 0 1 0 144 0a72 72 0 1 0-144 0' +
               'M200 150m-58 0a58 58 0 1 0 116 0a58 58 0 1 0-116 0z"/>' +
               '<circle cx="200" cy="150" r="14"/>' +
               '<path d="M200 136V96M200 164v40M186 143l-38-22M214 157l38 22M214 143l38-22' +
               'M186 157l-38 22" class="ln2"/>' },

        { id: 'brake', words: ['brake', 'brake disc', 'brake pad', 'disc', 'rotor', 'caliper'],
          art: '<path fill-rule="evenodd" d="M200 150m-70 0a70 70 0 1 0 140 0a70 70 0 1 0-140 0' +
               'M200 150m-24 0a24 24 0 1 0 48 0a24 24 0 1 0-48 0z"/>' +
               '<path d="M256 108h16q10 0 10 10v64q0 10-10 10h-16z" class="ln2"/>' +
               '<circle cx="200" cy="104" r="6" class="ln"/><circle cx="236" cy="128" r="6" class="ln"/>' +
               '<circle cx="236" cy="172" r="6" class="ln"/><circle cx="200" cy="196" r="6" class="ln"/>' +
               '<circle cx="164" cy="172" r="6" class="ln"/><circle cx="164" cy="128" r="6" class="ln"/>' },

        { id: 'battery', words: ['battery', 'accumulator', 'jump starter'],
          art: '<rect x="134" y="104" width="132" height="96" rx="8"/>' +
               '<rect x="152" y="88" width="26" height="16" rx="4"/>' +
               '<rect x="222" y="88" width="26" height="16" rx="4"/>' +
               '<path d="M156 140h24M168 128v24" class="ln2"/>' +
               '<path d="M220 140h24" class="ln2"/>' +
               '<path d="M134 172h132" class="ln"/>' },

        /* 'fluid' is here as a bare word as well as in its compounds, because the
           check refuses a motif that nothing can select by its own id, and it is
           right to: that motif would be dead code. It also picks up the fluids a
           parts catalogue names without a qualifier, "Power Steering Fluid" and
           "Hydraulic Fluid". No motif above claims the word. */
        { id: 'fluid', words: ['fluid', 'engine oil', 'motor oil', 'gear oil',
                               'transmission fluid', 'brake fluid', 'coolant', 'antifreeze',
                               'lubricant', 'grease', 'screenwash', 'adblue', 'ad blue',
                               'additive'],
          art: '<path d="M162 110h76q10 0 10 10v90q0 10-10 10h-76q-10 0-10-10v-90q0-10 10-10z"/>' +
               '<path d="M186 110V92h28v18" class="ln2"/>' +
               '<rect x="182" y="78" width="36" height="16" rx="4"/>' +
               '<path d="M248 130h14q8 0 8 8v26q0 8-8 8h-14" class="ln2"/>' +
               '<path d="M162 146h76M162 166h76" class="ln"/>' },

        { id: 'filter', words: ['filter', 'oil filter', 'air filter', 'cabin filter', 'fuel filter'],
          art: '<path d="M158 96h84q8 0 8 8v92q0 8-8 8h-84q-8 0-8-8v-92q0-8 8-8z"/>' +
               '<path d="M170 96v108M186 96v108M202 96v108M218 96v108M234 96v108" class="ln2"/>' +
               '<ellipse cx="200" cy="96" rx="50" ry="12"/>' +
               '<path d="M150 204h100" class="ln"/>' },

        { id: 'sparkplug', words: ['spark plug', 'sparkplug', 'glow plug', 'ignition coil', 'plug'],
          art: '<path d="M188 74h24v34h-24z"/>' +
               '<path d="M180 108h40l-6 26h-28z"/>' +
               '<path d="M184 134h32v20h-32z"/>' +
               '<path d="M190 154h20v42h-20z"/>' +
               '<path d="M196 196h8v30h-8z"/>' +
               '<path d="M184 140h32M184 148h32M190 162h20M190 172h20M190 182h20" class="ln"/>' },

        { id: 'wiper', words: ['wiper', 'wiper blade', 'windscreen', 'windshield'],
          art: '<path d="M132 206l124-88 10 14-124 88z"/>' +
               '<path d="M256 118l14-10 10 14-14 10z"/>' +
               '<path d="M140 196l112-80" class="ln"/>' +
               '<path d="M124 214h44" class="ln2"/>' },

        { id: 'headlight', words: ['headlight', 'headlamp', 'taillight', 'fog light', 'bulb',
                                   'indicator', 'light bulb'],
          art: '<path d="M146 106h58q40 0 40 44t-40 44h-58q-10 0-10-10v-68q0-10 10-10z"/>' +
               '<circle cx="188" cy="150" r="26" class="ln2"/>' +
               '<path d="M258 122l26-14M258 150h30M258 178l26 14" class="ln2"/>' },

        { id: 'car', words: ['car', 'vehicle', 'sedan', 'hatchback', 'suv', 'estate car', 'van'],
          art: '<path d="M128 178q0-16 12-20l16-32q6-12 20-12h48q14 0 20 12l16 32q12 4 12 20v14h-144z"/>' +
               '<path d="M164 122h72l12 24h-96z" class="ln"/>' +
               '<circle cx="162" cy="196" r="18"/><circle cx="238" cy="196" r="18"/>' +
               '<circle cx="162" cy="196" r="7" class="ln"/><circle cx="238" cy="196" r="7" class="ln"/>' }
    ];

    /* ------------------------------------------------------------------ */
    /* Classification                                                      */

    /* A stable 32 bit hash. Same product id, same picture, every time. Not
       Math.random: a product that changed appearance between two rails on one
       page would look like a rendering bug to a prospect. */
    function hash(text) {
        var h = 2166136261, i;
        text = String(text || '');
        for (i = 0; i < text.length; i++) {
            h ^= text.charCodeAt(i);
            h = (h * 16777619) >>> 0;
        }
        return h;
    }

    function norm(text) {
        return ' ' + String(text || '').toLowerCase().replace(/[^a-z0-9-]+/g, ' ') + ' ';
    }

    /* WHOLE WORDS ONLY, and this is not a refinement. Plain substring matching
       produced five wrong motifs in one fifteen product catalogue, every one of
       them a short keyword hiding inside a longer word:

         'top' inside "laptop"        a laptop drawn as a shirt
         'phone' inside "headphones"  headphones drawn as a phone
         'mat' inside "Material"      a dining chair drawn as a rug
         'cap' inside "Capacity"      a casserole drawn as a hat

       The last two came from attribute names, which is worth noting: the words a
       catalogue uses for its own column headings collide with product nouns far
       more often than the product names do.

       Compiled once, because classify runs for every product in every rail. */
    var PATTERNS = MOTIFS.map(function (m) {
        return {
            motif: m,
            res: m.words.map(function (w) {
                /* (?:e?s)? IS NOT COSMETIC. Without it a catalogue selling
                   "Trousers", "Boots", "Headphones" or "Watches" matched nothing
                   and fell straight to the initials tile, because whole word
                   matching correctly refuses to see 'trouser' inside 'trousers'.
                   Plural product names are the norm, not the exception, so the
                   fix belongs in the pattern rather than in every keyword. */
                return new RegExp('(^|[^a-z0-9])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
                                  '(?:e?s)?($|[^a-z0-9])', 'g');
            })
        };
    });

    /* Everything except the name, for the second pass. Attribute VALUES are the
       useful part, because a catalogue often carries the noun there ("Type: ankle
       boot") while the name is a brand phrase. Keys are included too, since
       "Sleeve length" says apparel, and whole word matching is what makes that
       safe rather than the trap above. */
    function context(product) {
        var parts = [product.category, product.categoryPath];
        var attrs = product.attributes || {};
        Object.keys(attrs).forEach(function (k) { parts.push(k); parts.push(attrs[k]); });
        return norm(parts.join(' '));
    }

    /* The last match in the product name wins, because English puts the head noun
       last in a compound. "Table Lamp" is a lamp, not a table. "Camera Bag" is a
       bag. "Field Jacket" is a jacket. Position beats list order, which also means
       the motif list can be extended without anyone having to reason about where
       in it a new entry belongs.

       Only the NAME is scored this way. Category and attributes have no reliable
       word order, so those fall back to list order, specific above general. */
    /* The furthest match in the text, as {end, len}. END rather than start, and
       then the LONGER keyword on a tie, and both halves of that are load bearing:

         "Ceramic Table Lamp"  needs end, or 'table' wins on list order
         "Fitness Watch"       needs the length tie break, because 'fitness watch'
                               and 'watch' end at the same place and the shorter
                               one starts later. Scoring starts picks the watch
                               motif over the smartwatch motif every time

       The pattern captures a boundary character on each side, so the word's own
       span is the match minus those two groups. */
    function furthest(res, text) {
        var i, m, start, end, len, best = null;
        for (i = 0; i < res.length; i++) {
            res[i].lastIndex = 0;
            while ((m = res[i].exec(text)) !== null) {
                start = m.index + m[1].length;
                len = m[0].length - m[1].length - m[2].length;
                end = start + len;
                if (!best || end > best.end || (end === best.end && len > best.len)) {
                    best = { end: end, len: len };
                }
                /* The trailing boundary is shared with the next word, so step back
                   one to avoid skipping an adjacent match. */
                if (res[i].lastIndex > m.index) res[i].lastIndex = m.index + 1;
            }
        }
        return best;
    }

    function classify(product) {
        var name = norm(product.name), i, m;
        var best = null, bestAt = null;

        for (i = 0; i < PATTERNS.length; i++) {
            m = furthest(PATTERNS[i].res, name);
            if (!m) continue;
            if (!bestAt || m.end > bestAt.end || (m.end === bestAt.end && m.len > bestAt.len)) {
                bestAt = m;
                best = PATTERNS[i].motif;
            }
        }
        if (best) return best;

        var rest = context(product);
        for (i = 0; i < PATTERNS.length; i++) {
            if (furthest(PATTERNS[i].res, rest)) return PATTERNS[i].motif;
        }
        return null;
    }

    /* ------------------------------------------------------------------ */
    /* Drawing                                                             */

    function escapeText(text) {
        return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function escapeAttr(text) {
        return escapeText(text).replace(/"/g, '&quot;');
    }

    /* The initials tile, kept verbatim from js/catalog.js so that an unexpected
       vertical degrades to exactly what shipped before rather than to a blank
       frame. This is the floor, not the target. */
    function initials(product, seed, gid) {
        var letters = (product.name || '?').split(/\s+/).slice(0, 2)
            .map(function (w) { return w.charAt(0); }).join('').toUpperCase();
        return '<text x="200" y="150" text-anchor="middle" dominant-baseline="central" ' +
            'font-family="system-ui, sans-serif" font-size="64" font-weight="700" ' +
            'fill="currentColor" fill-opacity=".28">' + escapeText(letters) + '</text>';
    }

    /* One SVG per product. currentColor throughout, so the motif is themed by
       whatever :root sets and this file names no colour. */
    function svg(product) {
        var seed = hash(product.id);
        var gid = 'a' + seed.toString(36);
        var motif = classify(product);
        /* A small seeded tilt on the background only. The motif itself is never
           rotated: a tilted chair reads as a mistake rather than as variety. */
        var rotate = seed % 60 - 30;

        var body = motif
            ? '<g class="mf">' + motif.art + '</g>'
            : initials(product, seed, gid);

        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" ' +
            'role="img" aria-label="' + escapeAttr(product.name) + '" ' +
            'data-motif="' + escapeAttr(motif ? motif.id : 'initials') + '">' +
            '<defs>' +
              '<linearGradient id="' + gid + '" gradientTransform="rotate(' + rotate + ' .5 .5)">' +
                '<stop offset="0" stop-color="currentColor" stop-opacity=".16"/>' +
                '<stop offset="1" stop-color="currentColor" stop-opacity=".05"/>' +
              '</linearGradient>' +
              /* Scoped to this one svg by the generated id, so two products on a
                 page cannot inherit each other's styles. */
              '<style>' +
                /* EVERY FILLABLE SVG SHAPE, not just the three that happened to be
                   in use. A motif drawn with an <ellipse> rendered as a solid
                   black shape, because an element the rule does not name gets the
                   SVG default fill of black at full opacity: the one thing on the
                   page that cannot be themed and the only shape a prospect would
                   actually notice. Adding a shape to a motif must not require
                   remembering to add it here too, so the list is the whole set
                   rather than the set currently used, and
                   factory/checks/artwork.js asserts the two agree. */
                FILLABLE.map(function (tag) {
                    return '#' + gid + '-g .mf ' + tag;
                }).join(',') + '{fill:currentColor;fill-opacity:.26;stroke:none}' +
                '#' + gid + '-g .mf .ln{fill:none;stroke:currentColor;stroke-opacity:.34;stroke-width:4}' +
                '#' + gid + '-g .mf .ln2{fill:none;stroke:currentColor;stroke-opacity:.5;stroke-width:5}' +
                '#' + gid + '-g .mf .ln3{fill:none;stroke:currentColor;stroke-opacity:.3;stroke-width:7;' +
                  'stroke-linecap:round}' +
              '</style>' +
            '</defs>' +
            '<rect width="' + W + '" height="' + H + '" fill="url(#' + gid + ')"/>' +
            '<g id="' + gid + '-g">' + body + '</g>' +
            '</svg>';
    }

    window.Artwork = {
        /* The only entry point js/catalog.js uses. */
        svg: svg,
        /* Exposed so the check can assert the classifier without scraping the
           rendered DOM, and so a motif can be looked up by name in a contact
           sheet. Neither is a runtime path. */
        classify: function (product) {
            var m = classify(product);
            return m ? m.id : null;
        },
        motifs: function () {
            return MOTIFS.map(function (m) { return m.id; });
        },
        /* Also for the check: the geometry and the set of shapes the style themes,
           so it can assert that no motif draws with a shape the style would leave
           as default black. Reading the rendered DOM cannot see this, because a
           black shape is a perfectly valid shape. */
        art: function () {
            return MOTIFS.map(function (m) { return { id: m.id, art: m.art, words: m.words }; });
        },
        fillable: function () { return FILLABLE.slice(); }
    };
})(window);

/* ============================================================================
   THE STAND-IN CATALOGUE. Used only when a store cannot be read at all.

   WHY THIS EXISTS. Tier 3 asks a colleague to attach a CSV, and on 7 August 2026
   that turned out to be the normal path rather than the exception: several stores
   in a row refused every automated reader, and each one meant a request that
   stopped, waited for a person, and came back an hour later. A demo factory that
   needs a spreadsheet before it can start is not automatic.

   So a store that answers nothing now gets a catalogue anyway: about fifty
   products in five categories, chosen for the vertical the store appears to be in,
   which is enough to make a storefront that browses, searches, filters, adds to a
   cart and checks out.

   ------------------------------------------------------------------------------
   READ THIS BEFORE CHANGING ANYTHING HERE.

   CLAUDE.md NON-NEGOTIABLE 5 SAYS NEVER FABRICATE A NUMBER TO FILL A COLUMN, AND
   EVERY PRICE IN THIS FILE IS FABRICATED. That is not an oversight and it is not a
   loophole. It is a deliberate exception, requested on 7 August 2026, and it is
   the only place in this repository where invented figures are allowed.

   The distinction that makes it survivable, and it has to hold:

     non-negotiable 5 forbids inventing a number for a REAL product, where the
     invented figure is indistinguishable from a scraped one and nothing
     downstream can tell. That is still forbidden, everywhere, including here.

     this file invents an ENTIRE catalogue, and says so. No product in it
     corresponds to anything the prospect sells, the demo records that its
     catalogue was generated, and the issue comment says it in its first line.

   So the rule this file must never break is not "no invented numbers". It is that
   nothing may ever present this catalogue as the prospect's own. Three things
   carry that, and all three are load bearing:

     1. demo.config.json records catalogueSource: 'generated'
     2. the report carries tier 'generated', which the issue comment leads with
     3. no product name here names a real brand or a real model

   Point 3 is why every name is a description rather than a product: "All Season
   Touring Tyre 185/65 R15" and not a manufacturer's line name. A generated
   catalogue that reads like a real one is the failure mode, because it invites
   exactly the sentence nobody should say on a call.
   ========================================================================== */

/* Names are DESCRIPTIONS, never brands. A size, a material or a use is fair; a
   manufacturer's line name is not, both because it would be somebody else's
   trademark on invented stock and because it would make a generated catalogue read
   as a scraped one.

   Every vertical is five categories, because five is what the header holds
   (CATEGORY_CAP), with nine or ten products each. That lands near fifty, which is
   comfortably above the thirty a demo ships so that category balancing has real
   choices to make rather than taking everything it is given.

   The price band is per category and the figures inside it are spread evenly, so a
   grid shows a plausible range rather than one number repeated. Bands are in whole
   units of whatever currency the demo ends up in, which is the honest limit of
   what a generated catalogue can be: the SHAPE of a catalogue is transferable
   between stores and the price level is not. */
const VERTICALS = [
    {
        id: 'automotive',
        words: ['tyre', 'tire', 'pneu', 'pneus', 'neumatico', 'llanta', 'reifen', 'auto',
                'motor', 'car', 'garage', 'wheel', 'roda', 'lastik', 'oto', 'vehicle',
                'automotive', 'spares', 'parts', 'workshop'],
        categories: [
            { name: 'Tyres', low: 320, high: 980, items: [
                'All Season Touring Tyre 185/65 R15',
                'All Season Touring Tyre 195/65 R15',
                'Performance Summer Tyre 205/55 R16',
                'Performance Summer Tyre 225/45 R17',
                'Winter Grip Tyre 195/65 R15',
                'Winter Grip Tyre 205/60 R16',
                'SUV All Terrain Tyre 235/60 R18',
                'SUV Highway Tyre 225/65 R17',
                'Compact City Tyre 175/70 R13',
                'Run Flat Touring Tyre 215/55 R17'] },
            { name: 'Wheels', low: 420, high: 1600, items: [
                'Alloy Wheel 15 inch 5 Spoke',
                'Alloy Wheel 16 inch 10 Spoke',
                'Alloy Wheel 17 inch Twin Spoke',
                'Alloy Wheel 18 inch Mesh',
                'Steel Wheel 15 inch',
                'Steel Wheel 16 inch',
                'Wheel Trim Set 15 inch',
                'Locking Wheel Nut Set',
                'Wheel Alignment Spacer Kit'] },
            { name: 'Brakes', low: 90, high: 620, items: [
                'Front Brake Pad Set',
                'Rear Brake Pad Set',
                'Vented Brake Disc Front Pair',
                'Solid Brake Disc Rear Pair',
                'Performance Brake Pad Set',
                'Brake Caliper Repair Kit',
                'Brake Fluid DOT 4 1 Litre',
                'Handbrake Cable',
                'Brake Disc and Pad Bundle Front'] },
            { name: 'Service Parts', low: 25, high: 340, items: [
                'Engine Oil Filter',
                'Cabin Air Filter',
                'Engine Air Filter',
                'Fuel Filter',
                'Spark Plug Set of 4',
                'Iridium Spark Plug Set of 4',
                'Timing Belt Kit',
                'Serpentine Drive Belt',
                'Radiator Coolant 5 Litre',
                'Synthetic Engine Oil 5W30 4 Litre'] },
            { name: 'Electrics', low: 45, high: 890, items: [
                'Car Battery 60Ah',
                'Car Battery 74Ah',
                'Start Stop AGM Battery 70Ah',
                'Halogen Headlight Bulb Pair',
                'LED Headlight Bulb Pair',
                'Rear Wiper Blade',
                'Front Wiper Blade Pair',
                'Alternator Belt Tensioner',
                'Battery Charger 12V'] }
        ]
    },
    {
        id: 'fashion',
        words: ['fashion', 'apparel', 'clothing', 'clothes', 'wear', 'style', 'boutique',
                'moda', 'roupa', 'ropa', 'vetement', 'kleding', 'giyim', 'outfit',
                'denim', 'knit', 'atelier', 'threads', 'garment'],
        categories: [
            { name: 'Outerwear', low: 90, high: 480, items: [
                'Quilted Field Jacket',
                'Waxed Cotton Jacket',
                'Lightweight Packable Anorak',
                'Wool Overcoat',
                'Insulated Gilet',
                'Hooded Rain Jacket',
                'Denim Trucker Jacket',
                'Softshell Windbreaker',
                'Padded Puffer Coat'] },
            { name: 'Knitwear', low: 55, high: 260, items: [
                'Merino Crew Neck Jumper',
                'Lambswool V Neck Jumper',
                'Cable Knit Cardigan',
                'Ribbed Roll Neck Jumper',
                'Cotton Cashmere Sweater',
                'Chunky Knit Cardigan',
                'Fine Gauge Knit Polo',
                'Fleece Lined Sweatshirt',
                'Zip Through Hoodie'] },
            { name: 'Shirts and Tops', low: 25, high: 140, items: [
                'Oxford Button Down Shirt',
                'Linen Short Sleeve Shirt',
                'Brushed Flannel Shirt',
                'Poplin Dress Shirt',
                'Heavyweight Cotton T Shirt',
                'Pima Cotton Long Sleeve Tee',
                'Pique Polo Shirt',
                'Striped Jersey Top',
                'Silk Blend Blouse',
                'Relaxed Fit Linen Tunic'] },
            { name: 'Trousers', low: 45, high: 220, items: [
                'Slim Fit Stretch Jean',
                'Straight Leg Rigid Jean',
                'Tapered Cotton Chino',
                'Wide Leg Linen Trouser',
                'Pleated Wool Trouser',
                'Drawstring Jogger',
                'Cargo Trouser',
                'Tailored Cropped Trouser',
                'Cotton Twill Short'] },
            { name: 'Footwear', low: 70, high: 390, items: [
                'Leather Chelsea Boot',
                'Suede Chukka Boot',
                'Canvas Court Sneaker',
                'Leather Runner Sneaker',
                'Penny Loafer',
                'Leather Derby Shoe',
                'Suede Desert Boot',
                'Slip On Espadrille',
                'Leather Sandal'] }
        ]
    },
    {
        id: 'electronics',
        words: ['electronic', 'electronics', 'tech', 'digital', 'computer', 'pc', 'mobile',
                'phone', 'gadget', 'audio', 'photo', 'camera', 'eletronico', 'elektronik',
                'informatica', 'teknoloji', 'device', 'laptop'],
        categories: [
            { name: 'Laptops', low: 480, high: 2400, items: [
                'Ultrabook 13 inch 8GB 256GB',
                'Ultrabook 13 inch 16GB 512GB',
                'Ultrabook 14 inch 16GB 1TB',
                'Creator Laptop 15 inch 32GB 1TB',
                'Gaming Laptop 15 inch 16GB 1TB',
                'Gaming Laptop 17 inch 32GB 2TB',
                'Business Laptop 14 inch 16GB 512GB',
                'Budget Laptop 15 inch 8GB 256GB',
                'Convertible Laptop 14 inch Touch'] },
            { name: 'Phones and Tablets', low: 180, high: 1400, items: [
                'Smartphone 6.1 inch 128GB',
                'Smartphone 6.1 inch 256GB',
                'Smartphone 6.7 inch 256GB',
                'Smartphone 6.7 inch 512GB',
                'Compact Smartphone 5.8 inch 128GB',
                'Tablet 10 inch 64GB Wi-Fi',
                'Tablet 11 inch 128GB Wi-Fi',
                'Tablet 12.9 inch 256GB Cellular',
                'Tablet Keyboard Folio'] },
            { name: 'Audio', low: 35, high: 640, items: [
                'Over Ear Noise Cancelling Headphones',
                'On Ear Wireless Headphones',
                'True Wireless Earbuds',
                'Sport Wireless Earbuds',
                'Studio Monitor Headphones',
                'Portable Bluetooth Speaker',
                'Waterproof Outdoor Speaker',
                'Bookshelf Speaker Pair',
                'Soundbar with Subwoofer',
                'USB Desktop Microphone'] },
            { name: 'Cameras', low: 120, high: 2600, items: [
                'Mirrorless Camera Body 24MP',
                'Mirrorless Camera 24MP with Kit Lens',
                'Full Frame Mirrorless Body 33MP',
                'Compact Travel Camera 20MP',
                'Action Camera 4K',
                'Standard Zoom Lens 24-70mm',
                'Prime Lens 50mm',
                'Telephoto Zoom Lens 70-200mm',
                'Carbon Tripod with Ball Head'] },
            { name: 'Home Screens', low: 260, high: 3200, items: [
                'Smart TV 43 inch 4K',
                'Smart TV 50 inch 4K',
                'Smart TV 55 inch 4K',
                'Smart TV 65 inch 4K',
                'Smart TV 75 inch 4K',
                'Gaming Monitor 27 inch 165Hz',
                'Ultrawide Monitor 34 inch',
                'Games Console 1TB',
                'Streaming Media Player 4K'] }
        ]
    },
    {
        id: 'home',
        words: ['home', 'house', 'living', 'interior', 'furniture', 'decor', 'kitchen',
                'casa', 'lar', 'maison', 'wohnen', 'mobilya', 'ev', 'garden', 'homeware',
                'bed', 'bath'],
        categories: [
            { name: 'Seating', low: 90, high: 1900, items: [
                'Two Seat Fabric Sofa',
                'Three Seat Fabric Sofa',
                'Three Seat Leather Sofa',
                'Corner Sofa with Chaise',
                'Accent Armchair',
                'Swivel Lounge Chair',
                'Dining Chair Set of 2',
                'Upholstered Bench',
                'Footstool Ottoman'] },
            { name: 'Tables', low: 70, high: 1200, items: [
                'Oak Dining Table 4 Seat',
                'Oak Dining Table 6 Seat',
                'Extending Dining Table',
                'Round Bistro Table',
                'Coffee Table with Shelf',
                'Nest of Side Tables',
                'Console Table',
                'Writing Desk',
                'Bedside Table'] },
            { name: 'Lighting', low: 25, high: 420, items: [
                'Adjustable Floor Lamp',
                'Arc Floor Lamp',
                'Ceramic Table Lamp',
                'Brass Desk Lamp',
                'Pendant Ceiling Light',
                'Three Light Pendant Cluster',
                'Wall Reading Light',
                'Rechargeable Table Light',
                'Dimmable LED Bulb Set of 4'] },
            { name: 'Kitchen', low: 15, high: 380, items: [
                'Cast Iron Casserole 24cm',
                'Stainless Frying Pan 28cm',
                'Non Stick Frying Pan 24cm',
                'Five Piece Saucepan Set',
                'Stoneware Dinner Plate Set of 4',
                'Porcelain Mug Set of 4',
                'Insulated Water Bottle 750ml',
                'Glass Storage Jar Set of 3',
                'Chef Knife 20cm',
                'Wooden Chopping Board'] },
            { name: 'Textiles', low: 20, high: 460, items: [
                'Wool Blend Rug 160x230',
                'Flatweave Rug 120x180',
                'Runner Rug 80x200',
                'Knitted Throw Blanket',
                'Quilted Bedspread',
                'Cotton Duvet Cover Double',
                'Cotton Duvet Cover King',
                'Cushion Cover Set of 2',
                'Bath Towel Set of 4'] }
        ]
    },
    {
        id: 'beauty',
        words: ['beauty', 'cosmetic', 'cosmetics', 'skin', 'skincare', 'care', 'perfume',
                'fragrance', 'hair', 'salon', 'belleza', 'beleza', 'kozmetik', 'pharmacy',
                'farmacia', 'wellness', 'spa'],
        categories: [
            { name: 'Skincare', low: 12, high: 180, items: [
                'Gentle Foaming Cleanser 150ml',
                'Cream Cleanser 200ml',
                'Hydrating Day Moisturiser 50ml',
                'Rich Night Cream 50ml',
                'Vitamin C Serum 30ml',
                'Hyaluronic Serum 30ml',
                'Retinol Night Serum 30ml',
                'Eye Cream 15ml',
                'Clay Face Mask 75ml',
                'Mineral Sunscreen SPF50 50ml'] },
            { name: 'Body', low: 8, high: 90, items: [
                'Shower Gel 250ml',
                'Body Wash 500ml',
                'Body Lotion 250ml',
                'Rich Body Butter 200ml',
                'Hand Cream 75ml',
                'Exfoliating Body Scrub 200ml',
                'Bath Soak 400ml',
                'Deodorant Stick 50ml',
                'Foot Cream 100ml'] },
            { name: 'Hair', low: 9, high: 120, items: [
                'Daily Shampoo 300ml',
                'Volumising Shampoo 300ml',
                'Repair Conditioner 300ml',
                'Leave In Conditioner 150ml',
                'Deep Repair Hair Mask 200ml',
                'Hair Oil 50ml',
                'Curl Defining Cream 200ml',
                'Dry Shampoo 200ml',
                'Heat Protection Spray 150ml'] },
            { name: 'Fragrance', low: 30, high: 240, items: [
                'Eau de Parfum 30ml',
                'Eau de Parfum 50ml',
                'Eau de Parfum 100ml',
                'Eau de Toilette 50ml',
                'Eau de Toilette 100ml',
                'Fragrance Discovery Set',
                'Solid Perfume Balm 15ml',
                'Scented Body Mist 150ml',
                'Home Diffuser 100ml'] },
            { name: 'Make Up', low: 10, high: 95, items: [
                'Serum Foundation 30ml',
                'Matte Foundation 30ml',
                'Cream Concealer 8ml',
                'Loose Setting Powder',
                'Cream Blush Stick',
                'Eyeshadow Palette of 9',
                'Volume Mascara',
                'Precision Eyeliner',
                'Satin Lipstick',
                'Tinted Lip Balm'] }
        ]
    },
    {
        id: 'sport',
        words: ['sport', 'sports', 'fitness', 'gym', 'active', 'athletic', 'running',
                'outdoor', 'cycle', 'bike', 'bicicleta', 'deporte', 'esporte', 'spor',
                'training', 'performance', 'trail'],
        categories: [
            { name: 'Training Wear', low: 20, high: 130, items: [
                'Seamless Training Leggings',
                'High Waist Training Leggings',
                'Training Shorts 5 inch',
                'Training Shorts 7 inch',
                'Lightweight Training T Shirt',
                'Long Sleeve Training Top',
                'Medium Support Sports Bra',
                'High Support Sports Bra',
                'Training Zip Hoodie',
                'Performance Tank Top'] },
            { name: 'Footwear', low: 60, high: 320, items: [
                'Neutral Road Running Shoe',
                'Cushioned Road Running Shoe',
                'Trail Running Shoe',
                'Cross Training Shoe',
                'Weightlifting Shoe',
                'Indoor Court Shoe',
                'Approach Walking Shoe',
                'Recovery Slide',
                'Running Sock Three Pack'] },
            { name: 'Weights', low: 15, high: 480, items: [
                'Rubber Hex Dumbbell 5kg',
                'Rubber Hex Dumbbell 10kg',
                'Rubber Hex Dumbbell 15kg',
                'Adjustable Dumbbell Pair 20kg',
                'Cast Iron Kettlebell 8kg',
                'Cast Iron Kettlebell 16kg',
                'Olympic Barbell 20kg',
                'Bumper Plate Pair 10kg',
                'Adjustable Weight Bench'] },
            { name: 'Cycling', low: 25, high: 2200, items: [
                'Aluminium Road Bike',
                'Carbon Road Bike',
                'Hardtail Mountain Bike',
                'Hybrid Commuter Bike',
                'Gravel Bike',
                'Road Cycling Helmet',
                'Mountain Bike Helmet',
                'Bike Floor Pump',
                'Rear Bike Light Set'] },
            { name: 'Accessories', low: 10, high: 340, items: [
                'GPS Fitness Watch',
                'Heart Rate Chest Strap',
                'Foam Roller 45cm',
                'Resistance Band Set',
                'Yoga Mat 6mm',
                'Skipping Rope',
                'Gym Holdall 40L',
                'Insulated Sports Bottle 750ml',
                'Football Size 5'] }
        ]
    }
];

/* WHEN NOTHING IN THE ADDRESS SAYS WHAT THE STORE SELLS, which is most .com
   addresses. A spread rather than a guess: one category borrowed from each
   vertical, so the demo browses like a department store and does not quietly claim
   the prospect is a tyre shop. */
const GENERAL = {
    id: 'general',
    words: [],
    categories: [
        VERTICALS[1].categories[2],   /* Shirts and Tops */
        VERTICALS[2].categories[2],   /* Audio */
        VERTICALS[3].categories[3],   /* Kitchen */
        VERTICALS[4].categories[1],   /* Body */
        VERTICALS[5].categories[4]    /* Accessories */
    ]
};

/* Whole words, and the longest match wins, because "autoparts" contains "auto" and
   a store called "sportauto" should not become a tyre shop on a three letter
   coincidence. Scored rather than first-match for the same reason. */
export function verticalFor(text) {
    const haystack = ' ' + String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ') + ' ';
    let best = null;
    let bestScore = 0;
    for (const vertical of VERTICALS) {
        for (const word of vertical.words) {
            if (!haystack.includes(' ' + word + ' ') && !haystack.includes(word)) continue;
            /* A word found as its own token counts for more than one found inside a
               longer run of characters, and a longer word counts for more than a
               short one. "pneus" inside "riopneus" still wins over nothing. */
            const score = word.length + (haystack.includes(' ' + word + ' ') ? 10 : 0);
            if (score > bestScore) { bestScore = score; best = vertical; }
        }
    }
    return best || GENERAL;
}

/* Spread across the band rather than random, so the same store rebuilt tomorrow
   produces the same catalogue. A demo that changes its own prices between two
   builds looks like a fault, and Math.random in a generator is how that happens.

   The .90 ending is a retail convention rather than a decoration: a grid of round
   hundreds does not read as a shop. */
function priceFor(low, high, index, count) {
    const step = count > 1 ? (high - low) / (count - 1) : 0;
    return Math.round(low + step * index) - 0.1;
}

function idFor(name) {
    return name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
}

/* ONE CATALOGUE, AND IT ANNOUNCES WHAT IT IS. tier 'generated' is what every
   caller keys off: the report leads with it, the config records it, and the issue
   comment says it in its first line. Nothing here is allowed to look like a scrape.

   stockCount stays null, exactly as it does everywhere else in the scrape. Inventing
   a catalogue was asked for; inventing a stock level on top of it would put "Only 3
   left" on a product nobody counted, and that is the specific failure non-negotiable
   5 was written about. */
export function generatedCatalogue(hint) {
    const vertical = verticalFor(hint);
    const products = [];

    for (const category of vertical.categories) {
        category.items.forEach((name, index) => {
            products.push({
                id: idFor(name),
                name,
                category: category.name,
                price: priceFor(category.low, category.high, index, category.items.length),
                discountedPrice: null,
                stockCount: null,
                attributes: {},
                image: null
            });
        });
    }

    return { ok: true, tier: 'generated', vertical: vertical.id, products, currency: null };
}

export const VERTICAL_IDS = VERTICALS.map((v) => v.id).concat(GENERAL.id);

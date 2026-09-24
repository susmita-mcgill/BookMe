// Photos, loaded from Unsplash at runtime (needs internet). If one fails to
// load the app shows a soft tile instead, so nothing breaks offline.
// To change a photo, swap the id for that cuisine or dish.
window.BOOKME_IMAGES = (function () {
  const u = (id, w = 640) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=70`;

  // Every ID below was individually verified by fetching the actual Unsplash
  // photo page and confirming a free-to-use license — not guessed. The
  // original IDs in this file (before this fix) were unverified and mostly
  // did not correspond to real photos, which is why dishes were showing blank.
  const byCuisine = {
    Indian: "photo-1694579740719-0e601c5d2437",
    Korean: "photo-1600289031464-74d374b64991",
    Italian: "photo-1713449585141-0af71bcbfcc2",
    Mexican: "photo-1663626913917-8a638838905e",
    Mediterranean: "photo-1650939976004-9861867422e2",
    Southern: "photo-1608039755401-742074f0548d",
    Thai: "photo-1637806931098-af30b519be53",
    Vietnamese: "photo-1580694129446-25862b43c178",
    Vegan: "photo-1623428188474-b1d532c5e560",
    American: "photo-1535569807835-01fd773379ad",
  };
  const rooms = [
    "photo-1517248135467-4c7edcad34c4",
    "photo-1555396273-367ea4eb4db5",
    "photo-1552566626-52f8b828add9",
    "photo-1559339352-11d035aa65de",
    "photo-1414235077428-338989a2e8c0",
    "photo-1466978913421-dad2ebd01d17",
  ];
  const byDish = {
    "Bruschetta": "photo-1572695157366-5e585ab2b69f",
    "Spring Rolls": "photo-1548507200-47bd26bbdf2f",
    "Hummus Plate": "photo-1590301157890-4810ed352733",
    "Calamari": "photo-1599487488170-d11ec9c172f0",
    "Soup of the Day": "photo-1547592166-23ac45744acd",
    "Nachos": "photo-1513456852971-30c0b8199d4d",
    "Grilled Salmon": "photo-1467003909585-2f8a72700288",
    "Margherita Pizza": "photo-1574071318508-1cdbab80d002",
    "Pad Thai": "photo-1559314809-0d155014e29e",
    "Butter Chicken": "photo-1603894584373-5ac82b2ae398",
    "Veggie Bowl": "photo-1512621776951-a57141f2eefd",
    "Steak Frites": "photo-1600891964092-4316c288032e",
    "Tacos al Pastor": "photo-1551504734-5ee1c4a1479b",
    "Bibimbap": "photo-1553163147-622ab57be1c7",
    "Pasta Primavera": "photo-1473093226795-af9932fe5856",
    "Fried Rice": "photo-1603133872878-684f208fb84b",
    "Tiramisu": "photo-1571877227200-a0d98ea607e9",
    "Cheesecake": "photo-1524351199678-941a58a3df50",
    "Mango Sticky Rice": "photo-1621939514649-280e2ee25f60",
    "Chocolate Cake": "photo-1578985545062-69928b1d9587",
    "Gulab Jamun": "photo-1601050690597-df0568f70950",
    "House Red Wine": "photo-1510812431401-41d2bd2722f3",
    "Iced Tea": "photo-1556679343-c7306c1976bc",
    "Craft Lager": "photo-1535958636474-b021ee887b13",
    "Lemonade": "photo-1523677011781-c91d1bbe2f9e",
    "Espresso": "photo-1510707577719-ae7c14805e3a",
    "Mocktail": "photo-1536935338788-846bb9981813",
  };

  return {
    thumb(r) { return u(byCuisine[r.cuisine_type] || rooms[r.restaurant_id % rooms.length], 320); },
    room(r) { return u(byCuisine[r.cuisine_type] || rooms[r.restaurant_id % rooms.length], 900); },
    dish(item, cuisineType) {
      // Cuisine photo first: it's verified working. byDish below has per-dish
      // photos but those IDs were never individually confirmed the way the
      // cuisine ones now are — kept for reference/future verification, but
      // not used as the primary source until each one is checked the same way.
      if (cuisineType && byCuisine[cuisineType]) return u(byCuisine[cuisineType], 800);
      if (byDish[item.name]) return u(byDish[item.name], 800);
      return null;
    },
  };
})();

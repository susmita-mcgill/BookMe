// Photos, loaded from Unsplash at runtime (needs internet). If one fails to
// load the app shows a soft tile instead, so nothing breaks offline.
// To change a photo, swap the id for that cuisine or dish.
window.BOOKME_IMAGES = (function () {
  const u = (id, w = 640) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=70`;

  const byCuisine = {
    Indian: "photo-1585937421612-70a008356fbe",
    Korean: "photo-1498654896293-37aacf113fd9",
    Italian: "photo-1565299624946-b28f40a0ae38",
    Mexican: "photo-1551504734-5ee1c4a1479b",
    Mediterranean: "photo-1540189549336-e6e99c3679fe",
    Southern: "photo-1544025162-d76694265947",
    Thai: "photo-1559314809-0d155014e29e",
    Vietnamese: "photo-1569718212165-3a8278d5f624",
    Vegan: "photo-1512621776951-a57141f2eefd",
    American: "photo-1504674900247-0877df9cc836",
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
    room(r) { return u(rooms[r.restaurant_id % rooms.length], 900); },
    dish(item) { return byDish[item.name] ? u(byDish[item.name], 800) : null; },
  };
})();

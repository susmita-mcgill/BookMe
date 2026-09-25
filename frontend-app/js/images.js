// Photos, loaded from Unsplash at runtime (needs internet). Every dish gets a
// photo: its own if listed below, otherwise a drink or dessert photo, otherwise
// its cuisine's photo. If a photo fails to load the app shows a soft tile, so
// nothing breaks offline. To change a photo, swap the id.
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
    Vietnamese: "photo-1631709497146-a239ef373cf1",
    Vegan: "photo-1512621776951-a57141f2eefd",
    American: "photo-1504674900247-0877df9cc836",
  };
  const byCategory = {
    Drinks: "photo-1619604394865-437a9fd6853c",
    Desserts: "photo-1517427294546-5aa121f68e8a",
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
    // Indian
    "Onion Bhaji": "photo-1643892467625-65df6a500524",
    "Samosas": "photo-1601050690597-df0568f70950",
    "Lamb Vindaloo": "photo-1565557623262-b51c2513a641",
    "Chana Masala": "photo-1612700722193-f0410adb8949",
    "Butter Chicken": "photo-1603894584373-5ac82b2ae398",
    "Kheer": "photo-1777613112969-d7511ddfbe15",
    "Gulab Jamun": "photo-1666190092159-3171cf0fbb12",
    "Mango Lassi": "photo-1623065422902-30a2d299bbe4",
    "Chai": "photo-1619581073186-5b4ae1b0caad",
    // Mediterranean
    "Baba Ganoush": "photo-1627308595127-d9acf19107ce",
    "Hummus Plate": "photo-1637949385162-e416fb15b2ce",
    "Falafel": "photo-1593001872095-7d5b3868fb1d",
    "Lamb Gyro": "photo-1676300187347-6f60002fd83e",
    "Chicken Shawarma": "photo-1676300187013-7540d4e9440d",
    "Rice Pudding": "photo-1590055619273-44b5b6ce52e8",
    "Baklava": "photo-1598110750624-207050c4f28c",
    "Mint Lemonade": "photo-1575596510825-f748919a2bf7",
    "House Red Wine": "photo-1630369160812-26c7604cbd8c",
    // Korean
    "Mandu Dumplings": "photo-1496116218417-1a781b1c416c",
    "Kimchi Pancake": "photo-1540162579464-e90ec977bd67",
    "Bulgogi": "photo-1677029969065-c9f4003a9ad5",
    "Japchae": "photo-1583032015879-e5022cb87c3b",
    "Bibimbap": "photo-1718777791239-c473e9ce7376",
    "Rice Cake": "photo-1744870132190-5c02d3f8d9f9",
    "Bingsu": "photo-1771209802058-3b40ce534905",
    "Iced Tea": "photo-1556679343-c7306c1976bc",
    "Craft Lager": "photo-1571613316887-6f8d5cbf7ef7",
    // Italian
    "Caprese Salad": "photo-1595587870672-c79b47875c6a",
    "Arancini": "photo-1690642109209-18176b898182",
    "Bruschetta": "photo-1506280754576-f6fa8a873550",
    "Margherita Pizza": "photo-1604068549290-dea0e4a305ca",
    "Chicken Parmesan": "photo-1632778149955-e80f8ceca2e8",
    "Pasta Primavera": "photo-1664214649076-7b17006db5b5",
    "Panna Cotta": "photo-1613505411792-208b15f862b0",
    "Tiramisu": "photo-1571877227200-a0d98ea607e9",
    "Espresso": "photo-1579992357154-faf4bde95b3d",
    // Southern
    "Deviled Eggs": "photo-1557965983-5b9fc9ab9014",
    "Hush Puppies": "photo-1591549930146-b703e89b3710",
    "Fried Green Tomatoes": "photo-1787585575974-1ebd78178aba",
    "BBQ Ribs": "photo-1679711246825-1f2bd51b16d0",
    "Fried Chicken": "photo-1426869981800-95ebf51ce900",
    "Shrimp and Grits": "photo-1768249731607-2b3ecaf27071",
    "Peach Cobbler": "photo-1567552229523-aaa2f6b76a60",
    "Banana Pudding": "photo-1639330842151-8a92eb332b2d",
    "Sweet Tea": "photo-1556679343-c7306c1976bc",
    // Vietnamese
    "Fresh Spring Rolls": "photo-1560162071-da4c4a91077a",
    "Banh Xeo": "photo-1788927783922-8b1299701b45",
    "Vermicelli Bowl": "photo-1745817078506-bfc70df458b5",
    "Pho": "photo-1631709497146-a239ef373cf1",
    "Coconut Pudding": "photo-1613505411792-208b15f862b0",
    "Vietnamese Iced Coffee": "photo-1578314675249-a6910f80cc4e",
    // American
    "Nachos": "photo-1582169296194-e4d644c48063",
    "Soup of the Day": "photo-1629978444632-9f63ba0eff47",
    "Calamari": "photo-1762305195844-94479ea6aca4",
    "Grilled Salmon": "photo-1467003909585-2f8a72700288",
    "Steak Frites": "photo-1720701247839-9b8433398385",
    "Cheesecake": "photo-1524351199678-941a58a3df50",
    "Chocolate Cake": "photo-1517427294546-5aa121f68e8a",
    "Lemonade": "photo-1523677011781-c91d1bbe2f9e",
    // Vegan
    "Veggie Bowl": "photo-1675092789086-4bd2b93ffc69",
    "Vegetable Spring Rolls": "photo-1695712641569-05eee7b37b6d",
    "Jackfruit Tacos": "photo-1565299585323-38d6b0865b47",
    "Vegan Fried Rice": "photo-1603133872878-684f208fb84b",
    "Vegan Chocolate Cake": "photo-1517427294546-5aa121f68e8a",
    "Mango Sticky Rice": "photo-1711161988375-da7eff032e45",
    "Mocktail": "photo-1619604394865-437a9fd6853c",
    // Mexican
    "Elote": "photo-1570716774271-ab30ad4924a8",
    "Guacamole & Chips": "photo-1680992071073-cb1696ba8d3e",
    "Tacos al Pastor": "photo-1551504734-5ee1c4a1479b",
    "Enchiladas Verdes": "photo-1613514967307-d5b3471b2453",
    "Tres Leches Cake": "photo-1559620192-032c4bc4674e",
    "Churros": "photo-1624371414361-e670edf4898d",
    // Older menu names, kept so an older database still gets photos
    "Spring Rolls": "photo-1560162071-da4c4a91077a",
    "Pad Thai": "photo-1559314809-0d155014e29e",
    "Fried Rice": "photo-1603133872878-684f208fb84b",
  };

  function dishId(item, cuisine) {
    return byDish[item.name] || byCategory[item.category] || byCuisine[cuisine] || null;
  }
  return {
    thumb(r) { return u(byCuisine[r.cuisine_type] || rooms[r.restaurant_id % rooms.length], 320); },
    room(r) { return u(rooms[r.restaurant_id % rooms.length], 900); },
    dish(item, cuisine) { const id = dishId(item, cuisine); return id ? u(id, 800) : null; },
    all() { return [...new Set([...Object.values(byCuisine), ...Object.values(byCategory), ...rooms, ...Object.values(byDish)])]; },
  };
})();

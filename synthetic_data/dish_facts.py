"""
Real allergens, diet flags and spice level for every dish on the menus.

The generator used to assign these at random, so a Margherita Pizza could come
out dairy-free and Hummus could come out spicy. The dietary filter trusts this
data, so it has to be right. Allergens use the six names in the allergens
table (nuts, shellfish, dairy, gluten, soy, eggs). Typical recipes; a real
restaurant would confirm its own.

Columns: allergens, is_vegetarian, is_vegan, is_gluten_free, spice_level (0-3)
"""

DISH_FACTS = {
    # Indian
    "Papadum":              ([], 1, 1, 1, 1),
    "Onion Bhaji":          ([], 1, 1, 1, 1),
    "Samosas":              (["gluten"], 1, 1, 0, 1),
    "Lamb Vindaloo":        ([], 0, 0, 1, 3),
    "Chana Masala":         ([], 1, 1, 1, 2),
    "Butter Chicken":       (["dairy", "nuts"], 0, 0, 1, 1),
    "Kheer":                (["dairy", "nuts"], 1, 0, 1, 0),
    "Gulab Jamun":          (["dairy", "gluten"], 1, 0, 0, 0),
    "Mango Lassi":          (["dairy"], 1, 0, 1, 0),
    "Chai":                 (["dairy"], 1, 0, 1, 0),
    # Mediterranean
    "Baba Ganoush":         ([], 1, 1, 1, 0),
    "Hummus Plate":         (["gluten"], 1, 1, 0, 0),
    "Falafel":              ([], 1, 1, 1, 0),
    "Veggie Bowl":          ([], 1, 1, 1, 0),
    "Lamb Gyro":            (["gluten", "dairy"], 0, 0, 0, 0),
    "Chicken Shawarma":     (["gluten", "dairy"], 0, 0, 0, 1),
    "Rice Pudding":         (["dairy"], 1, 0, 1, 0),
    "Baklava":              (["nuts", "gluten", "dairy"], 1, 0, 0, 0),
    "Mint Lemonade":        ([], 1, 1, 1, 0),
    "House Red Wine":       ([], 1, 1, 1, 0),
    # Korean
    "Mandu Dumplings":      (["gluten", "soy"], 0, 0, 0, 0),
    "Kimchi Pancake":       (["gluten", "eggs", "shellfish"], 0, 0, 0, 2),
    "Bulgogi":              (["soy", "gluten"], 0, 0, 0, 1),
    "Japchae":              (["soy", "gluten"], 0, 0, 0, 0),
    "Bibimbap":             (["soy", "eggs"], 0, 0, 0, 2),
    "Rice Cake":            ([], 1, 1, 1, 0),
    "Bingsu":               (["dairy"], 1, 0, 1, 0),
    "Iced Tea":             ([], 1, 1, 1, 0),
    "Craft Lager":          (["gluten"], 1, 1, 0, 0),
    # Italian
    "Caprese Salad":        (["dairy"], 1, 0, 1, 0),
    "Arancini":             (["dairy", "gluten", "eggs"], 1, 0, 0, 0),
    "Bruschetta":           (["gluten"], 1, 1, 0, 0),
    "Margherita Pizza":     (["dairy", "gluten"], 1, 0, 0, 0),
    "Chicken Parmesan":     (["dairy", "gluten", "eggs"], 0, 0, 0, 0),
    "Pasta Primavera":      (["gluten", "dairy"], 1, 0, 0, 0),
    "Panna Cotta":          (["dairy"], 1, 0, 1, 0),
    "Tiramisu":             (["dairy", "eggs", "gluten"], 1, 0, 0, 0),
    "Espresso":             ([], 1, 1, 1, 0),
    # Southern
    "Deviled Eggs":         (["eggs"], 1, 0, 1, 1),
    "Hush Puppies":         (["gluten", "eggs", "dairy"], 1, 0, 0, 0),
    "Fried Green Tomatoes": (["gluten", "eggs", "dairy"], 1, 0, 0, 0),
    "BBQ Ribs":             ([], 0, 0, 1, 1),
    "Fried Chicken":        (["gluten", "eggs", "dairy"], 0, 0, 0, 1),
    "Shrimp and Grits":     (["shellfish", "dairy"], 0, 0, 1, 1),
    "Peach Cobbler":        (["gluten", "dairy"], 1, 0, 0, 0),
    "Banana Pudding":       (["dairy", "eggs", "gluten"], 1, 0, 0, 0),
    "Sweet Tea":            ([], 1, 1, 1, 0),
    # Vietnamese
    "Fresh Spring Rolls":   (["shellfish", "nuts"], 0, 0, 1, 0),
    "Banh Xeo":             (["shellfish"], 0, 0, 1, 1),
    "Vermicelli Bowl":      (["nuts"], 0, 0, 1, 1),
    "Pho":                  ([], 0, 0, 1, 1),
    "Coconut Pudding":      ([], 1, 1, 1, 0),
    "Che":                  ([], 1, 1, 1, 0),
    "Vietnamese Iced Coffee": (["dairy"], 1, 0, 1, 0),
    # American
    "Nachos":               (["dairy"], 1, 0, 1, 2),
    "Soup of the Day":      (["dairy", "gluten"], 1, 0, 0, 0),
    "Calamari":             (["shellfish", "gluten", "eggs"], 0, 0, 0, 0),
    "Grilled Salmon":       ([], 0, 0, 1, 0),
    "Steak Frites":         ([], 0, 0, 1, 0),
    "Cheesecake":           (["dairy", "eggs", "gluten"], 1, 0, 0, 0),
    "Chocolate Cake":       (["dairy", "eggs", "gluten"], 1, 0, 0, 0),
    "Lemonade":             ([], 1, 1, 1, 0),
    # Vegan
    "Vegetable Spring Rolls": (["gluten", "soy"], 1, 1, 0, 0),
    "Jackfruit Tacos":      ([], 1, 1, 1, 2),
    "Vegan Fried Rice":     (["soy", "gluten"], 1, 1, 0, 1),
    "Vegan Chocolate Cake": (["gluten", "soy"], 1, 1, 0, 0),
    "Mango Sticky Rice":    ([], 1, 1, 1, 0),
    "Mocktail":             ([], 1, 1, 1, 0),
    # Mexican
    "Elote":                (["dairy", "eggs"], 1, 0, 1, 2),
    "Guacamole & Chips":    ([], 1, 1, 1, 1),
    "Tacos al Pastor":      ([], 0, 0, 1, 2),
    "Enchiladas Verdes":    (["dairy"], 0, 0, 1, 2),
    "Tres Leches Cake":     (["dairy", "eggs", "gluten"], 1, 0, 0, 0),
    "Churros":              (["gluten", "eggs", "dairy"], 1, 0, 0, 0),
    "Horchata":             (["dairy"], 1, 0, 1, 0),
    # Older generic menu names
    "Spring Rolls":         (["gluten", "soy"], 1, 1, 0, 0),
    "Pad Thai":             (["nuts", "eggs", "soy", "shellfish"], 0, 0, 1, 2),
    "Fried Rice":           (["soy", "eggs", "gluten"], 0, 0, 0, 1),
}

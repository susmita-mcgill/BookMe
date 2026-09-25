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


# ---------------------------------------------------------------------------
# Customize options. The generator used to give every dish random options
# ("Add avocado" on a mocktail). These are picked by dish type instead.
# Each list has at least four options; a dish gets the first 2 to 4.
COFFEE_TEA = {"Espresso", "Chai", "Iced Tea", "Sweet Tea", "Vietnamese Iced Coffee"}
ALCOHOL = {"House Red Wine", "Craft Lager"}

DRINK_OPTIONS = {
    "coffee": [("Oat milk", 0.75), ("Less sugar", 0.0), ("Iced", 0.0), ("Extra shot", 1.25)],
    "alcohol": [("Large pour", 4.00), ("Glass of water", 0.0), ("Sample first", 0.0), ("Chilled", 0.0)],
    "other": [("Less sugar", 0.0), ("No ice", 0.0), ("Large", 2.00), ("Extra lime", 0.0)],
}
DESSERT_OPTIONS = [("Extra spoons to share", 0.0), ("Add a scoop of ice cream", 2.50), ("Sauce on the side", 0.0), ("Candle for a birthday", 0.0)]
FOOD_OPTIONS = {
    "Indian": [("Extra spicy", 0.0), ("Mild", 0.0), ("Add naan", 3.00), ("Add rice", 2.50)],
    "Mexican": [("No cilantro", 0.0), ("Add avocado", 2.00), ("Extra salsa", 0.0), ("Extra spicy", 0.0)],
    "Italian": [("Add chili flakes", 0.0), ("Extra cheese", 1.50), ("Add chicken", 4.00), ("Extra basil", 0.0)],
    "Korean": [("Extra spicy", 0.0), ("Add fried egg", 1.50), ("Extra kimchi", 1.00), ("Mild", 0.0)],
    "Vietnamese": [("No cilantro", 0.0), ("Extra herbs", 0.0), ("Add chili", 0.0), ("Extra peanuts", 0.0)],
    "Mediterranean": [("No onions", 0.0), ("Extra tahini", 0.0), ("Add feta", 2.00), ("Extra pita", 1.50)],
    "Southern": [("Extra hot sauce", 0.0), ("Side of slaw", 2.50), ("Add a biscuit", 2.00), ("Sauce on the side", 0.0)],
    "American": [("Sauce on the side", 0.0), ("Add side salad", 3.50), ("No onions", 0.0), ("Extra crispy", 0.0)],
    "Vegan": [("Add avocado", 2.00), ("Extra tofu", 3.00), ("Sauce on the side", 0.0), ("Extra spicy", 0.0)],
}


def modifier_options(dish_name, category, cuisine):
    if category == "Drinks":
        kind = "coffee" if dish_name in COFFEE_TEA else "alcohol" if dish_name in ALCOHOL else "other"
        return DRINK_OPTIONS[kind]
    if category == "Desserts":
        return DESSERT_OPTIONS
    return FOOD_OPTIONS.get(cuisine, FOOD_OPTIONS["American"])

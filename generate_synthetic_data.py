"""
Synthetic data generator for the expanded In-Restaurant Dining App schema.
Standard library only.

Produces, under ./synthetic_data/:
  - One CSV per table
  - synthetic_data_inserts.sql  (paste into a Postgres/Supabase SQL editor; matches schema.sql)
  - dining_app.db               (fully populated local SQLite database for instant demo queries)

Run:  python3 generate_synthetic_data.py
"""

import csv
import os
import random
import sqlite3
from datetime import datetime, timedelta, date, time
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), "synthetic_data"))
from dish_facts import DISH_FACTS  # real allergens / diet flags / spice per dish

random.seed(42)

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "synthetic_data")
os.makedirs(OUT_DIR, exist_ok=True)
NOW = datetime(2026, 9, 22, 12, 0, 0)

# ================================================================
# Reference data
# ================================================================
NEIGHBORHOODS = ["Wicker Park", "Logan Square", "Lincoln Park", "West Loop", "Pilsen",
                 "Hyde Park", "Andersonville", "River North", "Bucktown", "South Loop"]
CUISINES = ["Italian", "Mexican", "Thai", "American", "Indian", "Vietnamese",
            "Mediterranean", "Korean", "Southern", "Vegan"]
NAME_WORDS = ["Corner", "Kitchen", "Table", "House", "Bistro", "Grill", "Cafe", "Spot", "Room", "Social"]
PRICE_TIERS = ["$", "$$", "$$$"]
POS_PROVIDERS = ["Square", "Toast", "average/unknown"]
FIRST_NAMES = ["Alex", "Jamie", "Taylor", "Jordan", "Morgan", "Casey", "Riley", "Sam", "Drew", "Avery",
               "Priya", "Wei", "Fatima", "Diego", "Elena", "Noah", "Maya", "Liam", "Zoe", "Omar",
               "Hana", "Marcus", "Sofia", "Ravi", "Chen", "Aisha", "Lucas", "Nina", "Tariq", "Emma"]
LAST_NAMES = ["Smith", "Johnson", "Lee", "Garcia", "Patel", "Kim", "Nguyen", "Brown", "Davis", "Martinez",
              "Khan", "Chen", "Rossi", "Anderson", "Silva", "Cohen", "Singh", "Torres", "Kelly", "Wright"]
DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
SHIFT_BLOCKS = ["breakfast", "lunch", "dinner", "late_night"]
STAFF_ROLES = ["server", "host", "cook", "manager", "dishwasher"]
CATEGORY_NAMES = ["Appetizers", "Entrees", "Desserts", "Drinks"]
DEVICE_TYPES = ["ios", "android", "web"]
WEATHER = ["clear", "clear", "clear", "rain", "snow", "extreme_heat", "extreme_cold"]

DIETARY_TAG_NAMES = ["vegetarian", "vegan", "gluten-free", "dairy-free", "halal", "kosher", "nut-free"]
ALLERGEN_NAMES = ["nuts", "shellfish", "dairy", "gluten", "soy", "eggs"]

MENU_ITEM_NAMES = {
    "Appetizers": ["Bruschetta", "Spring Rolls", "Hummus Plate", "Calamari", "Soup of the Day", "Nachos"],
    "Entrees": ["Grilled Salmon", "Margherita Pizza", "Pad Thai", "Butter Chicken", "Veggie Bowl",
                "Steak Frites", "Tacos al Pastor", "Bibimbap", "Pasta Primavera", "Fried Rice"],
    "Desserts": ["Tiramisu", "Cheesecake", "Mango Sticky Rice", "Chocolate Cake", "Gulab Jamun"],
    "Drinks": ["House Red Wine", "Iced Tea", "Craft Lager", "Lemonade", "Espresso", "Mocktail"],
}

# Cuisine-specific menus, so a restaurant's dishes actually match its cuisine_type
# (previously dishes were pooled globally by category only, so a Mexican
# restaurant could end up serving Butter Chicken).
CUISINE_MENU = {
    "Italian": {
        "Appetizers": ["Bruschetta", "Caprese Salad", "Arancini"],
        "Entrees": ["Margherita Pizza", "Pasta Primavera", "Chicken Parmesan"],
        "Desserts": ["Tiramisu", "Panna Cotta"],
        "Drinks": ["House Red Wine", "Espresso"],
    },
    "Mexican": {
        "Appetizers": ["Guacamole & Chips", "Elote", "Nachos"],
        "Entrees": ["Tacos al Pastor", "Enchiladas Verdes", "Carne Asada"],
        "Desserts": ["Churros", "Tres Leches Cake"],
        "Drinks": ["Horchata", "Mocktail"],
    },
    "Thai": {
        "Appetizers": ["Spring Rolls", "Tom Kha Soup", "Satay Skewers"],
        "Entrees": ["Pad Thai", "Green Curry", "Drunken Noodles"],
        "Desserts": ["Mango Sticky Rice", "Thai Tea Panna Cotta"],
        "Drinks": ["Thai Iced Tea", "Lemonade"],
    },
    "American": {
        "Appetizers": ["Nachos", "Calamari", "Soup of the Day"],
        "Entrees": ["Steak Frites", "Veggie Bowl", "Grilled Salmon"],
        "Desserts": ["Cheesecake", "Chocolate Cake"],
        "Drinks": ["Craft Lager", "Lemonade"],
    },
    "Indian": {
        "Appetizers": ["Samosas", "Papadum", "Onion Bhaji"],
        "Entrees": ["Butter Chicken", "Chana Masala", "Lamb Vindaloo"],
        "Desserts": ["Gulab Jamun", "Kheer"],
        "Drinks": ["Mango Lassi", "Chai"],
    },
    "Vietnamese": {
        "Appetizers": ["Fresh Spring Rolls", "Banh Xeo"],
        "Entrees": ["Pho", "Bun Cha", "Vermicelli Bowl"],
        "Desserts": ["Che", "Coconut Pudding"],
        "Drinks": ["Vietnamese Iced Coffee", "Iced Tea"],
    },
    "Mediterranean": {
        "Appetizers": ["Hummus Plate", "Falafel", "Baba Ganoush"],
        "Entrees": ["Chicken Shawarma", "Lamb Gyro", "Veggie Bowl"],
        "Desserts": ["Baklava", "Rice Pudding"],
        "Drinks": ["Mint Lemonade", "House Red Wine"],
    },
    "Korean": {
        "Appetizers": ["Kimchi Pancake", "Mandu Dumplings"],
        "Entrees": ["Bibimbap", "Bulgogi", "Japchae"],
        "Desserts": ["Bingsu", "Rice Cake"],
        "Drinks": ["Iced Tea", "Craft Lager"],
    },
    "Southern": {
        "Appetizers": ["Fried Green Tomatoes", "Deviled Eggs", "Hush Puppies"],
        "Entrees": ["Fried Chicken", "BBQ Ribs", "Shrimp and Grits"],
        "Desserts": ["Peach Cobbler", "Banana Pudding"],
        "Drinks": ["Sweet Tea", "Craft Lager"],
    },
    "Vegan": {
        "Appetizers": ["Hummus Plate", "Vegetable Spring Rolls"],
        "Entrees": ["Veggie Bowl", "Vegan Fried Rice", "Jackfruit Tacos"],
        "Desserts": ["Vegan Chocolate Cake", "Mango Sticky Rice"],
        "Drinks": ["Iced Tea", "Mocktail"],
    },
}

DISH_DESCRIPTIONS = {
    "Bruschetta": "Toasted sourdough topped with diced tomato, basil, and a drizzle of olive oil.",
    "Spring Rolls": "Hand-rolled with crisp vegetables and glass noodles, served with a tangy dipping sauce.",
    "Hummus Plate": "Creamy chickpea hummus with warm pita, olive oil, and a pinch of paprika.",
    "Calamari": "Lightly fried and served with a squeeze of lemon and house marinara.",
    "Soup of the Day": "A rotating seasonal soup made fresh each morning from scratch.",
    "Nachos": "Crisp tortilla chips loaded with melted cheese, jalapenos, and pico de gallo.",
    "Grilled Salmon": "Cedar-plank grilled salmon finished with a citrus herb butter.",
    "Margherita Pizza": "Wood-fired with san marzano tomatoes, fresh mozzarella, and basil.",
    "Pad Thai": "Stir-fried rice noodles with egg, bean sprouts, and a tamarind-lime sauce.",
    "Butter Chicken": "Tender chicken simmered in a rich, spiced tomato-butter gravy.",
    "Veggie Bowl": "Roasted seasonal vegetables over grains with a tahini drizzle.",
    "Steak Frites": "Grilled sirloin with garlic herb butter, served with crispy fries.",
    "Tacos al Pastor": "Marinated pork with pineapple, onion, and cilantro on corn tortillas.",
    "Bibimbap": "Warm rice bowl with sauteed vegetables, egg, and a spicy gochujang sauce.",
    "Pasta Primavera": "Fresh seasonal vegetables tossed with pasta in a light garlic-olive oil sauce.",
    "Fried Rice": "Wok-tossed rice with egg, scallions, and your choice of protein.",
    "Tiramisu": "Espresso-soaked ladyfingers layered with mascarpone cream and cocoa.",
    "Cheesecake": "A classic creamy cheesecake with a graham cracker crust.",
    "Mango Sticky Rice": "Sweet coconut sticky rice served with fresh ripe mango.",
    "Chocolate Cake": "A rich, layered dark chocolate cake with a silky ganache.",
    "Gulab Jamun": "Warm milk-solid dumplings soaked in a fragrant rose-cardamom syrup.",
    "House Red Wine": "A house-selected red, poured by the glass.",
    "Iced Tea": "Freshly brewed and lightly sweetened, served over ice.",
    "Craft Lager": "A local brewery's crisp, easy-drinking lager on tap.",
    "Lemonade": "Fresh-squeezed, made in-house daily.",
    "Espresso": "A double shot, pulled to order.",
    "Mocktail": "A rotating house mocktail made with fresh juice and soda.",
    # Cuisine-specific dishes (added alongside CUISINE_MENU)
    "Caprese Salad": "Fresh mozzarella, ripe tomato, and basil with a balsamic drizzle.",
    "Arancini": "Crispy fried risotto balls stuffed with mozzarella.",
    "Chicken Parmesan": "Breaded chicken cutlet, marinara, and melted mozzarella over pasta.",
    "Panna Cotta": "A silky vanilla custard topped with fresh berry sauce.",
    "Guacamole & Chips": "Fresh-mashed avocado with lime, cilantro, and warm tortilla chips.",
    "Elote": "Grilled corn on the cob with crema, cotija cheese, and chili powder.",
    "Enchiladas Verdes": "Corn tortillas rolled with chicken in a tangy tomatillo sauce.",
    "Carne Asada": "Grilled marinated steak, sliced thin, served with rice and beans.",
    "Churros": "Fried dough dusted in cinnamon sugar, served with chocolate dipping sauce.",
    "Tres Leches Cake": "A sponge cake soaked in three kinds of milk, topped with whipped cream.",
    "Horchata": "A sweet, creamy rice and cinnamon drink, served over ice.",
    "Tom Kha Soup": "Coconut milk soup with galangal, lemongrass, and mushrooms.",
    "Satay Skewers": "Grilled marinated skewers served with a peanut dipping sauce.",
    "Green Curry": "A creamy coconut curry with Thai basil and your choice of protein.",
    "Drunken Noodles": "Wide rice noodles stir-fried with basil, chili, and vegetables.",
    "Thai Tea Panna Cotta": "A Thai-tea-infused custard topped with condensed milk.",
    "Thai Iced Tea": "Sweet, spiced black tea served over ice with condensed milk.",
    "Samosas": "Crispy pastry filled with spiced potatoes and peas, served with chutney.",
    "Papadum": "Thin, crispy lentil crackers served with a trio of chutneys.",
    "Onion Bhaji": "Crispy onion fritters spiced with cumin and coriander.",
    "Chana Masala": "Chickpeas simmered in a spiced tomato and onion gravy.",
    "Lamb Vindaloo": "A fiery, tangy lamb curry with vinegar and warming spices.",
    "Kheer": "A creamy rice pudding flavored with cardamom and pistachio.",
    "Mango Lassi": "A cooling yogurt smoothie blended with sweet mango.",
    "Chai": "Spiced black tea simmered with milk, cardamom, and cinnamon.",
    "Fresh Spring Rolls": "Rice paper rolls with herbs, vermicelli, and shrimp or tofu, served fresh (not fried).",
    "Banh Xeo": "A crispy turmeric crepe filled with pork, shrimp, and bean sprouts.",
    "Pho": "A slow-simmered beef or chicken broth with rice noodles and fresh herbs.",
    "Bun Cha": "Grilled pork patties over rice vermicelli with a tangy dipping sauce.",
    "Vermicelli Bowl": "Rice noodles topped with grilled protein, herbs, and pickled vegetables.",
    "Che": "A layered Vietnamese sweet dessert with beans, jelly, and coconut milk.",
    "Coconut Pudding": "A silky coconut-milk pudding topped with toasted coconut.",
    "Vietnamese Iced Coffee": "Strong drip coffee sweetened with condensed milk, served over ice.",
    "Falafel": "Crispy fried chickpea fritters served with tahini sauce.",
    "Baba Ganoush": "Smoky roasted eggplant dip with tahini, lemon, and garlic.",
    "Chicken Shawarma": "Marinated chicken, slow-roasted and shaved, served with garlic sauce.",
    "Lamb Gyro": "Spiced lamb wrapped in warm pita with tzatziki and fresh vegetables.",
    "Baklava": "Layers of flaky phyllo, chopped nuts, and honey syrup.",
    "Rice Pudding": "A creamy, lightly spiced rice pudding served chilled.",
    "Mint Lemonade": "Fresh-squeezed lemonade muddled with mint leaves.",
    "Kimchi Pancake": "A savory, crispy pancake made with fermented kimchi.",
    "Mandu Dumplings": "Pan-fried dumplings filled with pork and vegetables.",
    "Bulgogi": "Thinly sliced marinated beef, grilled and slightly sweet.",
    "Japchae": "Stir-fried glass noodles with vegetables and sesame oil.",
    "Bingsu": "Shaved ice dessert topped with sweet red beans and condensed milk.",
    "Rice Cake": "Chewy Korean rice cakes in a sweet, mildly spicy sauce.",
    "Fried Green Tomatoes": "Cornmeal-crusted green tomatoes, fried crisp and golden.",
    "Deviled Eggs": "Classic creamy deviled eggs with a paprika finish.",
    "Hush Puppies": "Crispy fried cornmeal fritters, a Southern classic.",
    "Fried Chicken": "Buttermilk-brined and fried until golden and crispy.",
    "BBQ Ribs": "Slow-smoked pork ribs glazed with house barbecue sauce.",
    "Shrimp and Grits": "Sauteed shrimp over creamy, buttery stone-ground grits.",
    "Peach Cobbler": "Warm spiced peaches under a buttery, golden crust.",
    "Banana Pudding": "Layers of vanilla wafers, banana, and creamy custard.",
    "Sweet Tea": "Classic Southern-style iced tea, sweetened generously.",
    "Vegetable Spring Rolls": "Crispy rolls packed with fresh, seasonal vegetables.",
    "Vegan Fried Rice": "Wok-tossed rice with vegetables and plant-based protein.",
    "Jackfruit Tacos": "Shredded jackfruit seasoned and seared, served taco-style.",
    "Vegan Chocolate Cake": "A rich, moist chocolate cake made entirely plant-based.",
}

RESTAURANT_BLURB_TEMPLATES = [
    "A neighborhood favorite for {cuisine_lower} food in a relaxed, modern setting.",
    "Known for {cuisine_lower} classics and a warm, welcoming dining room.",
    "A cozy {cuisine_lower} spot with a focus on fresh, seasonal ingredients.",
    "Casual {cuisine_lower} dining with a lively atmosphere, popular with regulars.",
    "An intimate {cuisine_lower} kitchen known for generous portions and friendly service.",
    "A modern take on {cuisine_lower} cuisine, with a menu that changes with the seasons.",
]

SEATING_FEATURES = {
    "main dining": ["Window view", "Center of the dining room", "Quiet corner", "Near the open kitchen", "Booth seating"],
    "patio": ["Garden-view patio", "Covered patio", "String-lit outdoor seating", "Street-side patio view"],
    "bar": ["Bar-side seating", "High-top near the bar", "Bar view of the open kitchen"],
}
MODIFIER_POOL = [("Extra cheese", 1.50), ("No onions", 0.0), ("Add avocado", 2.00),
                 ("Spicy", 0.0), ("On the side", 0.0), ("Extra sauce", 0.75), ("No cilantro", 0.0)]

random_price_sensitivity = ["low", "medium", "medium", "high", "high"]


def rand_ts(days_back_max=60, hour_lo=7, hour_hi=22):
    delta = timedelta(days=random.randint(0, days_back_max),
                       hours=random.randint(hour_lo, hour_hi),
                       minutes=random.randint(0, 59))
    return NOW - delta


def rand_time(lo_h, hi_h):
    return time(random.randint(lo_h, hi_h), random.choice([0, 15, 30, 45]))


TABLES = {}  # table_name -> list[dict], filled in as we go

# ================================================================
# 1. Lookup tables
# ================================================================
dietary_tags = [{"dietary_tag_id": i + 1, "name": n, "description": f"{n} diners"} for i, n in enumerate(DIETARY_TAG_NAMES)]
allergens = [{"allergen_id": i + 1, "name": n, "severity_note": "varies by diner"} for i, n in enumerate(ALLERGEN_NAMES)]
TABLES["dietary_tags"] = dietary_tags
TABLES["allergens"] = allergens

# ================================================================
# 2. Users
# ================================================================
users = []
for uid in range(1, 301):
    users.append({
        "user_id": uid,
        "full_name": f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}",
        "email": f"diner{uid}@example.com",
        "phone": f"312-555-{random.randint(1000, 9999)}",
        "password_hash": f"hash_{random.randint(10**9, 10**10)}",
        "date_of_birth": (date(1970, 1, 1) + timedelta(days=random.randint(0, 18000))).isoformat(),
        "home_neighborhood": random.choice(NEIGHBORHOODS),
        "price_sensitivity": random.choice(random_price_sensitivity),
        "favorite_cuisine": random.choice(CUISINES),
        "loyalty_points": random.randint(0, 2000),
        "loyalty_tier": random.choices(["none", "silver", "gold", "platinum"], weights=[0.5, 0.3, 0.15, 0.05])[0],
        "referral_code": f"REF{uid:04d}",
        "referred_by_user_id": random.randint(1, uid - 1) if uid > 1 and random.random() < 0.15 else None,
        "marketing_opt_in": random.random() < 0.7,
        "push_notifications_on": random.random() < 0.8,
        "default_payment_token": f"tok_{random.randint(100000, 999999)}",
        "is_active": True,
        "last_login_at": rand_ts(days_back_max=14).isoformat(),
        "created_at": (NOW - timedelta(days=random.randint(1, 300))).isoformat(),
        "updated_at": NOW.isoformat(),
    })
TABLES["users"] = users

user_dietary_tags = []
for u in users:
    if random.random() < 0.4:
        for tag in random.sample(dietary_tags, k=random.randint(1, 2)):
            user_dietary_tags.append({"user_id": u["user_id"], "dietary_tag_id": tag["dietary_tag_id"]})
TABLES["user_dietary_tags"] = user_dietary_tags

# ================================================================
# 3. Restaurants
# ================================================================
restaurants = []
for rid in range(1, 16):
    cuisine = random.choice(CUISINES)
    restaurants.append({
        "restaurant_id": rid,
        "name": f"{cuisine} {random.choice(NAME_WORDS)}",
        "description": random.choice(RESTAURANT_BLURB_TEMPLATES).format(cuisine_lower=cuisine.lower()),
        "cuisine_type": cuisine,
        "price_tier": random.choice(PRICE_TIERS),
        "address_line1": f"{random.randint(100, 4999)} N Main St",
        "neighborhood": random.choice(NEIGHBORHOODS),
        "city": "Chicago",
        "state": "IL",
        "zip_code": f"606{random.randint(10, 99)}",
        "latitude": round(41.85 + random.uniform(-0.1, 0.1), 6),
        "longitude": round(-87.65 + random.uniform(-0.1, 0.1), 6),
        "phone": f"312-555-{random.randint(1000, 9999)}",
        "website_url": f"https://example.com/restaurant{rid}",
        "seats_total": random.randint(24, 90),
        "avg_prep_time_minutes": random.randint(15, 30),
        "pos_provider": random.choice(POS_PROVIDERS),
        "health_inspection_score": round(random.uniform(82, 100), 1),
        "health_inspection_date": (NOW - timedelta(days=random.randint(30, 300))).date().isoformat(),
        "avg_rating": round(random.uniform(3.4, 4.9), 1),
        "total_reviews": 0,  # filled in after reviews are generated
        "subscription_tier": random.choices(["free", "growth", "pro"], weights=[0.7, 0.2, 0.1])[0],
        "onboarded_at": (NOW - timedelta(days=random.randint(60, 400))).isoformat(),
        "is_active": True,
        "owner_contact_email": f"owner{rid}@restaurant.example.com",
        "created_at": (NOW - timedelta(days=random.randint(60, 400))).isoformat(),
        "updated_at": NOW.isoformat(),
    })
TABLES["restaurants"] = restaurants

restaurant_hours = []
hid = 1
for r in restaurants:
    for d in DAYS:
        restaurant_hours.append({
            "hours_id": hid, "restaurant_id": r["restaurant_id"], "day_of_week": d,
            "open_time": "11:00:00", "close_time": "22:00:00" if d not in ("Fri", "Sat") else "23:30:00",
            "is_closed": False,
        })
        hid += 1
TABLES["restaurant_hours"] = restaurant_hours

restaurant_tables = []
tid = 1
tables_by_restaurant = {}
for r in restaurants:
    n_tables = max(4, r["seats_total"] // 4)
    tlist = []
    for _ in range(n_tables):
        zone = random.choice(["main dining", "patio", "bar", "main dining"])
        row = {
            "table_id": tid, "restaurant_id": r["restaurant_id"],
            "table_number": f"T{tid:03d}", "capacity": random.choice([2, 2, 4, 4, 6, 8]),
            "location_zone": zone, "seating_feature": random.choice(SEATING_FEATURES[zone]),
            "status": "available", "updated_at": NOW.isoformat(),
        }
        restaurant_tables.append(row)
        tlist.append(row)
        tid += 1
    tables_by_restaurant[r["restaurant_id"]] = tlist
TABLES["restaurant_tables"] = restaurant_tables

# ================================================================
# 4. Staff & shifts
# ================================================================
restaurant_staff = []
sid = 1
staff_by_restaurant = {}
for r in restaurants:
    n_staff = random.randint(8, 14)
    slist = []
    for _ in range(n_staff):
        row = {
            "staff_id": sid, "restaurant_id": r["restaurant_id"],
            "full_name": f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}",
            "role": random.choice(STAFF_ROLES),
            "hourly_wage": round(random.uniform(14, 32), 2),
            "hire_date": (NOW - timedelta(days=random.randint(30, 900))).date().isoformat(),
            "is_active": True,
        }
        restaurant_staff.append(row)
        slist.append(row)
        sid += 1
    staff_by_restaurant[r["restaurant_id"]] = slist
TABLES["restaurant_staff"] = restaurant_staff

shifts = []
shift_id = 1
shift_counts = {}  # (restaurant_id, shift_date, shift_block) -> count, used later for staffing_forecast.actual_staff_count
for r in restaurants:
    staff_pool = staff_by_restaurant[r["restaurant_id"]]
    for day_offset in range(30):
        shift_date = (NOW - timedelta(days=day_offset)).date()
        for block in SHIFT_BLOCKS:
            n_on_shift = random.randint(2, min(6, len(staff_pool)))
            on_shift = random.sample(staff_pool, k=n_on_shift)
            for st in on_shift:
                start_h, end_h = {"breakfast": (7, 11), "lunch": (11, 15),
                                   "dinner": (17, 22), "late_night": (22, 2)}[block]
                shifts.append({
                    "shift_id": shift_id, "restaurant_id": r["restaurant_id"], "staff_id": st["staff_id"],
                    "shift_date": shift_date.isoformat(), "shift_block": block,
                    "start_time": rand_time(start_h, start_h).isoformat(),
                    "end_time": rand_time(end_h if end_h > start_h else 23, end_h if end_h > start_h else 23).isoformat(),
                    "role": st["role"], "was_scheduled_by_forecast": random.random() < 0.6,
                })
                shift_id += 1
            shift_counts[(r["restaurant_id"], shift_date.isoformat(), block)] = n_on_shift
TABLES["shifts"] = shifts

# ================================================================
# 5. Menu
# ================================================================
menu_categories = []
cat_id = 1
categories_by_restaurant = {}
for r in restaurants:
    clist = []
    for order, cname in enumerate(CATEGORY_NAMES):
        row = {"category_id": cat_id, "restaurant_id": r["restaurant_id"], "name": cname, "display_order": order + 1}
        menu_categories.append(row)
        clist.append(row)
        cat_id += 1
    categories_by_restaurant[r["restaurant_id"]] = clist
TABLES["menu_categories"] = menu_categories

menu_items = []
item_id = 1
menu_by_restaurant = {}
for r in restaurants:
    ilist = []
    for cat in categories_by_restaurant[r["restaurant_id"]]:
        # Use this restaurant's own cuisine's dish pool so a Mexican restaurant
        # can't end up serving Butter Chicken. Falls back to the old generic
        # pool only if a cuisine has no entry for this category.
        pool = CUISINE_MENU.get(r["cuisine_type"], {}).get(cat["name"]) or MENU_ITEM_NAMES[cat["name"]]
        n_items = min(random.randint(2, 3), len(pool))
        for dish_name in random.sample(pool, k=n_items):  # sample, not choice — avoids repeating a dish on one menu
            price = round(random.uniform(6, 42), 2)
            row = {
                "item_id": item_id, "restaurant_id": r["restaurant_id"], "category_id": cat["category_id"],
                "name": dish_name,
                "description": DISH_DESCRIPTIONS.get(dish_name, "Made fresh to order."),
                "price": price,
                "discount_price": round(price * 0.85, 2) if random.random() < 0.1 else None,
                "calories": random.randint(150, 950),
                "spice_level": random.randint(0, 3),
                "is_vegetarian": random.random() < 0.3,
                "is_vegan": random.random() < 0.15,
                "is_gluten_free": random.random() < 0.2,
                "prep_time_minutes": random.randint(5, 25),
                "popularity_score": 0,  # filled in after interactions
                "is_available": True,
                "image_url": f"https://example.com/img/item{item_id}.jpg",
                "created_at": (NOW - timedelta(days=random.randint(30, 300))).isoformat(),
            }
            # Real diet flags and spice level (synthetic_data/dish_facts.py). The
            # random draws above still run so the rest of the data is unchanged.
            if dish_name in DISH_FACTS:
                _, veg, vegan, gf, spice = DISH_FACTS[dish_name]
                row.update(is_vegetarian=bool(veg), is_vegan=bool(vegan), is_gluten_free=bool(gf), spice_level=spice)
            menu_items.append(row)
            ilist.append(row)
            item_id += 1
    menu_by_restaurant[r["restaurant_id"]] = ilist
TABLES["menu_items"] = menu_items

menu_item_allergens = []
allergen_id_by_name = {a["name"]: a["allergen_id"] for a in allergens}
for mi in menu_items:
    drawn = random.sample(allergens, k=random.randint(1, 2)) if random.random() < 0.5 else []
    if mi["name"] in DISH_FACTS:  # real allergens; the draw above keeps the random sequence unchanged
        drawn = [{"allergen_id": allergen_id_by_name[n]} for n in DISH_FACTS[mi["name"]][0]]
    for a in drawn:
        menu_item_allergens.append({"item_id": mi["item_id"], "allergen_id": a["allergen_id"]})
TABLES["menu_item_allergens"] = menu_item_allergens

item_modifiers = []
mod_id = 1
modifiers_by_item = {}
for mi in menu_items:
    mods = random.sample(MODIFIER_POOL, k=random.randint(2, 4))
    mlist = []
    for name, delta in mods:
        row = {"modifier_id": mod_id, "item_id": mi["item_id"], "name": name,
               "price_delta": delta, "is_default": False}
        item_modifiers.append(row)
        mlist.append(row)
        mod_id += 1
    modifiers_by_item[mi["item_id"]] = mlist
TABLES["item_modifiers"] = item_modifiers

user_favorites = []
fav_id = 1
for u in users:
    if random.random() < 0.3:
        r = random.choice(restaurants)
        user_favorites.append({"favorite_id": fav_id, "user_id": u["user_id"], "restaurant_id": r["restaurant_id"],
                                "item_id": None, "favorite_type": "restaurant", "created_at": rand_ts().isoformat()})
        fav_id += 1
    if random.random() < 0.2:
        mi = random.choice(menu_items)
        user_favorites.append({"favorite_id": fav_id, "user_id": u["user_id"], "restaurant_id": None,
                                "item_id": mi["item_id"], "favorite_type": "dish", "created_at": rand_ts().isoformat()})
        fav_id += 1
TABLES["user_favorites"] = user_favorites

# ================================================================
# 6. Dining groups
# ================================================================
dining_groups = []
group_members = []
gid = 1
for _ in range(60):
    member_ids = random.sample(range(1, 301), k=random.randint(2, 5))
    chosen = random.choice(restaurants)["restaurant_id"]
    dining_groups.append({
        "group_id": gid, "group_name": f"Group {gid}", "created_by_user_id": member_ids[0],
        "chosen_restaurant_id": chosen, "status": "decided",
        "voting_deadline": rand_ts().isoformat(), "created_at": rand_ts().isoformat(),
    })
    for uid in member_ids:
        group_members.append({"group_id": gid, "user_id": uid,
                               "voted_restaurant_id": random.choice(restaurants)["restaurant_id"],
                               "joined_at": rand_ts().isoformat()})
    gid += 1
TABLES["dining_groups"] = dining_groups
TABLES["group_members"] = group_members

# ================================================================
# 7. Reservations
# ================================================================
reservations = []
res_id = 1
for _ in range(500):
    r = random.choice(restaurants)
    ts = rand_ts()
    status = random.choices(["confirmed", "seated", "cancelled", "no_show"], weights=[0.15, 0.7, 0.1, 0.05])[0]
    table_choice = random.choice(tables_by_restaurant[r["restaurant_id"]])
    reservations.append({
        "reservation_id": res_id, "user_id": random.randint(1, 300), "restaurant_id": r["restaurant_id"],
        "group_id": random.choice(dining_groups)["group_id"] if random.random() < 0.3 else None,
        "table_id": table_choice["table_id"] if status == "seated" else None,
        "party_size": random.randint(1, 6), "reservation_time": ts.isoformat(),
        "seating_preference": random.choice(["any", "indoor", "outdoor", "bar"]),
        "special_requests": random.choice([None, None, "High chair needed", "Anniversary, quiet table please", "Wheelchair access"]),
        "status": status,
        "checked_in_at": (ts + timedelta(minutes=random.randint(0, 10))).isoformat() if status == "seated" else None,
        "cancelled_at": ts.isoformat() if status == "cancelled" else None,
        "cancellation_reason": random.choice(["Change of plans", "Found another spot", None]) if status == "cancelled" else None,
        "source": random.choices(["app", "phone", "walk_in"], weights=[0.8, 0.1, 0.1])[0],
        "created_at": (ts - timedelta(hours=random.randint(1, 48))).isoformat(),
    })
    res_id += 1
TABLES["reservations"] = reservations

# ================================================================
# 8. Promotions
# ================================================================
promotions = []
for i in range(1, 13):
    is_platform = i <= 4
    promotions.append({
        "promo_id": i, "code": f"CHI{2026}{i:02d}",
        "restaurant_id": None if is_platform else random.choice(restaurants)["restaurant_id"],
        "discount_type": random.choice(["percent", "fixed_amount", "free_item"]),
        "discount_value": round(random.uniform(5, 20), 2),
        "valid_from": (NOW - timedelta(days=60)).date().isoformat(),
        "valid_to": (NOW + timedelta(days=60)).date().isoformat(),
        "max_uses": random.choice([100, 250, 500]),
        "times_used": random.randint(0, 80),
        "is_active": True,
    })
TABLES["promotions"] = promotions

# ================================================================
# 9. Orders, order items, payments
# ================================================================
orders, order_items, order_item_modifiers, payments = [], [], [], []
oi_id, order_id, oim_row, pay_id = 1, 1, 1, 1

for res in reservations:
    if res["status"] != "seated":
        continue
    order_time = datetime.fromisoformat(res["reservation_time"]) + timedelta(minutes=random.randint(5, 20))
    r_id = res["restaurant_id"]
    items_for_order = random.sample(menu_by_restaurant[r_id],
                                     k=min(random.randint(1, 4), len(menu_by_restaurant[r_id])))
    complexity = len(items_for_order)
    prep_minutes = 8 + complexity * random.randint(3, 7) + random.randint(-2, 10)
    ready_time = order_time + timedelta(minutes=max(prep_minutes, 5))
    served_time = ready_time + timedelta(minutes=random.randint(1, 6))
    confirmed_time = order_time + timedelta(minutes=random.randint(1, 4))

    subtotal = 0.0
    line_items = []
    for mi in items_for_order:
        qty = random.randint(1, 2)
        eff_price = mi["discount_price"] or mi["price"]
        line = {
            "order_item_id": oi_id, "order_id": order_id, "item_id": mi["item_id"],
            "quantity": qty, "unit_price": eff_price,
            "special_instructions": random.choice([None, None, "Well done", "On the side", "Extra spicy"]),
            "course": {"Appetizers": "appetizer", "Entrees": "main", "Desserts": "dessert", "Drinks": "drink"}
                      .get(next((c["name"] for c in categories_by_restaurant[r_id] if c["category_id"] == mi["category_id"]), "main"), "main"),
            "status": "served",
        }
        order_items.append(line)
        line_items.append(line)
        subtotal += qty * eff_price
        mods_available = modifiers_by_item.get(mi["item_id"], [])
        if mods_available and random.random() < 0.4:
            for mod in random.sample(mods_available, k=1):
                order_item_modifiers.append({"order_item_id": oi_id, "modifier_id": mod["modifier_id"]})
        oi_id += 1

    promo = random.choice(promotions) if random.random() < 0.2 else None
    discount = 0.0
    if promo:
        if promo["discount_type"] == "percent":
            discount = round(subtotal * (promo["discount_value"] / 100), 2)
        elif promo["discount_type"] == "fixed_amount":
            discount = min(promo["discount_value"], subtotal)
    tax = round(subtotal * 0.1025, 2)
    service_fee = round(subtotal * 0.02, 2)
    total = round(subtotal + tax + service_fee - discount, 2)

    orders.append({
        "order_id": order_id, "reservation_id": res["reservation_id"], "user_id": res["user_id"],
        "restaurant_id": r_id, "order_type": "dine_in",
        "order_time": order_time.isoformat(), "confirmed_time": confirmed_time.isoformat(),
        "ready_time": ready_time.isoformat(), "served_time": served_time.isoformat(),
        "status": "paid", "special_instructions": None,
        "subtotal_amount": round(subtotal, 2), "tax_amount": tax, "service_fee": service_fee,
        "discount_amount": discount, "total_amount": total,
        "applied_promo_id": promo["promo_id"] if promo else None,
        "cancelled_at": None, "cancellation_reason": None,
    })

    tip_pct = random.choice([0.15, 0.18, 0.20, 0.22])
    payments.append({
        "payment_id": pay_id, "order_id": order_id,
        "payment_method": random.choices(["card", "apple_pay", "google_pay"], weights=[0.6, 0.25, 0.15])[0],
        "payment_token": f"tok_{random.randint(100000, 999999)}",
        "amount": total, "tip_amount": round(total * tip_pct, 2),
        "split_type": random.choices(["single", "even_split", "by_item"], weights=[0.6, 0.3, 0.1])[0],
        "split_count": random.randint(1, 4),
        "status": "completed", "refund_amount": 0, "refund_reason": None,
        "processor_fee": round(total * 0.029 + 0.30, 2),
        "paid_at": served_time.isoformat(),
    })
    pay_id += 1
    order_id += 1

TABLES["orders"] = orders
TABLES["order_items"] = order_items
TABLES["order_item_modifiers"] = order_item_modifiers
TABLES["payments"] = payments

# ================================================================
# 10. Interactions & reviews
# ================================================================
interactions = []
int_id = 1
item_interaction_counts = {}
for _ in range(4000):
    uid = random.randint(1, 300)
    r = random.choice(restaurants)
    items = menu_by_restaurant.get(r["restaurant_id"], [])
    mi = random.choice(items) if items and random.random() < 0.85 else None
    itype = random.choice(["view", "view", "click", "click", "favorite", "reorder", "share"])
    interactions.append({
        "interaction_id": int_id, "user_id": uid, "restaurant_id": r["restaurant_id"],
        "item_id": mi["item_id"] if mi else None, "session_id": f"sess_{random.randint(1, 5000)}",
        "device_type": random.choice(DEVICE_TYPES), "interaction_type": itype,
        "source_screen": random.choice(["menu", "search", "group_vote", "recommendation"]),
        "occurred_at": rand_ts().isoformat(),
    })
    if mi:
        item_interaction_counts[mi["item_id"]] = item_interaction_counts.get(mi["item_id"], 0) + 1
    int_id += 1
TABLES["interactions"] = interactions

# backfill popularity_score on menu_items from interaction counts
for mi in menu_items:
    mi["popularity_score"] = round(item_interaction_counts.get(mi["item_id"], 0) / 10.0, 2)

reviews = []
rev_id = 1
reviewed_orders = random.sample(orders, k=int(len(orders) * 0.4)) if orders else []
restaurant_rating_sums = {}
for o in reviewed_orders:
    overall = random.choices([3, 4, 5, 2, 1], weights=[0.2, 0.4, 0.25, 0.1, 0.05])[0]
    reviews.append({
        "review_id": rev_id, "user_id": o["user_id"], "restaurant_id": o["restaurant_id"], "order_id": o["order_id"],
        "overall_rating": overall,
        "food_rating": max(1, min(5, overall + random.choice([-1, 0, 0, 1]))),
        "service_rating": max(1, min(5, overall + random.choice([-1, 0, 0, 1]))),
        "ambiance_rating": max(1, min(5, overall + random.choice([-1, 0, 0, 1]))),
        "review_text": random.choice([
            "Great food, will come back.", "Service was a bit slow but food was good.",
            "Loved the app for splitting the bill!", "Menu had solid allergy info.",
            "Food came out fast, nice experience.", "Average experience, nothing special.",
        ]),
        "restaurant_response": random.choice([None, None, "Thanks for the feedback!"]),
        "restaurant_response_at": None,
        "helpful_votes": random.randint(0, 25),
        "is_flagged": False,
        "created_at": (datetime.fromisoformat(o["served_time"]) + timedelta(hours=random.randint(1, 72))).isoformat(),
    })
    restaurant_rating_sums.setdefault(o["restaurant_id"], []).append(overall)
    rev_id += 1
TABLES["reviews"] = reviews

# backfill restaurants.avg_rating / total_reviews from actual reviews
for r in restaurants:
    ratings = restaurant_rating_sums.get(r["restaurant_id"], [])
    if ratings:
        r["avg_rating"] = round(sum(ratings) / len(ratings), 1)
        r["total_reviews"] = len(ratings)

# ================================================================
# 11. Staffing forecast (ties back to shifts for actual_staff_count)
# ================================================================
staffing_forecast = []
sf_id = 1
for r in restaurants:
    for day_offset in range(30):
        shift_date = (NOW - timedelta(days=day_offset)).date()
        is_weekend = shift_date.weekday() >= 5
        for block in SHIFT_BLOCKS:
            base = {"breakfast": 15, "lunch": 40, "dinner": 55, "late_night": 12}[block]
            if is_weekend:
                base = int(base * 1.3)
            actual = max(0, int(random.gauss(base, base * 0.25)))
            predicted = max(0, int(actual + random.gauss(0, base * 0.12)))
            actual_staff = shift_counts.get((r["restaurant_id"], shift_date.isoformat(), block), max(1, round(actual / 12)))
            staffing_forecast.append({
                "forecast_id": sf_id, "restaurant_id": r["restaurant_id"],
                "shift_date": shift_date.isoformat(), "shift_block": block,
                "predicted_covers": predicted, "actual_covers": actual,
                "recommended_staff_count": max(1, round(predicted / 12)),
                "actual_staff_count": actual_staff,
                "confidence_score": round(random.uniform(0.65, 0.97), 3),
                "model_version": "v0.1-synthetic",
                "weather_condition": random.choice(WEATHER),
                "is_holiday": random.random() < 0.03,
                "local_event_nearby": random.random() < 0.08,
                "labor_cost_estimate": round(actual_staff * 22 * 5, 2),
                "labor_cost_actual": round(actual_staff * 22 * 5 * random.uniform(0.95, 1.1), 2),
                "created_at": NOW.isoformat(),
            })
            sf_id += 1
TABLES["staffing_forecast"] = staffing_forecast

# ================================================================
# Write CSVs
# ================================================================
for table_name, rows in TABLES.items():
    if not rows:
        continue
    path = os.path.join(OUT_DIR, f"{table_name}.csv")
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
print(f"Wrote {len([t for t in TABLES.values() if t])} CSV files to {OUT_DIR}")

# ================================================================
# Write Postgres INSERT script
# ================================================================
def sql_val(v):
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "TRUE" if v else "FALSE"
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


INSERT_ORDER = ["dietary_tags", "allergens", "users", "user_dietary_tags", "restaurants",
                "restaurant_hours", "restaurant_tables", "restaurant_staff", "shifts",
                "menu_categories", "menu_items", "menu_item_allergens", "item_modifiers",
                "user_favorites", "dining_groups", "group_members", "reservations",
                "promotions", "orders", "order_items", "order_item_modifiers", "payments",
                "interactions", "reviews", "staffing_forecast"]

insert_path = os.path.join(OUT_DIR, "synthetic_data_inserts.sql")
with open(insert_path, "w", encoding="utf-8") as f:
    f.write("-- Synthetic data INSERT statements — run after schema.sql\n\n")
    for table_name in INSERT_ORDER:
        rows = TABLES.get(table_name, [])
        if not rows:
            continue
        cols = list(rows[0].keys())
        f.write(f"-- {table_name} ({len(rows)} rows)\n")
        for row in rows:
            vals = ", ".join(sql_val(row[c]) for c in cols)
            f.write(f"INSERT INTO {table_name} ({', '.join(cols)}) VALUES ({vals});\n")
        f.write("\n")
print(f"Wrote INSERT script: {insert_path}")

# ================================================================
# Build local SQLite demo database
# ================================================================
db_path = os.path.join(OUT_DIR, "dining_app.db")
if os.path.exists(db_path):
    os.remove(db_path)
conn = sqlite3.connect(db_path)
cur = conn.cursor()
cur.executescript("""
CREATE TABLE dietary_tags (dietary_tag_id INTEGER PRIMARY KEY, name TEXT, description TEXT);
CREATE TABLE allergens (allergen_id INTEGER PRIMARY KEY, name TEXT, severity_note TEXT);
CREATE TABLE users (
    user_id INTEGER PRIMARY KEY, full_name TEXT, email TEXT, phone TEXT, password_hash TEXT,
    date_of_birth TEXT, home_neighborhood TEXT, price_sensitivity TEXT, favorite_cuisine TEXT,
    loyalty_points INTEGER, loyalty_tier TEXT, referral_code TEXT, referred_by_user_id INTEGER,
    marketing_opt_in INTEGER, push_notifications_on INTEGER, default_payment_token TEXT,
    is_active INTEGER, last_login_at TEXT, created_at TEXT, updated_at TEXT
);
CREATE TABLE user_dietary_tags (user_id INTEGER, dietary_tag_id INTEGER);
CREATE TABLE restaurants (
    restaurant_id INTEGER PRIMARY KEY, name TEXT, description TEXT, cuisine_type TEXT, price_tier TEXT,
    address_line1 TEXT, neighborhood TEXT, city TEXT, state TEXT, zip_code TEXT,
    latitude REAL, longitude REAL, phone TEXT, website_url TEXT, seats_total INTEGER,
    avg_prep_time_minutes INTEGER, pos_provider TEXT, health_inspection_score REAL,
    health_inspection_date TEXT, avg_rating REAL, total_reviews INTEGER, subscription_tier TEXT,
    onboarded_at TEXT, is_active INTEGER, owner_contact_email TEXT, created_at TEXT, updated_at TEXT
);
CREATE TABLE restaurant_hours (hours_id INTEGER PRIMARY KEY, restaurant_id INTEGER, day_of_week TEXT,
    open_time TEXT, close_time TEXT, is_closed INTEGER);
CREATE TABLE restaurant_tables (table_id INTEGER PRIMARY KEY, restaurant_id INTEGER, table_number TEXT,
    capacity INTEGER, location_zone TEXT, seating_feature TEXT, status TEXT, updated_at TEXT);
CREATE TABLE restaurant_staff (staff_id INTEGER PRIMARY KEY, restaurant_id INTEGER, full_name TEXT,
    role TEXT, hourly_wage REAL, hire_date TEXT, is_active INTEGER);
CREATE TABLE shifts (shift_id INTEGER PRIMARY KEY, restaurant_id INTEGER, staff_id INTEGER,
    shift_date TEXT, shift_block TEXT, start_time TEXT, end_time TEXT, role TEXT, was_scheduled_by_forecast INTEGER);
CREATE TABLE menu_categories (category_id INTEGER PRIMARY KEY, restaurant_id INTEGER, name TEXT, display_order INTEGER);
CREATE TABLE menu_items (
    item_id INTEGER PRIMARY KEY, restaurant_id INTEGER, category_id INTEGER, name TEXT, description TEXT,
    price REAL, discount_price REAL, calories INTEGER, spice_level INTEGER, is_vegetarian INTEGER,
    is_vegan INTEGER, is_gluten_free INTEGER, prep_time_minutes INTEGER, popularity_score REAL,
    is_available INTEGER, image_url TEXT, created_at TEXT
);
CREATE TABLE menu_item_allergens (item_id INTEGER, allergen_id INTEGER);
CREATE TABLE item_modifiers (modifier_id INTEGER PRIMARY KEY, item_id INTEGER, name TEXT, price_delta REAL, is_default INTEGER);
CREATE TABLE user_favorites (favorite_id INTEGER PRIMARY KEY, user_id INTEGER, restaurant_id INTEGER,
    item_id INTEGER, favorite_type TEXT, created_at TEXT);
CREATE TABLE dining_groups (group_id INTEGER PRIMARY KEY, group_name TEXT, created_by_user_id INTEGER,
    chosen_restaurant_id INTEGER, status TEXT, voting_deadline TEXT, created_at TEXT);
CREATE TABLE group_members (group_id INTEGER, user_id INTEGER, voted_restaurant_id INTEGER, joined_at TEXT);
CREATE TABLE reservations (
    reservation_id INTEGER PRIMARY KEY, user_id INTEGER, restaurant_id INTEGER, group_id INTEGER,
    table_id INTEGER, party_size INTEGER, reservation_time TEXT, seating_preference TEXT,
    special_requests TEXT, status TEXT, checked_in_at TEXT, cancelled_at TEXT,
    cancellation_reason TEXT, source TEXT, created_at TEXT
);
CREATE TABLE promotions (promo_id INTEGER PRIMARY KEY, code TEXT, restaurant_id INTEGER, discount_type TEXT,
    discount_value REAL, valid_from TEXT, valid_to TEXT, max_uses INTEGER, times_used INTEGER, is_active INTEGER);
CREATE TABLE orders (
    order_id INTEGER PRIMARY KEY, reservation_id INTEGER, user_id INTEGER, restaurant_id INTEGER,
    order_type TEXT, order_time TEXT, confirmed_time TEXT, ready_time TEXT, served_time TEXT,
    status TEXT, special_instructions TEXT, subtotal_amount REAL, tax_amount REAL, service_fee REAL,
    discount_amount REAL, total_amount REAL, applied_promo_id INTEGER, cancelled_at TEXT, cancellation_reason TEXT
);
CREATE TABLE order_items (order_item_id INTEGER PRIMARY KEY, order_id INTEGER, item_id INTEGER,
    quantity INTEGER, unit_price REAL, special_instructions TEXT, course TEXT, status TEXT);
CREATE TABLE order_item_modifiers (order_item_id INTEGER, modifier_id INTEGER);
CREATE TABLE payments (
    payment_id INTEGER PRIMARY KEY, order_id INTEGER, payment_method TEXT, payment_token TEXT,
    amount REAL, tip_amount REAL, split_type TEXT, split_count INTEGER, status TEXT,
    refund_amount REAL, refund_reason TEXT, processor_fee REAL, paid_at TEXT
);
CREATE TABLE interactions (interaction_id INTEGER PRIMARY KEY, user_id INTEGER, restaurant_id INTEGER,
    item_id INTEGER, session_id TEXT, device_type TEXT, interaction_type TEXT, source_screen TEXT, occurred_at TEXT);
CREATE TABLE reviews (
    review_id INTEGER PRIMARY KEY, user_id INTEGER, restaurant_id INTEGER, order_id INTEGER,
    overall_rating INTEGER, food_rating INTEGER, service_rating INTEGER, ambiance_rating INTEGER,
    review_text TEXT, restaurant_response TEXT, restaurant_response_at TEXT, helpful_votes INTEGER,
    is_flagged INTEGER, created_at TEXT
);
CREATE TABLE staffing_forecast (
    forecast_id INTEGER PRIMARY KEY, restaurant_id INTEGER, shift_date TEXT, shift_block TEXT,
    predicted_covers INTEGER, actual_covers INTEGER, recommended_staff_count INTEGER, actual_staff_count INTEGER,
    confidence_score REAL, model_version TEXT, weather_condition TEXT, is_holiday INTEGER,
    local_event_nearby INTEGER, labor_cost_estimate REAL, labor_cost_actual REAL, created_at TEXT
);
""")

for table_name in INSERT_ORDER:
    rows = TABLES.get(table_name, [])
    if not rows:
        continue
    cols = list(rows[0].keys())
    placeholders = ", ".join(["?"] * len(cols))
    cur.executemany(
        f"INSERT INTO {table_name} ({', '.join(cols)}) VALUES ({placeholders})",
        [tuple(row[c] for c in cols) for row in rows],
    )
conn.commit()
conn.close()
print(f"Built local demo database: {db_path}")

"""
Fix allergens, diet flags and spice level in an existing dining_app.db using
dish_facts.py, without regenerating anything else (ids, orders and forecasts
stay the same). Run from the repo root:

    python3 synthetic_data/apply_dish_facts.py
    python3 frontend-app/tools/export_snapshot.py
"""
import os
import sqlite3
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dish_facts import DISH_FACTS, modifier_options  # noqa: E402

DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dining_app.db")


def main():
    conn = sqlite3.connect(DB)
    ids = {name: aid for aid, name in conn.execute("SELECT allergen_id, name FROM allergens")}
    items = conn.execute("SELECT item_id, name FROM menu_items").fetchall()
    missing = sorted({n for _, n in items if n not in DISH_FACTS})
    fixed = 0
    for item_id, name in items:
        if name not in DISH_FACTS:
            continue
        allergens, veg, vegan, gf, spice = DISH_FACTS[name]
        conn.execute("DELETE FROM menu_item_allergens WHERE item_id = ?", (item_id,))
        conn.executemany("INSERT INTO menu_item_allergens (item_id, allergen_id) VALUES (?, ?)",
                         [(item_id, ids[a]) for a in allergens])
        conn.execute("UPDATE menu_items SET is_vegetarian = ?, is_vegan = ?, is_gluten_free = ?, spice_level = ? WHERE item_id = ?",
                     (veg, vegan, gf, spice, item_id))
        fixed += 1
    # Customize options by dish type; keep modifier ids so past orders still link.
    rows = conn.execute("""SELECT im.modifier_id, im.item_id, mi.name, mc.name, r.cuisine_type
                           FROM item_modifiers im JOIN menu_items mi ON mi.item_id = im.item_id
                           JOIN menu_categories mc ON mc.category_id = mi.category_id
                           JOIN restaurants r ON r.restaurant_id = mi.restaurant_id
                           ORDER BY im.item_id, im.modifier_id""").fetchall()
    seen = {}
    for mod_id, item_id, dish, category, cuisine in rows:
        opts = modifier_options(dish, category, cuisine)
        k = seen.get(item_id, 0)
        seen[item_id] = k + 1
        name, delta = opts[k % len(opts)]
        conn.execute("UPDATE item_modifiers SET name = ?, price_delta = ? WHERE modifier_id = ?", (name, delta, mod_id))
    conn.commit()
    print(f"Fixed {fixed} of {len(items)} menu items and {len(rows)} customize options.")
    if missing:
        print("No facts for:", ", ".join(missing))


if __name__ == "__main__":
    main()

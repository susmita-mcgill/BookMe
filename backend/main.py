"""
BookMe (In-Restaurant Dining App concept) — lightweight working backend + connected demo frontend

This is deliberately NOT a production backend. It's a real, running API on top
of the synthetic database that demonstrates the one thing the team's
requirements doc says must be shown live: the Food Prep ETA model
(Section 2.1), plus the read paths a real diner app would call.

Scope note: the frontend/ folder is a real, working demo page for this
section (Data Engineer / Solution Architect) — the UX teammate's work is a
separate analytics-layer visualization, not the same transactional diner
flow this page shows. Confirm there's no overlap between this page's
"Restaurant view" tab and her staffing-forecast visualization before
presenting both.

What's real here:
  - A live FastAPI server with working endpoints
  - A real (if simple) ETA prediction function — a transparent, explainable
    heuristic baseline, exactly what the case wants ("does not have to be
    complex, has to be convincing") and exactly the cold-start fallback the
    requirements doc calls for (category-average benchmarks) before real
    kitchen data exists.
  - Real reads/writes against the SQLite demo database.
  - Input validation: unknown restaurants/items 404 cleanly, an order can't
    mix items from a different restaurant, and an empty cart is rejected —
    the basic edge cases an investor or professor might actually try live.
  - A real (if roadmap-only) data feed for the Group Restaurant Recommender:
    /dining-groups/{id}/recommendation-input. Per the team's own build
    priority, the recommender algorithm itself is NOT built — this endpoint
    exposes the candidate data it would consume, which is a different, much
    smaller claim.

What's explicitly NOT here (say this plainly in Q&A if asked):
  - Auth / user sessions
  - Real Toast POS integration (stubbed — see /pos/push-order)
  - Real payment processing (Stripe is not called; payments are recorded only)
  - Rate limiting, PCI-compliant anything
  - The Group Restaurant Recommender's actual scoring/ranking logic (roadmap-only, per plan)

Run:
  pip install fastapi uvicorn --break-system-packages
  cd backend
  uvicorn main:app --reload
  Then open http://127.0.0.1:8000/app/ for the connected demo page (this is
  now the pitch demo surface). http://127.0.0.1:8000/docs remains available
  as a backup/Q&A tool. See API_CONTRACT.md for the full interface spec,
  originally written for a mobile teammate but still an accurate reference
  for this page's own frontend code.
"""

import sqlite3
import os
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "synthetic_data", "dining_app.db")
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend")

app = FastAPI(
    title="BookMe — MVP backend (demo scope)",
    description="Lightweight working API for the BUSA693 pitch. Not production infrastructure.",
    version="0.1.0",
)

# CORS is not strictly required when the frontend is served from this same
# app (see the StaticFiles mount at the bottom of this file), but it's left
# open here so the demo page also works if opened directly as a file or
# served from a different port during testing.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# ================================================================
# Food Prep ETA model — explainable heuristic baseline
# ================================================================
# Cold-start plan (per requirements doc 2.1): brand-new restaurants with no
# order history fall back to category-average prep-time benchmarks until
# 4-6 weeks of real data accumulate. This function *is* that fallback —
# it's the honest MVP version, not a placeholder pretending to be ML.
CATEGORY_BASE_MINUTES = {
    "appetizer": 8, "drink": 3, "dessert": 6, "main": 14,
}


def predict_prep_eta(restaurant_id: int, item_ids: list[int], conn) -> dict:
    """Baseline heuristic ETA model.

    ETA = sum(category base time for each item)
        + complexity adjustment (more items -> some parallelization, but not linear)
        + current kitchen load adjustment (open orders in the last 30 min)

    This is intentionally transparent so it can be explained line by line in
    Q&A, and is designed to be swapped for a trained regression model later
    without changing the API contract.
    """
    cur = conn.cursor()
    placeholders = ",".join("?" * len(item_ids))
    rows = cur.execute(
        f"""SELECT mi.item_id, mi.prep_time_minutes, mc.name as category
            FROM menu_items mi
            LEFT JOIN menu_categories mc ON mc.category_id = mi.category_id
            WHERE mi.item_id IN ({placeholders})""",
        item_ids,
    ).fetchall()

    if not rows:
        raise HTTPException(status_code=404, detail="No matching menu items found")

    base_total = 0.0
    breakdown = []
    for r in rows:
        cat = (r["category"] or "main").lower()
        item_base = r["prep_time_minutes"] or CATEGORY_BASE_MINUTES.get(cat, 12)
        base_total += item_base
        breakdown.append({"item_id": r["item_id"], "category": cat, "base_minutes": item_base})

    # Parallelization: kitchens cook multiple items somewhat in parallel, not serially.
    complexity_factor = 1.0 + 0.15 * max(0, len(rows) - 1)
    adjusted = base_total * (complexity_factor / len(rows)) if rows else base_total

    # Kitchen load: count orders placed at this restaurant in the last 30 minutes
    # as a live proxy for "how busy is the kitchen right now".
    thirty_min_ago = (datetime.utcnow() - timedelta(minutes=30)).isoformat()
    load_row = cur.execute(
        """SELECT COUNT(*) as cnt FROM orders
           WHERE restaurant_id = ? AND order_time >= ?""",
        (restaurant_id, thirty_min_ago),
    ).fetchone()
    open_orders = load_row["cnt"] if load_row else 0
    load_minutes = min(open_orders * 1.5, 15)  # cap the load penalty at 15 min

    total_eta = round(adjusted + load_minutes, 1)

    return {
        "restaurant_id": restaurant_id,
        "predicted_prep_minutes": total_eta,
        "breakdown": {
            "base_minutes_per_item": breakdown,
            "complexity_factor": round(complexity_factor, 2),
            "kitchen_load_orders_last_30min": open_orders,
            "kitchen_load_minutes_added": load_minutes,
        },
        "model": "heuristic-baseline-v0.1 (cold-start fallback per requirements doc 2.1)",
    }


# ================================================================
# Request/response models
# ================================================================
class OrderItemIn(BaseModel):
    item_id: int
    quantity: int = 1


class OrderIn(BaseModel):
    user_id: int
    restaurant_id: int
    items: list[OrderItemIn]


# ================================================================
# Endpoints
# ================================================================

@app.get("/")
def root():
    return {"status": "ok", "docs": "/docs"}


@app.get("/restaurants")
def list_restaurants():
    """List all restaurants — used to populate the demo frontend's selector."""
    conn = get_db()
    rows = conn.execute(
        "SELECT restaurant_id, name, neighborhood, cuisine_type FROM restaurants ORDER BY restaurant_id"
    ).fetchall()
    conn.close()
    return {"restaurants": [dict(r) for r in rows]}


@app.get("/users")
def list_users(limit: int = 20):
    """A small slice of diners, flagged with their dietary tags if any —
    used to populate the demo frontend's diner selector so the dietary
    filter is easy to demonstrate live."""
    conn = get_db()
    rows = conn.execute(
        """SELECT u.user_id, u.full_name,
                  GROUP_CONCAT(dt.name) as dietary_tags
           FROM users u
           LEFT JOIN user_dietary_tags udt ON udt.user_id = u.user_id
           LEFT JOIN dietary_tags dt ON dt.dietary_tag_id = udt.dietary_tag_id
           GROUP BY u.user_id
           ORDER BY (dietary_tags IS NULL), u.user_id
           LIMIT ?""",
        (limit,),
    ).fetchall()
    conn.close()
    return {"users": [dict(r) for r in rows]}


def restaurant_exists(conn, restaurant_id: int) -> bool:
    row = conn.execute("SELECT 1 FROM restaurants WHERE restaurant_id = ?", (restaurant_id,)).fetchone()
    return row is not None


@app.get("/restaurants/{restaurant_id}/menu")
def get_menu(restaurant_id: int, user_id: Optional[int] = None):
    """Menu for a restaurant, automatically filtered by the diner's dietary
    tags and known allergens if user_id is provided — the "set once, applied
    everywhere" requirement from the case."""
    conn = get_db()
    try:
        if not restaurant_exists(conn, restaurant_id):
            raise HTTPException(status_code=404, detail=f"No restaurant with id {restaurant_id}")

        cur = conn.cursor()
        exclude_allergens = set()
        if user_id is not None:
            tag_rows = cur.execute(
                "SELECT dt.name FROM user_dietary_tags udt JOIN dietary_tags dt ON dt.dietary_tag_id = udt.dietary_tag_id WHERE udt.user_id = ?",
                (user_id,),
            ).fetchall()
            # naive mapping: a "nut-free" tag excludes items tagged with the "nuts" allergen, etc.
            for t in tag_rows:
                name = t["name"]
                if name.endswith("-free"):
                    exclude_allergens.add(name.replace("-free", ""))

        items = cur.execute(
            """SELECT mi.item_id, mi.name, mi.description, mi.price, mi.discount_price,
                      mc.name as category, mi.is_vegetarian, mi.is_vegan, mi.is_gluten_free,
                      mi.popularity_score
               FROM menu_items mi
               LEFT JOIN menu_categories mc ON mc.category_id = mi.category_id
               WHERE mi.restaurant_id = ? AND mi.is_available = 1""",
            (restaurant_id,),
        ).fetchall()

        result = []
        for item in items:
            allergen_rows = cur.execute(
                "SELECT a.name FROM menu_item_allergens mia JOIN allergens a ON a.allergen_id = mia.allergen_id WHERE mia.item_id = ?",
                (item["item_id"],),
            ).fetchall()
            allergens = [a["name"] for a in allergen_rows]
            if exclude_allergens.intersection(allergens):
                continue
            result.append({**dict(item), "allergens": allergens})

        return {"restaurant_id": restaurant_id, "filtered_for_user": user_id, "menu": result}
    finally:
        conn.close()


@app.get("/restaurants/{restaurant_id}/tables")
def get_live_seat_availability(restaurant_id: int):
    """Live seat inventory — the case's 'concert-ticketing style' seat availability."""
    conn = get_db()
    try:
        if not restaurant_exists(conn, restaurant_id):
            raise HTTPException(status_code=404, detail=f"No restaurant with id {restaurant_id}")
        rows = conn.execute(
            "SELECT table_id, table_number, capacity, location_zone, status FROM restaurant_tables WHERE restaurant_id = ?",
            (restaurant_id,),
        ).fetchall()
        return {"restaurant_id": restaurant_id, "tables": [dict(r) for r in rows]}
    finally:
        conn.close()


@app.post("/orders")
def place_order(order: OrderIn):
    """Places a real order into the database and returns a live ETA prediction —
    this is the endpoint that ties the model directly into the product flow.

    Validates: the restaurant exists, the cart isn't empty, every item exists,
    and every item actually belongs to the restaurant being ordered from
    (a diner can't accidentally order a dish from a different restaurant)."""
    conn = get_db()
    try:
        if not order.items:
            raise HTTPException(status_code=400, detail="Cart is empty — add at least one item")
        if not restaurant_exists(conn, order.restaurant_id):
            raise HTTPException(status_code=404, detail=f"No restaurant with id {order.restaurant_id}")

        cur = conn.cursor()
        item_ids = [i.item_id for i in order.items]
        placeholders = ",".join("?" * len(item_ids))
        price_rows = cur.execute(
            f"SELECT item_id, restaurant_id, price, discount_price FROM menu_items WHERE item_id IN ({placeholders})",
            item_ids,
        ).fetchall()
        price_map = {r["item_id"]: (r["discount_price"] or r["price"]) for r in price_rows}
        if len(price_map) != len(set(item_ids)):
            missing = set(item_ids) - set(price_map.keys())
            raise HTTPException(status_code=404, detail=f"Unknown item_id(s): {sorted(missing)}")

        wrong_restaurant = [r["item_id"] for r in price_rows if r["restaurant_id"] != order.restaurant_id]
        if wrong_restaurant:
            raise HTTPException(
                status_code=400,
                detail=f"item_id(s) {wrong_restaurant} don't belong to restaurant {order.restaurant_id}",
            )

        subtotal = sum(price_map[i.item_id] * i.quantity for i in order.items)
        tax = round(subtotal * 0.1025, 2)
        total = round(subtotal + tax, 2)
        now = datetime.utcnow().isoformat()

        cur.execute(
            """INSERT INTO orders (user_id, restaurant_id, order_type, order_time, status,
                                    subtotal_amount, tax_amount, service_fee, discount_amount, total_amount)
               VALUES (?, ?, 'dine_in', ?, 'placed', ?, ?, 0, 0, ?)""",
            (order.user_id, order.restaurant_id, now, round(subtotal, 2), tax, total),
        )
        order_id = cur.lastrowid
        for i in order.items:
            cur.execute(
                "INSERT INTO order_items (order_id, item_id, quantity, unit_price, status) VALUES (?, ?, ?, ?, 'pending')",
                (order_id, i.item_id, i.quantity, price_map[i.item_id]),
            )
        conn.commit()

        eta = predict_prep_eta(order.restaurant_id, item_ids, conn)

        return {
            "order_id": order_id,
            "subtotal": round(subtotal, 2), "tax": tax, "total": total,
            "eta": eta,
            "pos_push_status": "stubbed — real Toast API push not implemented in this demo, see /pos/push-order",
        }
    finally:
        conn.close()


@app.get("/orders/{order_id}/eta")
def get_order_eta(order_id: int):
    conn = get_db()
    try:
        order = conn.execute("SELECT restaurant_id FROM orders WHERE order_id = ?", (order_id,)).fetchone()
        if not order:
            raise HTTPException(status_code=404, detail=f"No order with id {order_id}")
        item_ids = [r["item_id"] for r in conn.execute(
            "SELECT item_id FROM order_items WHERE order_id = ?", (order_id,)
        ).fetchall()]
        return predict_prep_eta(order["restaurant_id"], item_ids, conn)
    finally:
        conn.close()


@app.get("/restaurants/{restaurant_id}/staffing-forecast")
def get_staffing_forecast(restaurant_id: int, shift_date: Optional[str] = None):
    """Restaurant-facing output of the same model family — the SaaS-tier value
    prop. shift_date defaults to today (2026-09-22 in the synthetic data)."""
    conn = get_db()
    try:
        if not restaurant_exists(conn, restaurant_id):
            raise HTTPException(status_code=404, detail=f"No restaurant with id {restaurant_id}")
        q = "SELECT * FROM staffing_forecast WHERE restaurant_id = ?"
        params = [restaurant_id]
        if shift_date:
            q += " AND shift_date = ?"
            params.append(shift_date)
        q += " ORDER BY shift_date DESC LIMIT 8"
        rows = conn.execute(q, params).fetchall()
        return {"restaurant_id": restaurant_id, "forecast": [dict(r) for r in rows]}
    finally:
        conn.close()


@app.get("/dining-groups/{group_id}/recommendation-input")
def get_group_recommendation_input(group_id: int):
    """Candidate data for the Group Restaurant Recommender.

    IMPORTANT SCOPE NOTE: per the team's own build-priority decision, the
    Group Restaurant Recommender is a roadmap item, not something built for
    this pitch. This endpoint does NOT rank or recommend anything — it only
    exposes the raw candidate data (each member's preferences and votes)
    that a future scoring model would consume. That's a real, smaller,
    honest claim: "the data pipeline exists" is different from "the
    algorithm exists," and this endpoint is exactly the first one, not the
    second.
    """
    conn = get_db()
    try:
        group = conn.execute(
            "SELECT group_id, group_name, status FROM dining_groups WHERE group_id = ?", (group_id,)
        ).fetchone()
        if not group:
            raise HTTPException(status_code=404, detail=f"No dining group with id {group_id}")

        members = conn.execute(
            """SELECT u.user_id, u.full_name, u.price_sensitivity, u.favorite_cuisine,
                      r.name as voted_restaurant, r.cuisine_type, r.price_tier,
                      GROUP_CONCAT(dt.name) as dietary_tags
               FROM group_members gm
               JOIN users u ON u.user_id = gm.user_id
               LEFT JOIN restaurants r ON r.restaurant_id = gm.voted_restaurant_id
               LEFT JOIN user_dietary_tags udt ON udt.user_id = u.user_id
               LEFT JOIN dietary_tags dt ON dt.dietary_tag_id = udt.dietary_tag_id
               WHERE gm.group_id = ?
               GROUP BY u.user_id""",
            (group_id,),
        ).fetchall()

        return {
            "group": dict(group),
            "candidate_members": [dict(m) for m in members],
            "model_status": "roadmap-only — this endpoint exposes candidate data, not a ranked recommendation",
        }
    finally:
        conn.close()


@app.post("/pos/push-order")
def push_order_to_pos_stub(order_id: int):
    """Explicit stub — NOT a real Toast integration.

    This exists so the gap is visible and named rather than silently absent.
    A real implementation would call Toast's Orders API here. Per the
    requirements doc, confirming Toast's actual API capabilities (menu sync,
    order push, ticket-time data) is this role's job before this stub can be
    replaced with a real call.
    """
    return {
        "order_id": order_id,
        "status": "NOT SENT — stub only",
        "note": "Real Toast POS push requires a confirmed partner/API agreement — flagged caveat, not built for this demo.",
    }


# ================================================================
# Serve the demo web frontend (a real, working page — not a mockup)
# ================================================================
# Mounted last so it never shadows the API routes above. Open
# http://127.0.0.1:8000/app/ once the server is running.
if os.path.isdir(FRONTEND_DIR):
    app.mount("/app", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")

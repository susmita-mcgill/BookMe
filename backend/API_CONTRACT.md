# API Contract — BookMe backend

For the mobile/frontend teammate. This is the interface the diner app would
call. Base URL in this demo: `http://127.0.0.1:8000` (or wherever the API is
deployed). All responses are JSON.

Scope note: this is an MVP demo backend, not production infrastructure — see
`README.md` for exactly what's real vs. stubbed (Toast POS push, payment
charging). Everything listed below is real and tested.

---

## `GET /restaurants`
List all restaurants. Use this to populate a restaurant picker/discovery screen.

**Response**
```json
{ "restaurants": [
  { "restaurant_id": 1, "name": "Indian Corner", "description": "A cozy indian spot with a focus on fresh, seasonal ingredients.", "neighborhood": "Wicker Park", "cuisine_type": "Indian", "price_tier": "$$", "avg_rating": 3.5 }
]}
```

---

## `GET /restaurants/{restaurant_id}/menu?user_id={user_id}`
Menu for a restaurant. `user_id` is optional but **should always be passed
once a diner is logged in** — the dietary/allergen filter only applies when
it's present. This is the "set once, applied everywhere" feature.

**Response**
```json
{ "restaurant_id": 1, "filtered_for_user": 3, "menu": [
  { "item_id": 1, "name": "Bruschetta", "description": "...", "price": 12.5,
    "discount_price": null, "category": "Appetizers",
    "is_vegetarian": false, "is_vegan": false, "is_gluten_free": false,
    "popularity_score": 3.0, "allergens": ["soy"],
    "modifiers": [ { "modifier_id": 3, "name": "Extra cheese", "price_delta": 1.5 } ] }
]}
```
`modifiers` lists every customization option for that dish (e.g. "extra cheese", "no onions"). Pass chosen `modifier_id`s back in `POST /orders` — see below.

**Errors:** `404` if `restaurant_id` doesn't exist.

---

## `GET /restaurants/{restaurant_id}/tables`
Live seat inventory — render as the "concert-ticketing style" availability grid.

**Response**
```json
{ "restaurant_id": 1, "tables": [
  { "table_id": 1, "table_number": "T001", "capacity": 2, "location_zone": "main dining", "seating_feature": "Window view", "status": "available" }
]}
```
`status` is one of `available`, `seated`, `reserved`, `out_of_service`.
**Errors:** `404` if `restaurant_id` doesn't exist.

---

## `POST /orders`
Places an order and returns a live ETA prediction in the same response —
show the ETA immediately after checkout, don't make a second round trip.

**Request**
```json
{ "user_id": 1, "restaurant_id": 1, "payment_method": "apple_pay", "items": [
  { "item_id": 1, "quantity": 2, "modifier_ids": [3] }
]}
```
`payment_method` is optional (defaults to `"card"`) — one of `card`, `apple_pay`, `google_pay`.
`modifier_ids` is optional (defaults to `[]`) — must belong to that specific `item_id` (a `400` is returned otherwise). Each selected modifier's `price_delta` is added to the order total.
```

**Response**
```json
{ "order_id": 355, "subtotal": 25.0, "tax": 2.56, "total": 27.56,
  "eta": {
    "predicted_prep_minutes": 18.0,
    "breakdown": {
      "base_minutes_per_item": [ { "item_id": 1, "category": "appetizers", "base_minutes": 15 } ],
      "complexity_factor": 1.0,
      "kitchen_load_orders_last_30min": 2,
      "kitchen_load_minutes_added": 3.0
    },
    "model": "heuristic-baseline-v0.1 (cold-start fallback per requirements doc 2.1)"
  },
  "payment": {
    "method": "apple_pay",
    "status": "not charged — demo only",
    "note": "In production this step redirects to a real payment page (Stripe) for the selected method."
  },
  "pos_push_status": "stubbed — real Toast API push not implemented in this demo"
}
```
A real `payments` row IS written (method, order, amount) — it's just never actually charged. This is the same honest-stub pattern as POS push.

**Errors:**
- `400` — empty `items` array ("Cart is empty")
- `400` — an `item_id` doesn't belong to `restaurant_id` (mixed-restaurant cart)
- `404` — `restaurant_id` doesn't exist
- `404` — one or more `item_id`s don't exist

Render these as inline cart errors, not a generic failure screen — the
message text is written to be shown to a user as-is.

---

## `GET /orders/{order_id}/eta`
Re-fetch the ETA for an existing order (e.g. to refresh a "your food is
coming" screen). Same `eta` object shape as inside `POST /orders`.
**Errors:** `404` if the order doesn't exist.

---

## `GET /restaurants/{restaurant_id}/staffing-forecast?shift_date=YYYY-MM-DD`
Restaurant-facing only — this is the operator dashboard's data source, not
something a diner sees. `front_of_house_staff`/`kitchen_staff` are computed
from who was actually scheduled (the shifts table), not a guessed split. `shift_date` is optional (defaults to the most
recent 8 shifts).

**Response**
```json
{ "restaurant_id": 1, "forecast": [
  { "forecast_id": 1, "shift_date": "2026-09-22", "shift_block": "dinner",
    "predicted_covers": 49, "actual_covers": 40,
    "recommended_staff_count": 7, "actual_staff_count": 6,
    "front_of_house_staff": 4, "kitchen_staff": 2,
    "weather_condition": "clear", "confidence_score": 0.85 }
]}
```
**Errors:** `404` if `restaurant_id` doesn't exist.

---

## `GET /dining-groups/{group_id}/recommendation-input`
**Roadmap feature — read this before building against it.** The Group
Restaurant Recommender itself is not built (team decision — see requirements
doc). This endpoint only exposes the raw candidate data a future scoring
model would use: each group member's preferences and their individual vote.
There is no ranked "recommended restaurant" field in this response — don't
build UI that implies one exists yet.

**Response**
```json
{ "group": { "group_id": 1, "group_name": "Group 1", "status": "decided" },
  "candidate_members": [
    { "user_id": 86, "full_name": "Chen Silva", "price_sensitivity": "medium",
      "favorite_cuisine": "Vietnamese", "voted_restaurant": "Indian Corner",
      "cuisine_type": "Indian", "price_tier": "$$", "dietary_tags": null }
  ],
  "model_status": "roadmap-only — this endpoint exposes candidate data, not a ranked recommendation"
}
```
**Errors:** `404` if `group_id` doesn't exist.

---

## `POST /pos/push-order?order_id={id}`
**Explicit stub — always returns "NOT SENT."** Included so the interface
shape is agreed on now; wire this up for real once Toast partner API access
is confirmed. Don't build UI that assumes this succeeds.

---

## Not included in this backend (build against something else, or wait)
- Auth / login / sessions — every endpoint above takes a raw `user_id`, no token
- Payment charging — `POST /orders` computes totals but never calls Stripe
- Push notifications
- Reservation creation (only reading seat availability is implemented)

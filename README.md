# BookMe — demo backend

A real, working API for the pitch — deliberately scoped to what's honest to
demo in a few days, not a production backend.

## Run it

```
pip install -r requirements.txt --break-system-packages
uvicorn main:app --reload
```

Then open one of these:

- **http://127.0.0.1:8000/app/** — the actual demo web page (frontend + backend
  connected). Pick a restaurant and a diner, browse the dietary-filtered menu,
  add items, place a real order, and see the live ETA come back. Switch to
  "Restaurant view" for the staffing forecast. **This is the one to show live
  in the pitch** — a real user-facing page talking to a real API, not a
  developer console.
- **http://127.0.0.1:8000/docs** — the auto-generated Swagger UI, useful as a
  backup or for walking through individual endpoints in Q&A.

The frontend lives in `../frontend/` (plain HTML/CSS/JS, no build step) and
is served by this same FastAPI app — one process, no separate server, no
CORS setup needed for the demo itself.

## Endpoints

- `GET /restaurants` — list all restaurants (populates the frontend's selector)
- `GET /users?limit=` — a slice of diners with their dietary tags, for the demo selector
- `GET /restaurants/{id}/menu?user_id=` — dietary/allergen-filtered menu
- `GET /restaurants/{id}/tables` — live seat inventory
- `POST /orders` — places a real order, returns a live ETA prediction
- `GET /orders/{id}/eta` — re-run the ETA model for an existing order
- `GET /restaurants/{id}/staffing-forecast` — the restaurant-facing model output
- `GET /dining-groups/{id}/recommendation-input` — candidate data for the Group Recommender (roadmap-only algorithm; this endpoint exposes data, not a ranking)
- `POST /pos/push-order` — **explicit stub**, does not call Toast

## What's real vs. what's a scoped stand-in (say this plainly if asked)

| Piece | Status |
|---|---|
| Database, schema, live queries | Real |
| Prep-ETA model | Real, explainable heuristic baseline (see docstring in `main.py`) — this **is** the cold-start fallback the requirements doc calls for, not a placeholder pretending to be ML |
| Order placement | Real — writes to the database, returns a computed ETA |
| Toast POS push | Stubbed on purpose — needs a confirmed Toast partner/API agreement first |
| Payments (Stripe) | Not called — order totals are computed and stored, no real charge |
| Auth | None — demo scope only |

## Demo script suggestion (using /app/, the actual web page)

1. Open `/app/`. Pick a diner from the dropdown who has a dietary tag (e.g. "vegan") — point out the menu is already filtered, automatically, before you click anything.
2. Add 2-3 items to the cart and click **Place order** — point out the live ETA card that appears: predicted minutes, item complexity, and current kitchen load, all computed from the real database in that moment.
3. Point at the seat availability grid on the right — live inventory, not a static calendar.
4. Switch to **Restaurant view** — this is the same model family surfacing as the restaurant-facing staffing forecast, the actual SaaS product.
5. If asked what's not real: mention the `POST /pos/push-order` stub and that Stripe isn't actually charged — say it plainly, don't wait to be caught.

## Backup script (using /docs, if the web page has any issue)

1. Show `GET /restaurants/1/menu?user_id=1` — point out the dietary filter working automatically.
2. Show `POST /orders` with 2-3 items — point out the live ETA breakdown in the response.
3. Show `GET /restaurants/1/staffing-forecast` — the restaurant-facing model output.
4. Show `POST /pos/push-order` returning its stub message.

# BookMe — diner + operator prototype

The working app for the pitch: the full diner journey (find a table → live
seats → filtered menu → order with a live ETA → pay & split → verified review)
and the restaurant operator view (tonight's staffing, forecast, reorder plan).

Plain HTML/CSS/JS, no build step. It talks to the real backend in
`../backend` and falls back to a bundled data snapshot when the API isn't
running, so it works anywhere — including opened straight from the file
system.

## Run it

```
cd backend
pip install -r requirements.txt --break-system-packages
uvicorn main:app --reload
```

Then open **http://127.0.0.1:8000/bookme/**

The **Demo** button (top right, outside the phone) switches between the Diner
and Restaurant views, changes which diner is logged in, jumps to any screen,
and resets the demo. The dot next to it says whether the app is on the live
API or the offline snapshot.

Handy URLs:

- `?user=21` — start as a specific diner (user_id from the database)
- `?offline=1` — force the offline snapshot even if the API is up
- `?api=https://…` — point at a deployed API instead of localhost

## What's real

| On screen | Where it comes from |
|---|---|
| Search ("what are you craving?") | `js/query.js` reads a sentence into party size, budget, cuisine, occasion, extra dietary needs and a craving. Keyword matching in the demo; a language model would do this in production |
| Dish results | Every nearby dish that matches the craving and is safe for the whole table, ranked by the dish model's match % |
| Restaurants, addresses, distance | `restaurants` table; distance from the Logan Square Blue Line stop |
| Live seats | `GET /restaurants/{id}/tables`, plus confirmed bookings marked as reserved |
| Menu, prices, dietary filter | `GET /restaurants/{id}/menu?user_id=` — the backend decides what's hidden |
| Dish match % and sub-scores | `data/dish_scores.js` — **placeholder** in the dish model's output format, see below |
| ETA | `POST /orders` writes the order and returns the backend's prep-time model output (`wait_minutes`, `over_25_min`) |
| Tax | 10.25%, same as the backend |
| Tip, split, review | App logic; no payment is charged, no review is written (matches the backend's scope) |
| Operator: covers, staff, confidence | `staffing_forecast` table via `GET /restaurants/{id}/staffing-forecast` |
| Operator: forecast error | Forecast vs actual over all shifts, compared with "same shift last week" |
| Operator: reorder portions | Next 7 shifts' forecast covers × each dish's share of past orders |
| Reserved / walk-in split, stock on hand | Illustrative — labelled as such on screen |

## Swapping in the model outputs

**Dish recommender.** Replace `data/dish_scores.js`. The app expects, per
`"user_id:restaurant_id"`, a list of rows with `item_id, dish, rank, overall,
preference, dietary, budget, nutrition, quality, speed` — the same columns as
the model prints. `overall` is shown as the match %, the rest appear under
"Why this score". Rows with `overall: 0` are treated as hidden for that diner.

**Prep-time / staffing.** Nothing to swap: the app reads the backend's model
live. If the model is retrained, the API contract stays the same.

**Regenerating the snapshot** after the database changes:

```
python3 frontend-app/tools/export_snapshot.py
```

## Checking it end to end

```
python3 frontend-app/tools/walkthrough.py
```

Clicks through every screen in a headless browser (live and offline) and
saves screenshots to `../shots/`. Needs `pip install playwright` and
`playwright install chromium`.

## Photos

Restaurant and dish photos load from Unsplash, so they need internet. If one
doesn't load, a plain tile shows instead. The mapping is in `js/images.js`.

// Model logic used by the screens.
//
// excludedAllergens is a straight port of backend/main.py. prepEta is the
// prep-time rule as the deck describes it (dish baseline, open tickets against
// kitchen capacity, time of day, category-average cold start); live, it takes
// the open-ticket count from the backend. dishScore reads the dish
// recommender's sample output in data/dish_scores.js.
window.Models = (function () {
  // Category averages for the cold start (the database uses plural category names).
  const CATEGORY_BASE_MINUTES = { appetizer: 8, appetizers: 8, drink: 3, drinks: 3, dessert: 6, desserts: 6, main: 14, entree: 14, entrees: 14 };
  const FLAG_FOR_TAG = { "gluten-free": "is_gluten_free", vegan: "is_vegan", vegetarian: "is_vegetarian" };

  function tagsOf(user) {
    return (user.dietary_tags || "").split(",").map((t) => t.trim()).filter(Boolean);
  }

  // Same rule as GET /restaurants/{id}/menu: a "<x>-free" tag excludes items
  // carrying the "<x>" allergen.
  function excludedAllergens(user) {
    return new Set(tagsOf(user).filter((t) => t.endsWith("-free")).map((t) => t.replace("-free", "")));
  }

  // Can this diner order this dish?
  //   blocked  - the backend removed it for this diner (a listed allergen)
  //   caution  - no listed allergen, but the restaurant hasn't marked it as
  //              meeting the diner's diet (e.g. not flagged gluten-free)
  //   ok       - fits
  function dietFit(item, user, allowed) {
    const tags = tagsOf(user);
    if (!allowed.has(item.item_id)) {
      const hit = item.allergens.find((a) => excludedAllergens(user).has(a));
      return { level: "blocked", reason: hit ? `Contains ${hit}` : "Doesn't fit your profile" };
    }
    for (const t of tags) {
      const flag = FLAG_FOR_TAG[t];
      if (flag && !item[flag]) return { level: "caution", reason: `Not confirmed ${t}` };
    }
    return { level: "ok", reason: "" };
  }

  // Dish recommender output. Reads data/dish_scores.js (same columns as the
  // model's output: overall, preference, dietary, budget, nutrition, quality,
  // speed). `overall` is shown as match_percent. If a dish has no row in the
  // file, a simple fallback score keeps the screen working.
  function clamp(n, lo = 1, hi = 100) { return Math.max(lo, Math.min(hi, Math.round(n))); }

  function dishScore(item, user, restaurant, fit) {
    if (fit.level === "blocked") return { overall: 0, rank: null, parts: null };
    const block = (window.BOOKME_DISH_SCORES || {})[`${user.user_id}:${restaurant?.restaurant_id}`];
    const row = block?.find((r) => r.item_id === item.item_id);
    if (row) {
      const { preference, dietary, budget, nutrition, quality, speed } = row;
      return { overall: Math.round(row.overall), rank: row.rank, parts: { preference, dietary, budget, nutrition, quality, speed } };
    }
    // No real model output loaded (see data/dish_scores.js) — an explainable
    // heuristic baseline, same philosophy as the backend's Prep-ETA fallback:
    // each sub-score is a simple, inspectable rule, not a black box, and
    // "overall" is just their average so the two numbers stay consistent.
    const cuisineMatch = restaurant && user.favorite_cuisine === restaurant.cuisine_type;
    const parts = {
      preference: clamp(58 + (cuisineMatch ? 22 : 0) + (item.popularity_score || 0) * 3),
      dietary: fit.level === "caution" ? 55 : 100,
      budget: clamp(100 - (item.price || 15) * 1.8),
      nutrition: clamp(100 - (item.calories || 500) / 12),
      quality: clamp(40 + (item.popularity_score || 0) * 9),
      speed: clamp(100 - (item.prep_time_minutes || 15) * 3),
    };
    const overall = Object.values(parts).reduce((a, b) => a + b, 0) / 6;
    return { overall: clamp(overall, 1, 97), rank: null, parts };
  }
  function dishMatch(item, user, restaurant, fit) { return dishScore(item, user, restaurant, fit).overall; }

  // Prep-time model: the explainable rule from the deck (slide "Prep-Time
  // Model"). Inputs: each dish's baseline minutes, the open tickets against the
  // kitchen's capacity, and the time of day. A dish with no baseline uses its
  // category average (the cold start until 4 to 6 weeks of tickets exist).
  // Live, the open-ticket count comes from POST /orders; offline it is 0.
  function kitchenCapacity(r) { return Math.max(4, Math.round((r?.seats_total || 48) / 8)); }
  function timeOfDay(now = new Date()) {
    const m = now.getHours() * 60 + now.getMinutes();
    if (m >= 17 * 60 + 30 && m < 21 * 60) return { label: "Dinner rush", factor: 1.2 };
    if (m >= 11 * 60 + 30 && m < 13 * 60 + 30) return { label: "Lunch rush", factor: 1.15 };
    return { label: "Off-peak", factor: 1 };
  }
  const r1 = (x) => Math.round(x * 10) / 10;
  function prepEta(items, openTickets = 0, restaurant = null, now = new Date()) {
    const unique = [...new Map(items.map((i) => [i.item_id, i])).values()];
    let base = 0, cold = 0;
    const perItem = unique.map((i) => {
      const cat = (i.category || "main").toLowerCase();
      if (!i.prep_time_minutes) cold++;
      const m = i.prep_time_minutes || CATEGORY_BASE_MINUTES[cat] || 12;
      base += m;
      return { item_id: i.item_id, category: cat, base_minutes: m };
    });
    const n = unique.length || 1;
    const complexity = 1 + 0.15 * Math.max(0, unique.length - 1);
    const baseline = base * (complexity / n);
    const capacity = kitchenCapacity(restaurant);
    const load = Math.min(15, (openTickets / capacity) * 12);
    const tod = timeOfDay(now);
    const todMin = baseline * (tod.factor - 1);
    return {
      predicted_prep_minutes: r1(baseline + load + todMin),
      breakdown: {
        base_minutes_per_item: perItem,
        complexity_factor: Math.round(complexity * 100) / 100,
        baseline_minutes: r1(baseline),
        open_tickets: openTickets,
        kitchen_capacity: capacity,
        load_minutes: r1(load),
        time_of_day: tod.label,
        time_of_day_minutes: r1(todMin),
        cold_start_items: cold,
      },
      model: "prep-time rule v0.2",
    };
  }

  // Fields from the model contract (model-returns.pdf).
  function toContract(eta) {
    const wait_minutes = Math.round(eta.predicted_prep_minutes);
    return { wait_minutes, over_25_min: wait_minutes > 25 };
  }

  // ---------------- Restaurant-side numbers ----------------
  function mae(rows) {
    if (!rows.length) return 0;
    return rows.reduce((s, r) => s + Math.abs(r.predicted_covers - r.actual_covers), 0) / rows.length;
  }

  // Forecast error vs a naive baseline: "same shift, same weekday last week".
  function accuracy(allRows) {
    const key = (d, b) => `${d}|${b}`;
    const byKey = new Map(allRows.map((r) => [key(r.shift_date, r.shift_block), r]));
    let model = 0, naive = 0, n = 0;
    for (const r of allRows) {
      const d = new Date(r.shift_date + "T12:00:00");
      d.setDate(d.getDate() - 7);
      const prev = byKey.get(key(d.toISOString().slice(0, 10), r.shift_block));
      if (!prev) continue;
      model += Math.abs(r.predicted_covers - r.actual_covers);
      naive += Math.abs(prev.actual_covers - r.actual_covers);
      n++;
    }
    return { model: n ? model / n : 0, naive: n ? naive / n : 0, n };
  }

  function coversPerStaff(rows) {
    const c = rows.reduce((s, r) => s + r.predicted_covers, 0);
    const s = rows.reduce((s, r) => s + r.recommended_staff_count, 0);
    return s ? c / s : 0;
  }

  // Shifts where the schedule didn't match the forecast's recommendation.
  function staffingGaps(rows) {
    const over = rows.filter((r) => r.actual_staff_count > r.recommended_staff_count);
    const under = rows.filter((r) => r.actual_staff_count < r.recommended_staff_count);
    const extraStaffShifts = over.reduce((s, r) => s + (r.actual_staff_count - r.recommended_staff_count), 0);
    const shortStaffShifts = under.reduce((s, r) => s + (r.recommended_staff_count - r.actual_staff_count), 0);
    return { over: over.length, under: under.length, extraStaffShifts, shortStaffShifts, total: rows.length };
  }

  return { tagsOf, excludedAllergens, dietFit, dishMatch, dishScore, prepEta, kitchenCapacity, timeOfDay, toContract, mae, accuracy, coversPerStaff, staffingGaps };
})();

// Model logic used by the screens.
//
// prepEta and excludedAllergens are straight ports of backend/main.py so the
// offline snapshot behaves like the live API. dishMatch is a PLACEHOLDER until
// the dish recommender's output (dish_name, match_percent) lands in the repo:
// replace dishMatch with a lookup into that output and nothing else changes.
window.Models = (function () {
  const CATEGORY_BASE_MINUTES = { appetizer: 8, drink: 3, dessert: 6, main: 14 };
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
  function dishScore(item, user, restaurant, fit) {
    if (fit.level === "blocked") return { overall: 0, rank: null, parts: null };
    const block = (window.BOOKME_DISH_SCORES || {})[`${user.user_id}:${restaurant?.restaurant_id}`];
    const row = block?.find((r) => r.item_id === item.item_id);
    if (row) {
      const { preference, dietary, budget, nutrition, quality, speed } = row;
      return { overall: Math.round(row.overall), rank: row.rank, parts: { preference, dietary, budget, nutrition, quality, speed } };
    }
    let score = 52 + (item.popularity_score || 0) * 7;
    if (restaurant && user.favorite_cuisine === restaurant.cuisine_type) score += 8;
    if (fit.level === "caution") score = Math.min(score, 64);
    return { overall: Math.max(1, Math.min(97, Math.round(score))), rank: null, parts: null };
  }
  function dishMatch(item, user, restaurant, fit) { return dishScore(item, user, restaurant, fit).overall; }

  // Port of predict_prep_eta in backend/main.py.
  function prepEta(items, openOrdersLast30Min) {
    const unique = [...new Map(items.map((i) => [i.item_id, i])).values()];
    let base = 0;
    const perItem = unique.map((i) => {
      const cat = (i.category || "main").toLowerCase();
      const m = i.prep_time_minutes || CATEGORY_BASE_MINUTES[cat] || 12;
      base += m;
      return { item_id: i.item_id, category: cat, base_minutes: m };
    });
    const n = unique.length || 1;
    const complexity = 1 + 0.15 * Math.max(0, unique.length - 1);
    const adjusted = base * (complexity / n);
    const load = Math.min(openOrdersLast30Min * 1.5, 15);
    return {
      predicted_prep_minutes: Math.round((adjusted + load) * 10) / 10,
      breakdown: {
        base_minutes_per_item: perItem,
        complexity_factor: Math.round(complexity * 100) / 100,
        kitchen_load_orders_last_30min: openOrdersLast30Min,
        kitchen_load_minutes_added: load,
      },
      model: "heuristic-baseline-v0.1 (same formula as backend, run offline)",
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

  return { tagsOf, excludedAllergens, dietFit, dishMatch, dishScore, prepEta, toContract, mae, accuracy, coversPerStaff, staffingGaps };
})();

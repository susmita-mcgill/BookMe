// Data layer. Calls the live BookMe API (backend/main.py) when it's running,
// otherwise falls back to the exported snapshot in data/snapshot.js.
// Every screen goes through these functions, never through fetch directly.
window.Data = (function () {
  const snap = window.BOOKME_SNAPSHOT;
  const params = new URLSearchParams(location.search);
  const sameOrigin = location.protocol.startsWith("http") && location.port === "8000";
  const API = params.get("api") || (sameOrigin ? location.origin : "http://127.0.0.1:8000");

  let live = false;

  async function get(path, timeoutMs = 4000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(API + path, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      return await res.json();
    } finally {
      clearTimeout(t);
    }
  }

  async function init() {
    if (params.get("offline") === "1") return { live: false, api: API };
    try {
      await get("/restaurants", 1500);
      live = true;
    } catch (e) {
      live = false;
    }
    return { live, api: API };
  }

  // The API's /restaurants returns id, name, neighborhood and cuisine only.
  // Address, coordinates and price tier come from the snapshot catalog.
  // If the API starts returning those fields, the API values win.
  async function restaurants() {
    const catalog = Object.fromEntries(snap.restaurants.map((r) => [r.restaurant_id, r]));
    if (!live) return snap.restaurants;
    const { restaurants } = await get("/restaurants");
    return restaurants.map((r) => ({ ...catalog[r.restaurant_id], ...r }));
  }

  async function users() {
    if (!live) return snap.users;
    const { users } = await get("/users?limit=40");
    return users;
  }

  // Returns every item on the menu, plus the ids the diner is allowed to order.
  // Live: the backend decides (we fetch the menu with and without the diner's
  // user_id and compare). Offline: the same rule the backend uses.
  async function menu(restaurantId, user) {
    const catalogItems = Object.fromEntries((snap.menus[restaurantId] || []).map((i) => [i.item_id, i]));
    if (live) {
      const [all, filtered] = await Promise.all([
        get(`/restaurants/${restaurantId}/menu`),
        get(`/restaurants/${restaurantId}/menu?user_id=${user.user_id}`),
      ]);
      const allowed = new Set(filtered.menu.map((i) => i.item_id));
      const items = all.menu.map((i) => ({ ...catalogItems[i.item_id], ...i }));
      return { items, allowed };
    }
    const items = snap.menus[restaurantId] || [];
    const excluded = Models.excludedAllergens(user);
    const allowed = new Set(items.filter((i) => !i.allergens.some((a) => excluded.has(a))).map((i) => i.item_id));
    return { items, allowed };
  }

  // Live seat inventory. The API reports each table's status; on top of that
  // we mark tables held by confirmed bookings as "reserved" (the API has no
  // reservations endpoint yet, so those come from the snapshot).
  async function tables(restaurantId) {
    let list = snap.tables[restaurantId] || [];
    if (live) list = (await get(`/restaurants/${restaurantId}/tables`)).tables;
    list = list.map((t) => ({ ...t }));
    const byId = Object.fromEntries(list.map((t) => [t.table_id, t]));
    for (const b of snap.reservations?.[restaurantId] || []) {
      let t = byId[b.table_id];
      if (!t || t.status !== "available") {
        t = list.filter((x) => x.status === "available" && x.capacity >= b.party_size).sort((a, c) => a.capacity - c.capacity)[0];
      }
      if (t) t.status = "reserved";
    }
    return list;
  }

  // Live: POST /orders writes the order to the database and returns the ETA
  // from the backend's model. Offline: same formula, run in the browser.
  async function placeOrder(user, restaurantId, cart) {
    const body = {
      user_id: user.user_id,
      restaurant_id: restaurantId,
      items: cart.map((c) => ({ item_id: c.item_id, quantity: c.quantity, modifier_ids: (c.selectedMods || []).map((m) => m.modifier_id) })),
    };
    if (live) {
      const res = await fetch(API + "/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Order failed");
      return json;
    }
    // price() (in app.js) already accounts for selectedMods; safe to reference
    // here since placeOrder only ever runs after app.js has finished loading.
    const subtotal = cart.reduce((s, c) => s + price(c) * c.quantity, 0);
    const tax = Math.round(subtotal * 0.1025 * 100) / 100;
    return {
      order_id: null,
      subtotal: Math.round(subtotal * 100) / 100,
      tax,
      total: Math.round((subtotal + tax) * 100) / 100,
      eta: Models.prepEta(cart, 0),
      pos_push_status: "offline snapshot — order not written",
    };
  }

  // The API returns at most 8 rows per call, filtered by date, so the
  // dashboard asks for each date it needs.
  async function forecast(restaurantId, dates) {
    if (!live) {
      const set = new Set(dates);
      return (snap.forecast[restaurantId] || []).filter((f) => set.has(f.shift_date));
    }
    const results = await Promise.all(
      dates.map((d) => get(`/restaurants/${restaurantId}/staffing-forecast?shift_date=${d}`).then((r) => r.forecast))
    );
    return results.flat();
  }

  function forecastDates(restaurantId) {
    return [...new Set((snap.forecast[restaurantId] || []).map((f) => f.shift_date))].sort();
  }

  function avgWage(restaurantId) {
    return snap.avg_hourly_wage[restaurantId] || 0;
  }

  return { init, restaurants, users, menu, tables, placeOrder, forecast, forecastDates, avgWage, get api() { return API; }, get live() { return live; } };
})();

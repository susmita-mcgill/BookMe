// BookMe prototype: screens, navigation and state.
// Plain JavaScript, no build step. Data comes from js/data.js, model logic from js/models.js.

const BEACHHEAD = ["Logan Square", "Wicker Park", "Bucktown"];
const PIN = { lat: 41.9295, lng: -87.7087, label: "Logan Square" }; // Logan Square Blue Line stop
const SLOTS = ["6:30", "7:00", "7:30", "8:00"];
const CATEGORY_ORDER = ["Appetizers", "Entrees", "Desserts", "Drinks"];
const catSlug = (cat) => cat.toLowerCase().replace(/[^a-z0-9]+/g, "-");
const SHIFT_HOURS = 5; // only used for the illustrative wage figure
const TAX_RATE = 0.1025; // same as backend/main.py

const state = {
  mode: "diner",
  users: [], user: null, friends: [],
  restaurants: [], restaurant: null, tables: [], menu: null,
  party: 3, slot: "7:30", seatZone: null,
  query: { text: "", cuisine: null, budget: "$$", budgetSet: false, occasion: "talk", applied: false, relaxed: false, extraTags: [], parsed: null, editing: false, manual: {} },
  cart: [], order: null, sending: false, error: "", showWhy: new Set(), showCustomize: new Set(), checkedIn: false,
  tipPct: 18, split: "even", assign: {},
  review: { stars: 0, text: "", skip: new Set() },
  // Dish recommender feedback, kept for the session so the next visit shows it:
  // rating moves match %, "Don't suggest" keeps a dish at 0, opened-but-not-added lowers it.
  feedback: {}, openedThisVisit: new Set(),
  owner: { restaurantId: null, tab: "tonight", block: "dinner" },
  history: [], current: null,
};

const screenEl = document.getElementById("screen");
const phoneEl = document.getElementById("phone");

// ---------------------------------------------------------------- helpers
const $ = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content; };
const money = (n) => "$" + (Math.round(n * 100) / 100).toFixed(2);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const firstName = (u) => (u?.full_name || "").split(" ")[0];
const initial = (name) => (name || "?").charAt(0).toUpperCase();
const tierFor = (u) => ({ high: "$", medium: "$$", low: "$$$" }[u?.price_sensitivity] || "$$");
const price = (c) => (c.discount_price || c.price) + (c.selectedMods || []).reduce((s, m) => s + (m.price_delta || 0), 0);

function km(a, b) {
  const R = 6371, rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function photo(url, label, cls) {
  const img = url ? `<img src="${esc(url)}" alt="" loading="lazy" onerror="this.remove()">` : "";
  return `<div class="${cls}"><div class="fallback" aria-hidden="true">${esc(label)}</div>${img}</div>`;
}
function fmtDate(d, opts = { weekday: "short", month: "short", day: "numeric" }) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", opts);
}

const icons = {
  back: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chev: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="m6 3.5 4.5 4.5L6 12.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  check: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  tick: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  info: '<svg width="17" height="17" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7.3" stroke="currentColor" stroke-width="1.6"/><path d="M10 9v4.5M10 6.6v.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  search: '<svg width="18" height="18" viewBox="0 0 20 20" fill="none"><circle cx="9" cy="9" r="5.8" stroke="currentColor" stroke-width="1.8"/><path d="m13.5 13.5 3.5 3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  pin: '<svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M10 18s5.5-5 5.5-9.5a5.5 5.5 0 1 0-11 0C4.5 13 10 18 10 18Z" stroke="currentColor" stroke-width="1.6"/><circle cx="10" cy="8.5" r="2" stroke="currentColor" stroke-width="1.6"/></svg>',
  clock: '<svg width="22" height="22" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7.3" stroke="currentColor" stroke-width="1.6"/><path d="M10 6v4.3l2.8 1.7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  star: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.9L12 3.5Z"/></svg>',
  starOn: '<svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.9L12 3.5Z"/></svg>',
  fork: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M7 3v7a2.5 2.5 0 0 0 5 0V3M9.5 3v18M17 3c-1.7 0-3 2-3 5v3h3v10"/></svg>',
  cal: '<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4.5" width="14" height="12.5" rx="2"/><path d="M3 8.5h14M7 3v3M13 3v3" stroke-linecap="round"/></svg>',
  chart: '<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 17h14M6 14V9M10 14V5M14 14v-3"/></svg>',
  box: '<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="m10 2.5 7 3.5v8l-7 3.5-7-3.5V6l7-3.5ZM3 6l7 3.5L17 6M10 9.5v8"/></svg>',
};

// ---------------------------------------------------------------- navigation
function go(name, { replace = false } = {}) {
  if (!replace && state.current) state.history.push(state.current);
  state.current = name;
  render();
}
function goBack() {
  const prev = state.history.pop();
  if (prev) { state.current = prev; render(true); }
}
function render(back = false, keepScroll = false) {
  const top = keepScroll ? screenEl.querySelector(".scroll")?.scrollTop : 0;
  const screen = SCREENS[state.current];
  const view = document.createElement("section");
  view.className = "view" + (back ? " is-back" : "");
  if (keepScroll) view.style.animation = "none";
  view.append($(screen.html()));
  screenEl.replaceChildren(view);
  view.querySelectorAll("[data-back]").forEach((b) => b.addEventListener("click", goBack));
  screen.bind?.(view);
  if (keepScroll && top) view.querySelector(".scroll").scrollTop = top;
  phoneEl.classList.toggle("is-owner", state.mode === "owner");
  syncDemoPanel();
}
function topbar(title = "BookMe", { back = true } = {}) {
  return `<header class="topbar"><button class="icon-btn" data-back aria-label="Back" ${back ? "" : "disabled"}>${icons.back}</button><h1>${esc(title)}</h1><span></span></header>`;
}

// ---------------------------------------------------------------- derived
const cartCount = () => state.cart.reduce((s, c) => s + c.quantity, 0);
const cartSubtotal = () => state.cart.reduce((s, c) => s + price(c) * c.quantity, 0);
const people = () => [{ name: firstName(state.user), me: true }, ...state.friends.map((f) => ({ name: firstName(f) }))];

const OCCASIONS = [["quick", "Quick bite"], ["talk", "A night to talk"], ["celebrate", "Celebrating"]];
const OCCASION_LABEL = Object.fromEntries(OCCASIONS);
const SUGGESTIONS = ["Spicy food", "Something with rice", "Cheap Italian for 4, one's vegan", "Dessert to share"];

// ---- The table: the diner's profile plus anyone the query adds ("one's vegan").
// The strictest restriction in the group applies (model contract: dietary flags).
function groupTags(extra = state.query.extraTags) {
  return [...new Set([...Models.tagsOf(state.user), ...(extra || [])])];
}
function groupUser(extra) {
  return { ...state.user, dietary_tags: groupTags(extra).join(",") };
}
function allowedFor(items, user) {
  const ex = Models.excludedAllergens(user);
  return new Set(items.filter((i) => !i.allergens.some((a) => ex.has(a))).map((i) => i.item_id));
}
function safeDishCount(r, user = groupUser()) {
  const items = BOOKME_SNAPSHOT.menus[r.restaurant_id] || [];
  return allowedFor(items, user).size;
}

// ---- Dish recommender feedback (slide "Dish Recommender": what it learns from).
const fbKey = (id) => `${state.user.user_id}:${id}`;
function withFeedback(itemId, score, fit) {
  const fb = state.feedback[fbKey(itemId)];
  if (!fb || fit.level === "blocked") return { ...score, notes: [] };
  if (fb.dont) return { ...score, overall: 0, dont: true, notes: [["You asked not to suggest this", "0"]] };
  let o = score.overall;
  const notes = [];
  if (fb.rating) { o += fb.rating; notes.push([`You rated your last visit ${fb.stars}★`, `${fb.rating > 0 ? "+" : "−"}${Math.abs(fb.rating)}`]); }
  if (fb.opened) { o -= 3 * fb.opened; notes.push(["Opened, not added last time", `−${3 * fb.opened}`]); }
  return { ...score, overall: Math.max(1, Math.min(99, o)), notes };
}
// Budget feeds the dish recommender (dish price per person); restaurant-level
// budget waits for Phase 2 with the group restaurant recommender.
const BUDGET_CAP = { $: 15, $$: 30, $$$: Infinity };

// ---- The query. The text is parsed into constraints + a craving; anything the
// diner set by hand in "Your table" wins over what the text implies.
function allCuisines() { return [...new Set(state.restaurants.map((r) => r.cuisine_type))]; }
function effectiveQuery() {
  const q = state.query;
  const p = Query.parse(q.text, allCuisines());
  const pick = (f, parsedVal, base) => (q.manual[f] ? base : parsedVal ?? base);
  return {
    text: q.text,
    parsed: p,
    cuisine: pick("cuisine", p.cuisine, q.cuisine),
    budget: pick("budget", p.budget, q.budget),
    budgetSet: !!(q.manual.budget || p.budget),
    occasion: pick("occasion", p.occasion, q.occasion),
    party: pick("party", p.party, state.party),
    tags: p.tags,
    applied: true,
  };
}
function committedQuery() {
  const q = state.query;
  return { text: q.text, parsed: q.parsed, cuisine: q.cuisine, budget: q.budget, budgetSet: q.budgetSet, occasion: q.occasion, party: state.party, tags: q.extraTags, applied: q.applied };
}
const hasCraving = (c) => !!c.parsed && (c.parsed.terms.length > 0 || c.parsed.spicy);

// Restaurant list (MVP of the group restaurant recommender, slide "Group
// Restaurant Recommender"): nearby places sorted by distance from the diner's
// pin, and the strictest dietary flag in the group filters the list. No score.
// Budget and occasion join the ranking in Phase 2. The search's cuisine and
// craving narrow which places are shown.
function nearby({ useQuery = true, crit = committedQuery() } = {}) {
  const user = groupUser(useQuery ? crit.tags : []);
  const strict = Models.tagsOf(user).length > 0;
  let list = state.restaurants
    .filter((r) => BEACHHEAD.includes(r.neighborhood))
    .map((r) => ({ ...r, distance_km: r.latitude ? km(PIN, { lat: r.latitude, lng: r.longitude }) : null, safe: safeDishCount(r, user) }));
  if (strict) list = list.filter((r) => r.safe > 0);
  if (useQuery && crit.applied) {
    const text = (crit.text || "").trim().toLowerCase();
    list = list.filter((r) => {
      if (text.length > 3 && r.name.toLowerCase().includes(text)) return true; // searched a restaurant by name
      if (crit.cuisine && r.cuisine_type !== crit.cuisine) return false;
      if (hasCraving(crit)) return dishesAt(r, crit, user).length > 0;
      return true;
    });
  }
  return list.sort((a, b) => (a.distance_km ?? 99) - (b.distance_km ?? 99));
}

// Dishes at one restaurant that match the craving and are safe for the table.
function dishesAt(r, crit, user = groupUser(crit.tags)) {
  const items = BOOKME_SNAPSHOT.menus[r.restaurant_id] || [];
  const allowed = allowedFor(items, user);
  return items.filter((i) => allowed.has(i.item_id) && Query.dishMatches(i, crit.parsed));
}

// Dish results across every restaurant that passes the table's constraints,
// scored by the dish model (match %), best first. Also counts what was hidden.
function dishResults(crit = committedQuery()) {
  if (!hasCraving(crit)) return { dishes: [], hidden: 0 };
  const user = groupUser(crit.tags);
  const ex = Models.excludedAllergens(user);
  const places = nearby({ crit: { ...crit, parsed: { terms: [], spicy: false } } });
  const best = new Map();
  let hidden = 0;
  for (const r of places) {
    const items = BOOKME_SNAPSHOT.menus[r.restaurant_id] || [];
    for (const i of items) {
      if (!Query.dishMatches(i, crit.parsed)) continue;
      if (i.allergens.some((a) => ex.has(a))) { hidden++; continue; }
      if (crit.budgetSet && price(i) > (BUDGET_CAP[crit.budget] ?? Infinity)) continue;
      const fit = Models.dietFit(i, user, allowedFor(items, user));
      const score = withFeedback(i.item_id, Models.dishScore(i, user, r, fit), fit);
      if (score.dont) continue;
      const match = score.overall;
      const key = `${r.restaurant_id}|${i.name}`;
      if (!best.has(key) || best.get(key).match < match) best.set(key, { item: i, r, fit, match });
    }
  }
  return { dishes: [...best.values()].sort((a, b) => b.match - a.match).slice(0, 12), hidden };
}

function tableSummary(c) {
  const tags = groupTags(c.tags);
  return [
    c.party === 1 ? "Just you" : `You + ${c.party - 1}`,
    c.cuisine,
    tags.length ? tags.join(", ") : "no restrictions",
    c.budget,
  ].filter(Boolean).join(" · ");
}
function findLabel(c) {
  if (hasCraving(c)) {
    const n = dishResults(c).dishes.length;
    return n ? `Show ${n} dish${n === 1 ? "" : "es"}` : "No exact match · show closest";
  }
  const n = nearby({ crit: c }).length;
  return n ? `Show ${n} place${n === 1 ? "" : "s"}` : "No exact match · show closest";
}
function understoodChips(p) {
  if (!p.understood.length) return "";
  return `<span class="small" style="font-weight:700">Got it</span>` + p.understood.map((u) => {
    const cls = u.startsWith("+ ") ? "good" : u.startsWith("“") ? "" : "accent";
    return `<span class="pill ${cls}">${esc(u)}</span>`;
  }).join("");
}

async function openRestaurant(r) {
  Object.assign(state, { restaurant: r, cart: [], order: null, error: "", showWhy: new Set(), showCustomize: new Set(), checkedIn: false, openedThisVisit: new Set() });
  const [tables, menu] = await Promise.all([Data.tables(r.restaurant_id), Data.menu(r.restaurant_id, state.user)]);
  state.tables = tables;
  state.menu = menu;
}
// The backend filters for the diner's own profile; anyone the query added to
// the table is filtered here with the same rule.
function scoredMenu() {
  const user = groupUser();
  const ex = Models.excludedAllergens(user);
  const allowed = new Set(state.menu.items.filter((i) => state.menu.allowed.has(i.item_id) && !i.allergens.some((a) => ex.has(a))).map((i) => i.item_id));
  return state.menu.items.map((item) => {
    const base = Models.dietFit(item, user, allowed);
    const score = withFeedback(item.item_id, Models.dishScore(item, user, state.restaurant, base), base);
    const fit = score.dont ? { level: "skipped", reason: "Not suggested, your choice" } : base;
    return { ...item, fit, match: score.overall, rank: score.rank, parts: score.parts, notes: score.notes };
  });
}
function etaPreview(cart) { return Models.toContract(Models.prepEta(cart, 0, state.restaurant)); }

// ================================================================ SCREENS
const SCREENS = {};

// ---------- Search: what the diner is craving, and who's at the table ----------
SCREENS.search = {
  html() {
    const q = state.query;
    const c = effectiveQuery();
    const cuisines = [...new Set(nearby({ useQuery: false }).map((r) => r.cuisine_type))].sort();
    const chip = (on, attr, label) => `<button class="slot ${on ? "is-on" : ""}" ${attr}>${esc(label)}</button>`;
    const tags = groupTags(c.tags);
    return `
      ${topbar("BookMe", { back: false })}
      <div class="scroll">
        <p class="eyebrow">Good evening, ${esc(firstName(state.user))}</p>
        <h2 class="display">What are you<br>craving tonight?</h2>
        <label class="search-box">${icons.search}<input data-q type="search" autocomplete="off" placeholder="Describe what you’re after" value="${esc(q.text)}" aria-label="What are you craving?"></label>
        <div class="understood" data-understood>${understoodChips(c.parsed)}</div>
        ${q.text.trim() ? "" : `<div class="suggest"><span class="small" style="font-weight:700">Try</span>${SUGGESTIONS.map((s) => `<button data-suggest="${esc(s)}">${esc(s)}</button>`).join("")}</div>`}

        <h3 class="h2">Your table</h3>
        <button class="table-sum" data-toggle aria-expanded="${q.editing}"><span data-summary>${esc(tableSummary(c))}</span><span class="edit">${q.editing ? "Done" : "Edit"}</span></button>
        ${q.editing ? `
          <p class="cat-title">Who's coming</p>
          <div class="stepper"><button data-party="-1" aria-label="Fewer">−</button><span class="num">${c.party}</span><button class="fill" data-party="1" aria-label="More">+</button><span class="sub" style="margin-left:6px">${c.party === 1 ? "just you" : `you + ${c.party - 1}`}</span></div>
          <p class="cat-title">Cuisine</p>
          <div class="slots">${chip(!c.cuisine, 'data-cuisine=""', "Anything")}${cuisines.map((x) => chip(c.cuisine === x, `data-cuisine="${esc(x)}"`, x)).join("")}</div>
          <p class="cat-title">Budget per person</p>
          <div class="slots">${["$", "$$", "$$$"].map((b) => chip(c.budget === b, `data-budget="${b}"`, b)).join("")}</div>
          <p class="cat-title">Dietary</p>
          <div class="filter-banner ${tags.length ? "" : "muted"}">${icons.info}<span>${tags.length ? `${esc(tags.join(", "))} · strictest in your group, applied to every menu` : "No restrictions on your profile"}</span></div>`
          : `<p class="small" style="margin-top:8px">Set once from your profile. Mention anything new in the search, like “one's vegan”.</p>`}
      </div>
      <div class="footer"><button class="btn" data-find>${esc(findLabel(c))}</button></div>`;
  },
  bind(v) {
    const q = state.query;
    const input = v.querySelector("[data-q]");
    input.addEventListener("input", () => {
      const hadText = !!q.text.trim();
      q.text = input.value;
      if (hadText !== !!q.text.trim()) { render(false, true); const i = screenEl.querySelector("[data-q]"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); return; }
      const c = effectiveQuery();
      v.querySelector("[data-understood]").innerHTML = understoodChips(c.parsed);
      v.querySelector("[data-summary]").textContent = tableSummary(c);
      v.querySelector("[data-find]").textContent = findLabel(c);
    });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") v.querySelector("[data-find]").click(); });
    v.querySelectorAll("[data-suggest]").forEach((b) => b.addEventListener("click", () => { q.text = b.dataset.suggest; q.manual = {}; render(false, true); }));
    v.querySelector("[data-toggle]").addEventListener("click", () => { q.editing = !q.editing; render(false, true); });
    // A chip the diner taps by hand wins over what the text implies.
    const set = (f, val) => { const c = effectiveQuery(); if (f === "party") state.party = val(c.party); else q[f] = val; q.manual[f] = true; render(false, true); };
    v.querySelectorAll("[data-party]").forEach((b) => b.addEventListener("click", () => set("party", (p) => Math.min(8, Math.max(1, p + Number(b.dataset.party))))));
    v.querySelectorAll("[data-cuisine]").forEach((b) => b.addEventListener("click", () => set("cuisine", b.dataset.cuisine || null)));
    v.querySelectorAll("[data-budget]").forEach((b) => b.addEventListener("click", () => set("budget", b.dataset.budget)));
    v.querySelector("[data-find]").addEventListener("click", () => {
      const c = effectiveQuery();
      Object.assign(q, { cuisine: c.cuisine, budget: c.budget, budgetSet: c.budgetSet, occasion: c.occasion, extraTags: c.tags, parsed: c.parsed, applied: true, editing: false });
      state.party = c.party;
      const empty = hasCraving(c) ? dishResults(committedQuery()).dishes.length === 0 : nearby().length === 0;
      q.relaxed = empty;
      if (empty) q.applied = false;
      go("home");
    });
  },
};

// ---------- Results: matching dishes first (if there's a craving), then places ----------
SCREENS.home = {
  html() {
    const q = state.query;
    const c = committedQuery();
    const tags = groupTags();
    const craving = q.applied && hasCraving(c);
    const { dishes, hidden } = craving ? dishResults(c) : { dishes: [], hidden: 0 };
    const places = nearby();
    const cravingText = craving ? [c.parsed.spicy ? "spicy" : null, ...c.parsed.terms].filter(Boolean).join(" ") : "";
    return `
      ${topbar("BookMe")}
      <div class="scroll">
        <p class="eyebrow">${q.relaxed ? "No exact match, here's what's close" : `Good evening, ${esc(firstName(state.user))}`}</p>
        <h2 class="display">Tonight, near<br>${esc(PIN.label)}</h2>
        <button class="table-sum" data-edit><span>${esc(tableSummary(c))}${q.text.trim() ? ` · “${esc(q.text.trim())}”` : ""}</span><span class="edit">Edit</span></button>
        ${craving ? `
          <h3 class="h2">Dishes for “${esc(cravingText)}”</h3>
          ${dishes.map((d) => `
            <button class="card dish-row" data-dish="${d.r.restaurant_id}:${d.item.item_id}">
              ${photo(BOOKME_IMAGES.dish(d.item, d.r.cuisine_type), "", "dthumb")}
              <span class="dr-main"><b>${esc(d.item.name)}</b><span>${esc(d.r.name)} · <span class="num">${d.r.distance_km?.toFixed(1)} km</span> · <span class="num">${money(price(d.item))}</span></span>
              ${d.fit.level === "caution" ? `<span class="pill warn" style="margin-top:4px">${esc(d.fit.reason)}</span>` : ""}</span>
              <span class="pill accent num">${d.match}%</span>
            </button>`).join("")}
          ${hidden ? `<p class="small" style="margin-top:10px">${hidden} more dish${hidden === 1 ? "" : "es"} score 0 for your table's ${esc(tags.filter((t) => t.endsWith("-free")).join(", ") || "dietary")} profile.</p>` : ""}
          <h3 class="h2">Restaurants that have it</h3>` : ""}
        ${places.map((r) => `
          <button class="card r-card" data-rid="${r.restaurant_id}">
            ${photo(BOOKME_IMAGES.thumb(r), r.cuisine_type, "thumb")}
            <div>
              <p class="r-name">${esc(r.name)}</p>
              <p class="r-addr">${esc(r.address_line1 || r.neighborhood)}, Chicago</p>
              <div class="r-meta">
                ${r.distance_km != null ? `<span class="num">${r.distance_km.toFixed(1)} km</span><span class="dot"></span>` : ""}
                <span>${esc(r.cuisine_type)}</span><span class="dot"></span><span>${esc(r.price_tier || "")}</span>
                ${r.avg_rating ? `<span class="dot"></span><span class="r-rating">★ ${r.avg_rating.toFixed(1)}</span>` : ""}
              </div>
              ${tags.length ? `<p class="r-fit">${r.safe} dishes fit your table</p>` : ""}
            </div>
            <span class="chev">${icons.chev}</span>
          </button>`).join("")}
        <p class="small" style="margin-top:16px">Closest first, from your pin at the ${esc(PIN.label)} Blue Line stop.${tags.length ? " Places with nothing safe for your table are left out." : ""}</p>
      </div>`;
  },
  bind(v) {
    v.querySelector("[data-edit]").addEventListener("click", () => go("search"));
    v.querySelectorAll("[data-rid]").forEach((b) =>
      b.addEventListener("click", async () => {
        await openRestaurant(nearby().find((x) => x.restaurant_id === Number(b.dataset.rid)));
        go("restaurant");
      })
    );
    // Tapping a dish opens its restaurant with the dish already in the order.
    v.querySelectorAll("[data-dish]").forEach((b) =>
      b.addEventListener("click", async () => {
        const [rid, iid] = b.dataset.dish.split(":").map(Number);
        const r = nearby({ useQuery: false }).find((x) => x.restaurant_id === rid);
        await openRestaurant(r);
        const item = state.menu.items.find((m) => m.item_id === iid);
        if (item) state.cart = [{ ...item, quantity: 1 }];
        go("restaurant");
      })
    );
  },
};

// ---------- Restaurant + live seats ----------
const ZONE_LABEL = { "main dining": "Main dining", patio: "Patio", bar: "Bar" };
const ZONE_ICON = { "main dining": "🍽️", patio: "🌿", bar: "🍸" };

function seatingGroups(tables, party) {
  const open = tables.filter((x) => x.status === "available");
  const byZone = new Map();
  for (const t of open) {
    const zone = t.location_zone || "main dining";
    if (!byZone.has(zone)) byZone.set(zone, []);
    byZone.get(zone).push(t);
  }
  return [...byZone.entries()].map(([zone, list]) => ({
    zone,
    label: ZONE_LABEL[zone] || zone,
    icon: ZONE_ICON[zone] || "🍽️",
    count: list.length,
    fits: list.filter((x) => x.capacity >= party).length,
    sample: [...new Set(list.map((x) => x.seating_feature).filter(Boolean))].slice(0, 2).join(" · "),
  }));
}

// Picks the smallest open table (in the chosen zone, if any) that fits the
// party — the diner chooses a seating type, the actual table is auto-allotted.
function bestTable(tables, party, zone) {
  const open = tables.filter((x) => x.status === "available" && (!zone || x.location_zone === zone));
  const fitting = open.filter((x) => x.capacity >= party).sort((a, b) => a.capacity - b.capacity);
  return fitting[0] || open.sort((a, b) => b.capacity - a.capacity)[0] || null;
}

SCREENS.restaurant = {
  html() {
    const r = state.restaurant, t = state.tables;
    const open = t.filter((x) => x.status === "available");
    const seatsOpen = open.reduce((s, x) => s + x.capacity, 0);
    const seatsAll = t.reduce((s, x) => s + x.capacity, 0) || r.seats_total || 1;
    const groups = seatingGroups(t, state.party);
    const chosen = groups.find((g) => g.zone === state.seatZone);
    const fits = chosen ? chosen.fits : groups.reduce((s, g) => s + g.fits, 0);
    return `
      ${topbar()}
      <div class="scroll">
        ${photo(BOOKME_IMAGES.room(r), r.cuisine_type, "hero")}
        <h2 class="display" style="margin:18px 0 4px">${esc(r.name)}</h2>
        <div class="addr-row">${icons.pin}<span>${esc(r.address_line1 || r.neighborhood)}, Chicago</span></div>
        <b style="font-size:14px">${esc(r.cuisine_type)} · ${esc(r.price_tier || "")}${r.avg_rating ? ` · ★ ${r.avg_rating.toFixed(1)}${r.total_reviews ? ` (${r.total_reviews})` : ""}` : ""}</b>
        ${r.health_inspection_score ? `<div class="health-badge">${icons.tick} Health inspection: ${r.health_inspection_score.toFixed(1)}/100</div>` : ""}
        ${r.description ? `<p class="r-blurb">${esc(r.description)}</p>` : ""}
        ${state.cart.length ? `<div class="filter-banner" style="margin-top:14px">${icons.tick}<span>${esc(state.cart.map((c) => c.name).join(", "))} is in your order. Reserve, then add anything else from the menu.</span></div>` : ""}

        ${(() => {
          const top = [...(state.menu?.items || [])].sort((a, b) => (b.popularity_score || 0) - (a.popularity_score || 0)).slice(0, 3);
          if (!top.length) return "";
          return `
            <h3 class="h2">Popular here</h3>
            <div class="popular-strip">
              ${top.map((d) => `
                <button class="popular-card" data-popular-jump>
                  ${photo(BOOKME_IMAGES.dish(d, r.cuisine_type), "", "popular-photo")}
                  <span class="popular-name">${esc(d.name)}</span>
                  <span class="popular-price num">${money(d.discount_price || d.price)}</span>
                </button>`).join("")}
            </div>`;
        })()}

        <div class="card seats-card">
          <div class="seats-head"><span class="seats-title">Live seats</span><span class="live-dot"></span></div>
          <div class="seats-big"><span class="num">${seatsOpen}</span> of <span class="num">${seatsAll}</span> seats open right now</div>
          <div class="bar"><span style="width:${Math.round((seatsOpen / seatsAll) * 100)}%"></span></div>
          <span class="small">Choose a seating type — we'll seat you at the best table for a party of ${state.party}</span>
          <div class="seat-types">
            <button class="seat-type ${!state.seatZone ? "is-on" : ""}" data-zone="">
              <span class="zt-icon">✨</span><span class="zt-label">No preference</span><span class="zt-count">${groups.reduce((s, g) => s + g.count, 0)} open</span>
            </button>
            ${groups.map((g) => `
              <button class="seat-type ${state.seatZone === g.zone ? "is-on" : ""}" data-zone="${esc(g.zone)}">
                <span class="zt-icon">${g.icon}</span><span class="zt-label">${esc(g.label)}</span><span class="zt-count">${g.count} open</span>
                ${g.sample ? `<span class="zt-sample">${esc(g.sample)}</span>` : ""}
              </button>`).join("")}
          </div>
        </div>

        <h3 class="h2">Tonight</h3>
        <div class="slots">${SLOTS.map((s) => `<button class="slot ${s === state.slot ? "is-on" : ""}" data-slot="${s}">${s}</button>`).join("")}</div>
        <h3 class="h2">Party size</h3>
        <div class="stepper"><button data-party="-1" aria-label="Fewer">−</button><span class="num">${state.party}</span><button class="fill" data-party="1" aria-label="More">+</button></div>
      </div>
      <div class="footer"><button class="btn" data-reserve>${fits ? `Reserve for ${state.party}` : `Request a table for ${state.party}`}</button></div>`;
  },
  bind(v) {
    v.querySelectorAll("[data-popular-jump]").forEach((b) => b.addEventListener("click", () => go("menu")));
    v.querySelectorAll("[data-slot]").forEach((b) => b.addEventListener("click", () => { state.slot = b.dataset.slot; render(false, true); }));
    v.querySelectorAll("[data-party]").forEach((b) => b.addEventListener("click", () => { state.party = Math.min(8, Math.max(1, state.party + Number(b.dataset.party))); render(false, true); }));
    v.querySelectorAll("[data-zone]").forEach((b) => b.addEventListener("click", () => { state.seatZone = b.dataset.zone || null; render(false, true); }));
    v.querySelector("[data-reserve]").addEventListener("click", () => {
      const tags = groupTags();
      const table = bestTable(state.tables, state.party, state.seatZone);
      const fits = !!table && table.capacity >= state.party;
      const seatingNote = table ? ` You're seated ${table.seating_feature ? esc(table.seating_feature).toLowerCase() : esc(ZONE_LABEL[table.location_zone] || table.location_zone).toLowerCase()}.` : "";
      state.checkedIn = false;
      v.append($(`

        <div class="sheet-backdrop" data-close></div>
        <div class="sheet" role="dialog" aria-label="Reservation confirmed">
          <div class="grab"></div>
          <div class="confirm-icon">${icons.check}</div>
          <h3 class="display" style="font-size:23px;margin-bottom:6px">${fits ? `Table for ${state.party} at ${state.slot} — confirmed` : `Request sent: ${state.party} at ${state.slot}`}</h3>
          <p class="sub">${fits ? `${esc(state.restaurant.name)} holds it 15 minutes past your time.${seatingNote}` : `No table for ${state.party} is open right now, so ${esc(state.restaurant.name)} confirms within a few minutes.`}${tags.length ? ` Your ${esc(tags.join(", "))} profile is already on the ticket.` : ""}</p>
          <div style="display:grid;gap:8px;margin-top:14px"><button class="btn" data-menu-early>View menu</button></div>
          <div class="geo-box" data-geo-box>
            <p class="geo-hint">${icons.pin} Browsing doesn't require it — but check in when you arrive so the kitchen knows to start.</p>
            <button class="btn secondary" data-checkin>Check in</button>
          </div>
          <div style="display:grid;gap:8px;margin-top:10px"><button class="btn secondary" data-close>Done for now</button></div>
        </div>`));
      v.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => v.querySelectorAll(".sheet,.sheet-backdrop").forEach((e) => e.remove())));
      v.querySelector("[data-menu-early]").addEventListener("click", () => go("menu"));

      v.querySelector("[data-checkin]").addEventListener("click", (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        btn.textContent = "Checking you in…";
        setTimeout(() => {
          state.checkedIn = true;
          const box = v.querySelector("[data-geo-box]");
          if (box) {
            box.innerHTML = `<p class="geo-confirmed">${icons.check} You're checked in — the kitchen can fire your order now.</p>`;
          }
        }, 1100);
      });
    });
  },
};

// ---------- Menu ----------
SCREENS.menu = {
  html() {
    const tags = groupTags();
    const dishes = scoredMenu();
    const blocked = dishes.filter((d) => d.fit.level === "blocked").length;
    const cats = [...new Set([...CATEGORY_ORDER, ...dishes.map((d) => d.category)])].filter((c) => dishes.some((d) => d.category === c));
    const qty = Object.fromEntries(state.cart.map((c) => [c.item_id, c.quantity]));
    const rank = { ok: 0, caution: 1, skipped: 2, blocked: 3 };
    // Allergen tags ("-free") and vegan / vegetarian / gluten-free are checked
    // against the menu data; halal and kosher aren't in it yet, so say so.
    const dietChecked = (t) => {
      const known = t.filter((x) => x.endsWith("-free") || ["vegan", "vegetarian"].includes(x));
      const unknown = t.filter((x) => !known.includes(x));
      return [known.length ? `Safe for ${known.join(", ")}` : "", unknown.length ? `${unknown.join(", ")}: ask your server` : ""].filter(Boolean).join(" · ");
    };
    const grey = (d) => d.fit.level === "blocked" || d.fit.level === "skipped";
    const dietLine = (d) => d.fit.level === "blocked" ? ["Dietary check", `${d.fit.reason} · scores 0`]
      : d.fit.level === "caution" ? ["Dietary check", d.fit.reason]
      : tags.length ? ["Dietary check", dietChecked(tags)] : null;
    const PARTS = [["preference", "Taste"], ["dietary", "Dietary"], ["budget", "Budget"], ["nutrition", "Nutrition"], ["quality", "Quality"], ["speed", "Speed"]];
    return `
      ${topbar()}
      <div class="scroll">
        <h2 class="display" style="margin-top:18px">Menu for your table</h2>
        ${tags.length
          ? `<div class="filter-banner">${icons.info}<span>Filtered for your group's ${esc(tags.join(", "))} profile${blocked ? ` · ${blocked} dish${blocked === 1 ? "" : "es"} greyed out` : ""}</span></div>`
          : `<div class="filter-banner muted">${icons.info}<span>No dietary restrictions on file. Add them once and every menu filters itself.</span></div>`}
        ${cats.length > 1 ? `<div class="cat-nav">${cats.map((cat) => `<button class="cat-nav-btn" data-cat-jump="${esc(catSlug(cat))}">${esc(cat)}</button>`).join("")}</div>` : ""}
        ${cats.map((cat) => `
          <p class="cat-title" id="cat-${esc(catSlug(cat))}">${esc(cat)}</p>
          ${dishes.filter((d) => d.category === cat).sort((a, b) => rank[a.fit.level] - rank[b.fit.level] || b.match - a.match).map((d) => `
            <div class="card dish-card ${grey(d) ? "is-blocked" : ""}">
              ${photo(BOOKME_IMAGES.dish(d, state.restaurant.cuisine_type), d.category, "dish-photo")}
              <div class="dish-body">
                <div class="dish-head">
                  <p class="dish-name">${esc(d.name)}</p>
                  ${grey(d) ? `<button class="pill bad pill-btn" data-why="${d.item_id}" aria-label="See why this dish scores 0"><span class="num">0%</span> · ${esc(d.fit.level === "skipped" ? "not suggested" : d.fit.reason)}</button>` : d.parts ? `<button class="pill accent num pill-btn" data-why="${d.item_id}" aria-label="See why this dish scored ${d.match}%">${d.match}% match</button>` : `<span class="pill accent num">${d.match}% match</span>`}
                </div>
                <p class="dish-desc">${esc(d.description || "")}${d.fit.level === "caution" ? ` <span class="pill warn" style="margin-left:4px">${esc(d.fit.reason)}</span>` : ""}</p>
                <div class="dish-foot">
                  <span class="price num">${money(price(d))}</span>
                  ${d.fit.level === "blocked" ? `<span class="small">Not safe for your table</span>` : `
                  <span class="stepper">
                    <button data-dec="${d.item_id}" aria-label="Remove one ${esc(d.name)}" ${qty[d.item_id] ? "" : "disabled style='opacity:.35'"}>−</button>
                    <span class="num">${qty[d.item_id] || 0}</span>
                    <button class="fill" data-inc="${d.item_id}" aria-label="Add ${esc(d.name)}">+</button>
                  </span>`}
                </div>
                <div class="dish-toggles">
                  ${d.modifiers && d.modifiers.length && d.fit.level !== "blocked" ? (() => {
                    const cartLine = state.cart.find((c) => c.item_id === d.item_id);
                    const selected = cartLine?.selectedMods || [];
                    return `<button class="why-btn customize-btn" data-customize="${d.item_id}">${state.showCustomize.has(d.item_id) ? "Hide options" : `Customize${selected.length ? ` (${selected.length})` : ""}`}</button>`;
                  })() : "<span></span>"}
                  <button class="why-btn" data-why="${d.item_id}">${state.showWhy.has(d.item_id) ? "Hide" : "Why this score"}</button>
                </div>
                ${state.showWhy.has(d.item_id) ? `<div class="score-grid">
                  ${d.parts && !grey(d) ? PARTS.map(([k, l]) => `<div class="score-row"><span>${l}</span><div class="bar ${d.parts[k] < 70 ? "low" : ""}"><span style="width:${d.parts[k]}%"></span></div><b class="num">${d.parts[k]}</b></div>`).join("") : ""}
                  ${[dietLine(d), ...(d.notes || [])].filter(Boolean).map(([k, val]) => `<div class="why-row"><span>${esc(k)}</span><b class="num">${esc(val)}</b></div>`).join("")}
                </div>` : ""}
                ${d.modifiers && d.modifiers.length && state.showCustomize.has(d.item_id) ? (() => {
                  const cartLine = state.cart.find((c) => c.item_id === d.item_id);
                  const selected = cartLine?.selectedMods || [];
                  return `<div class="mod-list">${d.modifiers.map((m) => `
                    <label class="mod-row">
                      <input type="checkbox" data-mod="${d.item_id}:${m.modifier_id}" ${selected.some((sm) => sm.modifier_id === m.modifier_id) ? "checked" : ""}>
                      <span class="mod-name">${esc(m.name)}</span>
                      <span class="mod-price">${m.price_delta ? `+${money(m.price_delta)}` : "Free"}</span>
                    </label>`).join("")}</div>`;
                })() : ""}
              </div>
            </div>`).join("")}
        `).join("")}
      </div>
      ${state.cart.length ? `<button class="cartbar" data-review><span>${cartCount()} item${cartCount() === 1 ? "" : "s"} · <span class="num">${money(cartSubtotal())}</span></span><span>Review order ›</span></button>` : ""}`;
  },
  bind(v) {
    v.querySelectorAll("[data-cat-jump]").forEach((b) => b.addEventListener("click", () => {
      const target = v.querySelector(`#cat-${b.dataset.catJump}`);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    }));
    const change = (id, delta) => {
      const i = state.cart.findIndex((c) => c.item_id === id);
      if (i >= 0) { state.cart[i].quantity += delta; if (state.cart[i].quantity <= 0) state.cart.splice(i, 1); }
      else if (delta > 0) state.cart.push({ ...state.menu.items.find((m) => m.item_id === id), quantity: 1, selectedMods: [] });
      render(false, true);
    };
    const toggleMod = (itemId, modifier) => {
      let i = state.cart.findIndex((c) => c.item_id === itemId);
      if (i < 0) {
        state.cart.push({ ...state.menu.items.find((m) => m.item_id === itemId), quantity: 1, selectedMods: [] });
        i = state.cart.length - 1;
      }
      const mods = state.cart[i].selectedMods || (state.cart[i].selectedMods = []);
      const idx = mods.findIndex((m) => m.modifier_id === modifier.modifier_id);
      if (idx >= 0) mods.splice(idx, 1); else mods.push(modifier);
      render(false, true);
    };
    v.querySelectorAll("[data-inc]").forEach((b) => b.addEventListener("click", () => change(Number(b.dataset.inc), 1)));
    v.querySelectorAll("[data-dec]").forEach((b) => b.addEventListener("click", () => change(Number(b.dataset.dec), -1)));
    v.querySelectorAll("[data-why]").forEach((b) => b.addEventListener("click", () => {
      const id = Number(b.dataset.why);
      state.showWhy.has(id) ? state.showWhy.delete(id) : (state.showWhy.add(id), state.showCustomize.delete(id));
      state.openedThisVisit.add(id);
      render(false, true);
    }));
    v.querySelectorAll("[data-customize]").forEach((b) => b.addEventListener("click", () => {
      const id = Number(b.dataset.customize);
      state.showCustomize.has(id) ? state.showCustomize.delete(id) : (state.showCustomize.add(id), state.showWhy.delete(id));
      render(false, true);
    }));
    v.querySelectorAll("[data-mod]").forEach((cb) => cb.addEventListener("change", () => {
      const [itemId, modId] = cb.dataset.mod.split(":").map(Number);
      const item = state.menu.items.find((m) => m.item_id === itemId);
      const modifier = item.modifiers.find((m) => m.modifier_id === modId);
      toggleMod(itemId, modifier);
    }));
    v.querySelector("[data-review]")?.addEventListener("click", () => { state.order = null; state.error = ""; go("order"); });
  },
};

// ---------- Order + ETA ----------
// The order is written by POST /orders; the wait shown is the prep-time rule,
// fed the backend's live open-ticket count.
function withAppEta(o) {
  const bd = o.eta?.breakdown || {};
  const open = bd.kitchen_load_orders_last_30min ?? bd.open_tickets ?? 0;
  return { ...o, appEta: Models.prepEta(state.cart, open, state.restaurant) };
}
function noteOpenedNotAdded() {
  const inCart = new Set(state.cart.map((c) => c.item_id));
  for (const id of state.openedThisVisit) {
    if (inCart.has(id)) continue;
    const fb = (state.feedback[fbKey(id)] ||= {});
    fb.opened = Math.min(3, (fb.opened || 0) + 1);
  }
  state.openedThisVisit = new Set();
}
function fasterSwap() {
  const safe = scoredMenu().filter((d) => d.fit.level === "ok" || d.fit.level === "caution");
  const slowest = [...state.cart].sort((a, b) => (b.prep_time_minutes || 0) - (a.prep_time_minutes || 0))[0];
  if (!slowest) return null;
  const inCart = new Set(state.cart.map((c) => c.item_id));
  const alt = safe.filter((d) => !inCart.has(d.item_id) && d.category === slowest.category && (d.prep_time_minutes || 99) < (slowest.prep_time_minutes || 0))
    .sort((a, b) => a.prep_time_minutes - b.prep_time_minutes)[0];
  if (!alt) return null;
  const swapped = state.cart.map((c) => (c.item_id === slowest.item_id ? { ...alt, quantity: c.quantity } : c));
  return { slowest, alt, swapped, newWait: etaPreview(swapped).wait_minutes };
}
function etaRing(minutes) {
  const r = 64, c = 2 * Math.PI * r, frac = Math.min(1, minutes / 45);
  return `<div class="eta-ring"><svg width="150" height="150" viewBox="0 0 150 150">
    <circle cx="75" cy="75" r="${r}" fill="none" stroke="rgba(0,0,0,.06)" stroke-width="10"/>
    <circle cx="75" cy="75" r="${r}" fill="none" stroke="var(--accent)" stroke-width="10" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - frac)}"/></svg>
    <div class="val"><b class="num">${minutes}</b><span>minutes</span></div></div>`;
}
SCREENS.order = {
  html() {
    const o = state.order;
    const sub = cartSubtotal(), tax = Math.round(sub * TAX_RATE * 100) / 100;
    const prev = etaPreview(state.cart);
    const swap = !o && prev.over_25_min ? fasterSwap() : null;
    let est;
    if (o) {
      const e = o.appEta, c = Models.toContract(e), b = e.breakdown;
      const n = b.base_minutes_per_item.length;
      est = `
        <div class="est-card">
          <span class="label">Sent to the kitchen${o.order_id ? ` · order #${o.order_id}` : ""}</span>
          ${etaRing(c.wait_minutes)}
          <p class="est-title">Ready in about ${c.wait_minutes} minutes</p>
          <p class="est-sub">${c.over_25_min ? "Longer than usual — your server knows." : "We'll nudge you when it's on its way."}</p>
          <div class="why">
            <div class="why-row"><span>Dish baseline</span><b>${n} dish${n === 1 ? "" : "es"} together · ${Math.round(b.baseline_minutes)} min</b></div>
            <div class="why-row"><span>Open tickets</span><b>${b.open_tickets} of ${b.kitchen_capacity} the kitchen handles · +${Math.round(b.load_minutes)} min</b></div>
            <div class="why-row"><span>Time of day</span><b>${esc(b.time_of_day)} · +${Math.round(b.time_of_day_minutes)} min</b></div>
            <div class="why-row"><span>Cold start</span><b>${b.cold_start_items ? `Category average for ${b.cold_start_items} dish${b.cold_start_items === 1 ? "" : "es"}` : "Restaurant's own dish times"}</b></div>
            <div class="why-row"><span>Model</span><b>Prep-time rule${Data.live ? " · live" : " · offline"}</b></div>
          </div>
        </div>`;
    } else {
      est = `
        <div class="est-card">
          <span class="label">Kitchen estimate</span>
          <div class="est-icon">${icons.clock}</div>
          <p class="est-title">Ready in about ${prev.wait_minutes} minutes</p>
          <p class="est-sub">Confirmed the moment the kitchen gets it.</p>
        </div>
        ${swap ? `<div class="notice">Longer than usual tonight — ${esc(swap.slowest.name)} takes ${swap.slowest.prep_time_minutes} min. Want something faster?<br><button class="alt" data-swap>${esc(swap.alt.name)} · ~${swap.alt.prep_time_minutes} min</button></div>`
          : prev.over_25_min ? `<div class="notice">Longer than usual tonight — the kitchen is busy.</div>` : ""}`;
    }
    return `
      ${topbar()}
      <div class="scroll">
        <h2 class="display" style="margin:18px 0 2px">${o ? "Order sent" : "Your order"}</h2>
        <p class="sub">${esc(state.restaurant.name)} · table for ${state.party}</p>
        <div class="card" style="padding:2px 16px;margin-top:14px">
          ${state.cart.map((c) => `<div class="line"><span>${c.quantity} × ${esc(c.name)}${c.selectedMods && c.selectedMods.length ? `<br><span class="mod-note">${esc(c.selectedMods.map((m) => m.name).join(", "))}</span>` : ""}</span><b class="num">${money(price(c) * c.quantity)}</b></div>`).join("")}
        </div>
        ${est}
        ${state.error ? `<div class="error">${esc(state.error)}</div>` : ""}
      </div>
      <div class="footer">${o ? `<button class="btn" data-pay>Pay & split</button>` : `<button class="btn" data-send ${state.sending || !state.cart.length ? "disabled" : ""}>${state.sending ? "Sending…" : "Send to kitchen"}</button>`}</div>`;
  },
  bind(v) {
    v.querySelector("[data-swap]")?.addEventListener("click", () => { const s = fasterSwap(); if (s) { state.cart = s.swapped; render(false, true); } });
    v.querySelector("[data-send]")?.addEventListener("click", async () => {
      state.sending = true; state.error = ""; render(false, true);
      try { state.order = withAppEta(await Data.placeOrder(state.user, state.restaurant.restaurant_id, state.cart)); noteOpenedNotAdded(); }
      catch (e) { state.error = e.message; }
      state.sending = false; render(false, true);
    });
    v.querySelector("[data-pay]")?.addEventListener("click", () => {
      state.assign = Object.fromEntries(state.cart.map((c, i) => [c.item_id, i % people().length]));
      go("pay");
    });
  },
};

// ---------- Pay & split ----------
function payNumbers() {
  const o = state.order;
  const sub = o ? o.subtotal : cartSubtotal();
  const tax = o ? o.tax : Math.round(sub * TAX_RATE * 100) / 100;
  const tip = Math.round(sub * state.tipPct) / 100;
  const total = sub + tax + tip;
  const ppl = people();
  let shares = ppl.map(() => total / ppl.length);
  if (state.split === "item") {
    const each = ppl.map(() => 0);
    state.cart.forEach((c) => { each[state.assign[c.item_id] ?? 0] += price(c) * c.quantity; });
    shares = each.map((s) => (sub ? (s / sub) * total : 0));
  }
  return { sub, tax, tip, total, shares };
}
SCREENS.pay = {
  html() {
    const n = payNumbers(), ppl = people();
    const suggested = state.party >= 6 ? 20 : 18;
    return `
      ${topbar()}
      <div class="scroll">
        <h2 class="display" style="margin-top:18px">Pay & split</h2>
        <div class="card" style="padding:2px 16px">
          <div class="line"><span>Food & drinks</span><span class="num">${money(n.sub)}</span></div>
          <div class="line"><span>Chicago tax</span><span class="num">${money(n.tax)}</span></div>
          <div class="line"><span>Tip (${state.tipPct}%)</span><span class="num">${money(n.tip)}</span></div>
          <div class="line total"><span>Total</span><span class="num">${money(n.total)}</span></div>
        </div>
        <h3 class="h2">Split with your group</h3>
        <div class="seg"><button data-split="even" class="${state.split === "even" ? "is-on" : ""}">Split evenly</button><button data-split="item" class="${state.split === "item" ? "is-on" : ""}">Split by item</button></div>
        <div class="people">${ppl.map((p, i) => `<div class="person"><span class="avatar ${p.me ? "me" : ""}">${initial(p.name)}</span><b>${esc(p.name)}</b><span class="num">${money(n.shares[i])}</span></div>`).join("")}</div>
        ${state.split === "item" ? `
          <div class="card assign-list">
            ${state.cart.map((c) => `<div class="assign-row"><span>${esc(c.name)}</span><span class="assign">${ppl.map((p, i) => `<button data-assign="${c.item_id}:${i}" class="${state.assign[c.item_id] === i ? "is-on" : ""}" aria-label="${esc(p.name)} pays">${initial(p.name)}</button>`).join("")}</span></div>`).join("")}
          </div>
          <p class="small" style="margin-top:8px">Tap who had what. Tax and tip follow in proportion.</p>` : ""}
        <h3 class="h2" style="margin-bottom:4px">Suggested tip</h3>
        <p class="sub" style="margin-bottom:10px">Based on group size and service.</p>
        <div class="tips">${[15, 18, 20, 25].map((p) => `<button data-tip="${p}" class="${p === state.tipPct ? "is-on" : ""}">${p}%</button>`).join("")}</div>
        <p class="small" style="margin-top:8px">${suggested}% suggested for a table of ${state.party}. Goes straight to your server.</p>
      </div>
      <div class="footer"><button class="btn" data-paynow>Pay ${money(n.total)}</button></div>`;
  },
  bind(v) {
    v.querySelectorAll("[data-tip]").forEach((b) => b.addEventListener("click", () => { state.tipPct = Number(b.dataset.tip); render(false, true); }));
    v.querySelectorAll("[data-split]").forEach((b) => b.addEventListener("click", () => { state.split = b.dataset.split; render(false, true); }));
    v.querySelectorAll("[data-assign]").forEach((b) => b.addEventListener("click", () => { const [id, i] = b.dataset.assign.split(":").map(Number); state.assign[id] = i; render(false, true); }));
    v.querySelector("[data-paynow]").addEventListener("click", () => go("paid"));
  },
};
SCREENS.paid = {
  html() {
    const n = payNumbers();
    return `
      ${topbar()}
      <div class="scroll center" style="display:grid;align-content:center">
        <div class="big-check">${icons.check}</div>
        <h2 class="display" style="font-size:28px;margin-bottom:8px">Dinner, settled.</h2>
        <p class="sub">Your <b class="num">${money(n.total)}</b> payment went through and everyone's share is sorted.</p>
        <button class="btn" data-review style="margin-top:22px">Review your night</button>
      </div>`;
  },
  bind(v) { v.querySelector("[data-review]").addEventListener("click", () => go("review")); },
};

// ---------- Review ----------
SCREENS.review = {
  html() {
    const rv = state.review;
    return `
      ${topbar()}
      <div class="scroll">
        <h2 class="display" style="margin:18px 0 10px">How was it?</h2>
        <span class="pill good">${icons.tick} Verified — you paid through BookMe</span>
        <h3 class="h2" style="margin-bottom:2px">Your overall rating</h3>
        <div class="stars">${[1, 2, 3, 4, 5].map((s) => `<button data-star="${s}" class="${s <= rv.stars ? "is-on" : ""}" aria-label="${s} star${s > 1 ? "s" : ""}">${s <= rv.stars ? icons.starOn : icons.star}</button>`).join("")}</div>
        <h3 class="h2">A quick note</h3>
        <textarea placeholder="What stood out tonight?" data-text>${esc(rv.text)}</textarea>
        <h3 class="h2">Your dishes</h3>
        <div class="card" style="padding:2px 14px">
          ${state.cart.map((c) => `<div class="toggle-row"><span>${esc(c.name)}</span><span style="display:flex;gap:10px;align-items:center"><span class="hint">Don't suggest<br>this again</span><button class="switch ${rv.skip.has(c.item_id) ? "is-on" : ""}" data-skip="${c.item_id}" aria-pressed="${rv.skip.has(c.item_id)}" aria-label="Don't suggest ${esc(c.name)} again"></button></span></div>`).join("")}
        </div>
      </div>
      <div class="footer"><button class="btn" data-submit ${rv.stars ? "" : "disabled"}>Submit review</button></div>`;
  },
  bind(v) {
    const keep = () => { const t = v.querySelector("[data-text]"); if (t) state.review.text = t.value; };
    v.querySelectorAll("[data-star]").forEach((b) => b.addEventListener("click", () => { state.review.stars = Number(b.dataset.star); keep(); render(false, true); }));
    v.querySelectorAll("[data-skip]").forEach((b) => b.addEventListener("click", () => { const id = Number(b.dataset.skip); state.review.skip.has(id) ? state.review.skip.delete(id) : state.review.skip.add(id); keep(); render(false, true); }));
    v.querySelector("[data-submit]").addEventListener("click", () => {
      keep();
      const rv = state.review;
      for (const c of state.cart) {
        const fb = (state.feedback[fbKey(c.item_id)] ||= {});
        fb.stars = rv.stars; fb.rating = (rv.stars - 3) * 3;
        fb.dont = rv.skip.has(c.item_id);
      }
      go("thanks");
    });
  },
};
SCREENS.thanks = {
  html() {
    return `
      ${topbar()}
      <div class="scroll center" style="display:grid;align-content:center">
        <div class="big-check">${icons.fork}</div>
        <h2 class="display" style="font-size:28px;margin-bottom:8px">Thanks, ${esc(firstName(state.user))}.</h2>
        <p class="sub">Your review is live. Only verified diners can post. Next visit, your match scores reflect it.</p>
        <button class="btn secondary" data-home style="margin-top:22px">Back to tonight</button>
      </div>`;
  },
  bind(v) { v.querySelector("[data-home]").addEventListener("click", resetDiner); },
};

// ================================================================ OPS VIEW
const ownerCache = {};
async function loadOwner(rid) {
  if (!ownerCache[rid]) {
    const dates = Data.forecastDates(rid);
    ownerCache[rid] = { rows: await Data.forecast(rid, dates), dates };
  }
  return ownerCache[rid];
}
const BLOCK_LABEL = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", late_night: "Late night" };

function lineChart(rows) {
  const W = 320, H = 190, P = { l: 30, r: 10, t: 12, b: 26 };
  const vals = rows.flatMap((r) => [r.predicted_covers, r.actual_covers, r.naive ?? 0]);
  const max = Math.max(20, Math.ceil(Math.max(...vals) / 20) * 20);
  const x = (i) => P.l + (i * (W - P.l - P.r)) / Math.max(1, rows.length - 1);
  const y = (v) => P.t + (1 - v / max) * (H - P.t - P.b);
  const path = (k) => rows.map((r, i) => (r[k] == null ? "" : `${i && rows[i - 1][k] != null ? "L" : "M"}${x(i).toFixed(1)},${y(r[k]).toFixed(1)}`)).join(" ");
  const ticks = [0, max / 2, max];
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Forecast versus actual covers">
    ${ticks.map((t) => `<line x1="${P.l}" x2="${W - P.r}" y1="${y(t)}" y2="${y(t)}" stroke="#EDE6DE"/><text x="${P.l - 6}" y="${y(t) + 4}" font-size="10" text-anchor="end" fill="#9C918A">${t}</text>`).join("")}
    ${rows.map((r, i) => (i % 2 === 0 ? `<text x="${x(i)}" y="${H - 6}" font-size="9.5" text-anchor="middle" fill="#9C918A">${fmtDate(r.shift_date, { weekday: "short" })}</text>` : "")).join("")}
    <path d="${path("naive")}" fill="none" stroke="#6B605A" stroke-width="1.5" stroke-dasharray="4 4"/>
    <path d="${path("actual_covers")}" fill="none" stroke="#2A211C" stroke-width="2"/>
    <path d="${path("predicted_covers")}" fill="none" stroke="#C45C33" stroke-width="2.6"/>
    ${rows.map((r, i) => `<circle cx="${x(i)}" cy="${y(r.predicted_covers)}" r="3" fill="#fff" stroke="#C45C33" stroke-width="2"><title>${fmtDate(r.shift_date)}: forecast ${r.predicted_covers}, actual ${r.actual_covers}</title></circle>`).join("")}
  </svg>`;
}

SCREENS.owner = {
  html() {
    const rid = state.owner.restaurantId;
    const r = state.restaurants.find((x) => x.restaurant_id === rid);
    const data = ownerCache[rid];
    const tabs = [["tonight", "Tonight", icons.cal], ["forecast", "Forecast", icons.chart], ["reorder", "Reorder", icons.box]];
    return `
      <header class="ops-top">
        <h1>${esc(r?.name || "")}</h1>
      </header>
      <div class="otabs">${tabs.map(([k, l, i]) => `<button data-otab="${k}" class="${state.owner.tab === k ? "is-on" : ""}">${i}${l}</button>`).join("")}</div>
      <div class="scroll">${data ? OWNER_TABS[state.owner.tab](data, r) : `<p class="sub" style="padding:20px 0">Loading forecast…</p>`}</div>`;
  },
  bind(v) {
    v.querySelectorAll("[data-otab]").forEach((b) => b.addEventListener("click", () => { state.owner.tab = b.dataset.otab; render(); }));
    v.querySelectorAll("[data-block]").forEach((b) => b.addEventListener("click", () => { state.owner.block = b.dataset.block; render(false, true); }));
  },
};

const OWNER_TABS = {
  tonight({ rows, dates }) {
    const today = dates[dates.length - 1];
    const todayRows = ["breakfast", "lunch", "dinner", "late_night"].map((b) => rows.find((r) => r.shift_date === today && r.shift_block === b)).filter(Boolean);
    const dinner = todayRows.find((r) => r.shift_block === "dinner") || todayRows[0];
    const cps = Models.coversPerStaff(rows) || 12;
    const flat = Math.round(rows.filter((r) => r.shift_block === dinner.shift_block).reduce((s, r) => s + r.actual_staff_count, 0) / Math.max(1, rows.filter((r) => r.shift_block === dinner.shift_block).length));
    const diff = flat - dinner.recommended_staff_count;
    const yesterday = rows.find((r) => r.shift_date === dates[dates.length - 2] && r.shift_block === dinner.shift_block);
    const trend = yesterday ? Math.round(((dinner.predicted_covers - yesterday.actual_covers) / Math.max(1, yesterday.actual_covers)) * 100) : 0;
    const reserved = Math.round(dinner.predicted_covers * 0.72);
    const tag = (r) => r.actual_staff_count > r.recommended_staff_count ? `<span class="pill warn">+${r.actual_staff_count - r.recommended_staff_count} over</span>`
      : r.actual_staff_count < r.recommended_staff_count ? `<span class="pill bad">${r.actual_staff_count - r.recommended_staff_count} short</span>` : `<span class="pill good">on plan</span>`;
    return `
      <div class="ops-head"><div><span class="label">Service plan</span><h2 class="display">Tonight</h2></div><span class="date-pill">${fmtDate(today)}</span></div>
      <div class="hero-card">
        <span class="k">${fmtDate(today, { weekday: "long" })} ${BLOCK_LABEL[dinner.shift_block].toLowerCase()}</span>
        <div class="big">${dinner.predicted_covers} covers expected <span class="arrow">→</span><br>staff ${dinner.recommended_staff_count}</div>
        <div class="rule">${dinner.predicted_covers} covers ÷ ~${cps.toFixed(0)} covers per staff member ≈ ${dinner.recommended_staff_count} on the floor · confidence ${Math.round(dinner.confidence_score * 100)}% · prep-time model, summed across the shift
          <b>${diff > 0 ? `Your usual ${BLOCK_LABEL[dinner.shift_block].toLowerCase()} schedule runs ${flat} — saving ~${diff} shift${diff === 1 ? "" : "s"}.` : diff < 0 ? `Your usual schedule runs ${flat} — add ${-diff} to avoid a short floor.` : `Matches your usual ${BLOCK_LABEL[dinner.shift_block].toLowerCase()} schedule.`}</b></div>
      </div>
      <div class="kpis">
        <div class="kpi"><span>Reserved</span><b class="num">${reserved}</b></div>
        <div class="kpi"><span>Walk-ins</span><b class="num">${dinner.predicted_covers - reserved}</b></div>
        <div class="kpi"><span>On floor</span><b class="num">${dinner.recommended_staff_count}</b></div>
      </div>
      <div class="o-card">
        <span class="label">Demand signal</span>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><p class="o-title">${BLOCK_LABEL[dinner.shift_block]} is trending ${trend >= 0 ? "above" : "below"} yesterday</p><span class="pill ${trend >= 0 ? "good" : "warn"} num">${trend >= 0 ? "+" : ""}${trend}%</span></div>
        <p class="small" style="margin-top:6px">${[dinner.weather_condition !== "clear" ? dinner.weather_condition.replace("_", " ") : null, dinner.local_event_nearby ? "local event nearby" : null, dinner.is_holiday ? "holiday" : null].filter(Boolean).join(" · ") || "Clear skies, no events"}</p>
        <button class="linkbtn soft" data-otab="forecast">Open 30-day forecast <span>${icons.chev}</span></button>
      </div>
      <div class="o-card">
        <span class="label">All shifts today</span>
        ${todayRows.map((r) => `<div class="shift-row"><span class="d">${BLOCK_LABEL[r.shift_block]}<span>${r.predicted_covers} covers · ${r.recommended_staff_count} recommended</span></span><span class="num">${r.actual_staff_count} scheduled</span>${tag(r)}</div>`).join("")}
      </div>`;
  },
  forecast({ rows }) {
    const block = state.owner.block;
    const byKey = new Map(rows.map((r) => [`${r.shift_date}|${r.shift_block}`, r]));
    const series = rows.filter((r) => r.shift_block === block).sort((a, b) => a.shift_date.localeCompare(b.shift_date)).slice(-14).map((r) => {
      const d = new Date(r.shift_date + "T12:00:00"); d.setDate(d.getDate() - 7);
      const prev = byKey.get(`${d.toISOString().slice(0, 10)}|${r.shift_block}`);
      return { ...r, naive: prev ? prev.actual_covers : null };
    });
    const acc = Models.accuracy(rows);
    const gaps = Models.staffingGaps(rows);
    return `
      <div class="ops-head"><div><span class="label">${rows.length} shifts</span><h2 class="display">Forecast</h2></div></div>
      <p class="sub">${BLOCK_LABEL[block]} · ${fmtDate(series[0].shift_date, { month: "short", day: "numeric" })}–${fmtDate(series[series.length - 1].shift_date, { month: "short", day: "numeric" })}</p>
      <div class="seg" style="margin-top:12px">${["lunch", "dinner"].map((b) => `<button data-block="${b}" class="${block === b ? "is-on" : ""}">${BLOCK_LABEL[b]}</button>`).join("")}</div>
      <div class="o-card chart">
        ${lineChart(series)}
        <div class="chart-legend"><span><i style="color:#2A211C"></i>Actual</span><span><i style="color:#C45C33"></i>Our forecast</span><span><i style="color:#6B605A;border-top-style:dashed"></i>Same as last week</span></div>
      </div>
      <div class="err-card"><span class="label">Forecast error</span><b class="num">±${acc.model.toFixed(0)} covers</b> with our forecast <span class="vs">vs</span> <b class="num">±${acc.naive.toFixed(0)}</b> guessing from last week</div>
      <div class="kpis">
        <div class="kpi"><span>Overstaffed</span><b class="num">${gaps.over}</b></div>
        <div class="kpi"><span>Short</span><b class="num">${gaps.under}</b></div>
        <div class="kpi"><span>Shifts</span><b class="num">${gaps.total}</b></div>
      </div>
      <p class="illustrative">Prep-time model v0.1, shift totals on synthetic data, ${acc.n} shifts scored. Error is the average gap between forecast and actual covers per shift.</p>
      <button class="linkbtn" data-otab="reorder">Review reorder plan <span>${icons.chev}</span></button>`;
  },
  reorder({ rows, dates }, r) {
    const next7 = dates.slice(-7);
    const covers = rows.filter((x) => next7.includes(x.shift_date)).reduce((s, x) => s + x.predicted_covers, 0);
    const menu = (BOOKME_SNAPSHOT.menus[r.restaurant_id] || []).filter((m) => m.category !== "Drinks");
    const popSum = menu.reduce((s, m) => s + (m.popularity_score || 1), 0) || 1;
    const byName = {};
    menu.forEach((m) => {
      const share = (m.popularity_score || 1) / popSum;
      const row = (byName[m.name] ||= { name: m.name, qty: 0, low: false, id: m.item_id });
      row.qty += covers * share;
    });
    const plan = Object.values(byName).map((p) => {
      const qty = Math.round(p.qty);
      const onHand = Math.round(qty * ((p.id * 7919) % 100) / 100);
      return { ...p, qty, low: onHand < qty * 0.4 };
    }).sort((a, b) => b.qty - a.qty).slice(0, 8);
    const low = plan.filter((p) => p.low).length;
    return `
      <div class="ops-head"><div><span class="label">Next delivery</span><h2 class="display">Reorder</h2></div></div>
      <p class="sub">Portions to prep for the next 7 shifts' forecast (${covers} covers), from each dish's share of past orders.</p>
      <div class="table">
        <div class="th"><span>Dish</span><span>Portions</span></div>
        ${plan.map((p) => `<div class="tr"><span class="n">${esc(p.name)}${p.low ? `<br><span class="pill bad" style="margin-top:4px">Below threshold</span>` : ""}</span><span class="q num">${p.qty}</span></div>`).join("")}
      </div>
      <div class="o-card" style="display:flex;justify-content:space-between"><span class="sub">${plan.length} dishes</span><b style="color:var(--accent)">${low} need attention</b></div>
      <p class="illustrative">Phase 2: ingredient-level thresholds need usage data from the POS, which arrives with the Toast integration. Stock on hand is illustrative.</p>`;
  },
};

// ================================================================ DEMO PANEL
const demo = {
  toggle: document.getElementById("demoToggle"), panel: document.getElementById("demoPanel"), source: document.getElementById("demoSource"),
  diner: document.getElementById("demoDiner"), dinerLabel: document.getElementById("demoDinerLabel"),
  restaurant: document.getElementById("demoRestaurant"), restaurantLabel: document.getElementById("demoRestaurantLabel"),
  jumps: document.getElementById("demoJumps"),
};
const JUMPS = [["search", "Search"], ["home", "Results"], ["restaurant", "Restaurant"], ["menu", "Menu"], ["order", "Order + ETA"], ["pay", "Pay & split"], ["review", "Review"]];

function syncDemoPanel() {
  document.querySelectorAll(".demo-seg button").forEach((b) => b.classList.toggle("is-on", b.dataset.mode === state.mode));
  const isOwner = state.mode === "owner";
  demo.diner.hidden = isOwner; demo.dinerLabel.hidden = isOwner;
  demo.restaurant.hidden = !isOwner; demo.restaurantLabel.hidden = !isOwner;
  if (isOwner) demo.restaurant.value = String(state.owner.restaurantId ?? "");
  else demo.diner.value = String(state.user?.user_id ?? "");
}
async function ensureRestaurant() { if (!state.restaurant) await openRestaurant(nearby()[0] || nearby({ useQuery: false })[0]); }
async function ensureCart() {
  await ensureRestaurant();
  if (!state.cart.length) {
    const ok = scoredMenu().filter((d) => d.fit.level === "ok" || d.fit.level === "caution").sort((a, b) => b.match - a.match).slice(0, 2);
    state.cart = ok.map((d) => ({ ...state.menu.items.find((m) => m.item_id === d.item_id), quantity: 1 }));
  }
}
async function jump(name) {
  state.mode = "diner";
  if (["restaurant", "menu"].includes(name)) await ensureRestaurant();
  if (["order", "pay", "review"].includes(name)) await ensureCart();
  if (name === "order") state.order = null;
  if (["pay", "review"].includes(name) && !state.order) {
    try { state.order = withAppEta(await Data.placeOrder(state.user, state.restaurant.restaurant_id, state.cart)); } catch (e) { state.error = e.message; }
    state.assign = Object.fromEntries(state.cart.map((c, i) => [c.item_id, i % people().length]));
  }
  if (name === "home") state.query.applied = true;
  state.history = name === "search" ? [] : name === "home" ? ["search"] : ["search", "home"];
  state.current = null;
  go(name, { replace: true });
}
async function setMode(mode) {
  state.mode = mode; state.history = []; state.current = null;
  if (mode === "owner") {
    state.owner.restaurantId = state.owner.restaurantId || state.restaurant?.restaurant_id || nearby({ useQuery: false })[0].restaurant_id;
    go("owner", { replace: true });
    await loadOwner(state.owner.restaurantId);
    render();
  } else go("search", { replace: true });
}
function resetDiner() {
  Object.assign(state, { restaurant: null, tables: [], menu: null, cart: [], order: null, error: "", showWhy: new Set(), showCustomize: new Set(), checkedIn: false, openedThisVisit: new Set(), party: 3, slot: "7:30", seatZone: null, tipPct: 18, split: "even", assign: {}, review: { stars: 0, text: "", skip: new Set() }, history: [], current: null, mode: "diner" });
  state.query = { text: "", cuisine: null, budget: tierFor(state.user), budgetSet: false, occasion: "talk", applied: false, relaxed: false, extraTags: [], parsed: null, editing: false, manual: {} };
  go("search", { replace: true });
}
function pickFriends() {
  const others = state.users.filter((u) => u.user_id !== state.user.user_id);
  const plain = others.filter((u) => !u.dietary_tags);
  state.friends = [...plain, ...others.filter((u) => u.dietary_tags)].slice(0, 2);
}
function initDemoPanel() {
  demo.toggle.addEventListener("click", () => { const open = demo.panel.hidden; demo.panel.hidden = !open; demo.toggle.setAttribute("aria-expanded", String(open)); });
  document.querySelectorAll(".demo-seg button").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
  // Two groups so a diner with no restrictions is one click away.
  const opt = (u) => `<option value="${u.user_id}">${esc(u.full_name)} · ${u.dietary_tags ? esc(u.dietary_tags) : "no restrictions"}</option>`;
  const withTags = state.users.filter((u) => u.dietary_tags).slice(0, 20);
  const noTags = state.users.filter((u) => !u.dietary_tags).slice(0, 20);
  if (!withTags.concat(noTags).includes(state.user)) (state.user.dietary_tags ? withTags : noTags).unshift(state.user);
  demo.diner.innerHTML = `<optgroup label="With dietary needs">${withTags.map(opt).join("")}</optgroup><optgroup label="No restrictions">${noTags.map(opt).join("")}</optgroup>`;
  demo.diner.addEventListener("change", async () => {
    state.user = state.users.find((u) => u.user_id === Number(demo.diner.value));
    if (!state.query.manual.budget) state.query.budget = tierFor(state.user);
    pickFriends();
    if (state.restaurant) state.menu = await Data.menu(state.restaurant.restaurant_id, state.user);
    state.cart = []; state.order = null; state.showWhy = new Set(); state.openedThisVisit = new Set();
    render();
  });
  demo.restaurant.innerHTML = state.restaurants.map((r) => `<option value="${r.restaurant_id}">${esc(r.name)} · ${esc(r.neighborhood)}</option>`).join("");
  demo.restaurant.addEventListener("change", async () => {
    state.owner.restaurantId = Number(demo.restaurant.value);
    await loadOwner(state.owner.restaurantId);
    render();
  });
  demo.jumps.innerHTML = JUMPS.map(([k, l]) => `<button data-jump="${k}">${l}</button>`).join("");
  demo.jumps.querySelectorAll("[data-jump]").forEach((b) => b.addEventListener("click", () => jump(b.dataset.jump)));
  document.getElementById("demoReset").addEventListener("click", resetDiner);
}

// ================================================================ BOOT
function fitPhone() {
  // The app now always fills the screen (see styles.css) — no scaling needed.
  phoneEl.style.transform = "";
}
function tickClock() {
  document.getElementById("phoneTime").textContent = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).replace(/\s?[AP]M/, "");
}
async function boot() {
  fitPhone(); window.addEventListener("resize", fitPhone);
  tickClock(); setInterval(tickClock, 30000);
  const { live, api } = await Data.init();
  demo.source.textContent = live ? `Live API · ${api.replace(/^https?:\/\//, "")}` : "Offline snapshot · API not running";
  demo.source.classList.add(live ? "is-live" : "is-offline");
  [state.restaurants, state.users] = await Promise.all([Data.restaurants(), Data.users()]);
  const wanted = Number(new URLSearchParams(location.search).get("user"));
  state.user = state.users.find((u) => u.user_id === wanted) || state.users.find((u) => u.dietary_tags === "gluten-free") || state.users.find((u) => (u.dietary_tags || "").includes("gluten-free")) || state.users[0];
  pickFriends();
  state.query.budget = tierFor(state.user);
  initDemoPanel();
  go("search", { replace: true });
}
boot();

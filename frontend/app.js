const CATEGORY_ORDER = ["Appetizers", "Entrees", "Desserts", "Drinks"];
const CATEGORY_LABEL = { "Appetizers": "Appetizers", "Entrees": "Main Course", "Desserts": "Desserts", "Drinks": "Drinks" };
const CUISINE_ICON = {
  Italian: "🍝", Mexican: "🌮", Thai: "🍜", American: "🍔", Indian: "🍛",
  Vietnamese: "🍲", Mediterranean: "🥙", Korean: "🍱", Southern: "🍗", Vegan: "🥬",
};

const state = {
  allRestaurants: [],
  filteredRestaurants: [],
  activeArea: "all",
  activeCuisine: "all",
  restaurantId: null,
  userId: null,
  cart: [], // { item_id, name, price, quantity }
};

const el = (id) => document.getElementById(id);

async function api(path, opts) {
  const res = await fetch(path, opts);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body}`);
  }
  return res.json();
}

// ---------------------------------------------------------------
// Init
// ---------------------------------------------------------------
async function init() {
  const { restaurants } = await api("/restaurants");
  state.allRestaurants = restaurants;
  state.filteredRestaurants = restaurants;
  state.restaurantId = restaurants[0].restaurant_id;

  buildAreaFilter(restaurants);
  buildCuisineChips(restaurants);
  renderRestaurantList();

  const { users } = await api("/users?limit=15");
  const uSelect = el("userSelect");
  uSelect.innerHTML = users
    .map((u) => {
      const tag = u.dietary_tags ? ` (${u.dietary_tags})` : "";
      return `<option value="${u.user_id}">${u.full_name}${tag}</option>`;
    })
    .join("");
  state.userId = users[0].user_id;
  uSelect.addEventListener("change", (e) => { state.userId = Number(e.target.value); loadMenu(); });

  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const view = btn.dataset.view;
      el("orderView").classList.toggle("hidden", view !== "order");
      el("restaurantView").classList.toggle("hidden", view !== "restaurant");
      el("filterbar").classList.toggle("hidden", view !== "order");
      if (view === "restaurant") loadForecast();
    });
  });

  el("placeOrderBtn").addEventListener("click", placeOrder);

  await selectRestaurant(state.restaurantId);
}

// ---------------------------------------------------------------
// Filters
// ---------------------------------------------------------------
function buildAreaFilter(restaurants) {
  const areas = [...new Set(restaurants.map((r) => r.neighborhood))].sort();
  const sel = el("areaSelect");
  sel.innerHTML = `<option value="all">All areas</option>` + areas.map((a) => `<option value="${a}">${a}</option>`).join("");
  sel.addEventListener("change", (e) => { state.activeArea = e.target.value; applyFilters(); });
}

function buildCuisineChips(restaurants) {
  const cuisines = [...new Set(restaurants.map((r) => r.cuisine_type))].sort();
  const box = el("cuisineChips");
  const chips = ["all", ...cuisines];
  box.innerHTML = chips
    .map((c) => `<button class="chip ${c === "all" ? "active" : ""}" data-cuisine="${c}">${c === "all" ? "All cuisines" : (CUISINE_ICON[c] || "") + " " + c}</button>`)
    .join("");
  box.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      box.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      state.activeCuisine = chip.dataset.cuisine;
      applyFilters();
    });
  });
}

function applyFilters() {
  state.filteredRestaurants = state.allRestaurants.filter((r) => {
    const areaOk = state.activeArea === "all" || r.neighborhood === state.activeArea;
    const cuisineOk = state.activeCuisine === "all" || r.cuisine_type === state.activeCuisine;
    return areaOk && cuisineOk;
  });
  renderRestaurantList();
}

// ---------------------------------------------------------------
// Restaurant list + selection
// ---------------------------------------------------------------
function renderRestaurantList() {
  const box = el("restaurantList");
  if (!state.filteredRestaurants.length) {
    box.innerHTML = `<p class="noResults">No restaurants match these filters.</p>`;
    return;
  }
  box.innerHTML = state.filteredRestaurants
    .map((r) => {
      const icon = CUISINE_ICON[r.cuisine_type] || "🍽️";
      const selected = r.restaurant_id === state.restaurantId ? "selected" : "";
      return `
        <div class="restCard ${selected}" data-id="${r.restaurant_id}">
          <div class="restTop">
            <span class="restName">${icon} ${r.name}</span>
            <span class="restPrice">${r.price_tier || ""}</span>
          </div>
          <div class="restMeta">${r.neighborhood} · ${r.cuisine_type}</div>
          <div class="restRating">${r.avg_rating ? "★ " + r.avg_rating.toFixed(1) : ""}</div>
        </div>`;
    })
    .join("");
  box.querySelectorAll(".restCard").forEach((card) => {
    card.addEventListener("click", () => selectRestaurant(Number(card.dataset.id)));
  });
}

async function selectRestaurant(id) {
  state.restaurantId = id;
  state.cart = [];
  renderCart();
  el("etaResult").classList.add("hidden");
  renderRestaurantList(); // refresh "selected" highlight
  renderRestaurantHeader();
  await Promise.all([loadMenu(), loadSeats()]);
}

function renderRestaurantHeader() {
  const r = state.allRestaurants.find((x) => x.restaurant_id === state.restaurantId);
  if (!r) return;
  const icon = CUISINE_ICON[r.cuisine_type] || "🍽️";
  el("restaurantHeader").innerHTML = `
    <div class="rhName">${icon} ${r.name}</div>
    <div class="rhMeta">
      <span class="badge">${r.neighborhood}</span>
      <span class="badge">${r.cuisine_type}</span>
      <span class="badge">${r.price_tier || ""}</span>
      ${r.avg_rating ? `<span class="badge rating">★ ${r.avg_rating.toFixed(1)}</span>` : ""}
    </div>`;
}

// ---------------------------------------------------------------
// Menu, grouped by category, with dietary filter + qty steppers
// ---------------------------------------------------------------
async function loadMenu() {
  const { menu } = await api(`/restaurants/${state.restaurantId}/menu?user_id=${state.userId}`);
  const groups = {};
  menu.forEach((item) => {
    const cat = item.category || "Entrees";
    (groups[cat] = groups[cat] || []).push(item);
  });

  const box = el("menuGroups");
  if (!menu.length) {
    box.innerHTML = `<p class="hint">No items match this diner's dietary restrictions at this restaurant.</p>`;
    return;
  }

  const orderedCats = CATEGORY_ORDER.filter((c) => groups[c]).concat(Object.keys(groups).filter((c) => !CATEGORY_ORDER.includes(c)));

  box.innerHTML = orderedCats
    .map((cat) => `
      <div class="categoryBlock">
        <div class="categoryTitle">${CATEGORY_LABEL[cat] || cat}</div>
        ${groups[cat].map((item) => menuItemHtml(item)).join("")}
      </div>`)
    .join("");

  box.querySelectorAll(".stepper").forEach((stepper) => {
    const itemId = Number(stepper.dataset.item);
    stepper.querySelector(".plus").addEventListener("click", () => changeQty(itemId, 1));
    stepper.querySelector(".minus").addEventListener("click", () => changeQty(itemId, -1));
  });
  box.querySelectorAll(".addBtn").forEach((btn) => {
    btn.addEventListener("click", () => addToCart(JSON.parse(btn.dataset.item)));
  });
}

function menuItemHtml(item) {
  const price = item.discount_price || item.price;
  const inCart = state.cart.find((c) => c.item_id === item.item_id);
  const badges = [
    item.is_vegetarian ? "Vegetarian" : null,
    item.is_vegan ? "Vegan" : null,
    item.is_gluten_free ? "Gluten-free" : null,
  ].filter(Boolean).map((b) => `<span class="dietPill">${b}</span>`).join("");

  const rightControl = inCart
    ? `<div class="stepper" data-item="${item.item_id}">
         <button class="minus">\u2212</button>
         <span class="qty">${inCart.quantity}</span>
         <button class="plus">+</button>
       </div>`
    : `<button class="addBtn" data-item='${JSON.stringify({ item_id: item.item_id, name: item.name, price })}'>Add</button>`;

  return `
    <div class="menuItem">
      <div>
        <div class="miName">${item.name}</div>
        <div class="miDesc">${item.description || ""}</div>
        ${badges ? `<div class="dietBadges">${badges}</div>` : ""}
      </div>
      <div class="miRight">
        <div class="miPrice">$${price.toFixed(2)}</div>
        ${rightControl}
      </div>
    </div>`;
}

function addToCart(item) {
  state.cart.push({ ...item, quantity: 1 });
  renderCart();
  loadMenu();
  el("etaResult").classList.add("hidden");
}

function changeQty(itemId, delta) {
  const row = state.cart.find((c) => c.item_id === itemId);
  if (!row) return;
  row.quantity += delta;
  if (row.quantity <= 0) state.cart = state.cart.filter((c) => c.item_id !== itemId);
  renderCart();
  loadMenu();
  el("etaResult").classList.add("hidden");
}

function renderCart() {
  const list = el("cartList");
  if (!state.cart.length) {
    list.innerHTML = `<p class="empty">No items yet — add something from the menu.</p>`;
    el("cartTotal").textContent = "";
    el("placeOrderBtn").disabled = true;
    return;
  }
  list.innerHTML = state.cart
    .map((c) => `<div class="cartRow"><span>${c.quantity} × ${c.name}</span><span>$${(c.price * c.quantity).toFixed(2)}</span></div>`)
    .join("");
  const total = state.cart.reduce((sum, c) => sum + c.price * c.quantity, 0);
  el("cartTotal").innerHTML = `<span>Subtotal</span><span>$${total.toFixed(2)}</span>`;
  el("placeOrderBtn").disabled = false;
}

// ---------------------------------------------------------------
// Place order -> real write + live ETA from the backend
// ---------------------------------------------------------------
async function placeOrder() {
  el("placeOrderBtn").disabled = true;
  el("placeOrderBtn").textContent = "Placing order…";
  try {
    const payload = {
      user_id: state.userId,
      restaurant_id: state.restaurantId,
      items: state.cart.map((c) => ({ item_id: c.item_id, quantity: c.quantity })),
    };
    const result = await api("/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    showEta(result.eta);
    state.cart = [];
    renderCart();
    await Promise.all([loadMenu(), loadSeats()]);
  } catch (err) {
    alert("Order failed: " + err.message);
  } finally {
    el("placeOrderBtn").textContent = "Place order";
  }
}

function showEta(eta) {
  el("etaMinutes").textContent = eta.predicted_prep_minutes;
  const b = eta.breakdown;
  el("etaBreakdown").innerHTML = `
    <li>${b.base_minutes_per_item.length} item(s), complexity factor ${b.complexity_factor}×</li>
    <li>${b.kitchen_load_orders_last_30min} order(s) in the kitchen right now (+${b.kitchen_load_minutes_added} min)</li>
    <li class="hint">${eta.model}</li>`;
  el("etaResult").classList.remove("hidden");
}

// ---------------------------------------------------------------
// Live seat availability
// ---------------------------------------------------------------
async function loadSeats() {
  const { tables } = await api(`/restaurants/${state.restaurantId}/tables`);
  el("seatGrid").innerHTML = tables
    .map((t) => `<div class="seat ${t.status}"><b>${t.table_number}</b>${t.capacity} seats<br>${t.status}</div>`)
    .join("");
}

// ---------------------------------------------------------------
// Restaurant view: staffing forecast
// ---------------------------------------------------------------
async function loadForecast() {
  const { forecast } = await api(`/restaurants/${state.restaurantId}/staffing-forecast`);
  const tbody = document.querySelector("#forecastTable tbody");
  tbody.innerHTML = forecast
    .map((f) => `<tr>
      <td>${f.shift_date}</td><td>${f.shift_block}</td>
      <td>${f.predicted_covers}</td><td>${f.actual_covers}</td>
      <td>${f.recommended_staff_count}</td><td>${f.actual_staff_count}</td>
    </tr>`)
    .join("");
}

init().catch((err) => {
  document.body.innerHTML = `<p style="padding:2rem;color:#993C1D">Could not reach the backend: ${err.message}. Make sure uvicorn is running.</p>`;
});

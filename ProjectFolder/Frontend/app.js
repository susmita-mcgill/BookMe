const state = {
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
// Init: populate selectors
// ---------------------------------------------------------------
async function init() {
  const { restaurants } = await api("/restaurants");
  const rSelect = el("restaurantSelect");
  rSelect.innerHTML = restaurants
    .map((r) => `<option value="${r.restaurant_id}">${r.name} — ${r.neighborhood}</option>`)
    .join("");
  state.restaurantId = restaurants[0].restaurant_id;

  const { users } = await api("/users?limit=15");
  const uSelect = el("userSelect");
  uSelect.innerHTML = users
    .map((u) => {
      const tag = u.dietary_tags ? ` (${u.dietary_tags})` : "";
      return `<option value="${u.user_id}">${u.full_name}${tag}</option>`;
    })
    .join("");
  state.userId = users[0].user_id;

  rSelect.addEventListener("change", (e) => { state.restaurantId = Number(e.target.value); refresh(); });
  uSelect.addEventListener("change", (e) => { state.userId = Number(e.target.value); refresh(); });

  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const view = btn.dataset.view;
      el("orderView").classList.toggle("hidden", view !== "order");
      el("restaurantView").classList.toggle("hidden", view !== "restaurant");
      if (view === "restaurant") loadForecast();
    });
  });

  el("placeOrderBtn").addEventListener("click", placeOrder);

  await refresh();
}

async function refresh() {
  state.cart = [];
  renderCart();
  el("etaResult").classList.add("hidden");
  await Promise.all([loadMenu(), loadSeats()]);
}

// ---------------------------------------------------------------
// Menu + dietary filter
// ---------------------------------------------------------------
async function loadMenu() {
  const { menu } = await api(`/restaurants/${state.restaurantId}/menu?user_id=${state.userId}`);
  const list = el("menuList");
  if (!menu.length) {
    list.innerHTML = `<p class="hint">No items match this diner's dietary restrictions at this restaurant.</p>`;
    return;
  }
  list.innerHTML = menu
    .map((item) => {
      const price = item.discount_price || item.price;
      const tags = [
        item.is_vegetarian ? "vegetarian" : null,
        item.is_vegan ? "vegan" : null,
        item.is_gluten_free ? "gluten-free" : null,
      ].filter(Boolean).join(" · ");
      return `
        <div class="menuItem">
          <div class="info">
            <h4>${item.name}</h4>
            <p>${item.category || ""}${tags ? " · " + tags : ""}</p>
          </div>
          <div class="price">$${price.toFixed(2)}</div>
          <button data-item='${JSON.stringify({ item_id: item.item_id, name: item.name, price })}'>Add</button>
        </div>`;
    })
    .join("");

  list.querySelectorAll("button[data-item]").forEach((btn) => {
    btn.addEventListener("click", () => addToCart(JSON.parse(btn.dataset.item)));
  });
}

function addToCart(item) {
  const existing = state.cart.find((c) => c.item_id === item.item_id);
  if (existing) existing.quantity += 1;
  else state.cart.push({ ...item, quantity: 1 });
  renderCart();
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
    await loadSeats();
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

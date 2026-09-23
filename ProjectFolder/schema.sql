-- ============================================================
-- In-Restaurant Dining App — Database Schema (v2, expanded)
-- BUSA693 Case: Reinventing the In-Restaurant Dining Experience
-- Postgres-compatible (tested against Supabase / Neon SQL editors)
--
-- Design notes:
--  - Lookup tables (dietary_tags, allergens) + junction tables replace
--    the earlier free-text columns — this is how a real production
--    schema would model many-to-many relationships instead of
--    comma-separated strings.
--  - restaurant_tables gives live seat inventory (the BRD's
--    "real-time seat availability, like concert ticketing").
--  - restaurant_staff + shifts make the staffing-forecast model
--    concrete: forecasts can be checked against who was actually
--    scheduled, not just an abstract "covers" number.
--  - item_modifiers / order_item_modifiers model real-world order
--    customization ("no onions", "extra cheese").
--  - promotions supports the freemium/discount mechanics in the
--    business model.
-- ============================================================

-- ------------------------------------------------------------
-- 1. LOOKUP TABLES
-- ------------------------------------------------------------

CREATE TABLE dietary_tags (
    dietary_tag_id  SERIAL PRIMARY KEY,
    name            TEXT UNIQUE NOT NULL,     -- vegetarian, vegan, gluten-free, dairy-free, halal, kosher
    description     TEXT
);

CREATE TABLE allergens (
    allergen_id     SERIAL PRIMARY KEY,
    name            TEXT UNIQUE NOT NULL,     -- nuts, shellfish, dairy, gluten, soy, eggs
    severity_note   TEXT
);

-- ------------------------------------------------------------
-- 2. USERS (diners)
-- ------------------------------------------------------------

CREATE TABLE users (
    user_id                  SERIAL PRIMARY KEY,
    full_name                TEXT NOT NULL,
    email                    TEXT UNIQUE NOT NULL,
    phone                    TEXT,
    password_hash            TEXT NOT NULL,           -- never store plaintext
    date_of_birth            DATE,
    home_neighborhood        TEXT,
    price_sensitivity        TEXT CHECK (price_sensitivity IN ('low','medium','high')) DEFAULT 'medium',
    favorite_cuisine         TEXT,
    loyalty_points           INT DEFAULT 0,
    loyalty_tier             TEXT CHECK (loyalty_tier IN ('none','silver','gold','platinum')) DEFAULT 'none',
    referral_code            TEXT UNIQUE,
    referred_by_user_id      INT REFERENCES users(user_id),
    marketing_opt_in         BOOLEAN DEFAULT TRUE,
    push_notifications_on    BOOLEAN DEFAULT TRUE,
    default_payment_token    TEXT,                    -- tokenized reference only
    is_active                BOOLEAN DEFAULT TRUE,
    last_login_at            TIMESTAMP,
    created_at               TIMESTAMP DEFAULT NOW(),
    updated_at               TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_dietary_tags (
    user_id         INT REFERENCES users(user_id),
    dietary_tag_id  INT REFERENCES dietary_tags(dietary_tag_id),
    PRIMARY KEY (user_id, dietary_tag_id)
);

-- ------------------------------------------------------------
-- 3. RESTAURANTS
-- ------------------------------------------------------------

CREATE TABLE restaurants (
    restaurant_id            SERIAL PRIMARY KEY,
    name                     TEXT NOT NULL,
    description              TEXT,
    cuisine_type             TEXT,
    price_tier               TEXT CHECK (price_tier IN ('$','$$','$$$','$$$$')),
    address_line1            TEXT,
    neighborhood             TEXT,
    city                     TEXT DEFAULT 'Chicago',
    state                    TEXT DEFAULT 'IL',
    zip_code                 TEXT,
    latitude                 NUMERIC(9,6),
    longitude                NUMERIC(9,6),
    phone                    TEXT,
    website_url              TEXT,
    seats_total              INT,
    avg_prep_time_minutes    INT,
    pos_provider             TEXT,                    -- e.g. 'Square', 'Toast', 'average/unknown'
    health_inspection_score  NUMERIC(4,1),
    health_inspection_date   DATE,
    avg_rating               NUMERIC(2,1) DEFAULT 0,
    total_reviews            INT DEFAULT 0,
    subscription_tier        TEXT CHECK (subscription_tier IN ('free','growth','pro')) DEFAULT 'free',
    onboarded_at             TIMESTAMP,
    is_active                BOOLEAN DEFAULT TRUE,
    owner_contact_email      TEXT,
    created_at               TIMESTAMP DEFAULT NOW(),
    updated_at               TIMESTAMP DEFAULT NOW()
);

CREATE TABLE restaurant_hours (
    hours_id        SERIAL PRIMARY KEY,
    restaurant_id   INT REFERENCES restaurants(restaurant_id),
    day_of_week     TEXT CHECK (day_of_week IN ('Mon','Tue','Wed','Thu','Fri','Sat','Sun')),
    open_time       TIME,
    close_time      TIME,
    is_closed       BOOLEAN DEFAULT FALSE
);

-- Live seat inventory — the BRD's "real-time seat availability, like concert ticketing"
CREATE TABLE restaurant_tables (
    table_id        SERIAL PRIMARY KEY,
    restaurant_id   INT REFERENCES restaurants(restaurant_id),
    table_number    TEXT,
    capacity        INT,
    location_zone   TEXT,                    -- 'patio', 'main dining', 'bar'
    status          TEXT CHECK (status IN ('available','seated','reserved','out_of_service')) DEFAULT 'available',
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 4. RESTAURANT STAFF & SHIFTS (grounds the staffing-forecast model)
-- ------------------------------------------------------------

CREATE TABLE restaurant_staff (
    staff_id        SERIAL PRIMARY KEY,
    restaurant_id   INT REFERENCES restaurants(restaurant_id),
    full_name       TEXT,
    role            TEXT CHECK (role IN ('server','host','cook','manager','dishwasher')),
    hourly_wage     NUMERIC(6,2),
    hire_date       DATE,
    is_active       BOOLEAN DEFAULT TRUE
);

CREATE TABLE shifts (
    shift_id                    SERIAL PRIMARY KEY,
    restaurant_id               INT REFERENCES restaurants(restaurant_id),
    staff_id                    INT REFERENCES restaurant_staff(staff_id),
    shift_date                  DATE,
    shift_block                 TEXT CHECK (shift_block IN ('breakfast','lunch','dinner','late_night')),
    start_time                  TIME,
    end_time                    TIME,
    role                        TEXT,
    was_scheduled_by_forecast   BOOLEAN DEFAULT FALSE   -- ties actual scheduling back to the model's recommendation
);

-- ------------------------------------------------------------
-- 5. MENU
-- ------------------------------------------------------------

CREATE TABLE menu_categories (
    category_id     SERIAL PRIMARY KEY,
    restaurant_id   INT REFERENCES restaurants(restaurant_id),
    name            TEXT,                    -- Appetizers, Entrees, Desserts, Drinks
    display_order   INT
);

CREATE TABLE menu_items (
    item_id             SERIAL PRIMARY KEY,
    restaurant_id       INT REFERENCES restaurants(restaurant_id),
    category_id         INT REFERENCES menu_categories(category_id),
    name                TEXT NOT NULL,
    description         TEXT,
    price               NUMERIC(6,2) NOT NULL,
    discount_price      NUMERIC(6,2),
    calories            INT,
    spice_level         INT CHECK (spice_level BETWEEN 0 AND 3),
    is_vegetarian       BOOLEAN DEFAULT FALSE,
    is_vegan            BOOLEAN DEFAULT FALSE,
    is_gluten_free      BOOLEAN DEFAULT FALSE,
    prep_time_minutes   INT,
    popularity_score    NUMERIC(5,2) DEFAULT 0,
    is_available        BOOLEAN DEFAULT TRUE,
    image_url           TEXT,
    created_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE menu_item_allergens (
    item_id       INT REFERENCES menu_items(item_id),
    allergen_id   INT REFERENCES allergens(allergen_id),
    PRIMARY KEY (item_id, allergen_id)
);

CREATE TABLE item_modifiers (
    modifier_id     SERIAL PRIMARY KEY,
    item_id         INT REFERENCES menu_items(item_id),
    name            TEXT,                    -- 'Extra cheese', 'No onions', 'Add avocado'
    price_delta     NUMERIC(5,2) DEFAULT 0,
    is_default      BOOLEAN DEFAULT FALSE
);

CREATE TABLE user_favorites (
    favorite_id     SERIAL PRIMARY KEY,
    user_id         INT REFERENCES users(user_id),
    restaurant_id   INT REFERENCES restaurants(restaurant_id),
    item_id         INT REFERENCES menu_items(item_id),
    favorite_type   TEXT CHECK (favorite_type IN ('restaurant','dish')),
    created_at      TIMESTAMP DEFAULT NOW(),
    CHECK (restaurant_id IS NOT NULL OR item_id IS NOT NULL)
);

-- ------------------------------------------------------------
-- 6. GROUP DECISION SUPPORT (Group Restaurant Recommender)
-- ------------------------------------------------------------

CREATE TABLE dining_groups (
    group_id              SERIAL PRIMARY KEY,
    group_name            TEXT,
    created_by_user_id    INT REFERENCES users(user_id),
    chosen_restaurant_id  INT REFERENCES restaurants(restaurant_id),
    status                TEXT CHECK (status IN ('voting','decided','expired')) DEFAULT 'voting',
    voting_deadline       TIMESTAMP,
    created_at            TIMESTAMP DEFAULT NOW()
);

CREATE TABLE group_members (
    group_id              INT REFERENCES dining_groups(group_id),
    user_id               INT REFERENCES users(user_id),
    voted_restaurant_id   INT REFERENCES restaurants(restaurant_id),
    joined_at             TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (group_id, user_id)
);

-- ------------------------------------------------------------
-- 7. RESERVATIONS
-- ------------------------------------------------------------

CREATE TABLE reservations (
    reservation_id        SERIAL PRIMARY KEY,
    user_id               INT REFERENCES users(user_id),
    restaurant_id         INT REFERENCES restaurants(restaurant_id),
    group_id              INT REFERENCES dining_groups(group_id),
    table_id              INT REFERENCES restaurant_tables(table_id),
    party_size            INT NOT NULL,
    reservation_time      TIMESTAMP NOT NULL,
    seating_preference    TEXT CHECK (seating_preference IN ('any','indoor','outdoor','bar')) DEFAULT 'any',
    special_requests      TEXT,
    status                TEXT CHECK (status IN ('confirmed','seated','cancelled','no_show')) DEFAULT 'confirmed',
    checked_in_at         TIMESTAMP,
    cancelled_at          TIMESTAMP,
    cancellation_reason   TEXT,
    source                TEXT CHECK (source IN ('app','phone','walk_in')) DEFAULT 'app',
    created_at            TIMESTAMP DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 8. PROMOTIONS (must precede orders — orders references promotions)
-- ------------------------------------------------------------

CREATE TABLE promotions (
    promo_id        SERIAL PRIMARY KEY,
    code            TEXT UNIQUE,
    restaurant_id   INT REFERENCES restaurants(restaurant_id),   -- NULL = platform-wide
    discount_type   TEXT CHECK (discount_type IN ('percent','fixed_amount','free_item')),
    discount_value  NUMERIC(6,2),
    valid_from      DATE,
    valid_to        DATE,
    max_uses        INT,
    times_used      INT DEFAULT 0,
    is_active       BOOLEAN DEFAULT TRUE
);

-- ------------------------------------------------------------
-- 9. ORDERS, ORDER ITEMS, PAYMENTS
-- ------------------------------------------------------------

CREATE TABLE orders (
    order_id                SERIAL PRIMARY KEY,
    reservation_id          INT REFERENCES reservations(reservation_id),
    user_id                 INT REFERENCES users(user_id),
    restaurant_id           INT REFERENCES restaurants(restaurant_id),
    order_type              TEXT CHECK (order_type IN ('dine_in','pre_order')) DEFAULT 'dine_in',
    order_time              TIMESTAMP DEFAULT NOW(),
    confirmed_time          TIMESTAMP,               -- geofence / waiter confirm-on-arrival
    ready_time              TIMESTAMP,               -- kitchen "ready" timestamp -> trains the Prep-ETA model
    served_time             TIMESTAMP,
    status                  TEXT CHECK (status IN ('placed','confirmed','preparing','ready','served','paid','cancelled')) DEFAULT 'placed',
    special_instructions    TEXT,
    subtotal_amount         NUMERIC(8,2),
    tax_amount              NUMERIC(8,2),
    service_fee             NUMERIC(6,2),
    discount_amount         NUMERIC(6,2) DEFAULT 0,
    total_amount            NUMERIC(8,2),
    applied_promo_id        INT REFERENCES promotions(promo_id),
    cancelled_at            TIMESTAMP,
    cancellation_reason     TEXT
);

CREATE TABLE order_items (
    order_item_id         SERIAL PRIMARY KEY,
    order_id              INT REFERENCES orders(order_id),
    item_id               INT REFERENCES menu_items(item_id),
    quantity              INT DEFAULT 1,
    unit_price            NUMERIC(6,2),
    special_instructions  TEXT,
    course                TEXT CHECK (course IN ('appetizer','main','dessert','drink')),
    status                TEXT CHECK (status IN ('pending','preparing','ready','served')) DEFAULT 'pending'
);

CREATE TABLE order_item_modifiers (
    order_item_id   INT REFERENCES order_items(order_item_id),
    modifier_id     INT REFERENCES item_modifiers(modifier_id),
    PRIMARY KEY (order_item_id, modifier_id)
);

CREATE TABLE payments (
    payment_id       SERIAL PRIMARY KEY,
    order_id         INT REFERENCES orders(order_id),
    payment_method   TEXT CHECK (payment_method IN ('card','apple_pay','google_pay')) DEFAULT 'card',
    payment_token    TEXT,                    -- tokenized reference only — never raw card data
    amount           NUMERIC(8,2),
    tip_amount       NUMERIC(6,2),
    split_type       TEXT CHECK (split_type IN ('single','even_split','by_item')) DEFAULT 'single',
    split_count      INT DEFAULT 1,
    status           TEXT CHECK (status IN ('pending','completed','failed','refunded')) DEFAULT 'completed',
    refund_amount    NUMERIC(6,2) DEFAULT 0,
    refund_reason    TEXT,
    processor_fee    NUMERIC(6,2),
    paid_at          TIMESTAMP DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 10. BEHAVIORAL DATA (Dish Recommender) & REVIEWS
-- ------------------------------------------------------------

CREATE TABLE interactions (
    interaction_id    SERIAL PRIMARY KEY,
    user_id           INT REFERENCES users(user_id),
    restaurant_id     INT REFERENCES restaurants(restaurant_id),
    item_id           INT REFERENCES menu_items(item_id),
    session_id        TEXT,
    device_type       TEXT CHECK (device_type IN ('ios','android','web')),
    interaction_type  TEXT CHECK (interaction_type IN ('view','click','favorite','reorder','share')),
    source_screen     TEXT,                    -- 'menu', 'search', 'group_vote', 'recommendation'
    occurred_at       TIMESTAMP DEFAULT NOW()
);

CREATE TABLE reviews (
    review_id                SERIAL PRIMARY KEY,
    user_id                  INT REFERENCES users(user_id),
    restaurant_id            INT REFERENCES restaurants(restaurant_id),
    order_id                 INT REFERENCES orders(order_id),   -- requires a real order -> "transaction-verified"
    overall_rating           INT CHECK (overall_rating BETWEEN 1 AND 5),
    food_rating              INT CHECK (food_rating BETWEEN 1 AND 5),
    service_rating           INT CHECK (service_rating BETWEEN 1 AND 5),
    ambiance_rating          INT CHECK (ambiance_rating BETWEEN 1 AND 5),
    review_text              TEXT,
    restaurant_response      TEXT,
    restaurant_response_at   TIMESTAMP,
    helpful_votes            INT DEFAULT 0,
    is_flagged               BOOLEAN DEFAULT FALSE,
    created_at               TIMESTAMP DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 11. RESTAURANT-FACING ANALYTICS LAYER (the labour-forecast differentiator)
--     Deliberately separate from the transactional tables above.
-- ------------------------------------------------------------

CREATE TABLE staffing_forecast (
    forecast_id               SERIAL PRIMARY KEY,
    restaurant_id             INT REFERENCES restaurants(restaurant_id),
    shift_date                DATE,
    shift_block               TEXT CHECK (shift_block IN ('breakfast','lunch','dinner','late_night')),
    predicted_covers          INT,
    actual_covers             INT,
    recommended_staff_count   INT,
    actual_staff_count        INT,
    confidence_score          NUMERIC(4,3),
    model_version             TEXT,
    weather_condition         TEXT CHECK (weather_condition IN ('clear','rain','snow','extreme_heat','extreme_cold')),
    is_holiday                BOOLEAN DEFAULT FALSE,
    local_event_nearby        BOOLEAN DEFAULT FALSE,
    labor_cost_estimate       NUMERIC(8,2),
    labor_cost_actual         NUMERIC(8,2),
    created_at                TIMESTAMP DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 12. INDEXES — the queries that will actually run a lot
-- ------------------------------------------------------------

CREATE INDEX idx_orders_restaurant_time   ON orders(restaurant_id, order_time);
CREATE INDEX idx_reservations_restaurant  ON reservations(restaurant_id, reservation_time);
CREATE INDEX idx_interactions_user        ON interactions(user_id, occurred_at);
CREATE INDEX idx_menu_items_restaurant    ON menu_items(restaurant_id);
CREATE INDEX idx_staffing_restaurant_date ON staffing_forecast(restaurant_id, shift_date);
CREATE INDEX idx_shifts_restaurant_date   ON shifts(restaurant_id, shift_date);

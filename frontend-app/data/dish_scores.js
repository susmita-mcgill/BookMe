// PLACEHOLDER dish-recommender output — see js/models.js and README.md for the
// expected shape (rank, dish, overall, preference, dietary, budget, nutrition,
// quality, speed), keyed by "user_id:restaurant_id".
//
// Cleared out on purpose: this file was generated against an earlier version
// of the database. Rows are matched by item_id number, and item_ids were
// reassigned when the menu was rebuilt with cuisine-matched dishes — so old
// rows (including some correctly scored 0%, meaning "hidden for this diner")
// were landing on entirely different, unrelated dishes. That's what was
// causing 0% matches to show up on dishes that were never supposed to be
// hidden.
//
// Until the real dish-recommender output is regenerated against the current
// database, the app's own fallback formula in models.js (dishScore) computes
// a reasonable score directly — it never returns 0% for a dish that isn't
// actually excluded by the diner's real dietary profile. Hiding for allergies
// is handled separately and correctly (see dietFit in models.js), so nothing
// about the dietary filter depends on this file.
window.BOOKME_DISH_SCORES = {};

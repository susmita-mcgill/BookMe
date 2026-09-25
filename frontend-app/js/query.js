// Reads a free-text query like "cheap korean for 4, one's vegan" and pulls out
// the table's constraints (party size, budget, cuisine, occasion, dietary) and
// what the diner is craving (the words left over).
//
// This is simple keyword matching so the demo runs anywhere. In production the
// same job would go to a language model; the output shape would stay the same.
window.Query = (function () {
  const NUMBERS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };

  const DIETARY = [
    [/\bvegan\b/, "vegan"],
    [/\bvegetarian\b|\bveggie\b|\bno meat\b/, "vegetarian"],
    [/gluten[\s-]?free|\bceliac\b|\bcoeliac\b|\bno gluten\b/, "gluten-free"],
    [/dairy[\s-]?free|lactose|\bno dairy\b/, "dairy-free"],
    [/nut[\s-]?free|nut allergy|\bno nuts\b/, "nut-free"],
    [/\bhalal\b/, "halal"],
    [/\bkosher\b/, "kosher"],
  ];

  const OCCASION = [
    [/\bquick\b|\bfast\b|\bhurry\b|lunch break|\bgrab\b/, "quick"],
    [/celebrat|birthday|anniversary|\bspecial\b|promotion|\bparty\b/, "celebrate"],
    [/\btalk\b|catch up|catching up|\bdate\b|\bchill\b|\bquiet\b|\brelaxed\b/, "talk"],
  ];

  const CUISINE_WORDS = {
    Indian: ["indian", "curry"],
    Korean: ["korean", "kbbq"],
    Italian: ["italian", "pasta place"],
    Southern: ["southern", "soul food", "bbq", "barbecue"],
    Mexican: ["mexican"],
    Thai: ["thai"],
    Vietnamese: ["vietnamese", "pho"],
    Mediterranean: ["mediterranean", "greek"],
  };

  // Craving words that point at dishes whose names don't contain the word.
  const CRAVINGS = {
    noodles: ["Pad Thai", "Pasta Primavera"],
    noodle: ["Pad Thai", "Pasta Primavera"],
    pasta: ["Pasta Primavera"],
    rice: ["Fried Rice", "Bibimbap", "Mango Sticky Rice"],
    fish: ["Grilled Salmon", "Calamari"],
    seafood: ["Grilled Salmon", "Calamari"],
    chicken: ["Butter Chicken"],
    beef: ["Steak Frites"],
    meat: ["Steak Frites", "Tacos al Pastor", "Butter Chicken"],
    tacos: ["Tacos al Pastor"],
    healthy: ["Veggie Bowl", "Hummus Plate", "Grilled Salmon"],
    light: ["Veggie Bowl", "Hummus Plate", "Soup of the Day"],
    salad: ["Veggie Bowl"],
    bowl: ["Veggie Bowl", "Bibimbap"],
    sweet: ["Tiramisu", "Cheesecake", "Chocolate Cake", "Mango Sticky Rice", "Gulab Jamun"],
    dessert: ["Tiramisu", "Cheesecake", "Chocolate Cake", "Mango Sticky Rice", "Gulab Jamun"],
    desserts: ["Tiramisu", "Cheesecake", "Chocolate Cake", "Mango Sticky Rice", "Gulab Jamun"],
    cake: ["Cheesecake", "Chocolate Cake"],
    drinks: ["House Red Wine", "Craft Lager", "Mocktail", "Lemonade", "Iced Tea", "Espresso"],
    wine: ["House Red Wine"],
    beer: ["Craft Lager"],
    coffee: ["Espresso"],
    starters: ["Bruschetta", "Spring Rolls", "Hummus Plate", "Calamari", "Soup of the Day", "Nachos"],
    snacks: ["Bruschetta", "Spring Rolls", "Nachos", "Calamari"],
  };
  // "spicy" is read from each dish's spice level, not from its name.
  const SPICY = /\bspicy\b|\bhot\b|\bheat\b/;

  const STOP = new Set(("a an the and or with of for to in on at near around by from us me my our we i im i'm " +
    "one one's ones is are be some something somewhere place spot spots food dinner lunch tonight today " +
    "want wanna craving crave feel feeling like looking find get eat good great nice really please " +
    "people person friends friend guys group table us all just any anything who whos who's that " +
    "night evening out go going time meal up catch have has had get some after before share sharing").split(" "));

  function parse(text, cuisines = []) {
    const raw = (text || "").toLowerCase();
    let rest = " " + raw.replace(/[,.!?;]/g, " ") + " ";
    const out = { party: null, budget: null, cuisine: null, occasion: null, tags: [], spicy: false, terms: [], dishNames: [], understood: [] };
    const take = (re) => { rest = rest.replace(re, " "); };

    // Party size: "for 4", "party of four", "4 of us", "me and 2 friends", "date", "solo"
    // "me and 2 friends" / "with 3 friends" / "4 friends" count you too; "for 4" / "4 of us" don't.
    const N = "(\\d|one|two|three|four|five|six|seven|eight)";
    const num = (w) => Number(w) || NUMBERS[w];
    let m = rest.match(new RegExp(`\\b(?:me and|with)?\\s*${N}\\s+(?:friends?|others)\\b`));
    if (m) { out.party = num(m[1]) + 1; take(m[0]); }
    m = rest.match(new RegExp(`\\b(?:for|party of|table for|group of)\\s+${N}\\b`)) || rest.match(new RegExp(`\\b${N}\\s+(?:of us|people|ppl|guys)\\b`));
    if (!out.party && m) { out.party = num(m[1]); take(m[0]); }
    if (!out.party && /\bsolo\b|\bjust me\b|\balone\b/.test(rest)) { out.party = 1; take(/\bsolo\b|\bjust me\b|\balone\b/); }
    if (!out.party && /\bdate\b/.test(rest)) out.party = 2;

    // Budget: "cheap", "under $20", "fancy", "$$"
    m = rest.match(/under\s*\$?\s*(\d+)/);
    if (m) { const n = Number(m[1]); out.budget = n <= 20 ? "$" : n <= 40 ? "$$" : "$$$"; take(m[0]); }
    else if (/\bcheap\b|\bbudget\b|\baffordable\b|\binexpensive\b|\bbroke\b/.test(rest)) { out.budget = "$"; take(/\bcheap\b|\bbudget\b|\baffordable\b|\binexpensive\b|\bbroke\b/); }
    else if (/\bfancy\b|\bsplurge\b|\bupscale\b|\bnice\b|\btreat\b/.test(rest)) { out.budget = "$$$"; take(/\bfancy\b|\bsplurge\b|\bupscale\b|\btreat\b/); }
    else if ((m = rest.match(/\${1,3}/))) { out.budget = m[0]; take(m[0]); }

    // Dietary (merged with the diner's profile later)
    for (const [re, tag] of DIETARY) if (re.test(rest)) { out.tags.push(tag); rest = rest.replace(new RegExp(re.source, "g"), " "); }

    // Occasion
    for (const [re, occ] of OCCASION) if (re.test(rest)) { out.occasion = out.occasion || occ; rest = rest.replace(new RegExp(re.source, "g"), " "); }

    // Cuisine
    for (const c of cuisines) {
      const words = CUISINE_WORDS[c] || [c.toLowerCase()];
      const hit = words.find((w) => rest.includes(" " + w + " ") || rest.includes(" " + w));
      if (hit) { out.cuisine = c; rest = rest.replace(hit, " "); break; }
    }

    // Spicy
    if (SPICY.test(rest)) { out.spicy = true; rest = rest.replace(new RegExp(SPICY.source, "g"), " "); }

    // Whatever's left is the craving
    out.terms = rest.split(/\s+/).filter((w) => w && w.length > 1 && !STOP.has(w) && !/^\d+$/.test(w));
    out.dishNames = [...new Set(out.terms.flatMap((t) => CRAVINGS[t] || []))];

    if (out.cuisine) out.understood.push(out.cuisine);
    if (out.budget) out.understood.push(out.budget);
    if (out.party) out.understood.push(out.party === 1 ? "Just you" : `Party of ${out.party}`);
    out.tags.forEach((t) => out.understood.push("+ " + t));
    // Occasion is parsed but not shown: it feeds the group restaurant recommender in Phase 2.
    if (out.spicy) out.understood.push("Spicy");
    out.terms.forEach((t) => out.understood.push(`“${t}”`));
    return out;
  }

  // Does this dish match what the diner is craving?
  function dishMatches(item, parsed) {
    if (!parsed.terms.length && !parsed.spicy) return false;
    const name = item.name.toLowerCase();
    const cat = (item.category || "").toLowerCase();
    const byTerm = parsed.terms.some((t) => name.includes(t) || (t.length > 3 && cat.startsWith(t.slice(0, -1))));
    const byCraving = parsed.dishNames.includes(item.name);
    const spicyOk = !parsed.spicy || ((item.spice_level || 0) >= 2 && /appetizer|entree|main/.test(cat));
    if (!parsed.terms.length) return spicyOk; // only "spicy"
    return (byTerm || byCraving) && spicyOk;
  }

  return { parse, dishMatches };
})();

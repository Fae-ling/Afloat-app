/* Food profiles, shared by Afloat (Family tab, where they're edited) and Meals (where they're used).
   Everyone's food details live on their family profile in Afloat's home/profiles:
     household:  profiles.people[name].meal = { id, diet, regular, meals, sex, kcalTarget, allergens, avoid, likes, notes, favorites, age }
     friends:    profiles.friends[i].meal   = { on, id, diet, regular, meals, sex, kcalTarget, allergens, avoid, likes, favorites }
                 (a friend's notes are their "Food and drink notes" field, friends[i].food)
   Children are the household's kids; their age comes from their birthday (meal.age only fills in when there's none).
   meal.id keeps the id a person had in Mealtime, so week plans made before the move still know who ate what. */
(function () {
  const ALLERGENS = [['gluten', 'Gluten'], ['crustaceans', 'Crustaceans'], ['eggs', 'Eggs'], ['fish', 'Fish'], ['peanuts', 'Peanuts'], ['soy', 'Soy'], ['milk', 'Milk'], ['nuts', 'Tree nuts'], ['celery', 'Celery'], ['mustard', 'Mustard'], ['sesame', 'Sesame'], ['sulphites', 'Sulphites'], ['lupin', 'Lupin'], ['molluscs', 'Molluscs']];
  const PERSON_DIETS = [['omnivore', 'Eats everything'], ['pescatarian', 'Pescatarian'], ['vegetarian', 'Vegetarian'], ['vegan', 'Vegan']];
  const SLOTS = ['Breakfast', 'Morning snack', 'Lunch', 'Afternoon snack', 'Dinner'];
  /* Daily reference values for planning. Adults: EU reference intakes (Reg. 1169/2011), EFSA fibre 25 g, WHO 400 g fruit & veg.
     Children: approximate EFSA dietary reference values by age band, salt limits per WHO/SACN, fruit & veg scaled down for the youngest.
     "sex" holds the energy (moderately active) and protein values for females (f) and males (m); the top-level values are used when sex isn't given. */
  const ADULT = { label: 'Adult', kcal: 2000, protein: 50, fiber: 25, salt: 6, fruitveg: 400, fat: [20, 35], sex: { f: { kcal: 2000, protein: 50 }, m: { kcal: 2500, protein: 57 } } };
  const BANDS = [
    { max: 3, label: 'Child 1–3 y', kcal: 1100, protein: 13, fiber: 10, salt: 2, fruitveg: 240, fat: [30, 40], sex: { f: { kcal: 1050, protein: 13 }, m: { kcal: 1150, protein: 13 } } },
    { max: 6, label: 'Child 4–6 y', kcal: 1450, protein: 19, fiber: 14, salt: 3, fruitveg: 320, fat: [20, 35], sex: { f: { kcal: 1400, protein: 19 }, m: { kcal: 1500, protein: 19 } } },
    { max: 10, label: 'Child 7–10 y', kcal: 1800, protein: 28, fiber: 16, salt: 5, fruitveg: 400, fat: [20, 35], sex: { f: { kcal: 1750, protein: 28 }, m: { kcal: 1850, protein: 28 } } },
    { max: 14, label: 'Child 11–14 y', kcal: 2200, protein: 42, fiber: 19, salt: 6, fruitveg: 400, fat: [20, 35], sex: { f: { kcal: 2100, protein: 42 }, m: { kcal: 2300, protein: 43 } } },
    { max: 17, label: 'Teen 15–17 y', kcal: 2500, protein: 55, fiber: 21, salt: 6, fruitveg: 400, fat: [20, 35], sex: { f: { kcal: 2300, protein: 48 }, m: { kcal: 2800, protein: 60 } } }];
  const SEX_WORD = { f: { adult: 'Adult woman', child: 'Girl', teen: 'Teen girl', short: 'Woman' }, m: { adult: 'Adult man', child: 'Boy', teen: 'Teen boy', short: 'Man' } };
  const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : 0; };
  function guide(p) {
    let g = ADULT; if (p && p.child) { const age = num(p.age) || 8; g = BANDS.find(b => age <= b.max) || BANDS[BANDS.length - 1]; }
    const s = SEX_WORD[p && p.sex] ? p.sex : null, o = s ? g.sex[s] : {};
    const label = !s ? g.label : !p.child ? SEX_WORD[s].adult : g.label.replace(/^(Child|Teen)/, w => w === 'Teen' ? SEX_WORD[s].teen : SEX_WORD[s].child);
    return { ...g, ...o, label, kcal: num(p && p.kcalTarget) || o.kcal || g.kcal };
  }
  const slug = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  function ageFrom(bd) {
    if (!bd || String(bd).startsWith('1900')) return null;
    const b = new Date(bd + 'T12:00'), n = new Date(); if (isNaN(b)) return null;
    let y = n.getFullYear() - b.getFullYear(); if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) y--; return y;
  }
  const arr = a => Array.isArray(a) ? a.map(String).filter(Boolean) : [];
  const slots = a => Array.isArray(a) ? a.filter(s => SLOTS.includes(s)) : [...SLOTS];
  /* a food profile as stored, with every field filled in */
  function meal(m, defRegular) {
    m = m || {};
    return { diet: PERSON_DIETS.some(d => d[0] === m.diet) ? m.diet : 'omnivore', regular: m.regular == null ? !!defRegular : !!m.regular,
      meals: { weekday: slots(m.meals && m.meals.weekday), weekend: slots(m.meals && m.meals.weekend) },
      sex: SEX_WORD[m.sex] ? m.sex : '', kcalTarget: num(m.kcalTarget) > 0 ? Math.round(num(m.kcalTarget)) : null,
      allergens: arr(m.allergens), avoid: arr(m.avoid), likes: arr(m.likes), notes: String(m.notes || ''), favorites: arr(m.favorites) };
  }
  /* everyone Meals cooks for: the household (adults, then the kids) and friends marked "cook for them sometimes".
     With { all: true }, every partner and friend is included (for tagging favourite dishes); inMeals says who's cooked for. */
  function people(profiles, household, opt) {
    const pr = profiles || {}, hh = household || {}, pp = pr.people || {};
    const ads = (hh.members || []).map(m => m.name).filter(Boolean), kids = (hh.kids || []).filter(k => k && !ads.includes(k));
    const out = [];
    for (const n of [...ads, ...kids]) {
      const i = pp[n] || {}, m = i.meal || {}, child = kids.includes(n), a = ageFrom(i.birthday);
      out.push({ ...meal(m, true), id: m.id || 'h-' + (slug(n) || n), name: n, child, age: child ? (a != null ? a : (num(m.age) || null)) : null, color: i.color || '', home: true, inMeals: true, key: n });
    }
    for (const f of pr.friends || []) {
      if (!f || !f.id) continue; const m = f.meal || {}; if (!m.on && !(opt && opt.all)) continue;
      out.push({ ...meal(m, false), inMeals: !!m.on, notes: String(f.food || ''), id: m.id || 'f-' + f.id, name: f.name, child: false, age: null, color: f.color || '', home: false, key: f.id });
    }
    return out;
  }
  window.FOOD = { ALLERGENS, PERSON_DIETS, SLOTS, SEX_WORD, ADULT, BANDS, guide, slug, ageFrom, meal, people };
})();

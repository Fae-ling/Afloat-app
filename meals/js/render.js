/* Meals · meals/js/render.js · render(): the tabs, recipes, who eats each meal.
   Plain script: shares one scope with the other meals/js/*.js files (loaded in order by meals/index.html). */
/* ---------- render ---------- */
function render(){
  const a=document.activeElement,fid=a&&a.id&&document.getElementById("view").contains(a)?a.id:null,sel=fid&&a.selectionStart!=null?[a.selectionStart,a.selectionEnd]:null;
  document.querySelectorAll(".tab").forEach(t=>t.setAttribute("aria-current",t.dataset.tab===S.tab?"page":"false"));
  const st=document.getElementById("status");st.textContent=db?`${S.recipes.length} recipes · ${S.people.length} people`:"";
  let html="";
  if(!db)html+=`<div class="note">Saving isn't available in this view. Open Mealtime on claude.ai while signed in to keep your recipes.</div>`;
  else if(S.dbError)html+=`<div class="note">Your data can't be reached right now. Reload the page in a little while.</div>`;
  else if(S.slow&&loading())html+=`<div class="note">Still waiting for your saved data. It may be slow to connect.</div>`;
  html+=({recipes:vRecipes,plan:vPlan,shopping:vShopping,home:vHome}[S.tab]||vRecipes)();
  document.getElementById("view").innerHTML=html;
  if(fid){const el=document.getElementById(fid);if(el){el.focus();if(sel)try{el.setSelectionRange(...sel)}catch{}}}
}
function loadingBlock(what){return `<div class="empty"><div class="spin"></div><p>Loading ${what}…</p></div>`}

function vRecipes(){
  const q=S.q.toLowerCase().trim(),sf=S.safeFor||"",favP=sf.startsWith("fav:")?favPerson(sf.slice(4)):null,pf=!favP&&sf?person(sf):null;
  let rs=[...S.recipes].sort((a,b)=>(a.name||"").localeCompare(b.name||""));
  if(q)rs=rs.filter(r=>(r.name+" "+(r.tags||[]).join(" ")+" "+(r.ingredients||[]).map(i=>i.name).join(" ")+" "+(r.original?[r.original.name,...(r.original.ingredients||[])].join(" "):"")).toLowerCase().includes(q));
  if(pf)rs=rs.filter(r=>!conflictsFor(r,pf).length);
  if(favP)rs=rs.filter(r=>(favP.favorites||[]).includes(r.id));
  const L=LANGS[recipeLang()],untx=S.recipes.filter(needsTx).length;
  const tx=S.tx?`<div class="txbar"><span class="progress"><span class="spin"></span>Translating to ${L}: ${S.tx.done} of ${S.tx.total} recipes</span><button class="btn sm" data-act="stopTx">Stop</button></div>`
    :untx&&sample&&db&&!loading()&&!S.cv&&!S.ex?`<div class="txbar"><span><b>${untx} recipe${untx>1?"s":""}</b> may not be in ${L} yet.</span><button class="btn sm primary" data-act="translateAll">Translate all to ${L}</button><span class="muted" style="font-size:.85rem">Originals are kept on each recipe.</span></div>`:"";
  const head=`<div class="bar"><div><h1>Recipes</h1><p>Calories and macros are per serving.</p></div><div class="actions"><label class="row" for="langSel"><span class="muted" style="font-size:.9rem;white-space:nowrap">Recipe language</span><select id="langSel" style="width:auto" ${db&&!S.tx?"":"disabled"}>${Object.entries(LANGS).map(([k,v])=>`<option value="${k}" ${recipeLang()===k?"selected":""}>${v}</option>`).join("")}</select></label><button class="btn" data-act="manageTags" ${db?"":"disabled"}>Allergens${S.tags.length?` · ${S.tags.length}`:""}</button><button class="btn primary" data-act="newRecipe" ${db?"":"disabled"}>Add recipe</button></div></div>${tx}${loading()?"":cvBanner()+exBanner(S.recipes.filter(r=>!hasExtra(r)).length)}
  <div class="filters"><input id="q" type="search" placeholder="Search by name, tag or ingredient" value="${esc(S.q)}" data-bind="q" aria-label="Search recipes">
  <select id="safeFor" data-bind="safeFor" aria-label="Filter by person"><option value="">Everyone's recipes</option>${S.people.map(p=>`<option value="${p.id}" ${S.safeFor===p.id?"selected":""}>Safe for ${esc(p.name)}</option>`).join("")}${S.favPeople.length?`<optgroup label="Favourites">${S.favPeople.map(p=>`<option value="fav:${p.id}" ${S.safeFor==="fav:"+p.id?"selected":""}>${esc(p.name)}'s favourites</option>`).join("")}</optgroup>`:""}</select></div>`;
  if(loading()&&!S.recipes.length)return head+loadingBlock("recipes");
  if(!S.recipes.length)return head+`<div class="empty"><h2>No recipes yet</h2><p>Add a recipe from a photo, a screenshot or by typing it in.<br>Claude reads it and works out calories, macros and allergens.</p><button class="btn primary" data-act="newRecipe" ${db?"":"disabled"}>Add your first recipe</button></div>`;
  if(!rs.length)return head+`<div class="empty"><p>No recipes match. Try a different search or person.</p></div>`;
  const ph=S.recipes.some(r=>photoSrc(r.photo));
  return head+`<div class="grid">${rs.map(r=>card(r,ph)).join("")}</div>`;
}
function card(r,ph){const t=totals(r),src=photoSrc(r.photo);return `<article class="card" tabindex="0" role="button" data-act="openRecipe" data-id="${r.id}">
  ${src||ph?`<div class="ph">${photoImg(src,"")}</div>`:""}
  <div class="card-top"><span class="diet ${esc(r.diet)}">${esc(DIET_LABEL[r.diet]||"")}</span><span class="muted">${isExample(r)?'<span class="example">Example</span> · ':""}${r.minutes?esc(r.minutes)+" min · ":""}serves ${esc(r.servings||1)}</span></div>
  <h3>${esc(r.name||"Untitled")}</h3>
  <div class="nums"><b>${Math.round(t.kcal)}</b> kcal · P ${Math.round(t.protein)} g · C ${Math.round(t.carbs)} g · F ${Math.round(t.fat)} g</div>
  ${macroBar(t)}
  <div class="chips">${alChips(recipeAllergens(r),'<span class="okchip">No listed allergens</span>')}</div>${favs(r.id).length?`<div class="favline"><span class="heart" aria-hidden="true">♥</span>${esc(favs(r.id).map(p=>p.name).join(", "))}</div>`:""}</article>`}

function vPlan(){
  const ws=S.weekStart,today=dkey(new Date());
  let html=`<div class="bar"><div><h1>Week menu</h1><p>Each meal starts with the people who usually eat it at home. Tap names to change a single meal; portions follow.</p></div>
  <div class="weeknav"><button class="btn sm" data-act="week" data-d="-7" aria-label="Previous week">‹</button><span class="lbl">${weekLabel(ws)}</span><button class="btn sm" data-act="week" data-d="7" aria-label="Next week">›</button><button class="btn sm ghost" data-act="week" data-d="0">This week</button>${mcp&&T_LISTS.org?`<button class="btn sm" data-act="planToTrello" ${S.trBusy?"disabled":""}>${S.trBusy==="plan"?"Sending…":"Menu to Trello"}</button>`:""}</div></div>`;
  if(loading()&&!Object.keys(S.plan).length)return html+loadingBlock("your plan");
  html+=nutritionPanel()+`<div class="days" data-sw-l="[data-act=week][data-d='7']" data-sw-r="[data-act=week][data-d='-7']" data-sw-kind="page">`;
  for(let i=0;i<7;i++){
    const d=addDays(ws,i),k=dkey(d),dy=day(k);
    const meals=dy.meals;
    const kcal=meals.reduce((s,m)=>{const r=isHome(m)?homeAsRecipe(m):recipe(m.recipeId);return s+(r?totals(r).kcal:0)},0);
    html+=`<section class="day ${k===today?"today":""}"><header><span class="dname">${fmtDay.format(d)}</span><span class="muted">${fmtDate.format(d)}</span>${kcal?`<span class="kc"><span class="num">${Math.round(kcal)}</span> kcal per person</span>`:""}</header>
    ${S.people.length?"":`<button class="btn sm ghost" data-act="family" style="justify-self:start">Add food details in Us → Family</button>`}
    <ul class="meals">${SLOTS.map(s=>{const ms=meals.filter(m=>normSlot(m.slot)===s);
      return `<li class="slotg ${ms.length?"":"is-empty"}"><div class="slotg-hd"><span class="slotname">${s}</span><button class="slotadd" data-act="addMeal" data-k="${k}" data-s="${s}" aria-label="Add ${s.toLowerCase()} on ${fmtDay.format(d)}" ${db?"":"disabled"}>+</button></div>${ms.length?attRow(k,s,ms.some(m=>!isPlain(m))):""}${ms.map(m=>mealRow(m,k)).join("")}</li>`}).join("")}</ul></section>`;
  }
  return html+`</div>`;
}
/* who eats this meal: a toggle per person, guests stepper and the resulting portions */
function attRow(k,s,withPortions=true){
  const sp=slotPeople(k,s),g=slotGuests(k,s),hc=headcount(k,s),n=sp.length+g;
  return `<div class="att">${S.people.map(p=>`<button class="pchip sm" data-act="togglePerson" data-k="${k}" data-s="${s}" data-id="${p.id}" aria-pressed="${sp.includes(p.id)}">${avatar(p)}${esc(p.name)}</button>`).join("")}
  <span class="step" title="Guests"><button data-act="guests" data-k="${k}" data-s="${s}" data-d="-1" aria-label="Fewer guests at ${s.toLowerCase()}">−</button><span>+${g}</span><button data-act="guests" data-k="${k}" data-s="${s}" data-d="1" aria-label="More guests at ${s.toLowerCase()}">+</button></span>
  <span class="muted att-n">${n?`${n} eating${withPortions&&hc!==n?` · ${fmtP(hc)} portions`:""}`:withPortions?"Nobody selected · 1 portion":"Nobody selected"}</span></div>`;
}
function mealRow(m,k){
  const s=normSlot(m.slot);
  if(isOther(m)){
    const o=m.other;
    return `<div class="meal other"><span class="name">${esc(OTHER[o.kind]||"Other")}</span>
    <span class="ctl"><button class="x" data-act="rmMeal" data-k="${k}" data-m="${m.id}" aria-label="Remove ${esc(OTHER[o.kind]||"meal")}">×</button></span>
    ${o.note?`<div class="meta"><span>${esc(o.note)}</span></div>`:""}</div>`;
  }
  if(isHome(m)){
    const it=homeItem(m),n=homeName(m),nu=nutFor(n),cs=homeConflicts(n,slotPeople(k,s)),left=it?leftLbl(daysLeft(it)):"";
    return `<div class="meal home ${cs.length?"warn":""}"><span class="name">${esc(n)}</span>
    <span class="ctl"><button class="x" data-act="rmMeal" data-k="${k}" data-m="${m.id}" aria-label="Remove ${esc(n)}">×</button></span>
    <div class="meta"><span class="homechip">at home</span>${left?`<span>${esc(left)}</span>`:""}${nu?`<span><span class="num">~${nu.kcal} kcal</span> · ${nu.serving?esc(nu.serving)+" · ":""}rough guess</span>`:""}${it?"":`<span>no longer on the At home list</span>`}
    ${cs.length?`<span class="warnline">Not for ${whyText(cs)}</span>`:""}</div></div>`;
  }
  const r=recipe(m.recipeId);
  if(!r)return `<div class="meal"><span class="muted">Deleted recipe</span><button class="x" data-act="rmMeal" data-k="${k}" data-m="${m.id}" aria-label="Remove">×</button></div>`;
  const cs=conflicts(r,slotPeople(k,s)),t=totals(r),pt=portions(m,k);
  return `<div class="meal ${cs.length?"warn":""}"><button class="name" data-act="openRecipe" data-id="${r.id}">${esc(r.name)}</button>
  <span class="ctl"><button class="x" data-act="rmMeal" data-k="${k}" data-m="${m.id}" aria-label="Remove ${esc(r.name)}">×</button></span>
  <div class="meta">${m.leftover?`<span class="homechip">leftovers</span>`:""}<span class="step"><button data-act="portions" data-k="${k}" data-m="${m.id}" data-d="-1" aria-label="Fewer portions">−</button><span>${fmtP(pt)}</span><button data-act="portions" data-k="${k}" data-m="${m.id}" data-d="1" aria-label="More portions">+</button></span>
  <span>${m.portions==null?"portions (auto)":`portions · <button class="btn sm ghost" data-act="autoPortions" data-k="${k}" data-m="${m.id}">reset to ${fmtP(headcount(k,s))}</button>`}</span><span class="num">${Math.round(t.kcal)} kcal</span>${m.note?`<span>${esc(m.note)}</span>`:""}
  ${m.leftover?"":`<button class="btn sm ghost" data-act="mealLeft" data-k="${k}" data-m="${m.id}">${S.pantry.some(p=>pNorm(p.name)===pNorm(leftName(r.name)))?"Leftovers in At home ✓":"Leftovers?"}</button>`}
  ${cs.length?`<span class="warnline">Not safe for ${whyText(cs)}</span>`:""}</div></div>`;
}

function shoppingItems(){
  const map=new Map();
  for(let i=0;i<7;i++){if(!S.shopDays[i])continue;const k=dkey(addDays(S.weekStart,i)),dy=day(k);
    for(const m of dy.meals){const r=recipe(m.recipeId);if(!r||m.leftover)continue;const f=portions(m,k)/Math.max(1,num(r.servings)||1);
      for(const ing of r.ingredients||[]){const name=String(ing.name||"").trim();if(!name)continue;const[bu,mult]=norm(ing.unit);
        const id=name.toLowerCase()+"|"+bu;let it=map.get(id);
        if(!it){it={id,name,unit:bu,qty:0,vague:false,aisle:AISLES.includes(ing.aisle)?ing.aisle:"Other",from:new Set()};map.set(id,it)}
        if(ing.qty===null||ing.qty===""||ing.qty===undefined)it.vague=true;else it.qty+=num(ing.qty)*mult*f;
        it.from.add(r.name)}}}
  return[...map.values()];
}
function itemAmt(it){return it.qty>0?fmtAmt(it.qty,it.unit)+(it.vague?" + extra":""):(it.unit&&it.unit!=="pcs"?uLabel(it.unit):"as needed")}
function shopDoc(){return S.shop[dkey(S.weekStart)]||{checked:{},extras:[]}}
function vShopping(){
  const sd=shopDoc(),items=shoppingItems(),checked=sd.checked||{};
  const groups=AISLES.map(a=>[a,items.filter(i=>i.aisle===a).sort((x,y)=>x.name.localeCompare(y.name))]).filter(g=>g[1].length);
  const extras=sd.extras||[];
  const left=items.filter(i=>!checked[i.id]).length+extras.filter(e=>!e.done).length;
  let html=`<div class="bar"><div><h1>Shopping list</h1><p>Amounts are scaled to the portions in your week plan.</p></div>
  <div class="weeknav"><button class="btn sm" data-act="week" data-d="-7" aria-label="Previous week">‹</button><span class="lbl">${weekLabel(S.weekStart)}</span><button class="btn sm" data-act="week" data-d="7" aria-label="Next week">›</button><button class="btn sm ghost" data-act="week" data-d="0">This week</button></div></div>
  <div class="shop"><div>`;
  if(loading()&&!items.length)html+=loadingBlock("your list");
  else if(!items.length&&!extras.length)html+=`<div class="empty"><h2>Nothing to buy yet</h2><p>Add meals to this week's plan and their ingredients show up here.</p><button class="btn" data-act="tab" data-tab="plan">Open the week plan</button></div>`;
  for(const[a,its]of groups){const vis=S.hideChecked?its.filter(i=>!checked[i.id]):its;if(!vis.length)continue;
    html+=`<div class="aisle"><h3>${esc(a)}</h3><ul class="items">${vis.map(i=>`<li class="item ${checked[i.id]?"done":""}" data-sw-r="input[type=checkbox]"><input type="checkbox" id="c_${esc(i.id.replace(/[^a-z0-9]/gi,"_"))}" data-act="check" data-id="${esc(i.id)}" ${checked[i.id]?"checked":""} aria-label="${esc(i.name)}"><label class="nm" for="c_${esc(i.id.replace(/[^a-z0-9]/gi,"_"))}">${esc(i.name)}</label><span class="amt">${esc(itemAmt(i))}</span><span class="from">${esc([...i.from].join(", "))}</span></li>`).join("")}</ul></div>`}
  const visEx=S.hideChecked?extras.filter(e=>!e.done):extras;
  if(visEx.length)html+=`<div class="aisle"><h3>Added by you</h3><ul class="items">${visEx.map(e=>`<li class="item ${e.done?"done":""}" data-sw-r="input[type=checkbox]"><input type="checkbox" data-act="checkExtra" data-id="${e.id}" ${e.done?"checked":""} aria-label="${esc(e.text)}"><span class="nm">${esc(e.text)}</span><button class="x" data-act="rmExtra" data-id="${e.id}" aria-label="Remove">×</button></li>`).join("")}</ul></div>`;
  html+=`</div><aside class="side"><div><b class="num">${left}</b> <span class="muted">items left to buy</span></div>
  <div><div class="muted" style="font-size:.8rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px">Days included</div><div class="daytoggles">${[0,1,2,3,4,5,6].map(i=>`<button data-act="shopDay" data-i="${i}" aria-pressed="${!!S.shopDays[i]}">${fmtDay.format(addDays(S.weekStart,i))}</button>`).join("")}</div></div>
  <form class="row" data-form="extra"><input type="text" id="extraText" placeholder="Add an item, e.g. coffee" aria-label="Add an item"><button class="btn" ${db?"":"disabled"}>Add</button></form>
  <label class="check"><input type="checkbox" data-act="hideChecked" ${S.hideChecked?"checked":""}>Hide ticked items</label>
  <div class="row"><button class="btn" data-act="copyList">Copy list</button><button class="btn ghost" data-act="clearChecks">Untick all</button></div>
  ${mcp?`<button class="btn primary" data-act="shopToTrello" ${S.trBusy?"disabled":""}>${S.trBusy==="shop"?"Sending to Trello…":`Send to Trello · ${esc(T_NAMES.shop)}`}</button><span class="muted" style="font-size:.82rem">Unticked items become cards. Ones already on the list are skipped.</span>`:""}
  <textarea id="copyFallback" rows="6" hidden readonly></textarea></aside></div>`;
  return html;
}

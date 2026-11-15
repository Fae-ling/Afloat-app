/* Meals · meals/js/cook.js · What can we cook?.
   Plain script: shares one scope with the other meals/js/*.js files (loaded in order by meals/index.html). */
/* ---------- what can we cook? ---------- */
async function cookAsk(){
  const ck=S.cook;if(!ck||!sample)return;ck.busy=true;ck.err="";renderSheet();
  const items=S.pantry.map(x=>`${x.name} (${LEVEL[x.level||3]}${daysLeft(x)!=null?`, ${leftLbl(daysLeft(x))}`:""})`),st=staples(),stOk=st.list.filter(x=>!st.low[x.id]).map(x=>x.name);
  const ppl=S.people.filter(p=>p.regular!==false).map(p=>`${p.name}${p.child?` (child${p.age?", "+p.age:""})`:""}: ${[p.diet&&p.diet!=="omnivore"?p.diet:"",(p.allergens||[]).length?"allergic to "+p.allergens.map(alLabel).filter(Boolean).join(", "):"",(p.avoid||[]).length?"won't eat "+p.avoid.join(", "):"",(p.likes||[]).length?"likes "+p.likes.join(", "):""].filter(Boolean).join("; ")||"eats everything"}`);
  const recs=S.recipes.filter(r=>!isExample(r)).slice(0,120).map(r=>`${r.id}: ${r.name} — ${(r.ingredients||[]).map(i=>i.name).filter(Boolean).slice(0,14).join(", ")}${r.minutes?` (${r.minutes} min)`:""}`);
  const mood={quick:"quick: about 15–20 minutes, very little washing up",normal:"an ordinary family meal",nice:"something a bit nicer"}[ck.mood||"normal"];
  try{const out=await sample.json(`Help a family of two adults and two small girls decide what to cook (${ck.slot||"dinner"}). Take away the deciding: three clear options.
At home now: ${items.join("; ")||"(nothing listed)"}.
Pantry staples they have: ${stOk.join(", ")}.
Who's eating: ${ppl.join(" | ")||"the family"}.
Their recipes (id: name — ingredients): ${recs.join("\n")||"(none)"}
Wanted: ${mood}.
Option 1 uses up what needs using soonest. Option 2 is one of their own recipes that fits what's at home. Option 3 is quick. Every option must be safe for everyone's allergies and avoid what they won't eat. Prefer what's at home; keep missing things few.
Reply with only JSON: {"ideas": [{"title": "", "recipeId": "id from their recipes, or null", "why": "one short sentence", "minutes": 20, "uses": ["names from At home"], "missing": ["short Czech names to buy"], "ingredients": ["for new ideas only: ingredient with amount"], "steps": ["for new ideas only: short steps"]}]}`,{modelTier:"quick",signal:(aiCtl=new AbortController()).signal});
    ck.ideas=(Array.isArray(out?.ideas)?out.ideas:[]).slice(0,3).map(x=>({title:String(x.title||"").trim().slice(0,80),recipeId:recipe(x.recipeId)?x.recipeId:null,why:String(x.why||"").slice(0,200),minutes:Math.round(+x.minutes||0)||null,uses:(x.uses||[]).map(String).slice(0,10),missing:(x.missing||[]).map(String).slice(0,10),ingredients:(x.ingredients||[]).map(String).slice(0,25),steps:(x.steps||[]).map(String).slice(0,15)})).filter(x=>x.title);
    if(!ck.ideas.length)ck.err="Claude didn't come back with ideas. Try again.";
  }catch(e){ck.err=e?.code==="aborted"?"":aiErr(e)}finally{aiCtl=null;if(S.cook){S.cook.busy=false;renderSheet()}}
}
function sCook(){
  const ck=S.cook||{},moods=[["quick","Quick"],["normal","Normal"],["nice","Something nice"]];
  return hd("What can we cook?")+`<div class="sheet-bd"><div class="row" style="flex-wrap:wrap">${moods.map(([k,l])=>`<button class="btn sm" data-act="cookMood" data-v="${k}" aria-pressed="${(ck.mood||"normal")===k}">${l}</button>`).join("")}</div>
    ${ck.busy?`<div class="empty"><div class="spin"></div><p>Looking at what's at home…</p></div>`:""}${ck.err?`<div class="note">${esc(ck.err)}</div>`:""}
    ${(ck.ideas||[]).map((x,i)=>{const r=x.recipeId?recipe(x.recipeId):null,cs=r?conflicts(r,S.people.filter(p=>p.regular!==false).map(p=>p.id)):[];
      return `<div class="idea"><h3 style="margin:0">${esc(r?r.name:x.title)}${x.minutes?` <span class="muted" style="font-weight:400;font-size:.85rem">· ${x.minutes} min</span>`:""}</h3><p style="margin:4px 0">${esc(x.why)}</p>
      ${x.uses.length?`<p class="muted" style="margin:0;font-size:.85rem">Uses: ${esc(x.uses.join(", "))}</p>`:""}${x.missing.length?`<p class="muted" style="margin:0;font-size:.85rem">Missing: ${esc(x.missing.join(", "))}</p>`:'<p class="muted" style="margin:0;font-size:.85rem">Nothing to buy.</p>'}
      ${cs.length?`<p class="note" style="margin:6px 0">Not safe for ${whyText(cs)}</p>`:""}
      ${!r&&x.ingredients.length?`<details><summary class="muted" style="font-size:.85rem">How</summary><ul style="margin:4px 0">${x.ingredients.map(t=>`<li>${esc(t)}</li>`).join("")}</ul><ol style="margin:4px 0">${x.steps.map(t=>`<li>${esc(t)}</li>`).join("")}</ol></details>`:""}
      <div class="row" style="flex-wrap:wrap;margin-top:6px"><button class="btn sm primary" data-act="cookPlan" data-i="${i}">Add to the plan</button>${x.missing.length?`<button class="btn sm" data-act="cookMissing" data-i="${i}">Missing → ${esc(T_NAMES.shop)}</button>`:""}${r?`<button class="btn sm ghost" data-act="openRecipe" data-id="${r.id}">Open recipe</button>`:""}</div></div>`}).join("")}
    </div><div class="sheet-ft"><button class="btn primary" data-act="cookGo" ${ck.busy?"disabled":""}>${ck.ideas?"Other ideas":"Give me three ideas"}</button><button class="btn" data-act="close">Close</button></div>`;
}
async function cookPlan(i){
  const x=S.cook?.ideas?.[i];if(!x)return;let id=x.recipeId;
  if(!id&&db){id=uid();const body={name:x.title,servings:4,minutes:x.minutes||"",source:"Claude, from what was at home",diet:"omnivore",tags:["from-at-home"],allergens:[],ingredients:x.ingredients.map(t=>({...blankIng(),name:t})),steps:x.steps,notes:x.why,lang:recipeLang(),createdAt:Date.now()};
    S.recipes.push({id,...body});await write("recipes/"+id,()=>db.doc("recipes/"+id).set(body));toast("Saved to your recipes.")}
  if(id)ACT.addToPlan({id});
}

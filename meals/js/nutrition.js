/* Meals · meals/js/nutrition.js · The weekly nutrition check and ranking recipes against the guidelines.
   Plain script: shares one scope with the other meals/js/*.js files (loaded in order by meals/index.html). */
/* ---------- weekly nutrition check ----------
   Compares the balance of what one person eats this week (energy shares and amounts per 1000 kcal) with their guideline,
   so a half-planned week is judged on its mix, not on missing meals. Children's portions are scaled to their energy needs. */
function analyse(pid){
  const p=pid?person(pid):null,g=guide(p),share=portionFactor(p),T={kcal:0,protein:0,carbs:0,fat:0,fiber:0,sugar:0,satfat:0,salt:0,fruitveg:0};
  let days=0,kcalX=0,fish=0,outN=0,leftN=0;const missing=new Set(),used=new Set();
  for(let i=0;i<7;i++){
    const k=dkey(addDays(S.weekStart,i)),dy=day(k);let here=false;
    for(const m of dy.meals){
      if(pid&&!slotPeople(k,normSlot(m.slot)).includes(pid))continue;
      /* eating out is never counted; leftovers only when linked to a recipe; foods at home use Claude's rough guess (none yet: skipped) */
      if(isOther(m)){if(m.other.kind==="out")outN++;else leftN++;continue}
      const home=isHome(m),r=home?homeAsRecipe(m):recipe(m.recipeId);
      if(home&&!r)continue;
      here=true;
      if(!r||(p&&(home?homeConflictsFor(r.name,p):conflictsFor(r,p)).length))continue;if(!home)used.add(r.id);
      const t=totals(r);for(const x of["kcal","protein","carbs","fat"])T[x]+=t[x]*share;
      if(hasExtra(r)){kcalX+=t.kcal*share;for(const[x]of EXTRA)T[x]+=num(r.extra[x])*share}else missing.add(r.id);
      if(recipeAllergens(r).includes("fish"))fish++;
    }
    if(here)days++;
  }
  return{p,g,T,days,kcalX,fish,outN,leftN,missing:[...missing],used};
}
function checks(a){
  const{T,g,kcalX}=a,E=T.kcal,out=[];if(E<=0)return out;
  const day1=per1000=>per1000/1000*g.kcal,add=(key,label,value,target,status)=>out.push({key,label,value,target,status});
  const pE=T.protein*4/E*100,cE=T.carbs*4/E*100,fE=T.fat*9/E*100,pMin=g.protein*4/g.kcal*100;
  add("protein","Protein",`${Math.round(day1(T.protein/E*1000))} g a day`,`at least ${g.protein} g`,pE<pMin*.9?"low":"ok");
  add("carbs","Carbohydrates",`${Math.round(cE)}% of energy`,"45–60%",cE<45?"low":cE>60?"high":"ok");
  add("fat","Fat",`${Math.round(fE)}% of energy`,`${g.fat[0]}–${g.fat[1]}%`,fE<g.fat[0]?"low":fE>g.fat[1]?"high":"ok");
  if(kcalX>0){
    const per=x=>day1(T[x]/kcalX*1000),sE=T.satfat*9/kcalX*100,suE=T.sugar*4/kcalX*100;
    add("fiber","Fibre",`${Math.round(per("fiber"))} g a day`,`at least ${g.fiber} g`,per("fiber")<g.fiber*.9?"low":"ok");
    add("fruitveg","Fruit & veg",`${Math.round(per("fruitveg"))} g a day`,`at least ${g.fruitveg} g`,per("fruitveg")<g.fruitveg*.9?"low":"ok");
    add("satfat","Saturated fat",`${Math.round(sE)}% of energy`,"at most 10%",sE>11?"high":"ok");
    add("sugar","Sugar",`${Math.round(suE)}% of energy`,"at most 18%",suE>19?"high":"ok");
    add("salt","Salt",`${rnd(per("salt"),1)} g a day`,`at most ${g.salt} g`,per("salt")>g.salt*1.1?"high":"ok");
  }
  if(!a.p||(DIET_RANK[a.p.diet]??0)<2)add("fish","Fish",`${a.fish} meal${a.fish===1?"":"s"} this week`,"1–2 a week",a.fish?"ok":"low");
  return out;
}
/* ranks recipes this person can eat by how much they push the flagged values toward the guideline */
function recFor(a,cks){
  const low=new Set(cks.filter(c=>c.status==="low").map(c=>c.key)),high=new Set(cks.filter(c=>c.status==="high").map(c=>c.key)),g=a.g;
  if(!low.size&&!high.size)return[];
  return S.recipes.filter(r=>!(a.p&&conflictsFor(r,a.p).length)).map(r=>{
    const t=totals(r),e=Math.max(50,t.kcal),x=hasExtra(r)?r.extra:null,why=[],ratio=(v,target)=>v/e/(target/g.kcal);
    let s=0;
    if(low.has("protein")){const q=ratio(t.protein,g.protein);if(q>1.3){s+=q;why.push(`${Math.round(t.protein)} g protein`)}}
    if(low.has("fiber")&&x){const q=ratio(x.fiber,g.fiber);if(q>1.2){s+=q;why.push(`${rnd(x.fiber,1)} g fibre`)}}
    if(low.has("fruitveg")&&x){const q=ratio(x.fruitveg,g.fruitveg);if(q>1.2){s+=q;why.push(`${Math.round(x.fruitveg)} g fruit & veg`)}}
    if(low.has("fish")&&recipeAllergens(r).includes("fish")){s+=2;why.push("fish")}
    if(low.has("carbs")&&t.carbs*4/e>.55){s+=1;why.push(`${Math.round(t.carbs*4/e*100)}% of energy from carbs`)}
    if(low.has("fat")&&t.fat*9/e>.3){s+=.5;why.push(`${Math.round(t.fat*9/e*100)}% of energy from fat`)}
    if(high.has("salt")&&x){const q=ratio(x.salt,g.salt);if(q<.7){s+=.5;why.push("low in salt")}else if(q>1)s-=q}
    if(high.has("satfat")&&x){const p=x.satfat*9/e*100;if(p<7){s+=.5;why.push("low in saturated fat")}else if(p>10)s-=(p-10)/4}
    if(high.has("sugar")&&x){const p=x.sugar*4/e*100;if(p<10){s+=.5;why.push("low in sugar")}else if(p>18)s-=(p-18)/6}
    if(high.has("fat")&&t.fat*9/e>.35)s-=1;
    if(high.has("carbs")&&t.carbs*4/e>.6)s-=1;
    if(a.p&&(a.p.favorites||[]).includes(r.id)&&why.length){s+=.5;why.push(`${a.p.name}'s favourite`)}
    const planned=a.used.has(r.id);if(planned)s-=.5;
    return{r,s,why,planned};
  }).filter(o=>o.s>0&&o.why.length).sort((m,n)=>n.s-m.s).slice(0,4);
}
function nutritionPanel(){
  const ids=new Set();let any=false;
  for(let i=0;i<7;i++){const k=dkey(addDays(S.weekStart,i));for(const m of day(k).meals){if(isOther(m)||(isHome(m)&&!nutFor(homeName(m))))continue;any=true;slotPeople(k,normSlot(m.slot)).forEach(id=>ids.add(id))}}
  const head=x=>`<div class="nutri-hd"><h2>Nutrition check</h2>${x||""}</div>`;
  if(!any)return `<section class="nutri">${head()}${homeBanner()}<p class="muted" style="margin:0">Add meals to this week to see how they compare with nutrition guidelines for each person, with recipe ideas to fill any gaps.</p></section>`;
  const list=[...ids],sel=list.includes(S.nutriFor)?S.nutriFor:(list[0]??null),a=analyse(sel),cks=checks(a),issues=cks.filter(c=>c.status!=="ok");
  const status=`<span class="muted" style="font-size:.9rem">${issues.length?`${issues.length} thing${issues.length>1?"s":""} to improve`:"On track"}</span>`;
  if(!S.nutriOpen)return `<section class="nutri">${head(status+`<button class="btn sm ghost" data-act="nutriToggle">Show</button>`)}</section>`;
  const recs=recFor(a,cks),nm=a.p?esc(a.p.name):"a typical adult",perDay=a.days?Math.round(a.T.kcal/a.days):0;
  return `<section class="nutri">${head(status+`<button class="btn sm ghost" data-act="nutriToggle">Hide</button>`)}
  ${list.length>1?`<div class="table">${list.map(id=>{const p=person(id);return `<button class="pchip" data-act="nutriFor" data-id="${id}" aria-pressed="${id===sel}">${avatar(p)}${esc(p.name)}</button>`}).join("")}</div>`:""}
  <p style="margin:0;max-width:75ch">${a.p?`<b>${nm}</b> · ${esc(a.g.label)}, about ${a.g.kcal} kcal a day.`:`No one from the family is at the table this week, so this uses the guideline for ${nm}.`} The meals ${a.p?"they eat at home":"planned"} give about <b class="num">${perDay}</b> kcal a day over ${a.days} day${a.days===1?"":"s"} (${Math.round(perDay/a.g.kcal*100)}% of daily needs${a.p?"; meals eaten elsewhere aren't counted":""}).</p>
  ${notCounted(a)}${exBanner(a.missing.length)}${homeBanner()}
  <div class="cks">${cks.map(c=>`<div class="ck ${c.status}"><div class="ck-top"><span>${c.label}</span><span class="pill ${c.status}">${c.status==="ok"?"On track":c.status==="low"?"Too low":"Too high"}</span></div><b>${esc(c.value)}</b><small>Guideline: ${esc(c.target)}</small></div>`).join("")}</div>
  ${issues.length?`<div class="sec">Recipes that would help ${nm}</div>${recs.length?`<ul class="recs">${recs.map(o=>`<li class="rec"><button class="name" data-act="openRecipe" data-id="${o.r.id}"><b>${esc(o.r.name)}</b><small>${esc(o.why.join(" · "))} per serving${o.planned?" · already this week":""}</small></button><button class="btn sm" data-act="addToPlan" data-id="${o.r.id}" data-ws="${dkey(S.weekStart)}">Add to plan</button></li>`).join("")}</ul>`:`<p class="muted" style="margin:0">None of your saved recipes clearly helps here. Try adding recipes with more vegetables, pulses, wholegrains or fish.</p>`}`:`<p class="okchip" style="margin:0">This week's plan is in line with the guidelines for ${nm}.</p>`}
  <p class="muted" style="margin:0;font-size:.8rem">Compares the balance of planned meals with EU reference intakes and EFSA and WHO guidance, assuming one portion per person${a.p?.child?`, a child's portion being ${fmtP(portionFactor(a.p))} of an adult's`:""}. Meals someone can't eat are left out of their check. Estimates for planning, not medical advice.</p></section>`;
}

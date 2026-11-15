/* Meals · meals/js/ai.js · Claude: reading and translating recipes, nutrition estimates, units.
   Plain script: shares one scope with the other meals/js/*.js files (loaded in order by meals/index.html). */
/* ---------- AI ---------- */
function aiErr(e){switch(e?.code){
  case"cancelled":return null;
  case"not_granted":case"sampling_disabled":return"Claude isn't allowed for this page, so photos can't be read. You can still enter recipes by hand.";
  case"rate_limited":return"Claude is busy or you've reached a usage limit. Try again in a minute.";
  case"image_rejected":return"One of the images couldn't be read. Try a JPEG or PNG screenshot.";
  case"images_unavailable":return"This view can't send photos to Claude. Paste the recipe text instead.";
  case"invalid_json":return"Claude's answer came back garbled. Press the button again.";
  case"refused":return"Claude couldn't read that. Try a clearer photo or paste the text.";
  case"session_expired":return"Your claude.ai session expired. Sign in again and retry.";
  default:return"Couldn't reach Claude. Try again.";
}}
const UNIT_RULES=`Units: every "unit" is one of these codes: g, kg, ml, l, tsp, tbsp, pcs, clove, pinch, bunch, can, pack (empty only when "qty" is null, e.g. "salt to taste"). "qty" is a plain number for the recipe's stated servings (0.5, never "1/2").
Convert every imperial or US measure to metric, using the real weight of that ingredient rather than a fixed volume: weigh solids in g (1 cup flour ≈ 125 g, sugar ≈ 200 g, brown sugar ≈ 220 g, rice ≈ 190 g, oats ≈ 90 g, grated cheese ≈ 100 g, chopped nuts ≈ 120 g, 1 stick butter = 113 g, 1 oz = 28 g, 1 lb = 454 g) and measure liquids in ml (1 cup = 240 ml, 1 fl oz = 30 ml, 1 pint = 475 ml). Keep tsp and tbsp for small amounts up to 4 tbsp. Round to sensible kitchen amounts (113 g → 115 g, 454 g → 450 g, 236 ml → 240 ml). Use European pack sizes (a 15 oz can → a 400 g can).
In steps and notes, write temperatures in °C (°F → °C rounded to the nearest 5 °C, gas mark 4 = 180 °C; note fan ovens about 20 °C lower if the recipe says so), lengths and tin sizes in cm, and weights or volumes in g and ml, written like "180 °C" and "20 cm".`;
function rules(){return `${UNIT_RULES}
Nutrition: kcal, protein, carbs, fat (grams) are estimates for the FULL amount of that ingredient as listed (the whole recipe, not per serving), rounded to whole numbers. If no amount is given, assume a typical amount.
"aisle" is one of: ${AISLES.join(", ")}.
"allergens" uses only these ids (EU 14 major allergens) that the recipe contains: ${ALLERGENS.map(a=>a[0]).join(", ")}.
"diet" is "vegan", "vegetarian", "pescatarian" or "omnivore" (contains meat or poultry).`+(S.tags.length?`
Also add these custom allergen ids to "allergens" when the recipe contains that specific ingredient. They are narrower than the standard ids, so keep adding "nuts" for any tree nut as well: ${S.tags.map(t=>`"${t.id}" = ${t.label}${(t.keywords||[]).length?` (e.g. ${t.keywords.join(", ")})`:""}`).join("; ")}.`:"")}

function langRules(){
  const L=LANGS[recipeLang()],v=vocab();
  return `Write the recipe name, tags, ingredient names, steps and notes in ${L}, translating if the source is in another language. Translate the meaning in natural ${L} cooking language, not word for word, and keep every number, temperature and time exactly. Ingredient names are plain supermarket names in the nominative, lowercase unless a proper noun${recipeLang()==="cs"?' (e.g. "hladká mouka", "kuřecí stehna", "cherry rajčata")':""}. Keep "unit" as one of the English unit codes listed.${v.length?`\nWhen an ingredient is the same as one of these existing names, use that exact name: ${v.join(", ")}.`:""}`;
}
function txPayload(r){return{id:r.id||"draft",name:r.name||"",tags:(r.tags||[]).filter(t=>t!=="example"),ingredients:(r.ingredients||[]).map(i=>i.name||""),steps:r.steps||[],notes:r.notes||""}}
function txPrompt(items){
  const L=LANGS[recipeLang()];
  return `Translate these recipes into ${L}. ${langRules()}
Reply with only a JSON array with one object per recipe, in the same order: {"id":string,"sourceLanguage":"cs"|"en"|string,"name":string,"tags":[string],"ingredients":[string],"steps":[string],"notes":string}. "ingredients" must have exactly as many entries as the input, in the same order. "sourceLanguage" is the language the input was written in. If a recipe is already in ${L}, return it unchanged, only aligning ingredient names with the existing names above.
Recipes:
${JSON.stringify(items)}`;
}
/* fields to merge into a recipe from one translated item; the first original is kept across later translations */
function applyTx(r,t){
  const ings=r.ingredients||[],ok=Array.isArray(t.ingredients)&&t.ingredients.length===ings.length,src=String(t.sourceLanguage||"").toLowerCase();
  const original=r.original||(src&&src!==recipeLang()?{lang:src,name:r.name||"",ingredients:ings.map(i=>i.name||""),steps:[...(r.steps||[])],notes:r.notes||""}:null);
  return{name:String(t.name||r.name||""),tags:(Array.isArray(t.tags)?t.tags.map(String):[]).concat(isExample(r)?["example"]:[]),
    ingredients:ings.map((i,n)=>({...i,name:ok&&t.ingredients[n]?String(t.ingredients[n]):i.name})),
    steps:Array.isArray(t.steps)?t.steps.map(String):[...(r.steps||[])],notes:String(t.notes??r.notes??""),lang:recipeLang(),original};
}
async function translateEd(){
  const r={id:ED.id,name:ED.name,tags:list(ED.tags),ingredients:ED.ingredients,steps:ED.steps.split("\n").map(s=>s.trim()).filter(Boolean),notes:ED.notes,original:ED.original};
  const out=await runAI(txPrompt([txPayload(r)]),null,`Translating to ${LANGS[recipeLang()]}…`);
  if(!ED)return;
  const t=Array.isArray(out)?out[0]:null;
  if(t&&typeof t==="object"){const x=applyTx(r,t);Object.assign(ED,{name:x.name,tags:x.tags.filter(v=>v!=="example").join(", "),ingredients:x.ingredients,steps:x.steps.join("\n"),notes:x.notes,lang:x.lang,original:x.original});toast("Translated. Check it, then save.")}
  renderSheet();
}
async function translateAll(){
  const todo=S.recipes.filter(needsTx);if(!todo.length||!sample||!db)return;
  const ctl=new AbortController();S.tx={done:0,total:todo.length,ctl};render();
  try{
    for(let i=0;i<todo.length;i+=3){
      const chunk=todo.slice(i,i+3);let out=null;
      try{out=await sample.json(txPrompt(chunk.map(txPayload)),{modelTier:"quick",signal:ctl.signal,cache:false})}
      catch(e){if(e?.code!=="invalid_json")throw e}
      for(const r of chunk){
        const t=(Array.isArray(out)?out:[]).find(x=>x&&x.id===r.id);if(!t)continue;
        const cur=recipe(r.id);if(!cur)continue;
        const body={...JSON.parse(JSON.stringify(cur)),...applyTx(cur,t),updatedAt:Date.now()};delete body.id;
        S.recipes[S.recipes.findIndex(x=>x.id===r.id)]={id:r.id,...body};
        await write("recipes/"+r.id,()=>db.doc("recipes/"+r.id).set(body));
      }
      S.tx.done=Math.min(todo.length,i+chunk.length);render();
    }
    const left=S.recipes.filter(needsTx).length;
    toast(left?`${left} recipe${left>1?"s":""} couldn't be translated. Try again.`:`All recipes are now in ${LANGS[recipeLang()]}.`);
  }catch(e){toast(aiErr(e))}
  finally{S.tx=null;render()}
}

/* fills r.extra for recipes saved before fibre/sugar/salt estimates existed */
async function fillExtras(){
  const todo=S.recipes.filter(r=>!hasExtra(r));if(!todo.length||!sample||!db)return;
  const ctl=new AbortController();S.ex={done:0,total:todo.length,ctl};render();
  try{
    for(let i=0;i<todo.length;i+=5){
      const chunk=todo.slice(i,i+5);let out=null;
      try{out=await sample.json(`Estimate per-serving nutrition for these recipes.
Reply with only a JSON array with one object per recipe, in the same order: {"id":string,"fiber":number,"sugar":number,"satfat":number,"salt":number,"fruitveg":number}.
${EXTRA_RULE}
Recipes:
${JSON.stringify(chunk.map(r=>({id:r.id,name:r.name,servings:r.servings,ingredients:(r.ingredients||[]).map(x=>`${x.qty??""} ${x.unit||""} ${x.name}`.replace(/\s+/g," ").trim())})))}`,{modelTier:"quick",signal:ctl.signal,cache:false})}
      catch(e){if(e?.code!=="invalid_json")throw e}
      for(const r of chunk){
        const t=(Array.isArray(out)?out:[]).find(x=>x&&x.id===r.id),idx=S.recipes.findIndex(x=>x.id===r.id);if(!t||idx<0)continue;
        const extra=cleanExtra(t);S.recipes[idx]={...S.recipes[idx],extra};
        await write("recipes/"+r.id,()=>db.doc("recipes/"+r.id).update({extra,updatedAt:Date.now()}));
      }
      S.ex.done=Math.min(todo.length,i+chunk.length);render();
    }
    const left=S.recipes.filter(r=>!hasExtra(r)).length;
    toast(left?`${left} recipe${left>1?"s":""} couldn't be estimated. Try again.`:"Nutrition estimates added to all recipes.");
  }catch(e){toast(aiErr(e))}
  finally{S.ex=null;render()}
}
/* rewrites cups, ounces, °F and the like in saved recipes; names, language and nutrition stay as they are */
async function convertUnits(){
  const todo=S.recipes.filter(nonMetric);if(!todo.length||!sample||!db)return;
  const ctl=new AbortController();S.cv={done:0,total:todo.length,ctl};render();
  try{
    for(let i=0;i<todo.length;i+=4){
      const chunk=todo.slice(i,i+4);let out=null;
      try{out=await sample.json(`Convert these recipes to the metric measurements used in Czechia.
${UNIT_RULES}
Reply with only a JSON array with one object per recipe, in the same order: {"id":string,"ingredients":[{"qty":number|null,"unit":string}],"steps":[string],"notes":string}. "ingredients" must have exactly as many entries as the input, in the same order. Change only amounts, units, temperatures and sizes; keep the wording and language of steps and notes otherwise unchanged.
Recipes:
${JSON.stringify(chunk.map(r=>({id:r.id,servings:r.servings,ingredients:(r.ingredients||[]).map(x=>({qty:x.qty??null,unit:x.unit||"",name:x.name})),steps:r.steps||[],notes:r.notes||""})))}`,{modelTier:"quick",signal:ctl.signal,cache:false})}
      catch(e){if(e?.code!=="invalid_json")throw e}
      for(const r of chunk){
        const t=(Array.isArray(out)?out:[]).find(x=>x&&x.id===r.id),idx=S.recipes.findIndex(x=>x.id===r.id);if(!t||idx<0)continue;
        const cur=S.recipes[idx],ings=cur.ingredients||[];
        if(!Array.isArray(t.ingredients)||t.ingredients.length!==ings.length)continue;
        const ingredients=ings.map((x,n)=>{const q=t.ingredients[n]||{};return{...x,qty:q.qty==null||q.qty===""||!isFinite(Number(q.qty))?null:Number(q.qty),unit:String(q.unit??x.unit??"")}});
        const steps=Array.isArray(t.steps)?t.steps.map(String):cur.steps||[],notes=String(t.notes??cur.notes??"");
        S.recipes[idx]={...cur,ingredients,steps,notes};
        await write("recipes/"+r.id,()=>db.doc("recipes/"+r.id).update({ingredients,steps,notes,updatedAt:Date.now()}));
      }
      S.cv.done=Math.min(todo.length,i+chunk.length);render();
    }
    const left=S.recipes.filter(nonMetric).length;
    toast(left?`${left} recipe${left>1?"s":""} still use${left>1?"":"s"} non-metric units. Check them in the editor.`:"All recipes now use metric units.");
  }catch(e){toast(aiErr(e))}
  finally{S.cv=null;render()}
}
function cvBanner(){
  if(S.cv)return `<div class="txbar"><span class="progress"><span class="spin"></span>Converting units: ${S.cv.done} of ${S.cv.total} recipes</span><button class="btn sm" data-act="stopCv">Stop</button></div>`;
  const n=S.recipes.filter(nonMetric).length;
  if(!n||!sample||!db||S.tx||S.ex)return"";
  return `<div class="txbar"><span><b>${n} recipe${n>1?"s":""}</b> still use${n>1?"":"s"} cups, ounces, °F or similar.</span><button class="btn sm primary" data-act="convertUnits">Convert to metric</button></div>`;
}
/* what the check leaves out, said plainly: meals out, and leftovers that aren't linked to a recipe */
function notCounted(a){
  const parts=[];
  if(a.outN)parts.push(`${a.outN} meal${a.outN>1?"s":""} out`);
  if(a.leftN)parts.push(`${a.leftN} leftover${a.leftN>1?"s":""} with no recipe`);
  return parts.length?`<p class="muted" style="margin:0;font-size:.85rem">Not counted: ${parts.join(", ")}.</p>`:"";
}
function homeBanner(){
  if(S.estBusy)return `<div class="txbar"><span class="progress"><span class="spin"></span>Estimating nutrition for foods at home…</span></div>`;
  const n=weekHomeNames().length;
  if(!n||!sample||!db)return"";
  return `<div class="txbar"><span><b>${n} food${n>1?"s":""} at home</b> ${n>1?"have":"has"} no nutrition estimate yet.</span><button class="btn sm primary" data-act="estHome">Estimate with Claude</button><span class="muted" style="font-size:.85rem">A rough guess for one serving each.</span></div>`;
}
function exBanner(n){
  if(S.ex)return `<div class="txbar"><span class="progress"><span class="spin"></span>Estimating nutrition: ${S.ex.done} of ${S.ex.total} recipes</span><button class="btn sm" data-act="stopEx">Stop</button></div>`;
  if(!n||!sample||!db||S.tx||S.cv)return"";
  return `<div class="txbar"><span><b>${n} recipe${n>1?"s":""}</b> ${n>1?"don't":"doesn't"} have fibre, sugar, salt and fruit &amp; veg estimates yet.</span><button class="btn sm primary" data-act="fillExtras">Estimate with Claude</button></div>`;
}

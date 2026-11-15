/* Meals · meals/js/actions.js · Actions (taps and forms), Trello (shopping list, menu card), photos.
   Plain script: shares one scope with the other meals/js/*.js files (loaded in order by meals/index.html). */
/* ---------- actions ---------- */
function toast(msg){if(!msg)return;const t=document.getElementById("toast");t.textContent=msg;t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>t.hidden=true,3600)}
/* Inside Afloat the page shows either the week plan (mode "plan", in Plan) or the rest (mode "meals", the Meals tab). Standalone it shows everything. */
const EMB=window.top!==window.self;
const mode=()=>EMB?(document.documentElement.dataset.mode||"meals"):"all";
function goTop(h){try{window.top.location.hash=h}catch{}}
function setTab(t){
  if(EMB&&mode()==="plan"&&t!=="plan"){S.lastTab=t;goTop("meals");return}
  if(EMB&&mode()==="meals"&&t==="plan"){goTop("mealplan");return}
  if(t!=="plan")S.lastTab=t;
  S.tab=t;try{history.replaceState(null,"","#"+t)}catch{}render();window.scrollTo(0,0)}
function setMode(m){
  if(!EMB||(m!=="plan"&&m!=="meals"))return;
  document.documentElement.dataset.mode=m;
  S.tab=m==="plan"?"plan":(S.lastTab&&S.lastTab!=="plan"?S.lastTab:"recipes");
  try{history.replaceState(null,"","#"+S.tab)}catch{}
  render();window.scrollTo(0,0)}
function setSlot(k,s,o){saveDay(k,{slots:{...JSON.parse(JSON.stringify(day(k).slots)),[s]:o}})}
function saveDay(k,patch){const cur=day(k);const next={date:k,meals:cur.meals.map(m=>({...m})),slots:JSON.parse(JSON.stringify(cur.slots)),...(cur.people?{people:[...cur.people],guests:cur.guests}:{}),...patch};S.plan[k]=next;render();if(db)write("plan/"+k,()=>db.doc("plan/"+k).set(next))}
function saveShop(patch){const k=dkey(S.weekStart),cur=shopDoc();const next={week:k,checked:{...(cur.checked||{})},extras:(cur.extras||[]).map(e=>({...e})),...patch};S.shop[k]=next;render();if(db)write("shopping/"+k,()=>db.doc("shopping/"+k).set(next))}
/* Android in-app browsers ("; wv)" in the user agent, as in the Claude app) never open the file picker; point to Chrome */
const APP_URL="https://claude.ai/artifact/MLsymrxsoozaBv7zHM4ALq";
const IN_APP=!!(window.claude&&window.claude.platform==="afloat-app"),CONN_WHERE=IN_APP?"Afloat’s Settings → Connections":"claude.ai Settings → Connectors";
/* ---------- Trello: the household's shopping board ---------- */
/* the household's shopping lists, as Afloat found or was told them (home/trello.shopIds, kept current by trShare in
   app/trello.js): shop = groceries, drug = toiletries and cleaning, med = pharmacy */
let T_OWN=false;const TRELLO="Trello",T_LISTS={shop:null,drug:null,med:null,org:null},T_NAMES={shop:"the shopping list",drug:"",med:""};
let mcp=null;
function trErr(e){switch(e?.code){case"needs_reauth":return"Trello needs reconnecting in "+CONN_WHERE+".";case"server_not_connected":case"selection_required":return"Trello isn't connected for you. Connect it in "+CONN_WHERE+".";case"not_in_manifest":case"approval_required":return"Mealtime isn't allowed to use Trello yet. Allow it when asked, then try again.";case"blocked_by_policy":return"Your organization blocks Trello here.";case"server_unavailable":return"Trello didn't answer. Try again in a minute.";case"tool_error":return"Trello refused that: "+String(e.message||"").slice(0,120);default:return"Couldn't reach Trello. Try again."}}
function trNodes(p){const c=p?.cards;return Array.isArray(c)?c:Array.isArray(c?.nodes)?c.nodes:[]}
async function trOpen(listId){const out=[];let cursor=null;for(let i=0;i<6;i++){const r=await mcp.callTool(TRELLO,"trelloReadCard",{action:"list_by_list",listId,limit:50,...(cursor?{cursor}:{})},{cache:false});const p=r.payload;out.push(...trNodes(p));const pi=p?.cards?.pageInfo||p?.pageInfo;if(!pi?.hasNextPage||!pi.endCursor)break;cursor=pi.endCursor}return out.filter(c=>!c.closed)}
/* unticked items go to the groceries list as one card each; names already open there are skipped, so sending twice is safe */
async function shopToTrello(){if(!T_LISTS.shop){toast("Choose your groceries list in Afloat: Settings → Your task lists.");return}
  if(!mcp||S.trBusy)return;
  const sd=shopDoc(),c=sd.checked||{},items=shoppingItems().filter(i=>!c[i.id]).map(i=>({name:i.name,amt:itemAmt(i)})).concat((sd.extras||[]).filter(e=>!e.done).map(e=>({name:e.text,amt:""})));
  if(!items.length){toast("Nothing left to send.");return}
  S.trBusy="shop";render();let added=0,skipped=0;
  try{
    const open=(await trOpen(T_LISTS.shop)).filter(x=>!x.complete).map(x=>String(x.name||"").toLowerCase());
    for(const it of items){const n=it.name.toLowerCase();if(open.some(o=>o===n||o.startsWith(n+" ")||o.startsWith(n+":"))){skipped++;continue}
      await mcp.callTool(TRELLO,"trelloWriteCard",{action:"create",listId:T_LISTS.shop,name:it.amt&&it.amt!=="as needed"?`${it.name} — ${it.amt}`:it.name,pos:"bottom"},{cache:false});added++;open.push(n)}
    toast(`Added ${added} item${added===1?"":"s"} to ${T_NAMES.shop} on Trello${skipped?`; ${skipped} already there`:""}.`);
  }catch(e){toast((added?`${added} added, then: `:"")+trErr(e))}finally{S.trBusy=null;render()}
}
/* the week's menu as one card in Organizace; sending again updates the same card */
async function planToTrello(){
  if(!mcp||S.trBusy)return;
  const lines=[];for(let i=0;i<7;i++){const d=addDays(S.weekStart,i),k=dkey(d),ms=day(k).meals;if(!ms.length)continue;
    lines.push(`**${fmtDay.format(d)} ${fmtDate.format(d)}**\n`+SLOTS.map(s=>{const n=ms.filter(m=>normSlot(m.slot)===s).map(m=>isPlain(m)||m.leftover?mealName(m):recipe(m.recipeId)?.name).filter(Boolean);return n.length?`- ${s}: ${n.join(", ")}`:""}).filter(Boolean).join("\n"))}
  if(!lines.length){toast("This week has no meals yet.");return}
  const name=`Jídelníček · ${weekLabel(S.weekStart)}`,desc=lines.join("\n\n")+`\n\n[Open in Mealtime](${APP_URL})`;
  S.trBusy="plan";render();
  try{const ex=(await trOpen(T_LISTS.org)).find(c=>c.name===name);
    if(ex)await mcp.callTool(TRELLO,"trelloWriteCard",{action:"update",cardId:ex.id,desc},{cache:false});
    else await mcp.callTool(TRELLO,"trelloWriteCard",{action:"create",listId:T_LISTS.org,name,desc,pos:"top"},{cache:false});
    toast(ex?"Updated this week's menu card on Trello.":"This week's menu is on Trello under Organizace.")}
  catch(e){toast(trErr(e))}finally{S.trBusy=null;render()}
}
function pickHint(){
  const ua=navigator.userAgent||"";if(IN_APP||!/Android/i.test(ua))return"";
  return `<div class="hint"><span>${/; wv\)/.test(ua)?"<b>The Claude app on Android can't open your photos from this page.</b>":"<b>Nothing happens when you tap a button?</b>"} Open Mealtime in Chrome, signed in to claude.ai, and adding photos works there. Your recipes are the same in both.</span>
  <button class="btn sm" data-act="copyLink">Copy link</button><span class="mono">${APP_URL}</span></div>`;
}
/* phones hand over HEIC photos, huge camera shots or files with no type: redraw anything else as a JPEG */
async function toJpeg(f){
  const url=URL.createObjectURL(f);
  try{const img=new Image();img.src=url;await img.decode();
    const s=Math.min(1,2400/Math.max(img.naturalWidth,img.naturalHeight)),c=document.createElement("canvas");
    c.width=Math.round(img.naturalWidth*s);c.height=Math.round(img.naturalHeight*s);c.getContext("2d").drawImage(img,0,0,c.width,c.height);
    return await new Promise(r=>c.toBlob(r,"image/jpeg",.9));
  }catch{return null}finally{URL.revokeObjectURL(url)}
}
async function addImages(files){
  if(!imgLimits||!ED)return;
  const ed=ED;
  for(const f of files){
    if(ed.files.length>=imgLimits.maxCount){toast(`Up to ${imgLimits.maxCount} images per recipe.`);break}
    let blob=f;
    if(!imgLimits.mediaTypes.includes(f.type)||f.size>imgLimits.maxInputBytes)blob=await toJpeg(f);
    if(!blob){toast("That photo's format can't be read here. Take a screenshot of it and add the screenshot.");continue}
    ed.files.push({file:blob,url:URL.createObjectURL(blob)});
  }
  if(ED===ed)renderSheet();
}
function fromAI(j,keepId){
  const ings=(Array.isArray(j.ingredients)?j.ingredients:[]).map(i=>({qty:i.qty==null||i.qty===""?"":(isFinite(Number(i.qty))?Number(i.qty):""),unit:String(i.unit||""),name:String(i.name||""),aisle:AISLES.includes(i.aisle)?i.aisle:"Other",kcal:Math.round(num(i.kcal)),protein:Math.round(num(i.protein)),carbs:Math.round(num(i.carbs)),fat:Math.round(num(i.fat))})).map(toMetric);
  Object.assign(ED,{name:String(j.name||ED.name||""),servings:Math.max(1,Math.round(num(j.servings))||4),minutes:Math.round(num(j.minutes))||"",diet:DIET_RANK[j.diet]!=null?j.diet:"omnivore",
    tags:(Array.isArray(j.tags)?j.tags:[]).map(String).join(", "),allergens:validAl(j.allergens),
    ingredients:ings.length?ings:[blankIng()],steps:(Array.isArray(j.steps)?j.steps:[]).map(String).join("\n"),notes:String(j.notes||""),source:String(j.source||ED.source||""),lang:recipeLang()});
  const o=j.original,src=String(j.sourceLanguage||"").toLowerCase();
  ED.extra=cleanExtra(j.perServing)||ED.extra;
  ED.original=o&&typeof o==="object"&&src&&src!==recipeLang()?{lang:src,name:String(o.name||""),ingredients:(Array.isArray(o.ingredients)?o.ingredients:[]).map(String),steps:(Array.isArray(o.steps)?o.steps:[]).map(String),notes:String(o.notes||"")}:null;
}
async function runAI(prompt,images,label){
  aiCtl=new AbortController();ED.busy=true;ED.progress=label;renderSheet();
  try{
    const out=await sample.json(prompt,{signal:aiCtl.signal,images:images&&images.length?images:undefined,onText:({text})=>{if(ED){const p=`${label} (${text.length} characters so far)`;ED.progress=p;const el=document.querySelector(".progress");if(el)el.lastChild.textContent=p}}});
    return out;
  }catch(e){toast(aiErr(e));return null}
  finally{aiCtl=null;if(ED){ED.busy=false;ED.progress=""}}
}
async function scan(){
  if(!ED.files.length&&!ED.scanText.trim()){toast("Add a photo or paste the recipe text first.");return}
  const prompt=`Read the recipe in the attached image(s) and/or the text below and turn it into structured data with nutrition estimates.
Reply with only one JSON object of this shape:
{"name":string,"servings":integer,"minutes":integer|null,"diet":string,"tags":[string],"allergens":[string],"source":string,"ingredients":[{"qty":number|null,"unit":string,"name":string,"aisle":string,"kcal":number,"protein":number,"carbs":number,"fat":number}],"steps":[string],"notes":string,"perServing":{"fiber":number,"sugar":number,"satfat":number,"salt":number,"fruitveg":number},"sourceLanguage":"cs"|"en"|string,"original":{"name":string,"ingredients":[string],"steps":[string],"notes":string}|null}
${rules()}
${EXTRA_RULE}
${langRules()}
"sourceLanguage" is the language the recipe was written in. When you translated, "original" holds the untranslated name, ingredient names (same order as "ingredients"), steps and notes; otherwise it is null. Write each step as one clear instruction. If servings aren't stated, estimate them. "tags" are 1-4 short descriptors like "soup" or "quick". "source" is the book/site/author if visible, else "".${ED.files.length&&assets?`
Also include "dishPhoto": if one of the attached images shows a photo of the finished, cooked dish (not just text, raw ingredients or a person), give {"image":index,"box":[left,top,right,bottom]} where index is the image's position among the attached images starting at 0 and box is the rectangle around that food photo as fractions of the image's width and height (0 to 1), tight around the photo but not cutting the dish. Pick the most appetising one if there are several. Otherwise "dishPhoto" is null.`:""}
${ED.scanText.trim()?"Recipe text:\n"+ED.scanText.trim().slice(0,20000):"(The recipe is in the images.)"}`;
  const j=await runAI(prompt,ED.files.map(f=>f.file),"Reading the recipe…");
  if(!ED)return;
  if(j&&typeof j==="object"){const ed=ED;fromAI(j);await autoDish(ed,j.dishPhoto);if(ED!==ed)return;renderSheet();toast(ed.photoAuto?"Done, with a photo of the dish. Check the details, then save.":"Done. Check the details, then save.")}else renderSheet();
}
async function estimate(){
  const ings=ED.ingredients.filter(i=>String(i.name).trim());
  if(!ings.length){toast("Add some ingredients first.");return}
  const prompt=`Estimate nutrition, aisles, allergens and diet for this recipe.
Recipe: ${ED.name||"(untitled)"}, serves ${ED.servings}.
Ingredients:
${ings.map((i,n)=>`${n+1}. ${i.qty} ${i.unit} ${i.name}`.replace(/\s+/g," ")).join("\n")}
Reply with only one JSON object: {"diet":string,"allergens":[string],"ingredients":[{"kcal":number,"protein":number,"carbs":number,"fat":number,"aisle":string}],"perServing":{"fiber":number,"sugar":number,"satfat":number,"salt":number,"fruitveg":number}} where "ingredients" has exactly ${ings.length} entries in the same order as above.
${rules()}
${EXTRA_RULE}`;
  const j=await runAI(prompt,null,"Estimating nutrition…");
  if(!ED)return;
  if(j&&Array.isArray(j.ingredients)){
    ings.forEach((i,n)=>{const x=j.ingredients[n];if(!x)return;i.kcal=Math.round(num(x.kcal));i.protein=Math.round(num(x.protein));i.carbs=Math.round(num(x.carbs));i.fat=Math.round(num(x.fat));if(AISLES.includes(x.aisle))i.aisle=x.aisle});
    if(Array.isArray(j.allergens))ED.allergens=validAl(j.allergens);
    if(DIET_RANK[j.diet]!=null)ED.diet=j.diet;
    if(j.perServing)ED.extra=cleanExtra(j.perServing);
    toast("Nutrition and allergens updated. Adjust anything that looks off.");
  }
  renderSheet();
}
async function saveRecipe(){
  const e=ED;if(e.saving)return;if(!e.name.trim()){toast("Give the recipe a name.");document.getElementById("edName")?.focus();return}
  const id=e.id||db.collection("recipes").doc().id,old=e.id&&recipe(e.id);
  let photo=photoSrc(e.photo)?e.photo:null;
  if(e.photoNew&&assets){
    e.saving=true;renderSheet();
    try{photo=(await assets.upload(e.photoNew.blob,{type:"image/jpeg"})).id}catch(err){toast(assetErr(err))}
    finally{e.saving=false}
    if(ED!==e){if(assets&&photo&&photo!==e.photo)assets.delete(photo).catch(()=>{});return}
  }
  const body={name:e.name.trim(),servings:Math.max(1,Math.round(num(e.servings))||1),minutes:Math.round(num(e.minutes))||null,source:e.source.trim(),diet:e.diet,
    tags:list(e.tags).concat(old&&isExample(old)?["example"]:[]).filter((v,i,a)=>a.indexOf(v)===i),allergens:[...e.allergens],
    ingredients:e.ingredients.filter(i=>String(i.name).trim()).map(i=>({qty:i.qty===""||i.qty==null||!isFinite(Number(String(i.qty).replace(",",".")))?null:Number(String(i.qty).replace(",",".")),unit:String(i.unit).trim(),name:String(i.name).trim(),aisle:i.aisle,kcal:num(i.kcal),protein:num(i.protein),carbs:num(i.carbs),fat:num(i.fat)})),
    steps:e.steps.split("\n").map(s=>s.trim()).filter(Boolean),notes:e.notes.trim(),lang:e.lang||null,original:e.original||null,
    extra:EXTRA.some(([k])=>String(e.extra?.[k]??"").trim()!=="")?Object.fromEntries(EXTRA.map(([k])=>[k,num(String(e.extra[k]??"").replace(",","."))])):null,photo,createdAt:old?.createdAt||Date.now(),updatedAt:Date.now()};
  const i=S.recipes.findIndex(r=>r.id===id);if(i>=0)S.recipes[i]={id,...body};else S.recipes.push({id,...body});
  const oldPhoto=old?.photo||null;
  if(e.photoNew)URL.revokeObjectURL(e.photoNew.url);
  write("recipes/"+id,()=>db.doc("recipes/"+id).set(body)).then(()=>{if(assets&&oldPhoto&&oldPhoto!==photo&&photoSrc(oldPhoto))assets.delete(oldPhoto).catch(()=>{})}).then(()=>toast(nonMetric(body)?"Recipe saved. It still uses cups, ounces or °F; use Convert to metric on Recipes.":"Recipe saved."));
  S.detail={id,servings:body.servings};ED=null;openSheet("recipe");render();
}

const alwaysSet=()=>(S.kitchen.always||{}).names||{};
function setAlways(name,on){const names={...alwaysSet(),[pNorm(name)]:on};S.kitchen.always={names};if(db)write("kitchen/always",()=>db.doc("kitchen/always").set({names}))}
const ACT={
  tab:d=>setTab(d.tab),
  scanOpen:()=>{S.scan={};openSheet("scan")},
  cookOpen:()=>{S.cook={mood:"normal"};openSheet("cook");cookAsk()},
  cookMood:d=>{if(S.cook){S.cook.mood=d.v;renderSheet()}},
  cookGo:()=>cookAsk(),
  cookPlan:d=>cookPlan(+d.i),
  cookMissing:async d=>{const x=S.cook?.ideas?.[+d.i];if(!x)return;let n=0;for(const m of x.missing)if(await addFood(m,T_LISTS.shop,true))n++;if(n)toast(`${n} thing${n===1?"":"s"} on ${T_NAMES.shop}.`)},
  phLevel:d=>{const it=S.pantry.find(x=>x.id===d.id);if(!it)return;const l=it.level||3;if(l>1)savePantry({...it,level:l-1});else toast("Tap Used up when it's gone.")},
  phLeftFrom:d=>{const r=recipe(d.id);if(!r)return;const n=saveLeftover(r.name);toast(`${n} is in At home, best within ${LEFT_DAYS} days.`)},
  phLeftover:()=>{const inp=document.getElementById("phName"),v=inp?.value.trim();if(!v){toast("Type what was cooked first, e.g. špagety.");inp?.focus();return}
    const n=saveLeftover(v,document.getElementById("phWhere").value);inp.value="";toast(`${n} is in At home, best within ${LEFT_DAYS} days.`)},
  mealLeft:d=>{const m=day(d.k).meals.find(x=>x.id===d.m),r=m&&recipe(m.recipeId);if(!r)return;const n=saveLeftover(r.name);toast(`${n} is in At home, best within ${LEFT_DAYS} days.`)},
  phUsed:async d=>{const it=S.pantry.find(x=>x.id===d.id);if(!it)return;dropPantry(it.id);
    if(it.leftover){toast("All eaten. Nice.");return}
    if(it.always||alwaysSet()[pNorm(it.name)]){if(await addFood(it.name,T_LISTS.shop,true))toast(`${it.name}: used up and on ${T_NAMES.shop}.`)}else{S.askBuy={name:it.name};render()}},
  phOff:d=>{const it=S.pantry.find(x=>x.id===d.id);if(!it)return;dropPantry(it.id);toast("Gone. That happens.")},
  phAlways:d=>{const it=S.pantry.find(x=>x.id===d.id);if(!it)return;const on=!it.always;savePantry({...it,always:on});setAlways(it.name,on);toast(on?`${it.name} will go on ${T_NAMES.shop} by itself when it's used up.`:"Okay, it'll ask.")},
  buyYes:async()=>{const n=S.askBuy?.name;S.askBuy=null;render();if(n)await addFood(n)},
  buyAlways:async()=>{const n=S.askBuy?.name;S.askBuy=null;render();if(n){setAlways(n,true);await addFood(n,T_LISTS.shop,true);toast(`${n} is on ${T_NAMES.shop}, and will be by itself next time.`)}},
  buyNo:()=>{S.askBuy=null;render()},
  stToggle:async d=>{const st=staples(),x=st.list.find(y=>y.id===d.id);if(!x)return;const on=!st.low[x.id];saveStaples({low:{[x.id]:on}});if(on)await addFood(x.name)},
  scTick:d=>{const x=S.scan?.items?.find(y=>y.id===d.id);if(x){x.on=!x.on;renderSheet()}},
  scCard:d=>{const c=S.scan?.cards?.find(y=>y.id===d.id);if(c){c.on=!c.on;renderSheet()}},
  scSave:()=>scanSave(),
  close:()=>closeSheet(),
  week:d=>{S.weekStart=d.d==="0"?monday(new Date()):addDays(S.weekStart,Number(d.d));render()},
  newRecipe:()=>{ED=blankRecipe();openSheet("editor")},
  /* swipe a recipe left/right for the next/previous one, in the order the Recipes page shows them */
  recipeStep:d=>{const ids=[...document.querySelectorAll('#view [data-act=openRecipe]')].map(x=>x.dataset.id).filter((v,i,a)=>a.indexOf(v)===i);
    const i=ids.indexOf(S.detail&&S.detail.id),j=i+Number(d.id);if(i<0||j<0||j>=ids.length)return;
    const r=recipe(ids[j]);if(!r)return;S.detail={id:r.id,servings:Math.max(1,num(r.servings)||1)};renderSheet();document.getElementById("sheet").scrollTop=0},
  openRecipe:d=>{const r=recipe(d.id);if(!r)return;S.detail={id:r.id,servings:Math.max(1,num(r.servings)||1)};openSheet("recipe")},
  detailServ:d=>{S.detail.servings=Math.max(1,S.detail.servings+Number(d.d));renderSheet()},
  editRecipe:d=>{const r=JSON.parse(JSON.stringify(recipe(d.id)));ED={...blankRecipe(),...r,minutes:r.minutes??"",tags:(r.tags||[]).filter(t=>t!=="example").join(", "),steps:(r.steps||[]).join("\n"),allergens:r.allergens||[],ingredients:(r.ingredients||[]).map(i=>({...blankIng(),...i,qty:i.qty??""}))};if(!ED.ingredients.length)ED.ingredients=[blankIng()];if(!ED.extra)ED.extra=blankExtra();openSheet("editor")},
  rmPhoto:()=>{if(ED.photoNew)URL.revokeObjectURL(ED.photoNew.url);ED.photoNew=null;ED.photo=null;ED.photoAuto=false;renderSheet()},
  rmFile:d=>{URL.revokeObjectURL(ED.files[d.i].url);ED.files.splice(Number(d.i),1);renderSheet()},
  scan:()=>scan(), estimate:()=>estimate(), stopAI:()=>aiCtl?.abort(),
  edAl:d=>{const a=ED.allergens,i=a.indexOf(d.id);i>=0?a.splice(i,1):a.push(d.id);renderSheet()},
  addIng:()=>{ED.ingredients.push(blankIng());renderSheet();document.getElementById(`i${ED.ingredients.length-1}q`)?.focus()},
  rmIng:d=>{ED.ingredients.splice(Number(d.i),1);if(!ED.ingredients.length)ED.ingredients.push(blankIng());renderSheet()},
  saveRecipe:()=>saveRecipe(),
  delRecipe:()=>{if(armed!=="recipe"){armed="recipe";renderSheet();return}const id=ED.id,ph=recipe(id)?.photo;S.recipes=S.recipes.filter(r=>r.id!==id);write("recipes/"+id,()=>db.doc("recipes/"+id).delete()).then(()=>{if(assets&&photoSrc(ph))assets.delete(ph).catch(()=>{});toast("Recipe deleted.")});closeSheet();render()},
  addToPlan:d=>{S.addPlan={id:d.id,ws:d.ws?monday(new Date(d.ws+"T12:00")):monday(new Date()),added:[]};openSheet("addPlan")},
  nutriToggle:()=>{S.nutriOpen=!S.nutriOpen;render()},
  nutriFor:d=>{S.nutriFor=d.id;render()},
  calWeek:d=>{const a=S.addPlan;a.ws=d.d==="0"?monday(new Date()):addDays(a.ws,Number(d.d));renderSheet()},
  calToggle:d=>{
    const a=S.addPlan,dy=day(d.k),i=a.added.findIndex(x=>x.k===d.k&&x.slot===d.s);
    if(i>=0){const mid=a.added[i].mealId;a.added.splice(i,1);saveDay(d.k,{meals:dy.meals.filter(m=>m.id!==mid)})}
    else{const m={id:uid(),slot:d.s,recipeId:a.id,portions:null};a.added.push({k:d.k,slot:d.s,mealId:m.id});saveDay(d.k,{meals:[...dy.meals,m]})}
    renderSheet();
  },
  togglePerson:d=>{const ps=slotPeople(d.k,d.s);setSlot(d.k,d.s,{people:ps.includes(d.id)?ps.filter(x=>x!==d.id):[...ps,d.id],guests:slotGuests(d.k,d.s)})},
  guests:d=>{setSlot(d.k,d.s,{people:slotPeople(d.k,d.s),guests:Math.max(0,slotGuests(d.k,d.s)+Number(d.d))})},
  portions:d=>{const dy=day(d.k);saveDay(d.k,{meals:dy.meals.map(m=>m.id===d.m?{...m,portions:Math.max(1,Number(d.d)>0?Math.floor(portions(m,d.k))+1:Math.ceil(portions(m,d.k))-1)}:m)})},
  autoPortions:d=>{const dy=day(d.k);saveDay(d.k,{meals:dy.meals.map(m=>m.id===d.m?{...m,portions:null}:m)})},
  rmMeal:d=>{const dy=day(d.k);saveDay(d.k,{meals:dy.meals.filter(m=>m.id!==d.m)})},
  addMeal:d=>{S.picker={k:d.k,slot:SLOTS.includes(d.s)?d.s:"Dinner",q:"",showAll:false,mode:"recipes"};openSheet("picker")},
  pickShowAll:()=>{S.picker.showAll=true;renderSheet()},
  pickMode:d=>{S.picker.mode=d.v==="home"?"home":d.v==="other"?"other":"recipes";S.picker.q="";S.picker.note="";S.picker.lrec="";renderSheet()},
  /* eating out and leftovers go in once and close the sheet (one choice per tap, unlike At home) */
  pickOther:d=>{
    const p=S.picker,dy=day(p.k),note=String(p.note||"").trim().slice(0,60);
    /* leftovers of a recipe become a recipe meal flagged "leftover" (so they count and warn); the rest has no recipe */
    const m=d.kind==="leftovers"&&recipe(p.lrec)?{id:uid(),slot:p.slot,recipeId:p.lrec,portions:null,leftover:true,...(note?{note}:{})}
      :{id:uid(),slot:p.slot,other:{kind:d.kind==="leftovers"?"leftovers":"out",note}};
    saveDay(p.k,{meals:[...dy.meals,m]});closeSheet();
  },
  /* food at home goes into the slot as many times as you tap; tapping it again takes it off; the sheet stays open for the next one */
  pickHome:d=>{
    const p=S.picker,dy=day(p.k),i=dy.meals.findIndex(m=>isHome(m)&&m.home.id===d.id&&normSlot(m.slot)===p.slot);
    if(i>=0)saveDay(p.k,{meals:dy.meals.filter((_,j)=>j!==i)});
    else{const it=S.pantry.find(x=>x.id===d.id);if(!it)return;saveDay(p.k,{meals:[...dy.meals,{id:uid(),slot:p.slot,home:{id:it.id,name:it.name}}]});estimateHome([it.name])}
    renderSheet();
  },
  pickGoHome:()=>{closeSheet();setTab("home")},
  estHome:()=>estimateHome(weekHomeNames()),
  pick:d=>{const p=S.picker,dy=day(p.k);saveDay(p.k,{meals:[...dy.meals,{id:uid(),slot:p.slot,recipeId:d.id,portions:null}]});closeSheet()},
  check:d=>{const c={...(shopDoc().checked||{})};if(c[d.id])delete c[d.id];else c[d.id]=true;saveShop({checked:c})},
  checkExtra:d=>{saveShop({extras:(shopDoc().extras||[]).map(e=>e.id===d.id?{...e,done:!e.done}:e)})},
  rmExtra:d=>{saveShop({extras:(shopDoc().extras||[]).filter(e=>e.id!==d.id)})},
  clearChecks:()=>{saveShop({checked:{},extras:(shopDoc().extras||[]).map(e=>({...e,done:false}))})},
  hideChecked:()=>{S.hideChecked=!S.hideChecked;render()},
  shopDay:d=>{S.shopDays[d.i]=S.shopDays[d.i]?0:1;render()},
  copyList:()=>{
    const sd=shopDoc(),c=sd.checked||{},items=shoppingItems().filter(i=>!c[i.id]);
    let txt=`Shopping ${weekLabel(S.weekStart)}\n`;
    for(const a of AISLES){const its=items.filter(i=>i.aisle===a);if(!its.length)continue;txt+=`\n${a}\n`+its.map(i=>`- ${i.name}: ${itemAmt(i)}`).join("\n")+"\n"}
    const ex=(sd.extras||[]).filter(e=>!e.done);if(ex.length)txt+=`\nOther\n`+ex.map(e=>`- ${e.text}`).join("\n")+"\n";
    const fb=()=>{const t=document.getElementById("copyFallback");if(t){t.hidden=false;t.value=txt;t.select();toast("Select all and copy the text below.")}};
    try{navigator.clipboard.writeText(txt).then(()=>toast("List copied. Paste it into your notes or a message."),fb)}catch{fb()}
  },
  manageTags:()=>openSheet("tags"),
  family:()=>openFamily(),
  toggleFav:d=>{
    const i=S.favPeople.findIndex(p=>p.id===d.id);if(i<0||!db)return;
    const p=S.favPeople[i],cur=p.favorites||[],favorites=cur.includes(d.r)?cur.filter(x=>x!==d.r):[...cur,d.r];
    S.favPeople[i]={...p,favorites};const j=S.people.findIndex(x=>x.id===d.id);if(j>=0)S.people[j]={...S.people[j],favorites};renderSheet();render();
    setFavorites(p,favorites);
  },
  copyLink:()=>{const fb=()=>toast("Press and hold the link below to copy it.");try{navigator.clipboard.writeText(APP_URL).then(()=>toast("Link copied. Paste it into Chrome."),fb)}catch{fb()}},
  translateEd:()=>translateEd(),
  shopToTrello:()=>shopToTrello(),
  planToTrello:()=>planToTrello(),
  translateAll:()=>translateAll(),
  fillExtras:()=>fillExtras(),
  convertUnits:()=>convertUnits(),
  stopCv:()=>S.cv?.ctl.abort(),
  stopEx:()=>S.ex?.ctl.abort(),
  stopTx:()=>S.tx?.ctl.abort(),
  toggleOrig:()=>{S.detail.orig=!S.detail.orig;renderSheet()},
  delTag:d=>{if(armed!=="tag:"+d.id){armed="tag:"+d.id;renderSheet();return}armed=null;S.tags=S.tags.filter(t=>t.id!==d.id);write("allergenTags/"+d.id,()=>db.doc("allergenTags/"+d.id).delete());renderSheet();render();toast("Allergen deleted.")},
};

document.addEventListener("click",e=>{
  if(e.target.id==="overlay"){closeSheet();return}
  const b=e.target.closest("[data-act]");if(!b||b.disabled)return;
  if(b.tagName==="INPUT"&&b.type==="checkbox"){ACT[b.dataset.act]?.(b.dataset,b,e);return}
  if(b.tagName==="LABEL")return;
  ACT[b.dataset.act]?.(b.dataset,b,e);
});
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"&&S.sheet){closeSheet();return}
  if((e.key==="Enter"||e.key===" ")&&e.target.matches("article[data-act]")){e.preventDefault();ACT[e.target.dataset.act]?.(e.target.dataset)}
});
document.addEventListener("input",e=>{
  const t=e.target,d=t.dataset;
  if(d.sc&&S.scan){const x=S.scan.items.find(y=>y.id===d.sc);if(x)x.name=t.value;return}
  if(d.bind){S[d.bind]=t.value;render();return}
  if(d.ed&&ED){ED[d.ed]=t.value;if(d.ed==="servings"){document.getElementById("edTotals").innerHTML=edTotalsHtml()}return}
  if(d.ex&&ED){ED.extra[d.ex]=t.value;return}
  if(d.ing&&ED){ED.ingredients[Number(d.ing)][d.f]=t.value;if(["kcal","protein","carbs","fat"].includes(d.f))document.getElementById("edTotals").innerHTML=edTotalsHtml();return}
  if(d.pk&&S.picker){S.picker[d.pk]=t.value;const id=t.id,pos=t.selectionStart;renderSheet();const el=document.getElementById(id);if(el){el.focus();try{el.setSelectionRange(pos,pos)}catch{}}return}
  if(d.ap&&S.addPlan){S.addPlan[d.ap]=t.value;renderSheet();return}
});
document.addEventListener("change",e=>{
  const t=e.target;
  if((t.id==="scanFiles"||t.id==="scanCam")&&S.scan){scanRead([...t.files]);return}
  if(t.dataset.pby){const it=S.pantry.find(x=>x.id===t.dataset.pby);if(!it)return;savePantry({...it,useBy:t.value||null});toast(t.value?"Best before date saved.":"Best before date cleared.");return}
  if(t.dataset.scby&&S.scan){const x=S.scan.items.find(y=>y.id===t.dataset.scby);if(x)x.by=t.value||null;return}
  if(t.dataset.scw&&S.scan){const x=S.scan.items.find(y=>y.id===t.dataset.scw);if(x)x.where=t.value;return}
  if((t.id==="edFiles"||t.id==="edCam")&&ED){addImages([...t.files]);return}
  if((t.id==="edPhoto"||t.id==="edPhotoCam")&&ED){pickDish(t.files[0]);return}
  if(t.id==="langSel"&&db){const v=t.value;S.settings={...S.settings,recipeLang:v};render();write("settings/app",()=>db.doc("settings/app").set({recipeLang:v})).then(()=>toast(`New recipes will be saved in ${LANGS[v]}.`));return}
  if(t.dataset.tag){const tag=S.tags.find(x=>x.id===t.dataset.tag);if(!tag)return;
    if(t.dataset.f==="label"){const v=t.value.trim();if(!v){t.value=tag.label;return}tag.label=v}else tag.keywords=list(t.value.toLowerCase());
    const body={label:tag.label,keywords:tag.keywords||[],createdAt:tag.createdAt||Date.now()};
    write("allergenTags/"+tag.id,()=>db.doc("allergenTags/"+tag.id).set(body)).then(()=>toast("Saved."));render()}
});
document.addEventListener("submit",e=>{
  e.preventDefault();
  const f=e.target;
  if(f.dataset.form==="newTag"){const inp=f.querySelector("input"),label=inp.value.trim();if(!label||!db)return;
    const t=addTag(label),w=f.dataset.where,tgt=w==="ed"?ED?.allergens:null;
    if(tgt&&!tgt.includes(t.id))tgt.push(t.id);renderSheet();render();setTimeout(()=>document.getElementById("newTag_"+w)?.focus());return}
  if(f.dataset.form==="phAdd"){const v=document.getElementById("phName").value.trim(),w=document.getElementById("phWhere").value;if(!v||!db)return;
    const by=document.getElementById("phUseBy").value||null;
    const same=S.pantry.find(p=>pNorm(p.name)===pNorm(v)),it={...(same||{}),id:same?.id||uid(),name:v,where:w,level:3,added:todayK(),useBy:by||same?.useBy||null,always:!!(same?.always||alwaysSet()[pNorm(v)])};
    savePantry(it);if(!it.useBy)guessDays([it]);setTimeout(()=>document.getElementById("phName")?.focus());return}
  if(f.dataset.form==="stAdd"){const v=document.getElementById("stName").value.trim();if(!v||!db)return;const st=staples();if(!st.list.some(x=>pNorm(x.name)===pNorm(v)))saveStaples({list:[...st.list,{id:slug(v)||uid(),name:v}]});return}
  if(f.dataset.form==="extra"){const inp=document.getElementById("extraText"),v=inp.value.trim();if(!v)return;saveShop({extras:[...(shopDoc().extras||[]),{id:uid(),text:v,done:false}]});setTimeout(()=>document.getElementById("extraText")?.focus())}
});
document.addEventListener("paste",e=>{
  if(S.sheet!=="editor"||!ED||ED.id||!imgLimits)return;
  const files=[...(e.clipboardData?.files||[])].filter(f=>f.type.startsWith("image/"));
  if(files.length){e.preventDefault();addImages(files)}
});
document.addEventListener("dragover",e=>{const d=e.target.closest?.("#drop");if(d){e.preventDefault();d.classList.add("over")}});
document.addEventListener("dragleave",e=>{const d=e.target.closest?.("#drop");if(d)d.classList.remove("over")});
document.addEventListener("drop",e=>{const d=e.target.closest?.("#drop");if(d&&ED){e.preventDefault();d.classList.remove("over");addImages([...e.dataTransfer.files])}});

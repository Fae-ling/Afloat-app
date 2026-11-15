/* Meals · meals/js/sheets.js · Sheets: recipe editor, the dish photo, the week calendar.
   Plain script: shares one scope with the other meals/js/*.js files (loaded in order by meals/index.html). */
/* ---------- sheets ---------- */
function openSheet(kind){S.sheet=kind;armed=null;document.getElementById("overlay").hidden=false;renderSheet();document.getElementById("sheet").scrollTop=0}
function closeSheet(){if(aiCtl){aiCtl.abort();aiCtl=null}S.sheet=null;ED=null;document.getElementById("overlay").hidden=true}
function renderSheet(){if(!S.sheet)return;const el=document.getElementById("sheet");el.innerHTML=({recipe:sRecipe,editor:sEditor,picker:sPicker,addPlan:sAddPlan,tags:sTags,scan:sScan,cook:sCook}[S.sheet])()}
function sTags(){
  return hd("Your allergens")+`<div class="sheet-bd"><p class="muted" style="margin:0;max-width:65ch">For allergies more specific than the 14 standard ones, like a single kind of nut. A recipe is flagged when any ingredient name contains one of the keywords. Add names in every language your recipes use, e.g. "cashew, kešu". Claude also tags these when it reads new recipes.</p>
  ${S.tags.length?S.tags.map(t=>{const np=S.people.filter(p=>(p.allergens||[]).includes(t.id)).length,nr=S.recipes.filter(r=>recipeAllergens(r).includes(t.id)).length,arm=armed==="tag:"+t.id;
    return `<div class="panel"><div class="g2"><label class="f"><span>Name</span><input type="text" id="tl_${t.id}" data-tag="${t.id}" data-f="label" value="${esc(t.label)}"></label>
    <label class="f"><span>Ingredient keywords</span><input type="text" id="tk_${t.id}" data-tag="${t.id}" data-f="keywords" value="${esc((t.keywords||[]).join(", "))}" placeholder="cashew, kešu"></label></div>
    <div class="row" style="flex-wrap:wrap"><span class="muted" style="font-size:.88rem;flex:1">${np} ${np===1?"person":"people"} · in ${nr} recipe${nr===1?"":"s"}</span><button class="btn sm danger ${arm?"armed":""}" data-act="delTag" data-id="${t.id}">${arm?"Tap again to delete":"Delete"}</button></div></div>`}).join(""):`<p style="margin:0">No custom allergens yet.</p>`}
  <div class="panel"><h3>Add an allergen</h3>${newTagForm("mgr")}</div></div>`;
}
function hd(title){return `<div class="sheet-hd"><h2>${title}</h2><button class="x" data-act="close" aria-label="Close" style="font-size:1.4rem;width:36px;height:36px">×</button></div>`}

function sRecipe(){
  const r=recipe(S.detail.id);if(!r)return hd("Recipe")+`<div class="sheet-bd"><p>This recipe was deleted.</p></div>`;
  const sv=S.detail.servings,f=sv/Math.max(1,num(r.servings)||1),t=totals(r),o=S.detail.orig&&r.original?r.original:null;
  const steps=o?o.steps||[]:r.steps||[],notes=o?o.notes:r.notes;
  return hd(esc(o&&o.name?o.name:r.name))+`<div class="sheet-bd" data-sw-l="@recipeStep:1" data-sw-r="@recipeStep:-1" data-sw-kind="page">
  ${photoSrc(r.photo)?`<figure class="hero">${photoImg(photoSrc(r.photo),"Photo of "+(r.name||"the dish"))}</figure>`:""}
  ${r.original?`<div class="row" style="flex-wrap:wrap"><span class="muted" style="font-size:.9rem">${o?`Original${LANGS[o.lang]?" ("+LANGS[o.lang]+")":""}`:`Translated to ${esc(LANGS[r.lang]||"")}`}</span><button class="btn sm ghost" data-act="toggleOrig">${o?"Show translation":"Show original"}</button></div>`:""}
  <div class="chips"><span class="tagx">${esc(DIET_LABEL[r.diet]||"")}</span>${r.minutes?`<span class="tagx">${esc(r.minutes)} min</span>`:""}${(r.tags||[]).filter(x=>x!=="example").map(x=>`<span class="tagx">${esc(x)}</span>`).join("")}${isExample(r)?'<span class="example">Example recipe</span>':""}</div>
  <div class="favrow"><span class="muted" style="font-size:.85rem;font-weight:700">Favourite of</span>${S.favPeople.length?S.favPeople.map(p=>`<button class="pchip favchip" data-act="toggleFav" data-id="${p.id}" data-r="${r.id}" aria-pressed="${(p.favorites||[]).includes(r.id)}" ${db?"":"disabled"}>${avatar(p)}${esc(p.name)}<span class="heart" aria-hidden="true">♥</span></button>`).join(""):`<span class="muted" style="font-size:.85rem">Add the family in Us → Family to mark favourites.</span>`}</div>
  <div class="panel"><h3>Per serving</h3><div class="stats"><div class="stat"><b>${Math.round(t.kcal)}</b><span>kcal</span></div><div class="stat p"><b>${Math.round(t.protein)}</b><span>Protein g</span></div><div class="stat c"><b>${Math.round(t.carbs)}</b><span>Carbs g</span></div><div class="stat f"><b>${Math.round(t.fat)}</b><span>Fat g</span></div></div>${macroBar(t)}
  ${hasExtra(r)?`<div class="legend">${EXTRA.map(([k,l])=>`<span>${l} <b class="num" style="color:var(--ink);font-weight:500">${rnd(r.extra[k],k==="fruitveg"?0:1)} g</b></span>`).join("")}</div>`:""}
  <div><div class="muted" style="font-size:.8rem;font-weight:700;margin-bottom:4px">ALLERGENS</div><div class="chips">${alChips(recipeAllergens(r),'<span class="okchip">No listed allergens</span>')}</div></div></div>
  <div class="panel"><div class="row" style="justify-content:space-between;flex-wrap:wrap"><h3>Ingredients</h3><span class="row"><span class="muted">Servings</span><span class="step"><button data-act="detailServ" data-d="-1" aria-label="Fewer servings">−</button><span>${sv}</span><button data-act="detailServ" data-d="1" aria-label="More servings">+</button></span></span></div>
  <ul class="ingl">${(r.ingredients||[]).map((i,n)=>`<li><span class="q">${esc(fmtIng(i,f))}</span><span>${esc(o&&o.ingredients?.[n]?o.ingredients[n]:i.name)}</span></li>`).join("")}</ul></div>
  ${steps.length?`<div class="panel"><h3>Method</h3><ol class="steps">${steps.map(s=>`<li>${esc(s)}</li>`).join("")}</ol></div>`:""}
  ${notes?`<div class="panel"><h3>Notes</h3><p style="margin:0;max-width:65ch">${esc(notes)}</p></div>`:""}
  ${r.source?`<p class="muted" style="margin:0">Source: ${esc(r.source)}</p>`:""}
  </div><div class="sheet-ft"><button class="btn primary" data-act="addToPlan" data-id="${r.id}" ${db?"":"disabled"}>Add to plan</button><span class="grow"></span><button class="btn" data-act="editRecipe" data-id="${r.id}" ${db?"":"disabled"}>Edit</button></div>`;
}

function blankRecipe(){return{id:null,name:"",servings:4,minutes:"",source:"",diet:"omnivore",tags:"",allergens:[],ingredients:[blankIng(),blankIng(),blankIng()],steps:"",notes:"",lang:null,original:null,extra:blankExtra(),files:[],scanText:"",busy:false,progress:"",photo:null,photoNew:null,photoAuto:false,saving:false}}
function blankExtra(){return Object.fromEntries(EXTRA.map(([k])=>[k,""]))}
function blankIng(){return{qty:"",unit:"",name:"",aisle:"Other",kcal:"",protein:"",carbs:"",fat:""}}
function edTotalsHtml(){const t=totals({ingredients:ED.ingredients,servings:ED.servings});return `<div class="stats"><div class="stat"><b>${Math.round(t.kcal)}</b><span>kcal</span></div><div class="stat p"><b>${Math.round(t.protein)}</b><span>Protein g</span></div><div class="stat c"><b>${Math.round(t.carbs)}</b><span>Carbs g</span></div><div class="stat f"><b>${Math.round(t.fat)}</b><span>Fat g</span></div></div><p class="muted" style="margin:0;font-size:.85rem">Per serving. Ingredient values below are for the whole recipe.</p>`}
function sEditor(){
  const e=ED,canAI=!!sample,canImg=!!imgLimits;
  return hd(e.id?"Edit recipe":"Add recipe")+`<div class="sheet-bd">
  ${e.id?"":`<div class="panel"><h3>Read it for me</h3>
    ${canAI?`${canImg?`<div class="drop" id="drop"><b>Add photos or screenshots of the recipe</b>
      <div class="row" style="flex-wrap:wrap;justify-content:center"><label class="btn primary pickbtn">Choose photos<input type="file" id="edFiles" accept="image/*" multiple></label><label class="btn pickbtn">Take a photo<input type="file" id="edCam" accept="image/*" capture="environment"></label></div>
      <span style="font-size:.88rem">Up to ${imgLimits.maxCount} images. On a computer you can also drag files here or paste a screenshot.</span>${pickHint()}</div>`:""}
    ${e.files.length?`<div class="thumbs">${e.files.map((f,i)=>`<figure><img src="${f.url}" alt="Recipe photo ${i+1}"><button class="x" data-act="rmFile" data-i="${i}" aria-label="Remove photo">×</button></figure>`).join("")}</div>`:""}
    <label class="f"><span>${canImg?"Or paste the recipe text":"Paste the recipe text"}</span><textarea id="scanText" rows="4" data-ed="scanText" placeholder="Paste a recipe from a website or message">${esc(e.scanText)}</textarea></label>
    <div class="row" style="flex-wrap:wrap">${e.busy?`<span class="progress"><span class="spin"></span>${esc(e.progress||"Reading the recipe…")}</span><button class="btn sm" data-act="stopAI">Stop</button>`:`<button class="btn primary" data-act="scan">Read recipe</button><span class="muted" style="font-size:.88rem">Claude fills in the form below. Check it before saving.</span>`}</div>`
    :`<p class="muted" style="margin:0">Reading photos needs Claude, which isn't available in this view. Type the recipe in below.</p>`}</div>`}
  ${dishPanel(e)}
  <div class="panel"><div class="row" style="justify-content:space-between;flex-wrap:wrap"><h3>Basics</h3>${e.busy?(e.id?`<span class="progress"><span class="spin"></span>${esc(e.progress)}</span>`:""):canAI?`<button class="btn sm" data-act="translateEd">${e.lang===recipeLang()?"Re-translate":"Translate to "+LANGS[recipeLang()]}</button>`:""}</div>
    <label class="f"><span>Name</span><input type="text" id="edName" data-ed="name" value="${esc(e.name)}" placeholder="e.g. Chicken paprikash"></label>
    <div class="g2"><label class="f"><span>Servings</span><input type="number" min="1" id="edServ" data-ed="servings" value="${esc(e.servings)}"></label>
    <label class="f"><span>Time (min)</span><input type="number" min="0" id="edMin" data-ed="minutes" value="${esc(e.minutes)}"></label>
    <label class="f"><span>Diet</span><select id="edDiet" data-ed="diet">${DIETS.map(d=>`<option value="${d[0]}" ${e.diet===d[0]?"selected":""}>${d[1]}</option>`).join("")}</select></label></div>
    <label class="f"><span>Tags</span><input type="text" id="edTags" data-ed="tags" value="${esc(e.tags)}" placeholder="quick, soup, kids like it"></label>
    <label class="f"><span>Source</span><input type="text" id="edSrc" data-ed="source" value="${esc(e.source)}" placeholder="Book, website or person"></label></div>
  <div class="panel"><h3>Allergens</h3><div class="toggles">${allAllergens().map(a=>`<button data-act="edAl" data-id="${a[0]}" aria-pressed="${e.allergens.includes(a[0])}">${esc(a[1])}</button>`).join("")}</div>
    ${newTagForm("ed")}<p class="muted" style="margin:0;font-size:.85rem">Your own allergens are also spotted automatically from ingredient names. Manage them with “Allergens” on the Recipes page.</p></div>
  <div class="panel"><div class="row" style="justify-content:space-between;flex-wrap:wrap"><h3>Ingredients</h3>${canAI?(e.busy?"":`<button class="btn sm" data-act="estimate">Estimate nutrition &amp; allergens</button>`):""}</div>
    <div id="edTotals">${edTotalsHtml()}</div>
    <div class="ingtable"><table><thead><tr><th style="width:70px">Qty</th><th style="width:70px">Unit</th><th>Ingredient</th><th style="width:120px">Aisle</th><th style="width:64px">kcal</th><th style="width:54px">P g</th><th style="width:54px">C g</th><th style="width:54px">F g</th><th></th></tr></thead><tbody>
    ${e.ingredients.map((i,n)=>`<tr><td class="n"><input type="text" inputmode="decimal" id="i${n}q" data-ing="${n}" data-f="qty" value="${esc(i.qty)}" aria-label="Quantity"></td><td><input type="text" id="i${n}u" data-ing="${n}" data-f="unit" value="${esc(i.unit)}" aria-label="Unit" placeholder="g"></td><td><input type="text" id="i${n}n" data-ing="${n}" data-f="name" value="${esc(i.name)}" aria-label="Ingredient"></td>
    <td><select id="i${n}a" data-ing="${n}" data-f="aisle" aria-label="Aisle">${AISLES.map(a=>`<option ${i.aisle===a?"selected":""}>${a}</option>`).join("")}</select></td>
    ${["kcal","protein","carbs","fat"].map(k=>`<td class="n"><input type="text" inputmode="decimal" id="i${n}${k}" data-ing="${n}" data-f="${k}" value="${esc(i[k])}" aria-label="${k}"></td>`).join("")}
    <td><button class="x" data-act="rmIng" data-i="${n}" aria-label="Remove ingredient">×</button></td></tr>`).join("")}</tbody></table></div>
    <div><button class="btn sm" data-act="addIng">Add ingredient</button></div></div>
  <div class="panel"><h3>More nutrition · per serving</h3><div class="g2">${EXTRA.map(([k,l])=>`<label class="f"><span>${l} (g)</span><input type="text" inputmode="decimal" id="ex_${k}" data-ex="${k}" value="${esc(e.extra?.[k]??"")}"></label>`).join("")}</div>
    <p class="muted" style="margin:0;font-size:.85rem">Claude fills these in when it reads or estimates a recipe. The week plan's nutrition check uses them.</p></div>
  <div class="panel"><h3>Method</h3><label class="f"><span>One step per line</span><textarea id="edSteps" rows="7" data-ed="steps">${esc(e.steps)}</textarea></label>
    <label class="f"><span>Notes</span><textarea id="edNotes" rows="2" data-ed="notes">${esc(e.notes)}</textarea></label></div>
  </div><div class="sheet-ft"><button class="btn primary" data-act="saveRecipe" ${e.saving?"disabled":""}>${e.saving?"Saving…":"Save recipe"}</button><button class="btn" data-act="close">Cancel</button><span class="grow"></span>${e.id?`<button class="btn danger ${armed==="recipe"?"armed":""}" data-act="delRecipe">${armed==="recipe"?"Tap again to delete":"Delete"}</button>`:""}</div>`;
}

/* the finished dish: picked by hand, or cut out of the recipe pictures by Claude when it reads them */
function dishPanel(e){
  const cur=e.photoNew?e.photoNew.url:photoSrc(e.photo);
  if(!assets)return cur?`<div class="panel"><h3>Food photo</h3><div class="dish"><div class="prev">${photoImg(cur,"Food photo")}</div><p class="muted" style="margin:0;font-size:.88rem;flex:1 1 180px">Only people who can edit Mealtime can change the photo.</p></div></div>`:"";
  const note=e.photoAuto?"Claude found this picture of the dish in the photos you added. Replace or remove it if it isn't right."
    :cur?"Shown on the recipe card and the recipe page.":e.id?"Add a picture of the finished dish. It shows on the recipe card and the recipe page."
    :"When Claude reads a recipe from photos, it picks out a picture of the finished dish if there is one. You can also add your own.";
  return `<div class="panel"><h3>Food photo</h3><div class="dish"><div class="prev">${cur?photoImg(cur,"Food photo"):BOWL}</div>
    <div class="acts"><label class="btn sm pickbtn">${cur?"Replace photo":"Choose photo"}<input type="file" id="edPhoto" accept="image/*"></label><label class="btn sm pickbtn">Take photo<input type="file" id="edPhotoCam" accept="image/*" capture="environment"></label>${cur?`<button class="btn sm ghost danger" data-act="rmPhoto">Remove</button>`:""}</div></div>
    <p class="muted" style="margin:0;font-size:.85rem">${note}</p></div>`;
}
/* box = [left, top, right, bottom] as fractions of the picture; the result is a JPEG at most 1600 px on its long side */
async function dishJpeg(blob,box){
  const url=URL.createObjectURL(blob);
  try{const img=new Image();img.src=url;await img.decode();
    const W=img.naturalWidth,H=img.naturalHeight,[l,t,r,b]=box||[0,0,1,1];
    const sx=Math.round(l*W),sy=Math.round(t*H),sw=Math.max(1,Math.round((r-l)*W)),sh=Math.max(1,Math.round((b-t)*H));
    const k=Math.min(1,1600/Math.max(sw,sh)),c=document.createElement("canvas");c.width=Math.round(sw*k);c.height=Math.round(sh*k);
    c.getContext("2d").drawImage(img,sx,sy,sw,sh,0,0,c.width,c.height);
    return await new Promise(res=>c.toBlob(res,"image/jpeg",.85));
  }catch{return null}finally{URL.revokeObjectURL(url)}
}
function setDish(ed,blob,auto){if(ed.photoNew)URL.revokeObjectURL(ed.photoNew.url);ed.photoNew={blob,url:URL.createObjectURL(blob)};ed.photoAuto=auto}
async function pickDish(file){
  const ed=ED;if(!ed||!file)return;
  const blob=await dishJpeg(file);
  if(!blob){toast("That photo's format can't be read here. Take a screenshot of it and add the screenshot.");return}
  setDish(ed,blob,false);if(ED===ed)renderSheet();
}
/* Claude's answer: {"image": index of the attached picture, "box": [l,t,r,b]}; ignored when it doesn't make sense */
async function autoDish(ed,d){
  if(!assets||!d||typeof d!=="object"||ed.photoNew||photoSrc(ed.photo))return;
  const f=ed.files[Math.round(num(d.image))];if(!f||!Array.isArray(d.box)||d.box.length!==4)return;
  const cl=v=>Math.min(1,Math.max(0,num(v)));let[l,t,r,b]=d.box.map(cl);
  if(r<l)[l,r]=[r,l];if(b<t)[t,b]=[b,t];if((r-l)*(b-t)<.04)return;
  const blob=await dishJpeg(f.file,[l,t,r,b]);if(blob)setDish(ed,blob,true);
}
function assetErr(e){switch(e?.code){
  case"too_large":return"That photo is too big to save. Try a smaller one.";
  case"unsupported_type":return"That photo's format can't be saved. Try a JPEG or PNG.";
  case"quota_or_state":return"Photo storage is full. Remove photos from old recipes and try again.";
  case"rate_limited":return"Too many photos at once. Wait a minute and save again.";
  case"not_granted":case"capability_disabled":case"capability_removed":return"Photos can't be saved from this view.";
  case"storage/unauthorized":case"storage/unauthenticated":return"Couldn't save the photo: this account isn't allowed to add photos yet (storage/unauthorized). The recipe was saved without it.";
  case"storage/retry-limit-exceeded":case"storage/canceled":return"The connection dropped while saving the photo. The recipe was saved without it: open it and add the photo again.";
  case"storage/quota-exceeded":return"Photo storage is full. Remove photos from old recipes and try again.";
  default:return`Couldn't save the photo${e?.code?` (${e.code})`:""}. The recipe was saved without the new photo.`;
}}

function sPicker(){
  const p=S.picker,dy={people:slotPeople(p.k,p.slot),guests:slotGuests(p.k,p.slot)},q=(p.q||"").toLowerCase().trim(),d=new Date(p.k+"T12:00");
  const used=new Set();for(let i=0;i<7;i++)for(const m of day(dkey(addDays(S.weekStart,i))).meals)used.add(m.recipeId);
  const likes=dy.people.map(person).filter(Boolean).flatMap(x=>(x.likes||[]).map(l=>l.toLowerCase()));
  let rs=S.recipes.filter(r=>!q||(r.name+" "+(r.tags||[]).join(" ")+" "+(r.ingredients||[]).map(i=>i.name).join(" ")).toLowerCase().includes(q));
  const favBy=r=>dy.people.map(person).filter(x=>x&&(x.favorites||[]).includes(r.id));
  const score=r=>{const hay=(r.name+" "+(r.tags||[]).join(" ")).toLowerCase();return favBy(r).length*3+likes.filter(l=>hay.includes(l)).length*2-(used.has(r.id)?1:0)};
  const safe=rs.filter(r=>!conflicts(r,dy.people).length).sort((a,b)=>score(b)-score(a)||a.name.localeCompare(b.name));
  const unsafe=rs.filter(r=>conflicts(r,dy.people).length);
  const names=dy.people.map(person).filter(Boolean).map(x=>esc(x.name));
  const row=(r,warn)=>{const t=totals(r),cs=warn?conflicts(r,dy.people):[];const liked=likes.filter(l=>(r.name+" "+(r.tags||[]).join(" ")).toLowerCase().includes(l));
    return `<li><button data-act="pick" data-id="${r.id}"><b>${esc(r.name)}</b><small>${favBy(r).length?`<span class="heart" style="color:var(--f)">♥</span> ${esc(favBy(r).map(x=>x.name).join(", "))} · `:""}${Math.round(t.kcal)} kcal per serving · ${esc(DIET_LABEL[r.diet]||"")}${used.has(r.id)?" · already this week":""}${liked.length?" · matches likes: "+esc(liked.join(", ")):""}</small>${cs.length?`<span class="why">Not safe for ${whyText(cs)}</span>`:""}</button></li>`};
  const home=p.mode==="home",other=p.mode==="other",title=hd(`Add meal · ${fmtDay.format(d)} ${fmtDate.format(d)}`);
  const top=`<div class="toggles" role="group" aria-label="Add from"><button data-act="pickMode" data-v="recipes" aria-pressed="${!home&&!other}">Recipes</button><button data-act="pickMode" data-v="home" aria-pressed="${home}">At home${S.pantry.length?` · ${S.pantry.length}`:""}</button><button data-act="pickMode" data-v="other" aria-pressed="${other}">Out · leftovers</button></div>
  <div class="g2"><label class="f"><span>Meal</span><select id="pkSlot" data-pk="slot">${SLOTS.map(s=>`<option ${p.slot===s?"selected":""}>${s}</option>`).join("")}</select></label>
  ${other?`<label class="f"><span>Note (optional)</span><input type="text" id="pkNote" data-pk="note" value="${esc(p.note||"")}" placeholder="Where, or of what" maxlength="60"></label>`
    :`<label class="f"><span>Search</span><input type="search" id="pkQ" data-pk="q" value="${esc(p.q||"")}" placeholder="${home?"Name":"Name or ingredient"}"></label>`}</div>`;
  const cooked=new Set();for(let i=1;i<=7;i++)for(const m of day(dkey(addDays(d,-i))).meals)if(m.recipeId&&!m.leftover)cooked.add(m.recipeId);
  const byName=[...S.recipes].sort((a,b)=>(a.name||"").localeCompare(b.name||"")),recent=byName.filter(r=>cooked.has(r.id)),rest=byName.filter(r=>!cooked.has(r.id));
  if(other)return title+`<div class="sheet-bd">${top}
    ${S.recipes.length?`<label class="f"><span>Leftovers of (optional)</span><select id="pkLrec" data-pk="lrec"><option value="">No recipe</option>${recent.length?`<optgroup label="Cooked in the last week">${recent.map(r=>`<option value="${r.id}" ${p.lrec===r.id?"selected":""}>${esc(r.name)}</option>`).join("")}</optgroup>`:""}<optgroup label="All recipes">${rest.map(r=>`<option value="${r.id}" ${p.lrec===r.id?"selected":""}>${esc(r.name)}</option>`).join("")}</optgroup></select></label>`:""}
    <p class="muted" style="margin:0">For meals with nothing to cook. Leftovers of a recipe count in the nutrition check and warn about allergens; eating out and leftovers without a recipe aren't counted. Add a note if you like, then tap one.</p>
    <ul class="pick"><li><button data-act="pickOther" data-kind="out"><b>Eating out</b><small>Restaurant, takeaway, a meal at someone's place</small></button></li>
    <li><button data-act="pickOther" data-kind="leftovers"><b>Leftovers</b><small>Something already cooked that's waiting to be eaten</small></button></li></ul></div>`;
  if(home){
    const here=new Set(day(p.k).meals.filter(m=>isHome(m)&&normSlot(m.slot)===p.slot).map(m=>m.home.id)),nq=pNorm(q);
    const items=[...S.pantry].filter(x=>!nq||pNorm(x.name).includes(nq)).sort((a,b)=>(daysLeft(a)??999)-(daysLeft(b)??999)||a.name.localeCompare(b.name));
    const careful=dy.people.map(person).filter(Boolean).some(x=>(x.allergens||[]).length||(x.avoid||[]).length);
    const hrow=it=>{const n=daysLeft(it),cs=homeConflicts(it.name,dy.people),on=here.has(it.id);
      return `<li><button data-act="pickHome" data-id="${it.id}" aria-pressed="${on}"><b>${on?"✓ ":""}${esc(it.name)}</b><small>${esc([WHERE_L[it.where||"fridge"],LEVEL[it.level||3],n!=null?leftLbl(n):""].filter(Boolean).join(" · "))}${on?` · in ${esc(p.slot.toLowerCase())}`:""}</small>${cs.length?`<span class="why">Not for ${whyText(cs)}</span>`:""}</button></li>`};
    return title+`<div class="sheet-bd">${top}
    <p class="muted" style="margin:0">Things from your At home list, such as bakery rolls that need no cooking. Tap to add; tap again to take off. Whatever needs using soon comes first.</p>
    ${items.length?`<ul class="pick">${items.map(hrow).join("")}</ul>`:S.pantry.length?`<p class="muted" style="margin:0">Nothing at home matches “${esc(p.q)}”.</p>`:`<p class="muted" style="margin:0">Nothing is listed at home yet.</p><button class="btn sm" data-act="pickGoHome">Open At home</button>`}
    ${careful&&items.length?`<p class="muted" style="margin:0;font-size:.85rem">Food at home isn't checked for allergens, only for won't-eat words and your own allergens, by name. Check the label when it matters.</p>`:""}</div>
    <div class="sheet-ft"><button class="btn primary" data-act="close">Done</button></div>`;
  }
  return title+`<div class="sheet-bd">${top}
  <p class="muted" style="margin:0">${names.length?`Cooking for ${names.join(", ")}${dy.guests?` and ${dy.guests} guest${dy.guests>1?"s":""}`:""}. Suggestions leave out anything they can't eat.`:`Nobody from the family is down for ${esc(p.slot.toLowerCase())} this day, so every recipe is shown.`} You can change who's eating in the week plan.</p>
  <div class="sec">Suggested · ${safe.length}</div>
  ${safe.length?`<ul class="pick">${safe.map(r=>row(r,false)).join("")}</ul>`:`<p class="muted" style="margin:0">${S.recipes.length?"No recipe suits everyone at the table.":"Add some recipes first."}</p>`}
  ${unsafe.length?(p.showAll?`<div class="sec">Not safe for someone · ${unsafe.length}</div><ul class="pick">${unsafe.map(r=>row(r,true)).join("")}</ul>`:`<button class="btn sm ghost" data-act="pickShowAll">Show ${unsafe.length} recipe${unsafe.length>1?"s":""} that someone can't eat</button>`):""}
  </div>`;
}

/* week calendar: one row per day, one cell per slot; tapping a cell adds the recipe there, tapping it again takes it off */
function sAddPlan(){
  const a=S.addPlan,r=recipe(a.id),today=dkey(new Date());
  if(!r)return hd("Add to plan")+`<div class="sheet-bd"><p>This recipe was deleted.</p></div>`;
  let rows="";
  for(let i=0;i<7;i++){
    const d=addDays(a.ws,i),k=dkey(d),dy=day(k),cut={};
    for(const s of SLOTS)for(const c of conflicts(r,slotPeople(k,s)))cut[c.p.name]=1;
    const cutNames=Object.keys(cut);
    rows+=`<div class="cal-day ${k===today?"today":""}"><div class="cal-date"><b>${fmtDay.format(d)}</b><span>${fmtDate.format(d)}</span>${cutNames.length?`<em>Not for ${esc(cutNames.join(", "))}</em>`:""}</div>`
      +SLOTS.map(s=>{
        const mine=a.added.find(x=>x.k===k&&x.slot===s),ms=dy.meals.filter(m=>normSlot(m.slot)===s&&(!mine||m.id!==mine.mealId)),cs=conflicts(r,slotPeople(k,s));
        return `<button class="cal-cell ${mine?"added":""} ${cs.length?"warn":""}" data-act="calToggle" data-k="${k}" data-s="${s}" aria-pressed="${!!mine}" ${cs.length?`title="Not safe for ${esc(cs.map(c=>c.p.name+" ("+c.why.join(", ")+")").join("; "))}"`:""} aria-label="${mine?"Remove from":"Add to"} ${s}, ${fmtDay.format(d)} ${fmtDate.format(d)}${cs.length?", not safe for "+esc(cs.map(c=>c.p.name).join(", ")):""}">${ms.map(m=>`<span class="cal-meal">${esc(mealName(m))}</span>`).join("")}${mine?`<span class="cal-mine">${esc(r.name)}</span>`:`<span class="cal-plus" aria-hidden="true">+</span>`}</button>`;
      }).join("")+`</div>`;
  }
  const thisWeek=dkey(a.ws)===dkey(monday(new Date()));
  return hd("Add to plan")+`<div class="sheet-bd"><p style="margin:0">Tap a slot to add <b>${esc(r.name)}</b>. Tap it again to take it off.</p>
  <div class="weeknav" style="justify-content:center"><button class="btn sm" data-act="calWeek" data-d="-7" aria-label="Previous week">‹</button><span class="lbl">${weekLabel(a.ws)}</span><button class="btn sm" data-act="calWeek" data-d="7" aria-label="Next week">›</button>${thisWeek?"":`<button class="btn sm ghost" data-act="calWeek" data-d="0">This week</button>`}</div>
  <div class="cal"><div class="cal-head"><span></span>${SLOTS.map(s=>`<span title="${s}">${SLOT_SHORT[s]}</span>`).join("")}</div>${rows}</div></div>
  <div class="sheet-ft"><button class="btn primary" data-act="close">Done${a.added.length?` · ${a.added.length} added`:""}</button><button class="btn" data-act="openRecipe" data-id="${a.id}">Back to recipe</button></div>`;
}

function mealsText(p){
  const f=a=>!a||a.length===SLOTS.length?"all meals":a.length?a.join(", "):"no meals";
  const wd=f(p.meals?.weekday),we=f(p.meals?.weekend);
  return wd===we?`${wd[0].toUpperCase()+wd.slice(1)}, every day`:`Weekdays: ${wd} · Weekends: ${we}`;
}

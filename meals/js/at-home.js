/* Meals · meals/js/at-home.js · At home: what we have, shopping cards, upcoming uses, reading receipts, best-before.
   Plain script: shares one scope with the other meals/js/*.js files (loaded in order by meals/index.html). */
/* ---------- At home: what we have, so less gets forgotten (5 Nov 2026) ----------
   Food at home with a rough level (plenty / some / last bit), where it lives, when it came in and Claude's use-by guess,
   a "use soon" strip, and pantry staples as an always-visible grid. Add by hand, or from a receipt photo or a delivery-app
   screenshot: Claude reads it, and nothing saves until you've reviewed it, including which open cards on the
   shopping lists were bought (ticked off on Trello as done). "Used up" asks whether to put it on the groceries list;
   things marked "always" go on by themselves; "Went off" just removes it, no tally. "What can we cook?" (on request)
   starts from what needs using, then our recipes, fits everyone's food profiles, and says what's missing.
   Data: pantry/<id> {name, where, level 1-3, added, useBy, always}, kitchen/staples {list [{id, name}], low {id: true}}. */
const WHERE=[["fridge","Fridge"],["freezer","Freezer"],["pantry","Pantry"],["bowl","Fruit bowl"]],WHERE_L=Object.fromEntries(WHERE);
const LEVEL={3:"plenty",2:"some",1:"last bit"};
const STAPLES_SEED=["Mouka hladká","Mouka polohrubá","Cukr","Sůl","Olej","Olivový olej","Ocet","Rýže","Těstoviny","Ovesné vločky","Kypřicí prášek","Strouhanka","Bujón","Pepř","Paprika sladká","Kmín","Bobkový list","Hořčice","Kečup","Sójová omáčka","Med","Kakao","Čaj","Káva"];
function todayK(){return dkey(new Date())}
function daysLeft(it){if(!it.useBy)return null;return Math.round((new Date(it.useBy+"T12:00")-new Date(todayK()+"T12:00"))/864e5)}
function leftLbl(n){return n==null?"":n<0?"still there?":n===0?"use today":n===1?"use tomorrow":n<=6?`~${n} days`:n<=30?`~${Math.round(n/7)} wk`:"keeps"}
function staples(){const k=S.kitchen.staples||{};return{list:k.list||STAPLES_SEED.map(n=>({id:slug(n),name:n})),low:k.low||{}}}
function saveStaples(patch){S.kitchen.staples={...(S.kitchen.staples||{}),...patch,low:{...(staples().low),...(patch.low||{})}};render();if(db)write("kitchen/staples",()=>db.doc("kitchen/staples").set(S.kitchen.staples))}
function savePantry(it){const i=S.pantry.findIndex(x=>x.id===it.id);if(i>=0)S.pantry[i]=it;else S.pantry.push(it);render();if(db){const{id,...body}=it;write("pantry/"+id,()=>db.doc("pantry/"+id).set(body))}}
function dropPantry(id){S.pantry=S.pantry.filter(x=>x.id!==id);render();if(db)write("pantry/"+id,()=>db.doc("pantry/"+id).delete())}
/* leftovers of a cooked meal go into At home like anything else (fridge, a few days), so they get eaten before they go stale (10 Nov 2026) */
const LEFT_DAYS=3,leftName=n=>"Leftovers · "+n;
function saveLeftover(name,where="fridge",days=LEFT_DAYS){
  const nm=leftName(String(name).trim().slice(0,60)),same=S.pantry.find(p=>pNorm(p.name)===pNorm(nm));
  savePantry({...(same||{}),id:same?.id||uid(),name:nm,where,level:3,added:todayK(),useBy:dkey(addDays(new Date(),days)),leftover:true});return nm;
}
/* meals cooked today or in the last three days, to offer as "leftovers from…" (recipes only, not leftovers themselves, not already stored) */
function recentCooked(){
  const seen=new Set(),out=[];
  for(let i=0;i<=3;i++)for(const m of day(dkey(addDays(new Date(),-i))).meals){const r=m.recipeId&&!m.leftover?recipe(m.recipeId):null;
    if(!r||seen.has(r.id)||S.pantry.some(p=>pNorm(p.name)===pNorm(leftName(r.name))))continue;seen.add(r.id);out.push(r)}
  return out;
}
const pNorm=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/\s+/g," ").trim();
/* one card on the groceries list (or another shopping list), unless one with that name is already open there */
async function addFood(name,listId=T_LISTS.shop,quiet){
  if(!mcp){if(!quiet)toast("Connect Trello in "+CONN_WHERE+" to send things to the shopping list.");return false}
  if(!listId){if(!quiet)toast("Choose your groceries list in Afloat: Settings → Your task lists.");return false}
  try{const open=(await trOpen(listId)).filter(x=>!x.complete).map(x=>pNorm(x.name));const n=pNorm(name);
    if(open.some(o=>o===n||o.startsWith(n+" ")||o.startsWith(n+" —"))){if(!quiet)toast(name+" is already on the list.");return true}
    await mcp.callTool(TRELLO,"trelloWriteCard",{action:"create",listId,name,pos:"bottom"},{cache:false});if(!quiet)toast(name+" is on "+T_NAMES.shop+".");return true}
  catch(e){toast(trErr(e));return false}
}
/* Claude's use-by guesses for things added by hand: days from today */
async function guessDays(items){
  if(!sample||!items.length)return;
  try{const out=await sample.json(`For each food, how many days it usually stays good at home from today, stored where given (opened packs as usual for a family). Reply with only JSON {"days": {"<name>": number}}.\n${items.map(x=>`- ${x.name} (${WHERE_L[x.where]||x.where})`).join("\n")}`,{modelTier:"quick"});
    for(const x of items){const d=Math.round(+(out?.days||{})[x.name]);if(d>0){const cur=S.pantry.find(y=>y.id===x.id);if(cur&&!cur.useBy)savePantry({...cur,useBy:dkey(addDays(new Date(),Math.min(d,730)))})}}}catch(e){console.warn("use-by guess",e)}
}
/* upcoming meals in the week plan that use this item: "tomorrow breakfast", "Mon lunch" */
function plannedFor(it){
  const t=todayK(),tm=dkey(addDays(new Date(),1)),out=[];
  for(const k of Object.keys(S.plan).sort()){if(k<t)continue;
    for(const m of day(k).meals)if(isHome(m)&&m.home.id===it.id)out.push(`${k===t?"today":k===tm?"tomorrow":fmtDay.format(new Date(k+"T12:00"))} ${normSlot(m.slot).toLowerCase()}`)}
  return out.length>3?[...out.slice(0,3),`+${out.length-3} more`]:out;
}
function homeRow(it){
  const n=daysLeft(it),soon=n!=null&&n<=2,pl=plannedFor(it);
  return `<li class="item hm${soon?" soon":""}"><span class="nm">${esc(it.name)}${it.always?` <span class="muted" title="Always rebuy">↻</span>`:""}${it.leftover?` <span class="homechip">leftovers</span>`:""}</span>
    <button class="btn sm lvl l${it.level||3}" data-act="phLevel" data-id="${it.id}" aria-label="Amount: ${LEVEL[it.level||3]}. Tap when there's less">${LEVEL[it.level||3]}</button>
    <span class="from">${[n!=null?leftLbl(n):"",it.added?`in since ${fmtDate.format(new Date(it.added+"T12:00"))}`:""].filter(Boolean).join(" · ")}${pl.length?`${n!=null||it.added?" · ":""}<span class="planned">planned: ${esc(pl.join(", "))}</span>`:""}</span>
    <label class="byedit">Best before <input type="date" data-pby="${it.id}" value="${esc(it.useBy||"")}" aria-label="Best before date for ${esc(it.name)}"></label>
    <span class="ph-acts"><button class="btn sm" data-act="phUsed" data-id="${it.id}">Used up</button><button class="btn sm ghost" data-act="phOff" data-id="${it.id}">Went off</button>${it.leftover?"":`<button class="btn sm ghost" data-act="phAlways" data-id="${it.id}" aria-pressed="${!!it.always}">${it.always?"↻ always":"Always buy"}</button>`}</span></li>`;
}
function vHome(){
  const items=[...S.pantry].sort((a,b)=>(daysLeft(a)??999)-(daysLeft(b)??999)||a.name.localeCompare(b.name)),soon=items.filter(x=>{const n=daysLeft(x);return n!=null&&n<=2}),st=staples();
  let html=`<div class="bar"><div><h1>At home</h1><p>What we have, so less gets forgotten. Roughly right is plenty.</p></div>
    <div class="row"><button class="btn primary" data-act="scanOpen" ${db?"":"disabled"}>Add from a receipt</button><button class="btn" data-act="cookOpen" ${sample?"":"disabled"}>What can we cook?</button></div></div>`;
  if(S.askBuy)html+=`<div class="askbuy"><span><b>${esc(S.askBuy.name)}</b> is used up. Put it on ${esc(T_NAMES.shop)}?</span><span class="row"><button class="btn sm primary" data-act="buyYes">Yes</button><button class="btn sm" data-act="buyAlways">Always</button><button class="btn sm ghost" data-act="buyNo">Not this time</button></span></div>`;
  const rc=recentCooked();
  if(rc.length)html+=`<div class="leftq"><h3>Any leftovers?</h3><div class="chips">${rc.map(r=>`<button class="stchip" data-act="phLeftFrom" data-id="${esc(r.id)}">${esc(r.name)}</button>`).join("")}</div></div>`;
  if(soon.length)html+=`<div class="usesoon"><h3>Use soon</h3><div class="chips">${soon.map(x=>`<span class="soonchip">${esc(x.name)} · ${leftLbl(daysLeft(x))}</span>`).join("")}</div></div>`;
  if(loading()&&!items.length)html+=loadingBlock("what's at home");
  else if(!items.length)html+=`<div class="empty"><h2>Nothing listed yet</h2><p>Add a receipt or a screenshot from a delivery app, or add things by hand below. It doesn't have to be complete to help.</p></div>`;
  for(const[w,l]of WHERE){const its=items.filter(x=>(x.where||"fridge")===w);if(!its.length)continue;html+=`<div class="aisle"><h3>${l}</h3><ul class="items">${its.map(homeRow).join("")}</ul></div>`}
  html+=`<form class="row addhome" data-form="phAdd"><input type="text" id="phName" placeholder="Add by hand, e.g. jogurty" aria-label="Food" required><select id="phWhere" aria-label="Where">${WHERE.map(([k,l])=>`<option value="${k}">${l}</option>`).join("")}</select><label class="addby">Best before <input type="date" id="phUseBy" aria-label="Best before (optional)"></label><button class="btn" ${db?"":"disabled"}>Add</button><button type="button" class="btn ghost" data-act="phLeftover" ${db?"":"disabled"}>Add as leftovers</button></form>`;
  html+=`<div class="aisle"><h3>Pantry staples</h3><p class="muted" style="margin:0 0 8px;font-size:.85rem">Always assumed to be there. Tap one when it's running low: it goes onto ${esc(T_NAMES.shop)}, and a receipt that shows it refills it.</p>
    <div class="chips">${st.list.map(x=>`<button class="stchip${st.low[x.id]?" low":""}" data-act="stToggle" data-id="${esc(x.id)}" aria-pressed="${!!st.low[x.id]}">${st.low[x.id]?"Low · ":""}${esc(x.name)}</button>`).join("")}</div>
    <form class="row" data-form="stAdd" style="margin-top:8px"><input type="text" id="stName" placeholder="Another staple" aria-label="Another staple"><button class="btn sm" ${db?"":"disabled"}>Add</button></form></div>`;
  return html;
}
/* ---------- reading a receipt or a delivery-app screenshot ---------- */
/* long receipts and screenshots are cut into pieces so the text stays readable (Claude sees about 1,568 px on the long side) */
async function receiptParts(file){
  const url=URL.createObjectURL(file);
  try{const img=new Image();img.src=url;await img.decode();const W=img.naturalWidth,H=img.naturalHeight,out=[];
    const step=Math.round(W*1.8),parts=H/W>2.2?Math.ceil((H-W*0.2)/step):1;
    for(let i=0;i<parts&&out.length<6;i++){const sy=parts===1?0:Math.max(0,i*step-Math.round(W*0.1)),sh=parts===1?H:Math.min(H-sy,step+Math.round(W*0.2));
      const k=Math.min(1,1568/Math.max(W,sh)),c=document.createElement("canvas");c.width=Math.round(W*k);c.height=Math.round(sh*k);c.getContext("2d").drawImage(img,0,sy,W,sh,0,0,c.width,c.height);
      out.push(await new Promise(res=>c.toBlob(res,"image/jpeg",.88)))}
    return out.filter(Boolean)}catch{return[]}finally{URL.revokeObjectURL(url)}
}
async function scanRead(files){
  const sc=S.scan;if(!sc||!sample)return;sc.busy="Reading…";sc.err="";renderSheet();
  try{
    const imgs=[];for(const f of files.slice(0,4))imgs.push(...await receiptParts(f));
    if(!imgs.length){sc.busy="";sc.err="That image couldn't be read here. Try a screenshot of it.";renderSheet();return}
    let cards=[];if(mcp){try{for(const[k,id]of[[T_NAMES.shop,T_LISTS.shop],[T_NAMES.drug,T_LISTS.drug],[T_NAMES.med,T_LISTS.med]])if(id)cards.push(...(await trOpen(id)).filter(c=>!c.complete).map(c=>({id:c.id,name:c.name,list:k})))}catch(e){console.warn(e)}}
    const st=staples().list,codes=cards.map((c,i)=>({...c,code:"C"+(i+1)}));
    sc.busy="Picking out the food…";renderSheet();
    const out=await sample.json(`These images are a shopping receipt or a screenshot from a supermarket or delivery app (Czech, e.g. Rohlík, Košík, Tesco, Albert, Billa, Lidl). Several images may be parts of one long receipt; don't count overlapping lines twice.
List every bought product once. For each give:
- "name": a short, plain Czech name a person would write on a shopping list (e.g. "Mléko polotučné", "Rajčata", "Toaletní papír"), not the receipt abbreviation;
- "kind": "food" (food and drink), "drug" (drogerie: cleaning, toiletries, paper, pet supplies), "med" (lékárna: medicines, plasters, vitamins) or "other";
- "where" for food: "fridge", "freezer", "pantry" or "bowl" (fruit and veg kept out);
- "days" for food: about how many days it stays good at home from today;
- "staple": the id of the pantry staple it refills, if it is one of: ${st.map(x=>`${x.id} = ${x.name}`).join("; ")}; otherwise null.
Then match bought products against these open shopping-list cards; a card counts as bought only if a bought product clearly is that thing:
${codes.map(c=>`${c.code}: ${c.name} (${c.list})`).join("\n")||"(no open cards)"}
Reply with only JSON: {"items": [{"name": "", "kind": "food", "where": "fridge", "days": 5, "staple": null}], "bought": ["C1"]}`,{images:imgs,signal:(aiCtl=new AbortController()).signal});
    const items=(Array.isArray(out?.items)?out.items:[]).filter(x=>x&&String(x.name||"").trim()).slice(0,80).map(x=>({id:uid(),name:String(x.name).trim().slice(0,60),kind:["food","drug","med","other"].includes(x.kind)?x.kind:"food",where:WHERE_L[x.where]?x.where:"fridge",days:Math.max(0,Math.min(730,Math.round(+x.days||0))),staple:st.some(s=>s.id===x.staple)?x.staple:null,on:true}));
    items.forEach(x=>{if(x.kind!=="food"&&!x.staple)x.on=false});
    sc.items=items;sc.cards=(Array.isArray(out?.bought)?out.bought:[]).map(c=>codes.find(x=>x.code===c)).filter(Boolean).map(c=>({...c,on:true}));
    sc.busy="";if(!items.length)sc.err="Claude couldn't find any products in that. Try a sharper photo or a screenshot.";renderSheet();
  }catch(e){if(S.scan){S.scan.busy="";S.scan.err=e?.code==="aborted"?"":aiErr(e);renderSheet()}}finally{aiCtl=null}
}
/* best-before for a reviewed receipt item: what was typed, else Claude's guess in days, else nothing */
function scBy(x){return x.by!==undefined?x.by:(x.days?dkey(addDays(new Date(),x.days)):null)}
function sScan(){
  const sc=S.scan||{};
  if(!sc.items)return hd("Add from a receipt")+`<div class="sheet-bd"><p style="margin:0">A photo of the receipt, or a screenshot from Rohlík, Košík or another delivery app. Long receipts can be one tall screenshot or a few photos.</p>
    ${sc.busy?`<div class="empty"><div class="spin"></div><p class="progress">${esc(sc.busy)}</p></div>`:`<label class="btn primary" for="scanFiles">Choose photos or screenshots</label><input type="file" id="scanFiles" accept="image/*" multiple hidden>
    <label class="btn" for="scanCam">Take a photo</label><input type="file" id="scanCam" accept="image/*" capture="environment" hidden>`}
    ${sc.err?`<div class="note">${esc(sc.err)}</div>`:""}<p class="muted" style="font-size:.85rem">You'll check everything before it's saved. Only food is added here; drogerie and lékárna items just get ticked off their shopping lists.</p></div>
    <div class="sheet-ft"><button class="btn" data-act="close">Cancel</button></div>`;
  const food=sc.items.filter(x=>x.kind==="food"||x.staple),rest=sc.items.filter(x=>!(x.kind==="food"||x.staple)),n=sc.items.filter(x=>x.on).length,cn=(sc.cards||[]).filter(c=>c.on).length;
  const row=x=>`<li class="item sc"><input type="checkbox" data-act="scTick" data-id="${x.id}" ${x.on?"checked":""} aria-label="Keep ${esc(x.name)}"><input type="text" class="scname" data-sc="${x.id}" value="${esc(x.name)}" aria-label="Name">
    <span class="amt">${x.staple?`refills ${esc((staples().list.find(s=>s.id===x.staple)||{}).name||"")}`:x.kind==="food"?`<select data-scw="${x.id}" aria-label="Where">${WHERE.map(([k,l])=>`<option value="${k}" ${x.where===k?"selected":""}>${l}</option>`).join("")}</select>`:x.kind==="drug"?"drogerie":x.kind==="med"?"lékárna":"other"}</span>
    ${x.kind==="food"&&!x.staple?`<label class="byedit">Best before${x.by===undefined&&x.days?` (guess)`:""} <input type="date" data-scby="${x.id}" value="${esc(scBy(x)||"")}" aria-label="Best before for ${esc(x.name)}"></label>`:""}</li>`;
  return hd("Check what Claude found")+`<div class="sheet-bd">
    <div class="sec">Food for At home</div>${food.length?`<ul class="items">${food.map(row).join("")}</ul>`:'<p class="muted">No food found.</p>'}
    ${rest.length?`<div class="sec">Not food</div><p class="muted" style="margin:0;font-size:.85rem">These aren't added here. Tick one if it's actually food.</p><ul class="items">${rest.map(row).join("")}</ul>`:""}
    <div class="sec">Bought from the shopping lists</div>${(sc.cards||[]).length?`<ul class="items">${sc.cards.map(c=>`<li class="item"><input type="checkbox" data-act="scCard" data-id="${esc(c.id)}" ${c.on?"checked":""} aria-label="Tick off ${esc(c.name)}"><span class="nm">${esc(c.name)}</span><span class="amt">${esc(c.list)}</span></li>`).join("")}</ul><p class="muted" style="margin:0;font-size:.85rem">Ticked cards are marked done on Trello, not deleted.</p>`:`<p class="muted">${mcp?"Nothing on the shopping lists matched.":"Connect Trello to tick off what you bought."}</p>`}
    </div><div class="sheet-ft"><button class="btn primary" data-act="scSave" ${sc.saving?"disabled":""}>${sc.saving?"Saving…":`Save${n?` ${n}`:""}${cn?` · tick off ${cn}`:""}`}</button><button class="btn" data-act="close">Cancel</button></div>`;
}
async function scanSave(){
  const sc=S.scan;if(!sc||sc.saving)return;sc.saving=true;renderSheet();
  const now=todayK(),low={};
  for(const x of sc.items.filter(y=>y.on)){
    if(x.staple){low[x.staple]=false;continue}
    const same=S.pantry.find(p=>pNorm(p.name)===pNorm(x.name));
    savePantry({...(same||{}),id:same?.id||uid(),name:x.name,where:x.where||"fridge",level:3,added:now,useBy:scBy(x)||(same?.useBy||null),always:!!same?.always});
  }
  if(Object.keys(low).length)saveStaples({low});
  let ticked=0;for(const c of(sc.cards||[]).filter(c=>c.on)){try{await mcp.callTool(TRELLO,"trelloWriteCard",{action:"mark_done",cardId:c.id},{cache:false});ticked++}catch(e){toast(trErr(e));break}}
  const added=sc.items.filter(y=>y.on&&!y.staple).length;S.scan=null;closeSheet();render();
  toast([added?`${added} thing${added===1?"":"s"} added`:"",Object.keys(low).length?`${Object.keys(low).length} staple${Object.keys(low).length===1?"":"s"} refilled`:"",ticked?`${ticked} ticked off on Trello`:""].filter(Boolean).join(", ")+".");
}

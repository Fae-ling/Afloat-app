/* Meals · meals/js/data.js · Shared food data (allergens, diets, slots), helpers, recipes and their language, the plan/day model, food at home, storage.
   Plain script: shares one scope with the other meals/js/*.js files (loaded in order by meals/index.html). */
/* the EU 14, diets, meal slots and nutrition guidelines are shared with Afloat's family profiles (platform/food.js) */
const {ALLERGENS,PERSON_DIETS,SLOTS,SEX_WORD,guide}=window.FOOD;
const AL=Object.fromEntries(ALLERGENS);
const DIETS=[["omnivore","Contains meat"],["pescatarian","Pescatarian"],["vegetarian","Vegetarian"],["vegan","Vegan"]];
const DIET_LABEL=Object.fromEntries(DIETS);
const DIET_RANK={omnivore:0,pescatarian:1,vegetarian:2,vegan:3};
const AISLES=["Produce","Meat & fish","Dairy & eggs","Bakery","Pantry","Spices & condiments","Frozen","Drinks","Other"];
const SLOT_SHORT={"Breakfast":"Breakfast","Morning snack":"Snack","Lunch":"Lunch","Afternoon snack":"Snack","Dinner":"Dinner"};
const EXTRA=[["fiber","Fibre"],["sugar","Sugar"],["satfat","Saturated fat"],["salt","Salt"],["fruitveg","Fruit & veg"]];
const EXTRA_RULE=`Per-serving estimates for ONE serving: "fiber", "sugar" (total sugars), "satfat" (saturated fat) and "salt" in grams with one decimal, and "fruitveg" = grams of fruit, vegetables and legumes in one serving (potatoes don't count).`;
function hasExtra(r){return!!r.extra&&typeof r.extra.fiber==="number"}
function cleanExtra(o){return o&&typeof o==="object"?Object.fromEntries(EXTRA.map(([k])=>[k,Math.round(num(o[k])*10)/10])):null}
function normSlot(s){return s==="Snack"?"Afternoon snack":SLOTS.includes(s)?s:"Dinner"}
const AV_COLORS=["#2C6E49","#3A76AD","#AE527A","#B8741A","#6B5BB5","#2F8A8A","#9A4B2F"];
const UNITS={g:["g",1],gram:["g",1],grams:["g",1],kg:["g",1000],mg:["g",.001],dkg:["g",10],dag:["g",10],ml:["ml",1],l:["ml",1000],dl:["ml",100],cl:["ml",10],tsp:["tsp",1],teaspoon:["tsp",1],teaspoons:["tsp",1],tbsp:["tsp",3],tablespoon:["tsp",3],tablespoons:["tsp",3],cup:["ml",240],cups:["ml",240],oz:["g",28.35],ounce:["g",28.35],ounces:["g",28.35],lb:["g",453.6],lbs:["g",453.6],pound:["g",453.6],pounds:["g",453.6],c:["ml",240],"fl oz":["ml",30],floz:["ml",30],pint:["ml",475],pints:["ml",475],pt:["ml",475],quart:["ml",950],quarts:["ml",950],qt:["ml",950],gallon:["ml",3785],gallons:["ml",3785],stick:["g",113],sticks:["g",113],pcs:["pcs",1],pc:["pcs",1],piece:["pcs",1],pieces:["pcs",1],ks:["pcs",1],"":["pcs",1],
  "lžíce":["tsp",3],pl:["tsp",3],"lžička":["tsp",1],"čl":["tsp",1],clove:["clove",1],cloves:["clove",1],"stroužek":["clove",1],"stroužky":["clove",1],
  pinch:["pinch",1],"špetka":["pinch",1],bunch:["bunch",1],svazek:["bunch",1],can:["can",1],cans:["can",1],plechovka:["can",1],pack:["pack",1],"balení":["pack",1],bal:["pack",1]};
/* recipes in Czech show amounts the Czech way: decimal comma, PL/ČL for spoons, ks for pieces */
const UNIT_CS={tsp:"ČL",tbsp:"PL",pcs:"ks",clove:"strouž.",pinch:"špetka",bunch:"svazek",can:"plech.",pack:"bal."};
const IMPERIAL=/^(cups?|c|oz|ounces?|lbs?|pounds?|quarts?|qt|pints?|pt|fl ?oz|sticks?|gallons?|inch(es)?|in)$/;

const S={tab:"recipes",recipes:[],people:[],favPeople:[],prof:null,hh:null,legacy:[],plan:{},shop:{},tags:[],settings:{},tx:null,ex:null,cv:null,nutriOpen:true,nutriFor:null,got:{},slow:false,dbError:null,
  weekStart:monday(new Date()),q:"",safeFor:"",shopDays:[1,1,1,1,1,1,1],hideChecked:false,
  sheet:null,detail:null,picker:null,addPlan:null,pantry:[],kitchen:{},scan:null,cook:null,askBuy:null};
let db=null,sample=null,imgLimits=null,assets=null,ED=null,aiCtl=null,armed=null;
/* food photos are artifact assets; a recipe keeps only the asset id in r.photo */
const BOWL=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M4 11h16a8 8 0 0 1-16 0Z"/><path d="M9 7c0-1.5 1-1.5 1-3M13 7c0-1.5 1-1.5 1-3"/></svg>`;
function photoSrc(id){return /^[0-9a-f]{32}$/.test(String(id||""))?(window.claude&&window.claude.blobUrl?window.claude.blobUrl(id):"/_blob/"+id):""}
function photoImg(src,alt){return src?`<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" onerror="this.insertAdjacentHTML('afterend',BOWL);this.remove()">`:BOWL}

/* ---------- helpers ---------- */
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function pad(n){return String(n).padStart(2,"0")}
function dkey(d){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function monday(d){const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());return addDays(x,-((x.getDay()+6)%7))}
const fmtDay=new Intl.DateTimeFormat("en-GB",{weekday:"short"});
const fmtDate=new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short"});
function weekLabel(ws){const we=addDays(ws,6);return ws.getMonth()===we.getMonth()?`${ws.getDate()}–${fmtDate.format(we)} ${we.getFullYear()}`:`${fmtDate.format(ws)} – ${fmtDate.format(we)}`}
function num(v){const n=Number(v);return isFinite(n)?n:0}
function rnd(n,d=0){return String(+Number(n).toFixed(d))}
function uid(){return Math.random().toString(36).slice(2,10)}
function list(s){return String(s||"").split(",").map(x=>x.trim()).filter(Boolean)}
function avColor(id){let h=0;for(const c of String(id))h=(h*31+c.charCodeAt(0))>>>0;return AV_COLORS[h%AV_COLORS.length]}
function initials(n){return esc(String(n||"?").trim().split(/\s+/).map(w=>w[0]).slice(0,2).join("").toUpperCase())}
function avatar(p,cls="av"){return `<span class="${cls}" style="background:${esc(p.color||avColor(p.id))}">${initials(p.name)}</span>`}
function recipe(id){return S.recipes.find(r=>r.id===id)}
function person(id){return S.people.find(p=>p.id===id)}
function favPerson(id){return S.favPeople.find(p=>p.id===id)}
function favs(rid){return S.favPeople.filter(p=>(p.favorites||[]).includes(rid))}
function isExample(x){return (x.tags||[]).includes("example")}
/* recipes are kept in one language (settings/app.recipeLang); r.lang marks a recipe as checked, r.original keeps the untranslated text */
const LANGS={cs:"Czech",en:"English"};
function recipeLang(){return LANGS[S.settings.recipeLang]?S.settings.recipeLang:"cs"}
function needsTx(r){return r.lang!==recipeLang()}
function vocab(){const L=recipeLang(),s=new Set();for(const r of S.recipes)if(r.lang===L)for(const i of r.ingredients||[])if(i.name)s.add(String(i.name).toLowerCase());return[...s].sort().slice(0,250)}
/* allergens = the EU 14 plus the user's own tags (S.tags); own tags also match by ingredient keyword */
function allAllergens(){return ALLERGENS.concat(S.tags.map(t=>[t.id,t.label]))}
function alLabel(id){return AL[id]||S.tags.find(t=>t.id===id)?.label||null}
function validAl(ids){return(Array.isArray(ids)?ids:[]).map(String).filter(alLabel)}
function recipeAllergens(r){
  const set=new Set(validAl(r.allergens)),hay=(r.ingredients||[]).map(i=>String(i.name||"")).concat(r.original?.ingredients||[]).join(" | ").toLowerCase();
  for(const t of S.tags)if((t.keywords||[]).some(k=>k&&hay.includes(k.toLowerCase())))set.add(t.id);
  return[...set];
}
function alChips(ids,none){return ids.map(a=>`<span class="al">${esc(alLabel(a))}</span>`).join("")||none}
function slug(s){return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}
function addTag(label){
  const l=label.toLowerCase(),std=ALLERGENS.find(a=>a[1].toLowerCase()===l||a[0]===l);if(std)return{id:std[0]};
  const have=S.tags.find(t=>t.label.toLowerCase()===l);if(have)return have;
  let id="x-"+(slug(label)||uid());if(S.tags.some(t=>t.id===id))id+="-"+uid().slice(0,4);
  const t={id,label,keywords:[l],createdAt:Date.now()};S.tags.push(t);
  if(db)write("allergenTags/"+id,()=>db.doc("allergenTags/"+id).set({label:t.label,keywords:t.keywords,createdAt:t.createdAt}));
  return t;
}
function newTagForm(where){return `<form class="row" data-form="newTag" data-where="${where}"><input type="text" id="newTag_${where}" placeholder="Add your own, e.g. Cashew" aria-label="New allergen name"><button class="btn sm" ${db?"":"disabled"}>Add</button></form>`}

function totals(r){const t={kcal:0,protein:0,carbs:0,fat:0};for(const i of r.ingredients||[])for(const k in t)t[k]+=num(i[k]);const s=Math.max(1,num(r.servings)||1);for(const k in t)t[k]/=s;return t}
function macroBar(t){const p=t.protein*4,c=t.carbs*4,f=t.fat*9,s=p+c+f||1;return `<div class="macro" aria-hidden="true"><i class="mp" style="width:${p/s*100}%"></i><i class="mc" style="width:${c/s*100}%"></i><i class="mf" style="width:${f/s*100}%"></i></div>`}
function norm(u){const k=String(u||"").toLowerCase().trim().replace(/\.$/,"");return UNITS[k]||[k,1]}
function uLabel(u){return recipeLang()==="cs"?(UNIT_CS[u]||u):u}
function nStr(n,d){const s=rnd(n,d);return recipeLang()==="cs"?s.replace(".",","):s}
function fmtAmt(q,u){
  if(u==="g")return q>=1000?nStr(q/1000,2)+" kg":(q<10?nStr(q,1):Math.round(q))+" g";
  if(u==="ml")return q>=1000?nStr(q/1000,2)+" l":(q<10?nStr(q,1):Math.round(q))+" ml";
  if(u==="tsp")return q>=3?nStr(q/3,1)+" "+uLabel("tbsp"):nStr(q,1)+" "+uLabel("tsp");
  if(u==="pcs")return nStr(q,1)+(recipeLang()==="cs"?" ks":"");
  return nStr(q,1)+" "+uLabel(u);
}
function nonMetric(r){
  return(r.ingredients||[]).some(i=>i.name&&IMPERIAL.test(String(i.unit||"").toLowerCase().trim().replace(/\.$/,"")))
    ||/°\s?F\b|fahrenheit|gas mark|\bcups?\b|\bounces?\b|\boz\b|\blbs?\b|\bpounds?\b|\binch(es)?\b|\bsticks? of butter/i.test((r.steps||[]).join(" ")+" "+(r.notes||""));
}
/* a safety net for Claude's reading (13 Nov 2026): cups, ounces, pounds, sticks… that slipped through become g or ml, rounded to a kitchen amount */
function toMetric(i){
  const k=String(i.unit||"").toLowerCase().trim().replace(/\.$/,"");if(!IMPERIAL.test(k))return i;
  const[bu,m]=norm(k);if(bu!=="g"&&bu!=="ml")return i;
  if(i.qty===""||i.qty==null)return{...i,unit:bu};
  const q=Number(String(i.qty).replace(",","."));if(!isFinite(q))return i;
  const v=q*m;return{...i,qty:v>=100?Math.round(v/5)*5:Math.round(v),unit:bu};
}
function fmtIng(i,f=1){if(i.qty===null||i.qty===""||i.qty===undefined)return i.unit?uLabel(norm(i.unit)[0]):"";const[bu,m]=norm(i.unit);return fmtAmt(num(i.qty)*m*f,bu)}

/* day = what's planned for a date. Who eats is decided per slot: day.slots[slot] = {people, guests} once changed by hand,
   otherwise the regulars whose usual mealtimes (person.meals.weekday / .weekend) include that slot.
   Days saved before per-slot attendance carry a day-wide people/guests list that seeds every slot. */
function day(k){const d=S.plan[k];return{meals:d?.meals??[],slots:d?.slots??{},people:d?.people??null,guests:d?.guests??0}}
function isWeekend(k){const w=new Date(k+"T12:00").getDay();return w===0||w===6}
function usualSlots(p,k){const set=isWeekend(k)?p.meals?.weekend:p.meals?.weekday;return Array.isArray(set)?set:SLOTS}
function slotPeople(k,s){
  const dy=day(k),o=dy.slots[s];if(o&&Array.isArray(o.people))return o.people.filter(person);
  return(dy.people??S.people.filter(p=>p.regular).map(p=>p.id)).filter(id=>{const p=person(id);return p&&usualSlots(p,k).includes(s)});
}
function slotGuests(k,s){const dy=day(k),o=dy.slots[s];return o&&o.guests!=null?o.guests:(dy.people?dy.guests||0:0)}
/* a child eats a portion sized to their energy needs (to the nearest quarter); adults and guests count as one */
function portionFactor(p){return p?.child?Math.max(.5,Math.round(guide(p).kcal/2000*4)/4):1}
function fmtP(n){const w=Math.floor(n),f=Math.round((n-w)*4);return(w||!f?String(w):"")+["","¼","½","¾"][f]}
function headcount(k,s){const n=slotPeople(k,s).map(person).reduce((a,p)=>a+portionFactor(p),0)+slotGuests(k,s);return Math.max(1,Math.round(n*4)/4)}
function portions(m,k){return m.portions??headcount(k,normSlot(m.slot))}
/* a planned meal is a recipe (m.recipeId) or something already at home (m.home = {id, name} of an At home item).
   Home items have no portions, nutrition or shopping; the name is kept so the plan still reads right after the item is used up. */
function isHome(m){return!!m.home}
function homeItem(m){return S.pantry.find(x=>x.id===m.home.id)}
function homeName(m){return homeItem(m)?.name||m.home.name||"Food at home"}
/* "Eating out" and "Leftovers" (m.other = {kind: "out"|"leftovers", note}) are planned meals with no recipe either */
const OTHER={out:"Eating out",leftovers:"Leftovers"};
function isOther(m){return!!m.other}
function isPlain(m){return isHome(m)||isOther(m)}  /* any planned meal that is not a recipe */
function otherName(m){return(OTHER[m.other.kind]||"Other")+(m.other.note?` · ${m.other.note}`:"")}
/* leftovers of a recipe are an ordinary recipe meal flagged m.leftover: they count in the nutrition check and warn about allergens,
   but add nothing to the shopping list (the food is already cooked) */
function mealName(m){
  if(isOther(m))return otherName(m);if(isHome(m))return homeName(m);
  const n=recipe(m.recipeId)?.name||"Deleted recipe";return m.leftover?`Leftovers · ${n}`:n;
}
/* rough nutrition for ONE adult serving of a food at home, guessed by Claude once per food name and kept in kitchen/nut
   (by name, not on the At home item, so the plan keeps its numbers after the item is used up and a re-bought food needs no new guess) */
function nutFor(name){return S.kitchen.nut?.items?.[pNorm(name)]||null}
/* the estimate dressed as a one-serving recipe, so the nutrition check can treat it like any other meal */
function homeAsRecipe(m){
  const n=nutFor(homeName(m));if(!n)return null;
  return{id:"home:"+pNorm(n.name),name:homeName(m),servings:1,diet:"omnivore",ingredients:[{name:homeName(m),kcal:n.kcal,protein:n.protein,carbs:n.carbs,fat:n.fat}],extra:{fiber:n.fiber,sugar:n.sugar,satfat:n.satfat,salt:n.salt,fruitveg:n.fruitveg}};
}
function weekHomeNames(){
  const names=new Set();
  for(let i=0;i<7;i++)for(const m of day(dkey(addDays(S.weekStart,i))).meals)if(isHome(m)&&!nutFor(homeName(m)))names.add(homeName(m));
  return[...names];
}
async function estimateHome(names){
  names=[...new Set(names.filter(n=>n&&!nutFor(n)))];
  if(!names.length||!sample||!db||S.estBusy)return false;
  S.estBusy=true;render();let n=0;
  try{
    const out=await sample.json(`For each food, estimate the nutrition of ONE typical serving as one adult would eat it at a meal. For example "Rohlíky" is 2 rolls, "Máslo" is about 10 g spread on bread, "Jogurty" is one pot. These are Czech household foods; assume typical Czech products.
Foods:
${names.map(x=>"- "+x).join("\n")}
Reply with only JSON: {"items": {"<name exactly as given>": {"serving": "short Czech label, e.g. 2 rohlíky", "kcal": number, "protein": grams, "carbs": grams, "fat": grams, "fiber": grams, "sugar": grams, "satfat": grams, "salt": grams, "fruitveg": grams}}}
${EXTRA_RULE}`,{modelTier:"quick",cache:false});
    const items={...(S.kitchen.nut?.items||{})},r1=v=>Math.max(0,Math.round(num(v)*10)/10);
    for(const nm of names){
      const x=(out?.items||{})[nm];if(!x||typeof x!=="object")continue;
      const kc=Number(x.kcal);if(!isFinite(kc)||kc<0||kc>1500)continue;
      items[pNorm(nm)]={name:nm,serving:String(x.serving||"").trim().slice(0,40),kcal:Math.round(kc),protein:r1(x.protein),carbs:r1(x.carbs),fat:r1(x.fat),fiber:r1(x.fiber),sugar:r1(x.sugar),satfat:r1(x.satfat),salt:r1(x.salt),fruitveg:r1(x.fruitveg)};n++;
    }
    if(n){S.kitchen.nut={id:"nut",items};write("kitchen/nut",()=>db.doc("kitchen/nut").set({items}))}
  }catch(e){console.warn("home nutrition",e)}
  finally{S.estBusy=false;render()}
  return n>0;
}
/* food at home has no ingredient list, so it is only checked by name: won't-eat words and the family's own allergens (by keyword) */
function homeConflictsFor(name,p){
  const hay=String(name||"").toLowerCase(),out=[];
  for(const t of S.tags)if(validAl(p.allergens).includes(t.id)&&(t.keywords||[]).some(k=>k&&hay.includes(k.toLowerCase())))out.push(t.label);
  for(const w of p.avoid||[]){const t=w.toLowerCase().trim();if(t&&hay.includes(t))out.push(w)}
  return out;
}
function homeConflicts(name,ids){return ids.map(person).filter(Boolean).map(p=>({p,why:homeConflictsFor(name,p)})).filter(x=>x.why.length)}
function conflictsFor(r,p){
  const out=[];
  const ra=recipeAllergens(r);
  for(const a of validAl(p.allergens))if(ra.includes(a))out.push(alLabel(a));
  if(p.diet&&p.diet!=="omnivore"&&(DIET_RANK[r.diet]??0)<DIET_RANK[p.diet])out.push("not "+p.diet);
  const hay=((r.name||"")+" | "+(r.ingredients||[]).map(i=>i.name||"").join(" | ")).toLowerCase();
  for(const w of p.avoid||[]){const t=w.toLowerCase().trim();if(t&&hay.includes(t))out.push(w)}
  return out;
}
function conflicts(r,ids){return ids.map(person).filter(Boolean).map(p=>({p,why:conflictsFor(r,p)})).filter(x=>x.why.length)}
function whyText(cs){return cs.map(c=>`${esc(c.p.name)} (${esc(c.why.join(", "))})`).join("; ")}

/* ---------- storage ---------- */
const queues={};
function write(path,fn){queues[path]=(queues[path]||Promise.resolve()).then(fn).catch(e=>{toast(dbErr(e))});return queues[path]}
function dbErr(e){if(e?.code==="quota_exceeded")return"Storage is full. Delete some old recipes or plans and try again.";if(e?.code==="invalid_argument")return"You can view this app but not change it.";return"Couldn't save that change. Check your connection and try again."}
function subscribe(col,apply){
  db.collection(col).onSnapshot(snap=>{apply(snap.docs.map(d=>({id:d.id,...d.data()})));S.got[col]=true;render();if(S.sheet==="picker")renderSheet()},
    err=>{S.got[col]=true;S.dbError=err.code;render()});
}
function loading(){return db&&!["recipes","profiles","plan","shopping","allergenTags","settings"].every(c=>S.got[c])}

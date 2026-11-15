/* Meals · meals/js/boot.js · Swiping and start-up (runs last).
   Plain script: shares one scope with the other meals/js/*.js files (loaded in order by meals/index.html). */
/* ---------- boot ---------- */
/* swiping (platform/swipe.js): left/right between Recipes, Week plan and Shopping list, and on into Afloat's
   neighbouring screens at either end; a sheet closes when swiped down from the top; shopping items tick with a swipe right */
if(window.SWIPE){const TS=()=>({plan:["plan"],meals:["recipes","shopping","home"],all:["recipes","plan","shopping","home"]})[mode()];
  SWIPE.pageEl=()=>document.getElementById("view");
  SWIPE.page=dir=>{if(S.sheet)return false;const T=TS(),i=T.indexOf(S.tab),j=i+(dir==="l"?1:-1);
    if(j>=0&&j<T.length){setTab(T[j]);return true}
    /* past either end, on into Afloat's neighbouring screen: Calendar, Rhythms, Week plan | Recipes, Shopping, At home | Self-care */
    try{if(EMB){window.top.location.hash=mode()==="plan"?(dir==="l"?"meals":"rhythms"):(dir==="l"?"care":"mealplan");return true}}catch{}return false};
  SWIPE.tabs=SWIPE.page;SWIPE.sheetEl=t=>t.closest("#sheet");SWIPE.sheet=()=>{closeSheet();render();return true}}
(function(){const h=(location.hash||"").slice(1),m=mode();
  if(m==="plan")S.tab="plan";
  else if(m==="meals")S.tab=["recipes","shopping","home"].includes(h)?h:"recipes";
  else if(["recipes","plan","shopping","home"].includes(h))S.tab=h})();
if(EMB){addEventListener("message",e=>{if(e.source!==window.parent)return;const m=e.data&&e.data.afloatMealsMode;if(m)setMode(m)});
  try{window.parent.postMessage({mealsReady:true},"*")}catch{}}
render();
(async()=>{
  const c=window.claude;
  if(!c||!c.use){db=null;render();return}
  const [d,s,m,a]=await Promise.all([c.use("db"),c.use("sample"),c.use("mcp").catch(()=>null),c.use("assets").catch(()=>null)]);
  db=d;sample=s;mcp=m;assets=a;
  /* Afloat's own lists (platform/todo.js), when the household uses them (home/trello.ownShared, read in family.js) */
  if(d&&window.afloatTodo)mcp=window.afloatTodo.wrap(m,d.app?d.app("afloat"):d,{on:()=>T_OWN,me:()=>"",people:()=>(S.hh?.members||[]).map(x=>x.name)});
  if(sample){const im=(await sample.limits().catch(()=>null))?.images;
    imgLimits=im?{maxCount:8,mediaTypes:["image/jpeg","image/png","image/gif","image/webp"],maxInputBytes:2000000,...(typeof im==="object"?im:{})}:null}
  if(db){
    subscribe("recipes",docs=>S.recipes=docs);
    subscribe("people",docs=>{S.legacy=docs;setTimeout(movePeople)});
    watchHome();
    subscribe("plan",docs=>{S.plan=Object.fromEntries(docs.map(x=>[x.id,x]))});
    subscribe("shopping",docs=>{S.shop=Object.fromEntries(docs.map(x=>[x.id,x]))});
    subscribe("pantry",docs=>{S.pantry=docs});
    subscribe("kitchen",docs=>{S.kitchen=Object.fromEntries(docs.map(x=>[x.id,x]))});
    subscribe("settings",docs=>{S.settings=docs.find(x=>x.id==="app")||{};setTimeout(movePeople)});
    subscribe("allergenTags",docs=>{S.tags=docs.sort((a,b)=>(a.createdAt||0)-(b.createdAt||0))});
    setTimeout(()=>{S.slow=true;if(loading())render()},10000);
  }
  render();
})();

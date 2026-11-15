/* Meals · meals/js/family.js · The family: food details from each person's profile in Afloat, favourites.
   Plain script: shares one scope with the other meals/js/*.js files (loaded in order by meals/index.html). */
/* ---------- the family: food details live on each person's profile in Afloat (Us → Family) ---------- */
let home=null;  /* Afloat's own data: home/profiles and home/household */
/* S.people = who Meals cooks for; S.favPeople = everyone, partners and friends too, for tagging favourite dishes */
function rebuildPeople(){S.people=S.prof?FOOD.people(S.prof,S.hh):[];S.favPeople=S.prof?FOOD.people(S.prof,S.hh,{all:true}):[]}
function openFamily(){try{window.top.location.hash="family"}catch{toast("Open Us → Family in Afloat.")}}
/* Mealtime's old People list moves onto the family profiles once: matched by name to the household or a friend,
   anyone else becomes a friend. Their Mealtime id comes along, so earlier week plans still know who ate what.
   The old people/* documents are left as they were, as a backup. */
let moving=false;
async function movePeople(){
  if(moving||!home||!S.prof||!S.hh||!S.got.people||!S.got.settings||S.settings.peopleMoved||!(S.hh.members||[]).length)return;
  if(!S.legacy.length){write("settings/app",()=>db.doc("settings/app").update({peopleMoved:Date.now()}));S.settings={...S.settings,peopleMoved:1};return}
  moving=true;
  try{
    const cur=(await home.doc("home/profiles").get()).data()||{},pp={...(cur.people||{})},fr=[...(cur.friends||[])];
    const hh=[...(S.hh.members||[]).map(m=>m.name),...(S.hh.kids||[])],lc=x=>String(x||"").trim().toLowerCase();
    let n=0;
    for(const L of S.legacy){
      const m={id:L.id,...FOOD.meal(L,L.regular),...(L.child&&num(L.age)?{age:Math.round(num(L.age))}:{})};
      const h=hh.find(x=>lc(x)===lc(L.name));
      if(h){if(!(pp[h]||{}).meal){pp[h]={...(pp[h]||{}),meal:m};n++}continue}
      const i=fr.findIndex(f=>lc(f.name)===lc(L.name));
      const{notes,...fm}=m;
      if(i>=0){if(!fr[i].meal){fr[i]={...fr[i],meal:{on:true,...fm},...(!fr[i].food&&notes?{food:notes}:{})};n++}}
      else if(L.name){fr.push({id:"fr_"+L.id,name:String(L.name).trim(),type:"friend",meal:{on:true,...fm},...(notes?{food:notes}:{})});n++}
    }
    if(n)await home.doc("home/profiles").update({people:pp,friends:fr});
    await db.doc("settings/app").update({peopleMoved:Date.now()});S.settings={...S.settings,peopleMoved:1};
    if(n)toast("Everyone's food details now live on their profiles in Us → Family.");
  }catch(e){toast(dbErr(e))}finally{moving=false}
}
function watchHome(){
  home=db.app?db.app("afloat"):null;
  if(!home){S.got.profiles=true;return}
  const on=(k,f)=>home.doc("home/"+k).onSnapshot(s=>{f(s.data()||{});rebuildPeople();if(k==="profiles")S.got.profiles=true;render();if(S.sheet)renderSheet();movePeople()},err=>{S.got.profiles=true;S.dbError=err.code;render()});
  on("profiles",d=>S.prof=d);on("household",d=>S.hh=d);
  on("trello",d=>{const i=d.shopIds||{},n=d.shopNames||{};T_OWN=!!d.ownShared;T_LISTS.shop=i.food||null;T_LISTS.drug=i.drug||null;T_LISTS.med=i.med||null;T_NAMES.shop=n.food||"the shopping list";T_NAMES.drug=n.drug||"";T_NAMES.med=n.med||""});
}
/* favourites are kept on the person's profile */
function setFavorites(p,favorites){
  if(!home)return;
  if(p.home)write("profiles",()=>home.doc("home/profiles").update({people:{[p.key]:{meal:{favorites}}}}));
  else write("profiles",async()=>{const cur=(await home.doc("home/profiles").get()).data()||{};await home.doc("home/profiles").update({friends:(cur.friends||[]).map(f=>f.id===p.key?{...f,meal:{...(f.meal||{}),favorites}}:f)})});
}

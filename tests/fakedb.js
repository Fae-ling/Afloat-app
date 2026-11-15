// like fakedb.js, but Google keeps its own copy of events so two-way sync can be tested
(()=>{const st=JSON.parse(JSON.stringify(window.__SEED||{}));const L=[];
const fire=()=>setTimeout(()=>L.forEach(f=>f()),0);
const snapDoc=p=>({exists:p in st,data:()=>st[p]?JSON.parse(JSON.stringify(st[p])):undefined,id:p.split('/')[1]});
const docsOf=(c,w)=>Object.keys(st).filter(k=>k.split('/')[0]===c&&k.split('/').length===2).filter(k=>!w||(w[1]==='>'?(st[k][w[0]]||'')>w[2]:(st[k][w[0]]||'')>=w[2])).map(k=>snapDoc(k));
const merge=(a,b)=>{const o={...a};for(const k in b)o[k]=(b[k]&&typeof b[k]==='object'&&!Array.isArray(b[k])&&a[k]&&typeof a[k]==='object')?merge(a[k],b[k]):b[k];return o;};
const putPath=(o,s,v,del)=>{let x=o;for(let i=0;i<s.length-1;i++){if(!x[s[i]]||typeof x[s[i]]!=='object'||Array.isArray(x[s[i]]))x[s[i]]={};x=x[s[i]];}if(del)delete x[s[s.length-1]];else x[s[s.length-1]]=JSON.parse(JSON.stringify(v));};
window.__patches=[];
const doc=p=>({get:async()=>snapDoc(p),patch:async(pairs,full)=>{window.__patches.push([p,pairs.map(x=>x[0].join('.'))]);if(!(p in st)){st[p]=JSON.parse(JSON.stringify(full));fire();return;}for(const [s,v,del] of pairs)putPath(st[p],s,v,del);fire();},set:async d=>{st[p]=JSON.parse(JSON.stringify(d));fire();},update:async d=>{st[p]=merge(st[p]||{},d);fire();},delete:async()=>{delete st[p];fire();},
 onSnapshot:(cb)=>{const f=()=>cb(snapDoc(p));L.push(f);setTimeout(f,0);return()=>{const i=L.indexOf(f);if(i>=0)L.splice(i,1);};}});
const coll=(c,w)=>({where:(a,o,v)=>coll(c,[a,o,v]),get:async()=>({docs:docsOf(c,w)}),add:async d=>{st[c+'/'+Math.random().toString(36).slice(2)]=d;fire();},
 onSnapshot:(cb)=>{const f=()=>cb({docs:docsOf(c,w),metadata:{fromCache:false}});L.push(f);setTimeout(f,0);return()=>{};}});
window.__st=st;window.__fire=fire;
const G={};window.__G=G;
const toG=(e,id,cal)=>({id,cal,summary:e.title+(e.who&&e.who.length?' · '+e.who.join(', '):''),description:(e.who&&e.who.length?'Who: '+e.who.join(', ')+'\n':'')+'Added from Afloat',start:e.allDay?{date:e.date}:{dateTime:`${e.date}T${e.start}:00+01:00`},end:e.allDay?{date:e.endDate}:{dateTime:`${e.endDate||e.date}T${e.end||e.start}:00+01:00`},status:'confirmed',location:e.place||'',updated:'2026-11-03T07:53:00.000Z'});
for(const [k,e] of Object.entries(st)){ if(!k.startsWith('events/'))continue; if(e.gId)G[e.gId]=toG(e,e.gId,'fam'); if(e.gpGId)G[e.gpGId]=toG(e,e.gpGId,'gp'); }
const now=()=>new Date(Date.now()).toISOString();
const body=a=>({summary:a.summary,description:a.description,location:a.location,colorId:a.colorId,start:a.allDay?{date:a.startTime.slice(0,10)}:{dateTime:a.startTime+'+01:00'},end:a.allDay?{date:a.endTime.slice(0,10)}:{dateTime:a.endTime+'+01:00'}});
window.__calls=[];
const mcp={callTool:async(s,t,a)=>{window.__calls.push([s,t,JSON.parse(JSON.stringify(a))]);
 if(t==='list_calendars')return{payload:{calendars:[]}};
 if(t==='list_events'){const cal=a.calendarId&&a.calendarId.startsWith('d5d')?'gp':'fam';return{payload:{events:Object.values(G).filter(e=>e.cal===cal)}};}
 if(t==='create_event'){const id='new'+window.__calls.length;G[id]={id,cal:a.calendarId&&a.calendarId.startsWith('d5d')?'gp':'fam',...body(a),attendees:a.attendees,status:'confirmed',updated:now()};return{payload:{id,updated:G[id].updated}};}
 if(t==='update_event'){const g=G[a.eventId]||{};const bb=body(a);for(const k of ['summary','description','location','colorId'])if(a[k]!==undefined)g[k]=bb[k];if(a.startTime){g.start=bb.start;g.end=bb.end;}if(a.addedAttendees)g.attendees=[...(g.attendees||[]),...a.addedAttendees];if(a.removedAttendeeEmails)g.attendees=(g.attendees||[]).filter(x=>!a.removedAttendeeEmails.includes(x.email));g.updated=now();return{payload:{id:a.eventId,updated:g.updated}};}
 if(/Read/.test(t))return{payload:{cards:[]}};
 return{payload:{}};}};
window.claude={use:async k=>k==='db'?db:k==='mcp'?mcp:null};
const db={doc,collection:c=>coll(c),app:()=>db};})();
window.__CALM_OFF = !window.__CALM;

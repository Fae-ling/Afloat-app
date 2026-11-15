const { chromium, devices } = require('playwright');
const dark=process.argv[2]==='dark';
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({...devices['iPhone 13'],colorScheme:dark?'dark':'light'});const p=await ctx.newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(`window.__SEED=${require('fs').readFileSync(__dirname+'/seed.json','utf8')};`);await p.addInitScript(require('fs').readFileSync(__dirname+'/fakedb.js','utf8'));await p.addInitScript(()=>{localStorage.setItem('afloat.me','Alex');localStorage.setItem('afloat.brief','x');localStorage.setItem('afloat.calview','week')});
await p.clock.install({time:new Date('2026-11-03T10:30:00')});
await p.goto('file://'+require('path').resolve(__dirname,'../index.html')+'#calendar');await p.waitForTimeout(1200);
if(await p.$('[data-act=brief-close]'))await p.tap('[data-act=brief-close]');await p.waitForTimeout(150);
const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m);
const col=async sel=>p.$eval(sel, x=>getComputedStyle(x).getPropertyValue('--kc').trim());
ok((await col('.wk-card[data-id=fw1058327269]')).toLowerCase()==='#8e24aa', '1 Check-up (Sam) is Sam’s Grape');
ok((await col('.wk-card[data-id=fw1125441004]')).toLowerCase()==='#33b679', '2 Yoga class (Alex) is Alex’s Sage');
ok(await p.$eval('.wk-band[data-id=fw1095402740]', x=>x.getAttribute('style').includes('--ppl')), '3 girls at grandparents shows a stripe for Mia and Zoe');
await p.screenshot({path:__dirname+'/shots/'+`pc1${dark?'d':''}.png`});
// new event: tick people and watch the colour follow
await p.tap('[data-act=ev-new]');await p.waitForTimeout(150);
await p.fill('#evTitle','Test');
await p.tap('[data-act=ev-who][data-n=Sam]');await p.waitForTimeout(100);
ok(await p.$eval('[data-act=ev-col][aria-checked=true]', x=>x.dataset.v)==='3', '4 ticking Sam makes it Grape');
await p.tap('[data-act=ev-who][data-n="Alex"]');await p.waitForTimeout(100);
ok(await p.$eval('[data-act=ev-col][aria-checked=true]', x=>x.dataset.v)==='7', '5 Sam + Alex makes it Together (Peacock)');
await p.fill('#evDate','2026-11-12');await p.fill('#evStart','18:00');await p.fill('#evEndT','19:00');
await p.tap('form[data-form=event] button[type=submit]');await p.waitForTimeout(600);
ok(Object.values(await p.evaluate(()=>window.__G)).some(g=>g.summary&&g.summary.startsWith('Test')&&g.colorId==='7'), '6 Google got the Together colour');
// change Together colour → recolours Google
await p.evaluate(()=>{location.hash='calendar'});
await p.tap('.calfoot [data-act=go-colours]');await p.waitForTimeout(300);
await p.tap('[data-act=col-open][data-k=together]');await p.waitForTimeout(150);
await p.locator('#sec-cal-colours').screenshot({path:__dirname+'/shots/'+`pc2${dark?'d':''}.png`});
await p.tap('[data-act=together-col][data-v="1"]');await p.waitForTimeout(800);
console.log('DBG', JSON.stringify(await p.evaluate(()=>({cfg:window.__st['home/calendar'].togetherColor, ev:Object.values(window.__st).filter(x=>x&&x.title==='Test').map(x=>({g:x.gId,c:x.color,who:x.who,d:x.date})), calls:window.__calls.filter(c=>c[1]==='update_event').slice(-3).map(c=>c[2].colorId)}))));
ok(Object.values(await p.evaluate(()=>window.__G)).some(g=>g.summary&&g.summary.startsWith('Test')&&g.colorId==='1'), '7 changing Together recolours shared events in Google');
// person colour change → recolours that person's events in Google
await p.evaluate(()=>{location.hash='family'});await p.waitForTimeout(200);
await p.tap('[data-act=col-open][data-k="p:Sam"]');await p.waitForTimeout(150);await p.tap('[data-act=pcol][data-n=Sam][data-v="#F4511E"]');await p.waitForTimeout(800);
ok((await p.evaluate(()=>window.__G['q43k318urek462qr1e97s84al4'].colorId))==='6', '8 Sam → Tangerine recolours his Google events');
// a Google colour change on a single event is kept as that event's own colour
await p.evaluate(()=>{const g=window.__G['n723re5itd5pgtua05e4p5ifs8'];g.colorId='5';g.updated=new Date(Date.now()+60000).toISOString();});
await p.clock.runFor(61000);await p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await p.waitForTimeout(700);
ok((await p.evaluate(()=>window.__st['events/fw1138179901'].color))==='5', '9 recolouring one event in Google is kept as its own colour');
console.log(errs.length?errs.join('\n'):'NO PAGE ERRORS');await b.close()})();

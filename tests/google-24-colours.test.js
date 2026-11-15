const { chromium, devices } = require('playwright');
const dark=process.argv[2]==='dark';
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({...devices['iPhone 13'],colorScheme:dark?'dark':'light'});const p=await ctx.newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(`window.__SEED=${require('fs').readFileSync(__dirname+'/seed.json','utf8')};`);await p.addInitScript(require('fs').readFileSync(__dirname+'/fakedb.js','utf8'));await p.addInitScript(()=>{localStorage.setItem('afloat.me','Alex');localStorage.setItem('afloat.brief','x');localStorage.setItem('afloat.calview','week')});
await p.clock.install({time:new Date('2026-11-03T10:45:00')});
await p.goto('file://'+require('path').resolve(__dirname,'../index.html')+'#family');await p.waitForTimeout(1200);
if(await p.$('[data-act=brief-close]'))await p.tap('[data-act=brief-close]');await p.waitForTimeout(150);
const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m);
await p.tap('[data-act=col-open][data-k="p:Alex"]');await p.waitForTimeout(150);
ok((await p.$$('.pcard [data-act=pcol][data-n="Alex"]')).length===24, '1 people can pick from all 24 colours');
await p.locator('.pcard').first().screenshot({path:__dirname+'/shots/'+`pal1${dark?'d':''}.png`});
await p.tap('[data-act=pcol][data-n="Alex"][data-v="#D81B60"]');await p.waitForTimeout(700);
ok(await p.evaluate(()=>window.__G['sn4a8jfej3u8jdr5sg25jcebfs'].colorId)!=='2', '2 Alex → Cherry blossom recolours her Google events (to the nearest classic: '+await p.evaluate(()=>window.__G['sn4a8jfej3u8jdr5sg25jcebfs'].colorId)+')');
await p.evaluate(()=>{location.hash='calendar'});await p.waitForTimeout(300);
ok((await p.$eval('.wk-card[data-id=fw1125441004]', x=>getComputedStyle(x).getPropertyValue('--kc').trim())).toLowerCase()==='#d81b60', '3 in Afloat her events show the real Cherry blossom');
// next sync must not overwrite it with the Google approximation
await p.clock.runFor(61000);await p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await p.waitForTimeout(700);
ok((await p.$eval('.wk-card[data-id=fw1125441004]', x=>getComputedStyle(x).getPropertyValue('--kc').trim())).toLowerCase()==='#d81b60', '4 after syncing with Google it stays Cherry blossom in Afloat');
ok(await p.evaluate(()=>window.__st['events/fw1125441004'].color)==null, '5 and it is not mistaken for a manual colour change');
// event own colour from the new palette
await p.tap('.wk-card[data-id=fw1058327269]');await p.waitForTimeout(200);
ok((await p.$$('[data-act=ev-col]')).length===24, '6 event form offers all 24');
await p.tap('[data-act=ev-col][data-v=cobalt]');await p.tap('form[data-form=event] button[type=submit]');await p.waitForTimeout(700);
ok(await p.evaluate(()=>window.__G['q43k318urek462qr1e97s84al4'].colorId)==='7' || await p.evaluate(()=>window.__G['q43k318urek462qr1e97s84al4'].colorId)==='9', '7 Cobalt goes to Google as nearest classic ('+await p.evaluate(()=>window.__G['q43k318urek462qr1e97s84al4'].colorId)+')');
ok(await p.evaluate(()=>window.__st['events/fw1058327269'].color)==='cobalt', '8 Afloat keeps Cobalt for that event');
await p.clock.runFor(61000);await p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await p.waitForTimeout(700);
ok(await p.evaluate(()=>window.__st['events/fw1058327269'].color)==='cobalt', '9 still Cobalt after the next sync');
// someone recolours it in Google → Afloat follows
await p.evaluate(()=>{const g=window.__G['q43k318urek462qr1e97s84al4'];g.colorId='5';g.updated=new Date(Date.now()+60000).toISOString();});
await p.clock.runFor(61000);await p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await p.waitForTimeout(700);
ok(await p.evaluate(()=>window.__st['events/fw1058327269'].color)==='5', '10 a colour picked in Google still comes back (Banana)');
await p.tap('.calfoot [data-act=go-colours]');await p.waitForTimeout(300);await p.tap('[data-act=col-open][data-k=together]');await p.waitForTimeout(150);
await p.locator('#sec-cal-colours').screenshot({path:__dirname+'/shots/'+`pal2${dark?'d':''}.png`});
console.log(errs.length?errs.join('\n'):'NO PAGE ERRORS');await b.close()})();

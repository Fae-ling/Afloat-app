const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:400,height:860}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.clock.setFixedTime(new Date('2026-11-03T10:10:00'));
await p.goto('file://'+require('path').resolve(__dirname,'../index.html')+'#calendar');await p.waitForTimeout(300);
await p.click('[data-act=settings]');
for(const n of ['Alex','Sam']){await p.fill('#sheet form[data-form=member] input',n);await p.press('#sheet form[data-form=member] input','Enter');}
for(const n of ['Mia','Zoe']){await p.fill('#sheet form[data-form=kid] input',n);await p.press('#sheet form[data-form=kid] input','Enter');}
await p.click('#sheet [data-act=close-settings].link');
// event both busy, Sun 8 Nov 17-18, with a new friend
await p.click('[data-act=ev-new]');await p.waitForTimeout(60);
await p.fill('#evTitle','Powerpoint night');
await p.fill('#evDate','2026-11-08');await p.fill('#evStart','17:00');await p.fill('#evEndT','18:00');
await p.click('[data-act=ev-who][data-n="Alex"]');await p.click('[data-act=ev-who][data-n=Sam]');
await p.click('[data-act=fr-quick]');await p.fill('#frQName','Jo');await p.fill('#frQRel',"Sam's girlfriend");await p.click('[data-act=fr-quick-add]');
await p.waitForTimeout(60);
await p.screenshot({path:__dirname+'/shots/s20.png',fullPage:true});
await p.click('form[data-form=event] button[type=submit]');await p.waitForTimeout(200);
// overnight both busy Tue 10 Nov 19:00 -> 07:00
await p.click('[data-act=ev-new]');await p.fill('#evTitle','Date');await p.fill('#evDate','2026-11-10');await p.fill('#evStart','19:00');await p.fill('#evEndT','07:00');
await p.click('[data-act=ev-who][data-n="Alex"]');await p.click('[data-act=ev-who][data-n=Sam]');
await p.click('form[data-form=event] button[type=submit]');await p.waitForTimeout(200);
// weekday daytime both busy -> covered by kindergarten
await p.click('[data-act=ev-new]');await p.fill('#evTitle','Work thing');await p.fill('#evDate','2026-11-11');await p.fill('#evStart','10:00');await p.fill('#evEndT','12:00');
await p.click('[data-act=ev-who][data-n="Alex"]');await p.click('[data-act=ev-who][data-n=Sam]');
await p.click('form[data-form=event] button[type=submit]');await p.waitForTimeout(200);
await p.click('.wk-head[data-k="2026-11-08"]');await p.waitForTimeout(80);
console.log(await p.textContent('.sitcard'));
await p.screenshot({path:__dirname+'/shots/s21.png',fullPage:true});
await p.click('.sitcard [data-act=sit-gp] >> nth=0');await p.waitForTimeout(80);
console.log('gp form:', await p.textContent('.gp-sum'));
await p.click('form[data-form=gp] button[type=submit]');await p.waitForTimeout(200);
console.log('cards left:', await p.$$('.sitcard').then(x=>x.length));
await p.goto('file://'+require('path').resolve(__dirname,'../index.html')+'#family');
console.log('no “someone else babysits” button:', !(await p.$('[data-act=sit-other]')));
console.log(errs.length?errs.join('\n'):'NO PAGE ERRORS');await b.close()})();

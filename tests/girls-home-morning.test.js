const { chromium } = require('playwright');
const T=process.argv[2]||'2026-11-03T08:10:00', tag=process.argv[3]||'m';
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:390,height:844}});
const errs=[];p.on('pageerror',e=>errs.push(e.message+' '+(e.stack||'').split('\n')[1]));
await p.addInitScript(`window.__SEED=${require('fs').readFileSync(__dirname+'/seed.json','utf8')};`);await p.addInitScript(require('fs').readFileSync(__dirname+'/fakedb.js','utf8'));await p.addInitScript(()=>{localStorage.setItem('afloat.me','Alex')});
await p.clock.install({time:new Date(T)});
await p.goto('file://'+require('path').resolve(__dirname,'../index.html')+'#today');await p.waitForTimeout(1200);
await p.screenshot({path:__dirname+'/shots/'+`g-${tag}1.png`,fullPage:true});
if(await p.$('.brief-ov [data-act=gh-yes]')){await p.click('.brief-ov [data-act=gh-yes]');await p.waitForTimeout(150);}
// set me: home with the girls
await p.waitForTimeout(100);if(await p.$('.brief-ov [data-act=situ-me][data-v=home]')){await p.click('.brief-ov [data-act=situ-me][data-v=home]');await p.waitForTimeout(150);}
await p.screenshot({path:__dirname+'/shots/'+`g-${tag}2.png`,fullPage:true});
if(await p.$('[data-act=brief-close]'))await p.click('[data-act=brief-close]');
await p.waitForTimeout(150);
await p.screenshot({path:__dirname+'/shots/'+`g-${tag}3.png`,fullPage:true});
console.log('gaps:', await p.evaluate(()=>document.querySelector('.sitbanner, .sitcard') ? 'has':'none'));
console.log(errs.length?errs.join('\n'):'NO PAGE ERRORS');await b.close()})();

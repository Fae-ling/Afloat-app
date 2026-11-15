// A study plan from a photo, and Plans' links to the rest of Afloat (11 Nov 2026): the syllabus is read into exams and hand-ins,
// each offered for the calendar with reminders picked by kind, and one plan with the topics spread; a step can start a focus
// session (landing ticks it); a thing to take can go on the shopping list; the forecast for trip days; a trip counts as away.
const { start, ok, done } = require('./helpers');
const ANS = { kind: 'study_plan', summary: 'Winter exams', plan_title: 'Winter exams 2027', events: [], todos: [], bring: [], reminders: [],
  deadlines: [
    { title: 'Anatomy exam', course: 'Anatomy', date: '2026-12-10', time: '09:00', type: 'exam', place: 'Room 2.14', topics: ['Bones', 'Muscles', 'Heart', 'Lungs'] },
    { title: 'Essay: ethics', course: 'Ethics', date: '2026-11-30', time: null, type: 'assignment', place: '', topics: [] },
    { title: 'Old exam', course: 'X', date: '2026-01-01', type: 'exam' }] };
(async () => {
  const t = await start();
  let p = await t.open({ hash: 'plans', T: '2026-11-10T10:00:00', init: new Function(`window.__SAMPLE = () => (${JSON.stringify(ANS)});`) });
  // 1. Plans → an exam or deadline offers a photo of the study plan
  await t.tap(p, 'button[data-act=px-kind][data-v=deadline]');
  ok(await t.tap(p, 'button[data-act=px-photo]'), '1 an exam plan can start from a photo of the study plan');
  await p.fill('#nbText', 'Anatomy exam 10. 12. 9:00 room 2.14: bones, muscles, heart, lungs. Ethics essay due 30. 11.');
  await t.tap(p, '#sheet [data-act=nb-read]'); await p.waitForTimeout(500);
  let txt = await t.text(p, '#sheet');
  ok(/A study plan: 2 dates/.test(txt) && /Exam: Anatomy exam/.test(txt) && /Hand in: Essay: ethics/.test(txt) && !/Old exam/.test(txt), '2 it is recognised as a study plan: exams and hand-ins, past dates left out');
  ok(/practice questions from now on/.test(txt) && /tomorrow at 09:00: ID, pens/.test(txt) && /due in 3 days/.test(txt), '3 reminders are picked by kind (a week and the evening before an exam; 3 days and the day before a hand-in)');
  ok(/4 topics spread from today/.test(txt), '4 it offers a plan with the topics spread');
  // untick one reminder
  const remBoxes = await p.$$('#sheet .px-st-rem input');
  await remBoxes[0].click(); await p.waitForTimeout(100);
  await t.tap(p, '#sheet [data-act=px-st-save]'); await p.waitForTimeout(1200);
  const st = await t.st(p);
  const evs = Object.values(st).filter(v => v && v.title && /Anatomy exam|Essay: ethics/.test(v.title) && v.date);
  ok(evs.length === 2 && evs.some(e => e.title === 'Anatomy exam' && e.start === '09:00' && e.end === '11:00' && e.place === 'Room 2.14') && evs.some(e => e.title === 'Essay: ethics' && e.allDay), '5 both go on the calendar (the exam timed, two hours; the hand-in all day): ' + evs.map(e => e.title + ' ' + e.start + '-' + e.end).join(', '));
  const rems = (st['home/reminders'] || {}).list || [];
  const mine = (rems || []).filter(r => r.src === 'photo');
  ok(mine.length === 3 && !mine.some(r => /due in 3 days/.test(r.text)) && mine.some(r => /practice questions/.test(r.text)), '6 the ticked reminders are set, the unticked one (the essay’s 3-day one) isn’t: ' + mine.map(r => r.date + ' ' + r.text).join(' | '));
  const plan = Object.values((st['home/planner'] || {}).plans || {}).find(x => x.title === 'Winter exams 2027');
  ok(plan && plan.kind === 'deadline' && plan.dates.length === 2 && plan.dates.every(d => d.cal), '7 one exam plan with both dates, marked as in the calendar');
  ok(plan && plan.steps.some(s => /Learn: Bones/.test(s.text)) && plan.steps.some(s => /Recall from memory/.test(s.text)) && plan.steps.some(s => /Start: Essay/.test(s.text)) && plan.steps.some(s => /Finish and check: Essay/.test(s.text) && s.due === '2026-11-28'), '8 topics are spread, and the essay gets a start and a finish step');
  ok(/Winter exams 2027/.test(await t.text(p)) && (await p.evaluate(() => location.hash)) === '#plans', '9 it lands in the new plan');
  // 2. focus on a step from Today; landing ticks it
  await t.go(p, 'today'); txt = await t.text(p);
  ok(/Learn: Bones/.test(txt) && !!(await p.$('button[data-act=px-focus]')), '10 today’s study step is on Today with a Focus button');
  await t.tap(p, 'button[data-act=px-focus]'); await p.waitForTimeout(300);
  ok((await p.evaluate(() => location.hash)) === '#focus' && /Learn: Bones/.test(await p.$eval('#fxIntent', x => x.value).catch(() => '')), '11 Focus opens with the step as what this session is for');
  await t.tap(p, 'button[data-act=fx-go]'); await p.waitForTimeout(300);
  await p.evaluate(() => fxLand()); await p.waitForTimeout(300);
  ok(!!(await p.$('#fxPxDone')), '12 landing offers to tick the step in the plan');
  await p.check('#fxPxDone'); await p.waitForTimeout(100);
  const fin = await p.$('button[data-act=fx-done]') ? 'button[data-act=fx-done]' : 'button[data-act=fx-save]';
  await p.evaluate(() => { const b = [...document.querySelectorAll('#app button')].find(x => /save|done|finish|land/i.test(x.dataset.act || '') && x.dataset.act !== 'fx-unland' && x.dataset.act !== 'fx-land'); if (b) b.click(); }); await p.waitForTimeout(400);
  const step = await p.evaluate(() => Object.values(H('planner').plans).find(x => x.title === 'Winter exams 2027').steps.find(s => /Learn: Bones/.test(s.text)));
  ok(step && step.done, '13 finishing the session ticks the step: ' + JSON.stringify(step) + ' via ' + fin);
  await p.close();

  // 3. a trip: weather for its days, a shopping-list button, and the days count as away
  p = await t.open({ hash: 'plans', T: '2026-11-10T10:00:00', init: () => {
    const h = []; const t0 = Date.parse('2026-11-10T00:00:00Z'); const time = [], T = [], A = [], P = [], R = [], C = [], W = [];
    for (let i = 0; i < 24 * 7; i++) { const d = new Date(t0 + i * 3600e3); time.push(d.toISOString().slice(0, 13) + ':00'); T.push(4); A.push(1); P.push(70); R.push(1); C.push(61); W.push(10); }
    window.fetch = async u => ({ json: async () => /geocoding/.test(u) ? { results: [{ latitude: 50.7, longitude: 15.6, name: 'Pec pod Sněžkou' }] } : { hourly: { time, temperature_2m: T, apparent_temperature: A, precipitation_probability: P, precipitation: R, weather_code: C, wind_speed_10m: W } } });
  } });
  await p.evaluate(() => { const q = pxCreate({ title: 'Krkonoše', kind: 'trip', start: '2026-11-12', end: '2026-11-14', place: 'Pec pod Sněžkou', who: ['Alex', 'Mia'] }); pxSave(q.id, { pack: [{ id: 'k1', text: 'Snow boots' }] }); }); await p.waitForTimeout(800);
  await p.evaluate(() => render(true)); await p.waitForTimeout(300);
  txt = await t.text(p);
  ok(/Pec pod Sněžkou: .*°C/.test(txt) && !!(await p.$('button[data-act=px-wx-add]')), '14 the trip’s days show the forecast there, with what it calls for one tap away');
  await t.tap(p, 'button[data-act=px-wx-add]'); await p.waitForTimeout(200);
  const pk = await p.evaluate(() => Object.values(H('planner').plans).find(x => x.title === 'Krkonoše').pack.map(x => x.text));
  ok(pk.length === 2 && /Raincoat/.test(pk[1]), '15 tapping it adds it to What to take: ' + pk.join(', '));
  ok(!!(await p.$('button[data-act=px-shop]')), '16 a thing to take not packed yet can go onto the shopping list (🛒)');
  const away = await p.evaluate(() => [awayDay('Alex', '2026-11-13'), awayDay('Sam', '2026-11-13'), awayDay('Alex', '2026-11-16')]);
  ok(away.join() === 'true,false,false', '17 the trip’s days count as away for the people going, not for anyone else: ' + away.join());
  await p.close();
  await done(t);
})();

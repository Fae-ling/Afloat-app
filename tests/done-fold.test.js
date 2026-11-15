// A list with everything ticked folds to one quiet line; unfinished or empty lists stay as they are. Run: node tests/done-fold.test.js
const { start, ok, done } = require('./helpers');
(async () => {
  const t = await start(), p = await t.open();
  const r = await p.evaluate(() => {
    S.ui.dfo = {};
    const open = doneFold('x', 'Before you leave', 2, 3, '<p>card</p>'), full = doneFold('x', 'Before you leave', 3, 3, '<p>card</p>'), none = doneFold('x', 'T', 0, 0, '<p>card</p>');
    S.ui.dfo = { x: true }; const reopened = doneFold('x', 'Before you leave', 3, 3, '<p>card</p>');
    return { open, full, none, reopened };
  });
  ok(r.open === '<p>card</p>', 'an unfinished list is shown as it is');
  ok(r.none === '<p>card</p>', 'an empty list is shown as it is');
  ok(/<details class="done-fold"[^>]*>/.test(r.full) && !/<details[^>]* open/.test(r.full) && /Before you leave/.test(r.full) && /all done/.test(r.full), 'a finished list folds to one line');
  ok(/<details[^>]* open/.test(r.reopened), 'a folded list stays open once you opened it');
  await done(t);
})();

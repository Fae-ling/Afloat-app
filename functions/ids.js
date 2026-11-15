// Afloat stores Trello ids the way claude.ai's Trello connector writes them (ARIs), so data
// from the claude.ai version keeps working. These helpers convert between ARIs and Trello's own ids.
const PFX = 'ari:cloud:trello::';
const raw = v => String(v || '').split('/').pop();
const ws = w => w || 'personal';
const ari = {
  board: (w, id) => `${PFX}board/workspace/${ws(w)}/${id}`,
  list: (w, id) => `${PFX}list/workspace/${ws(w)}/${id}`,
  card: (w, id) => `${PFX}card/workspace/${ws(w)}/${id}`,
  label: (w, id) => `${PFX}label/workspace/${ws(w)}/${id}`,
  checklist: (w, id) => `${PFX}checklist/workspace/${ws(w)}/${id}`,
  item: (w, id) => `${PFX}check-item/workspace/${ws(w)}/${id}`,
  workspace: w => `${PFX}workspace/${ws(w)}`,
  user: id => `${PFX}user/${id}`,
};
module.exports = { raw, ari };

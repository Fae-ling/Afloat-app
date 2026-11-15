/* Afloat opens even with a weak signal: pages and scripts come from the network when they can,
   from the last copy when they can't. Household data has its own offline copy (Firestore). */
const CACHE = 'afloat-v21';
const SHELL = ['./', './index.html', './meals/index.html', './platform/config.js', './platform/claude.js', './platform/food.js', './platform/swipe.js', './platform/todo.js', './manifest.webmanifest', './icons/icon-192.png',
  './meals/meals.css', './meals/js/data.js', './meals/js/family.js', './meals/js/ai.js', './meals/js/nutrition.js', './meals/js/render.js', './meals/js/at-home.js', './meals/js/cook.js', './meals/js/sheets.js', './meals/js/actions.js', './meals/js/boot.js',
  './app/afloat.css', './app/core.js', './app/trello.js', './app/tasks.js', './app/capture.js', './app/store.js', './app/render.js', './app/briefing.js', './app/going-out.js', './app/reminders.js', './app/calm.js', './app/today.js', './app/news.js', './app/notes-usage.js', './app/situation.js', './app/sick-day.js', './app/self-care.js', './app/our-days.js', './app/together.js', './app/job.js', './app/checkup.js', './app/date-ideas.js', './app/trips.js', './app/family.js', './app/links.js', './app/plan-tomorrow.js', './app/event-plans.js', './app/plans.js', './app/plans-together.js', './app/plans-travel.js', './app/plans-more.js', './app/colours.js', './app/calendar-sync.js', './app/recurring.js', './app/event-form.js', './app/calendar-ui.js', './app/support.js', './app/rhythms.js', './app/beat.js', './app/settings.js', './app/welcome.js', './app/focus.js', './app/surroundings.js', './app/events.js', './app/boot.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/__/')) return;
  e.respondWith(fetch(r).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); } return res; })
    .catch(() => caches.match(r, { ignoreSearch: true }).then(m => m || caches.match('./index.html'))));
});
/* notifications from Afloat's server (Firebase Cloud Messaging, data messages): show them, and open Afloat on tap */
self.addEventListener('push', e => {
  let d = {}; try { const j = e.data ? e.data.json() : {}; d = j.data || j || {}; } catch {}
  if (!d.title) return;
  e.waitUntil(self.registration.showNotification(d.title, { body: d.body || '', tag: d.tag || undefined, icon: './icons/icon-192.png', badge: './icons/icon-192.png', data: { link: d.link || './#today' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close(); const link = new URL((e.notification.data || {}).link || './#today', self.registration.scope).href;
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => { const w = ws.find(x => x.url.startsWith(self.registration.scope)); if (w) { w.navigate(link); return w.focus(); } return clients.openWindow(link); }));
});

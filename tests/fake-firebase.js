// A pretend Firebase compat SDK (app, auth, firestore, functions, storage) for testing platform/claude.js.
// State lives on the top window so the Meals frame shares it. window.top.__FN[name](data, user) answers callables.
(() => {
  if (window.firebase) return;
  const T = window.top, R = T.__FAKEFB || (T.__FAKEFB = { st: {}, L: [], user: JSON.parse(T.localStorage.getItem('__fbuser') || 'null'), authL: [], calls: [] });
  const logCall = c => { R.calls.push(c); const all = JSON.parse(T.localStorage.getItem('__fbcalls') || '[]'); all.push(c); T.localStorage.setItem('__fbcalls', JSON.stringify(all)); };
  if (!R.seeded && T.__FBSEED) { Object.assign(R.st, JSON.parse(JSON.stringify(T.__FBSEED))); R.seeded = true; }
  const fire = () => setTimeout(() => R.L.slice().forEach(f => f()), 0);
  const merge = (a, b) => { const o = { ...a }; for (const k in b) o[k] = b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object' ? merge(a[k], b[k]) : b[k]; return o; };
  const snap = p => ({ id: p.split('/').pop(), exists: p in R.st, data: () => R.st[p] ? JSON.parse(JSON.stringify(R.st[p])) : undefined, metadata: { fromCache: false } });
  const docRef = p => ({ id: p.split('/').pop(), path: p,
    update: async (...a) => { if (!(p in R.st)) throw { code: 'not-found', message: 'No document to update: ' + p }; const o = R.st[p];
      for (let i = 0; i < a.length; i += 2) { const s = a[i].segs, v = a[i + 1]; let x = o; for (let j = 0; j < s.length - 1; j++) { if (!x[s[j]] || typeof x[s[j]] !== 'object') x[s[j]] = {}; x = x[s[j]]; }
        if (v && v.__del) delete x[s[s.length - 1]]; else x[s[s.length - 1]] = JSON.parse(JSON.stringify(v)); } fire(); },
    get: async () => snap(p), set: async (d, o) => { R.st[p] = o && o.merge ? merge(R.st[p] || {}, d) : JSON.parse(JSON.stringify(d)); fire(); }, delete: async () => { delete R.st[p]; fire(); },
    onSnapshot: (a, b) => { const cb = typeof a === 'function' ? a : b; const f = () => cb(snap(p)); R.L.push(f); setTimeout(f, 0); return () => { const i = R.L.indexOf(f); if (i >= 0) R.L.splice(i, 1); }; } });
  const coll = (c, w) => ({ doc: id => docRef(c + '/' + (id || Math.random().toString(36).slice(2))), where: (a, o, v) => coll(c, [a, o, v]), orderBy: () => coll(c, w), limit: () => coll(c, w),
    add: async d => { R.st[c + '/' + Math.random().toString(36).slice(2)] = d; fire(); },
    get: async () => ({ docs: docs(c, w) }),
    onSnapshot: (a, b) => { const cb = typeof a === 'function' ? a : b; const f = () => cb({ docs: docs(c, w), metadata: { fromCache: false } }); R.L.push(f); setTimeout(f, 0); return () => {}; } });
  const docs = (c, w) => Object.keys(R.st).filter(k => k.startsWith(c + '/') && k.split('/').length === c.split('/').length + 1).filter(k => !w || (w[1] === '>' ? (R.st[k][w[0]] || '') > w[2] : (R.st[k][w[0]] || '') >= w[2])).map(snap);
  const auth = { get currentUser() { return R.user; },
    onAuthStateChanged: cb => { R.authL.push(cb); setTimeout(() => cb(R.user), 0); return () => { R.authL = R.authL.filter(x => x !== cb); }; },
    getRedirectResult: async () => null,
    signInWithPopup: async () => { if (T.__SIGNIN_BLOCK) throw { code: 'auth/internal-error', message: 'Firebase: HTTP Cloud Function returned an error: {"error":{"code":403,"message":"This Afloat is private: only its households can sign in.","status":"PERMISSION_DENIED"}} (auth/internal-error).' }; R.user = T.__SIGNIN_AS || { uid: 'u1', email: 'owner@example.com' }; T.localStorage.setItem('__fbuser', JSON.stringify(R.user)); R.authL.slice().forEach(f => f(R.user)); return { user: R.user }; },
    signInWithRedirect: async () => {}, signOut: async () => { R.user = null; T.localStorage.removeItem('__fbuser'); } };
  const app = { firestore: () => ({ enablePersistence: async () => {}, doc: docRef, collection: c => coll(c), batch: () => { const ops = []; return { set: (r, d, o) => ops.push([r, d, o]), commit: async () => { for (const [r, d, o] of ops) await r.set(d, o); } }; } }), auth: () => auth,
    functions: () => ({ httpsCallable: name => async data => { logCall([name, JSON.parse(JSON.stringify(data || {}))]); const h = (T.__FN || {})[name]; if (!h) throw { code: 'functions/not-found', message: 'no ' + name }; return { data: await h(data || {}, R.user) }; } }),
    storage: () => ({ ref: p => ({ put: async (b) => { R.st['storage/' + p] = { size: b.size }; }, delete: async () => { delete R.st['storage/' + p]; } }) }) };
  window.firebase = { initializeApp: () => app, firestore: { FieldPath: class { constructor(...s) { this.segs = s; } }, FieldValue: { delete: () => ({ __del: 1 }) } }, auth: Object.assign(() => auth, { GoogleAuthProvider: class { setCustomParameters() {} } }) };
})();
window.__CALM_OFF = !window.__CALM;

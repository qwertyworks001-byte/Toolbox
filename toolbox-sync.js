// Toolbox shared sync: keeps your favourites and recently-used tools the same on every device you're signed in on.
// Load it (after firebase-config.js) on any page. It needs no changes to the pages themselves: it watches the
// browser storage those pages already use, so a star toggled on any tool page is picked up too.
(function () {
  const FAV = 'toolbox:favorites', REC = 'toolbox:recent', META = 'toolbox:sync-meta';
  const me = document.currentScript;
  const base = me && me.src ? me.src.replace(/[^/]*$/, '') : '';

  // <<TS-PURE-START>>
  // meta = { fav: { toolId: { on: bool, t: timestamp } }, rec: { ids: [...], t: timestamp } }
  // Favourites are tracked one tool at a time (newest change per tool wins) so two devices can both add favourites
  // without erasing each other. Recents are one short list, so the newest whole list wins.
  const emptyMeta = () => ({ fav: {}, rec: { ids: [], t: 0 } });
  function cleanMeta(m) {
    const out = emptyMeta();
    if (!m || typeof m !== 'object') return out;
    Object.keys(m.fav || {}).forEach(id => { const e = m.fav[id]; if (e && typeof e === 'object') out.fav[id] = { on: !!e.on, t: Number(e.t) || 0 }; });
    if (m.rec && Array.isArray(m.rec.ids)) out.rec = { ids: m.rec.ids.filter(x => typeof x === 'string').slice(0, 12), t: Number(m.rec.t) || 0 };
    return out;
  }
  // Record what the page currently has in storage (new stars / un-stars / a changed recents list) with the time we noticed it.
  function stamp(meta, favList, recList, now) {
    let changed = false;
    const have = new Set(favList);
    have.forEach(id => { const e = meta.fav[id]; if (!e || !e.on) { meta.fav[id] = { on: true, t: now }; changed = true; } });
    Object.keys(meta.fav).forEach(id => { if (meta.fav[id].on && !have.has(id)) { meta.fav[id] = { on: false, t: now }; changed = true; } });
    if (JSON.stringify(recList) !== JSON.stringify(meta.rec.ids)) { meta.rec = { ids: recList.slice(), t: now }; changed = true; }
    return changed;
  }
  function mergeMeta(a, b) {
    const out = emptyMeta(); let changedLocal = false, changedRemote = false;
    new Set(Object.keys(a.fav).concat(Object.keys(b.fav))).forEach(id => {
      const x = a.fav[id], y = b.fav[id];
      if (x && !y) { out.fav[id] = x; changedRemote = true; } else if (y && !x) { out.fav[id] = y; changedLocal = true; }
      else if (x.t >= y.t) { out.fav[id] = x; if (x.t > y.t) changedRemote = true; } else { out.fav[id] = y; changedLocal = true; }
    });
    if (a.rec.t >= b.rec.t) { out.rec = a.rec; if (a.rec.t > b.rec.t) changedRemote = true; } else { out.rec = b.rec; changedLocal = true; }
    return { meta: out, changedLocal, changedRemote };
  }
  function listsFrom(meta) {
    const fav = Object.keys(meta.fav).filter(id => meta.fav[id].on).sort((p, q) => meta.fav[p].t - meta.fav[q].t || (p < q ? -1 : 1));
    return { fav, rec: meta.rec.ids.slice(0, 6) };
  }
  // <<TS-PURE-END>>

  const origSet = Storage.prototype.setItem;
  const rawSet = (k, v) => origSet.call(localStorage, k, v);
  const readJSON = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const readList = (k) => { const v = readJSON(k); return Array.isArray(v) ? v.filter(x => typeof x === 'string') : []; };
  let meta = cleanMeta(readJSON(META));
  const saveMeta = () => { try { rawSet(META, JSON.stringify(meta)); } catch (e) {} };

  // Make storage match the merged meta, and tell the page so it can redraw.
  function apply() {
    const want = listsFrom(meta), curFav = readList(FAV), curRec = readList(REC);
    const sameFav = JSON.stringify(curFav.slice().sort()) === JSON.stringify(want.fav.slice().sort());
    const sameRec = JSON.stringify(curRec) === JSON.stringify(want.rec);
    if (sameFav && sameRec) return;
    try { rawSet(FAV, JSON.stringify(want.fav)); rawSet(REC, JSON.stringify(want.rec)); } catch (e) {}
    window.dispatchEvent(new CustomEvent('toolbox:synced'));
  }
  // Notice changes the pages make to storage (a star, a "recently used" entry), on this page or any other that loads this file.
  Storage.prototype.setItem = function (k, v) { origSet.call(this, k, v); if (this === localStorage && (k === FAV || k === REC)) onLocal(); };
  let localTimer = null;
  function onLocal() { clearTimeout(localTimer); localTimer = setTimeout(() => { if (stamp(meta, readList(FAV), readList(REC), Date.now())) { saveMeta(); schedulePush(); } }, 50); }
  if (stamp(meta, readList(FAV), readList(REC), Date.now())) saveMeta();   // catches stars toggled on pages that don't load this file

  // ── cloud ──
  const cfg = window.TOOLBOX_FIREBASE, configured = !!(cfg && cfg.apiKey && cfg.projectId);
  let status = configured ? 'signedout' : 'unconfigured', user = null, db = null, unsub = null, pushTimer = null, watch = null, busy = false, badgeEl = null;
  const WATCH_MS = window.__syncTimeoutMs || 12000;
  const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const load = (src) => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
  const ref = () => db.doc('users/' + user.uid + '/toolbox/prefs');
  const SIGNIN = base + 'HabitTracker/habit-tracker.html#sync';

  function setStatus(s) { status = s; drawBadge(); }
  function drawBadge() {
    if (!configured) return;
    if (!badgeEl) {
      badgeEl = document.createElement('a'); badgeEl.id = 'toolbox-sync-badge';
      badgeEl.style.cssText = 'position:fixed;top:0.6rem;right:0.6rem;z-index:9999;font:500 0.72rem ui-sans-serif,system-ui,sans-serif;padding:0.3rem 0.7rem;border-radius:999px;text-decoration:none;background:rgba(15,23,42,0.92);border:1px solid #475569;color:#cbd5e1;';
      document.body.appendChild(badgeEl);
    }
    const t = { signedout: ['\u2601 Sign in to sync', '#f59e0b'], syncing: ['\u2601 Syncing\u2026', '#475569'], synced: ['\u2601 Synced', '#10b981'], error: ['\u2601 Sync problem', '#f59e0b'] }[status];
    badgeEl.textContent = t[0]; badgeEl.style.borderColor = t[1]; badgeEl.href = SIGNIN;
    badgeEl.title = status === 'synced' ? 'Favourites and recents are synced across your devices' : 'Open the sign-in / sync window';
  }

  async function init() {
    if (!configured || window.__noFirebase) return;
    document.addEventListener('DOMContentLoaded', drawBadge); if (document.body) drawBadge();
    try {
      if (!window.firebase) { await load(SDK + 'firebase-app-compat.js'); await load(SDK + 'firebase-auth-compat.js'); await load(SDK + 'firebase-firestore-compat.js'); }
      if (!(firebase.apps && firebase.apps.length)) firebase.initializeApp(cfg);
      db = firebase.firestore();
      firebase.auth().onAuthStateChanged((u) => { user = u; clearTimeout(watch); if (unsub) { unsub(); unsub = null; } if (u) { setStatus('syncing'); listen(); } else setStatus('signedout'); });
    } catch (e) { setStatus('error'); }
  }
  function listen() {
    clearTimeout(watch); watch = setTimeout(() => { if (status === 'syncing') setStatus('error'); }, WATCH_MS);
    unsub = ref().onSnapshot((snap) => {
      clearTimeout(watch); let needPush = true;
      if (snap.exists) { try { const m = mergeMeta(meta, cleanMeta(JSON.parse(snap.data().json))); meta = m.meta; saveMeta(); apply(); needPush = m.changedRemote; } catch (e) {} }
      if (needPush) push(); else setStatus('synced');
    }, () => { clearTimeout(watch); setStatus('error'); });
  }
  async function push() {
    if (!user || busy) return; busy = true; setStatus('syncing');
    try {
      const merged = await Promise.race([db.runTransaction(async (tx) => {
        const s = await tx.get(ref()); const remote = s.exists ? cleanMeta(JSON.parse(s.data().json)) : null;
        const m = remote ? mergeMeta(meta, remote).meta : meta;
        tx.set(ref(), { json: JSON.stringify(m), updated: firebase.firestore.FieldValue.serverTimestamp() }); return m;
      }), new Promise((_, no) => setTimeout(() => no(new Error('timeout')), WATCH_MS))]);
      meta = merged; saveMeta(); apply(); busy = false; setStatus('synced');
    } catch (e) { busy = false; setStatus('error'); }
  }
  function schedulePush() { if (!user) return; clearTimeout(pushTimer); pushTimer = setTimeout(push, 600); }
  window.addEventListener('online', () => { if (user) push(); });
  init();
})();
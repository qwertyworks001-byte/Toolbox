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
  // without erasing each other. Recents are one short list, so the newest whole list wins. The favourites ORDER (what you
  // drag them into) is also one list, newest whole list wins; favourites not in it yet go on the end, oldest first.
  const emptyMeta = () => ({ fav: {}, rec: { ids: [], t: 0 }, ord: { ids: [], t: 0 } });
  function cleanMeta(m) {
    const out = emptyMeta();
    if (!m || typeof m !== 'object') return out;
    Object.keys(m.fav || {}).forEach(id => { const e = m.fav[id]; if (e && typeof e === 'object') out.fav[id] = { on: !!e.on, t: Number(e.t) || 0 }; });
    if (m.rec && Array.isArray(m.rec.ids)) out.rec = { ids: m.rec.ids.filter(x => typeof x === 'string').slice(0, 12), t: Number(m.rec.t) || 0 };
    if (m.ord && Array.isArray(m.ord.ids)) out.ord = { ids: m.ord.ids.filter(x => typeof x === 'string').slice(0, 200), t: Number(m.ord.t) || 0 };
    return out;
  }
  function orderedFav(meta) {
    const pos = {}; meta.ord.ids.forEach((id, i) => { if (!(id in pos)) pos[id] = i; });
    return Object.keys(meta.fav).filter(id => meta.fav[id].on).sort((p, q) => {
      const a = p in pos, b = q in pos;
      if (a && b) return pos[p] - pos[q];
      if (a !== b) return a ? -1 : 1;
      return meta.fav[p].t - meta.fav[q].t || (p < q ? -1 : 1);
    });
  }
  // Record what the page currently has in storage (new stars / un-stars / a changed recents list) with the time we noticed it.
  function stamp(meta, favList, recList, now) {
    let changed = false;
    const have = new Set(favList);
    have.forEach(id => { const e = meta.fav[id]; if (!e || !e.on) { meta.fav[id] = { on: true, t: now }; changed = true; } });
    Object.keys(meta.fav).forEach(id => { if (meta.fav[id].on && !have.has(id)) { meta.fav[id] = { on: false, t: now }; changed = true; } });
    if (JSON.stringify(recList) !== JSON.stringify(meta.rec.ids)) { meta.rec = { ids: recList.slice(), t: now }; changed = true; }
    if (JSON.stringify(favList) !== JSON.stringify(orderedFav(meta))) { meta.ord = { ids: favList.slice(), t: now }; changed = true; }   // the page reordered them
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
    if (a.ord.t >= b.ord.t) { out.ord = a.ord; if (a.ord.t > b.ord.t) changedRemote = true; } else { out.ord = b.ord; changedLocal = true; }
    return { meta: out, changedLocal, changedRemote };
  }
  function listsFrom(meta) {
    const fav = orderedFav(meta);
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
    const sameFav = JSON.stringify(curFav) === JSON.stringify(want.fav);
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
      badgeEl.addEventListener('click', (e) => { e.preventDefault(); openAuth(); });
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
      if (!window.firebase) { await load(SDK + 'firebase-app-compat.js'); await load(SDK + 'firebase-app-check-compat.js').catch(() => {}); await load(SDK + 'firebase-auth-compat.js'); await load(SDK + 'firebase-firestore-compat.js'); }
      if (!(firebase.apps && firebase.apps.length)) firebase.initializeApp(cfg);
      if (window.toolboxActivateAppCheck) window.toolboxActivateAppCheck();
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

  // ── in-page sign-in window (so nobody gets sent to another page to sign in) ──
  // Views: signed out (Google / email, with "Forgot password?"), email account not yet verified, signed in.
  // Posting and reacting in the Recommendation Tool needs a verified email (Google accounts always are).
  function openAuth() {
    if (!window.firebase || !firebase.apps || !firebase.apps.length) { location.href = SIGNIN; return; }
    if (document.getElementById('toolbox-auth')) return;
    const auth = firebase.auth();
    const needsVerify = (u) => !!u && !u.emailVerified && (u.providerData || []).some(p => p.providerId === 'password');
    const ov = document.createElement('div'); ov.id = 'toolbox-auth';
    ov.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;padding:1rem;font-family:ui-sans-serif,system-ui,sans-serif;font-size:0.9rem;color:#e2e8f0;';
    const inp = 'width:100%;box-sizing:border-box;padding:0.55rem 0.7rem;margin-top:0.5rem;border-radius:8px;border:1px solid #475569;background:#0f131a;color:#f1f5f9;font-size:0.9rem;';
    const btn = (bg, fg) => 'width:100%;padding:0.55rem;margin-top:0.6rem;border-radius:8px;border:0;cursor:pointer;font-weight:600;font-size:0.9rem;background:' + bg + ';color:' + fg + ';';
    const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const close = () => ov.remove();
    const notify = () => window.dispatchEvent(new CustomEvent('toolbox:auth'));
    const errText = (e) => {
      const c = (e && e.code) || '';
      return (c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request') ? ''
        : (c === 'auth/wrong-password' || c === 'auth/invalid-credential' || c === 'auth/user-not-found') ? 'Wrong email or password.'
        : c === 'auth/email-already-in-use' ? 'That email already has an account, so use Sign in.'
        : c === 'auth/weak-password' ? 'Password needs at least 6 characters.'
        : c === 'auth/invalid-email' ? 'That email address doesn\u2019t look right.'
        : c === 'auth/too-many-requests' ? 'Too many attempts. Please wait a few minutes and try again.'
        : c === 'auth/operation-not-allowed' ? 'That sign-in method isn\u2019t turned on in Firebase yet.'
        : c === 'auth/unauthorized-domain' ? 'This site\u2019s address isn\u2019t in Firebase\u2019s Authorized domains.'
        : 'Something went wrong (' + (c || 'unknown') + ').';
    };
    const sendVerify = (u) => u.sendEmailVerification({ url: location.href.split('#')[0] }).catch(() => u.sendEmailVerification());

    function view(note, ok) {
      const u = auth.currentUser, verifying = needsVerify(u);
      let h = '<div style="width:100%;max-width:340px;background:#14171c;border:1px solid #334155;border-radius:14px;padding:1.2rem;">' +
        '<div style="font-weight:700;font-size:1.05rem;margin-bottom:0.2rem;">\u2601 ' + (verifying ? 'Verify your email' : u ? 'Signed in' : 'Sign in to Toolbox') + '</div>';
      if (verifying) {
        h += '<div style="color:#94a3b8;margin-bottom:0.4rem;">We sent a link to <b style="color:#e2e8f0;">' + esc(u.email) + '</b>. Open it, then come back and press the button. You need a verified email to post and react in the Recommendation Tool.</div>' +
          '<button id="tba-done" style="' + btn('#3b82f6', '#fff') + '">I\u2019ve verified it</button>' +
          '<button id="tba-resend" style="' + btn('#334155', '#f1f5f9') + '">Resend the email</button>' +
          '<button id="tba-out" style="' + btn('transparent', '#94a3b8') + '">Sign out</button>';
      } else if (u) {
        h += '<div style="color:#94a3b8;margin-bottom:0.4rem;">' + esc(u.email || u.displayName || 'your account') + '</div><button id="tba-out" style="' + btn('#334155', '#f1f5f9') + '">Sign out</button>';
      } else {
        h += '<div style="color:#94a3b8;margin-bottom:0.6rem;">Syncs your favourites and lets you post and react in the Recommendation Tool.</div>' +
          '<button id="tba-g" style="' + btn('#f8fafc', '#0f172a') + '">Continue with Google</button>' +
          '<div style="text-align:center;color:#64748b;margin:0.7rem 0 0.1rem;">or use email</div>' +
          '<input id="tba-e" type="email" placeholder="Email" autocomplete="email" style="' + inp + '">' +
          '<input id="tba-p" type="password" placeholder="Password" autocomplete="current-password" style="' + inp + '">' +
          '<div style="display:flex;gap:0.5rem;"><button id="tba-in" style="' + btn('#3b82f6', '#fff') + '">Sign in</button><button id="tba-up" style="' + btn('#334155', '#f1f5f9') + '">Create account</button></div>' +
          '<div style="text-align:right;margin-top:0.5rem;"><a href="#" id="tba-forgot" style="color:#93c5fd;font-size:0.8rem;">Forgot password?</a></div>';
      }
      h += '<div id="tba-m" style="color:' + (ok ? '#34d399' : '#fb7185') + ';min-height:1.1rem;margin-top:0.5rem;font-size:0.8rem;">' + esc(note || '') + '</div>' +
        '<button id="tba-x" style="' + btn('transparent', '#94a3b8') + 'margin-top:0.2rem;">Close</button></div>';
      ov.innerHTML = h;
      wire(u, verifying);
    }
    function wire(u, verifying) {
      const $ = (id) => ov.querySelector('#' + id);
      const say = (t, ok) => { const m = $('tba-m'); m.textContent = t; m.style.color = ok ? '#34d399' : '#fb7185'; };
      const fail = (e) => say(errText(e));
      const after = () => { const c = auth.currentUser; if (needsVerify(c)) view(); else close(); };
      $('tba-x').onclick = close;
      if (u) {
        $('tba-out').onclick = () => auth.signOut().then(() => { notify(); close(); }, fail);
        if (verifying) {
          $('tba-done').onclick = () => {
            say('Checking\u2026', true);
            u.reload().then(() => u.getIdToken(true)).then(() => {
              if (u.emailVerified) { notify(); close(); } else say('Not verified yet. Open the link in the email first, then try again.');
            }, fail);
          };
          $('tba-resend').onclick = () => sendVerify(u).then(() => say('Sent again. Check your inbox and spam folder.', true), fail);
        }
        return;
      }
      const creds = () => [$('tba-e').value.trim(), $('tba-p').value];
      $('tba-g').onclick = () => { say(''); auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).then(close, (e) => { if (e && e.code === 'auth/popup-blocked') auth.signInWithRedirect(new firebase.auth.GoogleAuthProvider()); else fail(e); }); };
      $('tba-in').onclick = () => { say(''); const c = creds(); auth.signInWithEmailAndPassword(c[0], c[1]).then(after, fail); };
      $('tba-up').onclick = () => {
        say(''); const c = creds();
        auth.createUserWithEmailAndPassword(c[0], c[1]).then((cred) => sendVerify(cred.user).catch(() => {}).then(() => { notify(); view('Account created. We emailed you a verification link.', true); }), fail);
      };
      $('tba-forgot').onclick = (e) => {
        e.preventDefault(); const em = $('tba-e').value.trim();
        if (!em) { say('Type your email above first, then press Forgot password.'); return; }
        auth.sendPasswordResetEmail(em).then(() => say('If that email has an account, a reset link is on its way. Check your spam folder too.', true), fail);
      };
      $('tba-p').onkeydown = (e) => { if (e.key === 'Enter') $('tba-in').click(); };
    }
    ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
    document.body.appendChild(ov);
    view();
  }
  window.ToolboxAuth = { open: openAuth };

  window.addEventListener('online', () => { if (user) push(); });
  init();
})();
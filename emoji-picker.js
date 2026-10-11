// Toolbox emoji picker: one reusable component used by the Emoji Picker tool and the Habit Tracker.
// Load emoji-data.js first, then this file, then call:
//   const picker = ToolboxEmoji.create({ root: someElement, mode: 'copy' | 'pick', onPick: (emoji, item) => {...}, height: '22rem' });
//   picker.reset()        clear the search and go back to the top (call each time you show it)
//   picker.focusSearch()  put the cursor in the search box
// Also: ToolboxEmoji.copy(text) -> Promise<boolean>.
(function () {
  'use strict';
  const D = window.TOOLBOX_EMOJI;
  if (!D || !D.items) return;

  const RECENT_KEY = 'toolbox:emoji-recent', TONE_KEY = 'toolbox:emoji-tone', HIDE_KEY = 'toolbox:emoji-hide-unsupported';
  const RECENT_MAX = 24;
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const norm = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
  const noVS = (s) => String(s).replace(/️/g, '');          // 👍 and 👍 + variation selector are the same emoji

  // ── data ──
  const ITEMS = D.items.map((r, i) => ({
    i, ch: r[0], name: r[1], g: r[3], skins: r[4] || null,
    nname: norm(r[1]), nwords: norm(r[1]).split(/[^a-z0-9]+/).filter(Boolean), kw: norm(r[2] || '').split(/\s+/).filter(Boolean)
  }));
  const BYCHAR = new Map();
  ITEMS.forEach(it => { BYCHAR.set(noVS(it.ch), it); (it.skins || []).forEach(s => BYCHAR.set(noVS(s), it)); });

  // ── can this device actually draw an emoji? (newer emoji show as empty boxes on older systems) ──
  // Each emoji is drawn on a hidden canvas and compared with the "missing glyph" box. This is slow if done all at once, so it
  // runs in small chunks in the background after the picker is on screen; pickers hear about it through support.listeners.
  // If the test looks unreliable we show everything.
  let support = null;
  const later = (f) => (window.requestIdleCallback ? window.requestIdleCallback(f, { timeout: 400 }) : setTimeout(f, 16));
  function initSupport() {
    if (support) return support;
    support = { fn: null, known: () => undefined, done: false, bad: 0, listeners: [] };
    const finish = () => { support.done = true; support.listeners.splice(0).forEach(f => { try { f(); } catch (e) {} }); };
    try {
      const c = document.createElement('canvas'); c.width = c.height = 32;
      const x = c.getContext('2d', { willReadFrequently: true }); if (!x || !x.getImageData) { finish(); return support; }
      x.font = '22px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif'; x.textBaseline = 'top';
      const sig = (s) => {
        x.clearRect(0, 0, 32, 32); x.fillText(s, 1, 1);
        const d = x.getImageData(0, 0, 32, 32).data; let h = 7, n = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i]) { n++; h = (Math.imul(h, 31) + d[i - 3] + (d[i - 2] << 8) + (d[i - 1] << 16)) | 0; }
        return { n, h, w: x.measureText(s).width };
      };
      const ref = sig('\u{10FFFE}'), one = sig('\u{1F600}');
      if (!one.n) { finish(); return support; }
      const test = (s) => {
        const r = sig(s);
        if (!r.n) return false;
        if (ref.n && r.n === ref.n && r.h === ref.h) return false;      // identical to the missing-glyph box
        if (r.w > one.w * 1.7) return false;                              // a sequence that fell apart into several pieces
        return true;
      };
      const cache = new Map();
      support.fn = (s) => { let v = cache.get(s); if (v === undefined) { v = test(s); cache.set(s, v); } return v; };
      support.known = (s) => cache.get(s);
      let i = 0;
      const step = () => {
        const t0 = Date.now();
        while (i < ITEMS.length && Date.now() - t0 < 8) { const ch = ITEMS[i++].ch; if (!cache.has(ch)) cache.set(ch, test(ch)); }
        if (i < ITEMS.length) { later(step); return; }
        let bad = 0; ITEMS.forEach(it => { if (cache.get(it.ch) === false) bad++; });
        if (bad > ITEMS.length * 0.5) { support.fn = null; support.known = () => undefined; bad = 0; }   // looks unreliable: show everything
        support.bad = bad; finish();
      };
      later(step);
    } catch (e) { finish(); }
    return support;
  }
  const canShow = (s) => !support || !support.fn || support.fn(s);          // may draw once (used for skin-tone variants only)
  const knownBad = (s) => !!support && support.known(s) === false;         // cached answer only, never blocks

  // ── search: every word you type must match; exact name word > start of a word > inside; keywords count a bit less ──
  // Words people type that the Unicode names don't contain (there is no dumbbell emoji, for example).
  const ALIASES = { dumbbell: 'lifting weights', dumbbells: 'lifting weights', gym: 'lifting weights', fitness: 'lifting weights', exercise: 'lifting weights', meditate: 'lotus position', meditation: 'lotus position', mindfulness: 'lotus position', yoga: 'lotus position', study: 'books', read: 'book', reading: 'book', journal: 'memo', write: 'memo', writing: 'memo', tidy: 'broom', clean: 'broom', cleaning: 'broom', vitamins: 'pill', vitamin: 'pill', hydrate: 'droplet', drink: 'droplet', stretch: 'lotus position' };
  function search(q) {
    const main = searchRaw(q), alias = ALIASES[norm(q).trim()];
    if (!alias) return main;
    const seen = new Set(main); return main.concat(searchRaw(alias).filter(x => !seen.has(x)));
  }
  function searchRaw(q) {
    const nq = norm(q).trim().replace(/\s+/g, ' '), words = nq.split(' ').filter(Boolean); if (!words.length) return [];
    const pasted = BYCHAR.get(noVS(q.trim()));
    const out = [];
    ITEMS.forEach(it => {
      let total = 0;
      for (const w of words) {
        let s = 0;
        if (it.nwords.includes(w)) s = 10; else if (it.nwords.some(x => x.startsWith(w))) s = 8; else if (it.nname.includes(w)) s = 5;
        for (const k of it.kw) { const v = k === w ? 7 : k.startsWith(w) ? 5 : k.includes(w) ? 3 : 0; if (v > s) s = v; }
        if (!s) { total = 0; break; }
        total += s;
      }
      if (total && it.nname === nq) total += 20;                    // typing a full name ("fire") puts that exact emoji first
      if (total) out.push({ it, total });
    });
    out.sort((a, b) => b.total - a.total || a.it.nwords.length - b.it.nwords.length || a.it.i - b.it.i);   // ties: shorter names first
    const list = out.map(x => x.it);
    return pasted ? [pasted].concat(list.filter(x => x !== pasted)) : list;
  }

  // ── copy to clipboard ──
  function legacyCopy(text) {
    try {
      const t = document.createElement('textarea'); t.value = text; t.setAttribute('readonly', '');
      t.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;';
      document.body.appendChild(t); t.select(); const ok = document.execCommand('copy'); t.remove(); return !!ok;
    } catch (e) { return false; }
  }
  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(() => true, () => legacyCopy(text));
    }
    return Promise.resolve(legacyCopy(text));
  }

  // ── styles (self-contained so the picker looks right on any page) ──
  function ensureCSS() {
    if (document.getElementById('tbxe-css')) return;
    const s = document.createElement('style'); s.id = 'tbxe-css';
    s.textContent = `
.tbxe{display:flex;flex-direction:column;gap:.6rem;min-width:0;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;color:#e2e8f0;text-align:left}
.tbxe *{box-sizing:border-box}
.tbxe-top{display:flex;gap:.5rem}
.tbxe-search{flex:1;min-width:0;width:auto;background:rgba(15,23,42,.8);border:1px solid #334155;border-radius:.6rem;padding:.55rem .75rem;color:#fff;font-size:1rem}
.tbxe-search:focus{outline:none;border-color:#3b82f6}
.tbxe-search::placeholder{color:#64748b}
.tbxe-tone{flex:none;background:rgba(15,23,42,.8);border:1px solid #334155;border-radius:.6rem;padding:.35rem .45rem;color:#e2e8f0;font-size:1.05rem;color-scheme:dark;cursor:pointer;font-family:"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif}
.tbxe-cats{display:flex;gap:.2rem;overflow-x:auto;scrollbar-width:thin;padding-bottom:2px}
.tbxe-cat{flex:none;width:2.3rem;height:2.3rem;border-radius:.6rem;border:1px solid transparent;background:transparent;cursor:pointer;font-size:1.2rem;line-height:1;display:flex;align-items:center;justify-content:center;padding:0;font-family:"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif}
.tbxe-cat:hover{background:rgba(255,255,255,.07)}
.tbxe-cat.on{background:rgba(59,130,246,.18);border-color:#3b82f6}
.tbxe-cat[hidden]{display:none}
.tbxe-scroll{position:relative;overflow-y:auto;height:var(--tbxe-h,22rem);border:1px solid rgba(255,255,255,.08);border-radius:.8rem;background:rgba(0,0,0,.18);scrollbar-width:thin}
.tbxe-scroll [hidden]{display:none}
.tbxe-sec{content-visibility:auto;contain-intrinsic-size:auto 600px}
.tbxe-h{position:sticky;top:0;z-index:1;margin:0;padding:.4rem .7rem;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;background:rgba(11,15,25,.96);font-weight:600}
.tbxe-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(2.6rem,1fr));gap:2px;padding:.25rem .4rem .6rem}
.tbxe-e{aspect-ratio:1;border:0;border-radius:.5rem;background:transparent;cursor:pointer;font-size:1.6rem;line-height:1;padding:0;color:#fff;font-family:"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif;display:flex;align-items:center;justify-content:center}
.tbxe-e:hover{background:rgba(255,255,255,.12)}
.tbxe-e:focus{outline:none}
.tbxe-e:focus-visible{background:rgba(255,255,255,.12);box-shadow:0 0 0 2px #3b82f6 inset}
.tbxe-more{padding:.2rem .6rem 1rem;text-align:center}
.tbxe-morebtn{background:#1e293b;border:1px solid #475569;color:#cbd5e1;border-radius:.6rem;padding:.4rem .9rem;font-size:.85rem;cursor:pointer}
.tbxe-morebtn:hover{border-color:#3b82f6;color:#93c5fd}
.tbxe-empty{padding:2rem 1rem;text-align:center;color:#94a3b8;font-size:.9rem}
.tbxe-foot{min-height:1.5rem;font-size:.82rem;color:#94a3b8;display:flex;justify-content:space-between;gap:.5rem 1rem;flex-wrap:wrap;align-items:center}
.tbxe-name b{font-family:"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif;color:#fff;font-size:1.15rem;font-weight:400;margin-right:.4rem;vertical-align:middle}
.tbxe-hide{display:inline-flex;align-items:center;gap:.4rem;cursor:pointer}
.tbxe-hide[hidden]{display:none}
`;
    document.head.appendChild(s);
  }

  // ── the picker ──
  function create(opts) {
    opts = opts || {};
    const root = opts.root; if (!root) return null;
    const mode = opts.mode === 'pick' ? 'pick' : 'copy', onPick = opts.onPick || function () {};
    ensureCSS();
    const sup = initSupport();

    let tone = parseInt(lsGet(TONE_KEY), 10); if (!(tone >= 0 && tone <= 5)) tone = 0;
    let hideUns = mode === 'pick' ? true : lsGet(HIDE_KEY) === 'on';
    let query = '', dirtyRecent = false, roving = null;
    const hint = mode === 'pick' ? 'Click one to use it, or press Enter to take the first result.' : 'Click an emoji to copy it.';

    const swatches = ['\u{1F44B}', '\u{1F44B}\u{1F3FB}', '\u{1F44B}\u{1F3FC}', '\u{1F44B}\u{1F3FD}', '\u{1F44B}\u{1F3FE}', '\u{1F44B}\u{1F3FF}'];
    const toneNames = ['Default skin tone', 'Light skin tone', 'Medium-light skin tone', 'Medium skin tone', 'Medium-dark skin tone', 'Dark skin tone'];
    root.innerHTML =
      '<div class="tbxe" style="--tbxe-h:' + esc(opts.height || '22rem') + '">' +
        '<div class="tbxe-top"><input class="tbxe-search" type="search" placeholder="Search emoji: fire, weights, heart, cat…" aria-label="Search emoji" autocomplete="off" spellcheck="false">' +
        '<select class="tbxe-tone" aria-label="Skin tone for people and hands">' + swatches.map((s, i) => '<option value="' + i + '"' + (i === tone ? ' selected' : '') + ' title="' + toneNames[i] + '">' + s + '</option>').join('') + '</select></div>' +
        '<div class="tbxe-cats" role="group" aria-label="Categories"></div>' +
        '<div class="tbxe-scroll"><div class="tbxe-sections"></div><div class="tbxe-results" hidden></div></div>' +
        '<div class="tbxe-foot"><span class="tbxe-name" aria-live="polite"></span><label class="tbxe-hide" hidden><input type="checkbox"><span></span></label></div>' +
      '</div>';
    const $ = (sel) => root.querySelector(sel);
    const searchEl = $('.tbxe-search'), toneEl = $('.tbxe-tone'), catsEl = $('.tbxe-cats'), scroll = $('.tbxe-scroll');
    const secEl = $('.tbxe-sections'), resEl = $('.tbxe-results'), nameEl = $('.tbxe-name'), hideLbl = $('.tbxe-hide'), hideBox = hideLbl.querySelector('input');

    const visible = (it) => !hideUns || !knownBad(it.ch);
    const chFor = (it) => { if (tone && it.skins) { const v = it.skins[tone - 1]; if (v && canShow(v)) return v; } return it.ch; };
    const btn = (it, ch) => '<button type="button" class="tbxe-e" tabindex="-1" data-i="' + it.i + '" data-c="' + esc(ch) + '" aria-label="' + esc(it.name) + '">' + ch + '</button>';
    const setHint = () => { nameEl.textContent = hint; };

    function recents() {
      try { const a = JSON.parse(lsGet(RECENT_KEY)); return Array.isArray(a) ? a.filter(c => typeof c === 'string' && BYCHAR.has(noVS(c))).slice(0, RECENT_MAX) : []; } catch (e) { return []; }
    }
    function pushRecent(c) { lsSet(RECENT_KEY, JSON.stringify([c].concat(recents().filter(x => x !== c)).slice(0, RECENT_MAX))); }

    function renderRecent() {
      const el = secEl.querySelector('[data-sec="recent"]'); if (!el) return;
      const r = recents().filter(c => !hideUns || !knownBad(c));
      el.innerHTML = r.length ? '<h3 class="tbxe-h">Recently used</h3><div class="tbxe-grid">' + r.map(c => btn(BYCHAR.get(noVS(c)), c)).join('') + '</div>' : '';
      dirtyRecent = false; drawCats(); setRoving();
    }
    function buildSections() {
      const byG = D.groups.map(() => []);
      ITEMS.forEach(it => { if (visible(it)) byG[it.g].push(it); });
      secEl.innerHTML = '<div data-sec="recent"></div>' + D.groups.map((g, k) => byG[k].length
        ? '<div class="tbxe-sec" data-sec="' + k + '" data-n="' + byG[k].length + '"><h3 class="tbxe-h">' + esc(g.label) + '</h3><div class="tbxe-grid">' + byG[k].map(it => btn(it, chFor(it))).join('') + '</div></div>' : '').join('');
      sizeSections(); renderRecent();
    }
    // Sections the browser hasn't scrolled to yet skip layout and painting (that's what makes 1,900 emoji cheap), so give each
    // a realistic height up front; otherwise the scroll bar and the category jumps would be off.
    function sizeSections() {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16, gap = 2, pad = 0.8 * rem;
      const avail = Math.max(240, scroll.clientWidth - 2 - pad), cols = Math.max(1, Math.floor((avail + gap) / (2.6 * rem + gap))), cell = (avail - gap * (cols - 1)) / cols;
      secEl.querySelectorAll('.tbxe-sec').forEach(sec => {
        const rows = Math.ceil((+sec.getAttribute('data-n')) / cols);
        sec.style.containIntrinsicSize = 'auto ' + Math.round(30 + 4 + 0.6 * rem + rows * cell + (rows - 1) * gap) + 'px';
      });
    }
    if (window.ResizeObserver) new ResizeObserver(() => sizeSections()).observe(scroll);
    const PAGE = 120; let found = [], shown = 0;
    function drawResults() {
      resEl.innerHTML = found.length
        ? '<div class="tbxe-grid">' + found.slice(0, shown).map(it => btn(it, chFor(it))).join('') + '</div>' +
          (shown < found.length ? '<div class="tbxe-more"><button type="button" class="tbxe-morebtn">Show more (' + (found.length - shown) + ' left)</button></div>' : '')
        : '<div class="tbxe-empty">No emoji match \u201C' + esc(query) + '\u201D. Try a simpler word, like \u201Csmile\u201D, \u201Ccar\u201D or \u201Cfood\u201D.</div>';
      setRoving();
    }
    function buildResults() { found = search(query).filter(visible); shown = Math.min(PAGE, found.length); drawResults(); }
    resEl.addEventListener('click', (e) => { if (e.target.closest('.tbxe-morebtn')) { const st = scroll.scrollTop; shown = Math.min(found.length, shown + 240); drawResults(); scroll.scrollTop = st; } });
    function showView() {
      const searching = !!query;
      secEl.hidden = searching; resEl.hidden = !searching;
      catsEl.style.opacity = searching ? '.45' : '';
      if (searching) buildResults(); else setRoving();
    }

    // Only one emoji button is a tab stop (arrow keys move between them), so Tab doesn't crawl through 1,900 buttons.
    const view = () => (query ? resEl : secEl);
    function setRoving() {
      if (roving && roving.isConnected) roving.tabIndex = -1;
      roving = view().querySelector('.tbxe-e'); if (roving) roving.tabIndex = 0;
    }

    // category chips
    function drawCats() {
      const hasRecent = recents().filter(c => !hideUns || !knownBad(c)).length > 0;
      const present = new Set(Array.from(secEl.querySelectorAll('[data-sec]')).filter(e => e.childElementCount).map(e => e.getAttribute('data-sec')));
      catsEl.innerHTML = '<button type="button" class="tbxe-cat" data-cat="recent" title="Recently used" aria-label="Recently used"' + (hasRecent ? '' : ' hidden') + '>\u{1F554}</button>' +
        D.groups.map((g, k) => '<button type="button" class="tbxe-cat" data-cat="' + k + '" title="' + esc(g.label) + '" aria-label="' + esc(g.label) + '"' + (present.has(String(k)) ? '' : ' hidden') + '>' + g.icon + '</button>').join('');
      markCat();
    }
    function markCat() {
      if (query) { catsEl.querySelectorAll('.tbxe-cat').forEach(b => b.classList.remove('on')); return; }
      let cur = null; const top = scroll.scrollTop + 6;
      secEl.querySelectorAll('[data-sec]').forEach(s => { if (s.childElementCount && s.offsetTop <= top) cur = s.getAttribute('data-sec'); });
      catsEl.querySelectorAll('.tbxe-cat').forEach(b => b.classList.toggle('on', b.getAttribute('data-cat') === cur));
    }
    let raf = 0;
    scroll.addEventListener('scroll', () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; markCat(); if (dirtyRecent && scroll.scrollTop < 4) renderRecent(); }); });
    catsEl.addEventListener('click', (e) => {
      const b = e.target.closest('.tbxe-cat'); if (!b) return;
      if (query) { query = ''; searchEl.value = ''; showView(); }
      if (dirtyRecent) renderRecent();
      const sec = secEl.querySelector('[data-sec="' + b.getAttribute('data-cat') + '"]'); if (sec) scroll.scrollTop = sec.offsetTop;
      markCat();
    });

    // search box
    let typing = 0;
    function applyQuery() { clearTimeout(typing); typing = 0; query = searchEl.value.trim(); scroll.scrollTop = 0; showView(); if (!query && dirtyRecent) renderRecent(); }
    searchEl.addEventListener('input', () => { clearTimeout(typing); typing = setTimeout(applyQuery, 90); });      // wait for a pause in typing instead of redrawing on every key
    searchEl.addEventListener('keydown', (e) => {
      if (typing && (e.key === 'Enter' || e.key === 'ArrowDown')) applyQuery();      // don't act on results that are one keystroke stale
      if (e.key === 'Enter') {
        e.preventDefault();
        const first = view().querySelector('.tbxe-e'); if (first && query) choose(first);
      } else if (e.key === 'ArrowDown') {
        const first = view().querySelector('.tbxe-e'); if (first) { e.preventDefault(); first.focus(); }
      } else if (e.key === 'Escape' && searchEl.value) {
        e.preventDefault(); e.stopPropagation(); searchEl.value = ''; applyQuery();      // first Esc clears the search, not the window around it
      }
    });

    // choosing, hovering, keyboard
    function choose(b) {
      const it = ITEMS[+b.getAttribute('data-i')], ch = b.getAttribute('data-c');
      pushRecent(ch); dirtyRecent = true;
      if (scroll.scrollTop < 4 && !query) renderRecent();
      onPick(ch, it);
    }
    function showName(b) { const it = ITEMS[+b.getAttribute('data-i')]; nameEl.innerHTML = '<b>' + b.getAttribute('data-c') + '</b>' + esc(it.name); }
    scroll.addEventListener('click', (e) => { const b = e.target.closest('.tbxe-e'); if (b) choose(b); });
    scroll.addEventListener('mouseover', (e) => { const b = e.target.closest('.tbxe-e'); if (b) showName(b); });
    scroll.addEventListener('mouseleave', setHint);
    scroll.addEventListener('focusin', (e) => {
      const b = e.target.closest('.tbxe-e'); if (!b) return;
      if (roving && roving !== b && roving.isConnected) roving.tabIndex = -1;
      b.tabIndex = 0; roving = b; showName(b);
    });
    scroll.addEventListener('focusout', (e) => { if (!scroll.contains(e.relatedTarget)) setHint(); });
    scroll.addEventListener('keydown', (e) => {
      const cur = e.target.closest && e.target.closest('.tbxe-e'); if (!cur) return;
      const k = e.key; if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].indexOf(k) < 0) return;
      e.preventDefault();
      const all = Array.from(view().querySelectorAll('.tbxe-e')), i = all.indexOf(cur); let next = null;
      if (k === 'ArrowLeft') next = all[i - 1]; else if (k === 'ArrowRight') next = all[i + 1];
      else if (k === 'Home') next = all[0]; else if (k === 'End') next = all[all.length - 1];
      else {
        const r = cur.getBoundingClientRect(); let best = Infinity;
        all.forEach(b => {
          const q = b.getBoundingClientRect(), dy = q.top - r.top;
          if (k === 'ArrowDown' ? dy > r.height * 0.5 : dy < -r.height * 0.5) { const s = Math.abs(dy) * 1000 + Math.abs(q.left - r.left); if (s < best) { best = s; next = b; } }
        });
        if (!next && k === 'ArrowUp') { searchEl.focus(); return; }
      }
      if (next) { next.focus(); next.scrollIntoView({ block: 'nearest' }); }
    });

    // skin tone + "hide what this device can't show"
    function rebuildKeepingScroll() { const st = scroll.scrollTop; buildSections(); if (query) buildResults(); scroll.scrollTop = st; }
    toneEl.addEventListener('change', () => { tone = parseInt(toneEl.value, 10) || 0; lsSet(TONE_KEY, String(tone)); rebuildKeepingScroll(); });
    function onSupport() {
      if (!sup.bad) return;
      if (mode === 'copy') {
        hideLbl.hidden = false;
        hideLbl.querySelector('span').textContent = 'Hide the ' + sup.bad + ' emoji this device can\u2019t display';
        hideBox.checked = hideUns;
        hideBox.addEventListener('change', () => { hideUns = hideBox.checked; lsSet(HIDE_KEY, hideUns ? 'on' : 'off'); rebuildKeepingScroll(); });
      }
      if (hideUns) rebuildKeepingScroll();
    }
    if (sup.done) onSupport(); else sup.listeners.push(onSupport);

    buildSections(); showView(); setHint();

    return {
      el: root,
      focusSearch() { try { searchEl.focus({ preventScroll: true }); } catch (e) { searchEl.focus(); } },
      reset() { query = ''; searchEl.value = ''; showView(); renderRecent(); scroll.scrollTop = 0; markCat(); setHint(); },
      refresh: renderRecent
    };
  }

  window.ToolboxEmoji = { create, copy, count: ITEMS.length };
})();
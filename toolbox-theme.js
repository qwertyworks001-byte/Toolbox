// Toolbox personalization: your own background (colour, gradient or picture) and text colour on every page, plus the
// account / personalization side panel.
// Add this to any page, high up in <head> so the look is there before the page paints:
//   <script src="toolbox-theme.js"></script>        (homepage)
//   <script src="../toolbox-theme.js"></script>     (tool pages)
// The chosen look is kept in browser storage ('toolbox:theme'); an uploaded picture is kept in IndexedDB (too big for
// localStorage). toolbox-sync.js (on pages that load it) copies both to your account so they follow you to your other
// devices. Without it, everything still works on this device.
(function () {
  const KEY = 'toolbox:theme', STYLE_ID = 'toolbox-theme-style';
  const DEFAULT = { bg: '', bg2: '', kind: 'radial', angle: 135, text: '', accent: '', img: 0, dim: 40 };

  // ── colour maths (kept simple: hex <-> HSL) ──
  function hexToHsl(hex) {
    const n = parseInt(hex.slice(1), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    let h = 0, s = 0;
    if (d) {
      s = d / (1 - Math.abs(2 * l - 1));
      h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h = (h * 60 + 360) % 360;
    }
    return [h, s, l];
  }
  function hslToHex(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    const to = v => Math.round((v + m) * 255).toString(16).padStart(2, '0');
    return '#' + to(r) + to(g) + to(b);
  }
  // The site is built for dark backgrounds with light text, so keep backgrounds dark and text light.
  const MAX_BG_L = 0.3, MIN_TEXT_L = 0.55;
  function readable(hex) { const [h, s, l] = hexToHsl(hex); return l > MAX_BG_L ? hslToHex(h, s, MAX_BG_L) : hex; }
  function readableText(hex) { const [h, s, l] = hexToHsl(hex); return l < MIN_TEXT_L ? hslToHex(h, s, MIN_TEXT_L) : hex; }

  const SOLIDS = [['Default', ''], ['Midnight', '#0f1a3a'], ['Ocean', '#0c2f3f'], ['Forest', '#0f2a1e'], ['Plum', '#2a1236'], ['Crimson', '#3a1218'], ['Slate', '#1e2430'], ['Black', '#000000']];
  const GRADS = [['Aurora', '#0f2027', '#2c5364'], ['Dusk', '#2a0e3a', '#12285a'], ['Ember', '#3a1010', '#1a0a2e'], ['Deep sea', '#001d3d', '#0b4f6c']];
  const PRESETS = SOLIDS.map(([n, c]) => ({ name: n, bg: c, bg2: '', kind: 'radial' })).concat(GRADS.map(([n, a, b]) => ({ name: n, bg: a, bg2: b, kind: 'linear' })));
  // One-click looks: background, text and accent together. (They leave an uploaded picture alone.)
  const THEMES = [
    { name: 'Site default', bg: '', bg2: '', kind: 'radial', angle: 135, text: '', accent: '' },
    { name: 'Midnight Ember', bg: '#1a0f2e', bg2: '#3a1010', kind: 'linear', angle: 135, text: '#fde9c9', accent: '#ff7a3d' },
    { name: 'Forest Night', bg: '#0a1f17', bg2: '#14342a', kind: 'linear', angle: 160, text: '#d4f5e3', accent: '#34d399' },
    { name: 'Ocean Deep', bg: '#00152e', bg2: '#0b4f6c', kind: 'linear', angle: 135, text: '#d6efff', accent: '#38bdf8' },
    { name: 'Sakura', bg: '#2a1020', bg2: '#3a1a3a', kind: 'linear', angle: 135, text: '#ffe4f0', accent: '#f472b6' },
    { name: 'Royal', bg: '#0f0f33', bg2: '#2a1060', kind: 'linear', angle: 135, text: '#e8e0ff', accent: '#8b5cf6' },
    { name: 'Sunset', bg: '#2b0f1f', bg2: '#3d2008', kind: 'linear', angle: 150, text: '#ffe8d6', accent: '#fb923c' },
    { name: 'Terminal', bg: '#050805', bg2: '', kind: 'flat', angle: 135, text: '#b6ffb6', accent: '#22c55e' },
    { name: 'Mono', bg: '#111111', bg2: '#2a2a2a', kind: 'linear', angle: 135, text: '#f5f5f5', accent: '#a3a3a3' }
  ];
  const ACCENTS = [['Site default', ''], ['Blue', '#3b82f6'], ['Orange', '#ff5f2e'], ['Green', '#10b981'], ['Pink', '#ec4899'], ['Violet', '#8b5cf6'], ['Amber', '#f59e0b']];
  const TEXTS = [['Site default', ''], ['White', '#ffffff'], ['Warm', '#fde9c9'], ['Mint', '#b9f5dc'], ['Sky', '#bfe3ff'], ['Lavender', '#e0d4ff']];

  const hex6 = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : '';
  function clean(v) {
    if (!v || typeof v !== 'object') return null;
    const kind = v.flat === true ? 'flat' : (v.kind === 'linear' || v.kind === 'flat' ? v.kind : 'radial');
    const angle = Math.min(360, Math.max(0, Math.round(Number(v.angle)))), dim = Math.min(80, Math.max(0, Math.round(Number(v.dim))));
    return { bg: hex6(v.bg), bg2: hex6(v.bg2), kind, angle: isNaN(angle) ? 135 : angle, text: hex6(v.text), accent: hex6(v.accent), img: Number(v.img) > 0 ? Math.floor(Number(v.img)) : 0, dim: isNaN(dim) ? 40 : dim };
  }
  function read() { try { return clean(JSON.parse(localStorage.getItem(KEY))); } catch (e) { return null; } }
  function write(t) { try { localStorage.setItem(KEY, JSON.stringify(t)); } catch (e) {} }

  // ── the picture: stored in IndexedDB as { t, blob } ──
  function idb() {
    return new Promise((ok, no) => {
      try {
        const r = indexedDB.open('toolbox-theme', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('img');
        r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
      } catch (e) { no(e); }
    });
  }
  const imgGet = () => idb().then(db => new Promise(ok => { const q = db.transaction('img').objectStore('img').get('bg'); q.onsuccess = () => ok(q.result || null); q.onerror = () => ok(null); })).catch(() => null);
  const imgPut = (blob, t) => idb().then(db => new Promise((ok, no) => { const tx = db.transaction('img', 'readwrite'); tx.objectStore('img').put({ t, blob }, 'bg'); tx.oncomplete = ok; tx.onerror = () => no(tx.error); }));
  const imgDel = () => idb().then(db => new Promise(ok => { const tx = db.transaction('img', 'readwrite'); tx.objectStore('img').delete('bg'); tx.oncomplete = ok; tx.onerror = ok; })).catch(() => {});

  // Shrinks a picked picture to a screen-sized JPEG small enough to sync (about 600 KB at most).
  function shrink(file) {
    return new Promise((ok, no) => {
      const url = URL.createObjectURL(file), im = new Image();
      im.onerror = () => { URL.revokeObjectURL(url); no(new Error('read')); };
      im.onload = () => {
        URL.revokeObjectURL(url);
        let max = 1920, q = 0.82;
        const go = () => {
          const k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(im.naturalWidth * k)); c.height = Math.max(1, Math.round(im.naturalHeight * k));
          const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
          c.toBlob(b => {
            if (!b) return no(new Error('encode'));
            if (b.size <= 640000 || (max < 700 && q < 0.5)) return ok(b);
            if (q > 0.55) q -= 0.1; else max = Math.round(max * 0.8);
            go();
          }, 'image/jpeg', q);
        };
        go();
      };
      im.src = url;
    });
  }

  // ── the accent colour: the site's buttons, active tabs, sliders, focus rings and highlights ──
  // The pages use Tailwind's blue classes (and the home page its own --accent), so we restyle exactly those, keeping each
  // class's own shade and see-through level (bg-blue-500/20 stays a faint wash, just in your colour).
  function accentCss(hex) {
    if (!hex) return '';
    const [h, s, l0] = hexToHsl(hex), lumOf = (c) => { const n = parseInt(c.slice(1), 16), f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(n >> 16 & 255) + 0.7152 * f(n >> 8 & 255) + 0.0722 * f(n & 255); };
    let l = Math.min(0.6, Math.max(0.4, l0));
    while (l > 0.25 && lumOf(hslToHex(h, s, l)) > 0.28) l -= 0.02;      // buttons carry white text, so bright colours like yellow are deepened
    const L = { 200: 0.87, 300: 0.8, 400: Math.max(0.68, l + 0.14), 500: Math.min(0.72, l + 0.05), 600: l, 700: Math.max(0.2, l - 0.08) };
    const tone = {}, rgb = {};
    Object.keys(L).forEach(k => { tone[k] = hslToHex(h, s, L[k]); const n = parseInt(tone[k].slice(1), 16); rgb[k] = (n >> 16 & 255) + ' ' + (n >> 8 & 255) + ' ' + (n & 255); });
    const comma = k => rgb[k].replace(/ /g, ',');
    const esc = c => c.replace(/[:\/]/g, '\\$&');
    const props = { bg: 'background-color', text: 'color', border: 'border-color', ring: '--tw-ring-color', outline: 'outline-color', accent: 'accent-color' };
    const faded = { bg: 1, text: 1, border: 1 }, OPS = ['', 10, 20, 30, 40, 50], V = [['', ''], ['hover:', ':hover'], ['focus:', ':focus']];
    let css = '';
    Object.keys(props).forEach(p => Object.keys(L).forEach(sh => (faded[p] ? OPS : ['']).forEach(o => V.forEach(([vp, vs]) => {
      css += '.' + esc(vp + p + '-blue-' + sh + (o ? '/' + o : '')) + vs + '{' + props[p] + ':' + (o ? 'rgb(' + rgb[sh] + ' / ' + o / 100 + ')' : tone[sh]) + ' !important}';
    }))));
    const lum = lumOf(tone[500]);
    css += ':root{--accent:' + tone[500] + ' !important;--accent-soft:rgba(' + comma(500) + ',0.14) !important}.cat-tag.active{color:' + (lum > 0.4 ? '#111111' : '#ffffff') + ' !important}' +
      '.chip.active,.tab-btn.active,.cat-btn.active,.asset-btn.active,.risk-btn.active,.fmt-btn.active{background:rgba(' + comma(500) + ',0.15) !important;border-color:' + tone[500] + ' !important;color:' + tone[300] + ' !important}' +
      'input[type="range"]{background:linear-gradient(90deg,' + tone[300] + ',' + tone[500] + ') !important}' +
      'input[type="range"]::-webkit-slider-thumb{border-color:' + tone[500] + ' !important;box-shadow:0 0 0 4px rgba(' + comma(500) + ',0.15) !important}input[type="range"]::-moz-range-thumb{border-color:' + tone[500] + ' !important}' +
      'a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline-color:' + tone[500] + ' !important}::selection{background:rgba(' + comma(500) + ',0.4)}';
    return css;
  }

  // ── turning a look into CSS ──
  let blobUrl = null, blobT = 0;
  function cssFor(t, imgUrl) {
    let out = '';
    const hasLook = t.bg || t.bg2 || t.kind !== 'radial' || imgUrl;
    if (hasLook) {
      const c1 = readable(t.bg || '#111827'), [h, s, l] = hexToHsl(c1);
      const mid = hslToHex(h, s, l * 0.6), end = t.bg2 ? readable(t.bg2) : hslToHex(h, s, l * 0.3);
      const stops = t.bg2 ? c1 + ' 0%,' + end + ' 100%' : c1 + ' 0%,' + mid + ' 60%,' + end + ' 100%';
      const grad = t.kind === 'flat' ? c1 : t.kind === 'linear' ? 'linear-gradient(' + t.angle + 'deg,' + stops + ')' : 'radial-gradient(circle at top left,' + stops + ')';
      if (imgUrl) {
        const d = (t.dim / 100).toFixed(2);
        out += 'html{background:' + (t.kind === 'flat' ? c1 : grad) + ' !important}body{background:transparent !important}' +
          'body::before{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;background:linear-gradient(rgba(0,0,0,' + d + '),rgba(0,0,0,' + d + ')),url("' + imgUrl + '") center/cover no-repeat}';
      } else if (t.kind === 'flat') out += 'html,body{background:' + c1 + ' !important}';
      else out += 'html{background:' + (t.bg2 ? end : hslToHex(h, s, l * 0.3)) + ' !important}body{background:' + grad + ' !important}';
    }
    out += accentCss(t.accent);
    if (t.text) {
      const x = readableText(t.text);
      out += 'body,.text-white,.text-slate-100,.text-slate-200,.text-slate-300{color:' + x + ' !important}' +
        '.text-slate-400{color:color-mix(in srgb,' + x + ' 72%,transparent) !important}.text-slate-500{color:color-mix(in srgb,' + x + ' 55%,transparent) !important}';
    }
    return out;
  }
  function paint(t, imgUrl) {
    let st = document.getElementById(STYLE_ID);
    if (!st) { st = document.createElement('style'); st.id = STYLE_ID; (document.head || document.documentElement).appendChild(st); }
    st.textContent = cssFor(t, imgUrl);
  }
  function apply() {
    const t = read() || DEFAULT;
    if (!t.img) { paint(t, null); return; }
    paint(t, blobT === t.img ? blobUrl : null);        // colours first; the picture joins as soon as it is read
    if (blobT === t.img) return;
    imgGet().then(rec => {
      if (!rec || rec.t !== t.img || (read() || DEFAULT).img !== t.img) return;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      blobUrl = URL.createObjectURL(rec.blob); blobT = rec.t; paint(read() || DEFAULT, blobUrl);
      if (panelOpen) renderPanel();
    });
  }
  function set(t, keepPanel) { write(clean(t) || DEFAULT); apply(); if (panelOpen && !keepPanel) renderPanel(); }
  const cur = () => Object.assign({}, DEFAULT, read() || {});

  apply();
  const refresh = () => { blobT = 0; apply(); if (panelOpen) renderPanel(); };
  window.addEventListener('toolbox:synced', refresh);                                          // arrived from another device
  window.addEventListener('storage', e => { if (e.key === KEY) refresh(); });                  // changed in another tab
  window.ToolboxTheme = { get: cur, set, presets: PRESETS, themes: THEMES, imgGet, imgPut };

  // ── side panel ──
  let panelOpen = false, root = null, drawer = null, lastFocus = null, note = '';
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const FONT = 'ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif';
  const sync = () => window.ToolboxSync || null;

  function build() {
    if (root) return;
    root = document.createElement('div'); root.id = 'toolbox-panel';
    root.style.cssText = 'position:fixed;inset:0;z-index:10001;display:none;font-family:' + FONT + ';font-size:0.9rem;color:#e2e8f0;';
    root.innerHTML = '<div data-bd style="position:absolute;inset:0;background:rgba(0,0,0,0.55);opacity:0;transition:opacity 0.2s ease;"></div>' +
      '<aside data-dr role="dialog" aria-modal="true" aria-label="Account and personalization" style="position:absolute;top:0;right:0;bottom:0;width:min(340px,100vw);box-sizing:border-box;overflow-y:auto;background:#14171c;border-left:1px solid #334155;box-shadow:-12px 0 40px rgba(0,0,0,0.5);padding:1.1rem;transform:translateX(100%);transition:transform 0.22s ease;"></aside>';
    drawer = root.querySelector('[data-dr]');
    root.querySelector('[data-bd]').addEventListener('click', close);
    drawer.addEventListener('click', onClick);
    drawer.addEventListener('input', onInput);
    drawer.addEventListener('change', onInput);
    document.addEventListener('keydown', e => { if (panelOpen && e.key === 'Escape') close(); });
    document.body.appendChild(root);
  }

  const LBL = 'font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;margin:1rem 0 0.5rem;';
  const ROW = 'display:flex;align-items:center;justify-content:space-between;gap:0.6rem;margin-top:0.7rem;color:#cbd5e1;font-size:0.85rem;';
  const PICK = 'width:3rem;height:2rem;padding:0;border:1px solid #475569;border-radius:6px;background:transparent;cursor:pointer;';
  const SMALL = 'padding:0.35rem 0.7rem;border-radius:8px;border:1px solid #475569;background:#1e293b;color:#cbd5e1;font-size:0.8rem;cursor:pointer;';

  function renderPanel() {
    if (!drawer) return;
    const S = sync(), u = S && S.user(), st = S ? S.status() : 'unconfigured', t = cur();
    const label = { unconfigured: 'Sync is not set up', signedout: 'Not signed in', syncing: 'Syncing…', synced: 'Synced across your devices', error: 'Sync problem' }[st] || '';
    const ini = ((u && (u.displayName || u.email) || '?').trim().charAt(0) || '?').toUpperCase();
    const avatar = u && u.photoURL
      ? '<img alt="" referrerpolicy="no-referrer" src="' + esc(u.photoURL) + '" style="width:56px;height:56px;border-radius:50%;object-fit:cover;display:block;">'
      : '<div style="width:56px;height:56px;border-radius:50%;background:#334155;color:#f1f5f9;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1.3rem;">' + (u ? esc(ini) : '☺') + '</div>';
    const btn = (id, bg, fg) => '<button type="button" data-act="' + id + '" style="width:100%;margin-top:0.7rem;padding:0.55rem;border-radius:8px;border:0;cursor:pointer;font-weight:600;font-size:0.9rem;background:' + bg + ';color:' + fg + ';">';
    const swatch = (attrs, bgcss, name, on) => '<button type="button" ' + attrs + ' aria-label="' + esc(name) + '" aria-pressed="' + on + '" title="' + esc(name) + '" style="width:100%;aspect-ratio:1;border-radius:10px;cursor:pointer;background:' + bgcss + ';border:2px solid ' + (on ? '#3b82f6' : '#475569') + ';box-shadow:' + (on ? '0 0 0 3px rgba(59,130,246,0.3)' : 'none') + ';"></button>';
    const sw = PRESETS.map((p, i) => {
      const on = (t.bg || '') === p.bg && (t.bg2 || '') === p.bg2 && (p.bg2 ? t.kind === 'linear' : t.kind !== 'flat' || !p.bg);
      const c1 = p.bg ? readable(p.bg) : '#111827', css = p.bg2 ? 'linear-gradient(135deg,' + c1 + ',' + readable(p.bg2) + ')' : c1;
      return swatch('data-preset="' + i + '"', css, p.name, on);
    }).join('');
    const same = (a, b) => (a.bg || '') === b.bg && (a.bg2 || '') === b.bg2 && a.kind === b.kind && (a.kind !== 'linear' || a.angle === b.angle) && (a.text || '') === b.text && (a.accent || '') === b.accent;
    const thm = THEMES.map((th, i) => {
      const on = same(t, th), c1 = th.bg ? readable(th.bg) : '#111827', css = th.bg2 && th.kind !== 'flat' ? 'linear-gradient(' + th.angle + 'deg,' + c1 + ',' + readable(th.bg2) + ')' : c1;
      return '<button type="button" data-theme="' + i + '" aria-pressed="' + on + '" style="padding:0.6rem 0.3rem;border-radius:10px;cursor:pointer;background:' + css + ';color:' + (th.text || '#e2e8f0') + ';font:600 0.76rem ' + FONT + ';border:2px solid ' + (on ? '#3b82f6' : '#475569') + ';box-shadow:' + (on ? '0 0 0 3px rgba(59,130,246,0.3)' : 'none') + ';display:flex;flex-direction:column;align-items:center;gap:0.35rem;">' + esc(th.name) + '<span style="width:1.5rem;height:0.3rem;border-radius:99px;background:' + (th.accent || '#3b82f6') + ';"></span></button>';
    }).join('');
    const ac = ACCENTS.map(([n, hx]) => swatch('data-acc="' + hx + '"', hx || 'linear-gradient(135deg,#3b82f6 50%,#ff5f2e 50%)', n, (t.accent || '') === hx)).join('');
    const tx = TEXTS.map(([n, hx]) => swatch('data-text="' + hx + '"', hx || '#e2e8f0', n, (t.text || '') === hx)).join('');
    const c1v = readable(t.bg || '#111827'), c2v = t.bg2 ? readable(t.bg2) : hslToHex(hexToHsl(c1v)[0], hexToHsl(c1v)[1], hexToHsl(c1v)[2] * 0.3);
    const hasImg = !!t.img;
    drawer.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;"><div style="font-weight:700;font-size:1.05rem;color:#fff;">Your Toolbox</div>' +
      '<button type="button" data-act="close" aria-label="Close" style="background:none;border:0;color:#94a3b8;font-size:1.4rem;line-height:1;cursor:pointer;padding:0.2rem 0.4rem;">×</button></div>' +
      '<div style="display:flex;align-items:center;gap:0.85rem;padding:0.9rem;border:1px solid #334155;border-radius:12px;background:rgba(255,255,255,0.03);">' + avatar +
      '<div style="min-width:0;"><div style="font-weight:600;color:#f1f5f9;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(u ? (u.displayName || u.email || 'Signed in') : 'Guest') + '</div>' +
      (u && u.displayName && u.email ? '<div style="color:#94a3b8;font-size:0.8rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(u.email) + '</div>' : '') +
      '<div style="color:' + (st === 'synced' ? '#34d399' : st === 'error' ? '#fbbf24' : '#94a3b8') + ';font-size:0.78rem;margin-top:0.15rem;">' + label + '</div></div></div>' +
      (st === 'unconfigured' ? '' : u ? btn('signout', '#334155', '#f1f5f9') + 'Sign out</button>' : btn('signin', '#3b82f6', '#fff') + '☁ Sign in to sync</button>') +
      '<div style="height:1px;background:#334155;margin:1.2rem 0 0.9rem;"></div>' +
      '<div style="font-weight:700;color:#fff;margin-bottom:0.2rem;">Personalization</div>' +
      '<div style="color:#94a3b8;font-size:0.8rem;">Applies to every page of Toolbox.</div>' +

      '<div style="' + LBL + '">Themes</div>' +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.5rem;">' + thm + '</div>' +
      '<p style="color:#64748b;font-size:0.75rem;line-height:1.5;margin:0.5rem 0 0;">' + (hasImg ? 'A theme sets the colours. Your picture still covers the background, so remove it below to see the theme\u2019s background.' : 'One click sets the background, text and accent together. Fine-tune anything below.') + '</p>' +

      '<div style="' + LBL + '">Background</div>' +
      '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.6rem;">' + sw + '</div>' +
      '<label style="' + ROW + '">Style<select data-kind style="background:#0f131a;color:#e2e8f0;border:1px solid #475569;border-radius:6px;padding:0.3rem 0.4rem;font-size:0.85rem;">' +
      [['radial', 'Soft glow (gradient)'], ['linear', 'Straight gradient'], ['flat', 'Flat colour']].map(([k, n]) => '<option value="' + k + '"' + (t.kind === k ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label>' +
      '<label style="' + ROW + '">' + (t.kind === 'flat' ? 'Colour' : 'Start colour') + '<input type="color" data-c1 value="' + c1v + '" style="' + PICK + '"></label>' +
      (t.kind === 'flat' ? '' : '<label style="' + ROW + '">End colour' + (t.bg2 ? '' : ' <span style="color:#64748b;font-size:0.75rem;">(auto)</span>') + '<span style="display:flex;gap:0.4rem;align-items:center;">' + (t.bg2 ? '<button type="button" data-act="autoend" style="' + SMALL + '">Auto</button>' : '') + '<input type="color" data-c2 value="' + c2v + '" style="' + PICK + '"></span></label>') +
      (t.kind === 'linear' ? '<label style="' + ROW + '">Angle <span style="color:#64748b;font-size:0.75rem;" data-angle-val>' + t.angle + '°</span></label><input type="range" data-angle min="0" max="360" step="5" value="' + t.angle + '" style="width:100%;margin-top:0.4rem;">' : '') +

      '<div style="' + LBL + '">Picture</div>' +
      '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;"><button type="button" data-act="upload" style="' + SMALL + '">' + (hasImg ? 'Change picture…' : 'Upload a picture…') + '</button>' + (hasImg ? '<button type="button" data-act="rmimg" style="' + SMALL + '">Remove</button>' : '') + '</div>' +
      (hasImg ? '<label style="' + ROW + '">Darken <span style="color:#64748b;font-size:0.75rem;" data-dim-val>' + t.dim + '%</span></label><input type="range" data-dim min="0" max="80" step="5" value="' + t.dim + '" style="width:100%;margin-top:0.4rem;">' : '') +
      '<p style="color:#64748b;font-size:0.75rem;line-height:1.5;margin:0.6rem 0 0;" data-note>' + esc(note || (hasImg ? 'Your colours show behind the picture while it loads. Darken it if the text is hard to read.' : 'It is resized to fit a screen, so big photos are fine.')) + '</p>' +

      '<div style="' + LBL + '">Accent colour</div>' +
      '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:0.4rem;">' + ac + '</div>' +
      '<label style="' + ROW + '">Custom<input type="color" data-accc value="' + (t.accent || '#3b82f6') + '" style="' + PICK + '"></label>' +
      '<p style="color:#64748b;font-size:0.75rem;line-height:1.5;margin:0.6rem 0 0;">Buttons, active tabs, sliders and highlights. Pages with their own hand-picked colours may keep a few.</p>' +

      '<div style="' + LBL + '">Text colour</div>' +
      '<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:0.5rem;">' + tx + '</div>' +
      '<label style="' + ROW + '">Custom<input type="color" data-textc value="' + readableText(t.text || '#e2e8f0') + '" style="' + PICK + '"></label>' +
      '<p style="color:#64748b;font-size:0.75rem;line-height:1.5;margin:0.6rem 0 0;">Changes the main text. Very dark text colours are lightened so you can still read it, and coloured highlights stay as they are.</p>' +

      btn('reset', 'transparent', '#94a3b8') + 'Reset everything</button>' +
      '<p style="color:#64748b;font-size:0.75rem;line-height:1.5;margin:1rem 0 0;">' + (u ? 'Your choices sync to your account, so they follow you to your other devices.' : 'Saved on this device. Sign in and they will follow you to your other devices.') + '</p>';
  }

  function pickImage() {
    const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*';
    i.onchange = () => {
      const f = i.files && i.files[0]; if (!f) return;
      if (!/^image\//.test(f.type)) { note = 'That file is not a picture.'; renderPanel(); return; }
      note = 'Preparing your picture…'; renderPanel();
      shrink(f).then(b => { const t = Date.now(); return imgPut(b, t).then(() => { blobT = 0; note = ''; set(Object.assign(cur(), { img: t })); window.dispatchEvent(new CustomEvent('toolbox:theme-image')); }); })
        .catch(() => { note = 'That picture could not be read. Try a JPG, PNG or WebP.'; renderPanel(); });
    };
    i.click();
  }

  function onClick(e) {
    const p = e.target.closest('[data-preset]');
    if (p) { const pr = PRESETS[+p.getAttribute('data-preset')]; set(Object.assign(cur(), { bg: pr.bg, bg2: pr.bg2, kind: pr.kind })); return; }
    const th = e.target.closest('[data-theme]');
    if (th) { const o = THEMES[+th.getAttribute('data-theme')]; set(Object.assign(cur(), { bg: o.bg, bg2: o.bg2, kind: o.kind, angle: o.angle, text: o.text, accent: o.accent })); return; }
    const ax = e.target.closest('[data-acc]');
    if (ax) { set(Object.assign(cur(), { accent: ax.getAttribute('data-acc') })); return; }
    const x = e.target.closest('[data-text]');
    if (x) { set(Object.assign(cur(), { text: x.getAttribute('data-text') })); return; }
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.getAttribute('data-act'), S = sync();
    if (a === 'close') close();
    else if (a === 'reset') { note = ''; imgDel().then(() => { blobT = 0; set(DEFAULT); }); }
    else if (a === 'upload') pickImage();
    else if (a === 'rmimg') { imgDel().then(() => { blobT = 0; note = ''; set(Object.assign(cur(), { img: 0 })); }); }
    else if (a === 'autoend') set(Object.assign(cur(), { bg2: '' }));
    else if (a === 'signin') { close(); if (window.ToolboxAuth) window.ToolboxAuth.open(); }
    else if (a === 'signout') { if (S) { const r = S.signOut(); if (r && r.then) r.then(renderPanel); } }
  }
  function onInput(e) {
    const el = e.target, live = e.type === 'input';      // dragging a slider or picker fires many "input" events; the panel is only redrawn when it settles
    if (el.matches('[data-c1]')) set(Object.assign(cur(), { bg: el.value }), live);
    else if (el.matches('[data-c2]')) set(Object.assign(cur(), { bg2: el.value }), live);
    else if (el.matches('[data-accc]')) set(Object.assign(cur(), { accent: el.value }), live);
    else if (el.matches('[data-textc]')) set(Object.assign(cur(), { text: el.value }), live);
    else if (el.matches('[data-kind]')) set(Object.assign(cur(), { kind: el.value }));
    else if (el.matches('[data-angle]')) { set(Object.assign(cur(), { angle: +el.value }), live); const v = drawer.querySelector('[data-angle-val]'); if (v) v.textContent = el.value + '°'; }
    else if (el.matches('[data-dim]')) { set(Object.assign(cur(), { dim: +el.value }), live); const v = drawer.querySelector('[data-dim-val]'); if (v) v.textContent = el.value + '%'; }
  }

  function open() {
    build(); lastFocus = document.activeElement; panelOpen = true;
    renderPanel(); root.style.display = 'block';
    requestAnimationFrame(() => { root.querySelector('[data-bd]').style.opacity = '1'; drawer.style.transform = 'translateX(0)'; });
    const c = drawer.querySelector('[data-act="close"]'); if (c) c.focus();
  }
  function close() {
    if (!root) return; panelOpen = false;
    root.querySelector('[data-bd]').style.opacity = '0'; drawer.style.transform = 'translateX(100%)';
    setTimeout(() => { if (!panelOpen) root.style.display = 'none'; }, 230);
    try { if (lastFocus && lastFocus.focus) lastFocus.focus(); } catch (e) {}
  }
  window.addEventListener('toolbox:authstate', () => { if (panelOpen) renderPanel(); });
  window.ToolboxPanel = { open, close };
})();
// Toolbox — shared timer engine.
// Loaded on EVERY page (not just Timers) so a running stopwatch/timer/alarm/loop keeps ticking — and can still
// fire its alarm and advance — no matter which page happens to be open. State lives in localStorage; whichever tab
// is open when a countdown hits zero is the one that notices and acts on it.
//
// This version also:
//  - ticks from a Web Worker, so background tabs aren't slowed to one tick a minute by the browser
//  - plays alarms through the Web Audio API, which is "unlocked" by your first tap/click on any page and then stays
//    allowed (a plain <audio> element gets blocked again on a tab that has been idle a long time)
//  - lets you pick the alarm sound, and can show system notifications (timers finishing, habit reminders)
//
// Known limitation: if you have the Toolbox open in more than one tab at once, more than one tab could notice a
// completion at nearly the same moment and both play the alarm sound. Harmless, just occasionally noisy.

(function () {
  const STORAGE_KEY = 'toolbox:timers-state';
  const TICK_MS = 250;
  const ALARM_MAX_MS = 60000;
  const SOUND_KEY = 'toolbox:alarm-sound', VOL_KEY = 'toolbox:alarm-volume';
  const PREF = { timers: 'toolbox:notify-timers', habits: 'toolbox:notify-habits' };
  const NOTIFIED_KEY = 'toolbox:notified';

  // Resolve paths relative to however THIS script was included, so it works the same at the Toolbox root or one folder down.
  const scriptEl = document.currentScript;
  const scriptSrc = (scriptEl && scriptEl.getAttribute('src')) || 'timer-engine.js';
  const relPrefix = scriptSrc.startsWith('../') ? '../' : '';
  const ALARM_SRC = relPrefix + 'Timers/alarm.wav';
  const TIMERS_LINK = relPrefix + 'Timers/timers.html';
  const HABITS_LINK = relPrefix + 'HabitTracker/habit-tracker.html';
  const ICON = relPrefix + 'Assets/Favicon/Favicon.png';
  const ON_TIMERS_PAGE = /\/Timers\/timers\.html$/.test(location.pathname);
  const ON_HABITS_PAGE = /\/HabitTracker\/habit-tracker\.html$/.test(location.pathname);

  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  function pad(n, len) { return n.toString().padStart(len || 2, '0'); }

  function formatStopwatch(ms) {
    const totalCs = Math.floor(ms / 10);
    const cs = totalCs % 100;
    const totalSeconds = Math.floor(totalCs / 100);
    const s = totalSeconds % 60;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const m = totalMinutes % 60;
    const h = Math.floor(totalMinutes / 60);
    return (h > 0 ? `${h}:${pad(m)}:` : `${m}:`) + `${pad(s)}.${pad(cs)}`;
  }
  function formatCountdown(ms) {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  }

  // ── State ────────────────────────────────────────────────────
  function defaultState() {
    return {
      stopwatch: { status: 'idle', elapsedBaseMs: 0, startedAtEpochMs: null, laps: [] },
      timer: { status: 'idle', remainingMs: 0, endAt: null, totalMs: 0, alarmUntil: null },
      alarm: { status: 'idle', targetMs: null, timeStr: '', repeatDaily: false, alarmUntil: null },
      loop: {
        status: 'idle',
        intervals: [
          { id: 1, label: '', minutes: 90, seconds: 0 },
          { id: 2, label: '', minutes: 20, seconds: 0 }
        ],
        nextIntervalId: 3,
        currentIndex: 0,
        remainingMs: 0,
        endAt: null,
        alarmUntil: null
      }
    };
  }
  function loadState() {
    const def = defaultState();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return def;
      const parsed = JSON.parse(raw);
      return {
        stopwatch: Object.assign({}, def.stopwatch, parsed.stopwatch),
        timer: Object.assign({}, def.timer, parsed.timer),
        alarm: Object.assign({}, def.alarm, parsed.alarm),
        loop: Object.assign({}, def.loop, parsed.loop)
      };
    } catch (e) { return def; }
  }
  function saveState(state) { lsSet(STORAGE_KEY, JSON.stringify(state)); }
  function computeDerived(state) {
    const now = Date.now();
    const sw = state.stopwatch;
    const swElapsed = sw.elapsedBaseMs + (sw.status === 'running' && sw.startedAtEpochMs ? now - sw.startedAtEpochMs : 0);
    const t = state.timer;
    const timerRemaining = t.status === 'running' && t.endAt !== null ? Math.max(0, t.endAt - now) : t.remainingMs;
    const l = state.loop;
    const loopRemaining = l.status === 'running' && l.endAt !== null ? Math.max(0, l.endAt - now) : l.remainingMs;
    return { swElapsed, timerRemaining, loopRemaining };
  }

  // ── Alarm sounds (Web Audio) ─────────────────────────────────
  // A tab may only make sound after you've interacted with the page. We listen for your first tap/click/key on any
  // Toolbox page and "unlock" one shared AudioContext; after that alarms can ring even if the tab sat idle for hours.
  function tone(c, out, nodes, type, freq, t, dur, gain, freq2) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (freq2) o.frequency.linearRampToValueAtTime(freq2, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05); nodes.push(o);
  }
  const SOUNDS = [
    { id: 'beep', name: 'Digital beep', period: 1.2, build(c, t, out, n) { for (let i = 0; i < 3; i++) tone(c, out, n, 'square', 880, t + i * 0.25, 0.16, 0.35); } },
    { id: 'chime', name: 'Chime', period: 2.4, build(c, t, out, n) { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(c, out, n, 'sine', f, t + i * 0.3, 1.0, 0.6)); } },
    { id: 'bell', name: 'Bell', period: 2.6, build(c, t, out, n) { [[660, 0.5], [1821.6, 0.25], [3564, 0.12]].forEach(p => tone(c, out, n, 'sine', p[0], t, 2.2, p[1])); } },
    { id: 'siren', name: 'Siren', period: 1.6, build(c, t, out, n) { tone(c, out, n, 'triangle', 600, t, 0.7, 0.5, 950); tone(c, out, n, 'triangle', 950, t + 0.8, 0.7, 0.5, 600); } },
    { id: 'rise', name: 'Gentle rise', period: 3, build(c, t, out, n) { tone(c, out, n, 'sine', 392, t, 1.4, 0.55, 784); tone(c, out, n, 'sine', 523.25, t + 1.5, 1.4, 0.45, 1046.5); } },
    { id: 'classic', name: 'Original alarm', period: 1, file: true, build() {} }
  ];
  let ctx = null, bufferPromise = null;
  const ringing = {}, playing = {}, blocked = {}, fallbackAudio = {}, soundTimeouts = {};
  const AC = () => window.AudioContext || window.webkitAudioContext;
  const audioChanged = () => { try { window.dispatchEvent(new CustomEvent('toolbox:audio')); } catch (e) {} };
  function getCtx() {
    if (!ctx && AC()) { try { ctx = new (AC())(); ctx.onstatechange = audioChanged; } catch (e) { ctx = null; } }
    return ctx;
  }
  function audioState() { if (!AC()) return 'unsupported'; return ctx && ctx.state === 'running' ? 'running' : 'locked'; }
  function ensureRunning() {
    const c = getCtx(); if (!c) return Promise.resolve(false);
    if (c.state === 'running') return Promise.resolve(true);
    let p; try { p = Promise.resolve(c.resume()); } catch (e) { return Promise.resolve(false); }
    return Promise.race([p.then(() => c.state === 'running'), new Promise(r => setTimeout(() => r(c.state === 'running'), 400))]).catch(() => false);
  }
  function unlock() {
    const c = getCtx(); if (!c) return Promise.resolve(false);
    try { const b = c.createBuffer(1, 1, 22050), s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0); } catch (e) {}   // iOS wants a real sound started inside the tap
    return ensureRunning().then((ok) => { if (ok) Object.keys(blocked).forEach(startRinging); audioChanged(); return ok; });
  }
  ['pointerdown', 'touchend', 'keydown', 'click'].forEach(ev => document.addEventListener(ev, () => { if (audioState() !== 'running') unlock(); }, { capture: true, passive: true }));

  const currentSound = () => SOUNDS.find(s => s.id === lsGet(SOUND_KEY)) || SOUNDS[0];
  function volume() { const v = parseFloat(lsGet(VOL_KEY)); return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.8; }
  function loadBuffer(c) {
    if (!bufferPromise) bufferPromise = fetch(ALARM_SRC).then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('missing')))).then(ab => new Promise((ok, no) => c.decodeAudioData(ab, ok, no))).catch(() => null);
    return bufferPromise;
  }
  function begin(key, sound, durMs) {
    const c = getCtx(); if (!c) return false;
    const master = c.createGain(); master.gain.value = volume(); master.connect(c.destination);
    const nodes = [], session = { master, nodes }; playing[key] = session;
    const schedule = (snd) => { const t0 = c.currentTime + 0.05, reps = Math.max(1, Math.ceil(durMs / 1000 / snd.period)); for (let i = 0; i < reps; i++) snd.build(c, t0 + i * snd.period, master, nodes); };
    if (sound.file) {
      loadBuffer(c).then(buf => {
        if (playing[key] !== session) return;
        if (!buf) { schedule(SOUNDS[0]); return; }
        const src = c.createBufferSource(); src.buffer = buf; src.loop = true; src.connect(master); src.start(); nodes.push(src);
      });
    } else schedule(sound);
    return true;
  }
  function startRinging(key) {
    ensureRunning().then((ok) => {
      if (!ringing[key] || ringing[key] < Date.now()) return;
      if (ok) { delete blocked[key]; stopFallback(key); if (playing[key]) return; begin(key, currentSound(), Math.max(1000, ringing[key] - Date.now())); }
      else { blocked[key] = true; tryFallback(key); }
      audioChanged();
    });
  }
  function tryFallback(key) {      // last resort: a plain <audio> element (works only if the browser happens to allow it)
    if (fallbackAudio[key]) return;
    try { const a = new Audio(ALARM_SRC); a.loop = true; fallbackAudio[key] = a; Promise.resolve(a.play()).then(() => { if (!ringing[key]) a.pause(); else { delete blocked[key]; audioChanged(); } }).catch(() => {}); } catch (e) {}
  }
  function stopFallback(key) { const a = fallbackAudio[key]; if (a) { try { a.pause(); a.currentTime = 0; } catch (e) {} delete fallbackAudio[key]; } }
  function fireAlarmSound(key) {
    stopAlarmSound(key);
    ringing[key] = Date.now() + ALARM_MAX_MS;
    soundTimeouts[key] = setTimeout(() => stopAlarmSound(key), ALARM_MAX_MS);
    startRinging(key);
  }
  function stopAlarmSound(key) {
    delete ringing[key]; delete blocked[key]; stopFallback(key);
    const p = playing[key];
    if (p) { try { p.master.gain.value = 0; } catch (e) {} p.nodes.forEach(n => { try { n.stop(); } catch (e) {} }); try { p.master.disconnect(); } catch (e) {} delete playing[key]; }
    if (soundTimeouts[key]) { clearTimeout(soundTimeouts[key]); delete soundTimeouts[key]; }
    audioChanged();
  }
  function previewSound(id) {
    const s = SOUNDS.find(x => x.id === id) || currentSound();
    stopAlarmSound('preview');
    return unlock().then((ok) => {
      if (!ok) return false;
      ringing.preview = Date.now() + 3000; soundTimeouts.preview = setTimeout(() => stopAlarmSound('preview'), 3000);
      return begin('preview', s, 3000);
    });
  }

  // ── Notifications ────────────────────────────────────────────
  // Shown through a service worker (needed on phones). They appear while Toolbox is open in a tab or installed app;
  // a website cannot wake itself up to notify you once it is completely closed.
  let swReg = null;
  const secure = () => location.protocol === 'https:' || location.hostname === 'localhost';
  function ensureSW() {
    if (swReg) return Promise.resolve(swReg);
    if (!('serviceWorker' in navigator) || !secure()) return Promise.resolve(null);
    return Promise.resolve(navigator.serviceWorker.register(relPrefix + 'toolbox-sw.js')).then(r => (swReg = r)).catch(() => null);
  }
  function notifyState(kind) {
    if (typeof Notification === 'undefined') return 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    if (Notification.permission === 'default') return 'default';
    return lsGet(PREF[kind]) === 'on' ? 'on' : 'off';
  }
  const canNotify = (kind) => notifyState(kind) === 'on';
  function enableNotifications(kind) {
    if (typeof Notification === 'undefined') return Promise.resolve('unsupported');
    return Promise.resolve(Notification.permission === 'default' ? Notification.requestPermission() : Notification.permission).then((p) => {
      if (p !== 'granted') return p === 'denied' ? 'denied' : 'default';
      lsSet(PREF[kind], 'on'); ensureSW(); audioChanged(); return 'on';
    }).catch(() => 'default');
  }
  function disableNotifications(kind) { lsSet(PREF[kind], 'off'); audioChanged(); return 'off'; }
  function showNotice(title, body, tag, url, persistent) {
    const opts = { body, tag, icon: ICON, vibrate: [200, 100, 200, 100, 200], requireInteraction: !!persistent, renotify: true, data: { url: new URL(url, location.href).href } };
    return ensureSW().then((reg) => {
      if (reg && reg.showNotification) return Promise.resolve(reg.showNotification(title, opts)).then(() => true);
      new Notification(title, opts); return true;
    }).catch(() => { try { new Notification(title, opts); return true; } catch (e) { return false; } });
  }
  function announce(title, body, tag, tab) {
    if (ON_TIMERS_PAGE && !document.hidden) return;          // you're already looking at it
    if (canNotify('timers')) showNotice(title, body, tag, TIMERS_LINK + '?tab=' + tab, true);
  }

  // Habit reminders: the Habit Tracker stores a reminder time per habit; fire a notification once per habit per day
  // (within 3 hours of that time) unless the habit is already done or isn't scheduled today.
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const mins = (hm) => parseInt(hm.slice(0, 2), 10) * 60 + parseInt(hm.slice(3, 5), 10);
  let lastHabitCheck = 0;
  function checkHabitReminders() {
    if (Date.now() - lastHabitCheck < 15000 || !canNotify('habits')) return;
    lastHabitCheck = Date.now();
    let d; try { d = JSON.parse(lsGet('toolbox:habits')); } catch (e) { return; }
    if (!d || !d.habits) return;
    const now = new Date(), key = ymd(now), hm = pad(now.getHours()) + ':' + pad(now.getMinutes()), dowN = (now.getDay() + 6) % 7;
    let sent; try { sent = JSON.parse(lsGet(NOTIFIED_KEY)) || {}; } catch (e) { sent = {}; }
    Object.keys(sent).forEach(k => { if (sent[k] < Date.now() - 3 * 86400000) delete sent[k]; });
    const doneOn = (h, k) => { const e = d.log && d.log[k] && d.log[k][h.id]; return !!e && e[0] >= (h.target || 1); };
    const due = []; let changed = false;
    Object.keys(d.habits).forEach(id => {
      const h = d.habits[id];
      if (!h || h.deleted || !/^\d{2}:\d{2}$/.test(h.remind || '')) return;
      if (h.mode === 'days' && !(h.days || []).includes(dowN)) return;
      if (mins(hm) < mins(h.remind) || mins(hm) - mins(h.remind) > 180) return;
      const sid = h.id + '|' + key; if (sent[sid]) return;
      let skip = doneOn(h, key);
      if (!skip && h.mode === 'weekly') { let c = 0; for (let i = 0; i <= dowN; i++) { const dd = new Date(now); dd.setDate(now.getDate() - i); if (doneOn(h, ymd(dd))) c++; } skip = c >= (h.weekly || 3); }
      sent[sid] = Date.now(); changed = true; if (!skip) due.push(h);
    });
    if (changed) lsSet(NOTIFIED_KEY, JSON.stringify(sent));
    if (ON_HABITS_PAGE && !document.hidden) return;           // the tracker already highlights it on screen
    due.forEach(h => showNotice((h.emoji ? h.emoji + ' ' : '') + h.name, 'Time for your habit. Tap to open your tracker.', 'habit-' + h.id + '-' + key, HABITS_LINK, false));
  }

  // ── Completion detection (runs on every tick, on whichever tab is open) ──
  function processTick() {
    const state = loadState();
    const now = Date.now();
    let mutated = false;

    if (state.timer.status === 'running' && state.timer.endAt !== null && now >= state.timer.endAt) {
      state.timer.status = 'finished'; state.timer.remainingMs = 0; state.timer.endAt = null; state.timer.alarmUntil = now + ALARM_MAX_MS;
      fireAlarmSound('timer'); announce('\u23F2 Timer finished', 'Your countdown has reached zero.', 'toolbox-timer', 'timer');
      mutated = true;
    }
    if (state.alarm.status === 'armed' && state.alarm.targetMs !== null && now >= state.alarm.targetMs) {
      state.alarm.status = 'firing'; state.alarm.alarmUntil = now + ALARM_MAX_MS;
      fireAlarmSound('alarm'); announce('\u23F0 Alarm', state.alarm.timeStr ? 'It is ' + state.alarm.timeStr + '.' : 'Your alarm is ringing.', 'toolbox-alarm', 'alarm');
      mutated = true;
    }
    if (state.loop.status === 'running' && state.loop.endAt !== null && now >= state.loop.endAt && state.loop.intervals.length) {
      state.loop.alarmUntil = now + ALARM_MAX_MS;
      fireAlarmSound('loop');
      state.loop.currentIndex = (state.loop.currentIndex + 1) % state.loop.intervals.length;
      const iv = state.loop.intervals[state.loop.currentIndex];
      const ms = (iv.minutes * 60 + iv.seconds) * 1000;
      state.loop.remainingMs = ms; state.loop.endAt = now + ms;
      announce('\uD83D\uDD01 Next interval', iv.label ? iv.label : `${iv.minutes}m${iv.seconds ? ' ' + iv.seconds + 's' : ''} starts now.`, 'toolbox-loop', 'loop');
      mutated = true;
    }
    if (mutated) saveState(state);
    return state;
  }

  // ── Floating widget (skipped entirely on the Timers page itself) ──
  let widgetContainer = null;
  function ensureWidgetContainer() {
    if (widgetContainer) return widgetContainer;
    widgetContainer = document.createElement('div');
    widgetContainer.id = 'toolbox-timer-widget';
    widgetContainer.style.cssText = 'position:fixed;bottom:1rem;right:1rem;z-index:9999;display:flex;flex-direction:column;gap:0.5rem;align-items:flex-end;';
    document.body.appendChild(widgetContainer);
    return widgetContainer;
  }
  function renderWidget(state) {
    if (ON_TIMERS_PAGE || !document.body) return;
    const d = computeDerived(state);
    const items = [];
    if (state.stopwatch.status === 'running' || state.stopwatch.status === 'paused') {
      items.push({ tab: 'stopwatch', icon: '\u23F1', text: `Stopwatch ${formatStopwatch(d.swElapsed)}${state.stopwatch.status === 'paused' ? ' (paused)' : ''}` });
    }
    if (state.timer.status === 'running' || state.timer.status === 'paused') {
      items.push({ tab: 'timer', icon: '\u23F2', text: `Timer ${formatCountdown(d.timerRemaining)}${state.timer.status === 'paused' ? ' (paused)' : ''}` });
    } else if (state.timer.status === 'finished') {
      items.push({ tab: 'timer', icon: '\u23F2', text: 'Timer done!', alert: true });
    }
    if (state.alarm.status === 'armed') items.push({ tab: 'alarm', icon: '\u23F0', text: `Alarm ${state.alarm.timeStr}` });
    else if (state.alarm.status === 'firing') items.push({ tab: 'alarm', icon: '\u23F0', text: 'Alarm!', alert: true });
    if (state.loop.status === 'running' || state.loop.status === 'paused') {
      const iv = state.loop.intervals[state.loop.currentIndex];
      const label = iv ? (iv.label || `${iv.minutes}m${iv.seconds ? ' ' + iv.seconds + 's' : ''}`) : '';
      items.push({ tab: 'loop', icon: '\uD83D\uDD01', text: `Loop ${label ? label + ' \u2013 ' : ''}${formatCountdown(d.loopRemaining)}${state.loop.status === 'paused' ? ' (paused)' : ''}` });
    }
    const container = ensureWidgetContainer();
    if (items.length === 0) { container.innerHTML = ''; return; }
    container.innerHTML = items.map(item => `
      <a href="${TIMERS_LINK}?tab=${item.tab}" style="
        display:flex;align-items:center;gap:0.5rem;
        background:${item.alert ? 'rgba(127,29,29,0.85)' : 'rgba(15,23,42,0.92)'};
        border:1px solid ${item.alert ? 'rgba(239,68,68,0.6)' : 'rgba(255,255,255,0.12)'};
        color:${item.alert ? '#fecaca' : '#e2e8f0'};
        padding:0.5rem 0.9rem;border-radius:9999px;font-size:0.8rem;font-weight:500;
        text-decoration:none;box-shadow:0 4px 16px rgba(0,0,0,0.4);backdrop-filter:blur(6px);
        font-family:ui-sans-serif,system-ui,sans-serif;white-space:nowrap;">
        <span>${item.icon}</span><span>${item.text}</span>
      </a>
    `).join('');
  }

  // ── Subscriptions + refresh loop ──────────────────────────────
  let subscribers = [];
  function refresh() {
    const state = processTick();
    renderWidget(state);
    subscribers.forEach(fn => { try { fn(state); } catch (e) { console.error(e); } });
    try { checkHabitReminders(); } catch (e) {}
    return state;
  }
  function mutate(fn) {
    const state = loadState();
    fn(state);
    saveState(state);
    return refresh();
  }

  // Tick from a Web Worker where possible: browsers slow ordinary timers in background tabs to ~1 a minute, but not worker timers.
  function startTicker() {
    const fallback = () => setInterval(refresh, TICK_MS);
    try {
      if (typeof Worker === 'function' && window.URL && URL.createObjectURL && typeof Blob === 'function') {
        const w = new Worker(URL.createObjectURL(new Blob(['setInterval(function(){postMessage(1)},' + TICK_MS + ')'], { type: 'text/javascript' })));
        w.onmessage = refresh;
        w.onerror = () => { try { w.terminate(); } catch (e) {} fallback(); };
        return;
      }
    } catch (e) {}
    fallback();
  }
  startTicker();
  window.addEventListener('storage', (e) => { if (e.key === STORAGE_KEY) refresh(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  if (document.body) refresh(); else document.addEventListener('DOMContentLoaded', refresh);
  if (notifyState('timers') === 'on' || notifyState('habits') === 'on') ensureSW();

  // ── Public API ─────────────────────────────────────────────────
  window.ToolboxTimers = {
    getState: loadState,
    getDerived: computeDerived,
    formatStopwatch,
    formatCountdown,
    subscribe(fn) { subscribers.push(fn); return () => { subscribers = subscribers.filter(f => f !== fn); }; },

    // sound + notifications
    sounds: SOUNDS.map(s => ({ id: s.id, name: s.name })),
    getSound() { return currentSound().id; },
    setSound(id) { if (SOUNDS.some(s => s.id === id)) { lsSet(SOUND_KEY, id); audioChanged(); } },
    getVolume: volume,
    setVolume(v) { lsSet(VOL_KEY, String(Math.min(1, Math.max(0, +v || 0)))); const p = playing.preview; if (p) { try { p.master.gain.value = volume(); } catch (e) {} } },
    previewSound,
    stopPreview() { stopAlarmSound('preview'); },
    unlock,
    audioState,
    audioBlocked() { return Object.keys(blocked).length > 0; },
    isRinging() { return Object.keys(ringing).some(k => k !== 'preview' && ringing[k] > Date.now()); },
    notifyState,
    enableNotifications,
    disableNotifications,
    testNotification() { return showNotice('\uD83D\uDD14 Toolbox notifications are on', 'You will be notified when timers finish and habits are due.', 'toolbox-test', TIMERS_LINK, false); },

    stopwatchStart() { mutate(s => { if (s.stopwatch.status !== 'running') { s.stopwatch.status = 'running'; s.stopwatch.startedAtEpochMs = Date.now(); } }); },
    stopwatchPause() { mutate(s => { if (s.stopwatch.status === 'running') { s.stopwatch.elapsedBaseMs += Date.now() - s.stopwatch.startedAtEpochMs; s.stopwatch.status = 'paused'; s.stopwatch.startedAtEpochMs = null; } }); },
    stopwatchReset() { mutate(s => { s.stopwatch = { status: 'idle', elapsedBaseMs: 0, startedAtEpochMs: null, laps: [] }; }); },
    stopwatchLap() { mutate(s => {
      const d = computeDerived(s);
      const prevTotal = s.stopwatch.laps.length ? s.stopwatch.laps[s.stopwatch.laps.length - 1].total : 0;
      s.stopwatch.laps.push({ total: d.swElapsed, split: d.swElapsed - prevTotal });
    }); },

    timerStart(totalMs) { mutate(s => {
      if (totalMs === undefined && s.timer.status === 'paused' && s.timer.remainingMs > 0) {
        s.timer.endAt = Date.now() + s.timer.remainingMs;
      } else if (totalMs > 0) {
        s.timer.totalMs = totalMs; s.timer.remainingMs = totalMs; s.timer.endAt = Date.now() + totalMs;
      } else { return; }
      s.timer.status = 'running';
    }); },
    timerPause() { mutate(s => { if (s.timer.status === 'running') { s.timer.remainingMs = Math.max(0, s.timer.endAt - Date.now()); s.timer.endAt = null; s.timer.status = 'paused'; } }); },
    timerReset() { stopAlarmSound('timer'); mutate(s => { s.timer = { status: 'idle', remainingMs: 0, endAt: null, totalMs: 0, alarmUntil: null }; }); },
    timerStopAlarm() { stopAlarmSound('timer'); mutate(s => { s.timer.alarmUntil = null; }); },

    alarmArm(timeStr, repeatDaily) { mutate(s => {
      const [hh, mm] = timeStr.split(':').map(Number);
      const now = new Date();
      const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0, 0);
      if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
      s.alarm = { status: 'armed', targetMs: target.getTime(), timeStr, repeatDaily: !!repeatDaily, alarmUntil: null };
    }); },
    alarmCancel() { stopAlarmSound('alarm'); mutate(s => { s.alarm = { status: 'idle', targetMs: null, timeStr: '', repeatDaily: false, alarmUntil: null }; }); },
    alarmStopAlarm() { stopAlarmSound('alarm'); mutate(s => {
      if (s.alarm.repeatDaily) { s.alarm.status = 'armed'; s.alarm.targetMs = (s.alarm.targetMs || Date.now()) + 24 * 3600 * 1000; }
      else { s.alarm.status = 'idle'; s.alarm.targetMs = null; }
      s.alarm.alarmUntil = null;
    }); },

    loopAddInterval() { mutate(s => { s.loop.intervals.push({ id: s.loop.nextIntervalId++, label: '', minutes: 10, seconds: 0 }); }); },
    loopRemoveInterval(id) { mutate(s => {
      s.loop.intervals = s.loop.intervals.filter(iv => iv.id !== id);
      if (s.loop.currentIndex >= s.loop.intervals.length) s.loop.currentIndex = 0;
    }); },
    loopUpdateInterval(id, patch) { mutate(s => { const iv = s.loop.intervals.find(i => i.id === id); if (iv) Object.assign(iv, patch); }); },
    loopSwap(idxA, idxB) { mutate(s => { const list = s.loop.intervals; [list[idxA], list[idxB]] = [list[idxB], list[idxA]]; }); },
    loopReorder(srcId, targetId) { mutate(s => {
      const list = s.loop.intervals;
      const srcIdx = list.findIndex(i => i.id === srcId);
      const targetIdx = list.findIndex(i => i.id === targetId);
      if (srcIdx === -1 || targetIdx === -1) return;
      const [moved] = list.splice(srcIdx, 1);
      list.splice(targetIdx, 0, moved);
    }); },
    loopStart() { mutate(s => {
      if (s.loop.status === 'paused' && s.loop.remainingMs > 0) {
        s.loop.endAt = Date.now() + s.loop.remainingMs;
      } else if (s.loop.status !== 'running') {
        if (!s.loop.intervals.length) return;
        if (s.loop.currentIndex >= s.loop.intervals.length) s.loop.currentIndex = 0;
        const iv = s.loop.intervals[s.loop.currentIndex];
        const ms = (iv.minutes * 60 + iv.seconds) * 1000;
        s.loop.remainingMs = ms; s.loop.endAt = Date.now() + ms;
      }
      s.loop.status = 'running';
    }); },
    loopPause() { mutate(s => { if (s.loop.status === 'running') { s.loop.remainingMs = Math.max(0, s.loop.endAt - Date.now()); s.loop.endAt = null; s.loop.status = 'paused'; } }); },
    loopReset() { stopAlarmSound('loop'); mutate(s => { s.loop.status = 'idle'; s.loop.currentIndex = 0; s.loop.remainingMs = 0; s.loop.endAt = null; s.loop.alarmUntil = null; }); },
    loopStopAlarm() { stopAlarmSound('loop'); mutate(s => { s.loop.alarmUntil = null; }); }
  };
})();
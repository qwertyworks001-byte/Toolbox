// Toolbox — shared timer engine.
// Loaded on EVERY page (not just Timers) so any number of running timers, alarms and loops (and the stopwatch) keep ticking — and can still
// fire its alarm and advance — no matter which page happens to be open. State lives in localStorage; whichever tab
// is open when a countdown hits zero is the one that notices and acts on it.
//
// This version also:
//  - ticks from a Web Worker, so background tabs aren't slowed to one tick a minute by the browser
//  - plays alarms through ordinary <audio> elements fed with generated sound clips. Phones treat that as media (so an
//    iPhone's silent switch doesn't mute it), the volume is baked into the clip, and your first tap/click/key on any
//    page "unlocks" the elements so they can ring later without another tap
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
  // v2: any number of timers, alarms and loops, each with an optional reminder note.
  //   timers: { id, note, status: running|paused|finished, totalMs, remainingMs, endAt, alarmUntil }
  //   alarms: { id, note, status: armed|firing, timeStr, targetMs, repeatDaily, alarmUntil }
  //   loops:  { id, note, status: running|paused, intervals: [{id,label,minutes,seconds}], currentIndex, remainingMs, endAt, alarmUntil }
  //   loopDraft: the interval list being edited on the Timer Loop tab (a loop copies it when you start it)
  const MAX_ITEMS = 30, NOTE_MAX = 120;
  const arr = (x) => Array.isArray(x) ? x : [];
  const cleanNote = (n) => String(n == null ? '' : n).slice(0, NOTE_MAX);
  function defaultState() {
    return {
      v: 2,
      stopwatch: { status: 'idle', elapsedBaseMs: 0, startedAtEpochMs: null, laps: [] },
      timers: [], alarms: [], loops: [],
      loopDraft: { intervals: [{ id: 1, label: '', minutes: 90, seconds: 0 }, { id: 2, label: '', minutes: 20, seconds: 0 }], nextIntervalId: 3 },
      nextId: 1
    };
  }
  function loadState() {
    const def = defaultState();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return def;
      const p = JSON.parse(raw);
      if (p.v === 2) {
        return { v: 2, stopwatch: Object.assign({}, def.stopwatch, p.stopwatch), timers: arr(p.timers), alarms: arr(p.alarms), loops: arr(p.loops),
          loopDraft: (p.loopDraft && arr(p.loopDraft.intervals).length) ? p.loopDraft : def.loopDraft, nextId: p.nextId || 1 };
      }
      // Older single-timer/alarm/loop state: carry over anything that was running.
      const s = def; s.stopwatch = Object.assign({}, def.stopwatch, p.stopwatch);
      const t = p.timer;
      if (t && t.status && t.status !== 'idle') s.timers.push({ id: s.nextId++, note: '', status: t.status, totalMs: t.totalMs || 0, remainingMs: t.remainingMs || 0, endAt: t.endAt || null, alarmUntil: t.alarmUntil || null });
      const a = p.alarm;
      if (a && (a.status === 'armed' || a.status === 'firing')) s.alarms.push({ id: s.nextId++, note: '', status: a.status, timeStr: a.timeStr || '', targetMs: a.targetMs, repeatDaily: !!a.repeatDaily, alarmUntil: a.alarmUntil || null });
      const l = p.loop;
      if (l && arr(l.intervals).length) {
        s.loopDraft = { intervals: l.intervals, nextIntervalId: l.nextIntervalId || (l.intervals.length + 1) };
        if (l.status === 'running' || l.status === 'paused') s.loops.push({ id: s.nextId++, note: '', status: l.status, intervals: l.intervals.map(x => Object.assign({}, x)), currentIndex: l.currentIndex || 0, remainingMs: l.remainingMs || 0, endAt: l.endAt || null, alarmUntil: l.alarmUntil || null });
      }
      return s;
    } catch (e) { return def; }
  }
  function saveState(state) { lsSet(STORAGE_KEY, JSON.stringify(state)); }
  const left = (it) => (it.status === 'running' && it.endAt !== null) ? Math.max(0, it.endAt - Date.now()) : (it.remainingMs || 0);
  const isRinging = (it) => !!it.alarmUntil && Date.now() < it.alarmUntil;
  function computeDerived(state) {
    const sw = state.stopwatch;
    return { swElapsed: sw.elapsedBaseMs + (sw.status === 'running' && sw.startedAtEpochMs ? Date.now() - sw.startedAtEpochMs : 0) };
  }

  // ── Alarm sounds ─────────────────────────────────────────────
  // Every built-in sound is generated as one repeat of a small WAV clip, which an <audio> element then loops. Why not
  // Web Audio: phones mute it when the silent switch is on, and its AudioContext can get stuck "suspended/interrupted".
  // Browsers only allow sound after you've touched the page, so the first tap/click/key on any Toolbox page "unlocks"
  // the timer/alarm/loop elements by playing a silent clip on each; after that alarms can ring with no further tap.
  const SR = 22050;
  const SOUNDS = [
    { id: 'beep', name: 'Digital beep', period: 1.2, voices: [0, 1, 2].map(i => ({ type: 'square', f: 880, t: i * 0.25, d: 0.16, g: 0.35 })) },
    { id: 'chime', name: 'Chime', period: 2.4, voices: [523.25, 659.25, 783.99, 1046.5].map((f, i) => ({ type: 'sine', f, t: i * 0.3, d: 1.0, g: 0.6 })) },
    { id: 'bell', name: 'Bell', period: 2.6, voices: [[660, 0.5], [1821.6, 0.25], [3564, 0.12]].map(p => ({ type: 'sine', f: p[0], t: 0, d: 2.2, g: p[1] })) },
    { id: 'siren', name: 'Siren', period: 1.6, voices: [{ type: 'triangle', f: 600, f2: 950, t: 0, d: 0.7, g: 0.5 }, { type: 'triangle', f: 950, f2: 600, t: 0.8, d: 0.7, g: 0.5 }] },
    { id: 'rise', name: 'Gentle rise', period: 3, voices: [{ type: 'sine', f: 392, f2: 784, t: 0, d: 1.4, g: 0.55 }, { type: 'sine', f: 523.25, f2: 1046.5, t: 1.5, d: 1.4, g: 0.45 }] },
    { id: 'classic', name: 'Original alarm', period: 1, file: true, voices: [] }
  ];
  const baseSamples = {}, wavUrls = {};
  function samplesFor(snd) {      // one period of the sound, scaled so its loudest point is 0.9
    if (baseSamples[snd.id]) return baseSamples[snd.id];
    const n = Math.round(snd.period * SR), out = new Float32Array(n);
    snd.voices.forEach(v => {
      const start = Math.round(v.t * SR), len = Math.round(v.d * SR); let phase = 0;
      for (let i = 0; i < len && start + i < n; i++) {
        const t = i / SR, f = v.f2 ? v.f + (v.f2 - v.f) * (t / v.d) : v.f;
        phase += f / SR; const ph = phase % 1;
        const w = v.type === 'square' ? (ph < 0.5 ? 1 : -1) : v.type === 'triangle' ? 1 - 4 * Math.abs(ph - 0.5) : Math.sin(2 * Math.PI * ph);
        const env = t < 0.015 ? 0.0001 * Math.pow(v.g / 0.0001, t / 0.015) : v.g * Math.pow(0.0001 / v.g, (t - 0.015) / (v.d - 0.015));
        out[start + i] += w * env;
      }
    });
    let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]));
    if (peak > 0) for (let i = 0; i < n; i++) out[i] *= 0.9 / peak;
    return (baseSamples[snd.id] = out);
  }
  function wavUrl(samples, vol) {
    const n = samples.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, SR, true); v.setUint32(28, SR * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, samples[i] * vol)) * 32767), true);
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  }
  let silentUrl = null;
  const getSilent = () => silentUrl || (silentUrl = wavUrl(new Float32Array(Math.round(SR * 0.3)), 1));
  const currentSound = () => SOUNDS.find(s => s.id === lsGet(SOUND_KEY)) || SOUNDS[0];
  function volume() { const v = parseFloat(lsGet(VOL_KEY)); return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.8; }
  function soundUrl(snd) {
    if (snd.file) return ALARM_SRC;
    const key = snd.id + '|' + Math.round(volume() * 40);
    return wavUrls[key] || (wavUrls[key] = wavUrl(samplesFor(snd), volume()));
  }

  const KEYS = ['timer', 'alarm', 'loop', 'preview'], UNLOCK_KEYS = ['timer', 'alarm', 'loop'];
  const els = {}, ringing = {}, blocked = {}, starting = {}, soundTimeouts = {};
  let unlocked = false, unlocking = false, previewId = null;
  const canAudio = () => typeof Audio === 'function';
  const audioChanged = () => { try { window.dispatchEvent(new CustomEvent('toolbox:audio')); } catch (e) {} };
  const anyBlocked = () => Object.keys(blocked).some(k => k !== 'preview');
  function el(key) {
    if (!els[key] && canAudio()) { try { const a = new Audio(); a.preload = 'auto'; a.setAttribute('playsinline', ''); els[key] = a; } catch (e) {} }
    return els[key] || null;
  }
  function audioState() { if (!canAudio()) return 'unsupported'; return unlocked ? 'running' : 'locked'; }
  function playEl(a) {
    let p; try { p = a.play(); } catch (e) { return Promise.reject(e); }
    return Promise.resolve(p).then(() => { if (!unlocked) { unlocked = true; audioChanged(); } });
  }
  // Called straight from taps/clicks/keys: phones only accept play() inside the gesture, so nothing here waits first.
  function unlock() {
    if (!canAudio()) return Promise.resolve(false);
    Object.keys(blocked).forEach(k => { if (k !== 'preview') startRinging(k); });      // an alarm is waiting on this tap
    if (unlocking) return Promise.resolve(unlocked);
    unlocking = true;
    const jobs = UNLOCK_KEYS.filter(k => !ringing[k]).map(k => {
      const a = el(k); if (!a) return Promise.resolve();
      try { a.loop = false; a.src = getSilent(); a.volume = 1; } catch (e) {}
      return playEl(a).then(() => { if (a.src === silentUrl) a.pause(); }).catch(() => {});
    });
    return Promise.race([Promise.all(jobs), new Promise(r => setTimeout(r, 1500))]).then(() => { unlocking = false; audioChanged(); return unlocked; });
  }
  ['pointerup', 'touchend', 'keydown', 'click'].forEach(ev => document.addEventListener(ev, () => { if (!unlocked || anyBlocked()) unlock(); }, { capture: true, passive: true }));

  function startRinging(key, useBeep) {
    if (!ringing[key] || ringing[key] < Date.now() || starting[key]) return Promise.resolve(false);
    const a = el(key); if (!a) { blocked[key] = true; audioChanged(); return Promise.resolve(false); }
    const snd = useBeep ? SOUNDS[0] : (key === 'preview' ? (SOUNDS.find(s => s.id === previewId) || currentSound()) : currentSound());
    try { a.loop = true; a.src = soundUrl(snd); a.volume = snd.file ? volume() : 1; } catch (e) {}
    starting[key] = true;
    return playEl(a).then(() => { starting[key] = false; delete blocked[key]; audioChanged(); return true; }, (err) => {
      starting[key] = false;
      if (!ringing[key] || (err && err.name === 'AbortError')) return false;      // stopped or restarted meanwhile
      if (snd.file && !(err && err.name === 'NotAllowedError')) return startRinging(key, true);      // alarm.wav missing: use the beep instead
      blocked[key] = true; audioChanged(); return false;
    });
  }
  function fireAlarmSound(key) {
    stopAlarmSound(key);
    ringing[key] = Date.now() + ALARM_MAX_MS;
    soundTimeouts[key] = setTimeout(() => stopAlarmSound(key), ALARM_MAX_MS);
    startRinging(key);
  }
  function stopAlarmSound(key) {
    delete ringing[key]; delete blocked[key]; delete starting[key];
    const a = els[key]; if (a) { try { a.pause(); a.loop = false; } catch (e) {} }
    if (soundTimeouts[key]) { clearTimeout(soundTimeouts[key]); delete soundTimeouts[key]; }
    audioChanged();
  }
  function previewSound(id) {      // resolves true if you can hear it, false if the browser blocked it
    const s = SOUNDS.find(x => x.id === id) || currentSound();
    stopAlarmSound('preview'); previewId = s.id;
    ringing.preview = Date.now() + 3000; soundTimeouts.preview = setTimeout(() => stopAlarmSound('preview'), 3000);
    return startRinging('preview');
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
  const ivMs = (iv) => ((iv.minutes || 0) * 60 + (iv.seconds || 0)) * 1000;
  const ivName = (iv) => iv.label ? iv.label : `${iv.minutes}m${iv.seconds ? ' ' + iv.seconds + 's' : ''}`;
  function processTick() {
    const state = loadState();
    const now = Date.now();
    let mutated = false; const fired = {};

    state.timers.forEach(t => {
      if (t.status === 'running' && t.endAt !== null && now >= t.endAt) {
        t.status = 'finished'; t.remainingMs = 0; t.endAt = null; t.alarmUntil = now + ALARM_MAX_MS; fired.timer = true; mutated = true;
        announce('\u23F2 Timer finished', t.note || 'Your countdown has reached zero.', 'toolbox-timer-' + t.id, 'timer');
      }
    });
    state.alarms.forEach(a => {
      if (a.status === 'armed' && a.targetMs !== null && now >= a.targetMs) {
        a.status = 'firing'; a.alarmUntil = now + ALARM_MAX_MS; fired.alarm = true; mutated = true;
        announce('\u23F0 Alarm' + (a.timeStr ? ' ' + a.timeStr : ''), a.note || 'Your alarm is ringing.', 'toolbox-alarm-' + a.id, 'alarm');
      }
    });
    state.loops.forEach(l => {
      if (l.status === 'running' && l.endAt !== null && now >= l.endAt && l.intervals.length) {
        l.alarmUntil = now + ALARM_MAX_MS; fired.loop = true;
        l.currentIndex = (l.currentIndex + 1) % l.intervals.length;
        const iv = l.intervals[l.currentIndex], ms = ivMs(iv);
        l.remainingMs = ms; l.endAt = now + ms; mutated = true;
        announce('\uD83D\uDD01 Next interval', (l.note ? l.note + ' \u2013 ' : '') + (iv.label ? iv.label : ivName(iv) + ' starts now.'), 'toolbox-loop-' + l.id, 'loop');
      }
    });
    Object.keys(fired).forEach(fireAlarmSound);
    if (mutated) saveState(state);
    return state;
  }
  // The sound for each kind plays only while at least one item of that kind is still ringing.
  function settleSound(state) {
    [['timer', state.timers], ['alarm', state.alarms], ['loop', state.loops]].forEach(p => { if (ringing[p[0]] && !p[1].some(isRinging)) stopAlarmSound(p[0]); });
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
    const d = computeDerived(state), items = [];
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const short = (n) => n ? ' ' + (n.length > 18 ? n.slice(0, 17) + '\u2026' : n) : '';
    if (state.stopwatch.status === 'running' || state.stopwatch.status === 'paused') {
      items.push({ tab: 'stopwatch', icon: '\u23F1', text: `Stopwatch ${formatStopwatch(d.swElapsed)}${state.stopwatch.status === 'paused' ? ' (paused)' : ''}` });
    }
    state.timers.forEach(t => {
      if (t.status === 'finished') items.push({ tab: 'timer', icon: '\u23F2', text: 'Timer done!' + short(t.note), alert: true });
      else items.push({ tab: 'timer', icon: '\u23F2', text: `Timer${short(t.note)} ${formatCountdown(left(t))}${t.status === 'paused' ? ' (paused)' : ''}` });
    });
    state.alarms.forEach(a => {
      if (a.status === 'firing') items.push({ tab: 'alarm', icon: '\u23F0', text: 'Alarm!' + short(a.note), alert: true });
      else items.push({ tab: 'alarm', icon: '\u23F0', text: `Alarm ${a.timeStr}${short(a.note)}` });
    });
    state.loops.forEach(l => {
      const iv = l.intervals[l.currentIndex];
      items.push({ tab: 'loop', icon: '\uD83D\uDD01', text: `Loop${short(l.note)}${iv && iv.label ? ' \u2013 ' + iv.label : ''} ${formatCountdown(left(l))}${l.status === 'paused' ? ' (paused)' : ''}` });
    });
    const container = ensureWidgetContainer();
    if (items.length === 0) { container.innerHTML = ''; return; }
    const MAX = 6, shown = items.slice(0, MAX), extra = items.length - shown.length;
    container.innerHTML = shown.map(item => `
      <a href="${TIMERS_LINK}?tab=${item.tab}" style="
        display:flex;align-items:center;gap:0.5rem;
        background:${item.alert ? 'rgba(127,29,29,0.85)' : 'rgba(15,23,42,0.92)'};
        border:1px solid ${item.alert ? 'rgba(239,68,68,0.6)' : 'rgba(255,255,255,0.12)'};
        color:${item.alert ? '#fecaca' : '#e2e8f0'};
        padding:0.5rem 0.9rem;border-radius:9999px;font-size:0.8rem;font-weight:500;
        text-decoration:none;box-shadow:0 4px 16px rgba(0,0,0,0.4);backdrop-filter:blur(6px);
        font-family:ui-sans-serif,system-ui,sans-serif;white-space:nowrap;">
        <span>${item.icon}</span><span>${esc(item.text)}</span>
      </a>`).join('') + (extra > 0 ? `<a href="${TIMERS_LINK}" style="color:#94a3b8;font:500 0.75rem ui-sans-serif,system-ui,sans-serif;text-decoration:none;padding-right:0.4rem;">+${extra} more</a>` : '');
  }

  // ── Subscriptions + refresh loop ──────────────────────────────
  let subscribers = [];
  function refresh() {
    const state = processTick();
    settleSound(state);
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
  try { startTicker(); } catch (e) { console.error(e); }
  window.addEventListener('storage', (e) => { if (e.key === STORAGE_KEY) refresh(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  if (document.body) { try { refresh(); } catch (e) { console.error(e); } } else document.addEventListener('DOMContentLoaded', refresh);
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
    setVolume(v) { lsSet(VOL_KEY, String(Math.min(1, Math.max(0, +v || 0)))); },
    previewSound,
    stopPreview() { stopAlarmSound('preview'); },
    unlock,
    audioState,
    audioBlocked: anyBlocked,
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

    left,
    // Timers, alarms and loops are each a list. Every one has an optional reminder note (setNote) that you can edit or clear.
    setNote(kind, id, note) { mutate(s => { const it = arr(s[kind + 's']).find(x => x.id === id); if (it) it.note = cleanNote(note); }); },

    timerAdd(totalMs, note) {
      let id = null; if (!(totalMs > 0)) return null;
      mutate(s => { if (s.timers.length >= MAX_ITEMS) return; id = s.nextId++; s.timers.push({ id, note: cleanNote(note), status: 'running', totalMs, remainingMs: totalMs, endAt: Date.now() + totalMs, alarmUntil: null }); });
      return id;
    },
    timerPause(id) { mutate(s => { const t = s.timers.find(x => x.id === id); if (t && t.status === 'running') { t.remainingMs = Math.max(0, t.endAt - Date.now()); t.endAt = null; t.status = 'paused'; } }); },
    timerResume(id) { mutate(s => { const t = s.timers.find(x => x.id === id); if (t && t.status === 'paused' && t.remainingMs > 0) { t.endAt = Date.now() + t.remainingMs; t.status = 'running'; } }); },
    timerSilence(id) { mutate(s => { const t = s.timers.find(x => x.id === id); if (t) t.alarmUntil = null; }); },
    timerRemove(id) { mutate(s => { s.timers = s.timers.filter(x => x.id !== id); }); },

    alarmAdd(timeStr, repeatDaily, note) {
      let id = null; if (!/^\d{2}:\d{2}$/.test(timeStr || '')) return null;
      mutate(s => {
        if (s.alarms.length >= MAX_ITEMS) return;
        const [hh, mm] = timeStr.split(':').map(Number), now = new Date();
        const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0, 0);
        if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
        id = s.nextId++; s.alarms.push({ id, note: cleanNote(note), status: 'armed', timeStr, targetMs: target.getTime(), repeatDaily: !!repeatDaily, alarmUntil: null });
      });
      return id;
    },
    alarmSilence(id) { mutate(s => { const a = s.alarms.find(x => x.id === id); if (a) a.alarmUntil = null; }); },
    alarmDismiss(id) { mutate(s => {                       // done with a ringing alarm: a daily one re-arms for tomorrow, any other goes away
      const a = s.alarms.find(x => x.id === id); if (!a) return;
      if (a.repeatDaily) { a.status = 'armed'; a.targetMs = (a.targetMs || Date.now()) + 24 * 3600 * 1000; a.alarmUntil = null; }
      else s.alarms = s.alarms.filter(x => x.id !== id);
    }); },
    alarmRemove(id) { mutate(s => { s.alarms = s.alarms.filter(x => x.id !== id); }); },

    // The interval list on the Timer Loop tab is a draft; loopAdd starts a new loop from a copy of it.
    loopAddInterval() { mutate(s => { s.loopDraft.intervals.push({ id: s.loopDraft.nextIntervalId++, label: '', minutes: 10, seconds: 0 }); }); },
    loopRemoveInterval(id) { mutate(s => { s.loopDraft.intervals = s.loopDraft.intervals.filter(iv => iv.id !== id); }); },
    loopUpdateInterval(id, patch) { mutate(s => { const iv = s.loopDraft.intervals.find(i => i.id === id); if (iv) Object.assign(iv, patch); }); },
    loopSwap(a, b) { mutate(s => { const list = s.loopDraft.intervals; [list[a], list[b]] = [list[b], list[a]]; }); },
    loopReorder(srcId, targetId) { mutate(s => {
      const list = s.loopDraft.intervals, si = list.findIndex(i => i.id === srcId), ti = list.findIndex(i => i.id === targetId);
      if (si === -1 || ti === -1) return;
      const [moved] = list.splice(si, 1); list.splice(ti, 0, moved);
    }); },
    loopAdd(note) {
      let id = null;
      mutate(s => {
        const ivs = s.loopDraft.intervals.filter(iv => ivMs(iv) > 0).map((iv, i) => ({ id: i + 1, label: iv.label || '', minutes: iv.minutes || 0, seconds: iv.seconds || 0 }));
        if (!ivs.length || s.loops.length >= MAX_ITEMS) return;
        id = s.nextId++; const ms = ivMs(ivs[0]);
        s.loops.push({ id, note: cleanNote(note), status: 'running', intervals: ivs, currentIndex: 0, remainingMs: ms, endAt: Date.now() + ms, alarmUntil: null });
      });
      return id;
    },
    loopPause(id) { mutate(s => { const l = s.loops.find(x => x.id === id); if (l && l.status === 'running') { l.remainingMs = Math.max(0, l.endAt - Date.now()); l.endAt = null; l.status = 'paused'; } }); },
    loopResume(id) { mutate(s => { const l = s.loops.find(x => x.id === id); if (l && l.status === 'paused') { l.endAt = Date.now() + (l.remainingMs || 0); l.status = 'running'; } }); },
    loopSilence(id) { mutate(s => { const l = s.loops.find(x => x.id === id); if (l) l.alarmUntil = null; }); },
    loopRemove(id) { mutate(s => { s.loops = s.loops.filter(x => x.id !== id); }); }
  };
})();
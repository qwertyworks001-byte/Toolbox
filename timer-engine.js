// Toolbox — shared timer engine.
// Loaded on EVERY page (not just Timers) so a running stopwatch/timer/alarm/
// loop keeps ticking — and can still fire its alarm and advance — no matter
// which page happens to be open. State lives in localStorage; whichever tab
// is open when a countdown hits zero is the one that notices and acts on it.
//
// Known limitation: if you have the Toolbox open in more than one tab at
// once, more than one tab could notice a completion at nearly the same
// moment and both play the alarm sound (or, rarely, double-advance a loop).
// Harmless, just occasionally noisy — not worth the complexity of full
// cross-tab locking for a personal tool like this.

(function () {
  const STORAGE_KEY = 'toolbox:timers-state';
  const TICK_MS = 500;
  const ALARM_MAX_MS = 60000;

  // Resolve paths relative to however THIS script was included, so it works
  // the same whether a page is at the Toolbox root or one folder down.
  const scriptEl = document.currentScript;
  const scriptSrc = (scriptEl && scriptEl.getAttribute('src')) || 'timer-engine.js';
  const relPrefix = scriptSrc.startsWith('../') ? '../' : '';
  const ALARM_SRC = relPrefix + 'Timers/alarm.wav';
  const TIMERS_LINK = relPrefix + 'Timers/timers.html';
  const ON_TIMERS_PAGE = /\/Timers\/timers\.html$/.test(location.pathname);

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
    } catch (e) {
      return def;
    }
  }
  function saveState(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }

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

  // ── Per-tab alarm audio (each tab manages its own; not shared state) ──
  const activeAudio = {};
  const activeTimeouts = {};
  function fireAlarmSound(key) {
    stopAlarmSound(key);
    const audio = new Audio(ALARM_SRC);
    audio.loop = true;
    audio.play().catch((err) => console.warn('Alarm sound could not play (likely a browser autoplay restriction):', err));
    activeAudio[key] = audio;
    activeTimeouts[key] = setTimeout(() => stopAlarmSound(key), ALARM_MAX_MS);
  }
  function stopAlarmSound(key) {
    if (activeAudio[key]) { activeAudio[key].pause(); activeAudio[key].currentTime = 0; delete activeAudio[key]; }
    if (activeTimeouts[key]) { clearTimeout(activeTimeouts[key]); delete activeTimeouts[key]; }
  }

  // ── Completion detection (runs on every tick, on whichever tab is open) ──
  function processTick() {
    const state = loadState();
    const now = Date.now();
    let mutated = false;

    if (state.timer.status === 'running' && state.timer.endAt !== null && now >= state.timer.endAt) {
      state.timer.status = 'finished';
      state.timer.remainingMs = 0;
      state.timer.endAt = null;
      state.timer.alarmUntil = now + ALARM_MAX_MS;
      fireAlarmSound('timer');
      mutated = true;
    }

    if (state.alarm.status === 'armed' && state.alarm.targetMs !== null && now >= state.alarm.targetMs) {
      state.alarm.status = 'firing';
      state.alarm.alarmUntil = now + ALARM_MAX_MS;
      fireAlarmSound('alarm');
      mutated = true;
    }

    if (state.loop.status === 'running' && state.loop.endAt !== null && now >= state.loop.endAt && state.loop.intervals.length) {
      state.loop.alarmUntil = now + ALARM_MAX_MS;
      fireAlarmSound('loop');
      state.loop.currentIndex = (state.loop.currentIndex + 1) % state.loop.intervals.length;
      const iv = state.loop.intervals[state.loop.currentIndex];
      const ms = (iv.minutes * 60 + iv.seconds) * 1000;
      state.loop.remainingMs = ms;
      state.loop.endAt = now + ms;
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
    if (state.alarm.status === 'armed') {
      items.push({ tab: 'alarm', icon: '\u23F0', text: `Alarm ${state.alarm.timeStr}` });
    } else if (state.alarm.status === 'firing') {
      items.push({ tab: 'alarm', icon: '\u23F0', text: 'Alarm!', alert: true });
    }
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
    return state;
  }
  function mutate(fn) {
    const state = loadState();
    fn(state);
    saveState(state);
    return refresh();
  }

  setInterval(refresh, TICK_MS);
  window.addEventListener('storage', (e) => { if (e.key === STORAGE_KEY) refresh(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  if (document.body) refresh(); else document.addEventListener('DOMContentLoaded', refresh);

  // ── Public API ─────────────────────────────────────────────────
  window.ToolboxTimers = {
    getState: loadState,
    getDerived: computeDerived,
    formatStopwatch,
    formatCountdown,
    subscribe(fn) { subscribers.push(fn); return () => { subscribers = subscribers.filter(f => f !== fn); }; },

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
        s.timer.totalMs = totalMs;
        s.timer.remainingMs = totalMs;
        s.timer.endAt = Date.now() + totalMs;
      } else {
        return;
      }
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
      if (s.alarm.repeatDaily) {
        s.alarm.status = 'armed';
        s.alarm.targetMs = (s.alarm.targetMs || Date.now()) + 24 * 3600 * 1000;
      } else {
        s.alarm.status = 'idle';
        s.alarm.targetMs = null;
      }
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
        s.loop.remainingMs = ms;
        s.loop.endAt = Date.now() + ms;
      }
      s.loop.status = 'running';
    }); },
    loopPause() { mutate(s => { if (s.loop.status === 'running') { s.loop.remainingMs = Math.max(0, s.loop.endAt - Date.now()); s.loop.endAt = null; s.loop.status = 'paused'; } }); },
    loopReset() { stopAlarmSound('loop'); mutate(s => { s.loop.status = 'idle'; s.loop.currentIndex = 0; s.loop.remainingMs = 0; s.loop.endAt = null; s.loop.alarmUntil = null; }); },
    loopStopAlarm() { stopAlarmSound('loop'); mutate(s => { s.loop.alarmUntil = null; }); }
  };
})();
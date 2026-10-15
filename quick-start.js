// Toolbox quick start. Turns what you type in the homepage search ("30 second timer", "alarm for 7:30am", "stopwatch")
// into ready-made actions, the way searching for a timer on Google gives you one that is already set.
//   ToolboxQuick.parse(query, now)            -> null, or { kind: 'timer', seconds } | { kind: 'alarm', times: ['HH:MM', ...] } | { kind: 'stopwatch' }
//   ToolboxQuick.actions(parsed, now, is12h)  -> [{ id, label, sub }]     id is 'timer:30', 'alarm:13:30' or 'stopwatch'
// These are pure functions (they never touch the page), so they can be tested in Node.
(function (root) {
  'use strict';
  const MAX_SECONDS = 99 * 3600 + 59 * 60 + 59;      // the most the timer wheels can hold
  const FILLER = /\b(?:set|start|begin|run|create|make|add|new|an?|the|me|my|please|for|in|at|on|to|of|and|online|free|clock|up|go|i|want|need|can|you)\b/g;
  const strip = (s) => s.replace(FILLER, ' ').replace(/\s+/g, ' ').trim();
  const pad = (n) => (n < 10 ? '0' : '') + n;

  function norm(raw) {
    return String(raw == null ? '' : raw).toLowerCase().replace(/\b([ap])\.m\b\.?/g, '$1m').replace(/[,;!?]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // "30 seconds", "1h30m", "1.5 hours", "an hour", "half an hour", "2 hours and 15 min"
  const DUR = /(\d+(?:\.\d+)?|half an?|half|an?)\s*(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)(?![a-z])/g;
  function takeDurations(s) {
    let seconds = 0, count = 0, short = 0, rest = '', last = 0, end = 0, m;
    DUR.lastIndex = 0;
    while ((m = DUR.exec(s))) {
      const before = m.index ? s.charAt(m.index - 1) : ' ';
      if (m.index !== end && /[a-z0-9.]/.test(before)) continue;          // part of a longer word or number, not a duration
      const q = /^half/.test(m[1]) ? 0.5 : /^an?$/.test(m[1]) ? 1 : parseFloat(m[1]);
      const u = m[2].charAt(0);
      seconds += q * (u === 'h' ? 3600 : u === 'm' ? 60 : 1);
      if (m[2].length === 1) short++;
      rest += s.slice(last, m.index) + ' '; last = end = m.index + m[0].length; count++;
    }
    return { seconds, count, short, rest: rest + s.slice(last) };
  }

  function untilMinutes(h, m, now) {
    const t = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
    if (t.getTime() <= now.getTime()) t.setDate(t.getDate() + 1);
    return (t.getTime() - now.getTime()) / 60000;
  }

  // "7am", "6:45 pm", "13:30", "1330", "7" -> list of 24-hour 'HH:MM'. With no am/pm and an hour from 1 to 12 there are two
  // readings (AM and PM); they come back soonest first, so the first one is the next time that clock time will happen.
  function parseClock(s, now) {
    const m = strip(s).match(/^(\d{1,2})(?:[:. ]?(\d{2}))?\s?(am|pm)?$/);
    if (!m) return null;
    const hh = parseInt(m[1], 10), mm = m[2] ? parseInt(m[2], 10) : 0, ap = m[3];
    if (mm > 59) return null;
    let hours;
    if (ap) { if (hh < 1 || hh > 12) return null; hours = [hh % 12 + (ap === 'pm' ? 12 : 0)]; }
    else if (hh > 23) return null;
    else if (hh === 0 || hh >= 13 || (m[1].length === 2 && m[1].charAt(0) === '0')) hours = [hh];     // 13:30 and 07:30 are plainly 24-hour
    else hours = hh === 12 ? [0, 12] : [hh, hh + 12];
    hours.sort((a, b) => untilMinutes(a, mm, now) - untilMinutes(b, mm, now));
    return hours.map(h => pad(h) + ':' + pad(mm));
  }

  const mkTimer = (sec) => { sec = Math.round(sec); return sec >= 1 && sec <= MAX_SECONDS ? { kind: 'timer', seconds: sec } : null; };

  function parse(raw, now) {
    const s0 = norm(raw); if (!s0) return null;
    now = now || new Date();
    const hasStop = /\bstop ?watch\b/.test(s0), hasAlarm = /\b(?:alarm|wake)\b/.test(s0), hasTimer = /\b(?:timer|countdown|count down|remind|reminders?)\b/.test(s0);
    // the words that name the tool are not part of the value
    const s = s0.replace(/\b(?:stop ?watch|alarm|wake|timer|countdown|count down|reminders?|remind)\b/g, ' ').replace(/\s+/g, ' ').trim();

    if (hasStop) return !hasAlarm && !hasTimer && strip(s) === '' ? { kind: 'stopwatch' } : null;
    if (hasAlarm && hasTimer) return null;
    if (hasAlarm) { const times = parseClock(s, now); if (times) return { kind: 'alarm', times }; }

    const d = takeDurations(s);
    if (d.count) {
      if (strip(d.rest) !== '') return null;                              // "5 minutes of pushups" is not a timer request
      if (!hasTimer && !hasAlarm && d.short) return null;                 // a bare "5 m" or "10 s" is more likely metres or seconds of something else
      return mkTimer(d.seconds);
    }
    if (hasTimer) {
      const t = strip(s); let m;
      if ((m = t.match(/^(\d{1,3}):(\d{2})(?::(\d{2}))?$/))) {           // timer 1:30 = 1 min 30 sec;  timer 1:30:00 = 1 hour 30 min
        const a = +m[1], b = +m[2], c = m[3] === undefined ? null : +m[3];
        if (b > 59 || (c !== null && c > 59)) return null;
        return mkTimer(c === null ? a * 60 + b : a * 3600 + b * 60 + c);
      }
      if (/^\d+(?:\.\d+)?$/.test(t)) return mkTimer(parseFloat(t) * 60);   // "timer 5" = 5 minutes
    }
    return null;
  }

  function durLabel(sec) {
    const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60, p = [];
    if (h) p.push(h + ' hr'); if (m) p.push(m + ' min'); if (s) p.push(s + ' sec');
    return p.join(' ');
  }
  function clockLabel(hhmm, is12h) {
    const h = parseInt(hhmm.slice(0, 2), 10);
    return is12h === false ? hhmm : ((h % 12) || 12) + hhmm.slice(2) + ' ' + (h >= 12 ? 'PM' : 'AM');
  }
  function untilLabel(mins) {
    const t = Math.max(1, Math.round(mins)), h = Math.floor(t / 60), m = t % 60;
    return 'in about ' + (h ? h + 'h' + (m ? ' ' + m + 'm' : '') : m + 'm');
  }
  function actions(p, now, is12h) {
    now = now || new Date();
    if (!p) return [];
    if (p.kind === 'timer') return [{ id: 'timer:' + p.seconds, label: 'Start ' + durLabel(p.seconds) + ' timer', sub: '' }];
    if (p.kind === 'stopwatch') return [{ id: 'stopwatch', label: 'Start stopwatch', sub: '' }];
    if (p.kind === 'alarm') return p.times.map(t => ({ id: 'alarm:' + t, label: 'Set alarm for ' + clockLabel(t, is12h), sub: untilLabel(untilMinutes(parseInt(t.slice(0, 2), 10), parseInt(t.slice(3, 5), 10), now)) }));
    return [];
  }

  const api = { parse, actions };
  root.ToolboxQuick = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
/* Chapter 03 · 星球年历: every day of the year as a star that lights up in order.
   Demo data is generated from a fixed seed, so every visit shows the same year. */
(() => {
  'use strict';

  const YEAR = 2026;
  const TARGET_DAYS = 264;
  const STREAK_DAYS = 44;
  const STREAK_START = new Date(YEAR, 6, 12); // 7月12日
  const INTRO_DELAY_MS = 250;
  const INTRO_SPAN_MS = 1600; // All 365 days wake up within 1.6 s, in date order.

  const $ = id => document.getElementById(id);
  const app = $('app');
  const section = $('calendar');
  const yearEl = $('cal-year');
  const streakBtn = $('cal-streak');
  const nextBtn = $('calendar-next');
  const lines = [...section.querySelectorAll('.cal-line')];
  const side = section.querySelector('.cal-side');
  const orbit = section.querySelector('.cal-orbit');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  // ---------- Demo data ----------
  const DAY_MS = 864e5;
  const start = new Date(YEAR, 0, 1);
  const N = Math.round((new Date(YEAR + 1, 0, 1) - start) / DAY_MS);
  const dateOf = i => new Date(YEAR, 0, 1 + i);

  function buildYear() {
    let seed = 20261026;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const monthRate = [.78, .62, .8, .74, .66, .82, .7, .52, .8, .6, .76, .84];
    const act = Array.from({ length: N }, (_, i) => rnd() < monthRate[dateOf(i).getMonth()]);
    // Plant the streak, fenced by an off day on each side.
    const ss = Math.round((STREAK_START - start) / DAY_MS);
    for (let i = ss; i < ss + STREAK_DAYS; i++) act[i] = true;
    act[ss - 1] = false;
    act[ss + STREAK_DAYS] = false;
    const locked = i => i >= ss - 1 && i <= ss + STREAK_DAYS;
    const longest = () => { let best = 0, run = 0; for (const a of act) { run = a ? run + 1 : 0; best = Math.max(best, run); } return best; };
    // Nudge random days until the total matches, never creating a longer streak.
    let count = act.filter(Boolean).length;
    for (let guard = 0; count !== TARGET_DAYS && guard < 5000; guard++) {
      const i = Math.floor(rnd() * N);
      if (locked(i)) continue;
      if (count > TARGET_DAYS && act[i]) { act[i] = false; count--; }
      else if (count < TARGET_DAYS && !act[i]) {
        act[i] = true;
        if (longest() > STREAK_DAYS) act[i] = false; else count++;
      }
    }
    return { act, count };
  }

  const { act, count } = buildYear();
  // Every day's run, and the longest one, are derived from the data rather than hard-coded.
  let best = { s: 0, len: 0 };
  for (let i = 0; i < N;) {
    if (!act[i]) { i++; continue; }
    let j = i;
    while (j < N && act[j]) j++;
    const run = { s: i, len: j - i };
    if (run.len > best.len) best = run;
    i = j;
  }
  $('cal-days').textContent = count;
  streakBtn.textContent = best.len;
  streakBtn.setAttribute('aria-label', `最长连续登陆 ${best.len} 天，在日历中查看`);

  // ---------- Render the year (Monday-first weeks) ----------
  const months = [];
  const dots = [];
  for (let m = 0, idx = 0; m < 12; m++) {
    const month = document.createElement('div');
    month.className = 'cal-month';
    month.innerHTML = `<div class="cal-mlabel" aria-hidden="true">${m + 1}<small>月</small></div><div class="cal-days"></div>`;
    const days = month.querySelector('.cal-days');
    const lead = (new Date(YEAR, m, 1).getDay() + 6) % 7;
    for (let k = 0; k < lead; k++) {
      const blank = document.createElement('i');
      blank.className = 'cal-d blank';
      days.append(blank);
    }
    months.push({ el: month, startIdx: idx });
    const len = new Date(YEAR, m + 1, 0).getDate();
    for (let d = 1; d <= len; d++, idx++) {
      const dot = document.createElement('i');
      dot.className = 'cal-d ' + (act[idx] ? 'on' : 'off');
      dot.dataset.i = idx;
      dot.setAttribute('aria-hidden', 'true');
      days.append(dot);
      dots.push(dot);
    }
    yearEl.append(month);
  }

  // ---------- Intro: days light up in order, then the numbers appear ----------
  let timers = [];
  let playing = false;
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

  function setShown(shown) {
    months.forEach(m => m.el.classList.toggle('show', shown));
    dots.forEach(d => { d.classList.toggle('lit', shown); d.style.transitionDelay = ''; });
    lines.forEach(l => l.classList.toggle('show', shown));
    side.classList.toggle('show', shown);
    section.classList.toggle('done', shown);
  }
  function finishIntro() {
    clearTimers();
    playing = false;
    setShown(true);
  }
  function playIntro() {
    clearTimers();
    setStreak(false);
    setShown(false);
    if (reduced.matches) { requestAnimationFrame(finishIntro); return; }
    playing = true;
    void section.offsetWidth; // Commit the hidden state so the stagger is visible.
    at(INTRO_DELAY_MS, () => {
      dots.forEach((d, i) => {
        d.style.transitionDelay = Math.round(i / (N - 1) * INTRO_SPAN_MS) + 'ms';
        d.classList.add('lit');
      });
      months.forEach(m => at(Math.round(m.startIdx / (N - 1) * INTRO_SPAN_MS), () => m.el.classList.add('show')));
    });
    lines.forEach((l, k) => at(INTRO_DELAY_MS + INTRO_SPAN_MS - 250 + k * 180, () => l.classList.add('show')));
    at(INTRO_DELAY_MS + INTRO_SPAN_MS + 250, () => side.classList.add('show'));
    at(INTRO_DELAY_MS + INTRO_SPAN_MS + 600, finishIntro);
  }
  // Any interaction skips straight to the finished state.
  for (const type of ['pointerdown', 'keydown', 'wheel', 'touchstart']) {
    section.addEventListener(type, () => { if (playing) finishIntro(); }, { passive: true, capture: true });
  }

  // ---------- Optional streak emphasis; dates are display-only ----------
  let streakOn = false;
  function setStreak(on) {
    streakOn = on;
    streakBtn.setAttribute('aria-pressed', String(on));
    yearEl.classList.toggle('focus', on);
    for (let i = 0; i < N; i++) {
      const inRun = on && i >= best.s && i < best.s + best.len;
      dots[i].style.transitionDelay = inRun && !reduced.matches ? (i - best.s) * 22 + 'ms' : '0ms';
      dots[i].classList.toggle('hl', inRun);
    }
  }
  streakBtn.addEventListener('click', () => { if (playing) finishIntro(); setStreak(!streakOn); });

  // One-page gesture: ignore horizontal drags and taps, trigger once per swipe.
  let gesture = null;
  let lastNext = -Infinity;
  function nextPage() {
    if (!active || performance.now() - lastNext < 1200) return;
    lastNext = performance.now();
    app.dispatchEvent(new CustomEvent('calendar:next'));
  }
  nextBtn.addEventListener('click', nextPage);
  section.addEventListener('pointerdown', e => {
    if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    gesture = { id: e.pointerId, x: e.clientX, y: e.clientY };
  });
  section.addEventListener('pointerup', e => {
    if (!gesture || e.pointerId !== gesture.id) return;
    const dx = e.clientX - gesture.x, dy = e.clientY - gesture.y;
    gesture = null;
    if (dy < -45 && Math.abs(dy) > Math.abs(dx) * 1.3) nextPage();
  });
  section.addEventListener('pointercancel', () => { gesture = null; });

  // ---------- Background: faint twinkling stars, slanting dust, rare meteors ----------
  const canvas = $('cal-dust');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, stars = [], dust = [], meteor = null, nextMeteor = 0, rafId = 0, last = 0;
  let quiet = { x: 0, y: 0, w: 0, h: 0 }; // Keep the text and grid area calm.

  function newDust(anywhere) {
    const speed = .08 + Math.random() * .16;
    return {
      x: anywhere ? Math.random() * W : -10 - Math.random() * 60,
      y: anywhere ? Math.random() * H : Math.random() * H * .8,
      r: .3 + Math.random() * .6, a: .08 + Math.random() * .22,
      vx: speed, vy: speed * .42, warm: Math.random() < .3,
    };
  }
  function measureQuiet() {
    const s = section.getBoundingClientRect();
    const head = section.querySelector('.cal-head').getBoundingClientRect();
    const grid = yearEl.getBoundingClientRect();
    quiet = { x: grid.left - s.left - 10, y: head.top - s.top - 10, w: grid.width + 20, h: grid.bottom - head.top + 20 };
  }
  function resize() {
    if (section.hidden) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    measureQuiet();
    stars = Array.from({ length: 46 }, () => ({
      x: Math.random() * W, y: Math.random() * H, r: .35 + Math.random() * .5,
      a: .12 + Math.random() * .3, ph: Math.random() * 6.28, sp: .4 + Math.random() * .8,
    }));
    dust = Array.from({ length: 60 }, () => newDust(true));
    if (reduced.matches) draw(0, 0);
  }
  const inQuiet = (x, y) => x > quiet.x && x < quiet.x + quiet.w && y > quiet.y && y < quiet.y + quiet.h;
  function spawnMeteor(t) {
    const top = { y0: 20, y1: Math.max(40, quiet.y - 10) };
    const bottom = { y0: quiet.y + quiet.h + 10, y1: H - 30 };
    const zone = Math.random() < .55 ? top : bottom;
    if (zone.y1 - zone.y0 < 20) { nextMeteor = t + 4000; return; }
    meteor = { x: W * (.45 + Math.random() * .45), y: zone.y0 + Math.random() * (zone.y1 - zone.y0), len: 46 + Math.random() * 30, life: 0, dur: 1100 };
    nextMeteor = t + 6000 + Math.random() * 6000;
  }
  function draw(t, dt) {
    ctx.clearRect(0, 0, W, H);
    const still = reduced.matches;
    for (const s of stars) {
      let a = still ? s.a : s.a * (.65 + .35 * Math.sin(t / 1000 * s.sp + s.ph));
      if (inQuiet(s.x, s.y)) a *= .18;
      ctx.fillStyle = `rgba(244,239,249,${a})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.283); ctx.fill();
    }
    dust.forEach((d, i) => {
      if (!still) {
        d.x += d.vx * dt / 16;
        d.y += d.vy * dt / 16;
        if (d.x > W + 10 || d.y > H + 10) dust[i] = d = newDust(false);
      }
      const a = inQuiet(d.x, d.y) ? d.a * .2 : d.a;
      ctx.fillStyle = d.warm ? `rgba(255,228,174,${a})` : `rgba(195,185,212,${a})`;
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 6.283); ctx.fill();
    });
    if (still) return;
    if (!meteor && t > nextMeteor && section.classList.contains('done')) spawnMeteor(t);
    if (meteor) {
      meteor.life += dt;
      const k = meteor.life / meteor.dur;
      if (k >= 1) { meteor = null; return; }
      const dx = -Math.cos(.45), dy = Math.sin(.45);
      const hx = meteor.x + dx * k * 90, hy = meteor.y + dy * k * 90, fade = Math.sin(k * Math.PI);
      const g = ctx.createLinearGradient(hx, hy, hx - dx * meteor.len, hy - dy * meteor.len);
      g.addColorStop(0, `rgba(255,240,214,${.55 * fade})`);
      g.addColorStop(1, 'rgba(180,164,214,0)');
      ctx.strokeStyle = g; ctx.lineWidth = 1; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx - dx * meteor.len, hy - dy * meteor.len); ctx.stroke();
    }
  }
  function tick(t) {
    const dt = Math.min(50, t - last || 16);
    last = t;
    draw(t, dt);
    rafId = requestAnimationFrame(tick);
  }

  // ---------- Run only while chapter 03 is on screen ----------
  let active = false;
  function syncMotion() {
    const run = active && !document.hidden && !reduced.matches;
    cancelAnimationFrame(rafId);
    rafId = 0;
    if (run) { last = 0; rafId = requestAnimationFrame(tick); }
    if (run) orbit.unpauseAnimations?.(); else orbit.pauseAnimations?.();
    app.classList.toggle('calendar-paused', !run);
  }
  function enter() {
    active = true;
    resize();
    nextMeteor = performance.now() + 5000;
    playIntro();
    syncMotion();
  }
  function leave() {
    active = false;
    clearTimers();
    playing = false;
    syncMotion();
  }
  new MutationObserver(() => {
    const now = app.dataset.stage === 'calendar';
    if (now && !active) enter();
    else if (!now && active) leave();
  }).observe(app, { attributes: true, attributeFilter: ['data-stage'] });
  document.addEventListener('visibilitychange', syncMotion);
  reduced.addEventListener('change', () => { if (active) { finishIntro(); resize(); } syncMotion(); });
  new ResizeObserver(() => { if (active) resize(); }).observe(section);
  document.fonts?.ready.then(() => { if (active) measureQuiet(); });
})();

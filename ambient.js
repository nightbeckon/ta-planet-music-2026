(() => {
  'use strict';

  const app = document.querySelector('#app');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const isAmbientStage = () => ['loading', 'welcome'].includes(app.dataset.stage);

  // Orbit paths in the 390x844 artwork space; reused by the threads, stars and companions.
  const PATH = {
    loadingRing: 'M190 150 C155 176 230 202 320 201 S426 182 416 151 C402 123 294 101 236 128 S204 142 190 150',
    loadingRise: 'M157 535 C180 465 250 465 295 355 S332 235 345 205',
    welcomeRing: 'M75 405 C29 425 119 421 259 370 S390 292 354 289 C306 280 138 347 75 405',
    welcomeHigh: 'M49 274 C9 284 76 330 180 321 S351 264 364 286',
  };

  const ambient = document.createElement('div');
  ambient.className = 'ambient';
  ambient.setAttribute('aria-hidden', 'true');
  ambient.innerHTML = `<div class="ambient-glow"></div><div class="cloud-gleam"></div><div class="companion-light"></div>
    <div class="moving-clouds"><div class="cloud-bank far-left"></div><div class="right-clouds"><div class="cloud-bank far-right"></div><div class="cloud-bank near-right"></div></div><div class="cloud-bank middle-left-wisp"></div><div class="cloud-bank middle-left"></div><div class="cloud-bank welcome-left"></div><div class="cloud-bank near-left"></div></div>
    <svg viewBox="0 0 390 844" preserveAspectRatio="none" focusable="false">
     <defs>
      <radialGradient id="star-aura-soft"><stop stop-color="#fff8df" stop-opacity=".8"/><stop offset=".24" stop-color="#fff0bb" stop-opacity=".48"/><stop offset=".56" stop-color="#ffd797" stop-opacity=".18"/><stop offset="1" stop-color="#ffd797" stop-opacity="0"/></radialGradient>
      <mask id="welcome-castle-occlusion" maskUnits="userSpaceOnUse" x="0" y="0" width="390" height="844">
       <rect width="390" height="844" fill="white"/>
       <path fill="black" d="M124 359 124 344 128 340 128 332 133 328 134 317 138 315 138 310 145 303 151 307 151 323 159 323 159 318 164 318 164 310 168 307 170 312 174 312 174 303 177 300 178 291 181 288 183 283 186 280 191 283 191 247 201 241 211 246 211 285 215 286 215 280 220 277 224 281 224 290 228 293 228 255 242 248 254 254 254 290 258 293 259 300 262 295 266 301 266 314 274 316 274 306 279 302 287 308 287 325 291 327 294 318 299 323 299 336 305 337 307 344 310 344 310 359Z"/>
      </mask>
     </defs>
     <g class="loading-orbit">
      <path class="orbit-thread" d="${PATH.loadingRing}"/>
      <g class="orbit-star"><path d="M0-5 1.8-1.8 5 0 1.8 1.8 0 5-1.8 1.8-5 0-1.8-1.8Z"/><animateMotion dur="15s" repeatCount="indefinite" path="${PATH.loadingRing}"/></g>
      <g class="orbit-spark"><circle r="1.3"/><animateMotion dur="15s" begin="-1s" repeatCount="indefinite" path="${PATH.loadingRing}"/></g>
      <g class="orbit-spark" opacity=".75"><circle r="1.5"/><animateMotion dur="13s" begin="-5s" repeatCount="indefinite" path="${PATH.loadingRise}"/><animate attributeName="opacity" values="0;.8;.8;0" keyTimes="0;.15;.75;1" dur="13s" begin="-5s" repeatCount="indefinite"/></g>
     </g>
     <g class="welcome-orbit" transform="translate(0 28)" mask="url(#welcome-castle-occlusion)">
      <path class="orbit-thread second" d="${PATH.welcomeRing}"/>
      <path class="orbit-thread welcome-high-track" d="${PATH.welcomeHigh}"/>
      <g class="orbit-star"><path d="M0-4 1.5-1.5 4 0 1.5 1.5 0 4-1.5 1.5-4 0-1.5-1.5Z"/><animateMotion dur="18s" begin="-4s" repeatCount="indefinite" path="${PATH.welcomeRing}"/></g>
      <g class="orbit-spark"><circle r="1.4"/><animateMotion dur="18s" begin="-2s" repeatCount="indefinite" path="${PATH.welcomeRing}"/></g>
      <g class="orbit-spark"><circle r="1.7"/><animateMotion dur="14s" begin="-5s" repeatCount="indefinite" path="${PATH.welcomeHigh}"/><animate attributeName="opacity" values="0;.8;.8;0" keyTimes="0;.12;.85;1" dur="14s" begin="-5s" repeatCount="indefinite"/></g>
     </g>
    </svg><div class="shooting-star"></div><div class="shooting-star second"></div><div class="shooting-star third"></div><div class="shooting-star fourth"></div><div class="shooting-star fifth"></div>`;
  const svg = ambient.querySelector('svg');

  // Each ring uses its own world coordinates so companion stars follow the painted planet.
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const COMPANION_SCALES = [1.15, 0.66, 0.86, 0.48];
  const rings = [
    { group: '.loading-orbit', path: PATH.loadingRing, duration: 16 },
    { group: '.welcome-orbit', path: PATH.welcomeRing, duration: 19 },
  ];
  for (const ring of rings) {
    const group = ambient.querySelector(ring.group);
    COMPANION_SCALES.forEach((scale, i) => {
      const star = document.createElementNS(SVG_NS, 'g');
      star.setAttribute('class', 'orbit-star orbit-companion');
      star.style.setProperty('--aura-duration', `${4.2 + i * 0.65}s`);
      star.style.setProperty('--aura-delay', `${-i * 1.35}s`);
      star.innerHTML = `<g transform="scale(${scale})"><circle class="orbit-halo" r="20"/><path d="M0-7 2.3-2.5 7-1 3 2.4 4 7 0 4.5-4 7-3 2.4-7-1-2.3-2.5Z"/><path class="star-brush" d="M0-4-1 0 3-1-1 3"/></g><animateMotion dur="${ring.duration}s" begin="-${i * ring.duration / 4 + 2}s" repeatCount="indefinite" path="${ring.path}"/>`;
      group.append(star);
    });
  }

  // Soft light covers painted stars and smaller warm highlights; the illustration stays sharp.
  // Each entry: [x%, y%, size%, breathe duration s, delay s].
  const AURA_POINTS = {
    loading: [
    [85.4, 22.2, 24, 5.2, -1.8], [89.2, 6.2, 13, 6.1, -3.4], [20.3, 18.7, 15, 5.8, -4.1],
    [76.4, 36.1, 14, 6.4, -2.8], [37.6, 40.7, 13, 5.5, -0.7], [57.8, 47.6, 17, 6.8, -5.2],
    [47, 62.4, 12, 4.7, -2.1], [73.9, 24.3, 7, 5.6, -3], [86.8, 29.1, 8, 6, -1.4],
    [69.5, 33.5, 7, 5.9, -4.2], [10.4, 16.9, 8, 5.4, -2.3], [2.19, 30.87, 7.89, 5.33, -1.03],
    [43.6, 53.34, 2.4, 5.64, -1.76], [14.84, 40.29, 2.58, 5.95, -2.49],
    [49.04, 51.85, 5.41, 6.26, -3.22], [69.22, 43.91, 4.1, 6.57, -3.95],
    [9.07, 34.67, 2.4, 4.4, -4.68], [79.18, 40.73, 4.1, 4.71, -5.41],
    [69.87, 48.61, 3.81, 5.02, -6.14], [67.1, 39.8, 2.88, 5.33, -6.87],
    [63.77, 51.24, 2.4, 5.64, -0.6], [66.41, 45.02, 2.4, 5.95, -1.33],
    [81.29, 39.9, 2.67, 6.26, -2.06], [35.2, 53.64, 2.4, 6.57, -2.79],
    [83.41, 6.98, 2.4, 4.4, -3.52], [74.15, 53.49, 2.4, 4.71, -4.25],
    [34.22, 15.81, 2.4, 5.02, -4.98], [39.5, 39.86, 2.4, 5.33, -5.71],
    [80.64, 7.4, 2.4, 5.64, -6.44], [70.25, 42.47, 2.4, 5.95, -0.17],
    [85.24, 37.92, 2.84, 6.26, -0.9], [78.78, 53.77, 2.4, 6.57, -1.63],
    [45.55, 49.14, 2.4, 4.4, -2.36], [53.09, 50.11, 2.4, 4.71, -3.09],
    [58.01, 52.93, 2.4, 5.02, -3.82], [74.72, 45.5, 2.4, 5.33, -4.55],
    [77.38, 41.49, 2.4, 5.64, -5.28], [77.54, 8, 2.4, 5.95, -6.01],
    [6.09, 27.36, 2.4, 6.26, -6.74], [33.41, 53.72, 2.4, 6.57, -0.47],
    [47.18, 52.36, 2.4, 4.4, -1.2], [25.21, 17.81, 2.4, 4.71, -1.93],
    [18.51, 18.24, 2.4, 5.02, -2.66], [83.3, 40.09, 2.4, 5.33, -3.39],
    [98.19, 53.72, 2.4, 5.64, -4.12], [28.22, 17, 2.4, 5.95, -4.85],
    [75.4, 43.58, 2.4, 6.26, -5.58], [81.15, 37.27, 2.4, 6.57, -6.31],
    [65.46, 48.87, 2.4, 4.4, -0.04]
    ],
    welcome: [
    [10, 9.7, 15, 5.6, -2.2], [83.2, 4.7, 14, 6.2, -4.1], [22.3, 24.7, 18, 5.7, -1.8],
    [80, 22.5, 11, 6.3, -3.2], [70.6, 31.7, 12, 5.9, -4.8], [11.7, 34.6, 13, 6.5, -1.3],
    [85.5, 37.4, 19, 5.8, -3.9], [24, 43.2, 12, 6.1, -2.7], [18.6, 51.5, 15, 5.6, -4.4],
    [27.8, 54.8, 13, 6.3, -1.9], [82.6, 51.5, 13, 5.9, -3.5], [50, 80.5, 12, 5.2, -2.3],
    [33.6, 15.2, 4, 5.4, -1.4], [75.5, 11.2, 5, 6.2, -4.3], [28.8, 20.8, 4, 5.7, -2.5],
    [59.7, 21.7, 4, 6.1, -3.3], [6, 31.6, 8, 6.5, -4.5], [34.6, 35.8, 5, 5.6, -2.2],
    [70, 39.3, 8, 6.4, -1.9], [16, 47, 7, 5.7, -3.4], [76, 44.2, 5, 6.2, -4.8],
    [14, 49, 5, 5.6, -2.4]
    ],
  };
  const halos = document.createElement('div');
  halos.className = 'painted-star-halos';
  for (const [scene, points] of Object.entries(AURA_POINTS)) {
    for (const [x, y, size, duration, delay] of points) {
      const aura = document.createElement('i');
      aura.className = 'star-aura';
      aura.dataset.scene = scene;
      aura.style.cssText = `--x:${x}%;--y:${y}%;--size:${size}%;--aura-duration:${duration}s;--aura-delay:${delay}s`;
      halos.append(aura);
    }
  }
  ambient.insertBefore(halos, svg);
  document.querySelector('.scene').append(ambient);

  // Fade the drifting clouds in only once their artwork has decoded.
  const cloudImage = new Image();
  cloudImage.onload = async () => {
    try { await cloudImage.decode(); } catch { return; }
    ambient.classList.add('clouds-ready');
  };
  cloudImage.src = 'assets/cloud-bank.webp';

  // ---------- Tap sparkles ----------
  const touches = document.createElement('div');
  touches.className = 'touch-stars';
  touches.setAttribute('aria-hidden', 'true');
  app.append(touches);
  let lastTouch = 0;
  app.addEventListener('pointerup', event => {
    if (reduced.matches || document.hidden || !isAmbientStage()) return;
    if (event.target.closest('button,input,label,dialog,a')) return;
    const now = performance.now();
    if (now - lastTouch < 300) return;
    lastTouch = now;
    const rect = app.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width * 100;
    const y = (event.clientY - rect.top) / rect.height * 100;
    // Bounded, short-lived particles that never intercept the authorization controls.
    for (let i = 0; i < 7; i++) {
      const star = document.createElement('i');
      const angle = i / 7 * Math.PI * 2;
      star.className = 'touch-star' + (i === 0 ? ' featured' : '');
      star.style.cssText = `--x:${x}%;--y:${y}%;--dx:${Math.cos(angle) * (20 + i * 3)}px;--dy:${Math.sin(angle) * 25 - 22}px`;
      star.addEventListener('animationend', () => star.remove(), { once: true });
      setTimeout(() => star.remove(), 1400); // Fallback if the animation never runs.
      touches.append(star);
    }
  }, { passive: true });

  // ---------- Geometry & motion ----------
  // Match the cover geometry of the 720x1280 video poster at every viewport size.
  const world = document.querySelector('.world');
  function sizePosterEffects() {
    const scale = Math.max(app.clientWidth / 720, world.clientHeight / 1280);
    app.style.setProperty('--poster-width', `${720 * scale}px`);
    app.style.setProperty('--poster-height', `${1280 * scale}px`);
  }

  function syncMotion() {
    sizePosterEffects();
    const paused = document.hidden || reduced.matches || !isAmbientStage();
    app.classList.toggle('ambient-paused', paused);
    if (paused) {
      svg.pauseAnimations?.();
      touches.replaceChildren();
    } else {
      svg.unpauseAnimations?.();
    }
  }

  new ResizeObserver(sizePosterEffects).observe(app);
  new MutationObserver(syncMotion).observe(app, { attributes: true, attributeFilter: ['data-stage'] });
  document.addEventListener('visibilitychange', syncMotion);
  reduced.addEventListener('change', syncMotion);
  syncMotion();
})();

(() => {
  'use strict';

  const $ = selector => document.querySelector(selector);
  const app = $('#app');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const params = new URLSearchParams(location.search);
  // Former direct-preview links now follow the same complete journey.
  if (params.has('scene')) {
    params.delete('scene');
    const query = params.toString();
    history.replaceState(null, '', location.pathname + (query ? '?' + query : '') + location.hash);
  }

  // Cache every element the flow touches once, instead of re-querying on each frame/event.
  const el = {
    header: $('.site-header'),
    notice: $('#notice'),
    particles: $('#particles'),
    percent: $('#percent'),
    progress: $('#progress'),
    fill: $('#fill'),
    loadStatus: $('#load-status'),
    retry: $('#retry'),
    agree: $('#agree'),
    start: $('#start'),
    consentHint: $('#consent-hint'),
    privacy: $('#privacy'),
    privacyDialog: $('#privacy-dialog'),
    closePrivacy: $('#close-privacy'),
    readPrivacy: $('#read-privacy'),
    skip: $('#skip'),
    calendarScreen: $('#calendar'),
    music: $('#background-music'),
    sound: $('#sound'),
    soundLabel: $('#sound-label'),
  };
  const STAGES = ['loading', 'welcome', 'journey', 'calendar', 'wave'];
  const screens = Object.fromEntries(STAGES.map(id => [id, $('#' + id)]));

  const LOAD_DURATION_MS = 3800;   // Visual pace of the progress bar.
  const LOAD_CAP_BEFORE_READY = 90; // Bar waits here until every asset has decoded.
  const COMPLETE_HOLD_MS = 280;     // Keep 100% on screen briefly before the hand-off.
  const SLOW_NOTICE_MS = 6500;
  const DECODE_WAIT_MS = 1200;
  const NOTICE_MS = 4500;

  // Decode the loading illustration and the exact video poster before showing welcome.
  const PRELOAD_IMAGES = [
    'assets/loading-title-art.webp',
    'assets/loading-detail.webp',
    'assets/journey-poster.webp?v=20261026-act3-review1',
    'assets/start-ribbon.webp',
    'assets/consent-ribbon.webp',
    'assets/welcome-title-art.webp',
  ];

  let stage = 'loading';
  let progress = 0;
  let assetReady = false;
  let failed = false;
  let frameId = 0;
  let loadToken = 0;
  let lastPercent = -1;
  let progressClock = 0;
  let noticeTimer = 0;

  // ---------- Notice ----------
  function notice(message, sticky = false) {
    clearTimeout(noticeTimer);
    el.notice.textContent = message;
    el.notice.hidden = false;
    if (!sticky) noticeTimer = setTimeout(hideNotice, NOTICE_MS);
  }
  function hideNotice() {
    clearTimeout(noticeTimer);
    el.notice.hidden = true;
  }

  // ---------- Stage switching ----------
  function setStage(name) {
    stage = name;
    app.dataset.stage = name;
    app.dataset.page = name === 'loading' ? '1' : name === 'calendar' ? '3' : name === 'wave' ? '4' : '2';
    el.header.inert = name === 'journey';
    for (const id of STAGES) {
      const screen = screens[id];
      const active = id === name;
      // Welcome stays rendered under the film so the first frame lines up.
      screen.hidden = !active && !(name === 'journey' && id === 'welcome');
      screen.inert = !active;
      screen.setAttribute('aria-hidden', String(!active));
    }
    app.scrollTop = 0;
    app.scrollLeft = 0;
    if (name === 'welcome') journey.preload();
  }

  const journey = window.createJourneyVideo({
    app,
    video: $('#journey-video'),
    motion,
    onNotice: message => notice(message),
    onArrive: () => {
      if (stage !== 'journey') return;
      setStage('calendar');
      el.calendarScreen.focus({ preventScroll: true });
    },
  });

  // ---------- Background specks ----------
  const specks = document.createDocumentFragment();
  for (let i = 0; i < 24; i++) {
    const star = document.createElement('i');
    const size = (i % 3) + 1;
    star.style.cssText = `left:${(i * 37.7) % 100}%;top:${(i * 19.3) % 65}%;width:${size}px;height:${size}px;animation-delay:-${i * 0.31}s`;
    specks.append(star);
  }
  el.particles.append(specks);

  // ---------- Loading ----------
  function updateProgress(value) {
    progress = Math.min(100, value);
    const percent = Math.floor(progress);
    if (percent !== lastPercent) {
      lastPercent = percent;
      el.percent.textContent = percent;
      el.progress.setAttribute('aria-valuenow', percent);
      el.loadStatus.textContent =
        progress < 35 ? '拾起散落的旋律' :
        progress < 75 ? '让记忆一颗颗亮起' :
        progress < 100 ? '你的星球即将醒来' : '星光已就绪';
    }
    el.fill.style.width = progress + '%';
  }

  function loadImage(src, markResource) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      let handled = false;
      markResource(src, 'loading');
      const ready = () => {
        if (handled || !img.complete || !img.naturalWidth) return;
        handled = true;
        markResource(src, 'loaded');
        // A loaded image is usable. Some WebKit cache paths leave decode() pending,
        // so bound only that extra wait; network failures still reject normally.
        let decodeTimer;
        const decoded = typeof img.decode === 'function' ? img.decode() : Promise.resolve();
        Promise.race([
          decoded.catch(() => {}),
          new Promise(done => { decodeTimer = setTimeout(done, DECODE_WAIT_MS); }),
        ]).then(() => {
          clearTimeout(decodeTimer);
          markResource(src, 'ready');
          resolve();
        });
      };
      const fail = () => {
        if (handled) return;
        handled = true;
        markResource(src, 'error');
        reject(new Error(`Image could not load: ${src}`));
      };
      img.onload = ready;
      img.onerror = fail;
      img.src = src;
      if (img.complete) img.naturalWidth ? ready() : fail();
    });
  }

  function load() {
    cancelAnimationFrame(frameId);
    journey.reset();
    const token = ++loadToken;
    // Debug hooks: ?loading=50 freezes the bar, ?error forces a failure, ?slow delays readiness.
    const preview = params.has('loading')
      ? Math.max(0, Math.min(100, Number(params.get('loading')) || 0))
      : null;
    assetReady = false;
    failed = false;
    lastPercent = -1;
    updateProgress(preview ?? 0);
    el.retry.hidden = true;
    hideNotice();
    setStage('loading');

    const slowTimer = setTimeout(() => {
      if (token !== loadToken || assetReady) return;
      notice('星光来得有点慢，正在继续连接…', true);
      el.retry.hidden = false;
    }, SLOW_NOTICE_MS);

    const sources = PRELOAD_IMAGES.map(src =>
      params.has('error') && src.endsWith('journey-poster.webp') ? 'assets/missing-test.webp' : src);
    const resourceStates = {};
    const markResource = (src, state) => {
      resourceStates[src] = state;
      app.dataset.loadingResources = JSON.stringify(resourceStates);
    };

    Promise.all(sources.map(src => loadImage(src, markResource))).then(() => {
      if (token !== loadToken) return;
      setTimeout(() => {
        if (token !== loadToken) return;
        assetReady = true;
        clearTimeout(slowTimer);
        hideNotice();
        el.retry.hidden = true;
      }, params.has('slow') ? 8500 : 0);
    }).catch(() => {
      if (token !== loadToken) return;
      failed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(slowTimer);
      el.loadStatus.textContent = '星光暂时迷路了';
      el.retry.hidden = false;
      notice('插画未能加载，请检查网络后重新连接。', true);
    });

    if (preview !== null) return;
    progressClock = performance.now();
    let completionHold = 0;
    const tick = now => {
      if (token !== loadToken || failed) return;
      const delta = Math.max(0, now - progressClock);
      progressClock = now;
      if (!document.hidden) {
        // Paint 100% before handing off to welcome.
        if (progress >= 100 && assetReady) {
          completionHold += delta;
          if (completionHold >= COMPLETE_HOLD_MS) {
            setStage('welcome');
            return;
          }
        } else {
          const cap = assetReady ? 100 : LOAD_CAP_BEFORE_READY;
          updateProgress(Math.min(cap, progress + delta * 100 / LOAD_DURATION_MS));
        }
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
  }

  // ---------- Consent & navigation ----------
  function syncConsent() {
    const agreed = el.agree.checked;
    el.start.setAttribute('aria-disabled', String(!agreed));
    el.consentHint.classList.remove('error');
    el.consentHint.textContent = agreed ? '准备好了，就让星光带路吧' : '你的音乐记忆，只为你开启';
  }

  el.retry.addEventListener('click', () => { params.delete('error'); load(); });
  el.agree.addEventListener('change', syncConsent);
  el.privacy.addEventListener('click', () => el.privacyDialog.showModal());
  el.closePrivacy.addEventListener('click', () => el.privacyDialog.close());
  el.readPrivacy.addEventListener('click', () => el.privacyDialog.close());
  // A click whose target is the <dialog> itself but lands outside its box hit the backdrop.
  el.privacyDialog.addEventListener('click', event => {
    if (event.target !== el.privacyDialog) return;
    const r = el.privacyDialog.getBoundingClientRect();
    const inside = event.clientX >= r.left && event.clientX <= r.right &&
      event.clientY >= r.top && event.clientY <= r.bottom;
    if (!inside) el.privacyDialog.close();
  });

  el.start.addEventListener('click', () => {
    if (stage !== 'welcome') return;
    if (!el.agree.checked) {
      const message = '请先阅读数据使用说明，并勾选同意';
      el.consentHint.textContent = message;
      el.consentHint.classList.add('error');
      notice(message);
      el.agree.focus();
      return;
    }
    navigator.vibrate?.(12);
    hideNotice(); // Don't carry the consent reminder onto the film/calendar.
    setStage('journey');
    journey.start();
  });
  el.skip.addEventListener('click', () => { if (stage === 'journey') journey.skip(); });
  app.addEventListener('calendar:next', () => {
    if (stage !== 'calendar') return;
    hideNotice();
    setStage('wave');
    screens.wave.focus({ preventScroll: true });
  });
  app.addEventListener('ws:next', () => {
    if (stage === 'wave') notice('下一幕正在准备中，敬请期待。');
  });

  // ---------- Background music ----------
  // One persistent audio element spans loading, welcome, film and calendar.
  const { music, sound } = el;
  let musicWanted = true;
  let awaitingMusicGesture = false;
  let musicRequest = 0;
  let musicPlaying = false;
  music.volume = 0.65;

  function syncMusic({ playing = musicPlaying, busy = false } = {}) {
    musicPlaying = playing && !music.paused && !music.ended && !music.error && !document.hidden;
    const started = music.currentTime > 0;
    const label = musicPlaying || busy ? '暂停背景音乐《星光》' :
      started ? '继续播放背景音乐《星光》' : '播放背景音乐《星光》';
    sound.setAttribute('aria-pressed', String(musicPlaying));
    sound.setAttribute('aria-busy', String(busy));
    sound.setAttribute('aria-label', label);
    sound.title = label;
    el.soundLabel.textContent = busy ? '背景音乐正在缓冲' :
      musicPlaying ? '背景音乐正在循环播放' :
      started ? '背景音乐已暂停' : '背景音乐未播放';
  }

  function stopMusic() {
    ++musicRequest;
    music.pause();
    syncMusic({ playing: false });
  }

  async function playMusic({ automatic = false } = {}) {
    if (!musicWanted || document.hidden) return;
    const request = ++musicRequest;
    syncMusic({ playing: false, busy: true });
    try {
      if (music.error) music.load();
      // Keep play() inside the click gesture; neither pause nor replay resets currentTime.
      await music.play();
      awaitingMusicGesture = false;
      if (request !== musicRequest) return;
      if (!musicWanted || document.hidden) { music.pause(); return; }
      syncMusic({ playing: !music.paused && music.readyState >= 3, busy: music.readyState < 3 });
    } catch (error) {
      if (request !== musicRequest || !musicWanted) return;
      if (error.name === 'NotAllowedError') {
        awaitingMusicGesture = true;
        syncMusic({ playing: false });
        if (!automatic) notice('轻触页面即可开启音乐。');
        return;
      }
      musicWanted = false;
      syncMusic({ playing: false });
      notice('音乐暂未播放，请再点一次音乐开关。');
    }
  }

  // Retry blocked autoplay in a trusted gesture, without overriding an explicit pause.
  function unlockMusic(event) {
    if (!awaitingMusicGesture || !musicWanted || event.target.closest?.('#sound')) return;
    if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
    playMusic({ automatic: true });
  }
  document.addEventListener('click', unlockMusic);
  document.addEventListener('keydown', unlockMusic);

  sound.addEventListener('click', () => {
    const busy = sound.getAttribute('aria-busy') === 'true';
    if (musicWanted && (!music.paused || busy)) {
      musicWanted = false;
      awaitingMusicGesture = false;
      stopMusic();
    } else {
      musicWanted = true;
      playMusic();
    }
  });
  music.addEventListener('playing', () => {
    if (!musicWanted || document.hidden) { music.pause(); return; }
    syncMusic({ playing: true });
  });
  music.addEventListener('pause', () => syncMusic({ playing: false }));
  music.addEventListener('waiting', () => syncMusic({ playing: false, busy: musicWanted && !document.hidden }));
  music.addEventListener('ended', () => syncMusic({ playing: false }));
  music.addEventListener('error', () => {
    musicWanted = false;
    ++musicRequest;
    syncMusic({ playing: false });
    notice('音乐加载失败，请检查网络后重新开启。');
  });

  // ---------- Page lifecycle ----------
  document.addEventListener('visibilitychange', () => {
    progressClock = performance.now();
    app.classList.toggle('sound-suspended', document.hidden);
    if (document.hidden) stopMusic();
    else if (musicWanted) playMusic({ automatic: true });
  });
  window.addEventListener('pagehide', stopMusic);
  window.addEventListener('pageshow', () => { if (musicWanted && !document.hidden) playMusic({ automatic: true }); });
  window.addEventListener('offline', () => notice('网络已断开；已加载的星光旅程仍可继续。', true));
  window.addEventListener('online', () => {
    notice('连接已恢复，星光继续陪你');
    if (failed) load();
  });

  syncMusic({ playing: false });
  playMusic({ automatic: true });
  load();
})();

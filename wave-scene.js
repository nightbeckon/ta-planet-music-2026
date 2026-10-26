/* =====================================================================
   他TA星球 · 月度听歌「星河海浪」幕
   用法：
     const scene = WaveScene.create(document.querySelector('#scene-wave'), {
       data: [...12 个月],          // { month, minutes, artist, avatar }
       assetsBase: 'assets/',      // 素材目录
       onNext: () => {...},        // 上滑切换下一幕
     });
     scene.replay(); scene.pause(); scene.resume(); scene.destroy();
   ===================================================================== */
(function (global) {
  'use strict';

  const DEFAULTS = {
    data: [],
    assetsBase: 'assets/',
    title: '2026 月度听歌',
    subtitle: '*根据每个月份的听歌时长',
    tagline: '有TA的陪伴 你的生活自带完美BGM',
    hintText: '上滑查看下一幕',
    onNext: null,
    // 动画
    stagger: 140, duration: 1000, startDelay: 250,
    surfAmp: 36,        // 冲刷幅度（以 390 宽为基准，会按屏宽缩放）
    surfPeriod: 6.4,    // 一次涨落的周期 s
    surfTravel: 0.18,   // 浪从上往下扫过的相位差 s
    hitStrength: .8,    // 头像被拍打力度
    sparks: 5,
    foamWidth: 30,
    waterFlow: 0.008,
    renderScale: 1.5,   // 画布最高像素倍率
    orbit: true,
    swipeThreshold: 50, // 上滑翻页的最小距离 px
  };

  /* ---------------- 工具 ---------------- */
  const easeOutBack = (t, s = 1.25) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
  const easeInOutSine = t => -(Math.cos(Math.PI * t) - 1) / 2;
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function starPath(r = 10, inner = .45, n = 5) {
    let d = '';
    for (let k = 0; k < n * 2; k++) {
      const a = -Math.PI / 2 + k * Math.PI / n, rr = k % 2 ? r * inner : r;
      d += (k ? 'L' : 'M') + (Math.cos(a) * rr).toFixed(2) + ' ' + (Math.sin(a) * rr).toFixed(2);
    }
    return d + 'Z';
  }
  const SPARKLE = 'M0 -10 C1.2 -1.2 1.2 -1.2 10 0 C1.2 1.2 1.2 1.2 0 10 C-1.2 1.2 -1.2 1.2 -10 0 C-1.2 -1.2 -1.2 -1.2 0 -10Z';
  const icon = (d, fill) => `<svg viewBox="-11 -11 22 22" aria-hidden="true"><path d="${d}" fill="${fill}"/></svg>`;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const SURGE_PEAK = 0.42;
  function surgeShape(ph) {
    if (ph < SURGE_PEAK) return easeInOutSine(ph / SURGE_PEAK);
    return 1 - easeInOutSine((ph - SURGE_PEAK) / (1 - SURGE_PEAK));
  }
  function avatarStyle(d) {
    if (d.avatar) return `background-image:url("${encodeURI(d.avatar)}")`;
    const PAL = [['#b9c9f7', '#6f8fd8'], ['#d6c6f5', '#9a84d8'], ['#f7d2e3', '#de8db3'], ['#fbe0cc', '#e3a07f'], ['#c3e3f4', '#6fa9d6']];
    const h = [...d.artist].reduce((a, c) => a + c.charCodeAt(0), 0);
    const [a, b] = PAL[h % PAL.length];
    return `background:linear-gradient(135deg,${a},${b})`;
  }

  /* ---------------- 着色器 ---------------- */
  const VS = `#version 300 es
in vec2 a; void main(){ gl_Position = vec4(a, 0., 1.); }`;
const FS = `#version 300 es
precision highp float;
uniform sampler2D uSky, uWater, uPaper, uEdge;
uniform vec2  uRes;        // CSS 像素
uniform float uScale, uTime, uBand, uReveal, uFlow;
uniform vec4  uSkyRect;    // 天空图 cover 后的 x,y,w,h
uniform vec3  uRows;       // 首行 y, 行距, 行数
uniform vec2  uEdgeY;      // 边缘贴图覆盖的 y 起点与跨度
out vec4 o;

float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 3; i++){ v += a * vnoise(p); p = p * 2.07 + 17.3; a *= .5; } return v; }

void main(){
  vec2 p = vec2(gl_FragCoord.x, uRes.y * uScale - gl_FragCoord.y) / uScale;
  float ev = clamp((p.y - uEdgeY.x) / uEdgeY.y, 0., 1.);
  vec4 E = texture(uEdge, vec2(ev, .5));            // r=浪尖  g=回卷细浪  b=最远湿痕
  float front = E.r, back = E.g, wet = E.b;

  // 边缘加噪：让岸线像笔刷涂出来的，不是几何曲线
  float n1 = fbm(vec2(p.x * .05, p.y * .02 - uTime * .1));
  float d = p.x - front + (n1 - .5) * 8.;

  // 岸上远离浪的区域直接透明，节省计算
  if (d > 6. && p.x > wet + 6.) { o = vec4(0.); return; }

  vec3 sky = texture(uSky, (p - uSkyRect.xy) / uSkyRect.zw).rgb;
  float paper = texture(uPaper, p / 360.).r;

  // —— 岸上：浪退后留下的湿痕（淡粉奶油光） ——
  if (d >= 0.) {
    float w = smoothstep(wet + 4., wet - 26., p.x);
    float line = exp(-pow((p.x - wet) / 1.6, 2.)) * .35;
    float a = clamp(w * .32 + line, 0., 1.) * uReveal;
    vec3 c = vec3(1., .93, .96);
    float crestOut = exp(-pow(d / 2.2, 2.)) * uReveal;   // 浪尖向岸上的柔光
    a = max(a, crestOut * .85);
    c = mix(c, vec3(1., .99, .95), crestOut);
    o = vec4(c * a, a);
    return;
  }

  // —— 星河：手绘纹理 + 流动扭曲 ——
  vec2 wuv = p / 520. + vec2(uTime * uFlow, sin(uTime * .25) * .02);
  wuv += (vec2(fbm(p * .012 + uTime * .03), fbm(p * .012 - uTime * .025 + 5.)) - .5) * .04;
  vec3 water = texture(uWater, wuv).rgb;
  water = mix(water, vec3(.10, .19, .50), .24);
  water *= 1. - .32 * smoothstep(20., 260., -d);           // 越往深处越暗

  // 近岸浅水：半透明，透出岸上的天空颜色
  float sh = smoothstep(-40., 0., d);
  vec3 col = mix(water, sky * vec3(.9, .95, 1.08) + vec3(.03, .04, .08), sh * .55);
  col = mix(col, vec3(.88, .91, 1.), sh * sh * .22);

  // 月份刻度：极淡的水面光线
  float k = clamp(floor((p.y - uRows.x) / uRows.y + .5), 0., uRows.z - 1.);
  float dy = p.y - (uRows.x + k * uRows.y);
  float row = exp(-dy * dy / .5) * smoothstep(40., 70., p.x) * (1. - smoothstep(-90., -30., d));
  col += vec3(1., .96, .86) * row * .28;

  // —— 浪花：噪声阈值生成的泡沫，越靠浪尖越密 ——
  float fn  = fbm(vec2(p.x * .10, p.y * .032 - uTime * .26));
  float fn2 = vnoise(vec2(p.x * .32, p.y * .14 + uTime * .32));
  float band = smoothstep(-uBand, 0., d);
  float foam = smoothstep(.58, .74, fn * .7 + fn2 * .3 + band * .5 - .22) * band;
  vec3 foamC = mix(vec3(1., .97, .9), vec3(.99, .88, .94), fn2 * .7);
  col = mix(col, foamC, foam * .92 * uReveal);

  // 回卷细浪：海面一侧的断续花边
  float db = p.x - back + (fn - .5) * 6.;
  float lace = exp(-db * db / 3.) * smoothstep(.42, .62, fn2) * .55;
  col = mix(col, vec3(1., .96, .92), lace * uReveal);

  // 浪尖亮线
  float crest = exp(-pow((d + 1.2) / 1.8, 2.));
  col = mix(col, vec3(1., .99, .95), crest * .9 * uReveal);

  // 纸纹
  col *= mix(1., paper * 1.1, .3);
  float edgeA = 1. - smoothstep(-1.2, 0., d);
  float a = max(edgeA, crest * uReveal);
  o = vec4(col * a, a);
}`;

  const EDGE_N = 256;

  function create(root, options) {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const O = Object.assign({}, DEFAULTS, options || {});
    const DATA = O.data;
    if (!DATA || DATA.length < 2) throw new Error('WaveScene: data 至少需要 2 个月');
    const N = DATA.length;
    const base = O.assetsBase.replace(/\/?$/, '/');
    const ASSET = {
      sky: base + 'sky.webp', water: base + 'water.webp', paper: base + 'paper.webp',
      clouds: [base + 'cloud1.webp', base + 'cloud2.webp', base + 'cloud3.webp'],
    };
    const COUNT = {};
    DATA.forEach(d => COUNT[d.artist] = (COUNT[d.artist] || 0) + 1);
    const [TOP, TOP_N] = Object.entries(COUNT).sort((a, b) => b[1] - a[1])[0];

    /* ---------- DOM ---------- */
    root.classList.add('ws');
    root.style.backgroundImage = `url("${ASSET.sky}")`;
    root.innerHTML = `
      <div class="ws-deco ws-clouds" data-r="cloudsBack"></div>
      <canvas class="ws-sea" data-r="sea"></canvas>
      <svg class="ws-fx" data-r="fx" aria-hidden="true">
        <defs><filter id="ws-glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3"/></filter></defs>
        <g data-r="orbit" opacity="0">
          <path data-r="orbitGlow" fill="none" stroke="#ffe9a8" stroke-width="6" stroke-opacity=".45" filter="url(#ws-glow)" pathLength="1"/>
          <path data-r="orbitLine" fill="none" stroke="#fff6dc" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="1 5"/>
          <circle data-r="comet" r="3.4" fill="#fffaf0"/>
        </g>
      </svg>
      <div class="ws-deco ws-clouds is-front" data-r="cloudsFront"></div>
      <div class="ws-deco ws-stars" data-r="stars">
        <div class="ws-meteor" style="right:-20px;top:12%"></div>
        <div class="ws-meteor b" style="right:40px;top:22%"></div>
      </div>

      <header class="ws-head ws-shadow">
        <button class="ws-replay" type="button" aria-label="重播动画" data-r="replay">${icon(starPath(10, .48), '#fff4d6')}</button>
      </header>

      <section class="ws-core ws-shadow" data-r="core" aria-live="polite">
        <div class="ws-core-l1"><span class="ws-who">${esc(TOP)}</span>
          <span class="ws-core-text">是你<b>${TOP_N}</b>个月都爱听的歌手</span></div>
        <p class="ws-core-l2">${esc(O.tagline)}</p>
      </section>

      <section class="ws-chart" data-r="chart" aria-label="每月最爱歌手"></section>
      <div data-r="marks"></div>

      <button type="button" class="ws-hint" data-r="hint" aria-label="前往下一页">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 14l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span>${esc(O.hintText)}</span>
      </button>`;
    const R = {};
    root.querySelectorAll('[data-r]').forEach(el => R[el.dataset.r] = el);

    /* ---------- 状态 ---------- */
    let W = 0, H = 0, S = 1, rowY = [], targetX = [], baseX = 0, amp = O.surfAmp, av = 38;
    let labels = [], t0 = performance.now(), orbitBuilt = false, orbitLen = 1, skyRect = [0, 0, 1, 1];
    let raf = 0, running = false, visible = true, destroyed = false, coreTimer = 0;
    let gl = null, U = {}, edgeTex = null, edgeBuf = new Float32Array(EDGE_N * 4), texReady = false, skyImg = null;

    const surgePhase = (i, time, lag = 0) => {
      const ph = (time - i * O.surfTravel - lag) / O.surfPeriod;
      return ph - Math.floor(ph);
    };
    const rowAmp = i => amp * (0.82 + 0.18 * Math.sin(i * 2.3 + 1));

    /* ---------- WebGL ---------- */
    function loadImg(src) {
      return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
    }
    function makeTex(img, repeat) {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      const w = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, w);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, w);
    }
    async function initGL() {
      gl = R.sea.getContext('webgl2', { premultipliedAlpha: true, antialias: false, alpha: true });
      if (!gl) { console.warn('WaveScene: 当前浏览器不支持 WebGL2，星河仅显示背景'); return; }
      const sh = (type, src) => {
        const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      const prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog); gl.useProgram(prog);
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      ['uSky', 'uWater', 'uPaper', 'uEdge', 'uRes', 'uScale', 'uTime', 'uBand', 'uReveal', 'uFlow', 'uSkyRect', 'uRows', 'uEdgeY']
        .forEach(n => U[n] = gl.getUniformLocation(prog, n));
      edgeTex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, edgeTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, EDGE_N, 1, 0, gl.RGBA, gl.FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const [sky, water, paper] = await Promise.all([loadImg(ASSET.sky), loadImg(ASSET.water), loadImg(ASSET.paper)]);
      if (destroyed) return;
      skyImg = sky;
      gl.activeTexture(gl.TEXTURE0); makeTex(sky, false);
      gl.activeTexture(gl.TEXTURE1); makeTex(water, true);
      gl.activeTexture(gl.TEXTURE2); makeTex(paper, true);
      gl.uniform1i(U.uSky, 0); gl.uniform1i(U.uWater, 1); gl.uniform1i(U.uPaper, 2); gl.uniform1i(U.uEdge, 3);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      texReady = true;
      updateSkyRect();
      if (reduced.matches && running) requestAnimationFrame(frame);
    }
    function updateSkyRect() {
      if (!skyImg) return;
      const sc = Math.max(W / skyImg.naturalWidth, H / skyImg.naturalHeight);
      const w = skyImg.naturalWidth * sc, h = skyImg.naturalHeight * sc;
      skyRect = [(W - w) / 2, (H - h) / 2, w, h];
    }

    /* ---------- 布局：全部根据实际尺寸计算 ---------- */
    function buildMarks() {
      R.marks.innerHTML = '';
      const months = DATA.map(d => {
        const m = document.createElement('div');
        m.className = 'ws-month';
        m.innerHTML = icon(SPARKLE, '#fff4d6') + esc(d.month) + '月';
        R.marks.appendChild(m);
        return m;
      });
      labels = DATA.map(d => {
        const el = document.createElement('div');
        el.className = 'ws-label';
        const sparks = Array.from({ length: O.sparks }, () => `<span class="ws-spark">${icon(SPARKLE, '#fff4d6')}</span>`).join('');
        el.innerHTML = `<span class="ws-name">${esc(d.artist)}</span>
          <span class="ws-avatar-wrap"><span class="ws-ring"></span>
            <span class="ws-avatar" style='${avatarStyle(d)}'>${d.avatar ? '' : esc([...d.artist][0])}</span>
            ${d.artist === TOP ? `<span class="ws-badge">${icon(starPath(10, .48), '#ffe9a8')}</span>` : ''}
            ${sparks}</span>`;
        R.marks.appendChild(el);
        el._wrap = el.querySelector('.ws-avatar-wrap');
        el._ring = el.querySelector('.ws-ring');
        el._name = el.querySelector('.ws-name');
        el._sparks = [...el.querySelectorAll('.ws-spark')].map((s, k, arr) => ({
          el: s, ang: -1.25 + 2.5 * (k / Math.max(1, arr.length - 1)) + (Math.random() - .5) * .3,
          dist: 22 + Math.random() * 14, size: .55 + Math.random() * .5, spin: (Math.random() - .5) * 180,
        }));
        return el;
      });
      R._months = months;
    }

    function layout() {
      const rr = root.getBoundingClientRect();
      W = rr.width; H = rr.height;
      if (!W || !H) return;
      S = Math.min(global.devicePixelRatio || 1, O.renderScale);
      R.sea.width = Math.round(W * S); R.sea.height = Math.round(H * S);
      R.fx.setAttribute('viewBox', `0 0 ${W} ${H}`);
      updateSkyRect();

      // 图表区域（相对本幕）
      const cr = R.chart.getBoundingClientRect();
      const top = cr.top - rr.top, ch = cr.height;
      const slot = ch / N;                                  // 每个月可用的高度
      av = clamp(Math.round(slot * .8), 22, 38);            // 头像尺寸随空间自适应
      const nameFs = clamp(Math.round(av * .4), 12, 15);
      const monthFs = clamp(Math.round(slot * .3), 10, 12);
      root.style.setProperty('--ws-av', av + 'px');
      root.style.setProperty('--ws-name-fs', nameFs + 'px');
      root.style.setProperty('--ws-month-fs', monthFs + 'px');
      rowY = DATA.map((_, i) => top + slot * (i + .5));

      const padX = parseFloat(getComputedStyle(root).paddingLeft) || 16;
      const k = Math.min(1, W / 390);
      amp = O.surfAmp * k;
      baseX = W * 0.30;
      const avatarReach = av * .37 + av / 2;                 // 头像中心在浪线外侧的偏移 + 半径
      const maxX = W - padX - avatarReach - 8;
      const minX = W * 0.42;
      const maxM = Math.max(...DATA.map(d => d.minutes)), minM = Math.min(...DATA.map(d => d.minutes));
      targetX = DATA.map(d => minX + (maxX - minX) * ((d.minutes - minM) / (maxM - minM || 1)) ** 0.9);

      // 月份标签 & 名字宽度（只在布局时测量，避免每帧重排）
      R._months.forEach((m, i) => m.style.top = rowY[i] + 'px');
      const monthRight = padX + Math.max(...R._months.map(m => m.offsetWidth)) + 6;
      labels.forEach((el, i) => {
        el._name.style.maxWidth = '';
        let w = el.offsetWidth;
        const left = targetX[i] + av * .37 + av / 2 - w;
        if (left < monthRight) {                            // 极长歌手名：限制宽度，保证不压到月份
          el._name.style.maxWidth = Math.max(36, el._name.offsetWidth - (monthRight - left)) + 'px';
          el._name.style.overflow = 'hidden'; el._name.style.textOverflow = 'ellipsis';
          el.title = DATA[i].artist;
          w = el.offsetWidth;
        }
        el._w = w;
        el._h = el.offsetHeight;
      });

      buildClouds(); buildStars();
      orbitBuilt = false;
      if (reduced.matches && running) requestAnimationFrame(frame);
    }

    function buildClouds() {
      R.cloudsBack.innerHTML = ''; R.cloudsFront.innerHTML = '';
      const put = (bx, src, x, y, w, cls, op) => {
        const im = new Image(); im.src = src; im.alt = ''; im.className = cls; im.decoding = 'async';
        im.style.cssText = `left:${x}px;top:${y}px;width:${w}px;opacity:${op}`;
        bx.appendChild(im);
      };
      put(R.cloudsBack, ASSET.clouds[2], W * .46, H * .06, W * .62, 'ws-drift-a', .85);
      put(R.cloudsBack, ASSET.clouds[1], W * .52, H * .46, W * .66, 'ws-drift-b', .92);
      // 前景大云：顶部始终低于最后一行，避免白云压在文字下降低对比度
      const cw = W * 1.25, chh = cw * 588 / 1512;
      const lastBottom = rowY[N - 1] + av / 2 + 4;
      put(R.cloudsFront, ASSET.clouds[0], -W * .32, Math.max(lastBottom - chh * .06, H - chh * .9), cw, 'ws-drift-a', 1);
    }
    function buildStars() {
      R.stars.querySelectorAll('.ws-twinkle').forEach(n => n.remove());
      [[.74, .07, 14], [.92, .38, 12], [.88, .62, 10], [.62, .78, 9], [.40, .05, 8]].forEach(([x, y, s], k) => {
        const el = document.createElement('div');
        el.className = 'ws-twinkle';
        el.style.cssText = `left:${x * W}px;top:${y * H}px;--s:${s}px;--d:${2.4 + (k % 4) * .7}s;--dl:${-k * .53}s`;
        el.innerHTML = icon(SPARKLE, '#fff4d6');
        R.stars.appendChild(el);
      });
    }

    /* ---------- 岸线采样 ---------- */
    function controlPts(xs, offset) {
      const pts = [{ x: xs[0] + offset - 20, y: Math.min(-60, rowY[0] - 200) }];
      rowY.forEach((y, i) => pts.push({ x: xs[i] + offset, y }));
      pts.push({ x: baseX * .9 + offset, y: Math.max(H - 20, rowY[N - 1] + 60) });
      pts.push({ x: baseX * .75 + offset, y: H + 120 });
      return pts;
    }
    const tmp = [];
    function writeEdge(xs, offset, ch, y0, span) {
      const pts = controlPts(xs, offset);
      tmp.length = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
        const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
        const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
        for (let k = 0; k < 16; k++) {
          const t = k / 16, u = 1 - t;
          tmp.push(u * u * u * p1.x + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * p2.x,
                   u * u * u * p1.y + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * p2.y);
        }
      }
      tmp.push(pts[pts.length - 1].x, pts[pts.length - 1].y);
      let k = 0; const n = tmp.length / 2;
      for (let j = 0; j < EDGE_N; j++) {
        const y = y0 + span * j / (EDGE_N - 1);
        while (k < n - 2 && tmp[(k + 1) * 2 + 1] < y) k++;
        const xa = tmp[k * 2], ya = tmp[k * 2 + 1], xb = tmp[k * 2 + 2], yb = tmp[k * 2 + 3];
        const t = Math.max(0, Math.min(1, (y - ya) / ((yb - ya) || 1)));
        edgeBuf[j * 4 + ch] = xa + (xb - xa) * t;
      }
    }

    function buildOrbit() {
      const pts = [];
      DATA.forEach((d, i) => { if (d.artist === TOP) pts.push({ x: targetX[i] + av * .37 + av * .8, y: rowY[i] }); });
      if (pts.length < 2) return;
      pts.unshift({ x: pts[0].x + 26, y: pts[0].y - 40 });
      pts.push({ x: pts[pts.length - 1].x - 10, y: pts[pts.length - 1].y + 36 });
      let d = `M ${pts[0].x} ${pts[0].y}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
        d += ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6} ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6} ${p2.x} ${p2.y}`;
      }
      R.orbitGlow.setAttribute('d', d); R.orbitLine.setAttribute('d', d);
      orbitLen = R.orbitLine.getTotalLength();
      orbitBuilt = true;
    }

    /* ---------- 帧 ---------- */
    function frame(now) {
      if (!running) return;
      if (!reduced.matches) raf = requestAnimationFrame(frame);
      if (!W) return;
      const t = reduced.matches ? O.startDelay + N * O.stagger + O.duration + 2200 : now - t0;
      const time = reduced.matches ? 0 : now / 1000;
      const intro = DATA.map((_, i) => clamp01((t - O.startDelay - i * O.stagger) / O.duration));
      const anchor = DATA.map((_, i) => baseX + (targetX[i] - baseX) * easeOutBack(intro[i]));
      const edge = (lag, kk) => DATA.map((_, i) => {
        const on = easeOutCubic(intro[i]);
        const surf = (surgeShape(surgePhase(i, time, lag)) - 0.55) * rowAmp(i) * kk;
        return anchor[i] + (surf + Math.sin(time * .9 + i * 1.7) * 2 + Math.sin(time * .37 + i) * 3) * on;
      });

      if (texReady) {
        const y0 = -260, span = H + 400;
        writeEdge(edge(0, 1), 0, 0, y0, span);
        writeEdge(edge(.2, .85), -16, 1, y0, span);
        writeEdge(anchor.map((x, i) => x + rowAmp(i) * .45), 0, 2, y0, span);
        gl.viewport(0, 0, R.sea.width, R.sea.height);
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, edgeTex);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, EDGE_N, 1, gl.RGBA, gl.FLOAT, edgeBuf);
        gl.uniform2f(U.uRes, W, H); gl.uniform1f(U.uScale, R.sea.width / W);
        gl.uniform1f(U.uTime, time % 1000); gl.uniform1f(U.uBand, O.foamWidth * Math.min(1, W / 390));
        gl.uniform1f(U.uReveal, easeOutCubic(clamp01((t - O.startDelay) / 600)));
        gl.uniform1f(U.uFlow, O.waterFlow);
        gl.uniform4f(U.uSkyRect, skyRect[0], skyRect[1], skyRect[2], skyRect[3]);
        gl.uniform3f(U.uRows, rowY[0], rowY[1] - rowY[0], N);
        gl.uniform2f(U.uEdgeY, y0, span);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }

      for (let i = 0; i < N; i++) {
        const el = labels[i];
        const e = easeOutCubic(clamp01((t - O.startDelay - i * O.stagger - O.duration * 0.35) / 700));
        const left = anchor[i] + av * .37 + av / 2 - el._w + (1 - e) * 24;
        el.style.opacity = e;
        el.style.transform = `translate3d(${left.toFixed(1)}px,${(rowY[i] - el._h / 2).toFixed(1)}px,0)`;

        const dt = (surgePhase(i, time) - SURGE_PEAK * 0.88) * O.surfPeriod;
        const on = easeOutCubic(intro[i]) * O.hitStrength * (rowAmp(i) / amp);
        let tx = 0, ty = 0, rot = 0, sx = 1, sy = 1, sp = 0, life = 1;
        if (dt > 0) {
          const env = (1 - Math.exp(-dt * 6)) * Math.exp(-dt * 1.3);
          const osc = Math.sin(dt * 5.5) * env;
          tx = Math.sin(dt * 2.6) * Math.exp(-dt * 1.1) * 6 * on;
          ty = -Math.abs(osc) * 2.5 * on;
          rot = osc * 4.5 * on;
          sx = 1 + osc * .03 * on; sy = 1 - osc * .03 * on;
          sp = clamp01(1 - dt / 1.4) * on;
          life = clamp01(dt / 1.8);
        }
        el._wrap.style.transform = `translate3d(${tx.toFixed(2)}px,${ty.toFixed(2)}px,0) rotate(${rot.toFixed(2)}deg) scale(${sx.toFixed(3)},${sy.toFixed(3)})`;
        el._ring.style.opacity = (sp * .9).toFixed(3);
        el._ring.style.transform = `scale(${(1 + (1 - sp) * .5).toFixed(3)})`;
        const active = dt > 0 && life < 1 && on > 0;
        if (active || el._sparkOn) {
          const fly = easeInOutSine(life) * .6 + easeOutCubic(life) * .4;
          el._sparks.forEach(s => {
            const r = 18 + s.dist * fly;
            s.el.style.opacity = active ? (on * Math.sin(Math.PI * Math.min(1, life * 1.05))).toFixed(3) : 0;
            s.el.style.transform = `translate3d(${(Math.cos(s.ang) * r).toFixed(1)}px,${(Math.sin(s.ang) * r - fly * 6).toFixed(1)}px,0) rotate(${(s.spin * fly).toFixed(0)}deg) scale(${(s.size * (1 - life * .5)).toFixed(3)})`;
          });
          el._sparkOn = active;
        }
      }

      const introEnd = O.startDelay + N * O.stagger + O.duration;
      if (O.orbit) {
        if (t > introEnd && !orbitBuilt) buildOrbit();
        const o = clamp01((t - introEnd - 200) / 1600);
        R.orbit.setAttribute('opacity', o > 0 ? 1 : 0);
        if (orbitBuilt && o > 0) {
          const eo = easeOutCubic(o);
          R.orbitGlow.setAttribute('stroke-dasharray', `${eo} 1`);
          R.orbitLine.setAttribute('opacity', eo.toFixed(2));
          const u = o < 1 ? eo : ((t - introEnd - 1800) / 3600) % 1;
          const pt = R.orbitLine.getPointAtLength(Math.max(0, u) * orbitLen);
          R.comet.setAttribute('cx', pt.x); R.comet.setAttribute('cy', pt.y);
        }
      }
    }

    /* ---------- 控制 ---------- */
    function replay() {
      t0 = performance.now(); orbitBuilt = false;
      R.core.classList.remove('is-on');
      clearTimeout(coreTimer);
      if (reduced.matches) R.core.classList.add('is-on');
      else coreTimer = setTimeout(() => R.core.classList.add('is-on'), O.startDelay + N * O.stagger + O.duration + 300);
      if (reduced.matches && running) requestAnimationFrame(frame);
    }
    function resume() { if (running || destroyed || !visible || document.hidden) return; running = true; root.classList.remove('ws-paused'); raf = requestAnimationFrame(frame); }
    function pause() { root.classList.add('ws-paused'); running = false; cancelAnimationFrame(raf); }

    // 上滑 → 下一幕（不滚动当前幕）
    let sy0 = null, sx0 = 0, lastNext = 0;
    const next = () => { const n = performance.now(); if (n - lastNext < 700) return; lastNext = n; if (O.onNext) O.onNext(); root.dispatchEvent(new CustomEvent('ws:next', { bubbles: true })); };
    const onTS = e => { const p = e.touches[0]; sy0 = p.clientY; sx0 = p.clientX; };
    const onTM = e => { e.preventDefault(); };
    const onTE = e => {
      if (sy0 == null) return;
      const p = e.changedTouches[0], dy = p.clientY - sy0, dx = p.clientX - sx0;
      sy0 = null;
      if (dy < -O.swipeThreshold && Math.abs(dy) > Math.abs(dx)) next();
    };
    const onWheel = e => { e.preventDefault(); if (e.deltaY > 30) next(); };
    const onKey = e => { if (visible && !document.hidden && (e.key === 'ArrowDown' || e.key === 'PageDown')) next(); };
    root.addEventListener('touchstart', onTS, { passive: true });
    root.addEventListener('touchmove', onTM, { passive: false });
    root.addEventListener('touchend', onTE, { passive: true });
    root.addEventListener('wheel', onWheel, { passive: false });
    global.addEventListener('keydown', onKey);
    R.replay.addEventListener('click', replay);
    R.hint.addEventListener('click', next);
    const onVisibility = () => document.hidden ? pause() : resume();
    const onMotion = () => { pause(); replay(); resume(); };
    document.addEventListener('visibilitychange', onVisibility);
    reduced.addEventListener('change', onMotion);

    const ro = new ResizeObserver(() => layout());
    ro.observe(root);
    const io = new IntersectionObserver(es => {
      visible = es[0].isIntersecting;
      visible ? resume() : pause();
    }, { threshold: 0.01 });
    io.observe(root);

    buildMarks();
    layout();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => !destroyed && layout());
    initGL().catch(err => console.error('WaveScene: WebGL 初始化失败', err));
    replay();
    resume();

    return {
      replay, pause, resume,
      relayout: layout,
      destroy() {
        destroyed = true; pause(); ro.disconnect(); io.disconnect(); clearTimeout(coreTimer);
        root.removeEventListener('touchstart', onTS); root.removeEventListener('touchmove', onTM);
        root.removeEventListener('touchend', onTE); root.removeEventListener('wheel', onWheel);
        global.removeEventListener('keydown', onKey);
        document.removeEventListener('visibilitychange', onVisibility);
        reduced.removeEventListener('change', onMotion);
        if (gl) { const ext = gl.getExtension('WEBGL_lose_context'); ext && ext.loseContext(); }
        root.innerHTML = ''; root.classList.remove('ws');
      },
    };
  }

  global.WaveScene = { create };
})(window);

(() => {
  'use strict';
  const app = document.getElementById('app');
  let scene = null;
  function sync() {
    const active = app.dataset.stage === 'wave';
    if (active && !scene) scene = WaveScene.create(document.getElementById('scene-wave'), {
      assetsBase: 'assets/wave/', title: '2026 月度听歌', data: [
      { month: 1,  minutes: 1180, artist: '周深',    avatar: '' },
      { month: 2,  minutes: 960,  artist: '周深',    avatar: '' },
      { month: 3,  minutes: 1260, artist: '周深',    avatar: '' },
      { month: 4,  minutes: 1850, artist: '周深',    avatar: '' },
      { month: 5,  minutes: 900,  artist: '周深',    avatar: '' },
      { month: 6,  minutes: 640,  artist: '王赫野',  avatar: '' },
      { month: 7,  minutes: 700,  artist: '黄子弘凡', avatar: '' },
      { month: 8,  minutes: 560,  artist: '周深',    avatar: '' },
      { month: 9,  minutes: 620,  artist: '宋雨琦',  avatar: '' },
      { month: 10, minutes: 420,  artist: 'LBI利比', avatar: '' },
      { month: 11, minutes: 500,  artist: '周深',    avatar: '' },
      { month: 12, minutes: 690,  artist: '周深',    avatar: '' },
    ]
    });
    if (!scene) return;
    if (active && !document.hidden) { scene.relayout(); scene.resume(); }
    else scene.pause();
  }
  new MutationObserver(sync).observe(app, { attributes: true, attributeFilter: ['data-stage'] });
  document.addEventListener('visibilitychange', sync);
  sync();
})();

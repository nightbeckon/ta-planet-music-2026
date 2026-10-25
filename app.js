(() => {
 'use strict';
 const $ = s => document.querySelector(s), app=$('#app'), motion=matchMedia('(prefers-reduced-motion: reduce)');
 let stage='loading', progress=0, assetReady=false, failed=false, timer, loadToken=0, lastPercent=-1, progressClock=0;
 const demo=new URLSearchParams(location.search);
 const setStage=name=>{
  stage=name;app.dataset.stage=name;
  $('.site-header').inert=name==='journey';
  ['loading','welcome','journey','report'].forEach(id=>{
   const screen=$('#'+id),active=id===name;
   screen.hidden=!active&&!(name==='journey'&&id==='welcome');
   screen.inert=!active;screen.setAttribute('aria-hidden',String(!active));
  });
  app.scrollTop=0;app.scrollLeft=0;
  if(name==='welcome')journey.preload();
 };
 const journey=window.createJourneyVideo({app,video:$('#journey-video'),motion,onNotice:message=>notice(message),onArrive:()=>{
  if(stage!=='journey')return;
  setStage('report');$('#report-title').setAttribute('tabindex','-1');$('#report-title').focus({preventScroll:true});
  app.scrollTop=0;app.scrollLeft=0;
 }});
 function notice(message, sticky=false){$('#notice').textContent=message;$('#notice').hidden=false;if(!sticky)setTimeout(()=>$('#notice').hidden=true,4500)}
 for(let i=0;i<24;i++){const star=document.createElement('i');star.style.cssText=`left:${(i*37.7)%100}%;top:${(i*19.3)%65}%;width:${i%3+1}px;height:${i%3+1}px;animation-delay:-${i*.31}s`;$('#particles').append(star)}
 function updateProgress(value){
  progress=Math.min(100,value);
  const percent=Math.floor(progress);
  if(percent!==lastPercent){
   lastPercent=percent;$('#percent').textContent=percent;$('#progress').setAttribute('aria-valuenow',percent);
   $('#load-status').textContent=progress<35?'拾起散落的旋律':progress<75?'让记忆一颗颗亮起':progress<100?'你的星球即将醒来':'星光已就绪';
  }
  $('#fill').style.width=progress+'%';

 }
 function load(){
  cancelAnimationFrame(timer);journey.reset();
  const token=++loadToken;
  const preview=demo.has('loading')?Math.max(0,Math.min(100,Number(demo.get('loading'))||0)):null;
  assetReady=false;failed=false;lastPercent=-1;updateProgress(preview??0);
  $('#retry').hidden=true;$('#notice').hidden=true;setStage('loading');
  const timeout=setTimeout(()=>{if(token!==loadToken||assetReady)return;notice('星光来得有点慢，正在继续连接…',true);$('#retry').hidden=false},6500);
  // Decode the loading illustration and the exact video poster before showing welcome.
  const sources=['assets/loading-title-art.png','assets/loading-detail.webp',demo.has('error')?'assets/missing-test.webp':'assets/journey-poster.webp','assets/start-ribbon.png','assets/consent-ribbon.png','assets/welcome-title-art.png'];
  const resourceStates={};
  const markResource=(src,state)=>{resourceStates[src]=state;app.dataset.loadingResources=JSON.stringify(resourceStates)};
  const assets=sources.map(src=>new Promise((resolve,reject)=>{
   const img=new Image();let handled=false;
   markResource(src,'loading');
   const ready=()=>{
    if(handled||!img.complete||!img.naturalWidth)return;
    handled=true;markResource(src,'loaded');
    // A loaded image is usable. Some WebKit cache paths leave decode() pending.
    // Bound only that extra decode wait; network failures still reject normally.
    let decodeTimer;
    const decoded=typeof img.decode==='function'?img.decode():Promise.resolve();
    Promise.race([decoded.catch(()=>{}),new Promise(done=>{decodeTimer=setTimeout(done,1200)})]).then(()=>{
     clearTimeout(decodeTimer);markResource(src,'ready');resolve();
    });
   };
   img.onload=ready;
   img.onerror=()=>{if(handled)return;handled=true;markResource(src,'error');reject(new Error('Image could not load'))};
   img.src=src;
   if(img.complete){if(img.naturalWidth)ready();else img.onerror()}
  }));
  Promise.all(assets).then(()=>{
   if(token!==loadToken)return;
   setTimeout(()=>{if(token!==loadToken)return;assetReady=true;clearTimeout(timeout);$('#notice').hidden=true;$('#retry').hidden=true},demo.has('slow')?8500:0);
  }).catch(()=>{
   if(token!==loadToken)return;
   failed=true;cancelAnimationFrame(timer);clearTimeout(timeout);
   $('#load-status').textContent='星光暂时迷路了';$('#retry').hidden=false;
   notice('插画未能加载，请检查网络后重新连接。',true);
  });
  if(preview!==null)return;
  progressClock=performance.now();
  let completionHold=0;
  const tick=now=>{
   if(token!==loadToken||failed)return;
   const delta=Math.max(0,now-progressClock);progressClock=now;
   if(document.hidden){timer=requestAnimationFrame(tick);return}
   const rate=100/3800;
   // Paint 100% before handing off; old scene=welcome links follow this same path.
   if(progress>=100&&assetReady){
    completionHold+=delta;
    if(completionHold>=280){setStage('welcome');return}
   }else updateProgress(Math.min(assetReady?100:90,progress+delta*rate));
   timer=requestAnimationFrame(tick);
  };
  timer=requestAnimationFrame(tick);
 }
 $('#retry').onclick=()=>{demo.delete('error');load()};
 $('#agree').onchange=()=>{$('#start').setAttribute('aria-disabled',!$('#agree').checked);$('#consent-hint').classList.remove('error');$('#consent-hint').textContent=$('#agree').checked?'准备好了，就让星光带路吧':'你的音乐记忆，只为你开启'};
 $('#privacy').onclick=()=>$('#privacy-dialog').showModal();
 for(const id of ['close-privacy','read-privacy'])$('#'+id).onclick=()=>$('#privacy-dialog').close();
 $('#privacy-dialog').addEventListener('click',e=>{if(e.target===$('#privacy-dialog')){const r=e.target.getBoundingClientRect();if(e.clientY<r.top||e.clientY>r.bottom)e.target.close()}});
 $('#start').onclick=()=>{
  if(stage!=='welcome')return;
  if(!$('#agree').checked){$('#consent-hint').textContent='请先阅读数据使用说明，并勾选同意';$('#consent-hint').classList.add('error');notice('请先阅读数据使用说明，并勾选同意');$('#agree').focus();return}
  if(navigator.vibrate)navigator.vibrate(12);
  setStage('journey');journey.start();
 };
 $('#skip').onclick=()=>{if(stage==='journey')journey.skip()};
 $('#replay').onclick=()=>{journey.reset();$('#agree').checked=false;$('#agree').onchange();setStage('welcome');$('#start').focus({preventScroll:true})};
 // One persistent audio element spans Loading, welcome, film and report.
 const music=$('#background-music'), sound=$('#sound');
 let musicWanted=false, musicRequest=0, musicPlaying=false;
 music.volume=.65;
 function syncMusic({playing=musicPlaying,busy=false}={}){
  musicPlaying=playing&&!music.paused&&!music.ended&&!music.error&&!document.hidden;
  const label=musicPlaying||busy?'暂停背景音乐《星光》':
   music.currentTime>0?'继续播放背景音乐《星光》':'播放背景音乐《星光》';
  sound.setAttribute('aria-pressed',String(musicPlaying));
  sound.setAttribute('aria-busy',String(busy));
  sound.setAttribute('aria-label',label);sound.title=label;
  $('#sound-label').textContent=busy?'背景音乐正在缓冲':musicPlaying?'背景音乐正在循环播放':music.currentTime>0?'背景音乐已暂停':'背景音乐未播放';
 }
 async function playMusic(){
  if(!musicWanted||document.hidden)return;
  const request=++musicRequest;
  syncMusic({playing:false,busy:true});
  try{
   if(music.error)music.load();
   // Keep play() inside the click gesture; neither pause nor replay resets currentTime.
   await music.play();
   if(request!==musicRequest)return;
   if(!musicWanted||document.hidden){music.pause();return}
   syncMusic({playing:!music.paused&&music.readyState>=3,busy:music.readyState<3});
  }catch{
   if(request!==musicRequest||!musicWanted)return;
   musicWanted=false;syncMusic({playing:false});
   notice('音乐暂未播放，请再点一次音乐开关。');
  }
 }
 sound.onclick=()=>{
  if(musicWanted&&(!music.paused||sound.getAttribute('aria-busy')==='true')){
   musicWanted=false;++musicRequest;music.pause();syncMusic({playing:false});
  }else{musicWanted=true;playMusic()}
 };
 music.addEventListener('playing',()=>{
  if(!musicWanted||document.hidden){music.pause();return}
  syncMusic({playing:true});
 });
 music.addEventListener('pause',()=>syncMusic({playing:false}));
 music.addEventListener('waiting',()=>syncMusic({playing:false,busy:musicWanted&&!document.hidden}));
 music.addEventListener('ended',()=>syncMusic({playing:false}));
 music.addEventListener('error',()=>{
  ++musicRequest;musicWanted=false;syncMusic({playing:false});
  notice('音乐加载失败，请检查网络后重新开启。');
 });
 document.addEventListener('visibilitychange',()=>{
  progressClock=performance.now();
  app.classList.toggle('sound-suspended',document.hidden);
  if(document.hidden){++musicRequest;music.pause();syncMusic({playing:false})}
  else if(musicWanted)playMusic();
 });
 window.addEventListener('pagehide',()=>{++musicRequest;music.pause();syncMusic({playing:false})});
 window.addEventListener('pageshow',()=>{if(musicWanted&&!document.hidden)playMusic()});
 syncMusic({playing:false});
 window.addEventListener('offline',()=>notice('网络已断开；已加载的星光旅程仍可继续。',true));window.addEventListener('online',()=>{notice('连接已恢复，星光继续陪你');if(failed)load()});
 load();
})();

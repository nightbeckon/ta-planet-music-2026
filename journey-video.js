/* The cut is driven by displayed video time, not a wall-clock countdown. */
(() => {
 'use strict';
 window.createJourneyVideo = ({app, video, motion, onArrive, onNotice}) => {
  const CUT_TIME = 4.80;
  let active=false, closing=false, failed=false, sound=false, run=0;
  let frame=null, watchdog=null, finishTimer=null, revealTimer=null;
  let lastMedia=-1, lastAdvance=0;

  function stopTracking(){
   if(frame!==null){
    if(video.requestVideoFrameCallback)video.cancelVideoFrameCallback?.(frame);
    else cancelAnimationFrame(frame);
   }
   frame=null;clearInterval(watchdog);watchdog=null;
  }
  function reset(){
   run++;active=false;closing=false;stopTracking();
   clearTimeout(finishTimer);clearTimeout(revealTimer);
   video.pause();video.muted=true;
   try{video.currentTime=0}catch{}
   app.classList.remove('journey-has-frame','journey-cover-on','report-from-video','report-unveil');
   delete app.dataset.journeyMode;
   app.style.removeProperty('--handoff-cover-duration');
  }
  function finish({natural=false,message='',instant=false}={}){
   if(!active||closing)return;
   closing=true;stopTracking();video.pause();
   const token=run, duration=instant||motion.matches?0:natural?160:320;
   app.dataset.journeyMode=natural?'arriving':'fallback';
   app.style.setProperty('--handoff-cover-duration',duration+'ms');
   app.classList.add('journey-cover-on');
   if(message)onNotice(message);
   finishTimer=setTimeout(()=>{
    if(token!==run)return;
    active=false;app.classList.add('report-from-video');
    onArrive();
    // Keep the sampled cream cover in front until the report has painted.
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
     if(token!==run)return;
     app.style.setProperty('--handoff-cover-duration',motion.matches?'0ms':'380ms');
     app.classList.remove('journey-cover-on','journey-has-frame');
     revealTimer=setTimeout(()=>{if(token===run)app.classList.add('report-unveil')},motion.matches?0:140);
    }));
   },duration);
  }
  function showFrame(time){
   if(!active||closing)return;
   app.classList.add('journey-has-frame');app.dataset.journeyMode='playing';
   if(time>lastMedia+.001){lastMedia=time;lastAdvance=Date.now()}
   if(time>=CUT_TIME)finish({natural:true});
  }
  function track(token){
   if(!active||closing||token!==run)return;
   if(video.requestVideoFrameCallback){
    frame=video.requestVideoFrameCallback((_,metadata)=>{
     frame=null;if(token!==run)return;
     showFrame(metadata.mediaTime);track(token);
    });
   }else{
    frame=requestAnimationFrame(()=>{
     frame=null;if(token!==run)return;
     if(!video.paused&&video.readyState>=2)showFrame(video.currentTime);
     track(token);
    });
   }
  }
  function preload(){
   if(active||motion.matches)return;
   if(video.readyState>=2&&!video.error&&!failed)return;
   failed=false;video.preload='auto';video.load();
  }
  function start(){
   reset();active=true;lastMedia=-1;lastAdvance=Date.now();
   app.dataset.journeyMode='preparing';
   if(motion.matches){finish({instant:true});return}
   if(failed||video.error){finish({message:'动画暂未连接，星光将带你直接进入报告。'});return}
   const token=run;video.muted=!sound;
   // Call play synchronously from the authorization click to retain its gesture.
   try{
    const attempt=video.play();
    Promise.resolve(attempt).catch(()=>{
     if(token===run&&active&&!closing)finish({message:'当前浏览器暂未播放动画，已为你开启报告。'});
    });
   }catch{finish({message:'动画暂未播放，已为你开启报告。'});return}
   track(token);
   watchdog=setInterval(()=>{
    if(document.hidden||!active||closing)return;
    if(Date.now()-lastAdvance>(lastMedia<0?6500:5000)){
     finish({message:'星光连接有点慢，先带你进入年度报告。'});
    }
   },350);
  }
  video.addEventListener('error',()=>{
   failed=true;
   if(active&&!closing)finish({message:'动画加载中断，已为你开启报告。'});
  });
  video.addEventListener('ended',()=>finish({natural:video.currentTime>=CUT_TIME}));
  document.addEventListener('visibilitychange',()=>{
   if(!active||closing)return;
   if(document.hidden){video.pause();return}
   lastAdvance=Date.now();const token=run;
   try{Promise.resolve(video.play()).catch(()=>{
    if(token===run&&active&&!closing)finish({message:'已为你继续开启年度报告。'});
   })}catch{finish()}
  });
  motion.addEventListener('change',()=>{if(active&&motion.matches)finish({instant:true})});
  return {start,preload,reset,skip:()=>finish(),setSound:enabled=>{
   sound=enabled;video.muted=!enabled;
  }};
 };
})();

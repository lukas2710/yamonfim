(function () {
  'use strict';
  if (window.YamonTvPlayer) return;
  var stage, bar, drawer, timer, observerTimer, lastFocus, nativeAction, providerMode = false, signature = '';
  var root = document.documentElement;
  var originalFullscreen = Element.prototype.requestFullscreen;
  if (originalFullscreen) Element.prototype.requestFullscreen = function () {
    if (this.matches('.watch-screen')) return Promise.resolve();
    return originalFullscreen.apply(this, arguments);
  };
  function flag(name,value) { if(root.getAttribute(name)!==String(value)) root.setAttribute(name,String(value)); }
  function button(parent,label,action,key) {
    var item=document.createElement('button');item.type='button';item.textContent=label;
    if(key)item.setAttribute('data-player-action',key);
    item.addEventListener('click',action);parent.appendChild(item);return item;
  }
  function queue() { return stage && stage.querySelector('.watch-queue'); }
  function episodeItems() { var q=queue();return q?Array.from(q.querySelectorAll('.watch-queue-episode')):[]; }
  function adjacent(step) {
    var items=episodeItems(), index=items.findIndex(function(item){return item.getAttribute('aria-current')==='true';});
    return index<0?null:items[index+step] || null;
  }
  function changeEpisode(step) {
    var item=adjacent(step);
    if(item && !item.disabled){item.click();episodes(false);hide();}
    else episodes(true);
  }
  function hide() {
    clearTimeout(timer);if(root.getAttribute('data-tv-episodes')==='true')return;
    flag('data-tv-controls',false);if(bar&&bar.contains(document.activeElement))document.activeElement.blur();
  }
  function show() {
    if(!bar)return;providerMode=false;flag('data-tv-controls',true);clearTimeout(timer);timer=setTimeout(hide,9000);
    if(!bar.contains(document.activeElement)) {
      var preferred=bar.querySelector('[data-player-action="next"]:not(:disabled),[data-player-action="pause"],[data-player-action="pointer"]');
      (preferred || bar.querySelector('button')).focus({preventScroll:true});
    }
  }
  function updateButtons() {
    if(!bar)return;
    ['previous','next'].forEach(function(key,index){var item=bar.querySelector('[data-player-action="'+key+'"]'),source=adjacent(index?1:-1);if(item)item.disabled=!source||source.disabled;});
  }
  function season(step) {
    var select=queue()&&queue().querySelector('select');if(!select)return;
    var next=select.selectedIndex+step;if(next<0||next>=select.options.length)return;
    select.value=select.options[next].value;select.dispatchEvent(new Event('change',{bubbles:true}));
    signature='';setTimeout(function(){renderEpisodes();},100);
  }
  function renderEpisodes() {
    if(!drawer||drawer.hidden)return;
    var q=queue(),select=q&&q.querySelector('select'),items=episodeItems();
    var value=(select?select.value:'')+'|'+items.map(function(item){return item.textContent+item.disabled+item.getAttribute('aria-current');}).join('|');
    if(signature===value)return;signature=value;
    var focused=document.activeElement,focusKey=drawer.contains(focused)?focused.getAttribute('data-player-action'):null;
    drawer.replaceChildren();
    var header=document.createElement('div');header.className='ytv-episode-heading';drawer.appendChild(header);
    var title=document.createElement('h2');title.textContent='Épisodes';header.appendChild(title);
    button(header,'Retour à la vidéo',function(){episodes(false);hide();},'dismiss');
    if(select){
      var seasons=document.createElement('div');seasons.className='ytv-season-controls';drawer.appendChild(seasons);
      button(seasons,'← Saison',function(){season(-1);},'season-previous').disabled=select.selectedIndex<=0;
      var name=document.createElement('strong');name.textContent=select.options[select.selectedIndex].textContent;seasons.appendChild(name);
      button(seasons,'Saison →',function(){season(1);},'season-next').disabled=select.selectedIndex>=select.options.length-1;
    }
    var list=document.createElement('div');list.className='ytv-episode-list';drawer.appendChild(list);
    items.forEach(function(source,index){
      var current=source.getAttribute('aria-current')==='true';
      var title=source.querySelector('strong'),meta=source.querySelector('.watch-queue-meta');
      var label=(current?'▶ En cours · ':'')+(source.querySelector('.watch-queue-label')?source.querySelector('.watch-queue-label').textContent+' · ':'')+(title?title.textContent:source.textContent.trim())+(meta?' · '+meta.textContent:'');
      var item=button(list,label,function(){if(!source.disabled&&document.contains(source)){source.click();episodes(false);hide();}},'episode-'+index);
      item.disabled=source.disabled;if(current)item.setAttribute('aria-current','true');
    });
    var preferred=focusKey&&drawer.querySelector('[data-player-action="'+focusKey+'"]:not(:disabled)');
    (preferred||list.querySelector('button:not(:disabled)')||header.querySelector('button')).focus({preventScroll:true});
  }
  function episodes(open) {
    if(!drawer)return;flag('data-tv-episodes',open);clearTimeout(timer);drawer.hidden=!open;
    if(open){lastFocus=document.activeElement;signature='';renderEpisodes();}
    else{show();if(lastFocus&&document.contains(lastFocus)&&!lastFocus.disabled)lastFocus.focus({preventScroll:true});}
  }
  function sync() {
    var next=document.querySelector('.watch-stage');
    if(!next||!next.querySelector('.watch-screen')){
      clearTimeout(timer);if(bar)bar.remove();if(drawer)drawer.remove();bar=null;drawer=null;stage=null;
      flag('data-tv-playback',false);flag('data-tv-episodes',false);return;
    }
    if(stage===next&&bar&&next.contains(bar)){updateButtons();renderEpisodes();return;}
    stage=next;flag('data-tv-playback',true);flag('data-tv-episodes',false);
    drawer=document.createElement('section');drawer.id='yamon-tv-episodes';drawer.hidden=true;drawer.setAttribute('data-yamon-tv-owned','player');drawer.setAttribute('role','dialog');drawer.setAttribute('aria-modal','true');drawer.setAttribute('aria-label','Épisodes et saisons');stage.appendChild(drawer);
    bar=document.createElement('div');bar.id='yamon-tv-player-controls';bar.setAttribute('data-yamon-tv-owned','player');bar.setAttribute('aria-label','Commandes TV');
    var video=stage.querySelector('video');
    if(video){
      button(bar,'− 30 s',function(){video.currentTime=Math.max(0,video.currentTime-30);show();},'rewind');
      button(bar,'Lecture / Pause',function(){if(video.paused){var result=video.play();if(result)result.catch(function(){});}else video.pause();show();},'pause');
      button(bar,'+ 30 s',function(){if(isFinite(video.duration))video.currentTime=Math.min(video.duration,video.currentTime+30);show();},'forward');
    }else{
      button(bar,'Avancer / reculer',function(){var frame=stage.querySelector('iframe');if(!frame)return;var r=frame.getBoundingClientRect();nativeAction={type:'pointer',x:(r.left+r.width*.5)/innerWidth,y:(r.top+r.height*.9)/innerHeight};hide();},'pointer');
      button(bar,'Commandes du lecteur',function(){var frame=stage.querySelector('iframe');if(frame){hide();providerMode=true;frame.focus();}},'provider');
    }
    if(queue()){
      button(bar,'Épisode précédent',function(){changeEpisode(-1);},'previous');
      button(bar,'Épisode suivant',function(){changeEpisode(1);},'next');
      button(bar,'Épisodes et saisons',function(){episodes(true);},'episodes');
    }
    button(bar,'Fermer',function(){var close=stage.querySelector('button[aria-label="Fermer le lecteur"]');if(close)close.click();},'close');
    var hint=document.createElement('span');hint.textContent='OK / Haut : commandes · Bas : épisodes · Retour : masquer';bar.appendChild(hint);
    stage.appendChild(bar);updateButtons();show();
  }
  function back(){if(!stage)return false;if(drawer&&!drawer.hidden){episodes(false);return true;}if(root.getAttribute('data-tv-controls')==='true'){hide();return true;}show();return true;}
  function remote(action){
    if(!stage)return false;
    if(action==='menu'){if(drawer&&!drawer.hidden)return false;show();return true;}
    if(action==='up'){if(root.getAttribute('data-tv-controls')==='true'||(drawer&&!drawer.hidden))return false;show();return true;}
    if(action==='down'){if(root.getAttribute('data-tv-controls')==='true'||(drawer&&!drawer.hidden)||!queue())return false;episodes(true);return true;}
    if(action==='next'||action==='previous'){if(!queue())return false;changeEpisode(action==='next'?1:-1);return true;}
    return false;
  }
  document.addEventListener('keydown',function(event){var action=event.key==='ArrowUp'?'up':event.key==='ArrowDown'?'down':null;if(action&&remote(action)){event.preventDefault();event.stopImmediatePropagation();}},true);
  document.addEventListener('focusin',function(event){if(bar&&bar.contains(event.target)){clearTimeout(timer);timer=setTimeout(hide,9000);}});
  new MutationObserver(function(records){
    if(stage&&stage.isConnected&&records.every(function(record){return !stage.contains(record.target);}))return;
    if(records.every(function(record){return record.target.closest&&record.target.closest('[data-yamon-tv-owned]');}))return;
    clearTimeout(observerTimer);observerTimer=setTimeout(sync,100);
  }).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','aria-current']});
  window.YamonTvPlayer={isActive:function(){return !!stage;},sync:sync,back:back,show:show,remote:remote,takeNativeAction:function(){var action=nativeAction;nativeAction=null;return action;},activate:function(){if(providerMode && document.activeElement && document.activeElement.tagName==='IFRAME')return false;if(!stage||(drawer&&!drawer.hidden)||root.getAttribute('data-tv-controls')==='true')return false;show();return true;}};
  sync();
})();

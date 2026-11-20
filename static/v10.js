'use strict';
/* GAMEPICK V10 — additions to V9, no external dependencies and no hidden network keys. */
(() => {
  const $ = id => document.getElementById(id);
  const LIB_KEY='gamepick-v10-library';
  const ROULETTE_KEY='gamepick-v10-roulette';
  const DESIGN_KEY='gamepick-v10-design';
  const defaults={
    rules:['Без быстрого перемещения','Только оружие, найденное в игре','Не использовать подсказки и гайды','Играть на высокой сложности','Без перезагрузки после неудачи','Без дополнительных улучшений','Исследовать каждую новую локацию','Не пропускать диалоги'],
    challenges:['Играй 45 минут без остановки','Найди редкий предмет','Пройди первое задание без урона','Исследуй три необязательных места','Победи босса с первой попытки','Сыграй один эпизод без карты','Найди секретную комнату','Сделай лучший скриншот прохождения']
  };
  const statusNames={planned:'В планах',playing:'Играю',paused:'Отложено',abandoned:'Заброшено',complete:'Пройдено'};
  const read=(key,fallback={})=>{try{const value=JSON.parse(localStorage.getItem(key)||'null');return value&&typeof value==='object'&&!Array.isArray(value)?value:fallback}catch{return fallback}};
  const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch{toast('Не удалось сохранить: хранилище браузера заполнено.');return false}};
  const safeLine=(v,n=150)=>String(v||'').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,'').trim().slice(0,n);
  const safeList=v=>[...new Set((Array.isArray(v)?v:[]).map(x=>safeLine(x)).filter(Boolean))].slice(0,60);
  const parseLines=v=>safeList(String(v||'').split(/\r?\n/));
  const pick=list=>list[randomIndex(list.length)];
  const confRaw=read(ROULETTE_KEY);
  let opts={triple:Boolean(confRaw.triple),mystery:Boolean(confRaw.mystery),effects:Boolean(confRaw.effects),rules:safeList(confRaw.rules).length?safeList(confRaw.rules):[...defaults.rules],challenges:safeList(confRaw.challenges).length?safeList(confRaw.challenges):[...defaults.challenges]};
  const meta=read(LIB_KEY),designs=read(DESIGN_KEY);
  let round=null,editing=null,currentWidget='spin',votedToken='';
  const gameId=game=>favKey(game);
  function getMeta(game){
    const m=meta[gameId(game)]||{};
    let status=['planned','playing','paused','abandoned','complete'].includes(m.status)?m.status:'planned';
    if(hasPlayed(game))status='complete';else if(status==='complete')status='planned';
    return {status,rating:Number.isFinite(+m.rating)?Math.max(0,Math.min(5,Math.floor(+m.rating))):0,hours:Number.isFinite(+m.hours)?Math.min(9999,Math.max(0,+m.hours)):0,notes:safeLine(m.notes,1200)};
  }
  function saveOpts(){write(ROULETTE_KEY,opts)}
  function fillOptions(){
    $('gp10Triple').checked=opts.triple;$('gp10Mystery').checked=opts.mystery;$('gp10Effects').checked=opts.effects;
    $('gp10Rules').value=opts.rules.join('\n');$('gp10Challenges').value=opts.challenges.join('\n');
  }
  function beforeSpin(game,duration){
    const rule=opts.triple?pick(opts.rules):'',challenge=opts.triple?pick(opts.challenges):'';
    // Cosmetic events are independent of which game was chosen.
    const event=opts.effects&&randomIndex(100)<12?pick(['gold','glitch','starlight']):'';
    round={game:normalizeGame(game),triple:Boolean(opts.triple),mystery:Boolean(opts.mystery),rule,challenge,event,duration};
    $('gp10TripleResult').hidden=true;
    $('gp10EventLabel').hidden=true;
    document.body.classList.toggle('gp10-mystery-rolling',opts.mystery);
    document.body.classList.remove('gp10-event-gold','gp10-event-glitch','gp10-event-starlight');
  }
  function displayGames(games){
    if(!opts.mystery)return games;
    return games.map((g,i)=>({...g,name:'СЕКРЕТНЫЙ СЛОТ '+String(i+1).padStart(2,'0'),image:''}));
  }
  function afterSpin(game){
    document.body.classList.remove('gp10-mystery-rolling');
    const panel=$('gp10TripleResult'),label=$('gp10EventLabel');
    if(!round){panel.hidden=true;return}
    panel.hidden=!(round.triple||round.event);
    $('gp10RuleValue').textContent=round.rule||'Без дополнительного правила';
    $('gp10ChallengeValue').textContent=round.challenge||'Без дополнительного испытания';
    panel.querySelector('.gp10-triple-grid').hidden=!round.triple;
    const events={gold:'✦ ЗОЛОТОЕ ВЫПАДЕНИЕ',glitch:'⌁ ГЛИТЧ-СИГНАЛ',starlight:'✧ ЗВЁЗДНЫЙ МОМЕНТ'};
    if(round.event){label.textContent=events[round.event];label.hidden=false;
      document.body.classList.add('gp10-event-'+round.event);
      setTimeout(()=>document.body.classList.remove('gp10-event-'+round.event),4200);
    }else label.hidden=true;
  }
  function streamExtra(event){
    return {
      round:{triple:round?.triple||false,mystery:round?.mystery||false,rule:safeLine(round?.rule,150),challenge:safeLine(round?.challenge,150),event:round?.event||''},
      history:state.history.slice(0,6).map(game=>safeLine(game.name,180)),
      design:(()=>{const d=activeDesign();return {font:d.font,radius:d.radius,background:d.background}})()
    };
  }
  function copyText(text,message='Скопировано'){
    navigator.clipboard?.writeText(text).then(()=>toast(message)).catch(()=>window.prompt('Скопируй текст:',text));
  }
  function filterLibrary(items){
    const status=$('gp10LibStatus').value,rating=Number($('gp10LibRating').value),sort=$('gp10LibSort').value;
    const filtered=items.filter(game=>{const m=getMeta(game);return(status==='all'||m.status===status)&&m.rating>=rating});
    if(sort==='rating')filtered.sort((a,b)=>getMeta(b).rating-getMeta(a).rating||a.name.localeCompare(b.name,'ru'));
    if(sort==='hours')filtered.sort((a,b)=>getMeta(b).hours-getMeta(a).hours||a.name.localeCompare(b.name,'ru'));
    if(sort==='name')filtered.sort((a,b)=>a.name.localeCompare(b.name,'ru'));
    return filtered;
  }
  function decorateLibraryCard(wrapper,game){
    const m=getMeta(game),foot=document.createElement('div');foot.className='gp10-library-footer';
    const info=document.createElement('div');info.className='gp10-library-labels';
    const status=document.createElement('span');status.textContent=statusNames[m.status];
    const stars=document.createElement('span');stars.textContent=m.rating?'★'.repeat(m.rating)+'☆'.repeat(5-m.rating):'Без оценки';
    const hours=document.createElement('span');hours.textContent=m.hours?m.hours+' ч':'— ч';
    info.append(status,stars,hours);
    const button=document.createElement('button');button.type='button';button.textContent='✎ Досье игры';button.className='gp10-edit-game';
    button.addEventListener('click',()=>openLibrary(game));
    foot.append(info,button);wrapper.append(foot);
  }
  function openLibrary(game){
    editing=game;const m=getMeta(game);
    $('gp10LibraryTitle').textContent=game.name;
    $('gp10GameStatus').value=m.status;$('gp10GameRating').value=String(m.rating);
    $('gp10GameHours').value=String(m.hours);$('gp10GameNotes').value=m.notes;
    const dialog=$('gp10LibraryDialog');if(!dialog.open)dialog.showModal();
  }
  function saveLibrary(event){
    event.preventDefault();if(!editing)return;
    const record={status:$('gp10GameStatus').value,rating:Number($('gp10GameRating').value),hours:Number($('gp10GameHours').value),notes:safeLine($('gp10GameNotes').value,1200)};
    record.rating=Math.max(0,Math.min(5,Math.round(record.rating)||0));
    record.hours=Math.max(0,Math.min(9999,Number.isFinite(record.hours)?record.hours:0));
    if(record.status==='complete'&&!hasPlayed(editing))togglePlayed(editing);
    if(record.status!=='complete'&&hasPlayed(editing))togglePlayed(editing);
    meta[gameId(editing)]=record;write(LIB_KEY,meta);$('gp10LibraryDialog').close();
    renderFavorites();toast('Досье игры сохранено');
  }
  function activeDesign(){
    const id=state.theme.channel;
    const d=designs[id]&&typeof designs[id]==='object'?designs[id]:{};
    return {background:['default','aurora','mesh','stars','custom'].includes(d.background)?d.background:'default',font:['modern','mono','round'].includes(d.font)?d.font:'modern',radius:Number.isFinite(Number(d.radius))&&d.radius!==undefined?Math.max(0,Math.min(28,Number(d.radius))):14,motion:d.motion==='off'?'off':'on',image:typeof d.image==='string'&&/^data:image\/(?:png|jpeg|webp);base64,[a-z\d+/=]+$/i.test(d.image)?d.image:''};
  }
  function applyDesign(){
    const d=activeDesign(),body=document.body;
    body.dataset.gp10Background=d.background;body.dataset.gp10Font=d.font;body.dataset.gp10Motion=d.motion;
    body.style.setProperty('--gp10-radius',d.radius+'px');
    body.style.setProperty('--gp10-picture',d.image?'url("'+d.image+'")':'none');
    $('gp10Bg').value=d.background;$('gp10Font').value=d.font;$('gp10Radius').value=d.radius;
    $('gp10RadiusValue').textContent=d.radius+' px';$('gp10Motion').value=d.motion;
  }
  function saveDesign(){
    const id=state.theme.channel;
    const old=activeDesign();designs[id]={...old,background:$('gp10Bg').value,font:$('gp10Font').value,radius:Number($('gp10Radius').value),motion:$('gp10Motion').value};
    write(DESIGN_KEY,designs);applyDesign();
  }
  async function uploadBackground(file){
    if(!file)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>4*1024*1024){$('gp10EditorStatus').textContent='Нужен PNG, JPG или WebP размером до 4 МБ.';return}
    try{
      const bitmap=await createImageBitmap(file);const maxWidth=1280,maxHeight=720;
      const scale=Math.min(1,maxWidth/bitmap.width,maxHeight/bitmap.height);
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.floor(bitmap.width*scale));canvas.height=Math.max(1,Math.floor(bitmap.height*scale));
      canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();
      const image=canvas.toDataURL('image/jpeg',.78);
      if(image.length>2300000)throw Error('Изображение слишком большое для хранения.');
      const d=activeDesign();designs[state.theme.channel]={...d,image,background:'custom'};
      if(write(DESIGN_KEY,designs)){$('gp10EditorStatus').textContent='Фон добавлен. Он сохранён только в этом браузере.';applyDesign()}
    }catch(e){$('gp10EditorStatus').textContent='Не удалось открыть изображение: '+safeLine(e.message,90)}
  }
  function makeObsUrl(widget=currentWidget){
    ensureRoom();const url=new URL('/obs-widgets',location.origin==='null'?'http://127.0.0.1:5000':location.origin);
    url.searchParams.set('room',state.room);url.searchParams.set('widget',widget);
    url.searchParams.set('theme',state.theme.channel);url.searchParams.set('accent',themeAccent());
    return url.toString();
  }
  function selectWidget(widget){
    currentWidget=widget;
    [...$('gp10OBSButtons').querySelectorAll('button')].forEach(b=>{const selected=b.dataset.widget===widget;b.classList.toggle('is-selected',selected);b.setAttribute('aria-pressed',String(selected))});
    $('gp10OBSUrl').value=makeObsUrl(widget);
  }
  function pushVoting(data){
    const list=Array.isArray(data.games)?data.games.slice(0,12):[];
    const counts=Array.isArray(data.counts)?data.counts.slice(0,list.length):[];
    if(!list.length)return;
    const payload={games:list.map(n=>safeLine(n,100)),counts:counts.map(x=>Math.max(0,Math.min(1000000,Math.floor(Number(x)||0)))),active:Boolean(data.active),voters:Math.max(0,Math.floor(Number(data.voters)||0))};
    const token=JSON.stringify(payload);if(token===votedToken)return;votedToken=token;
    ensureRoom();fetch('/api/stream/'+encodeURIComponent(state.room)+'/vote',{method:'POST',headers:{'Content-Type':'application/json'},body:token,cache:'no-store'}).catch(()=>{});
  }
  // Non-secret read-only state for integration tests and extensions.
  globalThis.GP10={beforeSpin,displayGames,afterSpin,streamExtra,filterLibrary,decorateLibraryCard,onThemeChanged:applyDesign,pushVoting,makeObsUrl,getMeta};
  fillOptions();applyDesign();
  for(const key of ['Triple','Mystery','Effects'])$('gp10'+key).addEventListener('change',e=>{opts[key.toLowerCase()]=e.target.checked;saveOpts()});
  for(const [id,key] of [['gp10Rules','rules'],['gp10Challenges','challenges']])$(id).addEventListener('change',e=>{const values=parseLines(e.target.value);opts[key]=values.length?values:[...defaults[key]];e.target.value=opts[key].join('\n');saveOpts()});
  $('gp10DefaultLists').addEventListener('click',()=>{opts.rules=[...defaults.rules];opts.challenges=[...defaults.challenges];saveOpts();fillOptions();toast('Примеры правил и испытаний восстановлены')});
  $('gp10CopyResult').addEventListener('click',()=>{if(round)copyText([round.game.name,round.rule,round.challenge].filter(Boolean).join(' · '),'Сценарий скопирован')});
  for(const id of ['gp10LibStatus','gp10LibRating','gp10LibSort'])$(id).addEventListener('change',renderFavorites);
  $('gp10LibraryForm').addEventListener('submit',saveLibrary);
  $('gp10LibClose').addEventListener('click',()=>$('gp10LibraryDialog').close());
  $('gp10LibCancel').addEventListener('click',()=>$('gp10LibraryDialog').close());
  for(const id of ['gp10Bg','gp10Font','gp10Radius','gp10Motion'])$(id).addEventListener(id==='gp10Radius'?'input':'change',saveDesign);
  $('gp10BgFile').addEventListener('change',e=>uploadBackground(e.target.files?.[0]));
  $('gp10DesignReset').addEventListener('click',()=>{delete designs[state.theme.channel];write(DESIGN_KEY,designs);applyDesign();$('gp10EditorStatus').textContent='Оформление темы сброшено.'});
  $('gp10OBSButtons').addEventListener('click',e=>{const button=e.target.closest('button[data-widget]');if(button)selectWidget(button.dataset.widget)});
  $('gp10OBSCopy').addEventListener('click',()=>copyText(makeObsUrl(),'Ссылка для OBS скопирована'));
  $('gp10OBSPreview').addEventListener('click',()=>window.open(makeObsUrl()+'&preview=1','_blank','noopener,noreferrer'));
  // Refresh the visible OBS link after the user selects another theme.
  document.querySelectorAll('[data-channel]').forEach(button=>button.addEventListener('click',()=>setTimeout(()=>{if($('gp10OBSUrl').value)selectWidget(currentWidget)},50)));
  // Other V9 features retain their event handlers and APIs.
})();

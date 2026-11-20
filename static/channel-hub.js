'use strict';
/* The channel hub never invents channel statistics or video metadata.
   Everything displayed as YouTube data comes from /api/channel (official API).
   Manual video collections and uploaded channel images stay in localStorage. */
(() => {
  const KEY = 'gamepick-channel-hub-v1';
  const CHANNELS = {
    gameoverellis:{name:'GameOverEllis',handle:'GameOverEllis',symbol:'✦',monogram:'ELLIS',note:'Игры, демоверсии и новые открытия'},
    azraellone:{name:'AzraelLone',handle:'AzraelLone',symbol:'⌖',monogram:'AZRAEL',note:'Игры, подборки и случайный выбор'}
  };
  let settings = {};
  try { const value = JSON.parse(localStorage.getItem(KEY)||'{}'); if(value && typeof value==='object') settings=value; } catch {}
  const live = {};
  const loaded = {};
  const archiveVideos = {};
  const archiveLoaded = new Set();
  const yearViews = {};
  const currentYear = new Date().getUTCFullYear();
  let editing = null;
  let loadSequence = 0;
  const el = id => document.getElementById(id);
  const current = () => CHANNELS[state.theme.channel] ? state.theme.channel : 'gameoverellis';
  const pref = () => {
    const id=current();
    const obj=settings[id]||{};
    if(!Array.isArray(obj.manual)) obj.manual=[];
    if(!Array.isArray(obj.selected)) obj.selected=[];
    if(!obj.picks || typeof obj.picks!=='object') obj.picks={};
    settings[id]=obj;
    return obj;
  };
  const save = () => {
    try {localStorage.setItem(KEY,JSON.stringify(settings));return true;}
    catch { toast('Не хватает места для картинки. Попробуй файл поменьше.');return false; }
  };
  const channelURL = id => 'https://www.youtube.com/@'+CHANNELS[id].handle;
  function num(value) { return typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat('ru-RU').format(value) : '—'; }
  function youtubeImage(value) {
    if(typeof value!=='string')return '';
    try { const url=new URL(value);const h=url.hostname.toLowerCase();return url.protocol==='https:' && (h==='i.ytimg.com'||h.endsWith('.ytimg.com')||h==='yt3.ggpht.com'||h.endsWith('.ggpht.com')||h==='yt3.googleusercontent.com'||h.endsWith('.googleusercontent.com')) ? url.href : ''; }catch{return ''}
  }
  function packagedImage(value) {return typeof value==='string' && /^\/static\/channel-assets\/(?:gameoverellis|azraellone)-(?:banner|avatar)\.(?:webp|jpg|jpeg|png)$/.test(value)?value:''}
  function localImage(value) {return typeof value==='string' && /^data:image\/(?:webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(value) ? value : ''}
  function photo(value) {return localImage(value)||packagedImage(value)||youtubeImage(value)}
  function gameNames(raw) {return [...new Set(String(raw||'').split(/[\n\r;]+/).map(v=>v.trim().slice(0,180)).filter(Boolean))].slice(0,150)}
  function parseVideoURL(text) {
    try {
      const u = new URL(String(text||'').trim());const h=u.hostname.toLowerCase();let id='';
      if(h==='youtu.be'||h==='www.youtu.be') id=u.pathname.split('/')[1]||'';
      else if(['youtube.com','www.youtube.com','m.youtube.com'].includes(h)) {
        if(u.pathname==='/watch') id=u.searchParams.get('v')||'';
        else if(/^\/(shorts|live|embed)\//.test(u.pathname))id=u.pathname.split('/')[2]||'';
      }
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : '';
    }catch{return ''}
  }
  function videos() {
    const p=pref(); const seen=new Set();const items=[];
    for(const item of [...(live[current()]?.videos||[]),...(archiveVideos[current()]||[]),...p.manual]) {
      if(!item||!(/^[\w-]{11}$/.test(item.id))||seen.has(item.id))continue;
      seen.add(item.id);items.push({id:item.id,title:String(item.title||'Видео на YouTube').slice(0,180),
        url:'https://www.youtube.com/watch?v='+item.id,
        image:youtubeImage(item.image)||'https://i.ytimg.com/vi/'+item.id+'/mqdefault.jpg',manual:Boolean(item.manual),
        published:String(item.published||'').slice(0,10)});
    }
    return items;
  }
  function visibleVideos(){
    const choice=el('channelVideoYear').value;
    const search=(el('channelVideoSearch').value||'').trim().toLowerCase();
    let list=videos().filter(v=>{
      if(/^\d{4}$/.test(choice)&&!v.published.startsWith(choice+'-'))return false;
      const linked=pref().picks[v.id]||[];
      return !search||v.title.toLowerCase().includes(search)||linked.join(' ').toLowerCase().includes(search);
    });
    if(choice==='old')list.sort((a,b)=>(a.published||'9999').localeCompare(b.published||'9999'));
    else list.sort((a,b)=>(b.published||'').localeCompare(a.published||''));
    return list;
  }
  function configureYearChoice(){
    const select=el('channelVideoYear');const old=select.value;
    if(select.options.length<=3){
      for(let y=currentYear;y>=2005;y--){const opt=document.createElement('option');opt.value=String(y);opt.textContent=y+' год';select.append(opt)}
    }
    select.value=yearViews[current()]||old||'all';
    if(!select.value)select.value='all';
    el('channelFetchYear').hidden=!/^\d{4}$/.test(select.value);
  }
  async function loadEpisodesYear(){
    const year=el('channelVideoYear').value,id=current();
    if(!/^\d{4}$/.test(year))return;
    const key=id+':'+year,button=el('channelFetchYear'),status=el('channelYearStatus');
    if(archiveLoaded.has(key)){status.textContent='Выпуски '+year+' года уже загружены';return}
    button.disabled=true;status.textContent='Запрашиваем выпуски '+year+' года через YouTube…';
    try{
      const response=await fetch('/api/channel/'+id+'/episodes?year='+year);
      const data=await response.json();
      if(!response.ok)throw Error(data.error||'Не удалось загрузить выпуски');
      if(!archiveVideos[id])archiveVideos[id]=[];
      const seen=new Set(archiveVideos[id].map(x=>x.id));
      for(const v of data.videos||[]){if(!seen.has(v.id)){archiveVideos[id].push(v);seen.add(v.id)}}
      archiveLoaded.add(key);
      status.textContent=`Из YouTube загружено: ${(data.videos||[]).length} за ${year} год`+(data.partial?' · показана не вся история':'');
      if(current()===id)renderVideos();
    }catch(error){status.textContent=error.message||'Нет доступа к архиву канала'}
    finally{button.disabled=false}
  }
  function selectionToken() { const p=pref();return JSON.stringify([current(),p.selected.map(v=>v).sort(),p.picks]); }
  function videoGames() {
    const p=pref();const unique=new Set();const result=[];
    for(const vid of p.selected){
      for(const game of (p.picks[vid]||[])){
        const name=String(game||'').trim().slice(0,180);if(!name||unique.has(name.toLowerCase()))continue;
        unique.add(name.toLowerCase());
        const id='video_'+Array.from(name.toLowerCase()).reduce((h,c)=>(Math.imul(h,33)+c.codePointAt(0))>>>0,5381).toString(16);
        result.push({id,name,kind:'custom',image:'',date:'',url:fallbackSearch(name)});
      }
    }
    return result.slice(0,250);
  }
  function updateVideoPool() {
    const count=videoGames().length;
    const label=el('videoPoolInfo');
    if(label)label.textContent=count?`Выбрано ${count} игр из роликов канала ${CHANNELS[current()].name}.`:'Отметь видео с привязанными играми во вкладке «Каналы».';
    if(state.config.source==='video' && state.page==='roulette' && !state.spinning)queuePrepare();
  }
  function renderBranding() {
    const id=current(),p=pref(),data=live[id]||{},meta=CHANNELS[id];
    const banner=photo(p.banner)||photo(data.banner),avatar=photo(p.avatar)||photo(data.avatar);
    const profile=el('channelProfileBanner'),hero=el('heroChannelPhoto');
    document.body.style.setProperty('--creator-banner-image',banner?`url("${banner}")`:'none');
    for(const target of [profile,hero]) {
      if(!target)continue;
      target.style.backgroundImage=banner?`linear-gradient(0deg,rgba(4,5,12,.44),rgba(4,5,12,.07)), url("${banner}")`:'';
      target.classList.toggle('has-channel-photo',Boolean(banner));
    }
    const symbol=el('channelAvatarSymbol'),avatarEl=el('channelProfileAvatar');
    if(symbol)symbol.textContent=meta.symbol;
    if(avatarEl){avatarEl.style.backgroundImage=avatar?`url("${avatar}")`:'';avatarEl.classList.toggle('has-channel-photo',Boolean(avatar));}
    el('channelBigMark').textContent=meta.monogram;
    document.querySelectorAll('[data-quick-channel]').forEach(btn=>{const key=btn.dataset.quickChannel;const pic=photo(settings[key]?.avatar)||photo(live[key]?.avatar);const glyph=btn.querySelector('.quick-glyph');if(glyph){glyph.style.backgroundImage=pic?`url(\"${pic}\")`:'';glyph.classList.toggle('has-channel-photo',Boolean(pic))}});
    el('channelHandle').textContent='@'+meta.handle;
    el('channelProfileName').textContent=data.available&&data.name?data.name:meta.name;
    el('channelProfileDesc').textContent=data.available&&data.description?data.description:meta.note;
    el('channelYouTubeLink').href=channelURL(id);
    el('channelAllVideos').href=channelURL(id)+'/videos';
    el('channelSubscribers').textContent=data.available?num(data.subscribers):'—';
    el('channelVideoCount').textContent=data.available?num(data.videos_total):'—';
    el('channelSyncStatus').textContent=data.available?'YouTube · обновлено '+new Date(data.updated*1000).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):data.message||'Данные будут показаны после подключения YouTube API';
    document.querySelectorAll('[data-hub-channel]').forEach(btn=>{const yes=btn.dataset.hubChannel===id;btn.classList.toggle('is-selected',yes);btn.setAttribute('aria-pressed',String(yes))});
  }
  function renderVideos(){
    const p=pref(),items=visibleVideos();
    const root=el('channelVideoGrid');root.replaceChildren();
    let visible=0;
    for(const item of items){
      const games=p.picks[item.id]||[];

      visible++;
      const card=document.createElement('article');card.className='hub-video-card';
      const picture=document.createElement('div');picture.className='hub-video-image';
      const img=document.createElement('img');img.loading='lazy';img.src=item.image;img.alt='Обложка видео: '+item.title;img.addEventListener('error',()=>img.remove(),{once:true});picture.append(img);
      const youtube=document.createElement('a');youtube.className='hub-video-open';youtube.href=item.url;youtube.target='_blank';youtube.rel='noopener noreferrer';youtube.title='Смотреть видео на YouTube';youtube.textContent='▶';picture.append(youtube);
      const description=document.createElement('div');description.className='hub-video-desc';
      const title=document.createElement('h3');title.textContent=item.title;
      const date=document.createElement('small');date.textContent=item.published?'Опубликовано '+item.published:(item.manual?'Добавлено вручную':'');
      const tags=document.createElement('p');tags.textContent=games.length?games.slice(0,4).join(' · ')+(games.length>4?' · ...':''):'Игры пока не привязаны';
      const buttons=document.createElement('div');buttons.className='hub-video-actions';
      const selectLabel=document.createElement('label');selectLabel.className='hub-video-choose';
      const input=document.createElement('input');input.type='checkbox';input.checked=p.selected.includes(item.id);input.disabled=!games.length;input.setAttribute('aria-label','Включить игры из ролика '+item.title);
      input.addEventListener('change',()=>{if(input.checked){if(!p.selected.includes(item.id))p.selected.push(item.id)}else p.selected=p.selected.filter(id=>id!==item.id);save();updateFooter();updateVideoPool()});
      selectLabel.append(input,document.createTextNode('В подборку'));buttons.append(selectLabel);
      const edit=document.createElement('button');edit.type='button';edit.className='hub-video-edit';edit.textContent=games.length?'Игр: '+games.length+' · Изменить':'+ Добавить игры';edit.addEventListener('click',()=>openEditor(item));buttons.append(edit);
      if(games.length){const play=document.createElement('button');play.type='button';play.className='hub-video-spin';play.textContent='В РУЛЕТКУ ↗';play.addEventListener('click',()=>{p.selected=[item.id];save();setSource('video');showPage('roulette');updateVideoPool()});buttons.append(play)}
      if(item.manual){const remove=document.createElement('button');remove.type='button';remove.className='hub-video-remove';remove.textContent='×';remove.title='Удалить своё видео';remove.setAttribute('aria-label','Удалить видео '+item.title);remove.addEventListener('click',()=>{p.manual=p.manual.filter(v=>v.id!==item.id);p.selected=p.selected.filter(v=>v!==item.id);delete p.picks[item.id];save();renderVideos();updateVideoPool()});buttons.append(remove)}
      description.append(title,date,tags,buttons);card.append(picture,description);root.append(card);
    }
    if(!visible){const empty=document.createElement('div');empty.className='hub-empty';const text=document.createElement('h3');text.textContent='Видео за выбранный период не найдены';const desc=document.createElement('p');desc.textContent='Чтобы увидеть старые выпуски, выбери год и нажми «Загрузить выпуски года». Без YouTube API можно добавлять видео вручную и указывать дату.';empty.append(text,desc);root.append(empty)}
    updateFooter();
  }
  function updateFooter(){const p=pref();const count=p.selected.length,gameCount=videoGames().length;el('channelSelectedVideoCount').textContent=count?`Выбрано видео: ${count} · Игр в подборке: ${gameCount}`:'Отметь ролики с играми';el('channelPlayPicks').disabled=gameCount===0;}
  function openEditor(item){editing=item.id;el('channelEditTitle').textContent='Игры из видео';el('channelEditSub').textContent=item.title;el('channelGamesText').value=(pref().picks[item.id]||[]).join('\n');el('channelGamesDialog').showModal?.();}
  function saveEditor(){if(!editing)return;const p=pref();const list=gameNames(el('channelGamesText').value);if(list.length)p.picks[editing]=list;else delete p.picks[editing];if(!list.length)p.selected=p.selected.filter(v=>v!==editing);save();el('channelGamesDialog').close();editing=null;renderVideos();updateVideoPool();toast(list.length?'Игры из видео сохранены':'Список игр очищен')}
  function resizeFile(file,kind){
    return new Promise((resolve,reject)=>{
      if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024){reject(Error('Нужен JPG, PNG или WEBP до 8 МБ'));return}
      const objectURL=URL.createObjectURL(file);const img=new Image();img.onload=()=>{
        URL.revokeObjectURL(objectURL);
        const canvas=document.createElement('canvas');
        const W=kind==='banner'?1600:360,H=kind==='banner'?520:360;canvas.width=W;canvas.height=H;
        const ctx=canvas.getContext('2d');if(!ctx){reject(Error('Не удалось обработать изображение'));return}
        const scale=Math.max(W/img.naturalWidth,H/img.naturalHeight);const width=img.naturalWidth*scale,height=img.naturalHeight*scale;
        ctx.drawImage(img,(W-width)/2,(H-height)/2,width,height);
        resolve(canvas.toDataURL('image/webp',.76));
      };
      img.onerror=()=>{URL.revokeObjectURL(objectURL);reject(Error('Файл изображения не открывается'))};img.src=objectURL;
    });
  }
  async function chooseImage(event,kind){const file=event.target.files?.[0];if(!file)return;try{const result=await resizeFile(file,kind);const p=pref();p[kind]=result;if(!save())delete p[kind];renderBranding();toast(kind==='banner'?'Баннер канала установлен':'Аватар канала установлен')}catch(error){toast(error.message||'Не удалось добавить изображение')}finally{event.target.value=''}}
  async function fetchChannel(force=false){
    const id=current();if(loaded[id]&&!force)return;const seq=++loadSequence;
    el('channelSyncStatus').textContent='Получаем данные YouTube…';
    try {const res=await fetch('/api/channel/'+id+(force?'?refresh=1':''),{cache:force?'no-store':'default'});const data=await res.json();
      loaded[id]=true;if(res.ok)live[id]=data;else live[id]={available:false,message:'Канал временно недоступен'};
    }catch{loaded[id]=true;live[id]={available:false,message:'Нет соединения с YouTube API'}}
    if(seq&&current()===id){renderBranding();renderVideos()}
  }
  function render(){configureYearChoice();renderBranding();renderVideos();fetchChannel()}
  function onTheme(){configureYearChoice();renderBranding();renderVideos();updateVideoPool();fetchChannel()}
  function init(){
    configureYearChoice();
    el('channelVideoYear').addEventListener('change',()=>{
      const val=el('channelVideoYear').value;yearViews[current()]=val;
      el('channelFetchYear').hidden=!/^\d{4}$/.test(val);
      el('channelYearStatus').textContent=/^\d{4}$/.test(val)?'Для полной подборки за год нажми «Загрузить выпуски года».':'Показаны выпуски, уже загруженные на эту страницу.';
      renderVideos();
    });
    el('channelFetchYear').addEventListener('click',loadEpisodesYear);
    el('channelVideoSearch').addEventListener('input',renderVideos);
    document.querySelectorAll('[data-hub-channel]').forEach(b=>b.addEventListener('click',()=>setChannel(b.dataset.hubChannel)));
    el('channelRefresh').addEventListener('click',()=>{loaded[current()]=false;fetchChannel(true)});
    el('channelBannerFile').addEventListener('change',e=>chooseImage(e,'banner'));
    el('channelAvatarFile').addEventListener('change',e=>chooseImage(e,'avatar'));
    el('channelResetImages').addEventListener('click',()=>{const p=pref();delete p.banner;delete p.avatar;save();renderBranding();toast('Локальные изображения сброшены')});
    el('channelSaveGames').addEventListener('click',saveEditor);
    el('channelCancelGames').addEventListener('click',()=>{el('channelGamesDialog').close();editing=null});
    el('channelSelectAll').addEventListener('click',()=>{const p=pref();p.selected=[...new Set([...p.selected,...visibleVideos().filter(v=>(p.picks[v.id]||[]).length).map(v=>v.id)])];save();renderVideos();updateVideoPool()});
    el('channelUnselectAll').addEventListener('click',()=>{pref().selected=[];save();renderVideos();updateVideoPool()});
    el('channelPlayPicks').addEventListener('click',()=>{if(!videoGames().length)return;setSource('video');showPage('roulette');updateVideoPool()});
    el('channelManualVideoForm').addEventListener('submit',event=>{
      event.preventDefault();const videoId=parseVideoURL(el('channelManualVideoUrl').value);
      if(!videoId){toast('Укажи ссылку на видео YouTube');return}
      const p=pref(),title=el('channelManualVideoTitle').value.trim().slice(0,180)||'Видео '+videoId;
      const games=gameNames(el('channelManualVideoGames').value);
      if(!games.length){toast('Добавь хотя бы одно название игры');return}
      const published=String(el('channelManualVideoDate').value||'');
      p.manual=p.manual.filter(v=>v.id!==videoId);p.manual.unshift({id:videoId,title,manual:true,published:/^\d{4}-\d{2}-\d{2}$/.test(published)?published:''});
      p.picks[videoId]=games;if(!p.selected.includes(videoId))p.selected.push(videoId);
      save();event.target.reset();renderVideos();updateVideoPool();toast('Видео и подборка сохранены')
    });
    renderBranding();updateVideoPool();fetchChannel();
  }
  globalThis.channelHub={render,onTheme,videoGames,selectionToken,updateVideoPool};
  init();
})();

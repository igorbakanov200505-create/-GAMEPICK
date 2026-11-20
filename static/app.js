'use strict';
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => Array.from(root.querySelectorAll(s));
const GENRES = [
  ['all','Все жанры','✦'],['action','Экшен','⚡'],['adventure','Приключения','◇'],
  ['horror','Хорроры','☽'],['survival','Выживание','✳'],['rpg','RPG','♜'],
  ['shooter','Шутеры','⌖'],['strategy','Стратегии','♟'],['simulation','Симуляторы','▤'],
  ['puzzle','Головоломки','◈'],['platformer','Платформеры','▥'],['racing','Гонки','➤'],
  ['coop','Кооператив','♧'],['roguelike','Рогалики','✺'],['visual_novel','Визуальные новеллы','▣'],
  ['indie','Инди','☆']
];
const MACHINES = {wheel:'WHEEL',case:'CASE DROP',drum:'SHOW DRUM',casino:'CASINO'};
const MUSIC = {
  baraban:{file:'baraban.mp3',duration:10318},
  spin:{file:'spin.mp3',duration:13248},
  gambling:{file:'gambling.mp3',duration:9535},
  silent:{file:null,duration:7800}
};
const CHANNELS={neon:'#71e6fa',noir:'#ff526d',sunset:'#ffad75',retro:'#eacb5a',frost:'#89bdff',forest:'#80e8b4',gold:'#f6d47e',cosmos:'#ba9bff'};
const CHANNEL_META={
 neon:{label:'NEON PULSE',short:'NEON',eyebrow:'GAMEPICK / NEON PULSE',signature:'СЛУЧАЙ ВЫБИРАЕТ',showcase:'NEON PULSE',glyph:'✦',artTitle:'ТВОЯ СЛЕДУЮЩАЯ ИГРА',artSub:'НАЙДИ ИГРУ ПОД НАСТРОЕНИЕ',roulette:'GAMEPICK / РУЛЕТКА',tag:'STREAM / SELECT',winner:'NEON PULSE / ИГРА ВЫБРАНА',description:'Ночной неоновый эфир',machine:'case',sound:'gambling'},
 noir:{label:'DARK SIGNAL',short:'DARK',eyebrow:'GAMEPICK / DARK SIGNAL',signature:'СЛУЧАЙ ВЫБИРАЕТ',showcase:'DARK SIGNAL',glyph:'⌖',artTitle:'ТВОЯ СЛЕДУЮЩАЯ ИГРА',artSub:'НАЙДИ ИГРУ ПОД НАСТРОЕНИЕ',roulette:'GAMEPICK / РУЛЕТКА',tag:'STREAM / SELECT',winner:'DARK SIGNAL / ИГРА ВЫБРАНА',description:'Тёмный сигнал',machine:'drum',sound:'baraban'},
 sunset:{label:'SUNSET ARCADE',short:'SUNSET',eyebrow:'GAMEPICK / SUNSET ARCADE',signature:'СЛУЧАЙ ВЫБИРАЕТ',showcase:'SUNSET ARCADE',glyph:'☀',artTitle:'ТВОЯ СЛЕДУЮЩАЯ ИГРА',artSub:'НАЙДИ ИГРУ ПОД НАСТРОЕНИЕ',roulette:'GAMEPICK / РУЛЕТКА',tag:'STREAM / SELECT',winner:'SUNSET ARCADE / ИГРА ВЫБРАНА',description:'Тёплый аркадный закат',machine:'wheel',sound:'spin'},
 retro:{label:'RETRO PIXEL',short:'RETRO',eyebrow:'GAMEPICK / RETRO PIXEL',signature:'СЛУЧАЙ ВЫБИРАЕТ',showcase:'RETRO PIXEL',glyph:'▦',artTitle:'ТВОЯ СЛЕДУЮЩАЯ ИГРА',artSub:'НАЙДИ ИГРУ ПОД НАСТРОЕНИЕ',roulette:'GAMEPICK / РУЛЕТКА',tag:'STREAM / SELECT',winner:'RETRO PIXEL / ИГРА ВЫБРАНА',description:'Аркадная классика',machine:'case',sound:'gambling'},
 frost:{label:'ARCTIC FROST',short:'FROST',eyebrow:'GAMEPICK / ARCTIC FROST',signature:'СЛУЧАЙ ВЫБИРАЕТ',showcase:'ARCTIC FROST',glyph:'❄',artTitle:'ТВОЯ СЛЕДУЮЩАЯ ИГРА',artSub:'НАЙДИ ИГРУ ПОД НАСТРОЕНИЕ',roulette:'GAMEPICK / РУЛЕТКА',tag:'STREAM / SELECT',winner:'ARCTIC FROST / ИГРА ВЫБРАНА',description:'Холодный воздух и стекло',machine:'wheel',sound:'spin'},
 forest:{label:'EMERALD QUEST',short:'QUEST',eyebrow:'GAMEPICK / EMERALD QUEST',signature:'СЛУЧАЙ ВЫБИРАЕТ',showcase:'EMERALD QUEST',glyph:'✧',artTitle:'ТВОЯ СЛЕДУЮЩАЯ ИГРА',artSub:'НАЙДИ ИГРУ ПОД НАСТРОЕНИЕ',roulette:'GAMEPICK / РУЛЕТКА',tag:'STREAM / SELECT',winner:'EMERALD QUEST / ИГРА ВЫБРАНА',description:'Зелёный мир приключений',machine:'drum',sound:'baraban'},
 gold:{label:'ROYAL GOLD',short:'GOLD',eyebrow:'GAMEPICK / ROYAL GOLD',signature:'СЛУЧАЙ ВЫБИРАЕТ',showcase:'ROYAL GOLD',glyph:'♛',artTitle:'ТВОЯ СЛЕДУЮЩАЯ ИГРА',artSub:'НАЙДИ ИГРУ ПОД НАСТРОЕНИЕ',roulette:'GAMEPICK / РУЛЕТКА',tag:'STREAM / SELECT',winner:'ROYAL GOLD / ИГРА ВЫБРАНА',description:'Золотая рулетка',machine:'casino',sound:'gambling'},
 cosmos:{label:'COSMIC DRIFT',short:'COSMOS',eyebrow:'GAMEPICK / COSMIC DRIFT',signature:'СЛУЧАЙ ВЫБИРАЕТ',showcase:'COSMIC DRIFT',glyph:'✺',artTitle:'ТВОЯ СЛЕДУЮЩАЯ ИГРА',artSub:'НАЙДИ ИГРУ ПОД НАСТРОЕНИЕ',roulette:'GAMEPICK / РУЛЕТКА',tag:'STREAM / SELECT',winner:'COSMIC DRIFT / ИГРА ВЫБРАНА',description:'Космический случай',machine:'wheel',sound:'spin'}
};
function activeSound(){
  const choice=state.config.sound;
  return choice==='auto'?(state.config.machine==='drum'?'baraban':state.config.machine==='case'||state.config.machine==='casino'?'gambling':'spin'):choice;
}

const STORAGE = {catalog:'gamepick-catalog-filters-v5',fav:'gamepick-favorites-v2',hist:'gamepick-history-v2',cfg:'gamepick-config-v2',own:'gamepick-own-v1',room:'gamepick-obs-room-v1',sel:'gamepick-favorites-selected-v1',theme:'gamepick-channel-theme-v1',played:'gamepick-played-v1',presets:'gamepick-channel-config-v1'};
const DISC_COLORS = ['#315c4e','#8653c4','#33679d','#946433','#42675b','#a35369','#5259a7','#8c6942'];
const $ui = {
  pages:{catalog:$('#pageCatalog'),roulette:$('#pageRoulette'),favorites:$('#pageFavorites'),creators:$('#pageCreators'),themes:$('#pageThemes')},
  catalogGrid:$('#catalogGrid'),catalogStatus:$('#catalogStatus'),catalogGenre:$('#catalogGenreLabel'),catalogAlert:$('#catalogAlert'),
  more:$('#catalogMore'),catalogSearch:$('#catalogSearch'),catalogSort:$('#catalogSort'),
  machineChoices:$('#machineChoices'),wheelKinds:$('#wheelKinds'),wheelGenres:$('#wheelGenres'),wheelQuery:$('#wheelQuery'),
  wheelSources:$('#wheelSources'),remoteFilters:$('#remoteFilters'),ownFilters:$('#ownFilters'),ownGames:$('#ownGames'),
  soundTheme:$('#soundTheme'),volume:$('#volume'),previewSound:$('#previewSound'),noRepeats:$('#noRepeats'),
  spinButton:$('#spinButton'),spinLabel:$('#spinLabel'),poolStatus:$('#poolStatus'),rouletteAlert:$('#rouletteAlert'),
  stage:$('#stage'),visual:$('#stageVisual'),stageStatus:$('#stageStatus'),stageHint:$('#stageHint'),stageMachineLabel:$('#stageMachineLabel'),
  result:$('#resultPanel'),winnerImage:$('#winnerImage'),winnerName:$('#winnerName'),winnerKind:$('#winnerKind'),winnerLink:$('#winnerLink'),winnerFav:$('#winnerFav'),
  history:$('#historyGrid'),favorites:$('#favoritesGrid'),favoritesSearch:$('#favoritesSearch'),toast:$('#toast'),favoritePoolInfo:$('#favoritePoolInfo'),favoritesSelectedInfo:$('#favoritesSelectedInfo'),
  overlayDialog:$('#overlayDialog'),overlayUrl:$('#overlayUrl'),favCount:$('#favCount')
};
function localArray(key){try{const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value:[]}catch{return []}}
function localObject(key){try{const value=JSON.parse(localStorage.getItem(key)||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}catch{return {}}}
function store(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{}}
function getRaw(key){try{return localStorage.getItem(key)||''}catch{return ''}}
function putRaw(key,val){try{localStorage.setItem(key,val)}catch{}}
function fallbackSearch(name){return 'https://store.steampowered.com/search/?term='+encodeURIComponent(name||'')}
function safeUrl(url,name=''){
  try {const u=new URL(url);if(u.protocol==='https:'&&u.hostname==='store.steampowered.com'&&(/^(\/app\/\d+\/|\/search\/)/.test(u.pathname)))return u.href} catch{}
  return fallbackSearch(name);
}
function safeImage(src){
  try{const u=new URL(src);const h=u.hostname.toLowerCase();if(u.protocol==='https:'&&(h==='steamstatic.com'||h.endsWith('.steamstatic.com')||h==='akamaihd.net'||h.endsWith('.akamaihd.net')))return u.href}catch{}
  return '';
}
function normalizeGame(raw){
  const name=String(raw?.name||'').trim().slice(0,180);
  const kind=['demo','full','custom'].includes(raw?.kind)?raw.kind:'full';
  return {id:String(raw?.id||'').slice(0,100),name,image:safeImage(raw?.image),date:String(raw?.date||'').slice(0,70),url:safeUrl(raw?.url,name),kind};
}
function validGames(arr){return Array.isArray(arr)?arr.map(normalizeGame).filter(g=>g.name&&g.id):[]}
function favKey(game){return game.kind+':'+game.id}
const MAX_GENRES = 8;
const KNOWN_GENRES = new Set(GENRES.filter(g=>g[0]!=='all').map(g=>g[0]));
function genreName(id){return GENRES.find(g=>g[0]===id)?.[1]||'Все жанры'}
function normalizeGenres(ids){
  const items=Array.isArray(ids)?ids:typeof ids==='string'?ids.split(','):[];
  return [...new Set(items.filter(id=>KNOWN_GENRES.has(id)))].slice(0,MAX_GENRES);
}
function genreMode(value){return value==='all'?'all':'any'}
function formatGenres(ids){return ids.length?ids.map(genreName).join(' · '):'ВСЕ ЖАНРЫ'}
function updateSelectedGenre(list,id){
  if(list.includes(id))return list.filter(item=>item!==id);
  if(list.length>=MAX_GENRES){toast(`Можно выбрать до ${MAX_GENRES} жанров`);return null}
  return [...list,id];
}
const CURRENT_YEAR = new Date().getUTCFullYear();
function validPeriod(value){return ['all','new','2020s','2010s','2000s','old','custom'].includes(value)?value:'all'}
function yearRange(c){
  const period=validPeriod(c.period);
  if(period==='all')return null;
  if(period==='new')return [Math.max(1980,CURRENT_YEAR-2),CURRENT_YEAR];
  if(period==='2020s')return [2020,Math.min(2029,CURRENT_YEAR)];
  if(period==='2010s')return [2010,2019];
  if(period==='2000s')return [2000,2009];
  if(period==='old')return [1980,1999];
  let from=Number(c.yearFrom)||1980,to=Number(c.yearTo)||CURRENT_YEAR;
  if(from<1980||to>CURRENT_YEAR||to<from)return null;
  return [from,to];
}
function addYearFilters(params,c){const years=yearRange(c);if(years){params.set('year_from',years[0]);params.set('year_to',years[1])}}
function syncYearInputs(prefix,c){
  const recent=$('#'+prefix+'Period option[value="new"]');if(recent)recent.textContent=`Новые · ${CURRENT_YEAR-2}–${CURRENT_YEAR}`;
  const yearSelect=$('#'+prefix+'Period');yearSelect.value=validPeriod(c.period);
  const custom=$('#'+prefix+'CustomYears');custom.hidden=yearSelect.value!=='custom';
  $('#'+prefix+'YearFrom').value=c.yearFrom||'';
  $('#'+prefix+'YearTo').value=c.yearTo||'';
}
function saveCatalogFilters(){store(STORAGE.catalog,{genres:state.catalog.genres,genreMode:state.catalog.genreMode,period:state.catalog.period,yearFrom:state.catalog.yearFrom,yearTo:state.catalog.yearTo})}
function setGenreButtons(group,mode){setButtons(group,'mode',mode)}
function randomIndex(n){if(n<=1)return 0;const c=new Uint32Array(1);if(globalThis.crypto?.getRandomValues){crypto.getRandomValues(c);return Math.floor(c[0]/4294967296*n)}return Math.floor(Math.random()*n)}
const cfg={machine:'wheel',source:'catalog',kind:'demo',genre:'all',q:'',sound:'auto',volume:70,noRepeats:true,excludePlayed:false,...localObject(STORAGE.cfg)};
if(!Object.keys(MACHINES).includes(cfg.machine))cfg.machine='wheel';
if(!['catalog','favorites','own','video'].includes(cfg.source))cfg.source='catalog';
if(!['demo','full','mix'].includes(cfg.kind))cfg.kind='demo';
cfg.genres=normalizeGenres(cfg.genres??cfg.genre);
cfg.genreMode=genreMode(cfg.genreMode);
cfg.period=validPeriod(cfg.period);cfg.yearFrom=cfg.yearFrom||'';cfg.yearTo=cfg.yearTo||'';
delete cfg.genre;
if(cfg.sound!=='auto'&&!MUSIC[cfg.sound])cfg.sound='auto';
cfg.volume=Math.max(0,Math.min(100,Number(cfg.volume)||0));
let legacyFav=localArray(STORAGE.fav);
if(!legacyFav.length){legacyFav=localArray('demo-roulette-favs-v1')}
const storedCatalog=localObject(STORAGE.catalog);
const state={
  page:'catalog',catalog:{q:'',genres:normalizeGenres(storedCatalog.genres),genreMode:genreMode(storedCatalog.genreMode),period:validPeriod(storedCatalog.period),yearFrom:storedCatalog.yearFrom||'',yearTo:storedCatalog.yearTo||'',kind:'demo',sort:'relevance',page:0,total:0,games:[],hasMore:false,req:0},
  favorites:validGames(legacyFav),history:validGames(localArray(STORAGE.hist)).slice(0,70),
  selectedFavorites:new Set(localArray(STORAGE.sel)),played:new Set(localArray(STORAGE.played).filter(x=>typeof x==='string').slice(0,2000)),favoritesView:'all',theme:localObject(STORAGE.theme),
  config:cfg,pool:[],poolKey:'',poolReq:0,loadingPool:false,spinning:false,chosen:null,
  room:'',audio:null,audioPreview:false,toastTimeout:0,spinTimeout:0,prepTimer:0
};
const CHANNEL_PRESETS=localObject(STORAGE.presets);
const PRESET_FIELDS=['machine','source','kind','q','sound','volume','noRepeats','excludePlayed','genres','genreMode','period','yearFrom','yearTo'];
function safePreset(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
  const v={};
  if(Object.keys(MACHINES).includes(raw.machine))v.machine=raw.machine;
  if(['catalog','favorites','own','video'].includes(raw.source))v.source=raw.source;
  if(['demo','full','mix'].includes(raw.kind))v.kind=raw.kind;
  if(raw.sound==='auto'||MUSIC[raw.sound])v.sound=raw.sound;
  if(typeof raw.volume==='number'&&Number.isFinite(raw.volume))v.volume=Math.max(0,Math.min(100,raw.volume));
  if(typeof raw.noRepeats==='boolean')v.noRepeats=raw.noRepeats;
  if(typeof raw.excludePlayed==='boolean')v.excludePlayed=raw.excludePlayed;
  if(Array.isArray(raw.genres))v.genres=normalizeGenres(raw.genres);
  if(raw.genreMode==='all'||raw.genreMode==='any')v.genreMode=raw.genreMode;
  if(raw.period)v.period=validPeriod(raw.period);
  for(const k of ['yearFrom','yearTo'])if(raw[k]=== '' || /^\d{4}$/.test(String(raw[k])))v[k]=String(raw[k]);
  if(typeof raw.q==='string')v.q=raw.q.slice(0,90);
  return v;
}
function saveCfg(){
  store(STORAGE.cfg,state.config);
  const id=state.theme?.channel;
  if(CHANNELS[id]){
    CHANNEL_PRESETS[id]=Object.fromEntries(PRESET_FIELDS.map(k=>[k,Array.isArray(state.config[k])?[...state.config[k]]:state.config[k]]));
    store(STORAGE.presets,CHANNEL_PRESETS);
  }
}
function refreshPresetUI(){
  const c=state.config;
  setButtons($ui.machineChoices,'machine',c.machine);setButtons($ui.wheelKinds,'kind',c.kind);setButtons($ui.wheelSources,'source',c.source);
  $ui.stageMachineLabel.textContent=MACHINES[c.machine];
  $ui.remoteFilters.hidden=c.source!=='catalog';$ui.ownFilters.hidden=c.source!=='own';
  $('#favoriteFilters').hidden=c.source!=='favorites';$('#videoFilters').hidden=c.source!=='video';
  $ui.soundTheme.value=c.sound;$ui.volume.value=String(c.volume);$ui.noRepeats.checked=Boolean(c.noRepeats);
  $('#excludePlayed').checked=Boolean(c.excludePlayed);$ui.wheelQuery.value=c.q;
  renderWheelGenres();syncYearInputs('wheel',c);updateMusicUI();
}
const firstChannel=CHANNELS[state.theme.channel]?state.theme.channel:'neon';
if(CHANNEL_PRESETS[firstChannel])Object.assign(cfg,safePreset(CHANNEL_PRESETS[firstChannel])||{});
else if(!Object.keys(localObject(STORAGE.cfg)).length){cfg.machine=CHANNEL_META[firstChannel].machine;cfg.sound=CHANNEL_META[firstChannel].sound}
function toast(text){clearTimeout(state.toastTimeout);$ui.toast.textContent=text;$ui.toast.hidden=false;state.toastTimeout=setTimeout(()=>{$ui.toast.hidden=true},3200)}
function selectedFavs(){return state.favorites.filter(g=>state.selectedFavorites.has(favKey(g)))}
function saveSelections(){store(STORAGE.sel,[...state.selectedFavorites]);updateSelectedInfo();if(state.config.source==='favorites'&&state.page==='roulette')queuePrepare()}
function updateSelectedInfo(){
  const count=selectedFavs().length;
  $ui.favoritesSelectedInfo.textContent=`Выбрано для рулетки: ${count}`;
  $ui.favoritePoolInfo.textContent=count?`В рандомайзере участвуют ${count} сохранённых игр.`:'Выбери игры в разделе «Избранное».';
}
function updateFavCount(){$ui.favCount.textContent=String(state.favorites.length);updateSelectedInfo()}
function hasFav(game){return state.favorites.some(g=>favKey(g)===favKey(game))}
function playKey(game){return game.kind==='custom'?'customname:'+String(game.name||'').trim().toLowerCase():favKey(game)}
function hasPlayed(game){return state.played.has(playKey(game))}
function savePlayed(){store(STORAGE.played,[...state.played]);const count=document.querySelector('#playedCount');if(count)count.textContent='Пройдено: '+state.played.size;}
function togglePlayed(game){
  const key=playKey(game),yes=!state.played.has(key);
  if(yes)state.played.add(key);else state.played.delete(key);
  savePlayed();toast(yes?'Игра отмечена как пройденная':'Игра возвращена в планы');
  if(state.page==='favorites')renderFavorites();
  if(state.page==='catalog')renderCatalogCards();
  if(state.chosen)updateWinnerPlayed();
  if(state.page==='roulette'&&!state.spinning)queuePrepare();
}
function toggleFav(game){
  const key=favKey(game);const index=state.favorites.findIndex(g=>favKey(g)===key);
  if(index>=0){state.favorites.splice(index,1);state.selectedFavorites.delete(key);toast('Убрано из избранного')}
  else{const normalized=normalizeGame(game);state.favorites.unshift(normalized);state.favorites=state.favorites.slice(0,300);state.selectedFavorites.add(favKey(normalized));toast('Сохранено в избранном ♡')}
  store(STORAGE.fav,state.favorites);saveSelections();updateFavCount();
  if(state.page==='favorites')renderFavorites();
  if(state.page==='catalog')renderCatalogCards();
  if(state.chosen)updateWinnerFav();
}
function selectFavorite(game,yes){
  if(yes)state.selectedFavorites.add(favKey(game));else state.selectedFavorites.delete(favKey(game));
  saveSelections();
}
function manualFavorite(name){
  name=String(name||'').trim().slice(0,180);if(!name)return;
  const id='manual_'+Array.from(name.toLowerCase()).reduce((h,c)=>(Math.imul(h,33)+c.codePointAt(0))>>>0,5381).toString(16);
  const game={id,name,kind:'custom',image:'',date:'',url:fallbackSearch(name)};
  if(hasFav(game)){toast('Эта игра уже добавлена');return}
  toggleFav(game);
}
function gameLabel(kind){return kind==='demo'?'ДЕМО':kind==='custom'?'МОЙ СПИСОК':'ПОЛНАЯ ИГРА'}
function createCover(game,cls=''){
  const imgSrc=safeImage(game.image);
  if(!imgSrc){const div=document.createElement('div');div.className=cls||'cover-fallback';div.textContent='✺';return div}
  const img=document.createElement('img');img.loading='lazy';img.src=imgSrc;img.alt='Обложка игры '+game.name;
  img.addEventListener('error',()=>{const fallback=document.createElement('div');fallback.className=cls||'cover-fallback';fallback.textContent='✺';img.replaceWith(fallback)},{once:true});return img;
}
function makeGameCard(game){
  const article=document.createElement('article');article.className='game-card';
  const picture=document.createElement('div');picture.className='card-picture';picture.append(createCover(game));
  const badge=document.createElement('span');badge.className='card-type';badge.textContent=gameLabel(game.kind);
  const fav=document.createElement('button');fav.type='button';fav.className='favorite-button';fav.textContent=hasFav(game)?'♥':'♡';fav.setAttribute('aria-pressed',String(hasFav(game)));fav.setAttribute('aria-label',(hasFav(game)?'Убрать из избранного: ':'Добавить в избранное: ')+game.name);fav.addEventListener('click',()=>toggleFav(game));
  picture.append(badge,fav);
  const info=document.createElement('div');info.className='game-info';
  const title=document.createElement('h3');title.className='game-title';title.textContent=game.name;
  const meta=document.createElement('div');meta.className='game-meta';
  const date=document.createElement('span');date.textContent=game.date||'Дата не указана';
  const kind=document.createElement('strong');kind.textContent=game.kind==='demo'?'ПОПРОБОВАТЬ':'СТРАНИЦА ИГРЫ';meta.append(date,kind);
  const link=document.createElement('a');link.className='game-link';link.href=safeUrl(game.url,game.name);link.target='_blank';link.rel='noopener noreferrer';link.innerHTML='<span>ОТКРЫТЬ ИГРУ</span><span aria-hidden="true">↗</span>';
  const played=document.createElement('button');played.type='button';played.className='game-played-toggle'+(hasPlayed(game)?' is-played':'');played.textContent=hasPlayed(game)?'✓ ПРОЙДЕНО':'○ ОТМЕТИТЬ ПРОХОЖДЕНИЕ';played.setAttribute('aria-pressed',String(hasPlayed(game)));played.setAttribute('aria-label','Пройдено: '+game.name);played.addEventListener('click',()=>togglePlayed(game));
  info.append(title,meta,link,played);article.append(picture,info);return article;
}
function makeEmpty(title,desc){const el=document.createElement('div');el.className='empty-state';const mark=document.createElement('div');mark.className='empty-symbol';mark.textContent='✳';const name=document.createElement('strong');name.textContent=title;const text=document.createElement('p');text.textContent=desc;el.append(mark,name,text);return el}
function showAlert(target,title,message,url){
  target.replaceChildren();const h=document.createElement('h3');h.textContent=title;const p=document.createElement('p');p.textContent=message;target.append(h,p);
  if(url){const a=document.createElement('a');a.href=safeUrl(url);a.target='_blank';a.rel='noopener noreferrer';a.textContent='Продолжить поиск в магазине ↗';target.append(a)}
  target.hidden=false;
}
function buildGenreChoices(root,selected,onToggle,compact=false){
  root.replaceChildren();
  for(const [id,title,icon] of GENRES){
    if(id==='all')continue;
    const active=selected.includes(id);
    const button=document.createElement('button');
    button.type='button';button.dataset.genre=id;
    button.className=(compact?'wheel-genre-chip':'genre-button')+(active?' is-selected':'');
    button.setAttribute('aria-pressed',String(active));
    button.setAttribute('aria-label',title+(active?', выбран':', не выбран'));
    const glyph=document.createElement('span');glyph.className=compact?'chip-icon':'genre-glyph';glyph.textContent=icon;
    const label=document.createElement('span');label.textContent=title;
    const tick=document.createElement('span');tick.className=compact?'chip-check':'genre-tick';tick.textContent=active?'✓':'+';
    button.append(glyph,label,tick);
    button.addEventListener('click',()=>onToggle(id));root.append(button);
  }
}
function renderGenres(){
  const c=state.catalog;
  buildGenreChoices($('#catalogGenres'),c.genres,id=>{
    const next=updateSelectedGenre(c.genres,id);if(!next)return;
    c.genres=next;saveCatalogFilters();renderGenres();fetchCatalog();
  });
  $('#catalogGenreCount').textContent=String(c.genres.length);
  $('#catalogClearGenres').disabled=c.genres.length===0;
  setGenreButtons($('#catalogGenreMode'),c.genreMode);
  $ui.catalogGenre.textContent=c.genres.length?`${c.genres.length} ${c.genres.length===1?'ЖАНР':c.genres.length<5?'ЖАНРА':'ЖАНРОВ'} / ${c.genreMode==='any'?'ЛЮБОЙ':'ВСЕ СРАЗУ'}`:'ВСЕ ЖАНРЫ';
  $('#catalogGenreHelp').textContent=c.genres.length?formatGenres(c.genres):`Выбери до ${MAX_GENRES} жанров. Можно искать любой из них или сочетание всех.`;
}
function renderWheelGenres(){
  const c=state.config;
  buildGenreChoices($ui.wheelGenres,c.genres,id=>{
    const next=updateSelectedGenre(c.genres,id);if(!next)return;
    c.genres=next;saveCfg();renderWheelGenres();queuePrepare();
  },true);
  $('#wheelGenreCount').textContent=String(c.genres.length);
  $('#wheelClearGenres').disabled=c.genres.length===0;
  setGenreButtons($('#wheelGenreMode'),c.genreMode);
}
function renderCatalogCards(){
  $ui.catalogGrid.replaceChildren();
  if(!state.catalog.games.length){$ui.catalogGrid.append(makeEmpty('ИГРЫ НЕ НАЙДЕНЫ',yearRange(state.catalog)?'В просмотренных результатах игр этого года нет. Нажми «Показать ещё» или измени годы.':'Попробуй другой жанр или запрос.'));return}
  const frag=document.createDocumentFragment();state.catalog.games.forEach(g=>frag.append(makeGameCard(g)));$ui.catalogGrid.append(frag);
}
function renderSkeleton(){ $ui.catalogGrid.replaceChildren();for(let i=0;i<6;i++){const el=document.createElement('div');el.className='skeleton-card';$ui.catalogGrid.append(el)}}
async function fetchCatalog(more=false){
  if(state.page!=='catalog')return;
  const c=state.catalog;const req=++c.req;const page=more?c.page+1:1;
  if(!more){c.page=0;c.games=[];renderSkeleton();$ui.catalogAlert.hidden=true}
  $ui.more.disabled=true;$ui.catalogStatus.textContent='ИЩЕМ ИГРЫ...';
  const q=new URLSearchParams({q:c.q,genres:c.genres.join(','),genre_mode:c.genreMode,kind:c.kind,sort:c.sort,page:String(page)});
  addYearFilters(q,c);
  try{
    const r=await fetch('/api/games?'+q);const result=await r.json();
    if(req!==c.req||state.page!=='catalog')return;
    if(!r.ok)throw {message:result.error||'Не удалось загрузить каталог.',url:result.source_url};
    const games=validGames(result.games);
    c.page=page;c.games=more?[...c.games,...games.filter(g=>!c.games.some(known=>favKey(known)===favKey(g)))]:games;
    c.total=Number(result.total)||c.games.length;c.hasMore=Boolean(result.has_more);
    const countText=result.sampled_years?'НАЙДЕНО В ПРОВЕРЕННЫХ РЕЗУЛЬТАТАХ':result.approximate_total?'ПРИМЕРНО ПО ТЕГАМ':'НАЙДЕНО';
    $ui.catalogStatus.textContent=`${countText}: ${new Intl.NumberFormat('ru-RU').format(c.total)} / ПОКАЗАНО: ${c.games.length}`;
    $ui.more.hidden=!c.hasMore;renderCatalogCards();
  }catch(err){
    if(req!==c.req||state.page!=='catalog')return;
    if(!more){$ui.catalogGrid.replaceChildren();c.games=[]}
    $ui.more.hidden=true;$ui.catalogStatus.textContent='КАТАЛОГ НЕДОСТУПЕН';
    showAlert($ui.catalogAlert,'Не удалось получить игры',err?.message||'Проверь подключение и попробуй ещё раз. Данные каталога загружаются из магазина, а не из выдуманной базы.',err?.url);
  }finally{if(req===c.req)$ui.more.disabled=false}
}
function renderFavorites(){
  $ui.favorites.replaceChildren();const q=$ui.favoritesSearch.value.trim().toLowerCase();
  let filtered=state.favorites.filter(g=>g.name.toLowerCase().includes(q)&&(
    state.favoritesView==='all'||(state.favoritesView==='played'?hasPlayed(g):!hasPlayed(g))));
  filtered=globalThis.GP10?.filterLibrary?.(filtered)||filtered;
  document.querySelectorAll('[data-played-filter]').forEach(b=>{const selected=b.dataset.playedFilter===state.favoritesView;b.classList.toggle('is-selected',selected);b.setAttribute('aria-pressed',String(selected))});
  savePlayed();
  if(!filtered.length){$ui.favorites.append(makeEmpty('ПОКА ПУСТО',q?'По запросу ничего не найдено.':'Нажми ♡ на карточке игры или добавь название вручную.'));return}
  for(const game of filtered){
    const wrapper=document.createElement('div');wrapper.className='favorite-choice';
    const checkbox=document.createElement('label');checkbox.className='favorite-pick-toggle';
    const input=document.createElement('input');input.type='checkbox';input.checked=state.selectedFavorites.has(favKey(game));input.setAttribute('aria-label','Участвует в рулетке: '+game.name);
    input.addEventListener('change',()=>selectFavorite(game,input.checked));
    const label=document.createElement('span');label.textContent='В РУЛЕТКУ';checkbox.append(input,label);wrapper.append(makeGameCard(game),checkbox);globalThis.GP10?.decorateLibraryCard?.(wrapper,game);$ui.favorites.append(wrapper);
  }
  updateSelectedInfo();
}
function showPage(page){
  if(!['catalog','roulette','favorites','creators','themes'].includes(page))page='catalog';
  if(page!=='roulette'&&state.audioPreview)stopSound();
  state.page=page;
  for(const [key,el] of Object.entries($ui.pages))el.hidden=key!==page;
  $$('.nav-link').forEach(b=>{const selected=b.dataset.page===page;b.classList.toggle('is-active',selected);if(selected)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
  if(page==='catalog'&&!state.catalog.page)fetchCatalog();
  if(page==='roulette')preparePool();
  if(page==='favorites')renderFavorites();
  if(page==='creators')globalThis.gamepickCreators?.render?.();
  if(['http:','https:'].includes(location.protocol))history.replaceState(null,'',page==='catalog'?location.pathname+location.search:'#'+page);
  window.scrollTo({top:0,behavior:'smooth'});
}
function setButtons(group,attr,value){
  $$('button',group).forEach(b=>{const yes=b.dataset[attr]===value;b.classList.toggle('is-selected',yes);b.setAttribute('aria-pressed',String(yes))});
}
function parseOwn(){
  const raw=$ui.ownGames.value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).slice(0,250);
  const seen=new Set();const games=[];
  for(const line of raw){const parts=line.split('|');const name=(parts[0]||'').trim().slice(0,180);if(!name)continue;
    const clean=name.toLowerCase();if(seen.has(clean))continue;seen.add(clean);
    const link=(parts[1]||'').trim();const stableName=Array.from(name).reduce((h,c)=>(Math.imul(h,31)+c.codePointAt(0))>>>0,37).toString(16);
    games.push({id:'own_'+stableName+'_'+games.length,name,image:'',date:'',url:safeUrl(link,name),kind:'custom'});
  }
  return games;
}
function poolKey(){const c=state.config;return JSON.stringify([c.source,c.kind,c.genres,c.genreMode,c.q.trim(),c.period,c.yearFrom,c.yearTo,c.excludePlayed?[...state.played].sort():[],c.source==='own'?getRaw(STORAGE.own):c.source==='favorites'?[...state.selectedFavorites].sort():c.source==='video'?globalThis.channelHub?.selectionToken?.():'',c.noRepeats?state.history.slice(0,20).map(g=>g.id):[]])}
function updatePoolUi(count){
  if(!state.loadingPool && state.config.excludePlayed)count=state.pool.filter(g=>!hasPlayed(g)).length;
  $ui.spinButton.disabled=state.spinning||state.loadingPool||count<1;
  $ui.spinLabel.textContent=state.spinning?'ВРАЩЕНИЕ...':state.loadingPool?'ПОДБИРАЕМ...':'ВРАЩАТЬ!';
  $ui.poolStatus.textContent=state.loadingPool?'Загружаем реальные игры…':count?`${count} игр готовы к случайному выбору`:'Добавь игры или измени фильтры';
}
let prepDebounce=0;
function queuePrepare(){clearTimeout(prepDebounce);state.poolReq++;state.loadingPool=true;updatePoolUi(0);prepDebounce=setTimeout(preparePool,390)}
async function preparePool(){
  const id=++state.poolReq;const key=poolKey();state.poolKey=key;state.loadingPool=true;updatePoolUi(0);
  if(state.config.source==='own'||state.config.source==='favorites'||state.config.source==='video'){
    state.pool=state.config.source==='own'?parseOwn():state.config.source==='favorites'?selectedFavs():(globalThis.channelHub?.videoGames?.()||[]);
    state.loadingPool=false;updatePoolUi(state.pool.length);$ui.rouletteAlert.hidden=true;
    if(!state.spinning&&!state.chosen)showReady();return;
  }
  const c=state.config;
  const q=new URLSearchParams({kind:c.kind,genres:c.genres.join(','),genre_mode:c.genreMode,q:c.q.trim()});
  addYearFilters(q,c);
  const recent=c.noRepeats?state.history.filter(g=>g.kind!=='custom').slice(0,30):[];
  const played=c.excludePlayed?state.favorites.concat(state.history).filter(g=>hasPlayed(g)&&g.kind!=='custom'):[];
  const playedIds=c.excludePlayed?[...state.played].map(k=>k.match(/^(?:demo|full):(\d+)$/)?.[1]).filter(Boolean):[];
  const exclusions=[...new Set([...recent,...played].map(g=>g.id).concat(playedIds).filter(id=>/^\d+$/.test(id)))].slice(0,70);
  if(exclusions.length)q.set('exclude',exclusions.join(','));
  try{
    const res=await fetch('/api/wheel?'+q);const data=await res.json();
    if(id!==state.poolReq)return;
    if(!res.ok)throw {message:data.error||'Не удалось получить игры.',url:data.source_url};
    state.pool=validGames(data.games);state.loadingPool=false;updatePoolUi(state.pool.length);$ui.rouletteAlert.hidden=true;
    if(!state.spinning&&!state.chosen)showReady();
  }catch(err){
    if(id!==state.poolReq)return;
    state.pool=[];state.loadingPool=false;updatePoolUi(0);
    showAlert($ui.rouletteAlert,'Не получается собрать рулетку',err.message||'Каталог временно не отвечает. Попробуй сменить фильтры или выбери «Мой список».',err.url);
    if(!state.spinning&&!state.chosen)showReady();
  }
}
function showReady(){
  if(state.spinning)return;
  $ui.visual.replaceChildren();const wrap=document.createElement('div');wrap.className='stage-empty';
  const symbol=document.createElement('div');symbol.className='stage-empty-symbol';symbol.textContent=state.config.machine==='case'?'▰':state.config.machine==='drum'?'▤':state.config.machine==='casino'?'♠':'✺';
  const title=document.createElement('h2');title.textContent=state.pool.length?'РУЛЕТКА ГОТОВА':'ТВОЙ СЛЕДУЮЩИЙ ХОД';
  const p=document.createElement('p');p.textContent=state.pool.length?'Нажми «Вращать!» — случай выберет игру':'Настрой список, затем запускай вращение';wrap.append(symbol,title,p);$ui.visual.append(wrap);
  $ui.stageStatus.textContent=state.pool.length?'READY':'STANDBY';$ui.stageHint.textContent='Выбран режим: '+({wheel:'колесо',case:'кейс',drum:'барабан',casino:'казино'}[state.config.machine]);
}
function setMachine(machine){if(state.spinning)return;state.config.machine=machine;setButtons($ui.machineChoices,'machine',machine);$ui.stageMachineLabel.textContent=MACHINES[machine];saveCfg();if(!state.chosen)showReady()}
function setSource(source){if(state.spinning)return;state.config.source=source;setButtons($ui.wheelSources,'source',source);$ui.remoteFilters.hidden=source!=='catalog';$ui.ownFilters.hidden=source!=='own';$('#favoriteFilters').hidden=source!=='favorites';$('#videoFilters').hidden=source!=='video';saveCfg();queuePrepare()}
function setKind(kind){if(state.spinning)return;state.config.kind=kind;setButtons($ui.wheelKinds,'kind',kind);saveCfg();queuePrepare()}
function updateMusicUI(){stopSound();$ui.previewSound.disabled=state.config.sound==='silent';saveCfg()}
function stopSound(){if(state.audio){state.audio.pause();state.audio.currentTime=0;state.audio=null}state.audioPreview=false;$ui.previewSound.textContent='▶ Послушать'}
function startSound(preview=false){
  stopSound();const info=MUSIC[activeSound()];if(!info.file)return;
  const audio=new Audio('/static/audio/'+info.file);audio.preload='auto';audio.volume=state.config.volume/100;
  audio.addEventListener('ended',()=>{if(state.audio===audio){state.audio=null;state.audioPreview=false;$ui.previewSound.textContent='▶ Послушать'}});
  state.audio=audio;state.audioPreview=preview;if(preview)$ui.previewSound.textContent='■ Остановить';
  audio.play().catch(()=>{if(preview)toast('Браузер запретил воспроизведение. Нажми ещё раз.');state.audioPreview=false;$ui.previewSound.textContent='▶ Послушать'});
}
function shuffleCopy(games){const arr=[...games];for(let i=arr.length-1;i>0;i--){const k=randomIndex(i+1);[arr[i],arr[k]]=[arr[k],arr[i]]}return arr}
function eligiblePool(){
  let pool=state.config.excludePlayed?state.pool.filter(g=>!hasPlayed(g)):state.pool;
  if(state.config.noRepeats){const historyKeys=new Set(state.history.slice(0,30).map(favKey));const fresh=pool.filter(g=>!historyKeys.has(favKey(g)));if(fresh.length)pool=fresh}
  return pool;
}
function setTransition(el,transform,duration){
  el.style.transition='none';el.style.transform=transform.initial;
  void el.offsetWidth;
  requestAnimationFrame(()=>{requestAnimationFrame(()=>{el.style.transition=`transform ${duration}ms cubic-bezier(.11,.77,.065,1)`;el.style.transform=transform.final})});
}
function renderWheel(games,winner,duration,casino=false){
  const wrap=document.createElement('div');wrap.className=casino?'casino-wheel-wrap':'roulette-wheel-wrap';
  const rim=document.createElement('div');rim.className=casino?'casino-rim':'wheel-shell';wrap.append(rim);
  const disc=document.createElement('div');disc.className=casino?'casino-disc':'wheel-disc';
  const n=games.length;const step=360/n;
  const colors=games.map((_,i)=>casino?(i===0?'#307453':i%2===0?'#2a2c31':'#aa3d40'):DISC_COLORS[i%DISC_COLORS.length]);
  disc.style.background='conic-gradient('+colors.map((color,i)=>`${color} ${(i*100/n).toFixed(4)}% ${((i+1)*100/n).toFixed(4)}%`).join(',')+')';
  for(let i=0;i<n;i++){
    const label=document.createElement('div');label.className=casino?'casino-number':'wheel-wedge';
    const text=document.createElement('span');text.textContent=casino?String(i+1):games[i].name;
    label.append(text);disc.append(label);
  }
  wrap.append(disc);
  const hub=document.createElement('div');hub.className=casino?'casino-center':'wheel-hub';hub.textContent=casino?'♠':'✺';wrap.append(hub);
  if(casino){const ball=document.createElement('div');ball.className='casino-ball-orbit';wrap.append(ball);const label=document.createElement('div');label.className='casino-title';label.textContent='LUCKY SEVEN';wrap.append(label);
    setTransition(ball,{initial:'rotate(0deg)',final:'rotate(-3600deg)'},duration);
  }else{const pointer=document.createElement('div');pointer.className='wheel-pointer';wrap.append(pointer)}
  $ui.visual.replaceChildren(wrap);
  const radius=disc.getBoundingClientRect().width*(casino?.365:.34);
  $$(casino?'.casino-number':'.wheel-wedge',disc).forEach((label,i)=>{const angle=step*(i+.5);label.style.transform=`rotate(${angle}deg) translateY(-${radius}px) rotate(${-angle}deg)`});
  const angle=360*7+((360-step*(winner+.5))%360+360)%360;
  setTransition(disc,{initial:'rotate(0deg)',final:`rotate(${angle}deg)`},duration);
}
function renderCase(games,winner,duration){
  const scene=document.createElement('div');scene.className='case-scene';const heading=document.createElement('div');heading.className='case-header';heading.textContent='✦ OPENING / RANDOM DROP ✦';
  const viewport=document.createElement('div');viewport.className='case-window';const track=document.createElement('div');track.className='case-track';
  const cycles=9;
  for(let i=0;i<cycles*games.length;i++){
    const g=games[i%games.length];const tile=document.createElement('div');tile.className='case-card';const cover=createCover(g,'fallback-mini');if(cover.tagName==='IMG')cover.loading='eager';tile.append(cover);
    const name=document.createElement('strong');name.textContent=g.name;const tag=document.createElement('small');tag.textContent=gameLabel(g.kind);tile.append(name,tag);track.append(tile);
  }
  viewport.append(track);const marker=document.createElement('div');marker.className='case-marker';viewport.append(marker);
  const footer=document.createElement('div');footer.className='scene-tag';footer.textContent='THE NEXT DROP IS YOUR GAME';scene.append(heading,viewport,footer);$ui.visual.replaceChildren(scene);
  const target=7*games.length+winner;
  const tile=track.children[0];const rect=tile.getBoundingClientRect();const width=rect.width||174;const gap=parseFloat(getComputedStyle(track).gap)||12;
  const finalX=viewport.clientWidth/2-(target*(width+gap)+width/2);
  setTransition(track,{initial:'translateX(0px)',final:`translateX(${finalX}px)`},duration);
}
function renderDrum(games,winner,duration){
  const scene=document.createElement('div');scene.className='drum-scene';const heading=document.createElement('div');heading.className='drum-header';heading.textContent='ВРАЩАЙТЕ БАРАБАН!';
  const viewport=document.createElement('div');viewport.className='drum-window';const strip=document.createElement('div');strip.className='drum-strip';
  for(let i=0;i<games.length*9;i++){
    const g=games[i%games.length];const tile=document.createElement('div');tile.className='drum-tile';const cover=createCover(g,'fallback-drum');if(cover.tagName==='IMG')cover.loading='eager';tile.append(cover);
    const name=document.createElement('strong');name.textContent=g.name;tile.append(name);strip.append(tile);
  }
  const highlight=document.createElement('div');highlight.className='drum-highlight';viewport.append(strip,highlight);
  for(const side of ['left','right'])for(const vertical of ['top','bottom']){const bolt=document.createElement('div');bolt.className='drum-bolt '+side+(vertical==='bottom'?' bottom':'');viewport.append(bolt)}
  const footer=document.createElement('div');footer.className='scene-tag';footer.textContent='ЧТО ЖЕ НАМ СЕГОДНЯ ВЫПАДЕТ?';scene.append(heading,viewport,footer);$ui.visual.replaceChildren(scene);
  const row=strip.children[0].getBoundingClientRect().height||86;const target=games.length*7+winner;
  const finalY=viewport.clientHeight/2-(target*row+row/2);
  setTransition(strip,{initial:'translateY(0px)',final:`translateY(${finalY}px)`},duration);
}
function stopSpinMotion(){clearTimeout(state.spinTimeout)}
async function publish(event,game=null,duration=0){
  if(!state.room)return;
  const body={status:event,machine:state.config.machine,duration,game:game?normalizeGame(game):null,theme:state.theme.channel,accent:themeAccent(),...globalThis.GP10?.streamExtra?.(event)};
  try{await fetch('/api/stream/'+encodeURIComponent(state.room),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'})}catch{/* OBS connection is optional */}
}
function spin(){
  if(state.spinning||state.loadingPool)return;
  if(!state.pool.length){toast('Нет игр для вращения. Загрузи каталог или добавь свой список.');return}
  const eligible=eligiblePool();if(!eligible.length){toast('Все подходящие игры уже отмечены как пройденные. Отключи фильтр или добавь новые.');return}
  const games=shuffleCopy(state.pool);
  // Randomize winning game from fresh entries, then place it in a random visible segment.
  const chosen=eligible[randomIndex(eligible.length)];
  if(!games.some(g=>favKey(g)===favKey(chosen)))games[0]=chosen;
  const segment=games.findIndex(g=>favKey(g)===favKey(chosen));
  const duration=MUSIC[activeSound()].duration;
  globalThis.GP10?.beforeSpin?.(chosen,duration);
  const displayGames=globalThis.GP10?.displayGames?.(games)||games;
  state.spinning=true;state.chosen=chosen;$ui.result.hidden=true;$ui.rouletteAlert.hidden=true;
  $ui.stage.classList.add('is-spinning');$ui.stageStatus.textContent='ROLLING...';$ui.stageHint.textContent='Идёт вращение. Скоро узнаем результат...';updatePoolUi(state.pool.length);
  startSound(false);
  if(state.config.machine==='case')renderCase(displayGames,segment,duration);
  else if(state.config.machine==='drum')renderDrum(displayGames,segment,duration);
  else renderWheel(displayGames,segment,duration,state.config.machine==='casino');
  publish('spinning',null,duration);
  stopSpinMotion();state.spinTimeout=setTimeout(()=>finishSpin(chosen),duration+110);
}
function finishSpin(game){
  state.spinning=false;$ui.stage.classList.remove('is-spinning');$ui.stageStatus.textContent='WINNER!';$ui.stageHint.textContent='СЛУЧАЙ ВЫБРАЛ: '+game.name;
  $ui.winnerName.textContent=game.name;$ui.winnerKind.textContent=gameLabel(game.kind);
  $ui.winnerLink.href=safeUrl(game.url,game.name);
  const src=safeImage(game.image);$ui.winnerImage.src=src||'/static/favicon.svg';$ui.winnerImage.style.objectFit=src?'cover':'contain';$ui.winnerImage.style.background=src?'':'#22342a';$ui.winnerImage.alt=src?'Обложка: '+game.name:'Значок игры без обложки';
  $ui.result.hidden=false;updateWinnerFav();updateWinnerPlayed();globalThis.GP10?.afterSpin?.(game);
  state.history=[normalizeGame(game),...state.history.filter(g=>favKey(g)!==favKey(game))].slice(0,70);store(STORAGE.hist,state.history);renderHistory();
  publish('winner',game,0);updatePoolUi(state.pool.length);
  // Refresh available picks after the landing so the next round avoids the latest game.
  if(state.config.source==='catalog'){setTimeout(()=>{if(!state.spinning&&state.page==='roulette')preparePool()},350)}
}
function updateWinnerFav(){if(!state.chosen)return;$ui.winnerFav.textContent=hasFav(state.chosen)?'♥ В ИЗБРАННОМ':'♡ СОХРАНИТЬ'}
function updateWinnerPlayed(){if(!state.chosen)return;const b=document.querySelector('#winnerPlayed');if(b){b.textContent=hasPlayed(state.chosen)?'✓ ПРОЙДЕНО':'○ ЕЩЁ НЕ ИГРАЛ';b.classList.toggle('is-played',hasPlayed(state.chosen))}}
function renderHistory(){
  $ui.history.replaceChildren();
  if(!state.history.length){$ui.history.append(makeEmpty('ПОКА НЕТ ВЫПАДЕНИЙ','После первого вращения здесь появятся выбранные игры.'));return}
  for(const g of state.history.slice(0,12)){
    const item=document.createElement('article');item.className='history-item';item.append(createCover(g,'history-icon'));
    const info=document.createElement('div');const a=document.createElement('a');a.href=safeUrl(g.url,g.name);a.target='_blank';a.rel='noopener noreferrer';
    const title=document.createElement('strong');title.textContent=g.name;a.append(title);const tag=document.createElement('small');tag.textContent=gameLabel(g.kind);info.append(a,tag);item.append(info);$ui.history.append(item)
  }
}
function ensureRoom(){
  if(state.room)return state.room;
  const old=getRaw(STORAGE.room);
  if(/^[a-f0-9]{32}$/.test(old))state.room=old;
  else{
    const bytes=new Uint8Array(16);if(globalThis.crypto?.getRandomValues)crypto.getRandomValues(bytes);else for(let i=0;i<16;i++)bytes[i]=Math.floor(Math.random()*256);
    state.room=Array.from(bytes).map(n=>n.toString(16).padStart(2,'0')).join('');putRaw(STORAGE.room,state.room);
  }
  return state.room;
}
function showOverlayDialog(){
  ensureRoom();const url=location.origin+'/overlay?room='+encodeURIComponent(state.room)+'&theme='+encodeURIComponent(state.theme.channel)+'&accent='+encodeURIComponent(themeAccent());
  $ui.overlayUrl.value=url;$('#openOverlay').href=url;
  if(typeof $ui.overlayDialog.showModal==='function')$ui.overlayDialog.showModal();else $ui.overlayDialog.setAttribute('open','');
}
async function copyOverlay(){
  try{if(navigator.clipboard?.writeText)await navigator.clipboard.writeText($ui.overlayUrl.value);else throw Error('fallback');toast('Ссылка для OBS скопирована!')}
  catch{$ui.overlayUrl.focus();$ui.overlayUrl.select();try{document.execCommand('copy');toast('Ссылка скопирована!')}catch{toast('Выдели ссылку и нажми Ctrl+C')}}
}
function toggleVideoMode(){
  showPage('roulette');const page=$ui.pages.roulette;
  page.classList.toggle('is-video-mode');
  if(page.classList.contains('is-video-mode')){page.requestFullscreen?.().catch(()=>{});toast('Режим записи: ПРОБЕЛ — вращать, ESC — выход')}
  else if(document.fullscreenElement)document.exitFullscreen?.();
}
function readHashPage(){const hash=location.hash.replace('#','');return ['catalog','roulette','favorites','creators','themes'].includes(hash)?hash:'catalog'}
function themeAccent(){return state.theme.accents?.[state.theme.channel]||CHANNELS[state.theme.channel]||CHANNELS.neon}
function applyTheme(){
  if(!CHANNELS[state.theme.channel])state.theme.channel='neon';
  const channel=CHANNEL_META[state.theme.channel];
  document.body.dataset.channel=state.theme.channel;
  document.body.style.setProperty('--acid',themeAccent());
  const color=$('#channelAccent');if(color)color.value=themeAccent();
  const content={channelEyebrow:channel.eyebrow,creatorSignature:channel.signature,showcaseMode:channel.showcase,
    heroGlyph:channel.glyph,heroArtTitle:channel.artTitle,heroArtSub:channel.artSub,
    rouletteEyebrow:channel.roulette,channelBadgeGlyph:channel.glyph,channelBadgeName:channel.label,
    channelBadgeTag:channel.tag,stageBrand:channel.short,winnerBrand:channel.winner,
    themeDemoGlyph:channel.glyph,themeDemoName:channel.label,themeDemoText:channel.description};
  for(const [id,value] of Object.entries(content)){const el=document.getElementById(id);if(el)el.textContent=value}
  document.title='GAMEPICK · '+channel.label+' — во что играть';
  const icon=document.querySelector('link[rel="icon"]');
  if(icon)icon.href='/static/favicon.svg';
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.content=CHANNELS[state.theme.channel];
  $$('#channelThemes button').forEach(b=>{const yes=b.dataset.channel===state.theme.channel;b.classList.toggle('is-selected',yes);b.setAttribute('aria-pressed',String(yes))});
  $$('[data-quick-channel]').forEach(b=>{const yes=b.dataset.quickChannel===state.theme.channel;b.classList.toggle('is-selected',yes);b.setAttribute('aria-pressed',String(yes))});
  store(STORAGE.theme,state.theme);
  globalThis.gamepickCreators?.onTheme?.();globalThis.GP10?.onThemeChanged?.();
}
function setChannel(channel){
  if(!CHANNELS[channel]||state.spinning)return;
  if(state.theme.channel===channel){applyTheme();return}
  saveCfg(); // Store outgoing channel choices first.
  stopSound();state.theme.channel=channel;
  const saved=safePreset(CHANNEL_PRESETS[channel]);
  if(saved)Object.assign(cfg,saved);
  else {cfg.machine=CHANNEL_META[channel].machine;cfg.sound=CHANNEL_META[channel].sound}
  refreshPresetUI();applyTheme();saveCfg();
  if(state.page==='roulette'){state.chosen=null;$ui.result.hidden=true;showReady();queuePrepare()}
  toast('Оформление и настройки '+CHANNEL_META[channel].label+' включены');
}
function applyChannelShow(){
  const profile=CHANNEL_META[state.theme.channel];
  if(!profile||state.spinning)return;
  setMachine(profile.machine);
  state.config.sound=profile.sound;
  $ui.soundTheme.value=profile.sound;
  updateMusicUI();
  showPage('roulette');
  toast('Оформление '+profile.label+' готово — можно вращать!');
}
function previewChannelOverlay(){
  ensureRoom();
  const url=location.origin+'/overlay?room='+encodeURIComponent(state.room)+'&theme='+encodeURIComponent(state.theme.channel)+'&accent='+encodeURIComponent(themeAccent())+'&preview=1';
  window.open(url,'_blank','noopener,noreferrer');
}

function init(){
  // Restore settings and collections.
  $ui.ownGames.value=getRaw(STORAGE.own);
  document.querySelector('#excludePlayed').checked=Boolean(cfg.excludePlayed);savePlayed();
  if(!state.selectedFavorites.size&&!getRaw(STORAGE.sel))state.favorites.forEach(g=>state.selectedFavorites.add(favKey(g)));
  applyTheme();
  $ui.soundTheme.value=cfg.sound;$ui.previewSound.disabled=cfg.sound==='silent';$ui.volume.value=String(cfg.volume);$ui.noRepeats.checked=Boolean(cfg.noRepeats);
  renderWheelGenres();$ui.wheelQuery.value=cfg.q;
  setButtons($ui.machineChoices,'machine',cfg.machine);setButtons($ui.wheelKinds,'kind',cfg.kind);setButtons($ui.wheelSources,'source',cfg.source);
  $ui.remoteFilters.hidden=cfg.source!=='catalog';$ui.ownFilters.hidden=cfg.source!=='own';$('#favoriteFilters').hidden=cfg.source!=='favorites';$('#videoFilters').hidden=cfg.source!=='video';$ui.stageMachineLabel.textContent=MACHINES[cfg.machine];
  updateFavCount();renderGenres();renderHistory();showReady();
  $$('.nav-link').forEach(b=>b.addEventListener('click',()=>showPage(b.dataset.page)));
  $('#navLogo').addEventListener('click',()=>showPage('catalog'));
  $('#topStream').addEventListener('click',()=>showPage('creators'));
  $('#heroSpin').addEventListener('click',()=>showPage('roulette'));
  $$('#catalogKinds button').forEach(b=>b.addEventListener('click',()=>{state.catalog.kind=b.dataset.kind;setButtons($('#catalogKinds'),'kind',b.dataset.kind);fetchCatalog()}));
  let searchTimer=0;$ui.catalogSearch.addEventListener('input',()=>{clearTimeout(searchTimer);state.catalog.q=$ui.catalogSearch.value.trim();searchTimer=setTimeout(()=>fetchCatalog(),360)});
  $ui.catalogSort.addEventListener('change',()=>{state.catalog.sort=$ui.catalogSort.value;fetchCatalog()});
  for(const [prefix,target,save,update] of [
    ['catalog',state.catalog,saveCatalogFilters,fetchCatalog],
    ['wheel',cfg,saveCfg,queuePrepare]]){
    $('#'+prefix+'Period').addEventListener('change',()=>{target.period=$('#'+prefix+'Period').value;syncYearInputs(prefix,target);save();update()});
    for(const name of ['From','To'])$('#'+prefix+'Year'+name).addEventListener('change',()=>{
      target['year'+name]=$('#'+prefix+'Year'+name).value;
      const from=Number(target.yearFrom)||1980,to=Number(target.yearTo)||CURRENT_YEAR;
      if(from>to){target.yearTo=String(from);syncYearInputs(prefix,target);toast('Конечный год не может быть раньше начального')}
      save();update();
    });
    syncYearInputs(prefix,target);
  }
  $('#catalogReset').addEventListener('click',()=>{state.catalog={...state.catalog,q:'',kind:'demo',genres:[],genreMode:'any',period:'all',yearFrom:'',yearTo:'',sort:'relevance'};$ui.catalogSearch.value='';$ui.catalogSort.value='relevance';setButtons($('#catalogKinds'),'kind','demo');saveCatalogFilters();renderGenres();syncYearInputs('catalog',state.catalog);fetchCatalog()});
  $('#catalogClearGenres').addEventListener('click',()=>{state.catalog.genres=[];saveCatalogFilters();renderGenres();fetchCatalog()});
  $$('#catalogGenreMode button').forEach(b=>b.addEventListener('click',()=>{state.catalog.genreMode=b.dataset.mode;saveCatalogFilters();renderGenres();fetchCatalog()}));
  $ui.more.addEventListener('click',()=>fetchCatalog(true));$ui.favoritesSearch.addEventListener('input',renderFavorites);
  $('#manualFavoriteForm').addEventListener('submit',event=>{event.preventDefault();manualFavorite($('#manualGameName').value);$('#manualGameName').value=''});
  $('#favoritesSelectAll').addEventListener('click',()=>{state.selectedFavorites=new Set(state.favorites.map(favKey));saveSelections();renderFavorites()});
  $('#favoritesSelectNone').addEventListener('click',()=>{state.selectedFavorites.clear();saveSelections();renderFavorites()});
  $('#favoritesStartSpin').addEventListener('click',()=>{setSource('favorites');showPage('roulette')});
  $$('[data-played-filter]').forEach(b=>b.addEventListener('click',()=>{state.favoritesView=b.dataset.playedFilter;renderFavorites()}));
  $('#pickFavorites').addEventListener('click',()=>showPage('favorites'));
  $('#pickVideos').addEventListener('click',()=>showPage('creators'));
  $$('#channelThemes button').forEach(b=>b.addEventListener('click',()=>setChannel(b.dataset.channel)));
  $$('[data-quick-channel]').forEach(b=>b.addEventListener('click',()=>setChannel(b.dataset.quickChannel)));
  $('#applyChannelShow').addEventListener('click',applyChannelShow);
  $('#previewChannelOverlay').addEventListener('click',previewChannelOverlay);
  $('#channelAccent').addEventListener('input',()=>{if(!state.theme.accents)state.theme.accents={};state.theme.accents[state.theme.channel]=$('#channelAccent').value;applyTheme()});
  $('#resetChannelAccent').addEventListener('click',()=>{if(!state.theme.accents)state.theme.accents={};delete state.theme.accents[state.theme.channel];applyTheme()});
  $$('#machineChoices button').forEach(b=>b.addEventListener('click',()=>setMachine(b.dataset.machine)));
  $$('#wheelKinds button').forEach(b=>b.addEventListener('click',()=>setKind(b.dataset.kind)));
  $$('#wheelSources button').forEach(b=>b.addEventListener('click',()=>setSource(b.dataset.source)));
  $('#wheelClearGenres').addEventListener('click',()=>{cfg.genres=[];saveCfg();renderWheelGenres();queuePrepare()});
  $$('#wheelGenreMode button').forEach(b=>b.addEventListener('click',()=>{cfg.genreMode=b.dataset.mode;saveCfg();renderWheelGenres();queuePrepare()}));
  $('#copyCatalogGenres').addEventListener('click',()=>{cfg.genres=[...state.catalog.genres];cfg.genreMode=state.catalog.genreMode;saveCfg();renderWheelGenres();queuePrepare();toast('Жанры из каталога перенесены в рулетку')});
  $ui.wheelQuery.addEventListener('input',()=>{cfg.q=$ui.wheelQuery.value.trim();saveCfg();queuePrepare()});
  $ui.ownGames.addEventListener('input',()=>{putRaw(STORAGE.own,$ui.ownGames.value);queuePrepare()});
  $ui.soundTheme.addEventListener('change',()=>{cfg.sound=$ui.soundTheme.value;updateMusicUI()});
  $ui.volume.addEventListener('input',()=>{cfg.volume=Number($ui.volume.value);saveCfg();if(state.audio)state.audio.volume=cfg.volume/100});
  $ui.previewSound.addEventListener('click',()=>{if(state.audioPreview){stopSound();return}startSound(true)});
  $ui.noRepeats.addEventListener('change',()=>{cfg.noRepeats=$ui.noRepeats.checked;saveCfg();queuePrepare()});
  $ui.spinButton.addEventListener('click',spin);$('#rollAgain').addEventListener('click',spin);
  $ui.winnerFav.addEventListener('click',()=>{if(state.chosen)toggleFav(state.chosen)});
  $('#winnerPlayed').addEventListener('click',()=>{if(state.chosen)togglePlayed(state.chosen)});
  $('#excludePlayed').addEventListener('change',()=>{cfg.excludePlayed=$('#excludePlayed').checked;saveCfg();queuePrepare()});
  $('#historyClear').addEventListener('click',()=>{state.history=[];store(STORAGE.hist,[]);renderHistory();toast('История очищена');if(state.page==='roulette')preparePool()});
  $('#overlayButton').addEventListener('click',showOverlayDialog);$('#copyOverlay').addEventListener('click',copyOverlay);
  $('#videoMode').addEventListener('click',toggleVideoMode);
  document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement)$ui.pages.roulette.classList.remove('is-video-mode')});
  document.addEventListener('keydown',event=>{
    const target=event.target;const typing=['INPUT','TEXTAREA','SELECT'].includes(target?.tagName)||target?.isContentEditable;
    if(event.key==='Escape'&&$ui.pages.roulette.classList.contains('is-video-mode')){$ui.pages.roulette.classList.remove('is-video-mode');if(document.fullscreenElement)document.exitFullscreen?.()}
    if(event.key===' '&&!typing&&state.page==='roulette'&&!$ui.overlayDialog.open){event.preventDefault();spin()}
    if(event.key==='/'&&!typing&&state.page==='catalog'){event.preventDefault();$ui.catalogSearch.focus()}
  });
  showPage(readHashPage());
  window.addEventListener('hashchange',()=>{const page=readHashPage();if(page!==state.page)showPage(page)});
}
init();

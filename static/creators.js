'use strict';
/* Generic video collections + public YouTube Live Chat voting. No channel presets. */
(() => {
  const key='gamepick-creator-videos-v1';
  const $ = id => document.getElementById(id);
  const safe = (v,n=180)=>String(v||'').trim().slice(0,n);
  let items=[];let voteSession='';let hostToken='';let voteInfo=null;let requesting=false;
  let voteSpinOverride=null;
  function parseGames(text){return [...new Set(String(text||'').split(/[\r\n;]+/).map(v=>safe(v,180)).filter(Boolean))].slice(0,80)}
  function getData(){try{const v=JSON.parse(localStorage.getItem(key)||'{}');return Array.isArray(v.items)?v.items:[]}catch{return []}}
  items=getData().filter(x=>x&&typeof x==='object').slice(0,200);
  if(!items.length){ // Migrate existing manually curated video collections from V8.
    try{
      const old=JSON.parse(localStorage.getItem('gamepick-channel-hub-v1')||'{}');
      for(const group of Object.values(old)){
        if(!group || typeof group!=='object')continue;
        for(const video of group.manual||[]){
          const games=Array.isArray(group.picks?.[video.id])?group.picks[video.id]:[];
          if(games.length)items.push({id:(globalThis.crypto?.randomUUID?.()||('video-'+Date.now()+'-'+Math.floor(Math.random()*1e9))),title:safe(video.title,120),date:safe(video.published,10),url:'https://www.youtube.com/watch?v='+video.id,games:games.map(v=>safe(v)).filter(Boolean),selected:(group.selected||[]).includes(video.id)});
        }
      }
      items=items.slice(0,200);
    }catch{}
  }
  function save(){try{localStorage.setItem(key,JSON.stringify({items}));}catch{toast('Не хватает места для сохранения выпусков.')}}
  save();
  const genericGames=names=>names.map(name=>({id:'video_'+name.toLowerCase().replace(/\W/g,'').slice(0,60),name,kind:'custom',image:'',url:''}));
  function selectedNames(){const names=new Map();items.filter(item=>item.selected).forEach(item=>(item.games||[]).forEach(name=>{name=safe(name);if(name)names.set(name.toLowerCase(),name)}));return [...names.values()]}
  function videoGames(){return genericGames(voteSpinOverride||selectedNames())}
  function selectionToken(){return JSON.stringify([items.map(x=>[x.id,x.selected,x.games]),voteSpinOverride])}
  function renderVideos(){
    const host=$('creatorVideos');if(!host)return;
    const sel=$('creatorYear');const mode=sel.value;const q=safe($('creatorVideoSearch').value,120).toLowerCase();
    const list=items.filter(x=>{
      if(/^\d{4}$/.test(mode)&&!String(x.date||'').startsWith(mode))return false;
      return !q || x.title.toLowerCase().includes(q)||(x.games||[]).join(' ').toLowerCase().includes(q);
    }).sort((a,b)=>mode==='old'?String(a.date||'9999').localeCompare(String(b.date||'9999')):String(b.date||'').localeCompare(String(a.date||'')));
    host.replaceChildren();
    for(const x of list){
      const row=document.createElement('article');row.className='creator-video-row';
      const check=document.createElement('input');check.type='checkbox';check.checked=Boolean(x.selected);check.setAttribute('aria-label','Выбрать выпуск '+x.title);
      check.addEventListener('change',()=>{x.selected=check.checked;save();renderVideos();if(state.config.source==='video')queuePrepare()});
      const body=document.createElement('div');body.className='creator-video-body';
      const name=document.createElement('strong');name.textContent=safe(x.title,120);
      const secondary=document.createElement('small');secondary.textContent=(x.date||'Без даты')+' · '+(x.games||[]).length+' игр';
      const gameLine=document.createElement('p');gameLine.textContent=(x.games||[]).join(' · ').slice(0,350);
      body.append(name,secondary,gameLine);
      const remove=document.createElement('button');remove.className='creator-remove';remove.type='button';remove.textContent='×';remove.title='Удалить подборку';remove.setAttribute('aria-label','Удалить подборку '+x.title);
      remove.addEventListener('click',()=>{if(confirm('Удалить подборку «'+x.title+'»?')){items=items.filter(y=>y.id!==x.id);save();renderVideos();if(state.config.source==='video')queuePrepare()}});
      row.append(check,body,remove);host.append(row);
    }
    if(!list.length){const empty=document.createElement('div');empty.className='creator-empty';empty.textContent='Нет подборок по выбранным условиям.';host.append(empty)}
    $('creatorVideoCount').textContent='Выбрано игр: '+selectedNames().length;
  }
  function render(){renderVideos()}
  function setStatus(message,bad=false){const el=$('liveState');el.textContent=message;el.classList.toggle('is-error',bad)}
  function renderVotes(data){
    voteInfo=data;
    globalThis.GP10?.pushVoting?.(data);
    const place=$('liveResults');place.replaceChildren();
    const counts=data.counts||[],games=data.games||[],max=Math.max(1,...counts);
    games.forEach((title,i)=>{
      const row=document.createElement('div');row.className='live-result-row';
      const info=document.createElement('div');info.className='live-result-head';
      const label=document.createElement('strong');label.textContent='!'+(i+1)+' · '+title;
      const count=document.createElement('span');count.textContent=(counts[i]||0)+' голосов';info.append(label,count);
      const track=document.createElement('div');track.className='vote-track';const fill=document.createElement('div');fill.className='vote-fill';fill.style.width=String(100*(counts[i]||0)/max)+'%';track.append(fill);
      row.append(info,track);place.append(row);
    });
    $('liveVotesMeta').textContent='Участников: '+(data.voters||0);
    $('liveSpinWinner').disabled=!(data.voters>0) || data.active;
    $('liveFinish').disabled=!data.active;
    $('liveStart').disabled=Boolean(data.active);
    if(data.warning)setStatus(data.warning,true);
    else setStatus(data.active?'● Голосование идёт · сообщения читаются с интервалами YouTube': '■ Голосование завершено');
  }
  async function ask(url,method='GET',body=null){
    const headers={'X-Gamepick-Host':hostToken};if(body)headers['Content-Type']='application/json';
    const response=await fetch(url,{method,headers,body:body?JSON.stringify(body):undefined,cache:'no-store'});
    const data=await response.json();if(!response.ok)throw Error(data.error||'Не удалось связаться с сервером.');return data;
  }
  async function updateVotes(){
    if(!voteSession||requesting||!voteInfo?.active)return;
    requesting=true;
    try{renderVotes(await ask('/api/live-vote/'+voteSession))}catch(error){setStatus(error.message,true)}finally{requesting=false}
  }
  async function startVote(){
    const nominees=parseGames($('liveNominees').value).slice(0,12);
    if(nominees.length<2){setStatus('Нужно минимум две разные игры.',true);return}
    if(!$('liveVideo').value.trim()){setStatus('Вставь ссылку на активный прямой эфир.',true);return}
    $('liveStart').disabled=true;setStatus('Подключаемся к YouTube…');
    try{
      const hostCode=$('liveHostCode').value.trim();
      const response=await fetch('/api/live-vote/start',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','X-Gamepick-Host-Code':hostCode},body:JSON.stringify({video:$('liveVideo').value.trim(),games:nominees})});
      const data=await response.json();if(!response.ok)throw Error(data.error||'Не удалось создать голосование.');
      voteSession=data.session;hostToken=data.host_token;renderVotes(data);
    }catch(error){setStatus(error.message,true);$('liveStart').disabled=false}
  }
  async function finishVote(){if(!voteSession)return;try{renderVotes(await ask('/api/live-vote/'+voteSession+'/finish','POST'));}catch(e){setStatus(e.message,true)}}
  function spinVotedWinner(){
    if(!voteInfo || voteInfo.active || !voteInfo.voters)return;
    const max=Math.max(...voteInfo.counts);const tied=voteInfo.counts.map((n,i)=>n===max?i:-1).filter(i=>i>=0);
    const index=tied[randomIndex(tied.length)],winner=voteInfo.games[index];
    voteSpinOverride=[winner];setSource('video');showPage('roulette');
    state.loadingPool=false;state.pool=videoGames();updatePoolUi(state.pool.length);
    // Do not let user's completed-game filter override the chat winner.
    const previous=state.config.excludePlayed;state.config.excludePlayed=false;
    setTimeout(()=>{state.loadingPool=false;state.pool=videoGames();spin();state.config.excludePlayed=previous;},100);
    setTimeout(()=>{voteSpinOverride=null;if(state.config.source==='video'&&!state.spinning)queuePrepare()},17500);
  }
  $('creatorVideoForm').addEventListener('submit',event=>{
    event.preventDefault();if(items.length>=200){toast('Максимум 200 выпусков.');return}
    const title=safe($('creatorVideoTitle').value,120),games=parseGames($('creatorVideoGames').value);
    if(!title||!games.length)return;
    const url=safe($('creatorVideoUrl').value,300);
    if(url){try{const u=new URL(url);if(u.protocol!=='https:'||!['youtube.com','www.youtube.com','m.youtube.com','youtu.be','www.youtu.be'].includes(u.hostname)){toast('Только ссылки YouTube.');return}}catch{toast('Проверь ссылку YouTube.');return}}
    items.unshift({id:(globalThis.crypto?.randomUUID?.()||('video-'+Date.now()+'-'+Math.floor(Math.random()*1e9))),title,date:safe($('creatorVideoDate').value,10),url,games,selected:true});save();event.target.reset();syncYears();renderVideos();toast('Подборка добавлена');
  });
  function syncYears(){const select=$('creatorYear'),old=select.value;select.querySelectorAll('option[data-year]').forEach(o=>o.remove());[...new Set(items.map(x=>String(x.date||'').slice(0,4)).filter(x=>/^20\d\d$/.test(x)))].sort().reverse().forEach(year=>{const opt=document.createElement('option');opt.value=year;opt.textContent=year+' год';opt.dataset.year='1';select.append(opt)});select.value=[...select.options].some(o=>o.value===old)?old:'all'}
  $('creatorYear').addEventListener('change',renderVideos);$('creatorVideoSearch').addEventListener('input',renderVideos);
  $('creatorSpinVideos').addEventListener('click',()=>{if(!selectedNames().length){toast('Отметь хотя бы один выпуск с играми.');return}voteSpinOverride=null;setSource('video');showPage('roulette')});
  $('liveStart').addEventListener('click',startVote);$('liveFinish').addEventListener('click',finishVote);$('liveSpinWinner').addEventListener('click',spinVotedWinner);
  $('liveFromPool').addEventListener('click',()=>{const names=[...new Set(state.pool.map(g=>g.name))].slice(0,12);if(names.length)$('liveNominees').value=names.join('\n');else toast('Сначала открой рулетку и собери список игр.')});
  $('liveFromFavorite').addEventListener('click',()=>{$('liveNominees').value=state.favorites.filter(g=>state.selectedFavorites.has(favKey(g))).slice(0,12).map(g=>g.name).join('\n')});
  setInterval(updateVotes,5000);
  fetch('/api/live-vote/config').then(x=>x.json()).then(data=>{if(data.host_code_required)$('liveHostCodeRow').hidden=false;if(!data.available)setStatus('Голосование будет доступно после подключения YOUTUBE_API_KEY на сервере.')}).catch(()=>{});
  syncYears();renderVideos();
  globalThis.channelHub={videoGames,selectionToken};
  globalThis.gamepickCreators={render,onTheme:()=>{},videoGames};
  // Two small hidden effects for a livestream: repeated logo clicks and Konami code.
  let clicks=[];const logo=$('navLogo');
  function surprise(message){
    if(document.querySelector('.secret-pop'))return;
    const node=document.createElement('div');node.className='secret-pop';node.setAttribute('role','status');node.textContent=message;document.body.append(node);
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches){for(let i=0;i<22;i++){const part=document.createElement('i');part.style.setProperty('--x',(Math.random()*100)+'%');part.style.setProperty('--delay',(Math.random()*.5)+'s');part.textContent=['✦','✧','★'][i%3];node.append(part)}}
    setTimeout(()=>node.remove(),3800);
  }
  logo.addEventListener('click',()=>{const now=Date.now();clicks=clicks.filter(t=>now-t<2800);clicks.push(now);if(clicks.length>=6){clicks=[];surprise('✦ СЕКРЕТНЫЙ ДРОП ОТКРЫТ! ✦')}});
  const sequence=['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];let position=0;
  document.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName))return;position=e.key===sequence[position]?position+1:e.key===sequence[0]?1:0;if(position===sequence.length){position=0;surprise('★ РЕЖИМ ЛЕГЕНДЫ ★')}});
})();

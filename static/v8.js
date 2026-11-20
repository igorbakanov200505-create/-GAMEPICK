'use strict';
/* User-initiated, local-only backup/restore of GAMEPICK preferences.
   The stream room token is never exported. */
(() => {
  const KEYS = [
    'gamepick-catalog-filters-v5', 'gamepick-favorites-v2',
    'gamepick-history-v2', 'gamepick-config-v2',
    'gamepick-own-v1', 'gamepick-favorites-selected-v1',
    'gamepick-channel-theme-v1', 'gamepick-channel-hub-v1',
    'gamepick-played-v1', 'gamepick-channel-config-v1', 'gamepick-creator-videos-v1',
    'gamepick-v10-library', 'gamepick-v10-roulette', 'gamepick-v10-design'
  ];
  const OWN = 'gamepick-own-v1';
  const MAX_IMPORT = 12 * 1024 * 1024;
  const status = document.querySelector('#backupStatus');
  const exportButton = document.querySelector('#backupExport');
  const importInput = document.querySelector('#backupImport');
  function validateBackup(raw) {
    if(!raw || typeof raw !== 'object' || Array.isArray(raw) ||
       raw.type !== 'GAMEPICK_BACKUP' || raw.version !== 1 ||
       !raw.data || typeof raw.data !== 'object' || Array.isArray(raw.data)) {
      throw Error('Это не резервная копия GAMEPICK STUDIO.');
    }
    const data = {};
    for(const key of KEYS){
      if(!Object.hasOwn(raw.data,key)) continue;
      const str=raw.data[key];
      if(typeof str !== 'string') throw Error('Повреждён файл резервной копии.');
      if(key===OWN){
        if(str.length>100000)throw Error('Слишком длинный список игр.');
        data[key]=str;
        continue;
      }
      let value;
      try{value=JSON.parse(str)}catch{throw Error('Файл содержит некорректные настройки.');}
      if(key==='gamepick-favorites-v2'||key==='gamepick-history-v2'){
        if(!Array.isArray(value))throw Error('Некорректная коллекция игр.');
        data[key]=JSON.stringify(validGames(value.slice(0,400)));
      }else if(key==='gamepick-favorites-selected-v1'||key==='gamepick-played-v1'){
        if(!Array.isArray(value))throw Error('Некорректный список выбранных игр.');
        data[key]=JSON.stringify([...new Set(value.filter(v=>typeof v==='string' && v.length<130))].slice(0,2000));
      }else if(key==='gamepick-catalog-filters-v5'||key==='gamepick-config-v2'||key==='gamepick-channel-theme-v1'||key==='gamepick-channel-config-v1'){
        if(!value || typeof value!=='object' || Array.isArray(value))throw Error('Некорректные настройки.');
        data[key]=str;
      }else if(key==='gamepick-creator-videos-v1'){
        if(!value||typeof value!=='object'||!Array.isArray(value.items))throw Error('Некорректные подборки видео.');
        data[key]=JSON.stringify({items:value.items.slice(0,200).map(v=>({id:String(v.id||'').slice(0,32),title:String(v.title||'').slice(0,120),date:String(v.date||'').slice(0,10),url:String(v.url||'').slice(0,300),games:Array.isArray(v.games)?v.games.slice(0,80).map(x=>String(x).slice(0,180)):[],selected:Boolean(v.selected)}))});
      }else if(key==='gamepick-v10-library'){
        if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Некорректные данные библиотеки.');
        const clean={};
        for(const [gameId,rec] of Object.entries(value).slice(0,350)){
          if(gameId.length>130||!rec||typeof rec!=='object')continue;
          clean[gameId]={status:['planned','playing','paused','abandoned','complete'].includes(rec.status)?rec.status:'planned',rating:Math.min(5,Math.max(0,Number(rec.rating)||0)),hours:Math.min(9999,Math.max(0,Number(rec.hours)||0)),notes:String(rec.notes||'').slice(0,1200)};
        }
        data[key]=JSON.stringify(clean);
      }else if(key==='gamepick-v10-roulette'){
        if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Некорректные настройки рулетки.');
        data[key]=JSON.stringify({triple:Boolean(value.triple),mystery:Boolean(value.mystery),effects:Boolean(value.effects),rules:Array.isArray(value.rules)?value.rules.slice(0,60).map(x=>String(x).slice(0,150)):[],challenges:Array.isArray(value.challenges)?value.challenges.slice(0,60).map(x=>String(x).slice(0,150)):[]});
      }else if(key==='gamepick-v10-design'){
        if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Некорректные темы оформления.');
        const clean={};
        for(const [theme,design] of Object.entries(value).slice(0,8)){
          if(!['neon','noir','sunset','retro','frost','forest','gold','cosmos'].includes(theme)||!design||typeof design!=='object')continue;
          const image=String(design.image||'');
          clean[theme]={background:['default','aurora','mesh','stars','custom'].includes(design.background)?design.background:'default',font:['modern','mono','round'].includes(design.font)?design.font:'modern',radius:Math.min(28,Math.max(0,Number(design.radius)||14)),motion:design.motion==='off'?'off':'on',image:/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image)&&image.length<2500000?image:''};
        }
        data[key]=JSON.stringify(clean);
      }else if(key==='gamepick-channel-hub-v1'){
        if(!value || typeof value!=='object' || Array.isArray(value))throw Error('Некорректные данные каналов.');
        // Limit the import to two channel profiles, and only the data shapes used in the app.
        const clean={};
        for(const channel of Object.keys(value).slice(0,2)){
          const profile=value[channel];
          if(!profile || typeof profile!=='object'||Array.isArray(profile))continue;
          const record={manual:[],selected:[],picks:{}};
          for(const kind of ['banner','avatar']){
            const img=profile[kind];
            if(typeof img==='string' && img.length<5_500_000 && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(img))record[kind]=img;
          }
          if(Array.isArray(profile.manual))record.manual=profile.manual.slice(0,300).filter(v=>v&&typeof v==='object'&&/^[\w-]{11}$/.test(v.id)).map(v=>({
            id:v.id,title:String(v.title||'Видео').slice(0,180),published:String(v.published||'').slice(0,10),manual:true
          }));
          if(Array.isArray(profile.selected))record.selected=profile.selected.filter(id=>typeof id==='string'&&/^[\w-]{11}$/.test(id)).slice(0,300);
          if(profile.picks&&typeof profile.picks==='object'&&!Array.isArray(profile.picks)){
            for(const [id,names] of Object.entries(profile.picks).slice(0,300)){
              if(!/^[\w-]{11}$/.test(id)||!Array.isArray(names))continue;
              record.picks[id]=names.filter(x=>typeof x==='string').map(s=>s.trim().slice(0,180)).filter(Boolean).slice(0,150);
            }
          }
          clean[channel]=record;
        }
        data[key]=JSON.stringify(clean);
      }
    }
    if(!Object.keys(data).length)throw Error('В файле нет данных для восстановления.');
    return data;
  }
  function exportBackup(){
    const data={};
    for(const key of KEYS){const stored=localStorage.getItem(key);if(stored!==null)data[key]=stored;}
    const backup={type:'GAMEPICK_BACKUP',version:1,createdAt:new Date().toISOString(),data};
    const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const link=document.createElement('a');
    link.href=url;link.download='GAMEPICK-backup-'+new Date().toISOString().slice(0,10)+'.json';
    document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    status.textContent='Резервная копия скачана. Храни её в надёжном месте.';
  }
  async function importBackup(file){
    if(!file)return;
    if(file.size>MAX_IMPORT)throw Error('Файл слишком большой (максимум 12 МБ).');
    const contents=await file.text();
    let backup;
    try{backup=JSON.parse(contents)}catch{throw Error('Не удалось прочитать JSON-файл.');}
    const validated=validateBackup(backup);
    if(!confirm('Восстановить резервную копию? Текущие коллекции и настройки, включённые в неё, будут заменены.'))return;
    const originals=new Map();
    for(const key of Object.keys(validated))originals.set(key,localStorage.getItem(key));
    try{
      for(const [key,value] of Object.entries(validated))localStorage.setItem(key,value);
    }catch{
      for(const [key,old] of originals){try{if(old===null)localStorage.removeItem(key);else localStorage.setItem(key,old)}catch{}}
      throw Error('Не хватает места в браузере для восстановления. Попробуй копию без крупных баннеров.');
    }
    status.textContent='Восстановлено. Перезагружаем страницу…';
    location.reload();
  }
  exportButton?.addEventListener('click',()=>{
    try{exportBackup()}catch(e){status.textContent=e.message||'Не удалось создать копию.'}
  });
  importInput?.addEventListener('change',async ()=>{
    try{await importBackup(importInput.files?.[0])}
    catch(e){status.textContent=e.message||'Не удалось восстановить данные.'}
    finally{importInput.value=''}
  });
  // Useful for deterministic interface tests; no network calls or automatic updates.
  window.gamepickBackup = {validateBackup};
})();

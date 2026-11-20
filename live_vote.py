"""Voting from a public YouTube livestream chat (official Data API v3)."""
import os, re, secrets, threading, time
from urllib.parse import urlparse, parse_qs
import requests
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
router=APIRouter(prefix='/api/live-vote')
API='https://www.googleapis.com/youtube/v3/'
sessions={}; lock=threading.RLock()
command=re.compile(r'!\s*(?:(?:vote|игра|голос)\s+)?(\d{1,2})',re.I)

def video_id(value):
    if not isinstance(value,str) or len(value)>500:return ''
    if re.fullmatch(r'[A-Za-z0-9_-]{11}',value):return value
    u=urlparse(value)
    if u.scheme!='https':return ''
    host=u.hostname or '';id=''
    if host in ('youtube.com','www.youtube.com','m.youtube.com'):
        if u.path=='/watch':id=(parse_qs(u.query).get('v') or [''])[0]
        elif re.fullmatch(r'/(?:live|embed|shorts)/[A-Za-z0-9_-]{11}/?',u.path):id=u.path.rstrip('/').split('/')[-1]
    elif host in ('youtu.be','www.youtu.be'):id=u.path.strip('/')
    return id if re.fullmatch(r'[A-Za-z0-9_-]{11}',id) else ''

def yt(resource,params,key):
    r=requests.get(API+resource,params={**params,'key':key},timeout=(5,12));r.raise_for_status();return r.json()

def chat(chat_id,key,token=''):
    args={'part':'id,snippet','liveChatId':chat_id,'maxResults':200}
    if token:args['pageToken']=token
    return yt('liveChat/messages',args,key)

def snapshot(s):
    counts=[0]*len(s['games'])
    for number in s['votes'].values():counts[number]+=1
    return {'games':s['games'],'counts':counts,'voters':len(s['votes']),'active':s['active'],
            'connected':s['connected'],'warning':s['warning'],
            'next_poll_ms':max(0,int((s['due']-time.monotonic())*1000))}

def apply_messages(s,items):
    for item in items:
        if not isinstance(item,dict):continue
        msg_id=str(item.get('id') or '')
        if msg_id and msg_id in s['seen']:continue
        if msg_id:
            if len(s['seen'])>4000:s['seen'].clear()
            s['seen'].add(msg_id)
        note=item.get('snippet') or {}
        if note.get('type')!='textMessageEvent':continue
        user=str(note.get('authorChannelId') or '')
        if not user:continue
        text=str((note.get('textMessageDetails') or {}).get('messageText') or '').strip()
        match=command.fullmatch(text)
        if match:
            index=int(match.group(1))-1
            if 0<=index<len(s['games']):s['votes'][user]=index

def authorized(s,request):
    return secrets.compare_digest(request.headers.get('X-Gamepick-Host',''),s['token'])

@router.get('/config')
def config():return {'available':bool(os.getenv('YOUTUBE_API_KEY','').strip()),'host_code_required':bool(os.getenv('GAMEPICK_HOST_CODE','').strip())}

@router.post('/start')
async def start(request:Request):
    try:data=await request.json()
    except (TypeError,ValueError):data=None
    if not isinstance(data,dict):return JSONResponse({'error':'Неверные данные.'},400)
    required_code=os.getenv('GAMEPICK_HOST_CODE','').strip()
    if required_code and not secrets.compare_digest(request.headers.get('X-Gamepick-Host-Code',''), required_code):
        return JSONResponse({'error':'Неверный код ведущего.'},403)
    vid=video_id(data.get('video'));names=data.get('games')
    if not vid:return JSONResponse({'error':'Укажи URL прямого эфира YouTube.'},400)
    if not isinstance(names,list) or not 2<=len(names)<=12 or any(not isinstance(n,str) or not n.strip() or len(n)>180 for n in names):
        return JSONResponse({'error':'Укажи от 2 до 12 игр, каждую с новой строки.'},400)
    names=[n.strip() for n in names]
    if len(set(n.casefold() for n in names))!=len(names):return JSONResponse({'error':'Убери повторяющиеся названия.'},400)
    key=os.getenv('YOUTUBE_API_KEY','').strip()
    if not key:return JSONResponse({'error':'В настройках сервера отсутствует YOUTUBE_API_KEY.'},503)
    try:
        details=yt('videos',{'part':'liveStreamingDetails','id':vid},key)
        items=details.get('items') or []
        live_id=((items[0].get('liveStreamingDetails') or {}).get('activeLiveChatId')) if items else None
        if not live_id:return JSONResponse({'error':'У этого эфира сейчас нет активного публичного чата.'},400)
        initial=chat(live_id,key) # Historical messages ignored. Voting starts from nextPageToken.
    except (requests.RequestException,ValueError,KeyError,TypeError):
        return JSONResponse({'error':'Не удалось прочитать чат. Проверь API-ключ, квоту и доступность трансляции.'},502)
    ident=secrets.token_urlsafe(16);owner=secrets.token_urlsafe(24);now=time.monotonic()
    interval=max(5,min(60,int(initial.get('pollingIntervalMillis') or 6000)/1000))
    s={'token':owner,'created':now,'chat':live_id,'page':initial.get('nextPageToken') or '',
       'due':now+interval,'games':names,'votes':{},'seen':set(),'active':True,
       'connected':True,'warning':'','busy':False}
    with lock:
        for sid in list(sessions):
            if now-sessions[sid]['created']>10800:sessions.pop(sid,None)
        if len(sessions)>=30:return JSONResponse({'error':'Слишком много сеансов голосования.'},429)
        sessions[ident]=s
    return JSONResponse({'session':ident,'host_token':owner,**snapshot(s)},headers={'Cache-Control':'no-store'})

@router.get('/{ident}')
def status(ident:str,request:Request):
    with lock:
        s=sessions.get(ident)
        if not s or not authorized(s,request):return JSONResponse({'error':'Сеанс не найден.'},404)
        poll=s['active'] and not s['busy'] and time.monotonic()>=s['due']
        if poll:s['busy']=True;token=s['page'];chat_id=s['chat']
    if poll:
        try:
            result=chat(chat_id,os.getenv('YOUTUBE_API_KEY','').strip(),token)
            delay=max(5,min(60,int(result.get('pollingIntervalMillis') or 6000)/1000))
            with lock:
                if s['active']:
                    apply_messages(s,result.get('items') or [])
                    s['page']=result.get('nextPageToken') or s['page']
                    if result.get('offlineAt'):s['active']=False;s['warning']='Эфир завершён.'
                    else:s['warning']=''
                    s['connected']=True
                s['due']=time.monotonic()+delay
        except (requests.RequestException,ValueError,TypeError,KeyError):
            with lock:s['warning']='Связь с YouTube временно недоступна.';s['connected']=False;s['due']=time.monotonic()+20
        finally:
            with lock:s['busy']=False
    with lock:return JSONResponse(snapshot(s),headers={'Cache-Control':'no-store'})

@router.post('/{ident}/finish')
def finish(ident:str,request:Request):
    with lock:
        s=sessions.get(ident)
        if not s or not authorized(s,request):return JSONResponse({'error':'Сеанс не найден.'},404)
        s['active']=False
        return JSONResponse(snapshot(s),headers={'Cache-Control':'no-store'})

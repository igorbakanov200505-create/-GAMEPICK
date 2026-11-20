from fastapi.testclient import TestClient
import live_vote
from app import app
client=TestClient(app)


def test_video_link_allowlist():
    assert live_vote.video_id('https://www.youtube.com/live/ABCDEFGHIJK')=='ABCDEFGHIJK'
    assert live_vote.video_id('https://youtu.be/ABCDEFGHIJK')=='ABCDEFGHIJK'
    assert live_vote.video_id('https://www.youtube.com/watch?v=ABCDEFGHIJK&t=2')=='ABCDEFGHIJK'
    assert not live_vote.video_id('https://youtube.com.evil.com/watch?v=ABCDEFGHIJK')
    assert not live_vote.video_id('file:///etc/passwd')


def test_no_api_key(monkeypatch):
    monkeypatch.delenv('YOUTUBE_API_KEY',raising=False)
    assert client.get('/api/live-vote/config').json()['available'] is False
    response=client.post('/api/live-vote/start',json={'video':'ABCDEFGHIJK','games':['One','Two']})
    assert response.status_code==503


def test_live_chat_votes_and_finish(monkeypatch):
    monkeypatch.setenv('YOUTUBE_API_KEY','TEST_KEY')
    live_vote.sessions.clear()
    monkeypatch.setattr(live_vote,'yt',lambda method,params,key:{'items':[{'liveStreamingDetails':{'activeLiveChatId':'PUBLIC_CHAT_1'}}]})
    initial={'nextPageToken':'FIRST','pollingIntervalMillis':5000,'items':[]}
    calls=[]
    def fake_chat(cid,key,token=''):
        calls.append(token)
        if not token:return initial
        return {'nextPageToken':'SECOND','pollingIntervalMillis':6000,'items':[
            {'id':'01','snippet':{'type':'textMessageEvent','authorChannelId':'viewer-one','textMessageDetails':{'messageText':'!1'}}},
            {'id':'02','snippet':{'type':'textMessageEvent','authorChannelId':'viewer-two','textMessageDetails':{'messageText':'!2'}}},
            {'id':'03','snippet':{'type':'textMessageEvent','authorChannelId':'viewer-one','textMessageDetails':{'messageText':'!голос 2'}}},
            {'id':'04','snippet':{'type':'textMessageEvent','authorChannelId':'viewer-three','textMessageDetails':{'messageText':'!50'}}},
            {'id':'05','snippet':{'type':'textMessageEvent','authorChannelId':'viewer-four','textMessageDetails':{'messageText':'привет'}}},
        ]}
    monkeypatch.setattr(live_vote,'chat',fake_chat)
    response=client.post('/api/live-vote/start',json={'video':'https://www.youtube.com/live/ABCDEFGHIJK','games':['One','Two']})
    assert response.status_code==200,response.json()
    data=response.json();sid=data['session'];header={'X-Gamepick-Host':data['host_token']}
    assert data['counts']==[0,0]
    assert client.get('/api/live-vote/'+sid).status_code==404 # host token required
    live_vote.sessions[sid]['due']=0
    result=client.get('/api/live-vote/'+sid,headers=header)
    assert result.status_code==200
    assert result.json()['counts']==[0,2]
    assert result.json()['voters']==2
    assert calls==['','FIRST']
    assert client.post('/api/live-vote/'+sid+'/finish',headers=header).json()['active'] is False
    assert client.get('/api/live-vote/'+sid,headers=header).json()['counts']==[0,2]


def test_invalid_data(monkeypatch):
    monkeypatch.setenv('YOUTUBE_API_KEY','TEST_KEY')
    assert client.post('/api/live-vote/start',json={'video':'invalid','games':['One','Two']}).status_code==400
    assert client.post('/api/live-vote/start',json={'video':'ABCDEFGHIJK','games':['One','One']}).status_code==400


def test_optional_host_code(monkeypatch):
    monkeypatch.setenv('GAMEPICK_HOST_CODE','SECRET_TEST_123')
    monkeypatch.setenv('YOUTUBE_API_KEY','TEST_KEY')
    assert client.get('/api/live-vote/config').json()['host_code_required'] is True
    req={'video':'ABCDEFGHIJK','games':['One','Two']}
    assert client.post('/api/live-vote/start',json=req).status_code==403
    assert client.post('/api/live-vote/start',json=req,headers={'X-Gamepick-Host-Code':'WRONG'}).status_code==403
    monkeypatch.setattr(live_vote,'yt',lambda method,params,key:{'items':[{'liveStreamingDetails':{'activeLiveChatId':'TEST_CHAT'}}]})
    monkeypatch.setattr(live_vote,'chat',lambda cid,key,token='':{'nextPageToken':'PAGE','pollingIntervalMillis':6000})
    assert client.post('/api/live-vote/start',json=req,headers={'X-Gamepick-Host-Code':'SECRET_TEST_123'}).status_code==200

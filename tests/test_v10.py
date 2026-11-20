"""New V10 features and V9 backwards-compatibility smoke tests."""
from fastapi.testclient import TestClient
from app import app

client = TestClient(app)
ROOM = "a" * 32


def test_v10_static_and_controls():
    html = client.get('/').text
    for marker in (
        'id="gp10Triple"', 'id="gp10Mystery"', 'id="gp10Effects"',
        'id="gp10RuleValue"', 'id="gp10GameNotes"',
        'id="gp10BgFile"', 'id="gp10OBSButtons"',
        'value="abandoned"', '/static/v10.js', '/static/v10.css',
    ):
        assert marker in html, marker
    for route in ['/static/v10.js','/static/v10.css','/obs-widgets']:
        response=client.get(route)
        assert response.status_code==200
        assert len(response.content)>500
    assert 'id="pageCreators"' in html  # V9 preserved
    assert 'id="pageCatalog"' in html


def test_triple_result_passes_to_obs_without_html():
    body={
      'status':'winner','machine':'case','duration':0,'game':{
        'name':'Portal 2','kind':'full','id':'42','url':'https://store.steampowered.com/app/42/'},
      'theme':'cosmos','accent':'#ba9bff',
      'round':{'triple':True,'mystery':True,'rule':'Без карты','challenge':'Найти секрет','event':'gold'},
      'history':['Portal 2','Outer Wilds'],
      'design':{'font':'mono','radius':8,'background':'mesh'}
    }
    response=client.post('/api/stream/'+ROOM,json=body)
    assert response.status_code==200,response.text
    data=client.get('/api/stream/'+ROOM).json()
    assert data['status']=='winner' and data['game']['name']=='Portal 2'
    assert data['round']=={'triple':True,'mystery':True,'rule':'Без карты','challenge':'Найти секрет','event':'gold'}
    assert data['history']==['Portal 2','Outer Wilds']
    assert data['design']=={'font':'mono','radius':8,'background':'mesh'}


def test_voting_widget_and_result_coexist():
    vote={'games':['Alpha','Beta'],'counts':[4,7],'voters':11,'active':True}
    assert client.post('/api/stream/'+ROOM+'/vote',json=vote).status_code==200
    assert client.get('/api/stream/'+ROOM).json()['votes']==vote
    assert client.post('/api/stream/'+ROOM,json={'status':'spinning','machine':'wheel','duration':2500}).status_code==200
    data=client.get('/api/stream/'+ROOM).json()
    assert data['status']=='spinning' and data['votes']==vote
    assert data['duration']==2500


def test_malformed_widget_data_and_unknown_room():
    assert client.get('/api/stream/nope').status_code==400
    assert client.post('/api/stream/nope/vote',json={'games':['A','B'],'counts':[1,2]}).status_code==400
    assert client.post('/api/stream/'+ROOM+'/vote',json={'games':['A','B'],'counts':[0]}).status_code==400
    assert client.post('/api/stream/'+ROOM+'/vote',json={'games':['A','B'],'counts':['oops',2]}).status_code==400
    assert client.post('/api/stream/'+ROOM+'/vote',json={'games':['A','B'],'counts':[1,2], 'voters':'oops'}).status_code==400


def test_extra_fields_are_clamped():
    body={'status':'winner','game':{'name':'x','id':'test','kind':'custom'},
          'round':{'rule':'z'*500,'challenge':'a'*500,'event':'wrong','triple':True},
          'history':['x'*500]*20, 'design':{'font':'<bad>','background':'file:///etc/passwd','radius':1000}}
    assert client.post('/api/stream/'+ROOM,json=body).status_code==200
    saved=client.get('/api/stream/'+ROOM).json()
    assert len(saved['round']['rule'])==150
    assert len(saved['round']['challenge'])==150
    assert saved['round']['event']==''
    assert len(saved['history'])==6 and max(map(len,saved['history']))==180
    assert saved['design']=={'font':'modern','background':'default','radius':28}

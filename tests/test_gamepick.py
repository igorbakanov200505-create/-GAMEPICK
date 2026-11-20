"""API tests, with the storefront mocked so they work without network access."""
import importlib

from fastapi.testclient import TestClient

backend = importlib.import_module('app')
client = TestClient(backend.app)


def make_page(kind: str, count: int = 14):
    return {
        'games': [
            {'id': str(i + (1 if kind == 'demo' else 1000)), 'name': f'{kind} game {i}',
             'image': '', 'date': '', 'url': f'https://store.steampowered.com/app/{i+1}/', 'kind': kind}
            for i in range(count)
        ], 'total': count, 'start': 0,
    }


def test_public_pages_and_music():
    for path in ['/', '/health', '/overlay', '/static/app.js', '/static/styles.css', '/static/multi-genres.css',
                 '/static/audio/baraban.mp3', '/static/audio/spin.mp3',
                 '/static/audio/gambling.mp3']:
        assert client.get(path).status_code == 200, path


def test_catalog_kind_and_query(monkeypatch):
    calls = []

    def fake_search(q, genre, sort, start, kind='demo'):
        calls.append((q,genre,kind))
        return make_page(kind)

    monkeypatch.setattr(backend, 'query_steam', fake_search)
    data = client.get('/api/games?kind=full&genre=horror&q=ghost').json()
    assert data['games'][0]['kind'] == 'full'
    assert calls == [('ghost','horror','full')]


def test_random_mix_and_excludes(monkeypatch):
    monkeypatch.setattr(backend, 'query_steam', lambda q,g,s,start,kind='demo': make_page(kind))
    mixed = client.get('/api/wheel?kind=mix').json()
    assert len(mixed['games']) == 8
    assert {g['kind'] for g in mixed['games']} == {'demo', 'full'}
    demo = client.get('/api/wheel?kind=demo&exclude=1,2,3,4,5,6').json()
    assert all(g['id'] not in {'1','2','3','4','5','6'} for g in demo['games'])


def test_stream_room_lifecycle_and_sanitization():
    room='f'*32
    assert client.get('/api/stream/'+room).json()['status'] == 'idle'
    assert client.post('/api/stream/not-a-room', json={'status':'spinning'}).status_code == 400
    assert client.post('/api/stream/'+room, json={'status':'bad'}).status_code == 400
    assert client.post('/api/stream/'+room, json={'status':'spinning','machine':'case','duration':9000}).status_code == 200
    data=client.get('/api/stream/'+room).json()
    assert data['status'] == 'spinning' and data['machine']=='case' and data['duration']==9000
    assert client.post('/api/stream/'+room, json={'status':'winner','machine':'casino','game':{'id':'42','name':'The Best Game','kind':'demo','image':'https://evil.example/s.jpg','url':'https://evil.example/steal'}}).status_code == 200
    result=client.get('/api/stream/'+room).json()
    assert result['game']['name']=='The Best Game'
    assert result['game']['image']==''
    assert result['game']['url'].startswith('https://store.steampowered.com/search/?term=')


def test_steam_error_fallback(monkeypatch):
    def unavailable(*args, **kwargs):
        raise backend.SteamUnavailable('Not available')
    monkeypatch.setattr(backend, 'query_steam', unavailable)
    assert client.get('/api/games?kind=demo').status_code == 503
    assert client.get('/api/wheel?kind=full').status_code == 503

"""Multiple-tag API checks, using mocked Steam data (offline)."""
from fastapi.testclient import TestClient
import app as backend

client = TestClient(backend.app)


def page(tag, kind='demo', count=36, offset=0):
    base={'horror': 1000, 'coop': 2000, 'survival': 3000}.get(tag, 5000)
    return {'games': [
        {'id': str(base+i+offset), 'name': f'{tag} game {i+offset}', 'kind': kind,
         'image': '', 'date':'', 'url': f'https://store.steampowered.com/app/{base+i+offset}/'}
        for i in range(count)], 'total': 180, 'start': offset}


def test_read_genres_and_cap():
    from starlette.requests import Request
    def request(query):
        return Request({'type': 'http', 'method':'GET', 'path':'/', 'query_string': query.encode(), 'headers': []})
    genres, mode = backend.read_genre_selection(request('genres=horror,coop,xxx,horror,survival&genre_mode=all'))
    assert genres == ['horror', 'coop', 'survival'] and mode == 'all'
    genres, mode = backend.read_genre_selection(request('genre=rpg&genre_mode=invalid'))
    assert genres == ['rpg'] and mode == 'any'
    genres, _ = backend.read_genre_selection(request('genres=' + ','.join(list(backend.GENRES)[1:])))
    assert len(genres) == backend.MAX_GENRE_SELECTION


def test_any_combines_tags_and_pages(monkeypatch):
    calls = []
    def fake(q, tag, sort, start, kind='demo'):
        calls.append((tag, start))
        return page(tag, kind, offset=start)
    monkeypatch.setattr(backend, 'query_steam', fake)
    first = client.get('/api/games?genres=horror,coop&genre_mode=any').json()
    second = client.get('/api/games?genres=horror,coop&genre_mode=any&page=2').json()
    assert first['genre_mode'] == 'any' and first['approximate_total'] is True
    assert len(first['games']) == 36 and len(second['games']) == 36
    assert {g['id'] for g in first['games']}.isdisjoint({g['id'] for g in second['games']})
    assert {tag for tag, _ in calls} == {'horror','coop'}
    assert set(start for _, start in calls) == {0,18}


def test_all_passes_joint_filter_to_steam(monkeypatch):
    calls=[]
    def fake(q, tag, sort, start, kind='demo'):
        calls.append(tag)
        return page(tag, kind)
    monkeypatch.setattr(backend, 'query_steam', fake)
    result=client.get('/api/games?genres=horror,coop&genre_mode=all').json()
    assert result['approximate_total'] is False
    assert calls == ['horror,coop']
    assert '1667%2C1685' in result['source_url']


def test_wheel_any_and_mixed(monkeypatch):
    calls=[]
    def fake(q, tag, sort, start, kind='demo'):
        calls.append((tag,kind))
        result=page(tag,kind,count=20)
        result['total']=20
        return result
    monkeypatch.setattr(backend, 'query_steam',fake)
    result=client.get('/api/wheel?kind=mix&genres=horror,coop&genre_mode=any').json()
    assert len(result['games'])==8
    assert {g['kind'] for g in result['games']} == {'demo','full'}
    assert set(calls)=={('horror','demo'),('coop','demo'),('horror','full'),('coop','full')}


def test_any_partial_failure(monkeypatch):
    def fake(q, tag, sort, start, kind='demo'):
        if tag=='horror':
            raise backend.SteamUnavailable('blocked')
        return page(tag,kind)
    monkeypatch.setattr(backend, 'query_steam',fake)
    result=client.get('/api/games?genres=horror,coop&genre_mode=any')
    assert result.status_code==200
    assert result.json()['partial'] is True

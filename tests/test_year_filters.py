"""Year / archive regression tests; no external network needed."""
from fastapi.testclient import TestClient
from starlette.requests import Request
import app as backend

client = TestClient(backend.app)


def game(id, year, kind='full'):
    return {'id':str(id),'name':'Game '+str(id),'image':'','date':f'19 мар. {year}',
            'url':f'https://store.steampowered.com/app/{id}/','kind':kind}


def test_date_parsing_and_ranges():
    assert backend.release_year('11 nov. 2022') == 2022
    assert backend.release_year('18 мая 2009 г.') == 2009
    assert backend.release_year('Скоро') is None
    from datetime import datetime, timezone
    assert backend.release_year(str(datetime.now(timezone.utc).year + 1)) is None
    assert backend.game_matches_year(game(1,2012),(2010,2019))
    assert not backend.game_matches_year(game(2,2009),(2010,2019))
    assert not backend.game_matches_year(game(3,2020).copy() | {'date':'Скоро'},(2000,2026))
    assert backend.read_year_range(Request({'type':'http','query_string':b''})) == (None,None)


def test_catalog_filters_year_with_partial_results(monkeypatch):
    calls=[]
    def search(q,g,s,start,kind='demo'):
        calls.append(start)
        return {'games':[game(10,2009,kind),game(20,2019,kind),game(30,2025,kind)],'total':3,'start':start}
    monkeypatch.setattr(backend,'query_steam',search)
    r=client.get('/api/games?year_from=2010&year_to=2019&kind=full')
    assert r.status_code==200
    info=r.json()
    assert [v['id'] for v in info['games']]==['20']
    assert info['sampled_years'] is True
    assert info['year_from']==2010 and info['year_to']==2019
    assert calls==[0]


def test_randomizer_respects_year_in_mixed_mode(monkeypatch):
    def search(q,g,s,start,kind='demo'):
        base=100 if kind=='demo' else 200
        return {'games':[game(base,2016,kind),game(base+1,2025,kind)],'total':2,'start':start}
    monkeypatch.setattr(backend,'query_steam',search)
    r=client.get('/api/wheel?year_from=2024&year_to=2026&kind=mix')
    assert r.status_code==200
    assert {x['id'] for x in r.json()['games']}=={'101','201'}
    assert {x['kind'] for x in r.json()['games']}=={'demo','full'}


def test_html_exposes_year_controls():
    html=client.get('/').text
    for fragment in ['id="catalogPeriod"','id="wheelPeriod"','id="catalogYearFrom"',
                     'id="wheelYearTo"','id="creatorYear"','id="creatorVideoSearch"',
                     'id="creatorVideoDate"']:
        assert fragment in html
    assert client.get('/static/year-filters.css').status_code==200

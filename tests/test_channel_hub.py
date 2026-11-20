from fastapi.testclient import TestClient
from app import app
client=TestClient(app)


def test_new_pages_and_files():
    for path in ['/static/creators.js','/static/v9.css','/api/live-vote/config']:
        assert client.get(path).status_code == 200
    page=client.get('/').text
    for marker in ['id="pageCreators"','id="liveNominees"','data-source="video"','id="creatorVideoForm"']:
        assert marker in page
    assert 'id="pageChannels"' not in page
    assert 'GameOverEllis' not in page
    assert 'AzraelLone' not in page

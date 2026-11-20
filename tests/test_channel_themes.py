from fastapi.testclient import TestClient
from app import app


def test_stream_theme_roundtrip():
    room = 'abcdef0123456789abcdef0123456789'
    client = TestClient(app)
    body = {
        'status': 'spinning', 'machine': 'drum', 'duration': 9000,
        'theme': 'noir', 'accent': '#e73952',
    }
    assert client.post(f'/api/stream/{room}', json=body).status_code == 200
    response = client.get(f'/api/stream/{room}')
    assert response.status_code == 200
    data = response.json()
    assert data['theme'] == 'noir'
    assert data['accent'] == '#e73952'
    assert data['machine'] == 'drum'


def test_invalid_stream_theme_is_sanitized():
    room = '11111111111111111111111111111111'
    client = TestClient(app)
    assert client.post(f'/api/stream/{room}', json={
        'status': 'spinning', 'theme': '<script>', 'accent': 'invalid',
    }).status_code == 200
    data = client.get(f'/api/stream/{room}').json()
    assert data['theme'] == 'neon'
    assert data['accent'] == '#71e6fa'

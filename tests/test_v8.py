"""Regression smoke tests for the V8 browser-delivered features."""
from fastapi.testclient import TestClient
from app import app

client = TestClient(app)


def test_v8_assets_available():
    for path in ['/static/v8.js','/static/v8.css']:
        response = client.get(path)
        assert response.status_code == 200
        assert len(response.content) > 100


def test_v8_controls_present_on_page():
    html = client.get('/').text
    for marker in [
        'id="excludePlayed"', 'id="winnerPlayed"',
        'id="backupExport"', 'id="backupImport"',
        'data-played-filter="pending"', 'data-played-filter="played"',
        '/static/v8.css', '/static/v8.js',
    ]:
        assert marker in html, marker

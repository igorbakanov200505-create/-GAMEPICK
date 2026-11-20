import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from app import app, parse_steam_html, sanitize_image

SAMPLE_HTML = '''
<a href="https://store.steampowered.com/app/123456/Demo_One/?snr=1" class="search_result_row" data-ds-appid="123456">
  <div class="search_capsule"><img src="https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/123456/capsule_sm_120.jpg"></div>
  <div class="search_name"><span class="title">Demo &amp; Dreams</span></div>
  <div class="search_released">Nov 17, 2026</div>
</a>
<a href="https://store.steampowered.com/app/234567" class="search_result_row" data-ds-appid="234567">
  <span class="title">Vampire Adventure Demo</span>
</a>
<a href="https://attacker.com/app/777" class="search_result_row"><span class="title">Ignore this</span></a>
'''


class DemoRouletteTests(unittest.TestCase):
    def test_parser(self):
        results = parse_steam_html(SAMPLE_HTML)
        self.assertEqual(len(results), 2)
        self.assertEqual(results[0]['id'], '123456')
        self.assertEqual(results[0]['name'], 'Demo & Dreams')
        self.assertTrue(results[0]['image'].startswith('https://shared.fastly.steamstatic.com'))
        self.assertEqual(results[1]['date'], '')

    def test_image_sanitization(self):
        self.assertEqual(sanitize_image('https://malicious.example/cat.png'), '')
        self.assertEqual(sanitize_image('//steamstatic.com/test.png'), 'https://steamstatic.com/test.png')

    def test_routes_with_mock_steam(self):
        result = {'games': parse_steam_html(SAMPLE_HTML), 'total': 200, 'start': 0}
        with TestClient(app) as client, patch('app.query_steam', return_value=result):
            self.assertEqual(client.get('/health').json()['status'], 'ok')
            self.assertEqual(client.get('/').status_code, 200)
            response = client.get('/api/games?genre=horror&page=1')
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()['total'], 200)
            self.assertTrue(response.json()['has_more'])
            random_response = client.get('/api/random?genre=horror')
            self.assertEqual(random_response.status_code, 200)
            self.assertIn(random_response.json()['game']['name'], {'Demo & Dreams', 'Vampire Adventure Demo'})


if __name__ == '__main__':
    unittest.main()

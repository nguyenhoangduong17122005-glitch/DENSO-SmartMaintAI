from fastapi.testclient import TestClient

from backend.main import create_app
from backend.security import COOKIE_NAME
from backend.tests.test_api import app, client, seed_path


def test_role_switch_revokes_old_session_and_preserves_scope(client):
    assert client.get('/api/auth/options').json()['demoRoleSelection'] is True
    first = client.post('/api/auth/demo-role', json={'role': 'maintenance'})
    assert first.status_code == 200
    assert first.json()['user']['username'] == 'minh'
    old_cookie = client.cookies.get(COOKIE_NAME)
    assert client.get('/api/cases/BM-26028').status_code == 200
    second = client.post('/api/auth/demo-role', json={'role': 'expert'})
    assert second.json()['user']['username'] == 'hai'
    assert second.json()['csrfToken'] != first.json()['csrfToken']
    assert client.get('/api/cases/BM-26028').status_code == 200
    with TestClient(client.app) as other:
        other.cookies.set(COOKIE_NAME, old_cookie)
        assert other.get('/api/auth/me').status_code == 401
    third = client.post('/api/auth/demo-role', json={'role': 'lead'})
    assert third.json()['user']['username'] == 'anh'
    assert client.get('/api/cases/BM-26028').status_code == 404


def test_disabled_role_selection_requires_normal_login(app):
    with TestClient(create_app(app.state.db_path, demo_role_selection=False)) as client:
        assert client.get('/api/auth/options').json()['demoRoleSelection'] is False
        assert client.post('/api/auth/demo-role', json={'role': 'maintenance'}).status_code == 404
        assert client.get('/api/auth/me').status_code == 401


def test_demo_role_rejects_cross_origin_and_arbitrary_identity(client):
    assert client.post('/api/auth/demo-role', json={'role': 'maintenance'},
                       headers={'Origin': 'https://example.com'}).status_code == 403
    assert client.post('/api/auth/demo-role', json={'role': 'admin'}).status_code == 422
    assert client.post('/api/auth/demo-role', json={'role': 'expert', 'username': 'nam'}).status_code == 422

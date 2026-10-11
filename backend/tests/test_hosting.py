import pytest
from fastapi.testclient import TestClient

from backend.hosting import hosting_settings
from backend.main import create_app
from backend.tests.test_api import app, client, seed_path


def test_explicit_host_https_origin_secure_session_and_csrf(app, monkeypatch):
    monkeypatch.setenv('SMARTMAINT_ALLOWED_HOSTS', 'smartmaint.example.com')
    monkeypatch.setenv('SMARTMAINT_PUBLIC_ORIGIN', 'https://smartmaint.example.com')
    hosted = create_app(app.state.db_path, secure_cookie=True)
    with TestClient(hosted, base_url='https://smartmaint.example.com') as browser:
        assert browser.get('/api/health').status_code == 200
        response = browser.post('/api/auth/demo-role', json={'role':'maintenance'},
                                headers={'Origin':'https://smartmaint.example.com'})
        assert response.status_code == 200
        cookie = response.headers['set-cookie'].lower()
        assert 'secure' in cookie and 'httponly' in cookie
        assert browser.get('/api/auth/me').status_code == 200
        assert browser.post('/api/auth/logout').status_code == 403
        assert browser.post('/api/auth/logout', headers={
            'Origin':'https://other.example.com', 'X-CSRF-Token':response.json()['csrfToken']}).status_code == 403
        assert browser.post('/api/auth/logout', headers={
            'Origin':'https://smartmaint.example.com', 'X-CSRF-Token':response.json()['csrfToken']}).status_code == 204
    with TestClient(hosted, base_url='https://attacker.example.com') as outsider:
        assert outsider.get('/api/health').status_code == 400


def test_render_hostname_auto_configuration(monkeypatch):
    monkeypatch.delenv('SMARTMAINT_ALLOWED_HOSTS', raising=False)
    monkeypatch.delenv('SMARTMAINT_PUBLIC_ORIGIN', raising=False)
    monkeypatch.setenv('RENDER_EXTERNAL_HOSTNAME', 'demo.onrender.com')
    hosts, origin = hosting_settings()
    assert 'demo.onrender.com' in hosts
    assert origin == 'https://demo.onrender.com'


@pytest.mark.parametrize('hosts,origin', [
    ('*',''), ('https://demo.example.com',''), ('demo.example.com','http://demo.example.com'),
    ('demo.example.com','https://demo.example.com/path'),
    ('demo.example.com','https://other.example.com'),
])
def test_invalid_hosting_configuration_rejected(monkeypatch, hosts, origin):
    monkeypatch.delenv('RENDER_EXTERNAL_HOSTNAME', raising=False)
    monkeypatch.setenv('SMARTMAINT_ALLOWED_HOSTS', hosts)
    monkeypatch.setenv('SMARTMAINT_PUBLIC_ORIGIN', origin)
    with pytest.raises(ValueError):
        hosting_settings()


def test_container_prepare_is_repeatable_without_editing_local_config(tmp_path, monkeypatch):
    from backend.serve import prepare
    from backend.store import connect
    db = tmp_path / 'container.sqlite3'
    monkeypatch.setenv('SMARTMAINT_DB', str(db))
    monkeypatch.setenv('SMARTMAINT_RETRIEVAL_MODE', 'keyword')
    prepare()
    with connect(db) as connection:
        connection.execute("UPDATE cases SET title='Container edit preserved' WHERE id='BM-26028'")
    prepare()
    with connect(db) as connection:
        assert connection.execute('SELECT count(*) FROM cases').fetchone()[0] == 8
        assert connection.execute('SELECT count(*) FROM knowledge WHERE active_version=1').fetchone()[0] == 3
        assert connection.execute("SELECT title FROM cases WHERE id='BM-26028'").fetchone()[0] == 'Container edit preserved'

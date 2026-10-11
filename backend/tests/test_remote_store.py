"""libSQL protocol contract tests; optional real sqld server in CI."""
import http.client
import json
import os
import sqlite3
from urllib.parse import urlsplit

import pytest
from fastapi.testclient import TestClient

from backend import remote_store
from backend.remote_store import Connection, RemoteDatabaseError, decode, encode, settings
from backend.store import connect


class ProtocolServer:
    """In-memory HTTP transport model using a REAL SQLite file, not SQL stubs."""
    def __init__(self, path):
        self.path = path
        self.streams = {}
        self.number = 0
        self.calls = 0
        self.fail_commit = False
        self.base_url = None
        self.close_autocommit = False
        self.drop_transaction_stream = False

    def pipeline(self, body):
        self.calls += 1
        baton = body.get('baton')
        db = self.streams.pop(baton) if baton else sqlite3.connect(self.path, check_same_thread=False)
        results = []
        for request in body['requests']:
            try:
                kind = request['type']
                if kind == 'execute':
                    stmt = request['stmt']
                    cursor = db.execute(stmt['sql'], tuple(decode(v) for v in stmt['args']))
                    result = {'cols': [{'name': c[0]} for c in cursor.description or []],
                              'rows': [[encode(v) for v in row] for row in cursor.fetchall()],
                              'affected_row_count': max(cursor.rowcount, 0),
                              'last_insert_rowid': str(cursor.lastrowid) if cursor.lastrowid else None}
                    if stmt['sql'] == 'COMMIT' and self.fail_commit:
                        db.close()
                        raise OSError('Response lost AFTER database committed')
                    response = {'type': kind, 'result': result}
                elif kind == 'sequence':
                    pending = ''
                    for line in request['sql'].splitlines(keepends=True):
                        pending += line
                        if sqlite3.complete_statement(pending):
                            db.execute(pending)
                            pending = ''
                    assert not pending.strip()
                    response = {'type': kind}
                elif kind == 'close':
                    db.close()
                    db = None
                    response = {'type': kind}
                else:
                    raise AssertionError('Unexpected protocol operation')
                results.append({'type': 'ok', 'response': response})
            except sqlite3.Error as error:
                results.append({'type': 'error', 'error': {
                    'code': error.sqlite_errorname, 'message': str(error)}})
        self.number += 1
        if db and ((self.close_autocommit and not db.in_transaction) or self.drop_transaction_stream):
            db.close()
            db = None
        baton = str(self.number) if db else None
        if db:
            self.streams[baton] = db
        return {'baton': baton, 'base_url': self.base_url, 'results': results}


@pytest.fixture
def protocol(tmp_path, monkeypatch):
    server = ProtocolServer(tmp_path / 'remote.sqlite3')

    class Transport:
        def __init__(self, host, timeout):
            self.body = None

        def request(self, method, path, body, headers):
            assert method == 'POST' and path == '/v2/pipeline'
            assert headers['Authorization'] == 'Bearer fake-test-token'
            self.body = server.pipeline(json.loads(body))

        def getresponse(self):
            class Response:
                status = 200

                def read(inner):
                    return json.dumps(self.body).encode()
            return Response()

        def close(self):
            pass

    monkeypatch.setattr(http.client, 'HTTPSConnection', Transport)
    monkeypatch.setenv('SMARTMAINT_STORAGE', 'turso')
    monkeypatch.setenv('TURSO_DATABASE_URL', 'libsql://test-org.turso.io')
    monkeypatch.setenv('TURSO_AUTH_TOKEN', 'fake-test-token')
    yield server
    for db in server.streams.values():
        try:
            db.close()
        except sqlite3.Error:
            pass


@pytest.fixture
def remote_backend(protocol, monkeypatch):
    # Set only in CI against an isolated, unauthenticated LOCAL libSQL container.
    real = os.getenv('SMARTMAINT_TEST_LIBSQL_URL')
    if real:
        parts = urlsplit(real)
        assert parts.scheme == 'http' and parts.hostname == '127.0.0.1'
        monkeypatch.setattr(http.client, 'HTTPSConnection', lambda host, timeout:
                            http.client.HTTPConnection(parts.hostname, parts.port, timeout=timeout))
    return protocol


def test_remote_workflow_persists_across_app_recreation(remote_backend, tmp_path, monkeypatch):
    from backend.main import create_app
    from backend.tests.test_api import create_body
    path = tmp_path / 'MUST-NOT-BE-CREATED.sqlite3'
    first = create_app(path)
    with TestClient(first) as client:
        session = client.post('/api/auth/demo-role', json={'role': 'maintenance'})
        assert session.status_code == 200
        headers = {'X-CSRF-Token': session.json()['csrfToken'], 'Idempotency-Key': 'remote-persistence-case'}
        assert len(client.get('/api/cases').json()['items']) == 5
        body = create_body()
        body['title'] = 'REMOTE-KT01: Hồ sơ lưu ngoài container'
        created = client.post('/api/cases', json=body, headers=headers)
        assert created.status_code == 201, created.text
        case_id = created.json()['id']
        repeated = client.post('/api/cases', json=body, headers=headers)
        assert repeated.json()['id'] == case_id
    assert not path.exists()
    second = create_app(path)
    with TestClient(second) as client:
        session = client.post('/api/auth/demo-role', json={'role': 'maintenance'})
        assert session.status_code == 200
        saved = client.get('/api/cases/' + case_id)
        assert saved.status_code == 200 and saved.json()['title'] == body['title']
        assert len(client.get('/api/cases').json()['items']) == 6
    with connect(path) as db:
        assert db.execute('PRAGMA foreign_key_check').fetchall() == []
        assert db.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
        assert db.execute('SELECT count(*) FROM users').fetchone()[0] == 5
        with pytest.raises(sqlite3.IntegrityError, match='immutable'):
            db.execute("UPDATE case_context_versions SET origin='modified' WHERE case_id=?", (case_id,))
    # Reuse the existing full BM -> confirmed report -> independent review ->
    # publication -> citation test against the remote connection implementation.
    from backend.tests.test_knowledge import test_curated_keyword_publication_citations_source_and_answer
    from backend.tests import test_workflow, test_knowledge

    def pick_role(client, name='minh'):
        role = {'minh': 'maintenance', 'hai': 'expert', 'anh': 'lead'}[name]
        response = client.post('/api/auth/demo-role', json={'role': role})
        assert response.status_code == 200, response.text
        return {'X-CSRF-Token': response.json()['csrfToken']}

    monkeypatch.setattr(test_workflow, 'login', pick_role)
    monkeypatch.setattr(test_knowledge, 'login', pick_role)
    with TestClient(second) as client:
        test_curated_keyword_publication_citations_source_and_answer(client, second, monkeypatch, tmp_path)


def test_remote_outage_returns_503(protocol, tmp_path, monkeypatch):
    from backend.main import create_app
    app = create_app(tmp_path / 'unused.sqlite3')
    def outage(*args, **kwargs):
        raise OSError('offline')
    monkeypatch.setattr(http.client, 'HTTPSConnection', outage)
    with TestClient(app) as client:
        assert client.get('/api/health').status_code == 503
        assert client.post('/api/auth/demo-role', json={'role': 'maintenance'}).status_code == 503


def test_rollback_and_parameter_types(protocol):
    with connect(None) as db:
        db.execute('CREATE TABLE sample(id INTEGER PRIMARY KEY, text TEXT, value BLOB, optional REAL)')
    with pytest.raises(sqlite3.IntegrityError):
        with connect(None) as db:
            db.execute('INSERT INTO sample VALUES(?,?,?,?)', (1, "Tiếng Việt ' ? ;", b'\x00\xff', None))
            db.execute('INSERT INTO sample VALUES(?,?,?,?)', (1, 'duplicate', b'', 2.5))
    with connect(None) as db:
        assert db.execute('SELECT count(*) FROM sample').fetchone()[0] == 0
        db.execute('INSERT INTO sample VALUES(?,?,?,?)', (2, "Tiếng Việt ' ? ;", b'\x00\xff', None))
    with connect(None) as db:
        row = db.execute('SELECT * FROM sample').fetchone()
        assert row['text'] == "Tiếng Việt ' ? ;" and row[2] == b'\x00\xff'
        assert dict(row)['optional'] is None
    assert not protocol.streams


def test_lost_commit_response_never_retries_or_falls_back(protocol, tmp_path):
    with connect(None) as db:
        db.execute('CREATE TABLE sample(value TEXT)')
    protocol.fail_commit = True
    calls = protocol.calls
    path = tmp_path / 'must-not-fallback.sqlite3'
    with pytest.raises(RemoteDatabaseError):
        with connect(path) as db:
            db.execute('INSERT INTO sample VALUES(?)', ('committed but response lost',))
    assert protocol.calls == calls + 4  # PRAGMA, BEGIN, INSERT, COMMIT; no retry.
    assert not path.exists()
    protocol.fail_commit = False
    with connect(None) as db:
        assert db.execute('SELECT count(*) FROM sample').fetchone()[0] == 1


def test_closed_autocommit_stream_bootstrap_persistence_and_rag(protocol, tmp_path, monkeypatch):
    # Turso Cloud may acknowledge a successful SELECT/COMMIT with baton=null.
    # Exercise first startup, transactions, app recreation and the full BM ->
    # reviewed knowledge -> published RAG flow with that behavior enabled.
    protocol.close_autocommit = True
    test_remote_workflow_persists_across_app_recreation(protocol, tmp_path, monkeypatch)
    assert not protocol.streams


def test_new_transaction_stream_retains_foreign_keys(protocol):
    protocol.close_autocommit = True
    with connect(None) as db:
        db.execute('CREATE TABLE parent(id INTEGER PRIMARY KEY)')
        db.execute('CREATE TABLE child(parent_id INTEGER REFERENCES parent(id))')
        assert db.execute('SELECT count(*) FROM parent').fetchone()[0] == 0
        with pytest.raises(sqlite3.IntegrityError):
            db.execute('INSERT INTO child VALUES(?)', (123,))
    with connect(None) as db:
        assert db.execute('SELECT count(*) FROM child').fetchone()[0] == 0


@pytest.mark.parametrize('drop_after_begin', [False, True])
def test_closed_transaction_stream_fails_without_retry(protocol, drop_after_begin):
    db = Connection(*settings())
    if drop_after_begin:
        db.execute('BEGIN DEFERRED')
    protocol.drop_transaction_stream = True
    before = protocol.calls
    with pytest.raises(RemoteDatabaseError, match='stream expired'):
        db.execute('SELECT 1' if drop_after_begin else 'BEGIN DEFERRED')
    assert db.broken and protocol.calls == before + 1
    with pytest.raises(RemoteDatabaseError, match='unavailable'):
        db.execute('SELECT 2')
    assert protocol.calls == before + 1
    db.close()


def test_untrusted_server_routing_rejected(protocol):
    protocol.base_url = 'https://attacker.example.com'
    with pytest.raises(RemoteDatabaseError):
        with connect(None):
            pass


@pytest.mark.parametrize('url,token', [
    ('', ''), ('http://test.turso.io', 'token'), ('https://attacker.example.com', 'token'),
    ('libsql://test.turso.io/path', 'token'), ('libsql://user:password@test.turso.io', 'token'),
    ('libsql://test.turso.io', ''), ('libsql://test.turso.io', 'line\nbreak'),
])
def test_invalid_remote_settings_fail_closed(monkeypatch, url, token):
    monkeypatch.setenv('SMARTMAINT_STORAGE', 'turso')
    monkeypatch.setenv('TURSO_DATABASE_URL', url)
    monkeypatch.setenv('TURSO_AUTH_TOKEN', token)
    with pytest.raises(ValueError):
        settings()


def test_missing_credentials_never_create_local_database(monkeypatch, tmp_path):
    monkeypatch.setenv('SMARTMAINT_STORAGE', 'turso')
    monkeypatch.delenv('TURSO_DATABASE_URL', raising=False)
    monkeypatch.delenv('TURSO_AUTH_TOKEN', raising=False)
    path = tmp_path / 'not-created.sqlite3'
    with pytest.raises(ValueError):
        with connect(path):
            pass
    assert not path.exists()

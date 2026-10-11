"""Synthetic samples must persist with real provenance and respect existing records."""
import json
import sqlite3

import pytest

from backend.demo_knowledge import add_knowledge_samples
from backend.domain import snapshot
from backend.knowledge import knowledge_documents
from backend.store import connect
from backend.tests.test_api import app, client, login, seed_path
from backend.tests.test_remote_store import protocol


def assert_graph(path):
    with connect(path) as db:
        assert db.execute('PRAGMA foreign_key_check').fetchall() == []
        documents = knowledge_documents(db)
        assert len(documents) == 3
        for document in documents:
            assert document['isSimulated'] and document['environment'] == 'demo'
            assert document['title'].startswith('[DEMO]')
            case_id = document['sourceCaseId']
            report = db.execute('SELECT * FROM report_versions WHERE report_id=?', (document['sourceReportId'],)).fetchone()
            assert report['source_snapshot_hash'] == snapshot(db, case_id)['hash']
            assert json.loads(report['source_snapshot_json']) == snapshot(db, case_id)['data']
            assert db.execute('SELECT count(*) FROM report_source_events WHERE report_id=?', (report['report_id'],)).fetchone()[0] == 2
            assert db.execute('SELECT confirmed_by FROM report_confirmations WHERE report_id=?', (report['report_id'],)).fetchone()[0] == 'u-minh'


def test_samples_persist_preserve_edits_and_do_not_restore_withdrawn_source(app):
    path = app.state.db_path
    assert len(add_knowledge_samples(path)) == 3
    assert_graph(path)
    with connect(path) as db:
        db.execute("UPDATE cases SET title='User edit preserved' WHERE id='BM-KNOWLEDGE-001'")
        db.execute("UPDATE knowledge SET active_version=NULL WHERE id='KN-DEMO-CNC-001'")
        db.execute("UPDATE knowledge_publication SET validity_status='withdrawn' WHERE knowledge_id='KN-DEMO-CNC-001'")
        credentials = [tuple(row) for row in db.execute('SELECT id,password_hash FROM users ORDER BY id')]
    assert add_knowledge_samples(path) == []
    with connect(path) as db:
        assert db.execute("SELECT title FROM cases WHERE id='BM-KNOWLEDGE-001'").fetchone()[0] == 'User edit preserved'
        assert len(knowledge_documents(db)) == 2
        assert db.execute('SELECT count(*) FROM proposals').fetchone()[0] == 3
        assert credentials == [tuple(row) for row in db.execute('SELECT id,password_hash FROM users ORDER BY id')]
        assert db.execute("SELECT title FROM cases WHERE id='BM-26028'").fetchone()[0].startswith('Rung')


def test_sample_cards_details_reports_and_scopes(client, app):
    add_knowledge_samples(app.state.db_path)
    login(client)
    proposals = client.get('/api/knowledge-proposals').json()['items']
    knowledge = client.get('/api/knowledge').json()['items']
    assert len(proposals) == len(knowledge) == 3
    for item in proposals:
        assert item['status'] == 'approved' and item['publication']['active_version'] == 1
        detail = client.get('/api/knowledge-proposals/' + item['id'])
        assert detail.status_code == 200
        assert detail.json()['sourceReport']['evidence']
        assert client.get('/api/cases/' + item['caseId']).status_code == 200
        workflow = client.get('/api/cases/' + item['caseId'] + '/workflow').json()
        assert workflow['report']['status'] == 'confirmed'
        assert workflow['closure']['machine_state'] == 'unrestored'
    for item in knowledge:
        assert client.get('/api/knowledge/' + item['id']).status_code == 200
        source = client.get('/api/cases/BM-26028/sources/' + item['id'], params={'version':'1'})
        assert source.status_code == 200
    case = client.get('/api/cases/BM-26028').json()
    search = client.get('/api/cases/BM-26028/search', params={
        'q':'BM-KNOWLEDGE-001', 'expectedCaseDataRevision':case['caseDataRevision']})
    assert search.status_code == 200
    assert any(item['sourceId'] == 'KN-DEMO-CNC-001' for item in search.json()['items'])
    login(client, 'lan')
    assert client.get('/api/knowledge').json()['items'] == []
    assert client.get('/api/knowledge-proposals').json()['items'] == []
    login(client, 'hai')
    assert len(client.get('/api/knowledge').json()['items']) == 3
    assert client.get('/api/knowledge-proposals').json()['items'] == []


def test_entire_batch_rolls_back_if_independent_review_is_not_allowed(app):
    path = app.state.db_path
    with connect(path) as db:
        db.execute("UPDATE users SET active=0 WHERE id='u-anh'")
    with pytest.raises(sqlite3.IntegrityError, match='reviewer'):
        add_knowledge_samples(path)
    with connect(path) as db:
        assert db.execute('SELECT count(*) FROM proposals').fetchone()[0] == 0
        assert db.execute("SELECT count(*) FROM cases WHERE id LIKE 'BM-KNOWLEDGE-%'").fetchone()[0] == 0
        assert db.execute('SELECT count(*) FROM reports').fetchone()[0] == 0


def test_turso_existing_database_receives_one_short_atomic_batch(protocol):
    from backend.remote_store import initialize_demo_remote
    initialize_demo_remote()
    before = protocol.calls
    assert len(add_knowledge_samples(None)) == 3
    assert protocol.calls - before <= 7  # one sequence, not a network call per INSERT
    assert_graph(None)
    assert add_knowledge_samples(None) == []
    assert_graph(None)

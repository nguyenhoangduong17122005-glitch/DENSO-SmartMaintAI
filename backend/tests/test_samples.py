import json

from backend.manage import add_demo_samples
from backend.rag.search import load_documents, search_documents
from backend.store import ROOT, connect
from backend.tests.test_api import app, client, seed_path, login


def test_sample_import_is_idempotent_and_preserves_original(client, app):
    login(client)
    before = client.get('/api/cases/BM-26028').json()
    with connect(app.state.db_path) as db:
        users = [tuple(r) for r in db.execute('SELECT * FROM users ORDER BY id')]
    added = add_demo_samples(app.state.db_path)
    assert len(added) == 4
    assert add_demo_samples(app.state.db_path) == []
    assert client.get('/api/cases/BM-26028').json() == before
    for case_id in added:
        response = client.get('/api/cases/' + case_id)
        assert response.status_code == 200
        data = response.json()
        assert len(data['rounds']) == 1 and len(data['rounds'][0]['events']) == 2
        assert data['machineState'] == 'unverified'
    login(client, 'hai')
    assert all(client.get('/api/cases/' + c).status_code == 200 for c in added)
    login(client, 'nam')
    assert all(client.get('/api/cases/' + c).status_code == 404 for c in added)
    with connect(app.state.db_path) as db:
        assert users == [tuple(r) for r in db.execute('SELECT * FROM users ORDER BY id')]


def test_new_case_queries_find_related_sources():
    samples = json.loads((ROOT / 'fixtures/cases/cnc-demo-cases.json').read_text(encoding='utf-8'))['cases']
    for sample in samples:
        hits = search_documents(load_documents(), sample['suggestedQuery'], 'CNC-04', 'MC-400')
        assert hits[0]['sourceId'] == sample['relatedSourceId']

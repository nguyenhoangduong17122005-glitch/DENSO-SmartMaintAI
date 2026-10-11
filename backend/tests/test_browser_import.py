import copy
import json

import pytest

from backend.tests.test_api import app, client, seed_path, login
from backend.store import connect


def browser_case():
    return {"id": "BM-MV2JH5XG-DP5K", "assetId": "CNC-04", "type": "BM", "ownerId": "u-minh",
        "title": "DEMO-KT01: Kiểm tra lưu dữ liệu rung sau thay dao", "workState": "active",
        "machineState": "restored", "reportState": "confirmed", "report": {"summary": "Old local report"},
        "confirmations": {"local": "confirmed"}, "context": {"symptom": "Rung sau thay dao", "alarm": ""},
        "rounds": [{"id": "RD-browser-demo", "state": "active", "startedAt": "2026-10-10T22:22:00+07:00",
          "events": [{"id": "EV-browser-01", "type": "check", "content": "Đo rung sơ bộ", "performedBy": "u-hai",
             "enteredBy": "u-minh", "performedAt": "2026-10-10T22:23:00+07:00", "measurement": "3.2", "unit": "mm/s"},
            {"id": "EV-browser-02", "type": "observation", "content": "Chưa xác minh nguyên nhân",
             "performedBy": "u-minh", "measurement": "", "unit": ""}]}]}


def post(client, body=None, headers=None):
    return client.post('/api/browser-cases/import', json={"confirmed": True, "case": body or browser_case()},
                       headers=headers or {**login(client), 'Idempotency-Key': 'browser-import-01'})


def test_import_preserves_identity_journal_archive_and_replay(client, app):
    original = browser_case()
    headers = {**login(client), 'Idempotency-Key': 'browser-import-01'}
    response = post(client, original, headers)
    assert response.status_code == 201, response.text
    case = response.json()
    assert case['id'] == original['id'] and case['title'] == original['title']
    assert case['context']['symptom'] == original['context']['symptom']
    assert case['machineState'] == 'unverified' and case['reportState'] == 'draft'
    assert len(case['rounds']) == 1 and len(case['rounds'][0]['events']) == 2
    event = case['rounds'][0]['events'][0]
    assert event['measurement'] == 3.2 and event['unit'] == 'mm/s'
    assert event['recordedBy'] == 'u-minh' and event['performedBy'] == 'u-hai'
    assert event['confirmationStatus'] == 'unconfirmed'
    assert post(client, original, headers).json() == case
    assert post(client, original, {**headers, 'Idempotency-Key': 'another-key'}).status_code == 409
    with connect(app.state.db_path) as db:
        archive = db.execute('SELECT payload_json FROM legacy_case_snapshots WHERE case_id=?', (case['id'],)).fetchone()[0]
        assert json.loads(archive)['originalCase'] == original
        assert db.execute('SELECT origin FROM case_event_versions WHERE event_id=?', (event['id'],)).fetchone()[0] == 'browser_import'
        assert db.execute('SELECT count(*) FROM contribution_confirmations WHERE case_id=?', (case['id'],)).fetchone()[0] == 0
    assert client.get('/api/cases/'+case['id']).json()['rounds'] == case['rounds']
    login(client, 'hai')
    assert client.get('/api/cases/'+case['id']).status_code == 200


@pytest.mark.parametrize('change', ['owner', 'asset', 'type', 'duplicate_event', 'two_active', 'measurement', 'performer', 'context'])
def test_invalid_import_is_atomic(client, app, change):
    body = browser_case()
    if change == 'owner': body['ownerId'] = 'u-hai'
    if change == 'asset': body['assetId'] = 'VIS-01'
    if change == 'type': body['type'] = 'PM'
    if change == 'duplicate_event': body['rounds'][0]['events'].append(copy.deepcopy(body['rounds'][0]['events'][0]))
    if change == 'two_active': body['rounds'].append({"id": "RD-another", "state": "active"})
    if change == 'measurement': body['rounds'][0]['events'][0]['unit'] = ''
    if change == 'performer': body['rounds'][0]['events'][0]['performedBy'] = 'u-anh'
    if change == 'context': body['context']['symptom'] = ''
    assert post(client, body).status_code in {403, 422}
    with connect(app.state.db_path) as db:
        assert db.execute('SELECT 1 FROM cases WHERE id=?', (body['id'],)).fetchone() is None
        assert db.execute('SELECT 1 FROM legacy_case_snapshots WHERE case_id=?', (body['id'],)).fetchone() is None


def test_import_requires_session_csrf_and_owner_role(client):
    assert client.post('/api/browser-cases/import', json={'confirmed': True, 'case': browser_case()}).status_code == 401
    headers = login(client)
    assert post(client, headers={'Idempotency-Key':'no-csrf'}).status_code == 403
    assert client.post('/api/browser-cases/import', json={'confirmed': False, 'case': browser_case()},
                       headers={**headers, 'Idempotency-Key':'unconfirmed'}).status_code == 422
    assert post(client, headers={**login(client, 'hai'), 'Idempotency-Key':'expert'}).status_code == 403


def test_collision_rolls_back_archive_and_case(client, app):
    assert post(client).status_code == 201
    another = browser_case()
    another['id'] = 'BM-another'
    # Round/event IDs are globally unique and must never overwrite prior journal rows.
    assert post(client, another, {**login(client), 'Idempotency-Key':'collision'}).status_code == 409
    with connect(app.state.db_path) as db:
        assert db.execute("SELECT 1 FROM cases WHERE id='BM-another'").fetchone() is None
        assert db.execute("SELECT 1 FROM legacy_case_snapshots WHERE case_id='BM-another'").fetchone() is None

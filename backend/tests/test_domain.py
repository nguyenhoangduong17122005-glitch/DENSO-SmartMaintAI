import json
import sqlite3
from uuid import uuid4
from pathlib import Path

import pytest

from backend.tests.test_api import app, client, seed_path, login, create_body
from backend.store import connect, initialize

CASE = '/api/cases/BM-26028'

def write_headers(headers):
    return {**headers, 'Idempotency-Key': uuid4().hex}



def revision(client):
    return client.get(CASE).json()['caseDataRevision']


def start(client, headers, key='start-test'):
    response = client.post(CASE+'/rounds', json={'expectedCaseDataRevision': revision(client)},
                           headers={**headers, 'Idempotency-Key': key})
    assert response.status_code == 201, response.text
    return response.json()['roundId']


def event_body(client, performer='u-minh'):
    return {'expectedCaseDataRevision': revision(client), 'type': 'check', 'content': 'Demo observation only',
            'performedBy': performer, 'result': 'Not diagnosed', 'measurement': 3.2, 'unit': 'mm/s'}


def all_events(client):
    return {e['id']: e for r in client.get(CASE).json()['rounds'] for e in r['events']}


def test_round_lifecycle_same_case_and_independent_states(client):
    headers=login(client)
    before=client.get(CASE).json()
    rid=start(client,headers)
    active=client.get(CASE).json()
    assert active['id']==before['id'] and active['workState']=='active'
    assert active['machineState']==before['machineState'] and active['reportState']==before['reportState']
    assert active['sourceSnapshotHash']!=before['sourceSnapshotHash']
    assert client.post(CASE+'/rounds',json={'expectedCaseDataRevision':revision(client)},headers=write_headers(headers)).status_code==409
    end={'expectedCaseDataRevision':revision(client),'expectedRoundRevision':1,'summary':'Stopped demo round','remainingWork':'Pending investigation'}
    assert client.post(CASE+'/rounds/'+rid+'/end',json=end,headers=write_headers(headers)).status_code==200
    assert client.get(CASE).json()['workState']=='waiting'
    assert client.post(CASE+'/rounds/'+rid+'/events',json=event_body(client),headers=write_headers(headers)).status_code==409
    assert start(client,headers,'start-next')!=rid


def test_event_revision_history_confirmation_scope_and_replay(client,app):
    headers=login(client)
    rid=start(client,headers)
    body=event_body(client,'u-hai')
    create_headers={**headers,'Idempotency-Key':'event-once'}
    first=client.post(CASE+'/rounds/'+rid+'/events',json=body,headers=create_headers)
    assert first.status_code==201,first.text
    assert client.post(CASE+'/rounds/'+rid+'/events',json=body,headers=create_headers).json()==first.json()
    eid=first.json()['eventId']
    current=all_events(client)[eid]
    assert current['performedBy']=='u-hai' and current['recordedBy']=='u-minh'
    assert current['performedAt'] is None and current['recordedAt']
    expert=login(client,'hai')
    confirm={'expectedCaseDataRevision':revision(client),'items':[{'eventId':eid,'revision':1},{'eventId':'EV-2802','revision':1}]}
    response=client.post(CASE+'/contribution-confirmations',json=confirm,headers={**expert,'Idempotency-Key':'confirm-once'})
    assert response.status_code==201,response.text
    assert client.post(CASE+'/contribution-confirmations',json=confirm,headers={**expert,'Idempotency-Key':'confirm-once'}).json()==response.json()
    assert all_events(client)[eid]['confirmationStatus']=='confirmed'
    headers=login(client)
    edit={**body,'expectedCaseDataRevision':revision(client),'expectedRevision':1,'correctionReason':'Correct test measurement','measurement':3.4}
    put_headers={**headers,'Idempotency-Key':'edit-once'}
    changed=client.put(CASE+'/events/'+eid,json=edit,headers=put_headers)
    assert changed.status_code==200,changed.text
    assert client.put(CASE+'/events/'+eid,json=edit,headers=put_headers).json()==changed.json()
    events=all_events(client)
    assert events[eid]['revision']==2 and events[eid]['confirmationStatus']=='unconfirmed'
    assert events['EV-2802']['confirmationStatus']=='confirmed'
    versions=client.get(CASE+'/events/'+eid+'/versions').json()['items']
    assert [v['measurement'] for v in versions]==[3.2,3.4]
    assert versions[1]['correction_reason']=='Correct test measurement'
    with connect(app.state.db_path) as db:
        assert db.execute('SELECT count(*) FROM confirmation_items').fetchone()[0]==2
        with pytest.raises(sqlite3.IntegrityError,match='immutable'):
            db.execute('UPDATE case_event_versions SET content=? WHERE event_id=?',('overwrite',eid))


@pytest.mark.parametrize('bad',[
    {'unit':None},{'measurement':None},{'occurredAt':'2026-10-10T09:00:00'},
    {'performedBy':'u-anh'},{'content':' '},{'type':'diagnosed'},
])
def test_invalid_event_does_not_change_case(client,bad):
    headers=login(client);rid=start(client,headers)
    rev=revision(client)
    response=client.post(CASE+'/rounds/'+rid+'/events',json={**event_body(client),**bad},headers=write_headers(headers))
    assert response.status_code==422,response.text
    assert revision(client)==rev


def test_scope_and_confirmer_cannot_impersonate(client):
    expert=login(client,'hai')
    assert client.post(CASE+'/rounds',json={'expectedCaseDataRevision':revision(client)},headers=write_headers(expert)).status_code==403
    body={'expectedCaseDataRevision':revision(client),'items':[{'eventId':'EV-2801','revision':1}]}
    assert client.post(CASE+'/contribution-confirmations',json=body,headers=write_headers(expert)).status_code==403
    headers=login(client,'nam')
    assert client.get(CASE+'/journal').status_code==404
    assert client.get(CASE+'/events/EV-2802/versions').status_code==404
    assert client.post(CASE+'/contribution-confirmations',json=body,headers=write_headers(headers)).status_code==404


def test_stale_confirmation_and_event_foreign_case(client):
    headers=login(client);rid=start(client,headers)
    rev=revision(client)
    body=event_body(client)
    assert client.post(CASE+'/rounds/'+rid+'/events',json=body,headers=write_headers(headers)).status_code==201
    assert client.post(CASE+'/rounds/'+rid+'/events',json=body,headers=write_headers(headers)).status_code==409
    created=client.post('/api/cases',json=create_body(),headers=write_headers(headers)).json()
    body['expectedCaseDataRevision']=created['caseDataRevision']
    assert client.post('/api/cases/'+created['id']+'/rounds/'+rid+'/events',json=body,headers=write_headers(headers)).status_code==404
    expert=login(client,'hai')
    assert client.post(CASE+'/contribution-confirmations',json={'expectedCaseDataRevision':rev,'items':[{'eventId':'EV-2802','revision':1}]},headers=write_headers(expert)).status_code==409


def test_finished_work_frozen_and_history_readable(client,app):
    headers=login(client)
    with connect(app.state.db_path) as db:
        db.execute("UPDATE cases SET work_state='ended' WHERE id='BM-26028'")
    assert client.post(CASE+'/rounds',json={'expectedCaseDataRevision':revision(client)},headers=write_headers(headers)).status_code==409
    assert client.get(CASE+'/events/EV-2801/versions').status_code==200


def make_v1(path,seed_path):
    tables=['users','asset_grants','sessions','cases','case_participants','audit','operations','login_attempts']
    with sqlite3.connect(seed_path) as source, sqlite3.connect(path) as target:
        for name in tables:
            target.execute(source.execute('SELECT sql FROM sqlite_master WHERE type=? AND name=?',('table',name)).fetchone()[0])
            rows=source.execute('SELECT * FROM '+name).fetchall()
            if rows:
                target.executemany('INSERT INTO '+name+' VALUES('+','.join('?' for _ in rows[0])+')',rows)
        target.execute("INSERT INTO audit(actor_id,action,object_id,at) VALUES('u-minh','legacy.check','BM-26028','legacy-time')")
        target.execute("UPDATE cases SET context_revision=3,data_revision=7 WHERE id='BM-26028'")


def test_v1_migration_backup_preservation_idempotence(tmp_path,seed_path):
    path=tmp_path/'old.sqlite3';make_v1(path,seed_path)
    with sqlite3.connect(path) as db:
        original=db.execute('SELECT * FROM cases').fetchall()
        users=db.execute('SELECT * FROM users').fetchall()
    initialize(path)
    with connect(path) as db:
        assert [tuple(r) for r in db.execute('SELECT * FROM cases')]==original
        assert [tuple(r) for r in db.execute('SELECT * FROM users')]==users
        assert db.execute('SELECT count(*) FROM case_rounds').fetchone()[0]==2
        assert db.execute('SELECT count(*) FROM case_event_versions').fetchone()[0]==4
        assert db.execute('SELECT count(*) FROM case_event_versions WHERE recorded_at IS NULL').fetchone()[0]==4
        assert db.execute('SELECT revision FROM case_context_versions').fetchone()[0]==3
        assert db.execute("SELECT count(*) FROM audit WHERE action='legacy.check'").fetchone()[0]==1
        backups=[r[0] for r in db.execute('SELECT DISTINCT backup_path FROM schema_migrations')]
        assert db.execute('PRAGMA foreign_key_check').fetchall()==[]
    assert len(backups)==1 and Path(backups[0]).is_file()
    with sqlite3.connect(backups[0]) as db:
        assert db.execute('SELECT * FROM cases').fetchall()==original
        assert db.execute("SELECT count(*) FROM sqlite_master WHERE name='case_events'").fetchone()[0]==0
    initialize(path)
    assert len(list(tmp_path.glob('*.pre-v4-*.sqlite3')))==1


def test_bad_v1_migration_rolls_back(tmp_path,seed_path):
    path=tmp_path/'broken.sqlite3';make_v1(path,seed_path)
    with sqlite3.connect(path) as db:
        db.execute("UPDATE cases SET source_snapshot_json='{}'")
    with pytest.raises(KeyError):
        initialize(path)
    with sqlite3.connect(path) as db:
        assert db.execute("SELECT count(*) FROM sqlite_master WHERE name IN ('case_events','schema_migrations')").fetchone()[0]==0
        assert db.execute('SELECT count(*) FROM cases').fetchone()[0]==1


def test_approval_independence_content_and_index_gate(app):
    with connect(app.state.db_path) as db:
        db.execute("INSERT INTO proposals VALUES('P1','u-minh','CNC-04',1,'pending')")
        db.execute("""INSERT INTO proposal_versions(proposal_id,revision,mode,content_json,rationale,created_by,created_at)
            VALUES('P1',1,'new','{"title":"demo"}','Manual demo proposal','u-minh','now')""")
        with pytest.raises(sqlite3.IntegrityError,match='independent'):
            db.execute("INSERT INTO review_decisions VALUES('D-self','P1',1,'u-minh','approved','','now')")
        db.execute("INSERT INTO proposal_contributors VALUES('P1',1,'u-anh')")
        with pytest.raises(sqlite3.IntegrityError,match='independent'):
            db.execute("INSERT INTO review_decisions VALUES('D-contributor','P1',1,'u-anh','approved','','now')")
    with connect(app.state.db_path) as db:
        db.execute("INSERT INTO proposals VALUES('P2','u-minh','CNC-04',1,'pending')")
        db.execute("""INSERT INTO proposal_versions(proposal_id,revision,mode,content_json,rationale,created_by,created_at)
            VALUES('P2',1,'new','{"title":"demo"}','Manual demo proposal','u-minh','now')""")
        db.execute("INSERT INTO review_decisions VALUES('D2','P2',1,'u-anh','approved','','now')")
        db.execute("INSERT INTO knowledge VALUES('K2','CNC-04',NULL,'demo')")
        with pytest.raises(sqlite3.IntegrityError,match='approved content'):
            db.execute("""INSERT INTO knowledge_versions VALUES('K2',1,'{"title":"altered"}','hash','D2','now')""")
        db.execute("""INSERT INTO knowledge_versions VALUES('K2',1,'{"title":"demo"}','hash','D2','now')""")
        with pytest.raises(sqlite3.IntegrityError,match='ready'):
            db.execute("UPDATE knowledge SET active_version=1 WHERE id='K2'")
        db.execute("INSERT INTO knowledge_publication VALUES('K2',1,'queued','valid',NULL,NULL)")
        with pytest.raises(sqlite3.IntegrityError,match='ready'):
            db.execute("UPDATE knowledge SET active_version=1 WHERE id='K2'")
        db.execute("UPDATE knowledge_publication SET index_status='ready' WHERE knowledge_id='K2'")
        db.execute("UPDATE knowledge SET active_version=1 WHERE id='K2'")
        assert db.execute('PRAGMA foreign_key_check').fetchall()==[]


def test_normalized_reads_ignore_legacy_json_and_context_noop(client,app):
    headers=login(client)
    original=client.get(CASE).json()
    with connect(app.state.db_path) as db:
        db.execute("UPDATE cases SET context_json='{}',rounds_json='[]',source_snapshot_json='{}' WHERE id='BM-26028'")
    fresh=client.get(CASE).json()
    for key in ['context','rounds','sourceSnapshot','sourceSnapshotHash']:
        assert fresh[key]==original[key]
    response=client.put(CASE+'/context',json={'expectedCaseDataRevision':fresh['caseDataRevision'],
        'expectedContextRevision':fresh['contextRevision'],'context':fresh['context']},headers=write_headers(headers))
    assert response.status_code==200,response.text
    assert response.json()['caseDataRevision']==fresh['caseDataRevision']


def test_report_confirmation_requires_finished_current_confirmed_sources(app):
    with connect(app.state.db_path) as db:
        db.execute("INSERT INTO reports VALUES('R1','BM-26028',1,'draft')")
        with pytest.raises(sqlite3.IntegrityError):
            db.execute("""INSERT INTO report_versions VALUES('R1',1,'{}','confirmed','',1,'{}','hash','u-minh','now',NULL)""")
        db.execute("""INSERT INTO report_versions VALUES('R1',1,'{}','unknown','',1,'{}','hash','u-minh','now',NULL)""")
        with pytest.raises(sqlite3.IntegrityError):
            db.execute("INSERT INTO report_confirmations VALUES('R1',1,'u-minh','now')")
        db.execute("UPDATE cases SET work_state='ended' WHERE id='BM-26028'")
        with pytest.raises(sqlite3.IntegrityError,match='contributions'):
            db.execute("INSERT INTO report_confirmations VALUES('R1',1,'u-minh','now')")
        db.execute("INSERT INTO contribution_confirmations VALUES('C1','BM-26028','u-hai','hash','now')")
        db.execute("INSERT INTO confirmation_items VALUES('C1','BM-26028','EV-2802',1)")
        db.execute("INSERT INTO confirmation_items VALUES('C1','BM-26028','EV-2803',1)")
        with pytest.raises(sqlite3.IntegrityError,match='owner'):
            db.execute("INSERT INTO report_confirmations VALUES('R1',1,'u-hai','now')")
        db.execute("INSERT INTO report_confirmations VALUES('R1',1,'u-minh','now')")
        assert db.execute('PRAGMA foreign_key_check').fetchall()==[]


def test_event_database_guards_reject_measurement_without_unit_and_lineage_changes(app):
    with connect(app.state.db_path) as db:
        with pytest.raises(sqlite3.IntegrityError,match='unit'):
            db.execute("""INSERT INTO case_event_versions(event_id,case_id,revision,kind,content,measurement,origin)
                VALUES('EV-2801','BM-26028',2,'check','demo',3.2,'api')""")
        with pytest.raises(sqlite3.IntegrityError,match='lineage'):
            db.execute("UPDATE case_events SET round_id='RD-26028-2' WHERE id='EV-2801'")
        with pytest.raises(sqlite3.IntegrityError,match='immutable'):
            db.execute("DELETE FROM case_source_snapshots WHERE case_id='BM-26028'")

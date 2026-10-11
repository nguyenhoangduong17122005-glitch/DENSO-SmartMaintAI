from uuid import uuid4

from backend.tests.test_api import app, client, seed_path, login, create_body
from backend.store import connect, initialize


def headers(auth, key=None):
    return {**auth, 'Idempotency-Key': key or uuid4().hex}


def revision(client, base):
    return client.get(base).json()['caseDataRevision']


def fresh(client):
    auth=login(client)
    response=client.post('/api/cases',json=create_body(),headers=headers(auth))
    assert response.status_code==201,response.text
    return auth,'/api/cases/'+response.json()['id']


def invite(client,auth,base):
    body={'expectedCaseDataRevision':revision(client,base),'expertId':'u-hai','message':'Xác minh rung CNC'}
    result=client.post(base+'/support-requests',json=body,headers=headers(auth))
    assert result.status_code==201,result.text
    return result.json()['requestId']


def journal_and_close(client,auth,base,performer='u-minh'):
    response=client.post(base+'/rounds',json={'expectedCaseDataRevision':revision(client,base)},headers=headers(auth))
    assert response.status_code==201,response.text
    rid=response.json()['roundId']
    event=client.post(base+'/rounds/'+rid+'/events',json={'expectedCaseDataRevision':revision(client,base),
        'type':'result','content':'Kết quả kiểm tra demo','performedBy':performer},headers=headers(auth))
    assert event.status_code==201,event.text
    response=client.post(base+'/rounds/'+rid+'/end',json={'expectedCaseDataRevision':revision(client,base),
        'expectedRoundRevision':1,'summary':'Đã kiểm tra','remainingWork':'Theo dõi ca sau'},headers=headers(auth))
    assert response.status_code==200,response.text
    response=client.post(base+'/finish',json={'expectedCaseDataRevision':revision(client,base),
        'machineState':'restored','evidence':'Chạy thử demo ổn định'},headers=headers(auth,'finish-once'))
    assert response.status_code==200,response.text
    return event.json()['eventId']


def report_body(client,base,submit=True):
    return {'expectedCaseDataRevision':revision(client,base),'summary':'Rung sau thay dao','cause':'Giả thuyết gá dao',
        'causeStatus':'hypothesis','actions':'Kiểm tra lắp dao','result':'Chạy thử demo ổn định',
        'evidence':'Ghi nhận chạy thử mô phỏng','followUp':'Theo dõi ca sau','submit':submit}


def test_invitation_access_acceptance_decline_cancel_and_replay(client):
    auth,base=fresh(client);request_id=invite(client,auth,base)
    assert client.post(base+'/support-requests',json={'expectedCaseDataRevision':revision(client,base),
        'expertId':'u-hai','message':'Trùng'},headers=headers(auth)).status_code==409
    expert=login(client,'hai')
    assert client.get(base).status_code==404
    request=next(r for r in client.get('/api/support-requests').json()['items'] if r['id']==request_id)
    body={'expectedCaseDataRevision':request['caseDataRevision'],'decision':'accepted'}
    send_headers=headers(expert,'accept-once')
    accepted=client.post('/api/support-requests/'+request_id+'/respond',json=body,headers=send_headers)
    assert accepted.status_code==200,accepted.text
    assert client.post('/api/support-requests/'+request_id+'/respond',json=body,headers=send_headers).json()==accepted.json()
    assert client.get(base).status_code==200
    other,base2=fresh(client);req2=invite(client,other,base2)
    assert client.post('/api/support-requests/'+req2+'/respond',json={'expectedCaseDataRevision':revision(client,base2),
        'decision':'accepted'},headers=headers(other)).status_code==403
    assert client.post('/api/support-requests/'+req2+'/respond',json={'expectedCaseDataRevision':revision(client,base2),
        'decision':'cancelled'},headers=headers(other)).status_code==200
    req3=invite(client,other,base2)
    expert=login(client,'hai');pending=next(r for r in client.get('/api/support-requests').json()['items'] if r['id']==req3)
    assert client.post('/api/support-requests/'+req3+'/respond',json={'expectedCaseDataRevision':pending['caseDataRevision'],
        'decision':'declined'},headers=headers(expert)).status_code==200
    assert client.get(base2).status_code==404
    login(client,'anh');assert client.get('/api/support-requests').json()['items']==[]
    assert client.get(base+'/workflow').status_code==404


def test_finish_and_immutable_report_full_lifecycle(client,app):
    auth,base=fresh(client)
    event_id=journal_and_close(client,auth,base)
    assert client.get(base).json()['workState']=='ended'
    assert client.post(base+'/rounds',json={'expectedCaseDataRevision':revision(client,base)},headers=headers(auth)).status_code==409
    body=report_body(client,base,False)
    assert client.post(base+'/report',json=body,headers=headers(auth)).status_code==200
    submitted=client.post(base+'/report',json=report_body(client,base),headers=headers(auth))
    assert submitted.status_code==200,submitted.text
    report=submitted.json()['report'];assert report['revision']==2 and report['status']=='pending'
    assert len(client.get(base+'/report/versions').json()['items'])==2
    confirmation={'expectedCaseDataRevision':revision(client,base),'expectedReportRevision':2}
    confirm_headers=headers(auth,'report-once')
    response=client.post(base+'/report/confirm',json=confirmation,headers=confirm_headers)
    assert response.status_code==200,response.text
    assert client.post(base+'/report/confirm',json=confirmation,headers=confirm_headers).json()==response.json()
    assert client.get(base).json()['reportState']=='confirmed'
    assert client.post(base+'/report',json=report_body(client,base),headers=headers(auth)).status_code==409
    with connect(app.state.db_path) as db:
        assert db.execute('SELECT count(*) FROM report_confirmations').fetchone()[0]==1
        assert db.execute('SELECT count(*) FROM report_source_events WHERE event_id=?',(event_id,)).fetchone()[0]==2
        assert db.execute('SELECT count(*) FROM case_closures WHERE case_id=?',(base.split('/')[-1],)).fetchone()[0]==1
        assert db.execute('PRAGMA foreign_key_check').fetchall()==[]


def test_report_requires_current_expert_confirmations_and_new_snapshot(client):
    auth,base=fresh(client);rid=invite(client,auth,base)
    expert=login(client,'hai');req=next(r for r in client.get('/api/support-requests').json()['items'] if r['id']==rid)
    assert client.post('/api/support-requests/'+rid+'/respond',json={'expectedCaseDataRevision':req['caseDataRevision'],
        'decision':'accepted'},headers=headers(expert)).status_code==200
    auth=login(client);eid=journal_and_close(client,auth,base,'u-hai')
    report=client.post(base+'/report',json=report_body(client,base),headers=headers(auth)).json()['report']
    confirmation={'expectedCaseDataRevision':revision(client,base),'expectedReportRevision':report['revision']}
    assert client.post(base+'/report/confirm',json=confirmation,headers=headers(auth)).status_code==409
    expert=login(client,'hai')
    assert client.post(base+'/report',json=report_body(client,base),headers=headers(expert)).status_code==403
    assert client.post(base+'/contribution-confirmations',json={'expectedCaseDataRevision':revision(client,base),
        'items':[{'eventId':eid,'revision':1}]},headers=headers(expert)).status_code==201
    auth=login(client)
    confirmation['expectedCaseDataRevision']=revision(client,base)
    assert client.post(base+'/report/confirm',json=confirmation,headers=headers(auth)).status_code==409
    report=client.post(base+'/report',json=report_body(client,base),headers=headers(auth)).json()['report']
    assert client.post(base+'/report/confirm',json={'expectedCaseDataRevision':revision(client,base),
        'expectedReportRevision':report['revision']},headers=headers(auth)).status_code==200


def test_workflow_validation_conflicts_and_csrf(client):
    auth,base=fresh(client)
    assert client.post(base+'/report',json=report_body(client,base),headers=headers(auth)).status_code==409
    finish={'expectedCaseDataRevision':revision(client,base),'machineState':'restored','evidence':'Demo'}
    assert client.post(base+'/finish',json=finish,headers=headers(auth)).status_code==409
    assert client.post(base+'/finish',json=finish,headers={'Idempotency-Key':'no-csrf'}).status_code==403
    assert client.post(base+'/support-requests',json={'expectedCaseDataRevision':revision(client,base),
        'expertId':'u-anh','message':'Sai vai trò'},headers=headers(auth)).status_code==422
    req=invite(client,auth,base)
    assert client.post(base+'/finish',json=finish,headers=headers(auth)).status_code==409
    expert=login(client,'hai');reqbody=client.get('/api/support-requests').json()['items'][0]
    assert client.post('/api/support-requests/'+req+'/respond',json={'expectedCaseDataRevision':reqbody['caseDataRevision']-1,
        'decision':'accepted'},headers=headers(expert)).status_code==409
    auth=login(client)
    body=report_body(client,base);body['causeStatus']='confirmed';body['evidence']=''
    assert client.post(base+'/report',json=body,headers=headers(auth)).status_code==422


def test_finish_blocks_active_round_and_pending_invitation(client):
    auth,base=fresh(client);request_id=invite(client,auth,base)
    rid=client.post(base+'/rounds',json={'expectedCaseDataRevision':revision(client,base)},headers=headers(auth)).json()['roundId']
    client.post(base+'/rounds/'+rid+'/events',json={'expectedCaseDataRevision':revision(client,base),
        'type':'check','content':'Demo check','performedBy':'u-minh'},headers=headers(auth))
    body={'expectedCaseDataRevision':revision(client,base),'machineState':'unrestored','evidence':'Bàn giao xử lý khác'}
    active=client.post(base+'/finish',json=body,headers=headers(auth))
    assert active.status_code==409 and 'đợt' in active.json()['detail']
    client.post(base+'/rounds/'+rid+'/end',json={'expectedCaseDataRevision':revision(client,base),
        'expectedRoundRevision':1,'summary':'Bàn giao','remainingWork':'Chờ phương án'},headers=headers(auth))
    body['expectedCaseDataRevision']=revision(client,base)
    pending=client.post(base+'/finish',json=body,headers=headers(auth))
    assert pending.status_code==409 and 'lời mời' in pending.json()['detail']
    assert client.post('/api/support-requests/'+request_id+'/respond',json={'expectedCaseDataRevision':revision(client,base),
        'decision':'cancelled'},headers=headers(auth)).status_code==200
    body['expectedCaseDataRevision']=revision(client,base)
    assert client.post(base+'/finish',json=body,headers=headers(auth)).status_code==200
    assert client.get(base).json()['machineState']=='unrestored'


def test_v4_upgrade_backs_up_and_preserves_existing_cases(app):
    path=app.state.db_path
    with connect(path) as db:
        before=[tuple(r) for r in db.execute('SELECT * FROM cases ORDER BY id')]
        db.execute('DROP TABLE support_requests')
        db.execute('DROP TABLE case_closures')
        db.execute('DELETE FROM schema_migrations WHERE version=5')
    initialize(path)
    with connect(path) as db:
        assert [tuple(r) for r in db.execute('SELECT * FROM cases ORDER BY id')]==before
        backup=db.execute('SELECT backup_path FROM schema_migrations WHERE version=5').fetchone()[0]
        assert db.execute('SELECT count(*) FROM support_requests').fetchone()[0]==0
        assert db.execute('PRAGMA foreign_key_check').fetchall()==[]
    with connect(backup) as db:
        assert [tuple(r) for r in db.execute('SELECT * FROM cases ORDER BY id')]==before
        assert db.execute("SELECT 1 FROM sqlite_master WHERE name='support_requests'").fetchone() is None

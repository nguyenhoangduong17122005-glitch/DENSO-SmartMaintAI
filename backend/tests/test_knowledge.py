import copy
import sqlite3

import pytest

from backend.tests.test_api import app,client,seed_path,login
from backend.tests.test_workflow import fresh,headers,revision,journal_and_close,report_body
from backend.store import connect
from backend.rag.search import load_runtime_documents
from backend.rag.vectors import VectorError,index_status,vector_search


def confirmed_case(client):
    auth,base=fresh(client);journal_and_close(client,auth,base)
    result=client.post(base+'/report',json=report_body(client,base),headers=headers(auth)).json()['report']
    response=client.post(base+'/report/confirm',json={'expectedCaseDataRevision':revision(client,base),
        'expectedReportRevision':result['revision']},headers=headers(auth))
    assert response.status_code==200,response.text
    return auth,base


def proposal(client,auth,base):
    response=client.post(base+'/knowledge-proposals',json={'expectedCaseDataRevision':revision(client,base),
        'expectedReportRevision':1,'title':'Zeta901 rung sau thay dao','rationale':'Giữ kinh nghiệm thử nghiệm'},headers=headers(auth))
    assert response.status_code==201,response.text
    return response.json()


def send(client,auth,p):
    body={'expectedProposalRevision':p['revision'],'content':p['content'],'rationale':p['rationale'],'submit':True}
    body['content']['keywords']=['Zeta901','rung sau thay dao']
    response=client.put('/api/knowledge-proposals/'+p['id'],json=body,headers=headers(auth))
    assert response.status_code==200,response.text
    return response.json()


def review(client,lead,p,decision='approved'):
    result=client.post('/api/knowledge-proposals/'+p['id']+'/review',json={'expectedProposalRevision':p['revision'],
        'decision':decision,'feedback':'Đã đối chiếu báo cáo nguồn và giới hạn'},headers=headers(lead))
    assert result.status_code==200,result.text
    return result.json()


def test_curated_keyword_publication_citations_source_and_answer(client,app,monkeypatch,tmp_path):
    auth,base=confirmed_case(client);p=proposal(client,auth,base)
    assert not client.get('/api/knowledge').json()['items']
    p=send(client,auth,p);lead=login(client,'anh');approved=review(client,lead,p)
    kid=approved['publication']['id']
    assert approved['publication']['index_status']=='queued'
    assert client.get('/api/knowledge/'+kid).status_code==404
    assert not any(d['id']==kid for d in load_runtime_documents(app.state.db_path))
    pub_headers=headers(lead,'publish-once')
    response=client.post('/api/knowledge/'+kid+'/publish',json={'expectedVersion':1},headers=pub_headers)
    assert response.status_code==200,response.text
    assert client.post('/api/knowledge/'+kid+'/publish',json={'expectedVersion':1},headers=pub_headers).json()==response.json()
    assert client.get('/api/knowledge/'+kid).json()['sourceReportRevision']==1
    auth=login(client)
    search=client.get(base+'/search',params={'q':'Zeta901','expectedCaseDataRevision':revision(client,base)})
    assert search.status_code==200,search.text
    hit=search.json()['items'][0];assert hit['sourceId']==kid
    source=client.get(base+'/sources/'+kid,params={'version':'1'})
    assert source.status_code==200,source.text
    assert hit['excerpt'] in [s['text'] for s in source.json()['sections']]
    assert any('Giới hạn' in s['heading'] for s in source.json()['sections'])
    answer=client.post(base+'/answer',json={'q':'Zeta901','expectedCaseDataRevision':revision(client,base)},headers=auth)
    assert answer.status_code==200,answer.text
    assert all(c.startswith(kid+'@1#') for s in answer.json()['answer']['statements'] for c in s['citations'])
    monkeypatch.setenv('SMARTMAINT_RETRIEVAL_MODE','vector')
    monkeypatch.setenv('SMARTMAINT_VECTOR_DB',str(tmp_path/'not-built.sqlite3'))
    fallback=client.get(base+'/search',params={'q':'Zeta901','expectedCaseDataRevision':revision(client,base)}).json()
    assert fallback['mode']=='keyword_fallback' and fallback['items'][0]['sourceId']==kid
    with connect(app.state.db_path) as db:
        assert db.execute('PRAGMA foreign_key_check').fetchall()==[]
        with pytest.raises(sqlite3.IntegrityError,match='immutable'):
            db.execute('UPDATE knowledge_versions SET content_json=? WHERE knowledge_id=?',('{}',kid))


def test_changes_resubmit_versions_stale_review_rejection_and_scope(client,app):
    auth,base=confirmed_case(client);p=send(client,auth,proposal(client,auth,base))
    assert client.post('/api/knowledge-proposals/'+p['id']+'/review',json={'expectedProposalRevision':p['revision'],
        'decision':'approved','feedback':'Tự duyệt'},headers=headers(auth)).status_code==403
    login(client,'hai');assert client.get('/api/knowledge-proposals/'+p['id']).status_code==404
    lead=login(client,'anh');changed=review(client,lead,p,'changes')
    auth=login(client);new=send(client,auth,changed)
    lead=login(client,'anh')
    assert client.post('/api/knowledge-proposals/'+p['id']+'/review',json={'expectedProposalRevision':p['revision'],
        'decision':'approved','feedback':'Bản cũ'},headers=headers(lead)).status_code==409
    rejected=review(client,lead,new,'rejected')
    assert rejected['publication'] is None
    assert not client.get('/api/knowledge').json()['items']
    auth=login(client)
    versions=client.get('/api/knowledge-proposals/'+p['id']).json()['versions']
    assert [v['revision'] for v in versions]==[1,2,3]
    assert not client.get(base+'/search',params={'q':'Zeta901','expectedCaseDataRevision':revision(client,base)}).json()['items']
    with connect(app.state.db_path) as db:db.execute("DELETE FROM asset_grants WHERE user_id='u-anh'")
    lead=login(client,'anh');assert client.get('/api/knowledge-proposals/'+p['id']).status_code==404


def test_report_gate_csrf_duplicate_and_independent_review(client,app):
    auth,base=fresh(client)
    body={'expectedCaseDataRevision':revision(client,base),'expectedReportRevision':1,'title':'Test knowledge','rationale':'Demo'}
    assert client.post(base+'/knowledge-proposals',json=body,headers=headers(auth)).status_code==409
    # Finish the same case and confirm the report.
    journal_and_close(client,auth,base)
    report=client.post(base+'/report',json=report_body(client,base),headers=headers(auth)).json()['report']
    assert client.post(base+'/report/confirm',json={'expectedCaseDataRevision':revision(client,base),
        'expectedReportRevision':report['revision']},headers=headers(auth)).status_code==200
    body['expectedCaseDataRevision']=revision(client,base)
    assert client.post(base+'/knowledge-proposals',json=body,headers={'Idempotency-Key':'no-csrf'}).status_code==403
    p=proposal(client,auth,base)
    assert client.post(base+'/knowledge-proposals',json=body,headers=headers(auth)).status_code==409
    p=send(client,auth,p)
    with connect(app.state.db_path) as db:
        db.execute('INSERT INTO proposal_contributors VALUES(?,?,?)',(p['id'],p['revision'],'u-anh'))
    lead=login(client,'anh')
    assert client.get('/api/knowledge-proposals/'+p['id']).json()['canReview'] is False
    assert client.post('/api/knowledge-proposals/'+p['id']+'/review',json={'expectedProposalRevision':p['revision'],
        'decision':'approved','feedback':'Không độc lập'},headers=headers(lead)).status_code==403


def test_vector_publication_failure_retry_and_canonical_search(client,app,monkeypatch,tmp_path):
    auth,base=confirmed_case(client);p=send(client,auth,proposal(client,auth,base))
    lead=login(client,'anh');approved=review(client,lead,p);kid=approved['publication']['id']
    monkeypatch.setenv('SMARTMAINT_RETRIEVAL_MODE','vector')
    monkeypatch.setenv('SMARTMAINT_VECTOR_DB',str(tmp_path/'vectors.sqlite3'))
    monkeypatch.setenv('SMARTMAINT_EMBEDDING_DIMENSIONS','768')
    def fail(*args):raise VectorError('provider unavailable')
    monkeypatch.setattr('backend.rag.vectors.embed',fail)
    result=client.post('/api/knowledge/'+kid+'/publish',json={'expectedVersion':1},headers=headers(lead))
    assert result.status_code==503,result.text
    assert client.get('/api/knowledge-proposals/'+p['id']).json()['publication']['index_status']=='failed'
    assert client.get('/api/knowledge/'+kid).status_code==404
    def fake(texts,task,titles=None):
        return [[1.0 if i==(0 if 'Zeta901' in text else 1) else 0.0 for i in range(768)] for text in texts]
    monkeypatch.setattr('backend.rag.vectors.embed',fake)
    result=client.post('/api/knowledge/'+kid+'/publish',json={'expectedVersion':1},headers=headers(lead))
    assert result.status_code==200,result.text
    docs=load_runtime_documents(app.state.db_path)
    assert index_status(docs)['ready']
    assert vector_search(docs,'Zeta901','CNC-04','MC-400')[0]['sourceId']==kid
    assert vector_search(docs,'Zeta901','CNC-99','MC-400')==[]
    auth=login(client)
    result=client.get(base+'/search',params={'q':'Zeta901','expectedCaseDataRevision':revision(client,base)})
    assert result.json()['mode']=='vector_search' and result.json()['items'][0]['sourceId']==kid
    login(client,'nam');assert client.get(base+'/sources/'+kid,params={'version':'1'}).status_code==404


def test_publication_rechecks_permissions_after_embedding(client,app,monkeypatch):
    auth,base=confirmed_case(client);p=send(client,auth,proposal(client,auth,base))
    lead=login(client,'anh');approved=review(client,lead,p);kid=approved['publication']['id']
    monkeypatch.setenv('SMARTMAINT_RETRIEVAL_MODE','vector')
    def revoke(*args):
        with connect(app.state.db_path) as db:db.execute("DELETE FROM asset_grants WHERE user_id='u-anh'")
    monkeypatch.setattr('backend.rag.vectors.build_index',revoke)
    response=client.post('/api/knowledge/'+kid+'/publish',json={'expectedVersion':1},headers=headers(lead))
    assert response.status_code==403,response.text
    with connect(app.state.db_path) as db:
        assert db.execute('SELECT active_version FROM knowledge WHERE id=?',(kid,)).fetchone()[0] is None
    assert not any(d['id']==kid for d in load_runtime_documents(app.state.db_path))

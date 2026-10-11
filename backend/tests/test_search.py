import json

import pytest

from backend.tests.test_api import app, client, seed_path, login
from backend.rag.search import CORPUS_PATH, load_documents, search_documents
from backend.store import connect

BASE = '/api/cases/BM-26028'
QUESTIONS = json.loads(CORPUS_PATH.with_name('cnc-demo-questions.json').read_text(encoding='utf-8'))['questions']


@pytest.mark.parametrize('example',QUESTIONS,ids=lambda q:q['id'])
def test_example_questions_find_relevant_sources(example):
    hits=search_documents(load_documents(),example['question'],'CNC-04','MC-400')
    found={h['sourceId'] for h in hits}
    if example['expectedBehavior']=='no_match':
        assert not hits
    else:
        assert hits[0]['sourceId'] in example['expectedSourceIds']
    assert len(hits)<=5 and len(found)==len(hits)


@pytest.mark.parametrize('query',['rung sau thay do ga','RUNG SAU THAY ĐỒ GÁ','rung sau thay đồ gá'])
def test_vietnamese_search_and_citation(query):
    hit=search_documents(load_documents(),query,'CNC-04','MC-400')[0]
    assert hit['sourceId']=='DEMO-CNC-003'
    assert hit['citation'].startswith('DEMO-CNC-003@1.0#')
    doc=next(d for d in load_documents() if d['id']==hit['sourceId'])
    assert hit['excerpt']==next(s['text'] for s in doc['sections'] if s['id']==hit['sectionId'])


@pytest.mark.parametrize('query',['zzzzzqwerty','CNC-99 rung bất thường','MC-999 nóng','Vision camera không nhận','máy ép bị rung'])
def test_no_match_and_wrong_machine(query):
    assert search_documents(load_documents(),query,'CNC-04','MC-400')==[]


def test_search_scopes_sources_and_filters_unready(tmp_path):
    corpus=json.loads(CORPUS_PATH.read_text(encoding='utf-8'))
    corpus['documents'][0]['status']='pending'
    corpus['documents'][1]['environment']='production'
    corpus['documents'][2]['isSimulated']=False
    path=tmp_path/'corpus.json';path.write_text(json.dumps(corpus),encoding='utf-8')
    assert len(load_documents(path))==len(corpus['documents'])-3
    assert search_documents(load_documents(),'rung','CNC-99','MC-400')==[]


def test_search_api_readonly_citation_source_version_and_private_files(client,app):
    login(client)
    before=client.get(BASE).json()
    response=client.get(BASE+'/search',params={'q':'rung sau thay đồ gá','expectedCaseDataRevision':before['caseDataRevision']})
    assert response.status_code==200,response.text
    data=response.json()
    assert data['mode']=='keyword_search' and data['llmUsed'] is False and data['status']=='matches'
    hit=data['items'][0]
    source=client.get(BASE+'/sources/'+hit['sourceId'],params={'version':hit['version']})
    assert source.status_code==200
    assert source.json()['isSimulated'] is True
    assert hit['excerpt'] in [s['text'] for s in source.json()['sections']]
    assert client.get(BASE+'/sources/'+hit['sourceId'],params={'version':'not-current'}).status_code==404
    assert client.get(BASE+'/sources/missing',params={'version':'1.0'}).status_code==404
    assert client.get('/fixtures/rag/cnc-demo-sources.json').status_code==404
    assert client.get(BASE).json()==before


@pytest.mark.parametrize('name,expected',[('hai',200),('nam',404),('anh',404),('lan',404)])
def test_search_and_source_require_case_access(client,name,expected):
    login(client,name)
    assert client.get(BASE+'/search',params={'q':'rung','expectedCaseDataRevision':1}).status_code==expected
    assert client.get(BASE+'/sources/DEMO-CNC-003',params={'version':'1.0'}).status_code==expected


def test_anonymous_search_denied(client):
    assert client.get(BASE+'/search',params={'q':'rung','expectedCaseDataRevision':1}).status_code==401
    assert client.get(BASE+'/sources/DEMO-CNC-003',params={'version':'1.0'}).status_code==401


def test_stale_revision_and_input_validation(client,app):
    login(client)
    with connect(app.state.db_path) as db:
        db.execute("UPDATE cases SET data_revision=data_revision+1 WHERE id='BM-26028'")
    assert client.get(BASE+'/search',params={'q':'rung','expectedCaseDataRevision':1}).status_code==409
    for q in ['','  ','x'*1001]:
        assert client.get(BASE+'/search',params={'q':q,'expectedCaseDataRevision':2}).status_code==422


def test_broken_corpus_is_error_not_no_match(client,monkeypatch):
    login(client)
    def broken(path):
        raise ValueError('bad JSON')
    monkeypatch.setattr('backend.rag.search.load_documents',broken)
    response=client.get(BASE+'/search',params={'q':'rung','expectedCaseDataRevision':1})
    assert response.status_code==503

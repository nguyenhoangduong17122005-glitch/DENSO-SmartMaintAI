import json

import pytest

from backend.tests.test_api import app, client, seed_path, login
from backend.rag.answers import evidence_for, generate, response_payload
from backend.rag.search import load_documents, search_documents
from backend.store import connect

BASE='/api/cases/BM-26028'


@pytest.fixture(autouse=True)
def no_live_calls(monkeypatch):
    monkeypatch.setenv('SMARTMAINT_ANSWER_MODE','template')
    monkeypatch.delenv('GEMINI_API_KEY',raising=False)
    monkeypatch.delenv('SMARTMAINT_GEMINI_MODEL',raising=False)


def question(q='rung sau thay đồ gá'):
    return {'q':q,'expectedCaseDataRevision':1}


def evidence():
    docs=load_documents()
    return evidence_for(search_documents(docs,'rung sau thay đồ gá','CNC-04','MC-400'),docs)


def model_mode(monkeypatch):
    monkeypatch.setenv('SMARTMAINT_ANSWER_MODE','gemini')
    monkeypatch.setenv('GEMINI_API_KEY','not-a-real-key')
    monkeypatch.setenv('SMARTMAINT_GEMINI_MODEL','gemini-test')


def model_result(sources):
    return {'status':'answered','statements':[{'text':'Case được soạn cho demo.', 'citations':[sources[0]['citation']]}],
            'missingInformation':[]}


def test_template_exact_quotes_and_neighboring_limitations():
    sources=evidence()
    assert 'DEMO-CNC-003@1.0#applicability' in {s['citation'] for s in sources}
    result=generate('rung sau thay đồ gá',sources)
    assert result['mode']=='template' and result['llmUsed'] is False and result['llmAttempted'] is False
    lookup={s['citation']:s['excerpt'] for s in sources}
    assert len(result['statements'])==3
    for statement in result['statements']:
        assert statement['text']==lookup[statement['citations'][0]]


def test_valid_provider_result_and_structured_payload(monkeypatch):
    model_mode(monkeypatch)
    sources=evidence()
    seen=[]
    def fake(payload,key,model):
        seen.append(payload)
        assert key=='not-a-real-key'
        assert model=='gemini-test'
        return model_result(sources)
    monkeypatch.setattr('backend.rag.answers.call_gemini',fake)
    result=generate('rung sau thay đồ gá',sources)
    assert result['llmUsed'] and result['mode']=='gemini' and result['model']=='gemini-test'
    payload=seen[0]
    assert payload['generationConfig']['responseMimeType']=='application/json'
    assert payload['generationConfig']['responseJsonSchema']['additionalProperties'] is False
    assert json.loads(payload['contents'][0]['parts'][0]['text'])['simulatedSources']==sources
    assert payload['systemInstruction']['parts'][0]['text']
    assert 'not-a-real-key' not in json.dumps(payload)


@pytest.mark.parametrize('invalid',[
    {'status':'answered','statements':[{'text':'Invented','citations':['UNKNOWN@1#x']}],'missingInformation':[]},
    {'status':'answered','statements':[{'text':'No citation','citations':[]}],'missingInformation':[]},
    {'status':'answered','statements':[],'missingInformation':[]},
    {'status':'wrong-status','statements':[],'missingInformation':[]},
])
def test_bad_model_result_falls_back_without_exposing_text(monkeypatch,invalid):
    model_mode(monkeypatch)
    monkeypatch.setattr('backend.rag.answers.call_gemini',lambda *_:invalid)
    result=generate('rung',evidence())
    assert result['mode']=='template_fallback' and not result['llmUsed'] and result['llmAttempted']
    assert 'Invented' not in json.dumps(result)


def test_provider_error_has_no_secret_leak(monkeypatch):
    model_mode(monkeypatch)
    def fail(*_):
        raise OSError('Authorization: secret-provider-key')
    monkeypatch.setattr('backend.rag.answers.call_gemini',fail)
    result=generate('rung',evidence())
    assert result['mode']=='template_fallback'
    assert 'secret-provider-key' not in json.dumps(result)


def test_missing_configuration_and_no_match_do_not_call_provider(monkeypatch):
    monkeypatch.setenv('SMARTMAINT_ANSWER_MODE','gemini')
    def forbidden(*_):
        pytest.fail('Provider must not be called')
    monkeypatch.setattr('backend.rag.answers.call_gemini',forbidden)
    assert generate('rung',evidence())['llmAttempted'] is False
    model_mode(monkeypatch)
    result=generate('Vision camera',[])
    assert result['status']=='no_match' and not result['llmAttempted']


def test_answer_api_csrf_readonly_and_citations(client):
    headers=login(client)
    before=client.get(BASE).json()
    assert client.post(BASE+'/answer',json=question()).status_code==403
    response=client.post(BASE+'/answer',json=question(),headers=headers)
    assert response.status_code==200,response.text
    data=response.json()
    assert data['answer']['mode']=='template' and data['answer']['llmUsed'] is False
    assert data['evidence'] and data['items']
    assert client.get(BASE).json()==before
    assert client.post(BASE+'/answer',json=question('Vision camera không nhận'),headers=headers).json()['answer']['status']=='no_match'


@pytest.mark.parametrize('name,expected',[('hai',200),('nam',404),('anh',404),('lan',404)])
def test_answer_scope(client,name,expected):
    headers=login(client,name)
    assert client.post(BASE+'/answer',json=question(),headers=headers).status_code==expected


def test_answer_anonymous_validation_and_stale(client,app):
    assert client.post(BASE+'/answer',json=question()).status_code==401
    headers=login(client)
    assert client.post(BASE+'/answer',json=question('  '),headers=headers).status_code==422
    assert client.post(BASE+'/answer',json={**question(),'role':'lead'},headers=headers).status_code==422
    with connect(app.state.db_path) as db:
        db.execute("UPDATE cases SET data_revision=2 WHERE id='BM-26028'")
    assert client.post(BASE+'/answer',json=question(),headers=headers).status_code==409


@pytest.mark.parametrize('change,expected',[('revision',409),('rights',404),('session',401)])
def test_revalidate_after_model_delay(client,app,monkeypatch,change,expected):
    headers=login(client)
    def delayed(q,sources):
        with connect(app.state.db_path) as db:
            if change=='revision':
                db.execute("UPDATE cases SET data_revision=2 WHERE id='BM-26028'")
            elif change=='rights':
                db.execute("DELETE FROM asset_grants WHERE user_id='u-minh'")
            else:
                db.execute('DELETE FROM sessions')
        return {'statements':[]}
    monkeypatch.setattr('backend.rag.answers.generate',delayed)
    assert client.post(BASE+'/answer',json=question(),headers=headers).status_code==expected


def test_provider_http_response_parsing(monkeypatch):
    from backend.rag.answers import call_gemini
    sources=evidence()
    class Response:
        def __enter__(self):
            return self
        def __exit__(self,*_):
            pass
        def read(self,limit):
            return json.dumps({'candidates':[{'finishReason':'STOP','content':{'parts':[
                {'text':'Private reasoning is not the answer','thought':True},
                {'text':json.dumps(model_result(sources))}]}}]}).encode()
    def fake(request,timeout):
        assert request.full_url=='https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent'
        assert request.get_header('X-goog-api-key')=='fake-key'
        assert 'fake-key' not in request.full_url
        assert timeout==60
        return Response()
    monkeypatch.setattr('urllib.request.urlopen',fake)
    assert call_gemini(response_payload('rung',sources),'fake-key','models/gemini-test')==model_result(sources)


@pytest.mark.parametrize('body',[
    {'promptFeedback':{'blockReason':'SAFETY'}},
    {'candidates':[{'finishReason':'MAX_TOKENS','content':{'parts':[{'text':'{}'}]}}]},
    {'candidates':[{'finishReason':'SAFETY'}]},
    {'candidates':[]},
    {'candidates':[None]},
    {'candidates':[{'finishReason':'STOP','content':{'parts':[{'text':'not JSON'}]}}]},
])
def test_gemini_blocked_truncated_and_invalid_responses(monkeypatch,body):
    model_mode(monkeypatch)
    class Response:
        def __enter__(self):
            return self
        def __exit__(self,*_):
            pass
        def read(self,limit):
            return json.dumps(body).encode()
    monkeypatch.setattr('urllib.request.urlopen',lambda *_args,**_kwargs:Response())
    result=generate('rung',evidence())
    assert result['mode']=='template_fallback' and result['llmAttempted']
    assert result['llmUsed'] is False


def test_invalid_gemini_model_does_not_make_network_request(monkeypatch):
    model_mode(monkeypatch)
    monkeypatch.setenv('SMARTMAINT_GEMINI_MODEL','gemini-test?key=oops')
    monkeypatch.setattr('urllib.request.urlopen',lambda *_args,**_kwargs:pytest.fail('No HTTP expected'))
    result=generate('rung',evidence())
    assert result['mode']=='template_fallback' and not result['llmAttempted']

import copy
import json
import sqlite3

import pytest

from backend.rag.search import load_documents, retrieve_documents
from backend.rag.vectors import VectorError, build_index, embed, index_status, normalized, vector_search
from backend.tests.test_api import app, client, seed_path, login


@pytest.fixture
def vector_config(monkeypatch, tmp_path):
    monkeypatch.setenv('SMARTMAINT_EMBEDDING_MODEL', 'gemini-embedding-001')
    monkeypatch.setenv('SMARTMAINT_EMBEDDING_DIMENSIONS', '768')
    monkeypatch.setenv('SMARTMAINT_VECTOR_MIN_SCORE', '0.45')
    monkeypatch.setenv('SMARTMAINT_VECTOR_DB', str(tmp_path / 'vectors.sqlite3'))
    return tmp_path / 'vectors.sqlite3'


def axis(index):
    result = [0.0] * 768
    result[index] = 1.0
    return result


def fake_embed(texts, task, titles=None):
    # Deterministic test vectors only, never stored in the user's live index.
    return [axis(0 if 'đồ gá' in text else 1) for text in texts]


def test_persistent_knn_scope_dedup_and_canonical_citations(vector_config):
    docs = load_documents()
    result = build_index(docs, embedder=fake_embed)
    assert result['ready'] and result['chunks'] == sum(len(d['sections']) for d in docs)
    assert index_status(docs)['ready']
    hits = vector_search(docs, 'đồ gá', 'CNC-04', 'MC-400', embedder=fake_embed)
    assert hits and all(h['score'] > 0.99 for h in hits)
    assert len({h['sourceId'] for h in hits}) == len(hits)
    for h in hits:
        doc = next(d for d in docs if d['id'] == h['sourceId'])
        section = next(s for s in doc['sections'] if s['id'] == h['sectionId'])
        assert h['excerpt'] == section['text']
        assert h['citation'] == f'{doc["id"]}@{doc["version"]}#{section["id"]}'
    assert vector_search(docs, 'đồ gá', 'CNC-99', 'MC-400', embedder=fake_embed) == []
    assert vector_search(docs, 'đồ gá', 'CNC-04', 'MC-999', embedder=fake_embed) == []
    assert vector_search(docs, 'unrelated', 'CNC-04', 'MC-400', embedder=lambda *a: [axis(2)]) == []


def test_unchanged_index_skips_embedding_stale_index_rejected(vector_config, monkeypatch):
    docs = load_documents()
    build_index(docs, embedder=fake_embed)
    def unexpected(*args):
        raise AssertionError('Embedding should not run')
    assert not build_index(docs, embedder=unexpected)['changed']
    modified = copy.deepcopy(docs)
    modified[0]['sections'][0]['text'] += ' Changed.'
    assert not index_status(modified)['ready']
    with pytest.raises(VectorError):
        vector_search(modified, 'x', 'CNC-04', 'MC-400', embedder=unexpected)
    monkeypatch.setenv('SMARTMAINT_EMBEDDING_MODEL', 'gemini-other-embedding')
    assert not index_status(docs)['ready']


def test_failed_embedding_preserves_previous_index(vector_config):
    docs = load_documents()
    build_index(docs, embedder=fake_embed)
    changed = copy.deepcopy(docs)
    changed[0]['title'] += ' Changed'
    with pytest.raises(VectorError):
        build_index(changed, embedder=lambda texts, *args: [axis(0)[:-1] for _ in texts])
    assert index_status(docs)['ready']


@pytest.mark.parametrize('values', [[0.0]*768, [float('nan')]*768, [float('inf')]*768, [True]*768, [1.0]])
def test_invalid_vectors_rejected(values):
    with pytest.raises(VectorError):
        normalized(values, 768)


def test_embedding_http_auth_tasks_and_dimensions(vector_config, monkeypatch):
    monkeypatch.setenv('GEMINI_API_KEY', 'test-secret')
    calls = []
    class Response:
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def read(self, limit): return json.dumps({'embeddings': [{'values': axis(0)}]}).encode()
    def fake(request, timeout):
        assert 'test-secret' not in request.full_url
        assert request.get_header('X-goog-api-key') == 'test-secret'
        payload = json.loads(request.data)
        assert 'test-secret' not in json.dumps(payload)
        request = payload['requests'][0]
        calls.append({k: request[k] for k in ('taskType', 'outputDimensionality', 'title') if k in request})
        return Response()
    monkeypatch.setattr('urllib.request.urlopen', fake)
    assert embed(['doc'], 'RETRIEVAL_DOCUMENT', ['Title'])[0] == axis(0)
    embed(['question'], 'RETRIEVAL_QUERY')
    assert calls == [{'taskType': 'RETRIEVAL_DOCUMENT', 'outputDimensionality': 768, 'title': 'Title'},
                     {'taskType': 'RETRIEVAL_QUERY', 'outputDimensionality': 768}]


def test_vector_mode_scope_and_fallback(vector_config, monkeypatch):
    docs = load_documents()
    monkeypatch.setenv('SMARTMAINT_RETRIEVAL_MODE', 'vector')
    def unexpected(*args, **kwargs): raise AssertionError('Outside scope must not call provider')
    monkeypatch.setattr('backend.rag.vectors.embed', unexpected)
    assert retrieve_documents(docs, 'Vision camera', 'CNC-04', 'MC-400')['items'] == []
    result = retrieve_documents(docs, 'rung sau thay đồ gá', 'CNC-04', 'MC-400')
    assert result['mode'] == 'keyword_fallback' and result['items']


def test_api_uses_vector_with_existing_case_permissions(vector_config, monkeypatch, client):
    docs = load_documents()
    build_index(docs, embedder=fake_embed)
    monkeypatch.setenv('SMARTMAINT_RETRIEVAL_MODE', 'vector')
    monkeypatch.setattr('backend.rag.vectors.embed', fake_embed)
    assert client.get('/api/rag/status').status_code == 401
    headers = login(client)
    status = client.get('/api/rag/status').json()
    assert status['index']['ready']
    response = client.get('/api/cases/BM-26028/search', params={'q': 'đồ gá', 'expectedCaseDataRevision': 1})
    assert response.status_code == 200 and response.json()['mode'] == 'vector_search'
    answer = client.post('/api/cases/BM-26028/answer', headers=headers,
                         json={'q': 'đồ gá', 'expectedCaseDataRevision': 1})
    assert answer.status_code == 200 and answer.json()['retrievalMode'] == 'vector_search'
    assert answer.json()['answer']['mode'] == 'template'
    login(client, 'nam')
    monkeypatch.setattr('backend.rag.vectors.embed', lambda *args: pytest.fail('Scope must be checked first'))
    assert client.get('/api/cases/BM-26028/search', params={'q': 'đồ gá', 'expectedCaseDataRevision': 1}).status_code == 404

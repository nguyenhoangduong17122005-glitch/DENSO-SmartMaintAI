"""Gemini embeddings and a persistent sqlite-vec cosine index for demo sources."""
import json
import math
import os
import re
import sqlite3
import urllib.error
import urllib.request
from contextlib import closing
from pathlib import Path

import sqlite_vec

from ..domain import digest
from ..store import ROOT


class VectorError(Exception):
    """Safe operational messages, never provider response bodies or credentials."""


def settings():
    model = os.getenv('SMARTMAINT_EMBEDDING_MODEL', 'gemini-embedding-001').removeprefix('models/')
    try:
        dimensions = int(os.getenv('SMARTMAINT_EMBEDDING_DIMENSIONS', '768'))
        minimum = float(os.getenv('SMARTMAINT_VECTOR_MIN_SCORE', '0.45'))
    except ValueError:
        raise VectorError('Cấu hình kích thước hoặc ngưỡng vector không hợp lệ.') from None
    if not re.fullmatch(r'gemini-[A-Za-z0-9._-]+', model) or not 128 <= dimensions <= 3072 or not 0 <= minimum <= 1:
        raise VectorError('Cấu hình embedding không hợp lệ.')
    return model, dimensions, minimum


def index_path():
    return Path(os.getenv('SMARTMAINT_VECTOR_DB', str(ROOT / '.runtime/rag-vectors.sqlite3')))


def signature(documents):
    model, dimensions, _ = settings()
    return {'schema': 1, 'inputFormat': 1, 'corpusHash': digest(documents), 'model': model, 'dimensions': dimensions}


def normalized(values, dimensions):
    if not isinstance(values, list) or len(values) != dimensions:
        raise VectorError('Embedding trả về sai kích thước.')
    if any(type(v) not in (float, int) or not math.isfinite(v) for v in values):
        raise VectorError('Embedding chứa giá trị không hợp lệ.')
    norm = math.sqrt(sum(v * v for v in values))
    if not math.isfinite(norm) or norm == 0:
        raise VectorError('Embedding không có độ dài hợp lệ.')
    return [v / norm for v in values]


def embed(texts, task, titles=None):
    key = os.getenv('GEMINI_API_KEY', '').strip()
    if not key:
        raise VectorError('Chưa cấu hình GEMINI_API_KEY trong file .env.')
    model, dimensions, _ = settings()
    requests = []
    for i, text in enumerate(texts):
        # batchEmbedContents still accepts these request-level fields. Some live
        # deployments ignore embedContentConfig and return the default 3072 dimensions.
        config = {'taskType': task, 'outputDimensionality': dimensions}
        if task == 'RETRIEVAL_DOCUMENT' and titles:
            config['title'] = titles[i]
        requests.append({'model': 'models/' + model, 'content': {'parts': [{'text': text}]}, **config})
    request = urllib.request.Request(
        f'https://generativelanguage.googleapis.com/v1beta/models/{model}:batchEmbedContents',
        data=json.dumps({'requests': requests}, ensure_ascii=False).encode('utf-8'), method='POST',
        headers={'x-goog-api-key': key, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read(4_000_001)
        if len(body) > 4_000_000:
            raise VectorError('Phản hồi embedding quá lớn.')
        embeddings = json.loads(body)['embeddings']
        if len(embeddings) != len(texts):
            raise VectorError('Embedding trả về thiếu dữ liệu.')
        return [normalized(item['values'], dimensions) for item in embeddings]
    except urllib.error.HTTPError as error:
        raise VectorError(f'Gemini embedding chưa khả dụng (HTTP {error.code}); kiểm tra key, model hoặc hạn mức.') from None
    except (OSError, ValueError, KeyError, TypeError):
        raise VectorError('Không nhận được embedding hợp lệ từ Gemini. Kiểm tra kết nối và cấu hình.') from None


def open_index(path, readonly=False):
    db = sqlite3.connect(Path(path).resolve().as_uri() + '?mode=ro', uri=True, timeout=10) if readonly else sqlite3.connect(path, timeout=10)
    try:
        db.row_factory = sqlite3.Row
        db.enable_load_extension(True)
        sqlite_vec.load(db)
        db.enable_load_extension(False)
        return db
    except Exception:
        db.close()
        raise


def index_status(documents, path=None):
    path = Path(path or index_path())
    if not path.exists():
        return {'ready': False, 'chunks': 0, 'reason': 'Chưa tạo chỉ mục vector.'}
    try:
        with closing(open_index(path, readonly=True)) as db:
            db.execute('BEGIN')
            info = json.loads(db.execute('SELECT value FROM index_meta WHERE key=?', ('signature',)).fetchone()[0])
            count = db.execute('SELECT count(*) FROM chunks').fetchone()[0]
            ready = info == signature(documents)
            return {'ready': ready, 'chunks': count, 'reason': 'Sẵn sàng' if ready else 'Nguồn hoặc model đã đổi; cần tạo lại chỉ mục.'}
    except (sqlite3.Error, OSError, ValueError, TypeError, VectorError):
        return {'ready': False, 'chunks': 0, 'reason': 'Chỉ mục chưa hợp lệ; cần tạo lại.'}


def build_index(documents, path=None, embedder=None):
    """Network calls finish before one atomic replacement of the previous index."""
    path = Path(path or index_path())
    if index_status(documents, path)['ready']:
        return {'changed': False, **index_status(documents, path)}
    info = signature(documents)
    chunks = []
    texts = []
    for doc in documents:
        for section in doc['sections']:
            text = '\n'.join([doc['title'], ' · '.join(doc['keywords']), section['heading'], section['text']])
            if len(text) > 6000:
                raise VectorError('Một mục nguồn quá dài; cần chia nhỏ trước khi tạo embedding.')
            texts.append(text)
            chunks.append({'sourceId': doc['id'], 'version': doc['version'], 'title': doc['title'],
                'sectionId': section['id'], 'heading': section['heading'], 'excerpt': section['text'],
                'citation': f'{doc["id"]}@{doc["version"]}#{section["id"]}', 'assetIds': doc['assetIds'],
                'machineModel': doc['machineModel'], 'environment': 'demo', 'isSimulated': True})
    vectors = []
    provider = embedder or embed
    for offset in range(0, len(texts), 10):
        batch = provider(texts[offset:offset+10], 'RETRIEVAL_DOCUMENT', [c['title'] for c in chunks[offset:offset+10]])
        if len(batch) != len(texts[offset:offset+10]):
            raise VectorError('Embedding trả về thiếu dữ liệu.')
        vectors.extend(normalized(v, info['dimensions']) for v in batch)
    path.parent.mkdir(parents=True, exist_ok=True)
    with closing(open_index(path)) as db:
        try:
            db.execute('BEGIN IMMEDIATE')
            db.execute('DROP TABLE IF EXISTS vectors')
            db.execute('DROP TABLE IF EXISTS chunks')
            db.execute('DROP TABLE IF EXISTS index_meta')
            db.execute('CREATE TABLE index_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL)')
            db.execute('CREATE TABLE chunks(id INTEGER PRIMARY KEY, payload TEXT NOT NULL)')
            db.execute(f'CREATE VIRTUAL TABLE vectors USING vec0(embedding float[{info["dimensions"]}] distance_metric=cosine, asset_id text, machine_model text)')
            for chunk, vector in zip(chunks, vectors):
                for asset in chunk['assetIds']:
                    row_id = db.execute('INSERT INTO chunks(payload) VALUES(?)', (json.dumps(chunk, ensure_ascii=False),)).lastrowid
                    db.execute('INSERT INTO vectors(rowid,embedding,asset_id,machine_model) VALUES(?,?,?,?)',
                               (row_id, sqlite_vec.serialize_float32(vector), asset, chunk['machineModel']))
            db.execute('INSERT INTO index_meta VALUES(?,?)', ('signature', json.dumps(info)))
            db.commit()
        except Exception:
            db.rollback()
            raise
    return {'changed': True, **index_status(documents, path)}


def vector_search(documents, query, asset_id, model, limit=5, path=None, embedder=None):
    path = Path(path or index_path())
    status = index_status(documents, path)
    if not status['ready']:
        raise VectorError(status['reason'])
    vector = (embedder or embed)([query], 'RETRIEVAL_QUERY')[0]
    _, dimensions, minimum = settings()
    vector = normalized(vector, dimensions)
    with closing(open_index(path, readonly=True)) as db:
        db.execute('BEGIN')
        info = json.loads(db.execute("SELECT value FROM index_meta WHERE key='signature'").fetchone()[0])
        if info != signature(documents):
            raise VectorError('Chỉ mục đã đổi; tra cứu lại.')
        count = db.execute('SELECT count(*) FROM chunks').fetchone()[0]
        rows = db.execute('SELECT rowid,distance FROM vectors WHERE embedding MATCH ? AND k=? AND asset_id=? AND machine_model=? ORDER BY distance',
                          (sqlite_vec.serialize_float32(vector), max(1, count), asset_id, model)).fetchall()
        results = []
        seen = set()
        for row in rows:
            score = 1.0 - row['distance']
            if score < minimum:
                continue
            chunk = json.loads(db.execute('SELECT payload FROM chunks WHERE id=?', (row['rowid'],)).fetchone()[0])
            if chunk['sourceId'] in seen:
                continue
            # Return the current canonical source, never stale text from the index.
            doc = next((d for d in documents if d['id'] == chunk['sourceId'] and d['version'] == chunk['version']
                        and asset_id in d['assetIds'] and d['machineModel'] == model), None)
            if not doc:
                continue
            section = next(s for s in doc['sections'] if s['id'] == chunk['sectionId'])
            results.append({**chunk, 'excerpt': section['text'], 'score': round(score, 6)})
            seen.add(chunk['sourceId'])
            if len(results) == limit:
                break
    return results


def main():
    import sys
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    from ..config import load_config
    from .search import load_runtime_documents
    load_config()
    try:
        result = build_index(load_runtime_documents())
    except (VectorError, sqlite3.Error, OSError) as error:
        print(str(error) if isinstance(error, VectorError) else 'Cannot build the local vector index.')
        raise SystemExit(1) from None
    print(json.dumps({'index': str(index_path()), **result}, ensure_ascii=True))


if __name__ == '__main__':
    main()

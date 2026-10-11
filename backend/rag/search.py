"""Small local keyword search over explicitly simulated CNC sources; no LLM."""
import json
import os
import sqlite3
import re
import unicodedata
from pathlib import Path

from fastapi import Depends, HTTPException, Query, Request

from ..store import ROOT, connect

CORPUS_PATH = ROOT / "fixtures/rag/cnc-demo-sources.json"
STOP_WORDS = set("toi cho co la va cua thi khi can gi nao nhung mot cac duoc voi ve tai tu den hay khong da chua de nay do bao nhieu the phai rang du chung ta luc cnc 04 may mc 400".split())


def normalize(text):
    text = unicodedata.normalize("NFD", text.lower().replace("đ", "d"))
    return re.sub(r"[^a-z0-9]+", " ", "".join(c for c in text if not unicodedata.combining(c))).strip()


def terms(text):
    return set(normalize(text).split()) - STOP_WORDS


def load_documents(path=CORPUS_PATH):
    corpus = json.loads(Path(path).read_text(encoding="utf-8"))
    if corpus.get("environment") != "demo" or corpus.get("isSimulated") is not True:
        raise ValueError("Only the simulated corpus is supported")
    return [d for d in corpus["documents"] if d.get("environment") == "demo"
            and d.get("isSimulated") is True and d.get("status") == "demo_ready"]


def load_runtime_documents(db_path=None, corpus_path=CORPUS_PATH, extra_ids=()):
    from ..knowledge import published_documents
    return load_documents(corpus_path)+published_documents(db_path,extra_ids)


def scoped(documents, asset_id, model):
    return [d for d in documents if asset_id in d.get("assetIds", []) and d.get("machineModel") == model]


def outside_scope(query, asset_id, model):
    text = normalize(query)
    if re.search(r"\bvision\b|\bcamera\b|\bmay ep\b", text):
        return True
    for code in re.findall(r"(?<![\w-])(?:cnc|mc)[-\s]*\d+\b", query, flags=re.I):
        if normalize(code) not in {normalize(asset_id), normalize(model)}:
            return True
    return False


def search_documents(documents, query, asset_id, model, limit=5):
    if outside_scope(query, asset_id, model):
        return []
    wanted = terms(query)
    if not wanted:
        return []
    results = []
    normalized_query = normalize(query)
    for doc in scoped(documents, asset_id, model):
        title = terms(doc["title"])
        keywords = terms(" ".join(doc["keywords"]))
        # Prefer complete keywords/phrases over coincidental Vietnamese syllables.
        phrase_bonus = sum(10 if len(normalize(keyword).split()) <= 2 else 20
            for keyword in doc["keywords"] if (terms(keyword) or len(normalize(keyword).split()) >= 3)
            and re.search(r"\b" + re.escape(normalize(keyword)) + r"\b", normalized_query))
        best = None
        for section in doc["sections"]:
            body = terms(section["heading"] + " " + section["text"])
            overlap = wanted & (title | keywords | body)
            # Avoid generic one-word matches in a long question.
            if not overlap or (len(wanted) >= 4 and len(overlap) < 2):
                continue
            score = 6 * len(wanted & title) + 6 * len(wanted & keywords) + len(wanted & body)
            score += phrase_bonus
            score += 3 * len(wanted & terms(section["heading"]))
            if best is None or score > best[0]:
                best = (score, section)
        if best:
            score, section = best
            results.append({"sourceId": doc["id"], "version": doc["version"], "title": doc["title"],
                "sectionId": section["id"], "heading": section["heading"], "excerpt": section["text"],
                "citation": f'{doc["id"]}@{doc["version"]}#{section["id"]}',
                "environment": "demo", "isSimulated": True, "score": score})
    return sorted(results, key=lambda r: (-r["score"], r["sourceId"]))[:limit]


def register_search(app, path, current, access, corpus_path=CORPUS_PATH):
    def documents():
        try:
            return load_runtime_documents(path,corpus_path)
        except (OSError, ValueError, KeyError, TypeError):
            raise HTTPException(503, "Chưa đọc được bộ tài liệu mẫu. Thử lại sau.") from None

    def case_scope(db, user, case_id):
        case = access(db, user, case_id)
        asset = db.execute("SELECT machine_model FROM assets WHERE id=?", (case["asset_id"],)).fetchone()
        return case, asset["machine_model"]

    @app.get("/api/cases/{case_id}/search")
    def search(case_id: str, request: Request, q: str = Query(min_length=3, max_length=1000),
               expectedCaseDataRevision: int = Query(ge=1), user=Depends(current)):
        if len(q.strip()) < 3:
            raise HTTPException(422, "Nhập câu hỏi ít nhất 3 ký tự.")
        with connect(path) as db:
            case, model = case_scope(db, user, case_id)
            if case["data_revision"] != expectedCaseDataRevision:
                raise HTTPException(409, "Hồ sơ đã thay đổi. Tải lại hồ sơ trước khi tra cứu.")
            docs = documents()
            asset_id = case['asset_id']
        from ..domain import digest
        corpus_hash = digest(docs)
        retrieval = retrieve_documents(docs, q, asset_id, model)
        latest_user = current(request)
        with connect(path) as db:
            latest, _ = case_scope(db, latest_user, case_id)
            if latest['data_revision'] != expectedCaseDataRevision or digest(documents()) != corpus_hash:
                raise HTTPException(409, 'Hồ sơ hoặc nguồn đã đổi trong lúc tra cứu. Tải lại hồ sơ.')
        return {"query": q.strip(), "caseId": case_id, "caseDataRevision": expectedCaseDataRevision,
                **retrieval, "llmUsed": False, "environment": "demo", "isSimulated": True,
                "status": "matches" if retrieval['items'] else "no_match"}

    @app.get('/api/rag/status')
    def rag_status(user=Depends(current)):
        from .vectors import index_status, settings, VectorError
        try:
            embedding_model, dimensions, minimum = settings()
            index = index_status(documents())
        except VectorError:
            embedding_model, dimensions, minimum = '', 0, 0
            index = {'ready': False, 'chunks': 0, 'reason': 'Cấu hình embedding chưa hợp lệ.'}
        generation_model = os.getenv('SMARTMAINT_GEMINI_MODEL', '')
        return {'retrievalMode': os.getenv('SMARTMAINT_RETRIEVAL_MODE', 'keyword'),
                'answerMode': os.getenv('SMARTMAINT_ANSWER_MODE', 'template'),
                'geminiConfigured': bool(os.getenv('GEMINI_API_KEY', '').strip() and generation_model),
                'generationModel': generation_model, 'embeddingModel': embedding_model,
                'dimensions': dimensions, 'minimumScore': minimum, 'index': index,
                'liveVerified': False}

    @app.get("/api/cases/{case_id}/sources/{source_id}")
    def source(case_id: str, source_id: str, version: str = Query(min_length=1, max_length=40), user=Depends(current)):
        with connect(path) as db:
            case, model = case_scope(db, user, case_id)
            for doc in scoped(documents(), case["asset_id"], model):
                if doc["id"] == source_id and doc["version"] == version:
                    return {**doc, "notice": "Nguồn tự soạn cho demo, không phải tài liệu hoặc hướng dẫn vận hành thực tế."}
        raise HTTPException(404, "Không có phiên bản nguồn này trong phạm vi hồ sơ.")


def retrieve_documents(documents, query, asset_id, model):
    requested = os.getenv('SMARTMAINT_RETRIEVAL_MODE', 'keyword')
    if requested == 'vector':
        from .vectors import vector_search, VectorError
        if outside_scope(query, asset_id, model) or not scoped(documents, asset_id, model) or not terms(query):
            return {'items': [], 'mode': 'vector_search', 'notice': 'Chưa có nguồn phù hợp trong phạm vi CNC của hồ sơ.'}
        try:
            items = vector_search(documents, query, asset_id, model)
            return {'items': items, 'mode': 'vector_search', 'notice': 'Tìm kiếm ngữ nghĩa bằng Gemini Embedding và sqlite-vec trên nguồn mô phỏng. Điểm tương đồng không phải độ tin cậy chẩn đoán.'}
        except (VectorError, sqlite3.Error, OSError):
            return {'items': search_documents(documents, query, asset_id, model), 'mode': 'keyword_fallback',
                    'notice': 'Vector chưa khả dụng (key, chỉ mục hoặc kết nối). Đang dùng tìm kiếm từ khóa; xem trạng thái RAG phía trên.'}
    return {'items': search_documents(documents, query, asset_id, model), 'mode': 'keyword_search',
            'notice': 'Tìm kiếm từ khóa trên tài liệu mô phỏng. Có nguồn khớp chưa có nghĩa đủ căn cứ chẩn đoán.'}

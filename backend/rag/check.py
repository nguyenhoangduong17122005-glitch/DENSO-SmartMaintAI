"""Explicit live check: build/reuse embeddings, vector query, then one Gemini answer."""
import json
import sqlite3

from ..config import load_config


def main():
    import sys
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    load_config()
    from .answers import evidence_for, generate
    from .search import load_runtime_documents, retrieve_documents
    from .vectors import build_index, VectorError
    try:
        docs = load_runtime_documents()
        index = build_index(docs)
        question = 'Máy CNC rung sau khi thay đồ gá cần ghi nhận thông tin gì?'
        retrieval = retrieve_documents(docs, question, 'CNC-04', 'MC-400')
        if retrieval['mode'] != 'vector_search' or not retrieval['items']:
            raise VectorError('Chưa nhận được nguồn từ tìm kiếm vector thật.')
        answer = generate(question, evidence_for(retrieval['items'], docs))
        if not answer['llmUsed']:
            raise VectorError(answer['label'])
        print(json.dumps({'passed': True, 'chunks': index['chunks'], 'retrieval': retrieval['mode'],
                          'answer': answer['mode'], 'model': answer['model'],
                          'sources': [item['sourceId'] for item in retrieval['items']]}, ensure_ascii=True))
    except (VectorError, OSError, sqlite3.Error) as error:
        print(str(error) if isinstance(error, VectorError) else 'Live RAG check failed. Check local configuration and connection.')
        raise SystemExit(1) from None


if __name__ == '__main__':
    main()

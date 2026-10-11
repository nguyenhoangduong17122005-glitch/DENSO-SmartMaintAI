"""Run the ten demo questions through the real local API using an isolated DB."""
import json
import os
import secrets
from datetime import datetime
from pathlib import Path
from time import perf_counter
from unittest.mock import patch
from uuid import uuid4
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient

from .domain import digest
from .manage import seed_demo
from .rag.search import CORPUS_PATH, load_documents
from .store import ROOT


def main():
    run_dir = ROOT / '.runtime' / ('demo-check-' + uuid4().hex)
    run_dir.mkdir(parents=True)
    db_path = run_dir / 'check.sqlite3'
    password = secrets.token_urlsafe(24)
    seed_demo(db_path, {name: password for name in ['minh', 'hai', 'anh', 'lan', 'nam']})
    questions_path = CORPUS_PATH.with_name('cnc-demo-questions.json')
    questions = json.loads(questions_path.read_text(encoding='utf-8'))['questions']
    documents = load_documents()
    canonical = {f'{doc["id"]}@{doc["version"]}#{s["id"]}': s['text']
                 for doc in documents for s in doc['sections']}
    results = []
    # Always offline: never inherit a configured provider for this demo check.
    with patch.dict(os.environ, {'SMARTMAINT_ANSWER_MODE': 'template', 'SMARTMAINT_RETRIEVAL_MODE': 'keyword', 'SMARTMAINT_DB': str(db_path)}):
        from .main import create_app
        with TestClient(create_app(db_path)) as client:
            login = client.post('/api/auth/login', json={'username': 'minh', 'password': password})
            login.raise_for_status()
            headers = {'X-CSRF-Token': login.json()['csrfToken']}
            base = '/api/cases/BM-26028'
            before = client.get(base).json()
            for example in questions:
                started = perf_counter()
                response = client.post(base + '/answer', headers=headers, json={
                    'q': example['question'], 'expectedCaseDataRevision': before['caseDataRevision']})
                elapsed_ms = round((perf_counter() - started) * 1000, 2)
                data = response.json()
                answer = data.get('answer', {})
                hits = data.get('items', [])
                statements = answer.get('statements', [])
                expected_status = {'has_source': 'reference_only', 'insufficient_evidence': 'insufficient_evidence',
                                   'no_match': 'no_match'}[example['expectedBehavior']]
                citations = [c for s in statements for c in s.get('citations', [])]
                sources_open = True
                for source_id, version in {(c.split('@')[0], c.split('@')[1].split('#')[0]) for c in citations}:
                    opened = client.get(base + '/sources/' + source_id, params={'version': version})
                    sources_open = sources_open and opened.status_code == 200
                no_match = example['expectedBehavior'] == 'no_match'
                checks = {
                    'http_ok': response.status_code == 200,
                    'expected_status': answer.get('status') == expected_status,
                    'top_source': (not hits and not statements) if no_match else bool(hits and hits[0]['sourceId'] in example['expectedSourceIds']),
                    'template_only': answer.get('mode') == 'template' and answer.get('llmUsed') is False and answer.get('llmAttempted') is False,
                    'simulated_label': data.get('environment') == 'demo' and data.get('isSimulated') is True,
                    'citations_exact_source': all(s.get('citations') and all(c in canonical and canonical[c] == s['text'] for c in s['citations']) for s in statements),
                    'answer_from_expected_source': not statements if no_match else bool(statements and all(
                        c.split('@')[0] in example['expectedSourceIds'] for c in citations)),
                    'cited_versions_open': sources_open,
                    'case_unchanged': client.get(base).json() == before,
                }
                results.append({'id': example['id'], 'question': example['question'],
                    'expectedBehavior': example['expectedBehavior'], 'expectedSourceIds': example['expectedSourceIds'],
                    'expectedAnswerPoints': example['expectedAnswerPoints'], 'mustNotClaim': example['mustNotClaim'],
                    'passed': all(checks.values()), 'checks': checks, 'elapsedMsInProcess': elapsed_ms,
                    'response': data})
    report = {'checkedAt': datetime.now(ZoneInfo('Asia/Bangkok')).isoformat(),
        'mode': 'template', 'liveGeminiTested': False, 'transport': 'ASGI TestClient, no live HTTP server',
        'corpusHash': digest(documents), 'questionSetHash': digest(questions),
        'summary': {'total': len(results), 'passed': sum(r['passed'] for r in results)},
        'limitations': ['Fixed ten-question demo set used for tuning, not an independent benchmark.',
                        'Checks cover status, ranking, literal source quotes, citations, access and read-only behavior.',
                        'Expected answer points and forbidden claims still require reading in context; no automatic semantic grading.',
                        'No Gemini request made. Timings are in-process, not network/model latency.'],
        'results': results}
    output = ROOT / '.runtime/reports/STEP9-DEMO-RESULTS.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Demo API checks: {report["summary"]["passed"]}/{len(results)} passed; mode=template; Gemini not called.')
    print('Report: ' + str(output))
    if not all(r['passed'] for r in results):
        raise SystemExit(1)


if __name__ == '__main__':
    main()

"""CI check against Compose on localhost; uses only synthetic data, no API key."""
import http.cookiejar
import json
import subprocess
import time
import urllib.error
import urllib.request
from uuid import uuid4


def main():
    base = 'http://127.0.0.1:8001'
    browser = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def request(path, body=None, headers=None):
        encoded = None if body is None else json.dumps(body).encode()
        req = urllib.request.Request(base + path, data=encoded,
                                     headers={'Content-Type':'application/json', **(headers or {})})
        with browser.open(req, timeout=10) as response:
            return json.load(response)

    def ready():
        for _ in range(120):
            try:
                if request('/api/health')['status'] == 'ok':
                    return
            except (OSError, ValueError):
                pass
            time.sleep(1)
        raise RuntimeError('Container did not become ready')

    ready()
    with browser.open(base + '/', timeout=10) as response:
        assert 'SmartMaint' in response.read().decode()
    identity = request('/api/auth/demo-role', {'role':'maintenance'})
    csrf = {'X-CSRF-Token':identity['csrfToken']}
    before = request('/api/cases')['items']
    sample = request('/api/cases/BM-26028')
    answer = request('/api/cases/BM-26028/answer',
                     {'q':'rung sau thay đồ gá', 'expectedCaseDataRevision':sample['caseDataRevision']}, csrf)
    assert answer['answer']['mode'] == 'template'
    assert answer['answer']['statements']
    created = request('/api/cases', {
        'assetId':'CNC-04', 'title':'CI Docker persistence '+uuid4().hex[:8], 'type':'BM',
        'demoIdentityConfirmed':True, 'existingCaseReason':'Independent synthetic Docker verification',
        'context':{'symptom':'Synthetic vibration observation, no confirmed cause.'}},
        {**csrf, 'Idempotency-Key':uuid4().hex})
    assert len(request('/api/cases')['items']) == len(before) + 1
    subprocess.run(['docker','compose','restart','smartmaint'], check=True)
    ready()
    request('/api/auth/demo-role', {'role':'maintenance'})
    assert request('/api/cases/'+created['id'])['title'] == created['title']
    for path in ['/.env','/.runtime/smartmaint.sqlite3','/backend/store.py']:
        try:
            browser.open(base + path, timeout=10)
            raise AssertionError('Private file accessible: '+path)
        except urllib.error.HTTPError as error:
            assert error.code == 404
    print('Docker passed: startup, role session, source-based answer, create case, restart persistence and private-file protection.')


if __name__ == '__main__':
    main()

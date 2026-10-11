"""Optional local Edge smoke test; uses a separate DB/profile under .runtime.

Requires websocket-client. Run: py -m backend.tools.browser_smoke
"""
import base64
import json
import os
import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from uuid import uuid4

import websocket

from ..manage import seed_demo
from ..store import ROOT, connect


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def wait_json(url):
    deadline = time.monotonic() + 15
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=1) as response:
                return json.load(response)
        except (OSError, ValueError):
            time.sleep(0.1)
    raise RuntimeError(f"Timeout waiting for {url}")


def main():
    # Diagnostics must never seed or mutate the configured cloud database.
    os.environ['SMARTMAINT_STORAGE'] = 'sqlite'
    demo_roles = "--demo-roles" in sys.argv
    original_ui = "--original-ui" in sys.argv
    demo_roles = demo_roles or original_ui
    edge = Path(os.environ.get("SMARTMAINT_EDGE", r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"))
    if not edge.is_file():
        raise RuntimeError("Edge not found; set SMARTMAINT_EDGE to a local executable")
    run_dir = ROOT / ".runtime" / ("browser-smoke-" + uuid4().hex)
    run_dir.mkdir(parents=True)
    db_path = run_dir / "smoke.sqlite3"
    password = "browser-smoke-only-password"
    seed_demo(db_path, {name: password for name in ["minh", "hai", "anh", "lan", "nam"]})
    api_port, debug_port = free_port(), free_port()
    base = f"http://127.0.0.1:{api_port}"
    env = {**os.environ, "SMARTMAINT_DB": str(db_path), "SMARTMAINT_SECURE_COOKIE": "0", "SMARTMAINT_ANSWER_MODE": "template", "SMARTMAINT_DEMO_ROLE_SELECTION": "0"}
    env['SMARTMAINT_RETRIEVAL_MODE'] = 'keyword'
    if demo_roles:
        env["SMARTMAINT_DEMO_ROLE_SELECTION"] = "1"
    processes = []
    ws = None
    errors = []
    try:
        processes.append(subprocess.Popen([sys.executable, "-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1",
                                           "--port", str(api_port)], cwd=ROOT, env=env,
                                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
        wait_json(base + "/api/health")
        processes.append(subprocess.Popen([str(edge), "--headless=new", "--disable-gpu", "--no-first-run",
                                           "--no-default-browser-check", "--disable-extensions",
                                           "--user-data-dir=" + str(run_dir / "edge-profile"),
                                           "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=" + str(debug_port),
                                           "about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
        pages = wait_json(f"http://127.0.0.1:{debug_port}/json/list")
        target = next(page for page in pages if page.get("type") == "page")
        ws = websocket.create_connection(target["webSocketDebuggerUrl"], timeout=10, suppress_origin=True)
        sequence = 0

        def call(method, params=None):
            nonlocal sequence
            sequence += 1
            request_id = sequence
            ws.send(json.dumps({"id": request_id, "method": method, "params": params or {}}))
            while True:
                response = json.loads(ws.recv())
                if response.get("method") == "Runtime.exceptionThrown":
                    errors.append(response["params"]["exceptionDetails"])
                if response.get("id") == request_id:
                    if "error" in response:
                        raise RuntimeError(response["error"])
                    return response.get("result", {})

        def evaluate(expression):
            if expression.startswith('const '):
                expression='{'+expression+'}'
            result = call("Runtime.evaluate", {"expression": expression, "returnByValue": True, "awaitPromise": True})
            if "exceptionDetails" in result:
                raise RuntimeError(result["exceptionDetails"])
            return result.get("result", {}).get("value")

        def wait(expression):
            deadline = time.monotonic() + 10
            while time.monotonic() < deadline:
                if evaluate(expression):
                    return
                time.sleep(0.1)
            state = evaluate("({hash:location.hash,page:window.SM?.ui?.page,text:document.body.innerText.slice(-2500)})")
            raise AssertionError("Browser condition timed out: " + expression + "\nState: " + json.dumps(state, ensure_ascii=False))

        def sign_in(name):
            if original_ui:
                if evaluate("!!document.querySelector('#demo-role')"):
                    evaluate("document.querySelector('#demo-role').requestSubmit()")
                    wait("!!document.querySelector('#detail')")
                    return
                role_id={'minh':'u-minh','hai':'u-hai','anh':'u-anh'}[name]
                if evaluate("!!document.querySelector('[data-form=demo-login]')"):
                    evaluate("document.querySelector('[name=account][value=" + role_id + "]').checked=true; document.querySelector('[data-form=demo-login]').requestSubmit();")
                else:
                    wait("!window.smartMaintWorkspaceCanLeave||window.smartMaintWorkspaceCanLeave()")
                    evaluate("SM.login(" + json.dumps(role_id) + ")")
                wait("!!document.querySelector('.sidebar')")
                evaluate("SM.go('cnc')")
                wait("!!document.querySelector('#detail')")
                assert evaluate("!!document.querySelector('.brand-copy')")
                return
            if demo_roles:
                wait("!!document.querySelector('#demo-role')")
                assert evaluate("document.querySelector('[name=password]')===null")
                role = {"minh": "maintenance", "hai": "expert", "anh": "lead"}[name]
                evaluate("document.querySelector('#demo-role [name=role]').value=" + json.dumps(role) + ";document.querySelector('#demo-role').requestSubmit();")
                wait("!!document.querySelector('#detail')")
                return
            wait("!!document.querySelector('#login')")
            evaluate("document.querySelector('[name=username]').value=" + json.dumps(name) + ";"
                     "document.querySelector('[name=password]').value=" + json.dumps(password) + ";"
                     "document.querySelector('#login').requestSubmit();")
            wait("!!document.querySelector('#detail')")

        def navigate(expression):
            wait("!window.smartMaintWorkspaceCanLeave||window.smartMaintWorkspaceCanLeave()")
            evaluate(expression)

        def documentation_screenshot(name):
            if '--docs-screenshots' not in sys.argv:
                return
            destination = ROOT / 'docs/assets/screenshots'
            destination.mkdir(parents=True, exist_ok=True)
            evaluate('document.fonts.ready.then(()=>true)')
            captured = call('Page.captureScreenshot', {'format':'png', 'captureBeyondViewport':False})
            (destination / name).write_bytes(base64.b64decode(captured['data']))

        call("Runtime.enable")
        call("Page.enable")
        call("Emulation.setDeviceMetricsOverride", {"width": 1280, "height": 900, "deviceScaleFactor": 1, "mobile": False})
        call("Page.navigate", {"url": base if original_ui else base + "/workspace"})
        if original_ui:
            wait("!!document.querySelector('[data-form=demo-login]')")
            wait("typeof window.SM?.actions['guide-open']==='function'")
            evaluate("document.querySelector('.login-help [data-action=guide-open]').click()")
            wait("!!document.querySelector('dialog[open] .demo-guide-steps')")
            evaluate("SM.closeModal()")
            documentation_screenshot('role-selection.png')
        sign_in("minh")
        if original_ui:
            evaluate("document.querySelector('[data-action=sidebar-collapse]').click()")
            wait("document.querySelector('.app-shell').classList.contains('sidebar-collapsed')")
            assert evaluate("document.querySelector('.sidebar-toggle').getAttribute('aria-pressed')==='true'")
            evaluate("document.querySelector('[data-action=sidebar-collapse]').click()")
            wait("!document.querySelector('.app-shell').classList.contains('sidebar-collapsed')")
            evaluate("document.querySelector('.guide-button').click()")
            wait("document.querySelector('dialog[open]')?.textContent.includes('Xác nhận báo cáo')")
            evaluate("SM.closeModal()")
        evaluate("document.querySelector('[data-action=case]').click()")
        wait("!!document.querySelector('#context')")
        if original_ui:
            wait("!!document.querySelector('.case-workflow-stepper')")
            assert evaluate("document.querySelector('#detail').getBoundingClientRect().width > document.querySelector('#main-content').getBoundingClientRect().width * 0.8"), 'Case detail must use the full content width'
            evaluate("document.querySelector('[data-action=workspace-tab][data-tab=context]').click()")
            assert evaluate("!document.querySelector('[data-case-panel=context]').hidden")
        documentation_screenshot('case-workspace.png')
        if original_ui:
            evaluate("document.querySelector('#context [name=symptom]').value='Draft retained between tabs';document.querySelector('[data-action=workspace-tab][data-tab=sources]').click();document.querySelector('[data-action=workspace-tab][data-tab=context]').click()")
            assert evaluate("document.querySelector('#context [name=symptom]').value==='Draft retained between tabs'")
        evaluate("const box=document.querySelector('[name=symptom]'); box.value='Rung demo từ trình duyệt'; box.dispatchEvent(new Event('input',{bubbles:true})); document.querySelector('#context').requestSubmit()")
        wait("document.querySelector('#save-state')?.dataset.contextRevision==='2'")
        with connect(db_path) as db:
            row = db.execute("SELECT context_json,context_revision FROM cases WHERE id='BM-26028'").fetchone()
            assert row["context_revision"] == 2 and "Rung demo từ trình duyệt" in json.loads(row["context_json"])["symptom"]
        # Actual DOM values must survive the auth recovery flow.
        evaluate("document.querySelector('[name=symptom]').value='Nội dung chưa lưu cần phục hồi'; document.querySelector('[name=symptom]').dispatchEvent(new Event('input',{bubbles:true}))")
        with connect(db_path) as db:
            db.execute("UPDATE sessions SET expires_at=0")
        evaluate("document.querySelector('#context').requestSubmit()")
        wait("!!document.querySelector('[data-action=reauth]')")
        evaluate("document.querySelector('[data-action=reauth]').click()")
        sign_in("minh")
        assert evaluate("document.querySelector('[name=symptom]').value") == "Nội dung chưa lưu cần phục hồi"
        evaluate("document.querySelector('#context').requestSubmit()")
        wait("document.querySelector('#save-state')?.dataset.contextRevision==='3'")
        # Search is read-only and renders exact source text, then opens the versioned source.
        evaluate("document.querySelector('#source-search [name=query]').value='rung sau thay do ga'; document.querySelector('#source-search').requestSubmit()")
        wait("!!document.querySelector('#search-results [data-action=open-source]')")
        assert evaluate("document.querySelector('#search-results [data-action=open-source]').dataset.id") == 'DEMO-CNC-003'
        evaluate("document.querySelector('#search-results [data-action=open-source]').click()")
        wait("!!document.querySelector('#search-results .source-full:not([hidden])')")
        assert evaluate("document.querySelector('#search-results .source-full').textContent.includes('DEMO-CNC-003@1.0#outcome')")
        evaluate("document.querySelector('#source-search').requestSubmit(document.querySelector('#source-search [value=answer]'))")
        wait("document.querySelector('#answer-results').textContent.includes('Trả lời theo mẫu')")
        assert evaluate("document.querySelector('#answer-results').textContent.includes('DEMO-CNC-003@1.0#applicability')")
        evaluate("document.querySelector('#answer-results [data-action=open-source]').click()")
        wait("!!document.querySelector('#answer-results .source-full:not([hidden])')")
        if original_ui:
            evaluate("document.querySelector('[data-action=workspace-tab][data-tab=sources]').click()")
        evaluate("document.querySelector('#answer-results').scrollIntoView({block:'start'})")
        documentation_screenshot('rag-answer.png')
        call("Emulation.setDeviceMetricsOverride", {"width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": True})
        assert evaluate("document.documentElement.scrollWidth <= 390"), "Search page overflows on mobile"
        if original_ui:
            for tab in ['context', 'work', 'report', 'sources']:
                evaluate("document.querySelector('[data-action=workspace-tab][data-tab=" + tab + "]').click()")
                assert evaluate("document.documentElement.scrollWidth <= 390"), 'Case stage overflows on mobile: ' + tab
        call("Emulation.setDeviceMetricsOverride", {"width": 1280, "height": 900, "deviceScaleFactor": 1, "mobile": False})
        evaluate("document.querySelector('#source-search [name=query]').value='Vision camera không nhận sản phẩm'; document.querySelector('#source-search').requestSubmit()")
        wait("document.querySelector('#search-results').textContent.includes('Chưa tìm thấy nguồn phù hợp')")
        assert evaluate("document.querySelector('#search-results [data-action=open-source]')===null")
        # Round/event writes use the normalized tables and preserve legacy rounds.
        evaluate("document.querySelector('#start-round').requestSubmit()")
        wait("!!document.querySelector('#add-event')")
        evaluate("document.querySelector('#add-event').closest('details').open=true; document.querySelector('#add-event [name=content]').value='Browser journal demo'; document.querySelector('#add-event [name=performedBy]').value='u-hai'; document.querySelector('#add-event').requestSubmit()")
        wait("document.querySelector('#detail').textContent.includes('Browser journal demo')")
        with connect(db_path) as db:
            journal_event = db.execute("SELECT event_id FROM case_event_versions WHERE content='Browser journal demo'").fetchone()[0]
            assert db.execute('SELECT count(*) FROM case_rounds').fetchone()[0] == 3
        event_selector = 'form[data-event="' + journal_event + '"]'
        evaluate("const edit=document.querySelector(" + json.dumps(event_selector) + "); edit.closest('details').open=true; edit.querySelector('[name=content]').value='Browser journal corrected'; edit.querySelector('[name=correctionReason]').value='Clarify demo record'; edit.requestSubmit()")
        wait("document.querySelector('#detail').textContent.includes('Browser journal corrected')")
        evaluate("document.querySelector('#end-round').closest('details').open=true; document.querySelector('#end-round [name=summary]').value='Demo round recorded'; document.querySelector('#end-round [name=remainingWork]').value='Pending verification'; document.querySelector('#end-round').requestSubmit()")
        wait("!!document.querySelector('#start-round')")
        # Create and verify a new BM case through the UI.
        evaluate("document.querySelector('[data-action=new-case]').click()")
        wait("!!document.querySelector('form#new-case')")
        evaluate("document.querySelector('[name=title]').value='Nhiệt độ demo'; document.querySelector('[name=symptom]').value='Chưa có số đo nhiệt độ'; document.querySelector('[name=existingCaseReason]').value='Sự cố độc lập demo'; document.querySelector('[name=confirmed]').checked=true; document.querySelector('form#new-case').requestSubmit()")
        wait("document.querySelectorAll('[data-action=case]').length===2")
        evaluate("document.querySelector('[data-action=asset]').click()")
        wait("document.querySelector('#detail').textContent.includes('Chưa đồng bộ')")
        # Browser screenshot of the actual mock source page, no passwords displayed.
        screenshot = call("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": False})
        (run_dir / "workspace.png").write_bytes(base64.b64decode(screenshot["data"]))
        call("Emulation.setDeviceMetricsOverride", {"width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": True})
        assert evaluate("document.documentElement.scrollWidth <= 390"), "Mobile page overflows horizontally"
        mobile = call("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": False})
        (run_dir / "workspace-mobile.png").write_bytes(base64.b64decode(mobile["data"]))
        call("Emulation.setDeviceMetricsOverride", {"width": 1280, "height": 900, "deviceScaleFactor": 1, "mobile": False})
        if not original_ui:
            evaluate("document.querySelector('[data-action=logout]').click()")
        sign_in("hai")
        evaluate("document.querySelector('[data-action=case]').click()")
        wait("!!document.querySelector('#context')")
        assert evaluate("document.querySelector('[name=symptom]').disabled") is True
        assert evaluate("document.querySelector('#context [type=submit]')===null") is True
        evaluate("document.querySelectorAll('#confirm-contributions input').forEach(box=>box.checked=true); document.querySelector('#confirm-contributions').requestSubmit()")
        wait("document.querySelector('#confirm-contributions')===null")
        with connect(db_path) as db:
            assert db.execute('SELECT count(*) FROM confirmation_items').fetchone()[0] == 3
            assert db.execute('SELECT max(revision) FROM case_event_versions WHERE event_id=?',(journal_event,)).fetchone()[0] == 2
        if not original_ui:
            evaluate("document.querySelector('[data-action=logout]').click()")
        sign_in("anh" if demo_roles else "lan")
        assert evaluate("document.querySelectorAll('[data-action=asset]').length") == (1 if demo_roles else 0)
        assert evaluate("document.querySelectorAll('[data-action=case]').length") == 0
        if original_ui:
            # The original case menu/form now persist through the API, not localStorage.
            sign_in('minh')
            navigate("SM.go('cases')")
            wait("document.querySelector('#database-cases')?.textContent.includes('máy chủ')")
            evaluate("document.querySelector('[data-action=case-new]').click()")
            wait("!!document.querySelector('[data-form=case-create]')")
            evaluate("const f=document.querySelector('[data-form=case-create]');f.querySelector('[name=title]').value='Original form database persistence';f.querySelector('[name=symptom]').value='Rung sau thay dao';f.querySelector('[name=newReason]').value='Independent browser test';f.querySelector('[name=machineConfirmed]').checked=true;f.requestSubmit()")
            wait("!!document.querySelector('#context')")
            with connect(db_path) as db:
                original_created = db.execute("SELECT id,context_json FROM cases WHERE title='Original form database persistence'").fetchone()
                assert original_created and json.loads(original_created['context_json'])['symptom'] == 'Rung sau thay dao'
                original_id = original_created['id']
            navigate("SM.go('cases')")
            wait("!!document.querySelector('[data-storage=database][data-case=" + original_id + "]')")
            call('Page.reload')
            wait("!!document.querySelector('[data-storage=database][data-case=" + original_id + "]')")
            assert evaluate("!!document.querySelector('.brand-copy')")
            # Import an old browser case using the actual modal, preserving its ID and events.
            old = {'id':'BM-MV2JH5XG-DP5K','assetId':'CNC-04','type':'BM','title':'DEMO-KT01 browser import',
                   'ownerId':'u-minh','workState':'active','machineState':'unverified','reportState':'draft',
                   'updatedAt':'2026-10-10T15:22:00Z','context':{'symptom':'Old browser vibration record'},
                   'rounds':[{'id':'RD-old-browser','number':1,'state':'active','events':[
                       {'id':'EV-old-browser-1','type':'observation','content':'Old browser observation',
                        'performedBy':'u-minh','enteredBy':'u-minh','measurement':'','unit':''},
                       {'id':'EV-old-browser-2','type':'check','content':'Old browser measurement',
                        'performedBy':'u-minh','enteredBy':'u-minh','measurement':'3.2','unit':'mm/s'}]}]}
            evaluate("SM.commit(()=>SM.db.cases.push("+json.dumps(old)+"));SM.go('cases')")
            wait("!!document.querySelector('[data-action=import-browser-case][data-case=BM-MV2JH5XG-DP5K]')")
            evaluate("document.querySelector('[data-action=import-browser-case][data-case=BM-MV2JH5XG-DP5K]').click();document.querySelector('[data-action=confirm-browser-import]').click()")
            wait("document.querySelector('#detail')?.textContent.includes('Old browser observation')")
            with connect(db_path) as db:
                assert db.execute("SELECT title FROM cases WHERE id='BM-MV2JH5XG-DP5K'").fetchone()[0] == old['title']
                assert db.execute("SELECT count(*) FROM case_events WHERE case_id='BM-MV2JH5XG-DP5K'").fetchone()[0] == 2
            assert evaluate("SM.db.cases.some(c=>c.id==='BM-MV2JH5XG-DP5K')"), 'Import must keep the browser original'
            # The detail renders before mount finishes; navigation stays guarded until then.
            wait("window.smartMaintWorkspaceCanLeave()")
            navigate("SM.go('cases')")
            wait("!!document.querySelector('[data-storage=database][data-case=BM-MV2JH5XG-DP5K]')")
            evaluate("document.querySelector('[data-storage=database][data-case=BM-MV2JH5XG-DP5K]').click()")
            wait("document.querySelector('#detail')?.textContent.includes('Old browser measurement')")
            # Dashboard counts and cards must come from SQLite, excluding browser-only seed cases.
            navigate("SM.go('dashboard')")
            wait("!!document.querySelector('[data-database-loaded= u-minh]')")
            with connect(db_path) as db:
                open_count = db.execute("SELECT count(*) FROM cases c JOIN case_participants p ON c.id=p.case_id WHERE p.user_id='u-minh' AND c.work_state!='ended'").fetchone()[0]
                note_count = db.execute("SELECT count(*) FROM case_events e JOIN case_participants p ON e.case_id=p.case_id WHERE p.user_id='u-minh'").fetchone()[0]
            assert evaluate("Number(document.querySelector('[data-metric=open]').dataset.value)") == open_count
            assert evaluate("Number(document.querySelector('[data-metric=events]').dataset.value)") == note_count
            assert not evaluate("document.querySelector('#database-view').textContent.includes('BM-26031')")
            assert evaluate("!!document.querySelector('.dashboard-grid .dashboard-card')"), 'Overview must use the reference two-column cards'
            documentation_screenshot('dashboard.png')
            assert evaluate("!!document.querySelector('[data-storage=database][data-case=" + original_id + "]')")
            evaluate("document.querySelector('[data-storage=database][data-case=" + original_id + "]').click()")
            wait("!!document.querySelector('#context')")
            evaluate("document.querySelector('#start-round').requestSubmit()")
            wait("!!document.querySelector('#add-event')")
            evaluate("const f=document.querySelector('#add-event');f.closest('details').open=true;f.querySelector('[name=content]').value='Overview synchronized journal';f.requestSubmit()")
            wait("document.querySelector('#detail')?.textContent.includes('Overview synchronized journal')")
            navigate("SM.go('dashboard')")
            wait("!!document.querySelector('[data-database-loaded=u-minh]')")
            assert evaluate("Number(document.querySelector('[data-metric=events]').dataset.value)") == note_count + 1
            call('Page.reload')
            wait("!!document.querySelector('[data-database-loaded=u-minh]')")
            assert evaluate("Number(document.querySelector('[data-metric=events]').dataset.value)") == note_count + 1
            # Same database links work from HozenDX and through original case deep links.
            navigate("SM.go('integration')")
            wait("!!document.querySelector('[data-database-loaded=u-minh]')")
            assert evaluate("document.querySelector('#database-view').textContent.includes('MC-400')")
            assert evaluate("!!document.querySelector('#database-view [data-id="+original_id+"]')")
            navigate("SM.go('case',"+json.dumps(original_id)+")")
            wait("document.querySelector('#detail')?.textContent.includes('Overview synchronized journal')")
            # Unavailable IDs must not silently display another case.
            navigate("SM.go('case','BM-not-in-database')")
            wait("document.querySelector('#detail')?.textContent.includes('Không thể mở hồ sơ')")
            sign_in('hai')
            navigate("SM.go('assignments')")
            wait("!!document.querySelector('[data-database-loaded=u-hai]')")
            assert evaluate("!!document.querySelector('[data-case=BM-26028]')")
            assert not evaluate("!!document.querySelector('[data-case="+original_id+"]')")
            assert not evaluate("document.querySelector('#database-view').textContent.includes('BM-26021')")
            # A late response for Minh must never repaint Anh's dashboard after switching roles.
            sign_in('minh')
            evaluate("window._savedFetch=window.fetch;window._holdOnce=true;window.fetch=(url,options)=>{const p=window._savedFetch(url,options);if(url==='/api/cases'&&window._holdOnce){window._holdOnce=false;return p.then(response=>new Promise(resolve=>window._releaseOld=()=>resolve(response)));}return p;};SM.go('dashboard')")
            wait("typeof window._releaseOld==='function'")
            evaluate("SM.login('u-anh')")
            wait("!!document.querySelector('[data-database-loaded=u-anh]')")
            evaluate("(async()=>{window._releaseOld();window.fetch=window._savedFetch;await new Promise(resolve=>setTimeout(resolve,250));})()")
            assert evaluate("Number(document.querySelector('[data-metric=open]').dataset.value)") == 0
            assert evaluate("document.querySelectorAll('#database-view [data-case]').length") == 0
            # Full BM workflow through the original shell, including a newly invited expert.
            sign_in('minh')
            wait("window.smartMaintWorkspaceCanLeave()")
            navigate("SM.go('db-case',"+json.dumps(original_id)+")")
            wait("!!document.querySelector('#invite-expert')&&window.smartMaintWorkspaceCanLeave()")
            evaluate("const f=document.querySelector('#invite-expert');f.closest('details').open=true;f.querySelector('[name=expertId]').value='u-hai';f.querySelector('[name=message]').value='Xác minh rung trục chính — test BM';f.requestSubmit()")
            wait("document.querySelector('#bm-workflow')?.textContent.includes('Chờ phản hồi')&&window.smartMaintWorkspaceCanLeave()")
            sign_in('hai')
            wait("window.smartMaintWorkspaceCanLeave()")
            navigate("SM.go('assignments')")
            wait("!!document.querySelector('[data-action=support-respond][data-decision=accepted]')")
            evaluate("document.querySelector('[data-action=support-respond][data-decision=accepted]').click()")
            wait("document.querySelector('#database-view')?.textContent.includes('Đã nhận hỗ trợ')&&!!document.querySelector('[data-case="+original_id+"]')")
            navigate("SM.go('db-case',"+json.dumps(original_id)+")")
            wait("!!document.querySelector('#add-event')&&window.smartMaintWorkspaceCanLeave()")
            evaluate("const f=document.querySelector('#add-event');f.closest('details').open=true;f.querySelector('[name=content]').value='Expert BM workflow confirmation';f.requestSubmit()")
            wait("document.querySelector('#detail')?.textContent.includes('Expert BM workflow confirmation')&&window.smartMaintWorkspaceCanLeave()")
            evaluate("document.querySelectorAll('#confirm-contributions input').forEach(box=>box.checked=true);document.querySelector('#confirm-contributions').requestSubmit()")
            wait("!document.querySelector('#confirm-contributions')&&window.smartMaintWorkspaceCanLeave()")
            sign_in('minh')
            wait("window.smartMaintWorkspaceCanLeave()")
            navigate("SM.go('db-case',"+json.dumps(original_id)+")")
            wait("!!document.querySelector('#end-round')&&window.smartMaintWorkspaceCanLeave()")
            evaluate("const f=document.querySelector('#end-round');f.closest('details').open=true;f.querySelector('[name=summary]').value='Đã kiểm tra cùng chuyên gia';f.querySelector('[name=remainingWork]').value='Theo dõi ở ca sau';f.requestSubmit()")
            wait("!document.querySelector('#end-round')&&window.smartMaintWorkspaceCanLeave()")
            evaluate("const f=document.querySelector('#finish-work');f.querySelector('[name=evidence]').value='Chạy thử ổn định — dữ liệu mô phỏng';f.requestSubmit()")
            wait("!!document.querySelector('#bm-report')&&window.smartMaintWorkspaceCanLeave()")
            evaluate("const f=document.querySelector('#bm-report');for(const [key,value] of Object.entries({summary:'Rung sau thay dao',cause:'Chưa đủ bằng chứng kết luận',actions:'Kiểm tra lắp dao và chạy thử',result:'Chạy thử demo ổn định',followUp:'Theo dõi ca sau'})) f.querySelector('[name='+key+']').value=value;f.requestSubmit(f.querySelector('[value=submit]'))")
            wait("!!document.querySelector('#confirm-report')&&window.smartMaintWorkspaceCanLeave()")
            evaluate("const f=document.querySelector('#confirm-report');f.querySelector('[type=checkbox]').checked=true;f.requestSubmit()")
            wait("document.querySelector('#detail')?.textContent.includes('Đã xác nhận')&&!document.querySelector('#confirm-report')&&window.smartMaintWorkspaceCanLeave()")
            call('Page.reload')
            wait("document.querySelector('#detail')?.textContent.includes('Đã xác nhận')")
            with connect(db_path) as db:
                finished=db.execute('SELECT work_state,machine_state,report_state FROM cases WHERE id=?',(original_id,)).fetchone()
                assert tuple(finished)==('ended','restored','confirmed')
                assert db.execute("SELECT status FROM support_requests WHERE case_id=?",(original_id,)).fetchone()[0]=='accepted'
                assert db.execute('SELECT count(*) FROM report_confirmations rc JOIN reports r ON r.id=rc.report_id WHERE r.case_id=?',(original_id,)).fetchone()[0]==1
            # Confirmed report -> proposal -> independent lead approval -> published RAG source.
            wait("!!document.querySelector('#create-knowledge-proposal')&&window.smartMaintWorkspaceCanLeave()")
            evaluate("const f=document.querySelector('#create-knowledge-proposal');f.querySelector('[name=title]').value='Zeta901 curated CNC knowledge';f.querySelector('[name=rationale]').value='Giữ kinh nghiệm đã xác nhận trong demo';f.requestSubmit()")
            wait("!!document.querySelector('[data-form=knowledge-edit]')")
            with connect(db_path) as db:
                proposal_id=db.execute('SELECT p.id FROM proposals p JOIN proposal_versions v ON v.proposal_id=p.id AND v.revision=p.current_revision JOIN reports r ON r.id=v.source_report_id WHERE r.case_id=?',(original_id,)).fetchone()[0]
            evaluate("const f=document.querySelector('[data-form=knowledge-edit]');f.querySelector('[name=keywords]').value='Zeta901';f.requestSubmit(f.querySelector('[value=submit]'))")
            wait("document.querySelector('#knowledge-api-view')?.textContent.includes('Chờ duyệt')&&!document.querySelector('[data-form=knowledge-edit]')")
            sign_in('anh')
            navigate("SM.go('review')")
            wait("!!document.querySelector('[data-page=review-detail][data-id="+proposal_id+"]')")
            navigate("SM.go('review-detail',"+json.dumps(proposal_id)+")")
            wait("!!document.querySelector('#review-knowledge')")
            evaluate("const f=document.querySelector('#review-knowledge');f.querySelector('[name=feedback]').value='Đã đối chiếu báo cáo và giới hạn demo';f.querySelector('[type=checkbox]').checked=true;f.requestSubmit(f.querySelector('[value=approved]'))")
            wait("document.querySelector('#knowledge-api-view')?.textContent.includes('Đã đưa vào RAG')")
            with connect(db_path) as db:
                knowledge_id=db.execute('SELECT k.id FROM knowledge k JOIN knowledge_versions v ON v.knowledge_id=k.id JOIN review_decisions d ON d.id=v.review_decision_id WHERE d.proposal_id=?',(proposal_id,)).fetchone()[0]
                assert db.execute('SELECT active_version FROM knowledge WHERE id=?',(knowledge_id,)).fetchone()[0]==1
            navigate("SM.go('library')")
            wait("document.querySelector('#knowledge-api-view')?.textContent.includes('Zeta901 curated CNC knowledge')")
            assert evaluate("!!document.querySelector('.library-card')"), 'Knowledge library must use the reference card layout'
            evaluate("const f=document.querySelector('[data-form=database-library-search]');f.querySelector('[name=query]').value='not-a-matching-knowledge-title';f.requestSubmit()")
            assert evaluate("document.querySelectorAll('.library-card').length===0")
            evaluate("const f=document.querySelector('[data-form=database-library-search]');f.querySelector('[name=query]').value='';f.requestSubmit()")
            assert evaluate("!!document.querySelector('.library-card')")
            documentation_screenshot('knowledge-library.png')
            sign_in('minh')
            navigate("SM.go('db-case',"+json.dumps(original_id)+")")
            wait("!!document.querySelector('#source-search')&&window.smartMaintWorkspaceCanLeave()")
            evaluate("const f=document.querySelector('#source-search');f.querySelector('[name=query]').value='Zeta901';f.requestSubmit()")
            wait("document.querySelector('#search-results')?.textContent.includes("+json.dumps(knowledge_id)+")")
            evaluate("document.querySelector('#search-results [data-action=open-source]').click()")
            wait("document.querySelector('#search-results .source-full')?.textContent.includes('Giới hạn áp dụng')")
            call('Page.reload')
            wait("!!document.querySelector('#create-knowledge-proposal')||!!document.querySelector('[data-action=open-knowledge-proposal]')")
            with connect(db_path) as db:
                assert db.execute('SELECT count(*) FROM knowledge_versions WHERE knowledge_id=?',(knowledge_id,)).fetchone()[0]==1
                assert db.execute('PRAGMA foreign_key_check').fetchall()==[]
        assert not errors, errors
        print("Browser smoke passed: login, persistence, recovery, search, source-based template answers, source reading, no-match, mobile, rounds, confirmation, scopes.")
        print("Screenshot: " + str(run_dir / "workspace.png"))
    finally:
        if ws:
            ws.close()
        for process in reversed(processes):
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
        # Keep this isolated run directory for evidence; no recursive deletion.


if __name__ == "__main__":
    main()

import json
import shutil
import time

import pytest
from fastapi.testclient import TestClient

from backend.hozendx import MockHozenDX
from backend.main import create_app
from backend.manage import reset_demo_password, seed_demo
from backend.security import COOKIE_NAME, token_hash, verify_password
from backend.store import connect

PASSWORDS = {name: "test-password-for-" + name for name in ["minh", "hai", "anh", "lan", "nam"]}


@pytest.fixture(scope="session")
def seed_path(tmp_path_factory):
    path = tmp_path_factory.mktemp("seed") / "seed.sqlite3"
    seed_demo(path, PASSWORDS)
    return path


@pytest.fixture
def app(tmp_path, seed_path):
    path = tmp_path / "test.sqlite3"
    shutil.copyfile(seed_path, path)
    return create_app(path)


@pytest.fixture
def client(app):
    with TestClient(app) as test_client:
        yield test_client


def login(client, name="minh"):
    response = client.post("/api/auth/login", json={"username": name, "password": PASSWORDS[name]})
    assert response.status_code == 200
    return {"X-CSRF-Token": response.json()["csrfToken"]}


def update_body(client):
    case = client.get("/api/cases/BM-26028").json()
    case["context"]["symptom"] = "Rung tăng khi gia công; chưa có số đo."
    return {"expectedContextRevision": case["contextRevision"],
            "expectedCaseDataRevision": case["caseDataRevision"], "context": case["context"]}


def create_body():
    return {"assetId": "CNC-04", "title": "Nhiệt độ bất thường — demo", "type": "BM",
            "demoIdentityConfirmed": True, "existingCaseReason": "Sự cố độc lập để kiểm tra luồng demo",
            "context": {"symptom": "Chưa xác minh số đo nhiệt độ."}}


@pytest.mark.parametrize("route", ["/api/auth/me", "/api/assets", "/api/cases", "/api/cases/BM-26028",
                                      "/api/integration/hozendx/assets/CNC-04"])
def test_anonymous_denied(client, route):
    assert client.get(route).status_code == 401


def test_login_session_hash_cookie_and_no_password_leak(client, app):
    response = client.post("/api/auth/login", json={"username": "minh", "password": PASSWORDS["minh"]})
    assert response.status_code == 200
    assert "HttpOnly" in response.headers["set-cookie"]
    assert "SameSite=strict" in response.headers["set-cookie"]
    assert "no-store" == response.headers["cache-control"]
    assert "password" not in response.json()["user"]
    token = client.cookies[COOKIE_NAME]
    with connect(app.state.db_path) as db:
        session = db.execute("SELECT * FROM sessions").fetchone()
        user = db.execute("SELECT * FROM users WHERE username='minh'").fetchone()
    assert session["token_hash"] == token_hash(token) and session["token_hash"] != token
    assert user["password_hash"] != PASSWORDS["minh"]
    assert verify_password(PASSWORDS["minh"], user["password_hash"])
    assert client.get("/api/auth/me").json()["user"]["role"] == "maintenance"


def test_bad_credentials_no_cookie_and_rate_limit(client):
    for _ in range(5):
        response = client.post("/api/auth/login", json={"username": "minh", "password": "wrong"})
        assert response.status_code == 401
        assert COOKIE_NAME not in client.cookies
    assert client.post("/api/auth/login", json={"username": "minh", "password": PASSWORDS["minh"]}).status_code == 429


def test_role_cannot_be_supplied_at_login(client):
    response = client.post("/api/auth/login", json={"username": "lan", "password": PASSWORDS["lan"], "role": "lead"})
    assert response.status_code == 422
    assert PASSWORDS["lan"] not in response.text


@pytest.mark.parametrize("name,has_asset,has_case", [
    ("minh", True, True), ("hai", True, True), ("anh", True, False),
    ("lan", False, False), ("nam", True, False),
])
def test_asset_scope_and_case_membership_are_separate(client, name, has_asset, has_case):
    login(client, name)
    assert bool(client.get("/api/assets").json()["items"]) == has_asset
    assert bool(client.get("/api/cases").json()["items"]) == has_case
    assert client.get("/api/integration/hozendx/assets/CNC-04").status_code == (200 if has_asset else 403)
    assert client.get("/api/cases/BM-26028").status_code == (200 if has_case else 404)


def test_mock_marks_and_data_limits(client):
    login(client)
    payload = client.get("/api/integration/hozendx/assets/CNC-04").json()
    assert payload["environment"] == "demo" and payload["isSimulated"] is True
    assert payload["connectionStatus"] == "not_connected" and payload["syncStatus"] == "not_synced"
    assert payload["capabilities"]["writeBackEnabled"] is False
    assert payload["data"]["documentReferences"][0]["fullTextAvailable"] is False
    assert all(item["result"] is None for item in payload["data"]["pmTemplate"]["items"])


def test_csrf_and_cross_origin_mutations_rejected(client):
    headers = login(client)
    body = update_body(client)
    assert client.put("/api/cases/BM-26028/context", json=body).status_code == 403
    assert client.put("/api/cases/BM-26028/context", json=body, headers={"X-CSRF-Token": "wrong"}).status_code == 403
    assert client.put("/api/cases/BM-26028/context", json=body,
                      headers={**headers, "Origin": "https://other.example"}).status_code == 403
    assert client.post("/api/auth/login", json={"username": "minh", "password": PASSWORDS["minh"]},
                       headers={"Origin": "https://other.example"}).status_code == 403


def test_context_update_revision_audit_and_replay(client, app):
    headers = {**login(client), "Idempotency-Key": "update-1"}
    body = update_body(client)
    first = client.put("/api/cases/BM-26028/context", json=body, headers=headers)
    assert first.status_code == 200
    assert first.json()["contextRevision"] == 2
    assert first.json()["caseDataRevision"] == 2
    assert first.json()["workState"] == "waiting"
    assert first.json()["machineState"] == "unrestored"
    assert first.json()["reportState"] == "draft"
    retry = client.put("/api/cases/BM-26028/context", json=body, headers=headers)
    assert retry.json() == first.json()
    changed = {**body, "context": {**body["context"], "symptom": "Khác"}}
    assert client.put("/api/cases/BM-26028/context", json=changed, headers=headers).status_code == 409
    assert client.put("/api/cases/BM-26028/context", json=body,
                      headers={**headers, "Idempotency-Key": "another"}).status_code == 409
    with connect(app.state.db_path) as db:
        audit = db.execute("SELECT * FROM audit WHERE action='case.context.update'").fetchall()
    assert len(audit) == 1
    details = json.loads(audit[0]["details_json"])
    assert details["before"]["symptom"] != details["after"]["symptom"]


def test_case_data_revision_alone_invalidates_context_update(client, app):
    headers = {**login(client), "Idempotency-Key": "change-data"}
    body = update_body(client)
    with connect(app.state.db_path) as db:
        db.execute("UPDATE cases SET data_revision=data_revision+1 WHERE id='BM-26028'")
    assert client.put("/api/cases/BM-26028/context", json=body, headers=headers).status_code == 409


def test_expert_can_read_but_cannot_edit_owners_context(client):
    headers = {**login(client, "hai"), "Idempotency-Key": "expert-edit"}
    assert client.get("/api/cases/BM-26028").json()["canEditContext"] is False
    assert client.put("/api/cases/BM-26028/context", json=update_body(client), headers=headers).status_code == 403


def test_finished_work_context_frozen(client, app):
    headers = {**login(client), "Idempotency-Key": "ended"}
    body = update_body(client)
    with connect(app.state.db_path) as db:
        db.execute("UPDATE cases SET work_state='ended' WHERE id='BM-26028'")
    assert client.put("/api/cases/BM-26028/context", json=body, headers=headers).status_code == 409


def test_create_persists_snapshot_and_retry_does_not_duplicate(client, app):
    headers = {**login(client), "Idempotency-Key": "create-1"}
    body = create_body()
    first = client.post("/api/cases", json=body, headers=headers)
    retry = client.post("/api/cases", json=body, headers=headers)
    assert first.status_code == retry.status_code == 201
    assert first.json() == retry.json()
    data = first.json()
    assert data["ownerId"] == "u-minh" and data["rounds"] == []
    assert data["sourceSnapshot"]["data"]["asset"]["identityVerification"] == "demo_user_confirmed"
    assert data["sourceSnapshot"]["provenance"]["acquiredAt"]
    with TestClient(create_app(app.state.db_path)) as restarted:
        login(restarted)
        assert restarted.get("/api/cases/" + data["id"]).status_code == 200
        assert len(restarted.get("/api/cases").json()["items"]) == 2


@pytest.mark.parametrize("modification", [
    {"demoIdentityConfirmed": False}, {"existingCaseReason": ""}, {"ownerId": "u-hai"}, {"type": "PM"},
])
def test_create_rejects_unconfirmed_or_spoofed_inputs(client, modification):
    headers = {**login(client), "Idempotency-Key": "create-rejected"}
    assert client.post("/api/cases", json={**create_body(), **modification}, headers=headers).status_code == 422
    assert len(client.get("/api/cases").json()["items"]) == 1


def test_missing_operation_key_and_asset_scope_denied(client):
    headers = login(client)
    assert client.post("/api/cases", json=create_body(), headers=headers).status_code == 422
    assert client.post("/api/cases", json={**create_body(), "assetId": "VIS-01"},
                       headers={**headers, "Idempotency-Key": "not-granted"}).status_code == 403


def test_grant_revocation_blocks_existing_session_and_operation_replay(client, app):
    headers = {**login(client), "Idempotency-Key": "revoke-test"}
    body = create_body()
    created = client.post("/api/cases", json=body, headers=headers).json()
    with connect(app.state.db_path) as db:
        db.execute("DELETE FROM asset_grants WHERE user_id='u-minh'")
    assert client.get("/api/assets").json()["items"] == []
    assert client.get("/api/cases/" + created["id"]).status_code == 404
    assert client.post("/api/cases", json=body, headers=headers).status_code == 403


def test_logout_revokes_session_even_if_cookie_copied(client):
    headers = login(client)
    token = client.cookies[COOKIE_NAME]
    assert client.post("/api/auth/logout", headers=headers).status_code == 204
    client.cookies.set(COOKIE_NAME, token)
    assert client.get("/api/auth/me").status_code == 401


@pytest.mark.parametrize("change", ["expire", "disable", "role"])
def test_sessions_use_current_identity_and_expiry(client, app, change):
    login(client)
    with connect(app.state.db_path) as db:
        if change == "expire":
            db.execute("UPDATE sessions SET expires_at=?", (int(time.time()) - 1,))
        elif change == "disable":
            db.execute("UPDATE users SET active=0 WHERE id='u-minh'")
        else:
            db.execute("UPDATE users SET role='lead' WHERE id='u-minh'")
    if change == "role":
        assert client.get("/api/auth/me").json()["user"]["role"] == "lead"
        assert client.get("/api/cases/BM-26028").status_code == 404
    else:
        assert client.get("/api/auth/me").status_code == 401


@pytest.mark.parametrize("route", ["/.runtime/smartmaint.sqlite3", "/fixtures/hozendx/cnc-04.mock.json",
                                      "/backend/main.py", "/prototype/../backend/main.py", "/docs/data/HOZENDX-VERIFICATION.csv"])
def test_private_project_files_not_exposed(client, route):
    assert client.get(route).status_code == 404


def test_original_shell_and_workspace_routes(client):
    page = client.get("/")
    assert page.status_code == 200 and "workspace/workspace.js" in page.text
    assert "prototype/backend.js" in page.text and 'id="app"' in page.text
    assert "/workspace.js" in client.get("/workspace").text
    assert client.get('/prototype/backend.js').status_code == 200
    assert client.get('/prototype/demo-guide.js').status_code == 200
    assert client.get('/prototype/visual-templates.js').status_code == 200
    assert client.get('/backend/web/workspace.js').status_code == 200
    assert client.get('/backend/web/workspace.css').status_code == 200
    assert "frame-ancestors 'none'" in page.headers["content-security-policy"]
    assert client.get("/prototype-demo").status_code == 200
    assert client.get("/api/health").json()["liveHozenDX"] is False


def test_secure_cookie_config(tmp_path):
    path = tmp_path / "secure.sqlite3"
    seed_demo(path, PASSWORDS)
    with TestClient(create_app(path, secure_cookie=True), base_url="https://testserver") as test_client:
        response = test_client.post("/api/auth/login", json={"username": "minh", "password": PASSWORDS["minh"]})
        assert "Secure" in response.headers["set-cookie"]


def test_invalid_mock_does_not_return_fallback_production_data(tmp_path, seed_path):
    path = tmp_path / "adapter.sqlite3"
    shutil.copyfile(seed_path, path)
    invalid = tmp_path / "invalid.json"
    invalid.write_text('{"environment":"production"}', encoding="utf-8")
    with TestClient(create_app(path, adapter=MockHozenDX(invalid))) as test_client:
        login(test_client)
        assert test_client.get("/api/integration/hozendx/assets/CNC-04").status_code == 503


def test_init_demo_does_not_reset_accounts_or_cases(app):
    assert seed_demo(app.state.db_path, PASSWORDS) == {}
    with connect(app.state.db_path) as db:
        assert db.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 5
        assert db.execute("SELECT COUNT(*) FROM cases").fetchone()[0] == 1


def test_password_recovery_revokes_sessions_and_preserves_scope_and_case(client, app):
    login(client)
    new_password = reset_demo_password(app.state.db_path, "minh")
    assert client.get("/api/auth/me").status_code == 401
    assert client.post("/api/auth/login", json={"username": "minh", "password": PASSWORDS["minh"]}).status_code == 401
    assert client.post("/api/auth/login", json={"username": "minh", "password": new_password}).status_code == 200
    assert client.get("/api/cases/BM-26028").status_code == 200
    assert len(client.get("/api/assets").json()["items"]) == 1

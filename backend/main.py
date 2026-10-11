"""Versioned maintenance API, curated RAG and same-origin workspace."""
import hashlib
import hmac
import json
import os
import re
import secrets
import time
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response
from fastapi.responses import FileResponse, JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, ConfigDict, Field
from starlette.middleware.trustedhost import TrustedHostMiddleware

from .hozendx import MockHozenDX
from .security import COOKIE_NAME, SESSION_SECONDS, password_hash, public_user, token_hash, verify_password
from .store import DEFAULT_DB, ROOT, case_payload, connect, initialize
from .domain import append_context, normalize_case, register_asset
from .config import load_config

load_config()


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Login(StrictModel):
    username: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=1, max_length=256)

    # Preserve passwords exactly, including deliberate leading/trailing whitespace.
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=False)


class DemoRole(StrictModel):
    role: str = Field(pattern="^(maintenance|expert|lead)$")


class Change(StrictModel):
    group: str = Field(max_length=80)
    status: str = Field(pattern="^(unchecked|none|changed)$")
    detail: str = Field(default="", max_length=2000)


class CaseContext(StrictModel):
    symptom: str = Field(min_length=1, max_length=4000)
    alarm: str = Field(default="", max_length=200)
    component: str = Field(default="", max_length=300)
    mode: str = Field(default="", max_length=300)
    productModel: str = Field(default="", max_length=300)
    speed: str = Field(default="", max_length=300)
    shift: str = Field(default="", max_length=200)
    onset: str = Field(default="", max_length=500)
    environment: str = Field(default="", max_length=1000)
    changes: list[Change] = Field(default_factory=list, max_length=6)


class ContextUpdate(StrictModel):
    expectedContextRevision: int = Field(ge=1)
    expectedCaseDataRevision: int = Field(ge=1)
    context: CaseContext


class CaseCreate(StrictModel):
    assetId: str = Field(pattern=r"^[A-Z0-9-]{1,50}$")
    title: str = Field(min_length=1, max_length=300)
    type: str = Field(pattern="^BM$")
    demoIdentityConfirmed: bool
    existingCaseReason: str = Field(default="", max_length=2000)
    context: CaseContext


def create_app(db_path=None, adapter=None, secure_cookie=None, demo_role_selection=None):
    path = Path(db_path or os.environ.get("SMARTMAINT_DB", DEFAULT_DB))
    initialize(path)
    mock = adapter or MockHozenDX()
    secure = secure_cookie if secure_cookie is not None else os.environ.get("SMARTMAINT_SECURE_COOKIE") == "1"
    role_selection = demo_role_selection if demo_role_selection is not None else os.environ.get("SMARTMAINT_DEMO_ROLE_SELECTION", "1") == "1"
    app = FastAPI(title="DENSO SmartMaint — backend demo", version="0.2.0",
                  description="Hồ sơ BM, nhật ký, báo cáo, duyệt tri thức và RAG; HozenDX mô phỏng.")
    app.state.db_path = path
    from .hosting import hosting_settings
    allowed_hosts, public_origin = hosting_settings()
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=allowed_hosts)
    dummy_password = password_hash(secrets.token_urlsafe(20))
    from .remote_store import RemoteDatabaseError

    @app.exception_handler(RemoteDatabaseError)
    async def remote_database_error(request: Request, error: RemoteDatabaseError):
        return JSONResponse({'detail': 'Không kết nối được database online. Hãy tải lại hồ sơ để kiểm tra kết quả trước khi gửi lại.'}, status_code=503)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, error: RequestValidationError):
        # Do not echo password values or entire submitted contexts in validation errors.
        return JSONResponse({"detail": "Dữ liệu không hợp lệ.", "fields": [
            {"location": list(item["loc"]), "message": item["msg"]} for item in error.errors()
        ]}, status_code=422)

    @app.middleware("http")
    async def browser_boundary(request: Request, call_next):
        # Mutations from browsers must be same-origin, including login (login-CSRF).
        origin = request.headers.get("origin")
        expected_origin = public_origin or f"{request.url.scheme}://{request.url.netloc}"
        if (request.url.path.startswith("/api/") and request.method not in {"GET", "HEAD", "OPTIONS"}
                and ((origin and origin != expected_origin)
                     or request.headers.get("sec-fetch-site") == "cross-site")):
            return JSONResponse({"detail": "Nguồn yêu cầu không được phép."}, status_code=403)
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "same-origin"
        response.headers["X-Frame-Options"] = "DENY"
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        if request.url.path in {"/", "/workspace", "/prototype-demo", "/workspace.js", "/workspace.css"}:
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; script-src 'self'; style-src 'self'; "
                "connect-src 'self'; img-src 'self' data:; object-src 'none'; "
                "frame-ancestors 'none'; base-uri 'self'; form-action 'self'")
        return response

    def current(request: Request):
        token = request.cookies.get(COOKIE_NAME, "")
        if not token or len(token) > 200:
            raise HTTPException(401, "Đăng nhập để tiếp tục.")
        with connect(path) as db:
            row = db.execute("""SELECT u.*, s.csrf_token, s.token_hash FROM sessions s
                JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1""",
                (token_hash(token), int(time.time()))).fetchone()
        if not row:
            raise HTTPException(401, "Phiên làm việc đã hết hạn hoặc không hợp lệ.")
        return dict(row)

    def mutation(request: Request, user=Depends(current)):
        csrf = request.headers.get("x-csrf-token", "")
        if not hmac.compare_digest(csrf.encode(), user["csrf_token"].encode()):
            raise HTTPException(403, "Yêu cầu thiếu hoặc sai mã bảo vệ phiên.")
        return user

    def grant(db, user, asset_id):
        if not db.execute("SELECT 1 FROM asset_grants WHERE user_id=? AND asset_id=?",
                          (user["id"], asset_id)).fetchone():
            raise HTTPException(403, "Bạn không có quyền truy cập máy này.")

    def accessible_case(db, user, case_id):
        row = db.execute("SELECT * FROM cases WHERE id=?", (case_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Không tìm thấy hồ sơ trong phạm vi truy cập.")
        allowed = db.execute("SELECT 1 FROM asset_grants WHERE user_id=? AND asset_id=?",
                             (user["id"], row["asset_id"])).fetchone()
        participant = db.execute("SELECT 1 FROM case_participants WHERE case_id=? AND user_id=?",
                                 (case_id, user["id"])).fetchone()
        if not allowed or not participant or user["role"] not in {"maintenance", "expert"}:
            # Do not reveal object contents or existence to non-participants.
            raise HTTPException(404, "Không tìm thấy hồ sơ trong phạm vi truy cập.")
        return row

    def load_asset(asset_id):
        try:
            payload = mock.get_asset(asset_id)
        except (ValueError, OSError):
            raise HTTPException(503, "Mock chưa khả dụng hoặc sai cấu trúc; chưa có dữ liệu nguồn hợp lệ.")
        if payload is None:
            raise HTTPException(404, "Không tìm thấy máy trong adapter mock.")
        return payload

    def audit(db, user, action, object_id, details=None):
        db.execute("INSERT INTO audit(actor_id,action,object_id,at,details_json) VALUES(?,?,?,?,?)",
                   (user["id"], action, object_id, datetime.now(timezone.utc).isoformat(),
                    json.dumps(details or {}, ensure_ascii=False)))

    def operation(db, user, key, operation_type, object_id, payload):
        if not key or not re.fullmatch(r"[A-Za-z0-9._:-]{1,128}", key):
            raise HTTPException(422, "Cần Idempotency-Key ASCII dài từ 1 đến 128 ký tự.")
        fingerprint = hashlib.sha256(json.dumps([operation_type, object_id, payload],
                                                sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        old = db.execute("SELECT * FROM operations WHERE user_id=? AND operation_key=?",
                         (user["id"], key)).fetchone()
        if old and old["payload_hash"] != fingerprint:
            raise HTTPException(409, "Mã thao tác đã được dùng cho nội dung khác.")
        return fingerprint, json.loads(old["result_json"]) if old else None

    def save_operation(db, user, key, fingerprint, result):
        db.execute("INSERT INTO operations VALUES(?,?,?,?)",
                   (user["id"], key, fingerprint, json.dumps(result, ensure_ascii=False)))

    @app.get("/api/health")
    def health():
        from .remote_store import settings
        if settings():
            with connect(path) as db:
                db.execute('SELECT 1').fetchone()
        return {"status": "ok", "environment": "demo", "adapter": "mock", "liveHozenDX": False}

    @app.post("/api/auth/login")
    def login(body: Login, request: Request, response: Response):
        username = body.username.strip().lower()
        attempt_key = token_hash(f"{request.client.host if request.client else 'unknown'}:{username}")
        now = int(time.time())
        failure = False
        with connect(path) as db:
            db.execute("BEGIN IMMEDIATE")
            attempt = db.execute("SELECT * FROM login_attempts WHERE attempt_key=?", (attempt_key,)).fetchone()
            recent = attempt and now - attempt["window_started"] < 600
            if recent and attempt["failures"] >= 5:
                raise HTTPException(429, "Quá nhiều lần đăng nhập sai. Thử lại sau 10 phút.", headers={"Retry-After": "600"})
            user = db.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()
            valid_password = verify_password(body.password, user["password_hash"] if user else dummy_password)
            if not user or not user["active"] or not valid_password:
                failures = attempt["failures"] + 1 if recent else 1
                started = attempt["window_started"] if recent else now
                db.execute("INSERT OR REPLACE INTO login_attempts VALUES(?,?,?)", (attempt_key, failures, started))
                failure = True
            else:
                db.execute("DELETE FROM login_attempts WHERE attempt_key=?", (attempt_key,))
                db.execute("DELETE FROM sessions WHERE expires_at<=?", (now,))
                previous = request.cookies.get(COOKIE_NAME)
                if previous:
                    db.execute("DELETE FROM sessions WHERE token_hash=?", (token_hash(previous),))
                token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
                db.execute("INSERT INTO sessions VALUES(?,?,?,?)", (token_hash(token), user["id"], csrf, now + SESSION_SECONDS))
                audit(db, user, "auth.login", user["id"])
        if failure:
            raise HTTPException(401, "Tài khoản hoặc mật khẩu không đúng.")
        response.set_cookie(COOKIE_NAME, token, max_age=SESSION_SECONDS, httponly=True,
                            secure=secure, samesite="strict", path="/")
        return {"user": public_user(user), "csrfToken": csrf, "environment": "demo"}

    @app.get("/api/auth/options")
    def auth_options():
        return {"demoRoleSelection": role_selection, "environment": "demo"}

    @app.post("/api/auth/demo-role")
    def select_demo_role(body: DemoRole, request: Request, response: Response):
        if not role_selection:
            raise HTTPException(404, "Chọn vai trò demo đã tắt.")
        # Fixed demo identities only; never accept arbitrary user IDs or grant permissions.
        identities = {"maintenance": ("u-minh", "minh"), "expert": ("u-hai", "hai"), "lead": ("u-anh", "anh")}
        user_id, username = identities[body.role]
        now = int(time.time())
        with connect(path) as db:
            db.execute("BEGIN IMMEDIATE")
            user = db.execute("SELECT * FROM users WHERE id=? AND username=? AND role=? AND active=1",
                              (user_id, username, body.role)).fetchone()
            if not user:
                raise HTTPException(503, "Chưa có tài khoản mẫu cho vai trò này. Chạy init-demo trước.")
            previous = request.cookies.get(COOKIE_NAME)
            if previous:
                db.execute("DELETE FROM sessions WHERE token_hash=?", (token_hash(previous),))
            db.execute("DELETE FROM sessions WHERE expires_at<=?", (now,))
            token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
            db.execute("INSERT INTO sessions VALUES(?,?,?,?)", (token_hash(token), user["id"], csrf, now + SESSION_SECONDS))
            audit(db, user, "auth.demo_role", user["id"], {"role": body.role})
        response.set_cookie(COOKIE_NAME, token, max_age=SESSION_SECONDS, httponly=True,
                            secure=secure, samesite="strict", path="/")
        return {"user": public_user(user), "csrfToken": csrf, "environment": "demo"}

    @app.get("/api/auth/me")
    def me(user=Depends(current)):
        return {"user": public_user(user), "csrfToken": user["csrf_token"], "environment": "demo"}

    @app.post("/api/auth/logout", status_code=204)
    def logout(response: Response, user=Depends(mutation)):
        with connect(path) as db:
            db.execute("DELETE FROM sessions WHERE token_hash=?", (user["token_hash"],))
            audit(db, user, "auth.logout", user["id"])
        response.delete_cookie(COOKIE_NAME, path="/", secure=secure, httponly=True, samesite="strict")

    @app.get("/api/assets")
    def assets(user=Depends(current)):
        with connect(path) as db:
            rows = db.execute("SELECT asset_id FROM asset_grants WHERE user_id=? ORDER BY asset_id", (user["id"],)).fetchall()
        result = []
        for row in rows:
            payload = load_asset(row["asset_id"])
            result.append(payload["data"]["asset"])
        return {"items": result, "environment": "demo"}

    @app.get("/api/integration/hozendx/assets/{asset_id}")
    def asset_details(asset_id: str, user=Depends(current)):
        with connect(path) as db:
            grant(db, user, asset_id)
        return load_asset(asset_id)

    @app.get("/api/cases")
    def cases(user=Depends(current)):
        with connect(path) as db:
            rows = db.execute("""SELECT c.* FROM cases c
                JOIN case_participants p ON p.case_id=c.id AND p.user_id=?
                JOIN asset_grants g ON g.asset_id=c.asset_id AND g.user_id=?
                ORDER BY c.updated_at DESC, c.id""", (user["id"], user["id"])).fetchall()
            return {"items": [case_payload(db, row) for row in rows] if user["role"] in {"maintenance", "expert"} else []}

    @app.get("/api/cases/{case_id}")
    def case_details(case_id: str, user=Depends(current)):
        with connect(path) as db:
            row = accessible_case(db, user, case_id)
            result = case_payload(db, row)
            result["participants"] = [dict(p) for p in db.execute("""SELECT u.id,u.name,u.role FROM users u
                JOIN case_participants p ON p.user_id=u.id WHERE p.case_id=? AND u.active=1""", (case_id,)).fetchall()]
        result["canEditContext"] = row["owner_id"] == user["id"] and row["work_state"] != "ended" and user["role"] == "maintenance"
        return result

    @app.post("/api/cases", status_code=201)
    def create_case(body: CaseCreate, user=Depends(mutation), idempotency_key: str | None = Header(default=None)):
        if user["role"] != "maintenance":
            raise HTTPException(403, "Chỉ người bảo trì có quyền tạo hồ sơ trong MVP.")
        if not body.demoIdentityConfirmed:
            raise HTTPException(422, "Cần xác nhận đúng máy demo trước khi mở hồ sơ.")
        with connect(path) as db:
            db.execute("BEGIN IMMEDIATE")
            grant(db, user, body.assetId)
            fingerprint, old = operation(db, user, idempotency_key, "case.create", body.assetId, body.model_dump())
            if old:
                # Revalidate object-level access even when replaying an operation.
                accessible_case(db, user, old["id"])
                return old
            if (db.execute("SELECT 1 FROM cases WHERE asset_id=? AND work_state!='ended'", (body.assetId,)).fetchone()
                    and not body.existingCaseReason):
                raise HTTPException(422, "Máy đã có hồ sơ mở; cần lý do tạo công việc độc lập.")
            source = load_asset(body.assetId)
            register_asset(db, source)
            # Confirmation is scoped to this new case, not an assertion about a real plant asset.
            source["data"]["asset"]["identityVerification"] = "demo_user_confirmed"
            source["provenance"]["acquiredAt"] = datetime.now(timezone.utc).isoformat()
            case_id = "BM-" + uuid4().hex[:12].upper()
            db.execute("""INSERT INTO cases(id,asset_id,owner_id,title,work_state,machine_state,
                report_state,context_json,source_snapshot_json,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)""",
                (case_id, body.assetId, user["id"], body.title, "active", "unverified", "draft",
                 body.context.model_dump_json(), json.dumps(source, ensure_ascii=False), datetime.now(timezone.utc).isoformat()))
            db.execute("INSERT INTO case_participants VALUES(?,?)", (case_id, user["id"]))
            normalize_case(db, db.execute("SELECT * FROM cases WHERE id=?", (case_id,)).fetchone(), origin="api", recorded_by=user["id"])
            result = case_payload(db, db.execute("SELECT * FROM cases WHERE id=?", (case_id,)).fetchone())
            audit(db, user, "case.create", case_id, {"existingCaseReason": body.existingCaseReason})
            save_operation(db, user, idempotency_key, fingerprint, result)
        return result

    @app.put("/api/cases/{case_id}/context")
    def update_context(case_id: str, body: ContextUpdate, user=Depends(mutation),
                       idempotency_key: str | None = Header(default=None)):
        with connect(path) as db:
            db.execute("BEGIN IMMEDIATE")
            row = accessible_case(db, user, case_id)
            if row["owner_id"] != user["id"] or user["role"] != "maintenance":
                raise HTTPException(403, "Chỉ người bảo trì phụ trách được sửa bối cảnh.")
            fingerprint, old = operation(db, user, idempotency_key, "context.update", case_id, body.model_dump())
            if old:
                return old
            if row["work_state"] == "ended":
                raise HTTPException(409, "Công việc đã kết thúc; bối cảnh nguồn được giữ nguyên.")
            if (row["context_revision"] != body.expectedContextRevision
                    or row["data_revision"] != body.expectedCaseDataRevision):
                raise HTTPException(409, "Dữ liệu đã thay đổi. Giữ phần đang nhập và đối chiếu bản mới.")
            before = json.loads(db.execute("SELECT content_json FROM case_context_versions WHERE case_id=? AND revision=?",
                                          (case_id, row["context_revision"])).fetchone()["content_json"])
            after = body.context.model_dump()
            if before != after:
                db.execute("""UPDATE cases SET context_json=?, context_revision=context_revision+1,
                    data_revision=data_revision+1, updated_at=? WHERE id=?""",
                    (body.context.model_dump_json(), datetime.now(timezone.utc).isoformat(), case_id))
                audit(db, user, "case.context.update", case_id,
                      {"before": before, "after": after, "baseRevision": row["context_revision"]})
                append_context(db, db.execute("SELECT * FROM cases WHERE id=?", (case_id,)).fetchone(), after, user["id"])
            result = case_payload(db, db.execute("SELECT * FROM cases WHERE id=?", (case_id,)).fetchone())
            save_operation(db, user, idempotency_key, fingerprint, result)
        return result

    from .browser_import import register_browser_import
    register_browser_import(app, path, mutation, grant, accessible_case, load_asset,
                            audit, operation, save_operation, CaseContext)
    from .journal import register_journal
    register_journal(app, path, current, mutation, accessible_case, audit, operation, save_operation)
    from .workflow import register_workflow
    register_workflow(app, path, current, mutation, accessible_case, audit, operation, save_operation)
    from .knowledge import register_knowledge
    register_knowledge(app, path, current, mutation, accessible_case, grant, audit, operation, save_operation)
    from .rag.search import register_search
    register_search(app, path, current, accessible_case)
    from .rag.answers import register_answers
    register_answers(app, path, current, mutation, accessible_case)

    # Explicit public file allowlist: never mount the project root, DB or fixtures.
    @app.get("/", include_in_schema=False)
    def workspace():
        return FileResponse(ROOT / "frontend/index.html")

    @app.get("/workspace", include_in_schema=False)
    def standalone_workspace():
        return FileResponse(ROOT / "frontend/workspace/workspace.html")

    @app.get("/workspace.js", include_in_schema=False)
    @app.get("/backend/web/workspace.js", include_in_schema=False)
    @app.get("/workspace/workspace.js", include_in_schema=False)
    def workspace_js():
        return FileResponse(ROOT / "frontend/workspace/workspace.js", media_type="text/javascript")

    @app.get("/workspace.css", include_in_schema=False)
    @app.get("/backend/web/workspace.css", include_in_schema=False)
    @app.get("/workspace/workspace.css", include_in_schema=False)
    def workspace_css():
        return FileResponse(ROOT / "frontend/workspace/workspace.css", media_type="text/css")

    @app.get("/styles.css", include_in_schema=False)
    @app.get("/assets/css/styles.css", include_in_schema=False)
    def shared_css():
        return FileResponse(ROOT / "frontend/assets/css/styles.css", media_type="text/css")

    @app.get("/assets/css/{filename}", include_in_schema=False)
    def theme_css(filename: str):
        if filename not in {"fonts.css", "theme-compat.css"}:
            raise HTTPException(404)
        return FileResponse(ROOT / "frontend/assets/css" / filename, media_type="text/css")

    @app.get("/assets/images/{filename}", include_in_schema=False)
    def theme_image(filename: str):
        if filename not in {"login-factory-cinematic.png", "logonho.png", "logotachnen.png"}:
            raise HTTPException(404)
        return FileResponse(ROOT / "frontend/assets/images" / filename, media_type="image/png")

    @app.get("/assets/fonts/{filename}", include_in_schema=False)
    def theme_font(filename: str):
        if filename not in {f"plus-jakarta-sans-{index}.ttf" for index in range(1, 7)}:
            raise HTTPException(404)
        return FileResponse(ROOT / "frontend/assets/fonts" / filename, media_type="font/ttf")

    @app.get("/prototype-demo", include_in_schema=False)
    def prototype_demo():
        return FileResponse(ROOT / "frontend/index.html")

    allowed_scripts = {"core.js", "data.js", "knowledge.js", "cases.js", "presentation.js", "presentation-engine.js", "backend.js", "database-views.js", "knowledge-api.js"}

    @app.get("/prototype/{filename}", include_in_schema=False)
    def prototype_script(filename: str):
        if filename not in allowed_scripts:
            raise HTTPException(404)
        return FileResponse(ROOT / "frontend/prototype" / filename, media_type="text/javascript")

    @app.get("/app.js", include_in_schema=False)
    @app.get("/assets/js/app.js", include_in_schema=False)
    def prototype_app():
        return FileResponse(ROOT / "frontend/assets/js/app.js", media_type="text/javascript")

    return app


app = create_app()

"""Explicit import of owned browser demo cases; never imports approval claims."""
import json
import sqlite3
from typing import Literal

from fastapi import Depends, Header, HTTPException
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, ValidationError, model_validator

from .domain import encoded, normalize_case, now, register_asset
from .store import case_payload, connect


class BrowserEvent(BaseModel):
    model_config = ConfigDict(extra="ignore", allow_inf_nan=False)
    id: str = Field(pattern=r"^[A-Za-z0-9-]{1,100}$")
    type: Literal["observation", "check", "hypothesis", "action", "result"]
    content: str = Field(min_length=1, max_length=8000)
    result: str = Field(default="", max_length=4000)
    rationale: str = Field(default="", max_length=4000)
    performedBy: str
    enteredBy: str | None = None
    recordedBy: str | None = None
    performedAt: AwareDatetime | None = None
    recordedAt: AwareDatetime | None = None
    measurement: float | None = None
    unit: str | None = Field(default=None, max_length=80)

    @model_validator(mode="after")
    def check_measurement(self):
        if not self.content.strip() or ((self.measurement is None) != (self.unit is None)) or (self.unit is not None and not self.unit.strip()):
            raise ValueError("Nội dung hoặc số đo / đơn vị không hợp lệ.")
        return self


class BrowserRound(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(pattern=r"^[A-Za-z0-9-]{1,100}$")
    state: Literal["active", "ended"]
    startedAt: AwareDatetime | None = None
    endedAt: AwareDatetime | None = None
    summary: str = Field(default="", max_length=4000)
    nextSteps: str = Field(default="", max_length=4000)
    events: list[BrowserEvent] = Field(default_factory=list, max_length=500)


class BrowserCase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(pattern=r"^BM-[A-Za-z0-9-]{1,90}$")
    assetId: Literal["CNC-04"]
    type: Literal["BM"]
    ownerId: str
    title: str = Field(min_length=1, max_length=300)
    workState: Literal["active", "waiting", "ended"]
    context: dict
    rounds: list[BrowserRound] = Field(default_factory=list, max_length=50)


class ImportRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    confirmed: bool
    case: dict


def register_browser_import(app, path, mutation, grant, accessible_case, load_asset,
                            audit, operation, save_operation, context_model):
    @app.post("/api/browser-cases/import", status_code=201)
    def import_case(body: ImportRequest, user=Depends(mutation), idempotency_key: str | None = Header(default=None)):
        if user["role"] != "maintenance":
            raise HTTPException(403, "Chỉ người phụ trách bảo trì được nhập hồ sơ cũ.")
        if not body.confirmed:
            raise HTTPException(422, "Cần xác nhận nhập bản sao dữ liệu trình duyệt.")
        if len(encoded(body.case).encode("utf-8")) > 1_000_000:
            raise HTTPException(422, "Hồ sơ vượt giới hạn 1 MB.")
        # Browser empty numeric fields must become SQL NULL; keep the raw archive intact.
        raw = json.loads(encoded(body.case))
        for rnd in raw.get("rounds", []) if isinstance(raw.get("rounds"), list) else []:
            if not isinstance(rnd, dict):
                raise HTTPException(422, "Đợt xử lý không hợp lệ.")
            for event in rnd.get("events", []) if isinstance(rnd.get("events"), list) else []:
                if not isinstance(event, dict):
                    raise HTTPException(422, "Ghi nhận không hợp lệ.")
                if event.get("measurement") == "":
                    event["measurement"] = None
                if event.get("unit") == "":
                    event["unit"] = None
        try:
            case = BrowserCase.model_validate(raw)
            context = context_model.model_validate(case.context)
        except ValidationError:
            raise HTTPException(422, "Hồ sơ CNC BM có trường không hợp lệ; bản gốc vẫn giữ trên trình duyệt.")
        if case.ownerId != user["id"]:
            raise HTTPException(403, "Chỉ được nhập hồ sơ do chính bạn phụ trách.")
        rounds = [r.model_dump(mode="json") for r in case.rounds]
        round_ids = [r["id"] for r in rounds]
        events = [e for r in rounds for e in r["events"]]
        event_ids = [e["id"] for e in events]
        active = sum(r["state"] == "active" for r in rounds)
        if (len(set(round_ids)) != len(round_ids) or len(set(event_ids)) != len(event_ids)
                or active > 1 or (case.workState != "active" and active)):
            raise HTTPException(422, "Mã hoặc trạng thái đợt / ghi nhận không hợp lệ.")
        with connect(path) as db:
            db.execute("BEGIN IMMEDIATE")
            grant(db, user, case.assetId)
            fingerprint, old = operation(db, user, idempotency_key, "case.browser_import", case.id, body.model_dump())
            if old:
                accessible_case(db, user, old["id"])
                return old
            if db.execute("SELECT 1 FROM cases WHERE id=?", (case.id,)).fetchone():
                raise HTTPException(409, "Mã hồ sơ đã tồn tại; chưa ghi đè dữ liệu database.")
            people = {user["id"]}
            for event in events:
                people.update(p for p in (event["performedBy"], event.get("recordedBy"), event.get("enteredBy")) if p)
            for person in people:
                if not db.execute("""SELECT 1 FROM users u JOIN asset_grants g ON u.id=g.user_id
                    WHERE u.id=? AND u.active=1 AND u.role IN ('maintenance','expert') AND g.asset_id=?""",
                    (person, case.assetId)).fetchone():
                    raise HTTPException(422, "Người trong nhật ký chưa thuộc phạm vi máy CNC này.")
            source = load_asset(case.assetId)
            register_asset(db, source)
            db.execute("""INSERT INTO cases(id,asset_id,owner_id,title,type,work_state,machine_state,
                report_state,context_json,rounds_json,source_snapshot_json,updated_at)
                VALUES(?,?,?,?,?,?,'unverified','draft',?,?,?,?)""",
                (case.id, case.assetId, user["id"], case.title, case.type, case.workState,
                 context.model_dump_json(), encoded(rounds), encoded(source), now()))
            for person in people:
                db.execute("INSERT INTO case_participants VALUES(?,?)", (case.id, person))
            db.execute("INSERT INTO legacy_case_snapshots VALUES(?,?,?)",
                       (case.id, encoded({"source": "browser_demo", "originalCase": body.case}), now()))
            try:
                normalize_case(db, db.execute("SELECT * FROM cases WHERE id=?", (case.id,)).fetchone(),
                               origin="browser_import", recorded_by=user["id"])
            except sqlite3.IntegrityError:
                raise HTTPException(409, "Mã đợt / ghi nhận đã tồn tại; toàn bộ lần nhập đã được hủy.")
            result = case_payload(db, db.execute("SELECT * FROM cases WHERE id=?", (case.id,)).fetchone())
            audit(db, user, "case.browser_import", case.id, {"source": "browser_demo", "approvalsImported": False})
            save_operation(db, user, idempotency_key, fingerprint, result)
            return result

"""Round/event APIs with optimistic concurrency and content-scoped confirmations."""
from datetime import timezone
from typing import Literal
from uuid import uuid4

from fastapi import Depends, Header, HTTPException
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator

from .domain import digest, now, rounds_payload, snapshot
from .store import connect


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, allow_inf_nan=False)


class Revision(Input):
    expectedCaseDataRevision: int = Field(ge=1)


class RoundEnd(Revision):
    expectedRoundRevision: int = Field(ge=1)
    summary: str = Field(min_length=1, max_length=4000)
    remainingWork: str = Field(min_length=1, max_length=4000)


class EventWrite(Revision):
    type: Literal["observation", "check", "hypothesis", "action", "result"]
    content: str = Field(min_length=1, max_length=8000)
    performedBy: str = Field(min_length=1, max_length=80)
    occurredAt: AwareDatetime | None = None
    result: str = Field(default="", max_length=4000)
    rationale: str = Field(default="", max_length=4000)
    measurement: float | None = None
    unit: str | None = Field(default=None, min_length=1, max_length=80)

    @model_validator(mode="after")
    def paired_measurement(self):
        if (self.measurement is None) != (self.unit is None):
            raise ValueError("Số đo và đơn vị phải có cùng nhau; chưa có số đo thì để trống cả hai.")
        return self


class EventEdit(EventWrite):
    expectedRevision: int = Field(ge=1)
    correctionReason: str = Field(min_length=1, max_length=2000)


class EventRef(Input):
    eventId: str = Field(min_length=1, max_length=80)
    revision: int = Field(ge=1)


class Confirm(Revision):
    items: list[EventRef] = Field(min_length=1, max_length=50)

    @model_validator(mode="after")
    def unique_events(self):
        if len({item.eventId for item in self.items}) != len(self.items):
            raise ValueError("Mỗi ghi nhận chỉ xuất hiện một lần trong nhóm.")
        return self


def register_journal(app, path, current, mutation, access, audit, operation, save_operation):
    def check_revision(case, expected):
        if case["data_revision"] != expected:
            raise HTTPException(409, "Dữ liệu ca đã thay đổi. Tải lại và đối chiếu trước khi ghi.")

    def owner(case, user):
        if case["owner_id"] != user["id"] or user["role"] != "maintenance":
            raise HTTPException(403, "Chỉ người bảo trì phụ trách được mở hoặc kết thúc đợt.")

    def writable(case):
        if case["work_state"] == "ended":
            raise HTTPException(409, "Công việc đã kết thúc; không sửa ngầm nhật ký nguồn.")

    def bump(db, case_id):
        db.execute("UPDATE cases SET data_revision=data_revision+1,updated_at=? WHERE id=?", (now(), case_id))

    def result(db, case_id):
        data = snapshot(db, case_id)
        return {"caseId": case_id, "caseDataRevision": data["data"]["caseDataRevision"],
                "sourceSnapshotHash": data["hash"], "rounds": rounds_payload(db, case_id)}

    def event(db, case_id, event_id):
        row = db.execute("""SELECT e.*,v.* FROM case_events e JOIN case_event_versions v
            ON v.event_id=e.id AND v.revision=e.current_revision WHERE e.id=? AND e.case_id=?""",
            (event_id, case_id)).fetchone()
        if not row:
            raise HTTPException(404, "Không tìm thấy ghi nhận trong ca.")
        return row

    def append_event(db, case_id, event_id, revision, body, user, reason=None):
        participant = db.execute("""SELECT 1 FROM case_participants p JOIN users u ON u.id=p.user_id
            JOIN asset_grants g ON g.user_id=u.id JOIN cases c ON c.asset_id=g.asset_id AND c.id=p.case_id
            WHERE p.case_id=? AND p.user_id=? AND u.active=1 AND u.role IN ('maintenance','expert')""",
            (case_id, body.performedBy)).fetchone()
        if not participant:
            raise HTTPException(422, "Người thực hiện phải là thành viên đang có quyền trên ca.")
        db.execute("""INSERT INTO case_event_versions(event_id,case_id,revision,kind,content,result,rationale,
            measurement,unit,performed_by,recorded_by,occurred_at,recorded_at,correction_reason,origin)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""", (event_id, case_id, revision, body.type, body.content,
            body.result, body.rationale, body.measurement, body.unit, body.performedBy, user["id"],
            body.occurredAt.astimezone(timezone.utc).isoformat() if body.occurredAt else None, now(), reason, "api"))

    @app.get("/api/cases/{case_id}/journal")
    def journal(case_id: str, user=Depends(current)):
        with connect(path) as db:
            access(db, user, case_id)
            return result(db, case_id)

    @app.post("/api/cases/{case_id}/rounds", status_code=201)
    def start_round(case_id: str, body: Revision, user=Depends(mutation),
                    idempotency_key: str | None = Header(default=None)):
        with connect(path) as db:
            db.execute("BEGIN IMMEDIATE")
            case = access(db, user, case_id)
            owner(case, user)
            fingerprint, old = operation(db, user, idempotency_key, "round.start", case_id, body.model_dump())
            if old:
                return old
            writable(case)
            check_revision(case, body.expectedCaseDataRevision)
            if db.execute("SELECT 1 FROM case_rounds WHERE case_id=? AND state='active'", (case_id,)).fetchone():
                raise HTTPException(409, "Ca đã có đợt đang làm; tiếp tục đợt đó.")
            sequence = db.execute("SELECT COALESCE(MAX(sequence),0)+1 FROM case_rounds WHERE case_id=?", (case_id,)).fetchone()[0]
            round_id = "RD-" + uuid4().hex[:16].upper()
            db.execute("INSERT INTO case_rounds(id,case_id,sequence,state,started_at,created_by) VALUES(?,?,?,'active',?,?)",
                       (round_id, case_id, sequence, now(), user["id"]))
            db.execute("UPDATE cases SET work_state='active' WHERE id=?", (case_id,))
            bump(db, case_id)
            audit(db, user, "round.start", round_id)
            data = {**result(db, case_id), "roundId": round_id}
            save_operation(db, user, idempotency_key, fingerprint, data)
            return data

    @app.post("/api/cases/{case_id}/rounds/{round_id}/end")
    def end_round(case_id: str, round_id: str, body: RoundEnd, user=Depends(mutation),
                  idempotency_key: str | None = Header(default=None)):
        with connect(path) as db:
            db.execute("BEGIN IMMEDIATE")
            case = access(db, user, case_id)
            owner(case, user)
            fingerprint, old = operation(db, user, idempotency_key, "round.end", f"{case_id}/{round_id}", body.model_dump())
            if old:
                return old
            writable(case)
            check_revision(case, body.expectedCaseDataRevision)
            rnd = db.execute("SELECT * FROM case_rounds WHERE id=? AND case_id=?", (round_id, case_id)).fetchone()
            if not rnd:
                raise HTTPException(404, "Không tìm thấy đợt trong ca.")
            if rnd["state"] != "active" or rnd["revision"] != body.expectedRoundRevision:
                raise HTTPException(409, "Đợt đã đổi hoặc không còn đang làm.")
            db.execute("""UPDATE case_rounds SET state='ended',ended_at=?,summary=?,remaining_work=?,revision=revision+1
                WHERE id=?""", (now(), body.summary, body.remainingWork, round_id))
            db.execute("UPDATE cases SET work_state='waiting' WHERE id=?", (case_id,))
            bump(db, case_id)
            audit(db, user, "round.end", round_id, body.model_dump())
            data = result(db, case_id)
            save_operation(db, user, idempotency_key, fingerprint, data)
            return data

    @app.post("/api/cases/{case_id}/rounds/{round_id}/events", status_code=201)
    def create_event(case_id: str, round_id: str, body: EventWrite, user=Depends(mutation),
                     idempotency_key: str | None = Header(default=None)):
        with connect(path) as db:
            db.execute("BEGIN IMMEDIATE")
            case = access(db, user, case_id)
            fingerprint, old = operation(db, user, idempotency_key, "event.create", f"{case_id}/{round_id}", body.model_dump(mode="json"))
            if old:
                return old
            writable(case)
            check_revision(case, body.expectedCaseDataRevision)
            rnd = db.execute("SELECT state FROM case_rounds WHERE id=? AND case_id=?", (round_id, case_id)).fetchone()
            if not rnd:
                raise HTTPException(404, "Không tìm thấy đợt trong ca.")
            if rnd["state"] != "active":
                raise HTTPException(409, "Chỉ thêm ghi nhận vào đợt đang làm; đợt cũ giữ lịch sử.")
            event_id = "EV-" + uuid4().hex[:16].upper()
            db.execute("INSERT INTO case_events VALUES(?,?,?,1)", (event_id, case_id, round_id))
            append_event(db, case_id, event_id, 1, body, user)
            bump(db, case_id)
            audit(db, user, "event.create", event_id)
            data = {**result(db, case_id), "eventId": event_id}
            save_operation(db, user, idempotency_key, fingerprint, data)
            return data

    @app.put("/api/cases/{case_id}/events/{event_id}")
    def edit_event(case_id: str, event_id: str, body: EventEdit, user=Depends(mutation),
                   idempotency_key: str | None = Header(default=None)):
        with connect(path) as db:
            db.execute("BEGIN IMMEDIATE")
            case = access(db, user, case_id)
            previous = event(db, case_id, event_id)
            if user["id"] not in {previous["recorded_by"], previous["performed_by"]}:
                raise HTTPException(403, "Chỉ người ghi hoặc người thực hiện được đính chính ghi nhận.")
            fingerprint, old = operation(db, user, idempotency_key, "event.edit", event_id, body.model_dump(mode="json"))
            if old:
                return old
            writable(case)
            check_revision(case, body.expectedCaseDataRevision)
            if previous["current_revision"] != body.expectedRevision:
                raise HTTPException(409, "Ghi nhận đã có revision mới.")
            revision = body.expectedRevision + 1
            append_event(db, case_id, event_id, revision, body, user, body.correctionReason)
            db.execute("UPDATE case_events SET current_revision=? WHERE id=?", (revision, event_id))
            bump(db, case_id)
            audit(db, user, "event.edit", event_id, {"baseRevision": body.expectedRevision, "reason": body.correctionReason})
            data = result(db, case_id)
            save_operation(db, user, idempotency_key, fingerprint, data)
            return data

    @app.get("/api/cases/{case_id}/events/{event_id}/versions")
    def event_versions(case_id: str, event_id: str, user=Depends(current)):
        with connect(path) as db:
            access(db, user, case_id)
            event(db, case_id, event_id)
            return {"items": [dict(row) for row in db.execute("SELECT * FROM case_event_versions WHERE event_id=? ORDER BY revision",
                                                             (event_id,)).fetchall()]}

    @app.post("/api/cases/{case_id}/contribution-confirmations", status_code=201)
    def confirm(case_id: str, body: Confirm, user=Depends(mutation),
                idempotency_key: str | None = Header(default=None)):
        with connect(path) as db:
            db.execute("BEGIN IMMEDIATE")
            case = access(db, user, case_id)
            if user["role"] != "expert":
                raise HTTPException(403, "Xác nhận này dành cho chuyên gia và phần mình thực hiện.")
            fingerprint, old = operation(db, user, idempotency_key, "contribution.confirm", case_id, body.model_dump())
            if old:
                return old
            check_revision(case, body.expectedCaseDataRevision)
            if case["report_state"] == "confirmed":
                raise HTTPException(409, "Báo cáo đã xác nhận; các đóng góp đã được chốt.")
            for item in body.items:
                row = event(db, case_id, item.eventId)
                if row["performed_by"] != user["id"]:
                    raise HTTPException(403, "Không được xác nhận thay phần người khác.")
                if row["current_revision"] != item.revision:
                    raise HTTPException(409, "Nội dung đóng góp đã đổi; đọc lại đúng revision.")
            confirmation_id = "CF-" + uuid4().hex[:16].upper()
            scope = sorted([item.model_dump() for item in body.items], key=lambda item: item["eventId"])
            db.execute("INSERT INTO contribution_confirmations VALUES(?,?,?,?,?)",
                       (confirmation_id, case_id, user["id"], digest(scope), now()))
            db.executemany("INSERT INTO confirmation_items VALUES(?,?,?,?)",
                           [(confirmation_id, case_id, item.eventId, item.revision) for item in body.items])
            bump(db, case_id)
            audit(db, user, "contribution.confirm", confirmation_id)
            data = {**result(db, case_id), "confirmationId": confirmation_id}
            save_operation(db, user, idempotency_key, fingerprint, data)
            return data

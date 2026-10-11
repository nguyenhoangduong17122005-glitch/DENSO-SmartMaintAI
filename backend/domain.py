"""Normalized domain reads, immutable snapshots and v1 JSON backfill."""
import hashlib
import json
from datetime import datetime, timezone


def now():
    return datetime.now(timezone.utc).isoformat()


def encoded(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def digest(value):
    return hashlib.sha256(encoded(value).encode()).hexdigest()


def register_asset(db, snapshot):
    asset = snapshot["data"]["asset"]
    db.execute("""INSERT OR IGNORE INTO assets(id,machine_family,machine_model,maker,plant_id,environment,metadata_json)
        VALUES(?,?,?,?,?,?,?)""", (asset["id"], asset["machineFamily"], asset.get("machineModel"),
        asset.get("maker"), asset.get("plantId"), snapshot["environment"], encoded(asset)))


def append_context(db, row, context, recorded_by=None, origin="api"):
    db.execute("""INSERT INTO case_context_versions(case_id,revision,data_revision,content_json,recorded_by,recorded_at,origin)
        VALUES(?,?,?,?,?,?,?)""", (row["id"], row["context_revision"], row["data_revision"], encoded(context),
                                  recorded_by, now() if origin == "api" else None, origin))


def normalize_case(db, row, origin="legacy_import", recorded_by=None):
    """Called exactly once for v1 cases or immediately after seeding a new demo case."""
    if db.execute("SELECT 1 FROM case_source_snapshots WHERE case_id=?", (row["id"],)).fetchone():
        return
    source = json.loads(row["source_snapshot_json"])
    register_asset(db, source)
    if source["data"]["asset"]["id"] != row["asset_id"]:
        raise ValueError("Legacy source asset does not match the case")
    if origin == "legacy_import":
        db.execute("INSERT INTO legacy_case_snapshots VALUES(?,?,?)", (row["id"], encoded(dict(row)), now()))
    db.execute("INSERT INTO case_source_snapshots VALUES(?,?,?,?,?,?)", (row["id"], row["asset_id"],
        row["source_snapshot_json"], digest(source), now() if origin == "api" else source.get("provenance", {}).get("acquiredAt"), origin))
    append_context(db, row, json.loads(row["context_json"]), recorded_by=recorded_by, origin=origin)
    for index, rnd in enumerate(json.loads(row["rounds_json"]), 1):
        db.execute("""INSERT INTO case_rounds(id,case_id,sequence,state,started_at,ended_at,summary,remaining_work)
            VALUES(?,?,?,?,?,?,?,?)""", (rnd["id"], row["id"], index, rnd.get("state", "legacy"),
            rnd.get("startedAt"), rnd.get("endedAt"), rnd.get("summary", ""), rnd.get("nextSteps", "")))
        for event in rnd.get("events", []):
            db.execute("INSERT INTO case_events VALUES(?,?,?,1)", (event["id"], row["id"], rnd["id"]))
            db.execute("""INSERT INTO case_event_versions(event_id,case_id,revision,kind,content,result,rationale,
                performed_by,recorded_by,occurred_at,recorded_at,origin,measurement,unit) VALUES(?,?,1,?,?,?,?,?,?,?,?,?,?,?)""",
                (event["id"], row["id"], event["type"], event["content"], event.get("result", ""),
                 event.get("rationale", ""), event.get("performedBy"), event.get("recordedBy") or event.get("enteredBy"),
                 event.get("performedAt"), event.get("recordedAt"), origin, event.get("measurement"), event.get("unit")))


def event_payload(db, row):
    confirmations = db.execute("""SELECT c.id,c.confirmed_at FROM confirmation_items i
        JOIN contribution_confirmations c ON c.id=i.confirmation_id
        WHERE i.event_id=? AND i.event_revision=? AND c.contributor_id=?""",
        (row["id"], row["current_revision"], row["performed_by"])).fetchall()
    return {"id": row["id"], "caseId": row["case_id"], "roundId": row["round_id"],
        "revision": row["current_revision"], "type": row["kind"], "content": row["content"],
        "result": row["result"], "rationale": row["rationale"], "measurement": row["measurement"], "unit": row["unit"],
        "performedBy": row["performed_by"], "recordedBy": row["recorded_by"],
        "performedAt": row["occurred_at"], "recordedAt": row["recorded_at"],
        "confirmationStatus": "confirmed" if confirmations else "unconfirmed",
        "confirmations": [{"id": c["id"], "confirmedAt": c["confirmed_at"]} for c in confirmations]}


def rounds_payload(db, case_id):
    result = []
    for rnd in db.execute("SELECT * FROM case_rounds WHERE case_id=? ORDER BY sequence", (case_id,)).fetchall():
        events = db.execute("""SELECT e.*,v.* FROM case_events e JOIN case_event_versions v
            ON v.event_id=e.id AND v.revision=e.current_revision WHERE e.round_id=? ORDER BY e.rowid""", (rnd["id"],)).fetchall()
        result.append({"id": rnd["id"], "number": rnd["sequence"], "state": rnd["state"], "revision": rnd["revision"],
            "startedAt": rnd["started_at"], "endedAt": rnd["ended_at"], "summary": rnd["summary"],
            "nextSteps": rnd["remaining_work"], "events": [event_payload(db, event) for event in events]})
    return result


def snapshot(db, case_id):
    row = db.execute("SELECT * FROM cases WHERE id=?", (case_id,)).fetchone()
    context = db.execute("SELECT content_json FROM case_context_versions WHERE case_id=? AND revision=?",
                         (case_id, row["context_revision"])).fetchone()
    source = db.execute("SELECT content_hash FROM case_source_snapshots WHERE case_id=?", (case_id,)).fetchone()
    events = db.execute("SELECT id,current_revision FROM case_events WHERE case_id=? ORDER BY id", (case_id,)).fetchall()
    rounds = db.execute("SELECT id,revision,state FROM case_rounds WHERE case_id=? ORDER BY sequence", (case_id,)).fetchall()
    data = {"caseId": case_id, "contextRevision": row["context_revision"], "caseDataRevision": row["data_revision"],
            "context": json.loads(context["content_json"]), "sourceHash": source["content_hash"],
            "events": [{"id": e["id"], "revision": e["current_revision"]} for e in events],
            "rounds": [{"id": r["id"], "revision": r["revision"], "state": r["state"]} for r in rounds]}
    return {"data": data, "hash": digest(data)}

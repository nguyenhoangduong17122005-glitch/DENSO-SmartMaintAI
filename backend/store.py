"""SQLite persistence and versioned domain migration."""
import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB = ROOT / ".runtime" / "smartmaint.sqlite3"


@contextmanager
def connect(path):
    db = sqlite3.connect(path, timeout=10)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def initialize(path):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with connect(path) as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('maintenance','expert','lead')),
            password_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS asset_grants (
            user_id TEXT NOT NULL REFERENCES users(id), asset_id TEXT NOT NULL,
            PRIMARY KEY(user_id, asset_id)
        );
        CREATE TABLE IF NOT EXISTS sessions (
            token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
            csrf_token TEXT NOT NULL, expires_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS cases (
            id TEXT PRIMARY KEY, asset_id TEXT NOT NULL,
            owner_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'BM',
            work_state TEXT NOT NULL, machine_state TEXT NOT NULL, report_state TEXT NOT NULL,
            context_json TEXT NOT NULL, rounds_json TEXT NOT NULL DEFAULT '[]',
            context_revision INTEGER NOT NULL DEFAULT 1, data_revision INTEGER NOT NULL DEFAULT 1,
            source_snapshot_json TEXT NOT NULL, updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS case_participants (
            case_id TEXT NOT NULL REFERENCES cases(id), user_id TEXT NOT NULL REFERENCES users(id),
            PRIMARY KEY(case_id, user_id)
        );
        CREATE TABLE IF NOT EXISTS audit (
            id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id TEXT NOT NULL,
            action TEXT NOT NULL, object_id TEXT NOT NULL, at TEXT NOT NULL,
            details_json TEXT NOT NULL DEFAULT '{}'
        );
        CREATE TABLE IF NOT EXISTS operations (
            user_id TEXT NOT NULL, operation_key TEXT NOT NULL, payload_hash TEXT NOT NULL,
            result_json TEXT NOT NULL, PRIMARY KEY(user_id, operation_key)
        );
        CREATE TABLE IF NOT EXISTS login_attempts (
            attempt_key TEXT PRIMARY KEY, failures INTEGER NOT NULL, window_started INTEGER NOT NULL
        );
        """)
        from .migrate import upgrade
        upgrade(db, path)


def case_payload(db, row):
    from .domain import rounds_payload, snapshot
    context = db.execute("SELECT content_json FROM case_context_versions WHERE case_id=? AND revision=?",
                         (row["id"], row["context_revision"])).fetchone()
    source = db.execute("SELECT content_json FROM case_source_snapshots WHERE case_id=?", (row["id"],)).fetchone()
    return {
        "id": row["id"], "assetId": row["asset_id"], "ownerId": row["owner_id"],
        "title": row["title"], "type": row["type"], "workState": row["work_state"],
        "machineState": row["machine_state"], "reportState": row["report_state"],
        "context": json.loads(context["content_json"]), "rounds": rounds_payload(db, row["id"]),
        "contextRevision": row["context_revision"], "caseDataRevision": row["data_revision"],
        "sourceSnapshot": json.loads(source["content_json"]), "updatedAt": row["updated_at"],
        "sourceSnapshotHash": snapshot(db, row["id"])["hash"],
        "environment": "demo",
    }

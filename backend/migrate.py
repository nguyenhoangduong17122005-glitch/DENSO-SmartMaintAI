"""Transactional, versioned migration with backup before upgrading populated v1 DBs."""
import sqlite3
from pathlib import Path
from uuid import uuid4

from .domain import normalize_case, now

IMMUTABLE = ["legacy_case_snapshots", "case_source_snapshots", "case_context_versions", "case_event_versions",
             "contribution_confirmations", "confirmation_items", "pm_result_versions", "report_versions",
             "report_source_events", "report_confirmations", "proposal_versions", "proposal_contributors",
             "review_decisions", "knowledge_versions", "knowledge_case_links"]


def execute_sql(db, sql):
    statement = ""
    for line in sql.splitlines(keepends=True):
        statement += line
        if sqlite3.complete_statement(statement):
            db.execute(statement)
            statement = ""
    if statement.strip():
        raise ValueError("Incomplete migration statement")


def upgrade(db, path):
    db.execute("BEGIN IMMEDIATE")
    try:
        db.execute("CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL,backup_path TEXT)")
        if db.execute("SELECT 1 FROM schema_migrations WHERE version=5").fetchone():
            db.commit()
            return
        populated = bool(db.execute("SELECT 1 FROM cases LIMIT 1").fetchone())
        backup_path = None
        if populated:
            # Separate read connection sees the pre-migration committed DB while the write lock prevents races.
            previous = 5 if db.execute("SELECT 1 FROM schema_migrations WHERE version=4").fetchone() else 4
            backup_path = Path(path).with_name(Path(path).stem + f".pre-v{previous}-" + uuid4().hex + ".sqlite3")
            with sqlite3.connect(path) as source, sqlite3.connect(backup_path) as target:
                source.backup(target)
        if not db.execute("SELECT 1 FROM schema_migrations WHERE version=2").fetchone():
            execute_sql(db, (Path(__file__).parent / "migrations/002_domain.sql").read_text(encoding="utf-8"))
            for row in db.execute("SELECT * FROM cases").fetchall():
                normalize_case(db, row)
            for table in IMMUTABLE:
                for action in ("UPDATE", "DELETE"):
                    db.execute(f"""CREATE TRIGGER immutable_{table}_{action.lower()} BEFORE {action} ON {table}
                        BEGIN SELECT RAISE(ABORT,'immutable history: append a new version'); END""")
            db.execute("INSERT INTO schema_migrations VALUES(2,?,?)", (now(), str(backup_path) if backup_path else None))
        if not db.execute("SELECT 1 FROM schema_migrations WHERE version=3").fetchone():
            execute_sql(db, (Path(__file__).parent / "migrations/003_domain_guards.sql").read_text(encoding="utf-8"))
            db.execute("INSERT INTO schema_migrations VALUES(3,?,?)", (now(), str(backup_path) if backup_path else None))
        if not db.execute("SELECT 1 FROM schema_migrations WHERE version=4").fetchone():
            execute_sql(db, (Path(__file__).parent / "migrations/004_provenance_guards.sql").read_text(encoding="utf-8"))
            db.execute("INSERT INTO schema_migrations VALUES(4,?,?)", (now(), str(backup_path) if backup_path else None))
        execute_sql(db, (Path(__file__).parent / "migrations/005_bm_workflow.sql").read_text(encoding="utf-8"))
        if db.execute("PRAGMA foreign_key_check").fetchall():
            raise ValueError("Migration created invalid foreign keys")
        db.execute("INSERT INTO schema_migrations VALUES(5,?,?)", (now(), str(backup_path) if backup_path else None))
        db.commit()
    except Exception:
        db.rollback()
        raise

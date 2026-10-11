"""Explicit demo initialization: py -m backend.manage init-demo."""
import argparse
import json
import secrets
import sys
from datetime import datetime, timezone

from .hozendx import MockHozenDX
from .security import password_hash
from .store import DEFAULT_DB, ROOT, connect, initialize
from .domain import normalize_case, register_asset

DEMO_USERS = [
    ("u-minh", "minh", "Nguyễn Minh", "maintenance", True),
    ("u-hai", "hai", "Trần Văn Hải", "expert", True),
    ("u-anh", "anh", "Lê Quốc Anh", "lead", True),
    ("u-lan", "lan", "Phạm Ngọc Lan", "maintenance", False),
    ("u-nam", "nam", "Lê Hoàng Nam", "expert", True),
]


def seed_demo(path, passwords=None):
    initialize(path)
    issued = {}
    with connect(path) as db:
        for uid, username, name, role, cnc_access in DEMO_USERS:
            if db.execute("SELECT 1 FROM users WHERE id=?", (uid,)).fetchone():
                continue
            password = passwords[username] if passwords else secrets.token_urlsafe(15)
            db.execute("INSERT INTO users(id,username,name,role,password_hash) VALUES(?,?,?,?,?)",
                       (uid, username, name, role, password_hash(password)))
            if cnc_access:
                db.execute("INSERT INTO asset_grants VALUES(?,?)", (uid, "CNC-04"))
            issued[username] = password
        if not db.execute("SELECT 1 FROM cases WHERE id='BM-26028'").fetchone():
            register_asset(db, MockHozenDX().get_asset("CNC-04"))
            context = {"symptom": "Rung bất thường tại cụm trục chính.", "alarm": "",
                       "component": "Trục chính", "mode": "Gia công", "productModel": "SP-C07",
                       "speed": "Chưa xác minh", "shift": "Ca sáng", "onset": "Trong ca ngày 08/10",
                       "environment": "Chưa kiểm tra", "changes": []}
            # Legacy demo sample: unknown timestamps/states must remain unknown on normalization.
            rounds = [
                {"id": "RD-26028-1", "summary": "Đã ghi nhận rung; kiểm tra ban đầu chưa khắc phục.",
                 "events": [
                     {"id": "EV-2801", "type": "observation", "content": "Ghi nhận rung tại vùng trục chính.",
                      "performedBy": "u-minh", "recordedBy": "u-minh", "result": "Chưa xác định nguyên nhân."},
                     {"id": "EV-2802", "type": "check", "content": "Đối chiếu điều kiện gá đặt theo tham chiếu demo.",
                      "performedBy": "u-hai", "recordedBy": "u-minh", "result": "Hiện tượng vẫn còn; chưa loại trừ nguyên nhân khác."}]},
                {"id": "RD-26028-2", "summary": "Chưa phục hồi; giữ hồ sơ chờ linh kiện.",
                 "events": [
                     {"id": "EV-2803", "type": "hypothesis", "content": "Nghi ngờ cụm truyền động; cần kiểm chứng.",
                      "performedBy": "u-hai", "recordedBy": "u-minh", "result": "Chưa kết luận nguyên nhân gốc."},
                     {"id": "EV-2804", "type": "result", "content": "Kết thúc đợt để chờ linh kiện.",
                      "performedBy": "u-minh", "recordedBy": "u-minh", "result": "Chưa phục hồi; hồ sơ còn mở."}]}]
            db.execute("""INSERT INTO cases(id,asset_id,owner_id,title,work_state,machine_state,
                       report_state,context_json,rounds_json,source_snapshot_json,updated_at)
                       VALUES(?,?,?,?,?,?,?,?,?,?,?)""",
                       ("BM-26028", "CNC-04", "u-minh", "Rung tăng tại cụm trục chính — chờ linh kiện",
                        "waiting", "unrestored", "draft", json.dumps(context, ensure_ascii=False),
                        json.dumps(rounds, ensure_ascii=False),
                        json.dumps(MockHozenDX().get_asset("CNC-04"), ensure_ascii=False),
                        datetime.now(timezone.utc).isoformat()))
            db.executemany("INSERT INTO case_participants VALUES(?,?)",
                           [("BM-26028", "u-minh"), ("BM-26028", "u-hai")])
            normalize_case(db, db.execute("SELECT * FROM cases WHERE id='BM-26028'").fetchone(), origin="demo_seed")
    return issued


def add_demo_samples(path):
    """Append synthetic cases once, preserving existing cases, credentials and grants."""
    fixture = json.loads((ROOT / "fixtures/cases/cnc-demo-cases.json").read_text(encoding="utf-8"))
    if fixture.get("environment") != "demo" or fixture.get("isSimulated") is not True:
        raise ValueError("Expected simulated cases")
    added = []
    with connect(path) as db:
        db.execute("BEGIN IMMEDIATE")
        for uid in ["u-minh", "u-hai"]:
            if not db.execute("SELECT 1 FROM users WHERE id=? AND active=1", (uid,)).fetchone():
                raise ValueError("Run init-demo first")
        for sample in fixture["cases"]:
            if db.execute("SELECT 1 FROM cases WHERE id=?", (sample["id"],)).fetchone():
                continue
            source = MockHozenDX().get_asset(sample["assetId"])
            db.execute("""INSERT INTO cases(id,asset_id,owner_id,title,work_state,machine_state,
                report_state,context_json,rounds_json,source_snapshot_json,updated_at)
                VALUES(?,?,?,?,?,?,?,?,?,?,?)""", (
                sample["id"], sample["assetId"], "u-minh", sample["title"], "waiting", "unverified", "draft",
                json.dumps(sample["context"], ensure_ascii=False), json.dumps(sample["rounds"], ensure_ascii=False),
                json.dumps(source, ensure_ascii=False), datetime.now(timezone.utc).isoformat()))
            db.executemany("INSERT INTO case_participants VALUES(?,?)",
                           [(sample["id"], "u-minh"), (sample["id"], "u-hai")])
            normalize_case(db, db.execute("SELECT * FROM cases WHERE id=?", (sample["id"],)).fetchone(), origin="demo_seed")
            added.append(sample["id"])
    return added


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="Quản lý backend demo SmartMaint")
    parser.add_argument("command", choices=["init-demo", "add-samples", "reset-demo-password", "migrate"])
    parser.add_argument("--db", default=str(DEFAULT_DB))
    parser.add_argument("--username", choices=[user[1] for user in DEMO_USERS])
    args = parser.parse_args()
    if args.command == "add-samples":
        print(json.dumps({"added": add_demo_samples(args.db)}, ensure_ascii=False))
        return
    if args.command == "migrate":
        initialize(args.db)
        with connect(args.db) as db:
            versions = [dict(row) for row in db.execute("SELECT * FROM schema_migrations ORDER BY version")]
        print(json.dumps({"migrations": versions}, ensure_ascii=False, indent=2))
        return
    if args.command == "reset-demo-password":
        if not args.username:
            parser.error("reset-demo-password requires --username")
        issued_password = reset_demo_password(args.db, args.username)
        print(f"Mật khẩu DEMO mới cho {args.username}: {issued_password}")
        print("Phiên cũ của tài khoản đã bị thu hồi. Hồ sơ và quyền được giữ nguyên.")
        return
    issued = seed_demo(args.db)
    if issued:
        print("Tài khoản DEMO mới — mật khẩu chỉ hiện lần này; không dùng dữ liệu nhà máy:")
        for username, password in issued.items():
            print(f"  {username}: {password}")
    else:
        print("Dữ liệu demo đã tồn tại. Không đổi mật khẩu hoặc ghi đè hồ sơ.")


def reset_demo_password(path, username):
    matching = next((user for user in DEMO_USERS if user[1] == username), None)
    if not matching:
        raise ValueError("Only known demo accounts can be reset")
    new_password = secrets.token_urlsafe(15)
    with connect(path) as db:
        row = db.execute("SELECT id FROM users WHERE username=?", (username,)).fetchone()
        if not row or row["id"] != matching[0]:
            raise ValueError("Demo account does not exist; run init-demo first")
        db.execute("UPDATE users SET password_hash=? WHERE id=?", (password_hash(new_password), row["id"]))
        db.execute("DELETE FROM sessions WHERE user_id=?", (row["id"],))
    return new_password


if __name__ == "__main__":
    main()

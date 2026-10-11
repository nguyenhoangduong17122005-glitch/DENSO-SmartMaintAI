"""Export a readable local HTML snapshot of cases; SQLite is opened read-only."""
import html
import sqlite3
from datetime import datetime
from zoneinfo import ZoneInfo

from .store import DEFAULT_DB, case_payload


def main():
    escape = lambda value: html.escape(str(value if value is not None else "Chưa rõ"))
    labels = {'active': 'Đang làm', 'waiting': 'Đang chờ', 'ended': 'Đã kết thúc',
              'legacy': 'Lịch sử mẫu', 'unverified': 'Chưa kiểm tra', 'unrestored': 'Chưa phục hồi',
              'restored': 'Đã phục hồi', 'draft': 'Nháp', 'pending': 'Chờ xác nhận',
              'confirmed': 'Đã xác nhận', 'observation': 'Hiện tượng', 'check': 'Kiểm tra',
              'hypothesis': 'Giả thuyết', 'action': 'Thao tác', 'result': 'Kết quả'}
    fields = [('symptom', 'Hiện tượng'), ('alarm', 'Alarm'), ('component', 'Bộ phận / vị trí'),
              ('mode', 'Chế độ'), ('productModel', 'Model sản phẩm'), ('speed', 'Tốc độ / điều kiện'),
              ('shift', 'Ca'), ('onset', 'Thời điểm / tần suất'), ('environment', 'Môi trường')]
    with sqlite3.connect(DEFAULT_DB.resolve().as_uri() + '?mode=ro', uri=True) as db:
        db.row_factory = sqlite3.Row
        db.execute('BEGIN')
        names = {r['id']: r['name'] for r in db.execute('SELECT id,name FROM users')}
        cases = [case_payload(db, r) for r in db.execute('SELECT * FROM cases ORDER BY updated_at DESC')]
    sections = []
    for case in cases:
        context = ''.join(f'<tr><th>{label}</th><td>{escape(case["context"].get(key) or "Chưa có")}</td></tr>' for key, label in fields)
        rounds = []
        for rnd in case['rounds']:
            events = []
            for event in rnd['events']:
                events.append(f'<article><h4>{escape(event["id"])} · v{event["revision"]} · {escape(labels.get(event["type"], event["type"]))}</h4>'
                              f'<p>{escape(event["content"])}</p><p><b>Kết quả:</b> {escape(event["result"] or "Chưa có")}</p>'
                              f'<p><b>Người thực hiện:</b> {escape(names.get(event["performedBy"], event["performedBy"]))} · '
                              f'<b>Người ghi:</b> {escape(names.get(event["recordedBy"], event["recordedBy"]))}</p>'
                              f'<p><b>Số đo:</b> {escape(event["measurement"])} {escape(event["unit"] or "")}</p></article>')
            rounds.append(f'<h3>Đợt {rnd["number"]} · {escape(labels.get(rnd["state"], rnd["state"]))}</h3>'
                          f'<p>{escape(rnd["summary"] or "Chưa có tóm tắt")}</p><p><b>Việc còn lại:</b> {escape(rnd["nextSteps"] or "Chưa có")}</p>' + ''.join(events))
        sections.append(f'<section id="{escape(case["id"])}"><h2>{escape(case["id"])} — {escape(case["title"])}</h2>'
                        f'<p>Máy: <b>{escape(case["assetId"])}</b> · Phụ trách: {escape(names.get(case["ownerId"], case["ownerId"]))}</p>'
                        f'<p>Công việc: {escape(labels.get(case["workState"],case["workState"]))} · '
                        f'Máy: {escape(labels.get(case["machineState"],case["machineState"]))} · '
                        f'Báo cáo: {escape(labels.get(case["reportState"],case["reportState"]))}</p>'
                        f'<p>Bối cảnh v{case["contextRevision"]} · Dữ liệu v{case["caseDataRevision"]} · Cập nhật: {escape(case["updatedAt"])}</p>'
                        f'<table>{context}</table>' + ''.join(rounds) + '</section>')
    generated = datetime.now(ZoneInfo('Asia/Bangkok')).strftime('%d/%m/%Y %H:%M:%S')
    links = ''.join(f'<li><a href="#{escape(c["id"])}">{escape(c["id"])} — {escape(c["title"])}</a></li>' for c in cases)
    output = DEFAULT_DB.parent / 'ho-so-cong-viec.html'
    output.write_text('<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
                      '<title>Hồ sơ công việc đã lưu</title><style>body{font:16px/1.6 system-ui;max-width:1100px;margin:32px auto;padding:0 20px;background:#f3f6f8;color:#173041}'
                      'section{background:white;border:1px solid #d6e0e6;border-radius:12px;padding:24px;margin:24px 0}table{width:100%;border-collapse:collapse}'
                      'th,td{border:1px solid #d6e0e6;text-align:left;padding:10px;vertical-align:top}th{width:180px}p,td{white-space:pre-wrap;overflow-wrap:anywhere}'
                      'article{border-left:3px solid #cd2030;padding:4px 16px;margin:16px 0}a{color:#005e9e}</style>'
                      f'<h1>Hồ sơ công việc trong database</h1><p>Nguồn: {escape(DEFAULT_DB)}<br>Xuất lúc: {generated} (UTC+7)<br>Tổng số: {len(cases)} hồ sơ.</p>'
                      '<p>Đây là bản xem tại thời điểm xuất. Sau khi thêm dữ liệu, chạy lại: <b>py -m backend.export_cases</b>, rồi tải lại trang này. '
                      'Chỉ gồm hồ sơ trong SQLite, chưa gồm dữ liệu prototype lưu trên trình duyệt.</p><ul>' + links + '</ul>' + ''.join(sections) + '</html>', encoding='utf-8')
    print(f'Exported {len(cases)} cases: {output}')
    for case in cases:
        print(case['id'])


if __name__ == '__main__':
    main()

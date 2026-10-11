"""BM demo: explicit invitations, closure evidence and versioned owner-confirmed reports."""
import json
from typing import Literal
from uuid import uuid4

from fastapi import Depends, Header, HTTPException
from pydantic import Field, model_validator

from .domain import now, snapshot, rounds_payload
from .journal import Revision
from .store import connect


class Invite(Revision):
    expertId: str = Field(min_length=1, max_length=80)
    message: str = Field(min_length=1, max_length=4000)


class Respond(Revision):
    decision: Literal['accepted', 'declined', 'cancelled']
    note: str = Field(default='', max_length=2000)


class Close(Revision):
    machineState: Literal['restored', 'unrestored']
    evidence: str = Field(min_length=1, max_length=4000)


class ReportWrite(Revision):
    summary: str = Field(min_length=1, max_length=4000)
    cause: str = Field(min_length=1, max_length=4000)
    causeStatus: Literal['unknown', 'hypothesis', 'confirmed']
    actions: str = Field(min_length=1, max_length=8000)
    result: str = Field(min_length=1, max_length=4000)
    evidence: str = Field(default='', max_length=4000)
    followUp: str = Field(default='', max_length=4000)
    submit: bool = False

    @model_validator(mode='after')
    def confirmed_evidence(self):
        if self.causeStatus == 'confirmed' and not self.evidence:
            raise ValueError('Nguyên nhân đã xác nhận phải có bằng chứng.')
        return self


class ReportConfirm(Revision):
    expectedReportRevision: int = Field(ge=1)


def report_payload(db, case_id):
    row = db.execute('''SELECT r.id,r.status,r.current_revision,v.* FROM reports r JOIN report_versions v
        ON v.report_id=r.id AND v.revision=r.current_revision WHERE r.case_id=?''', (case_id,)).fetchone()
    if not row:
        return None
    confirmation = db.execute('SELECT * FROM report_confirmations WHERE report_id=? AND report_revision=?',
                              (row['id'], row['current_revision'])).fetchone()
    return {'id': row['id'], 'revision': row['current_revision'], 'status': row['status'],
            'content': json.loads(row['content_json']), 'sourceDataRevision': row['source_data_revision'],
            'sourceSnapshotHash': row['source_snapshot_hash'], 'createdAt': row['created_at'],
            'confirmedBy': confirmation['confirmed_by'] if confirmation else None,
            'confirmedAt': confirmation['confirmed_at'] if confirmation else None}


def register_workflow(app, path, current, mutation, access, audit, operation, save_operation):
    def check(case, expected):
        if case['data_revision'] != expected:
            raise HTTPException(409, 'Hồ sơ đã thay đổi. Tải lại trước khi tiếp tục.')

    def owner(case, user):
        if case['owner_id'] != user['id'] or user['role'] != 'maintenance':
            raise HTTPException(403, 'Chỉ người bảo trì phụ trách được thực hiện thao tác này.')

    def writable(case):
        if case['work_state'] == 'ended':
            raise HTTPException(409, 'Công việc đã kết thúc.')
        if case['type'] != 'BM':
            raise HTTPException(409, 'Luồng này dành cho hồ sơ BM.')

    def bump(db, case_id):
        db.execute('UPDATE cases SET data_revision=data_revision+1,updated_at=? WHERE id=?', (now(), case_id))

    def done(db, user, key, fingerprint, case_id, action, extra=None):
        revision = db.execute('SELECT data_revision FROM cases WHERE id=?', (case_id,)).fetchone()[0]
        data = {'caseId': case_id, 'caseDataRevision': revision, **(extra or {})}
        audit(db, user, action, case_id, extra)
        save_operation(db, user, key, fingerprint, data)
        return data

    def eligible(db, asset_id):
        return [dict(r) for r in db.execute('''SELECT u.id,u.name FROM users u JOIN asset_grants g ON g.user_id=u.id
            WHERE u.active=1 AND u.role='expert' AND g.asset_id=? ORDER BY u.name''', (asset_id,))]

    @app.get('/api/support-requests')
    def support_requests(user=Depends(current)):
        with connect(path) as db:
            rows = db.execute('''SELECT s.*,c.title,c.asset_id,c.data_revision AS caseDataRevision,
                u.name AS requestedByName,x.name AS expertName FROM support_requests s
                JOIN cases c ON c.id=s.case_id JOIN users u ON u.id=s.requested_by JOIN users x ON x.id=s.expert_id
                JOIN asset_grants g ON g.asset_id=c.asset_id AND g.user_id=?
                WHERE s.requested_by=? OR s.expert_id=? ORDER BY s.created_at DESC''',
                (user['id'], user['id'], user['id'])).fetchall()
            return {'items': [dict(r) for r in rows]}

    @app.get('/api/cases/{case_id}/workflow')
    def workflow(case_id: str, user=Depends(current)):
        with connect(path) as db:
            case = access(db, user, case_id)
            requests = [dict(r) for r in db.execute('''SELECT s.*,u.name AS expertName FROM support_requests s
                JOIN users u ON u.id=s.expert_id WHERE s.case_id=? ORDER BY s.created_at''', (case_id,))]
            closure = db.execute('SELECT * FROM case_closures WHERE case_id=?', (case_id,)).fetchone()
            return {'requests': requests, 'experts': eligible(db, case['asset_id']),
                    'proposals':[dict(r) for r in db.execute('''SELECT p.id,p.status FROM proposals p JOIN proposal_versions v
                        ON v.proposal_id=p.id AND v.revision=p.current_revision JOIN reports r ON r.id=v.source_report_id
                        WHERE r.case_id=? AND p.author_id=? ORDER BY p.id''',(case_id,user['id']))],
                    'closure': dict(closure) if closure else None, 'report': report_payload(db, case_id)}

    @app.post('/api/cases/{case_id}/support-requests', status_code=201)
    def invite(case_id: str, body: Invite, user=Depends(mutation), idempotency_key: str | None = Header(default=None)):
        with connect(path) as db:
            db.execute('BEGIN IMMEDIATE')
            case = access(db, user, case_id); owner(case, user)
            fingerprint, old = operation(db, user, idempotency_key, 'support.invite', case_id, body.model_dump())
            if old: return old
            writable(case); check(case, body.expectedCaseDataRevision)
            if body.expertId not in {r['id'] for r in eligible(db, case['asset_id'])}:
                raise HTTPException(422, 'Chọn chuyên gia đang được cấp quyền máy.')
            if db.execute("SELECT 1 FROM support_requests WHERE case_id=? AND expert_id=? AND status IN ('pending','accepted')",
                          (case_id, body.expertId)).fetchone():
                raise HTTPException(409, 'Chuyên gia đã có lời mời chờ hoặc đã nhận hỗ trợ.')
            request_id = 'SP-' + uuid4().hex[:16].upper()
            db.execute("INSERT INTO support_requests(id,case_id,requested_by,expert_id,message,status,created_at) VALUES(?,?,?,?,?,'pending',?)",
                       (request_id, case_id, user['id'], body.expertId, body.message, now()))
            bump(db, case_id)
            return done(db,user,idempotency_key,fingerprint,case_id,'support.invite',{'requestId':request_id})

    @app.post('/api/support-requests/{request_id}/respond')
    def respond(request_id: str, body: Respond, user=Depends(mutation), idempotency_key: str | None = Header(default=None)):
        with connect(path) as db:
            db.execute('BEGIN IMMEDIATE')
            req = db.execute('''SELECT s.* FROM support_requests s JOIN cases c ON c.id=s.case_id
                JOIN asset_grants g ON g.asset_id=c.asset_id AND g.user_id=? WHERE s.id=?''', (user['id'],request_id)).fetchone()
            if not req or user['id'] not in {req['requested_by'],req['expert_id']}:
                raise HTTPException(404,'Không tìm thấy lời mời trong phạm vi truy cập.')
            if (body.decision == 'cancelled' and user['id'] != req['requested_by']) or (body.decision != 'cancelled' and (user['id'] != req['expert_id'] or user['role'] != 'expert')):
                raise HTTPException(403,'Bạn không được thực hiện phản hồi này.')
            fingerprint, old = operation(db,user,idempotency_key,'support.respond',request_id,body.model_dump())
            if old: return old
            case = db.execute('SELECT * FROM cases WHERE id=?',(req['case_id'],)).fetchone()
            writable(case); check(case,body.expectedCaseDataRevision)
            if req['status'] != 'pending': raise HTTPException(409,'Lời mời đã được xử lý.')
            db.execute('UPDATE support_requests SET status=?,responded_at=?,response_note=? WHERE id=?', (body.decision,now(),body.note,request_id))
            if body.decision == 'accepted':
                db.execute('INSERT OR IGNORE INTO case_participants VALUES(?,?)',(req['case_id'],user['id']))
            bump(db,req['case_id'])
            return done(db,user,idempotency_key,fingerprint,req['case_id'],'support.'+body.decision)

    @app.post('/api/cases/{case_id}/finish')
    def finish(case_id: str, body: Close, user=Depends(mutation), idempotency_key: str | None = Header(default=None)):
        with connect(path) as db:
            db.execute('BEGIN IMMEDIATE')
            case = access(db,user,case_id);owner(case,user)
            fingerprint,old=operation(db,user,idempotency_key,'case.finish',case_id,body.model_dump())
            if old: return old
            writable(case);check(case,body.expectedCaseDataRevision)
            if db.execute("SELECT 1 FROM case_rounds WHERE case_id=? AND state='active'",(case_id,)).fetchone():
                raise HTTPException(409,'Kết thúc đợt đang làm trước khi kết thúc công việc.')
            if not db.execute('SELECT 1 FROM case_events WHERE case_id=?',(case_id,)).fetchone():
                raise HTTPException(409,'Cần có nhật ký xử lý trước khi kết thúc công việc.')
            if db.execute("SELECT 1 FROM support_requests WHERE case_id=? AND status='pending'",(case_id,)).fetchone():
                raise HTTPException(409,'Xử lý hoặc hủy các lời mời đang chờ trước.')
            db.execute('INSERT INTO case_closures VALUES(?,?,?,?,?)',(case_id,user['id'],body.machineState,body.evidence,now()))
            db.execute("UPDATE cases SET work_state='ended',machine_state=?,report_state='draft' WHERE id=?",(body.machineState,case_id))
            bump(db,case_id)
            return done(db,user,idempotency_key,fingerprint,case_id,'case.finish')

    @app.post('/api/cases/{case_id}/report')
    def save_report(case_id: str, body: ReportWrite, user=Depends(mutation), idempotency_key: str | None = Header(default=None)):
        with connect(path) as db:
            db.execute('BEGIN IMMEDIATE')
            case=access(db,user,case_id);owner(case,user)
            fingerprint,old=operation(db,user,idempotency_key,'report.save',case_id,body.model_dump())
            if old: return old
            check(case,body.expectedCaseDataRevision)
            if case['work_state'] != 'ended' or case['type'] != 'BM': raise HTTPException(409,'Kết thúc công việc BM trước khi lập báo cáo.')
            previous=report_payload(db,case_id)
            if previous and previous['status']=='confirmed': raise HTTPException(409,'Báo cáo đã xác nhận, không sửa nội dung.')
            report_id=previous['id'] if previous else 'RP-'+uuid4().hex[:16].upper()
            revision=previous['revision']+1 if previous else 1
            status='pending' if body.submit else 'draft'
            if previous:
                db.execute('UPDATE reports SET current_revision=?,status=? WHERE id=?',(revision,status,report_id))
            else:
                db.execute('INSERT INTO reports VALUES(?,?,?,?)',(report_id,case_id,revision,status))
            db.execute('UPDATE cases SET report_state=? WHERE id=?',(status,case_id));bump(db,case_id)
            source=snapshot(db,case_id)
            content=body.model_dump(exclude={'expectedCaseDataRevision','submit'})
            db.execute('''INSERT INTO report_versions(report_id,revision,content_json,cause_status,evidence,
                source_data_revision,source_snapshot_json,source_snapshot_hash,author_id,created_at)
                VALUES(?,?,?,?,?,?,?,?,?,?)''',(report_id,revision,json.dumps(content,ensure_ascii=False),body.causeStatus,body.evidence,
                source['data']['caseDataRevision'],json.dumps(source['data'],ensure_ascii=False),source['hash'],user['id'],now()))
            db.executemany('INSERT INTO report_source_events VALUES(?,?,?,?)',
                [(report_id,revision,ev['id'],ev['revision']) for ev in source['data']['events']])
            return done(db,user,idempotency_key,fingerprint,case_id,'report.save',{'report':report_payload(db,case_id)})

    @app.get('/api/cases/{case_id}/report/versions')
    def report_versions(case_id: str,user=Depends(current)):
        with connect(path) as db:
            access(db,user,case_id)
            return {'items':[{'revision':r['revision'],'content':json.loads(r['content_json']),
                'sourceDataRevision':r['source_data_revision'],'createdAt':r['created_at']}
                for r in db.execute('SELECT v.* FROM report_versions v JOIN reports r ON r.id=v.report_id WHERE r.case_id=? ORDER BY v.revision',(case_id,))]}

    @app.post('/api/cases/{case_id}/report/confirm')
    def confirm_report(case_id: str,body: ReportConfirm,user=Depends(mutation),idempotency_key: str | None = Header(default=None)):
        with connect(path) as db:
            db.execute('BEGIN IMMEDIATE')
            case=access(db,user,case_id);owner(case,user)
            fingerprint,old=operation(db,user,idempotency_key,'report.confirm',case_id,body.model_dump())
            if old: return old
            check(case,body.expectedCaseDataRevision)
            report=report_payload(db,case_id)
            if not report or report['status']!='pending' or report['revision']!=body.expectedReportRevision or case['work_state']!='ended':
                raise HTTPException(409,'Cần báo cáo chờ xác nhận đúng phiên bản và công việc đã kết thúc.')
            if report['sourceDataRevision']!=case['data_revision']:
                raise HTTPException(409,'Nhật ký hoặc xác nhận đã thay đổi. Lưu và gửi lại báo cáo để lấy bản nguồn mới.')
            expert_ids={r['id'] for r in db.execute("SELECT id FROM users WHERE role='expert'")}
            if any(e['performedBy'] in expert_ids and e['confirmationStatus']!='confirmed' for r in rounds_payload(db,case_id) for e in r['events']):
                raise HTTPException(409,'Chuyên gia cần xác nhận toàn bộ phần mình thực hiện trước.')
            db.execute('INSERT INTO report_confirmations VALUES(?,?,?,?)',(report['id'],report['revision'],user['id'],now()))
            db.execute("UPDATE reports SET status='confirmed' WHERE id=?",(report['id'],))
            db.execute("UPDATE cases SET report_state='confirmed',updated_at=? WHERE id=?",(now(),case_id))
            return done(db,user,idempotency_key,fingerprint,case_id,'report.confirm',{'report':report_payload(db,case_id)})

"""Curated knowledge from confirmed BM reports, independent review and explicit publication."""
import json
import os
import sqlite3
import threading
from uuid import uuid4

from fastapi import Depends, Header, HTTPException, Request
from pydantic import Field, model_validator
from typing import Literal

from .domain import digest, now
from .journal import Input, Revision
from .store import DEFAULT_DB, connect

PUBLICATION_LOCK = threading.Lock()
CONTENT_LABELS = {'symptom':'Hiện tượng', 'context':'Điều kiện áp dụng', 'cause':'Nguyên nhân',
                  'solution':'Biện pháp đã thực hiện', 'result':'Kết quả', 'evidence':'Bằng chứng',
                  'followUp':'Theo dõi tiếp', 'limits':'Giới hạn áp dụng'}


class Content(Input):
    title: str = Field(min_length=3, max_length=300)
    keywords: list[str] = Field(min_length=1, max_length=12)
    symptom: str = Field(min_length=1, max_length=8000)
    context: str = Field(min_length=1, max_length=8000)
    cause: str = Field(min_length=1, max_length=8000)
    causeStatus: Literal['unknown','hypothesis','confirmed']
    solution: str = Field(min_length=1, max_length=8000)
    result: str = Field(min_length=1, max_length=8000)
    evidence: str = Field(default='', max_length=8000)
    followUp: str = Field(default='', max_length=8000)
    limits: str = Field(min_length=1, max_length=4000)

    @model_validator(mode='after')
    def validate_content(self):
        self.keywords=[word.strip() for word in self.keywords]
        if any(not word or len(word)>80 for word in self.keywords):
            raise ValueError('Từ khóa dài từ 1 đến 80 ký tự.')
        if self.causeStatus=='confirmed' and not self.evidence:
            raise ValueError('Nguyên nhân đã xác nhận cần bằng chứng.')
        return self


class CreateProposal(Revision):
    expectedReportRevision: int = Field(ge=1)
    title: str = Field(min_length=3,max_length=300)
    rationale: str = Field(min_length=1,max_length=4000)


class EditProposal(Input):
    expectedProposalRevision: int = Field(ge=1)
    content: Content
    rationale: str = Field(min_length=1,max_length=4000)
    submit: bool = False


class Review(Input):
    expectedProposalRevision: int = Field(ge=1)
    decision: Literal['approved','changes','rejected']
    feedback: str = Field(min_length=1,max_length=4000)


class Publish(Input):
    expectedVersion: int = Field(ge=1)


def knowledge_documents(db, extra_ids=()):
    """Return only active publications, plus explicitly requested approved candidates for indexing."""
    rows=db.execute('''SELECT k.id,k.asset_id,k.active_version,v.version,v.content_json,v.created_at,
        a.machine_model,p.index_status,p.validity_status,pv.source_report_id,pv.source_report_revision,r.case_id
        FROM knowledge k JOIN knowledge_versions v ON v.knowledge_id=k.id
        JOIN knowledge_publication p ON p.knowledge_id=k.id AND p.version=v.version
        JOIN assets a ON a.id=k.asset_id JOIN review_decisions d ON d.id=v.review_decision_id
        JOIN proposal_versions pv ON pv.proposal_id=d.proposal_id AND pv.revision=d.proposal_revision
        LEFT JOIN reports r ON r.id=pv.source_report_id
        WHERE k.environment='demo' AND p.validity_status='valid' AND d.decision='approved' ORDER BY k.id,v.version''').fetchall()
    documents=[]
    for row in rows:
        if not (row['active_version']==row['version'] and row['index_status']=='ready') and row['id'] not in extra_ids:
            continue
        content=json.loads(row['content_json'])
        sections=[]
        for key,label in CONTENT_LABELS.items():
            value=content.get(key,'')
            if key=='cause': value+='\nTrạng thái nguyên nhân: '+{'unknown':'Chưa rõ','hypothesis':'Giả thuyết','confirmed':'Đã xác nhận'}[content['causeStatus']]
            for offset in range(0,len(value),3000):
                sections.append({'id':f'{key}-{offset//3000+1}','heading':label,'text':value[offset:offset+3000]})
        documents.append({'id':row['id'],'version':str(row['version']),'title':content['title'],
            'keywords':content['keywords'],'sections':sections,'assetIds':[row['asset_id']],
            'machineModel':row['machine_model'],'environment':'demo','isSimulated':True,'status':'demo_ready',
            'sourceType':'approved_knowledge','sourceReportId':row['source_report_id'],
            'sourceReportRevision':row['source_report_revision'],'sourceCaseId':row['case_id']})
    return documents


def published_documents(path=None, extra_ids=()):
    from pathlib import Path
    path=Path(path or os.getenv('SMARTMAINT_DB',DEFAULT_DB))
    if not path.exists(): return []
    with connect(path) as db:
        if not db.execute("SELECT 1 FROM sqlite_master WHERE name='knowledge'").fetchone(): return []
        return knowledge_documents(db,extra_ids)


def register_knowledge(app,path,current,mutation,access,grant,audit,operation,save_operation):
    def get_proposal(db,user,proposal_id):
        row=db.execute('''SELECT p.*,v.content_json,v.rationale,v.source_report_id,v.source_report_revision,
            v.created_at,u.name AS author_name,r.case_id FROM proposals p
            JOIN proposal_versions v ON v.proposal_id=p.id AND v.revision=p.current_revision
            JOIN users u ON u.id=p.author_id LEFT JOIN reports r ON r.id=v.source_report_id WHERE p.id=?''',(proposal_id,)).fetchone()
        allowed=row and db.execute('SELECT 1 FROM asset_grants WHERE user_id=? AND asset_id=?',(user['id'],row['asset_id'])).fetchone()
        if not allowed or (user['role']!='lead' and row['author_id']!=user['id']):
            raise HTTPException(404,'Không tìm thấy đề xuất trong phạm vi truy cập.')
        return row

    def independent(db,user,row):
        return user['id']!=row['author_id'] and not db.execute('''SELECT 1 FROM proposal_contributors
            WHERE proposal_id=? AND proposal_revision=? AND user_id=?''',(row['id'],row['current_revision'],user['id'])).fetchone()

    def payload(db,user,row):
        version=row['current_revision']
        source=db.execute('SELECT content_json FROM report_versions WHERE report_id=? AND revision=?',
                          (row['source_report_id'],row['source_report_revision'])).fetchone()
        publication=db.execute('''SELECT k.id,k.active_version,p.index_status,p.validity_status FROM knowledge k
            JOIN knowledge_versions v ON v.knowledge_id=k.id JOIN review_decisions d ON d.id=v.review_decision_id
            JOIN knowledge_publication p ON p.knowledge_id=k.id AND p.version=v.version
            WHERE d.proposal_id=? AND d.proposal_revision=?''',(row['id'],version)).fetchone()
        return {'id':row['id'],'assetId':row['asset_id'],'authorId':row['author_id'],'authorName':row['author_name'],
                'revision':version,'status':row['status'],'content':json.loads(row['content_json']),'rationale':row['rationale'],
                'caseId':row['case_id'],'sourceReportId':row['source_report_id'],'sourceReportRevision':row['source_report_revision'],
                'sourceReport':json.loads(source['content_json']) if source else None,
                'canReview':user['role']=='lead' and independent(db,user,row),'createdAt':row['created_at'],
                'publication':dict(publication) if publication else None,
                'decisions':[dict(r) for r in db.execute('''SELECT proposal_revision,decision,feedback,reviewer_id,decided_at
                    FROM review_decisions WHERE proposal_id=? ORDER BY decided_at''',(row['id'],))]}

    def check_revision(row,expected):
        if row['current_revision']!=expected: raise HTTPException(409,'Đề xuất đã có phiên bản mới. Tải lại để đối chiếu.')

    def append_version(db,proposal_id,revision,content,rationale,report_id,report_revision,user_id,contributors):
        db.execute('''INSERT INTO proposal_versions(proposal_id,revision,mode,content_json,source_report_id,
            source_report_revision,rationale,created_by,created_at) VALUES(?,?,'new',?,?,?,?,?,?)''',
            (proposal_id,revision,json.dumps(content,ensure_ascii=False),report_id,report_revision,rationale,user_id,now()))
        db.executemany('INSERT INTO proposal_contributors VALUES(?,?,?)',[(proposal_id,revision,p) for p in sorted(contributors)])

    @app.post('/api/cases/{case_id}/knowledge-proposals',status_code=201)
    def create(case_id: str,body:CreateProposal,user=Depends(mutation),idempotency_key:str|None=Header(default=None)):
        with connect(path) as db:
            db.execute('BEGIN IMMEDIATE');case=access(db,user,case_id)
            if user['id']!=case['owner_id'] or user['role']!='maintenance': raise HTTPException(403,'Người phụ trách tạo đề xuất từ báo cáo.')
            fingerprint,old=operation(db,user,idempotency_key,'proposal.create',case_id,body.model_dump())
            if old: return old
            if case['data_revision']!=body.expectedCaseDataRevision: raise HTTPException(409,'Hồ sơ đã thay đổi.')
            report=db.execute('''SELECT r.id,r.current_revision,v.content_json,v.source_snapshot_json FROM reports r
                JOIN report_versions v ON v.report_id=r.id AND v.revision=r.current_revision
                JOIN report_confirmations c ON c.report_id=r.id AND c.report_revision=r.current_revision
                WHERE r.case_id=? AND r.status='confirmed' ''',(case_id,)).fetchone()
            if not report or case['work_state']!='ended' or report['current_revision']!=body.expectedReportRevision:
                raise HTTPException(409,'Chọn đúng phiên bản báo cáo đã xác nhận của công việc đã kết thúc.')
            if db.execute('''SELECT 1 FROM proposals p JOIN proposal_versions v ON v.proposal_id=p.id AND v.revision=p.current_revision
                WHERE v.source_report_id=? AND p.status NOT IN ('rejected','withdrawn')''',(report['id'],)).fetchone():
                raise HTTPException(409,'Báo cáo đã có đề xuất. Mở Đề xuất từ hồ sơ để tiếp tục.')
            source=json.loads(report['content_json']);context=json.loads(report['source_snapshot_json'])['context']
            content=Content(title=body.title,keywords=['CNC',source['summary'][:80]],symptom=source['summary'],
                context='\n'.join(f'{k}: {v}' for k,v in context.items() if isinstance(v,str) and v)[:8000] or 'Chưa rõ điều kiện ngoài tình huống demo.',
                cause=source['cause'],causeStatus=source['causeStatus'],solution=source['actions'],result=source['result'],
                evidence=source['evidence'],followUp=source['followUp'],limits='Chỉ áp dụng trong phạm vi dữ liệu demo CNC này; cần đối chiếu điều kiện và SOP đang có hiệu lực.').model_dump()
            contributors={user['id']}
            for r in db.execute('''SELECT v.performed_by,v.recorded_by FROM report_source_events s JOIN case_event_versions v
                ON v.event_id=s.event_id AND v.revision=s.event_revision WHERE s.report_id=? AND s.report_revision=?''',(report['id'],report['current_revision'])):
                contributors.update(x for x in r if x)
            proposal_id='DP-'+uuid4().hex[:16].upper()
            db.execute("INSERT INTO proposals VALUES(?,?,?,1,'draft')",(proposal_id,user['id'],case['asset_id']))
            append_version(db,proposal_id,1,content,body.rationale,report['id'],report['current_revision'],user['id'],contributors)
            result=payload(db,user,get_proposal(db,user,proposal_id));audit(db,user,'proposal.create',proposal_id)
            save_operation(db,user,idempotency_key,fingerprint,result);return result

    @app.get('/api/knowledge-proposals')
    def proposals(user=Depends(current)):
        with connect(path) as db:
            rows=db.execute('''SELECT p.id FROM proposals p JOIN asset_grants g ON g.asset_id=p.asset_id AND g.user_id=?
                WHERE p.author_id=? OR ?='lead' ORDER BY p.id''',(user['id'],user['id'],user['role'])).fetchall()
            return {'items':[payload(db,user,get_proposal(db,user,r['id'])) for r in rows]}

    @app.get('/api/knowledge-proposals/{proposal_id}')
    def proposal(proposal_id:str,user=Depends(current)):
        with connect(path) as db:
            row=get_proposal(db,user,proposal_id)
            result=payload(db,user,row)
            result['versions']=[{'revision':r['revision'],'content':json.loads(r['content_json']),'createdAt':r['created_at']}
                for r in db.execute('SELECT * FROM proposal_versions WHERE proposal_id=? ORDER BY revision',(proposal_id,))]
            return result

    @app.put('/api/knowledge-proposals/{proposal_id}')
    def edit(proposal_id:str,body:EditProposal,user=Depends(mutation),idempotency_key:str|None=Header(default=None)):
        with connect(path) as db:
            db.execute('BEGIN IMMEDIATE');row=get_proposal(db,user,proposal_id)
            if row['author_id']!=user['id']: raise HTTPException(403,'Chỉ tác giả sửa và gửi đề xuất.')
            fingerprint,old=operation(db,user,idempotency_key,'proposal.edit',proposal_id,body.model_dump())
            if old:return old
            check_revision(row,body.expectedProposalRevision)
            if row['status'] not in {'draft','changes'}:raise HTTPException(409,'Chỉ sửa bản nháp hoặc bản cần bổ sung.')
            revision=row['current_revision']+1
            contributors={r[0] for r in db.execute('SELECT user_id FROM proposal_contributors WHERE proposal_id=? AND proposal_revision=?',(proposal_id,row['current_revision']))}
            append_version(db,proposal_id,revision,body.content.model_dump(),body.rationale,row['source_report_id'],row['source_report_revision'],user['id'],contributors)
            db.execute('UPDATE proposals SET current_revision=?,status=? WHERE id=?',(revision,'pending' if body.submit else 'draft',proposal_id))
            result=payload(db,user,get_proposal(db,user,proposal_id));audit(db,user,'proposal.submit' if body.submit else 'proposal.edit',proposal_id)
            save_operation(db,user,idempotency_key,fingerprint,result);return result

    @app.post('/api/knowledge-proposals/{proposal_id}/review')
    def review(proposal_id:str,body:Review,user=Depends(mutation),idempotency_key:str|None=Header(default=None)):
        with connect(path) as db:
            db.execute('BEGIN IMMEDIATE');row=get_proposal(db,user,proposal_id)
            if user['role']!='lead' or not independent(db,user,row):raise HTTPException(403,'Cần chuyên gia trưởng độc lập, không tham gia nội dung nguồn.')
            fingerprint,old=operation(db,user,idempotency_key,'proposal.review',proposal_id,body.model_dump())
            if old:return old
            check_revision(row,body.expectedProposalRevision)
            if row['status']!='pending':raise HTTPException(409,'Đề xuất không còn ở trạng thái chờ duyệt.')
            decision_id='RV-'+uuid4().hex[:16].upper()
            db.execute('INSERT INTO review_decisions VALUES(?,?,?,?,?,?,?)',(decision_id,proposal_id,row['current_revision'],user['id'],body.decision,body.feedback,now()))
            db.execute('UPDATE proposals SET status=? WHERE id=?',(body.decision,proposal_id))
            if body.decision=='approved':
                knowledge_id='KN-'+uuid4().hex[:16].upper()
                db.execute("INSERT INTO knowledge VALUES(?,?,NULL,'demo')",(knowledge_id,row['asset_id']))
                db.execute('INSERT INTO knowledge_versions VALUES(?,1,?,?,?,?)',(knowledge_id,row['content_json'],digest(json.loads(row['content_json'])),decision_id,now()))
                db.execute("INSERT INTO knowledge_publication VALUES(?,1,'queued','valid',NULL,NULL)",(knowledge_id,))
            result=payload(db,user,get_proposal(db,user,proposal_id));audit(db,user,'proposal.'+body.decision,proposal_id,{'revision':row['current_revision']})
            save_operation(db,user,idempotency_key,fingerprint,result);return result

    @app.get('/api/knowledge')
    def library(user=Depends(current)):
        with connect(path) as db:
            allowed={r[0] for r in db.execute('SELECT asset_id FROM asset_grants WHERE user_id=?',(user['id'],))}
            return {'items':[d for d in knowledge_documents(db) if allowed.intersection(d['assetIds'])]}

    @app.get('/api/knowledge/{knowledge_id}')
    def knowledge(knowledge_id:str,user=Depends(current)):
        result=library(user)
        doc=next((d for d in result['items'] if d['id']==knowledge_id),None)
        if not doc:raise HTTPException(404,'Tri thức chưa xuất bản hoặc nằm ngoài phạm vi máy.')
        return doc

    @app.post('/api/knowledge/{knowledge_id}/publish')
    def publish(knowledge_id:str,body:Publish,request:Request,user=Depends(mutation),idempotency_key:str|None=Header(default=None)):
        if user['role']!='lead':raise HTTPException(403,'Chuyên gia trưởng đưa tri thức đã duyệt vào RAG.')
        if not PUBLICATION_LOCK.acquire(blocking=False):raise HTTPException(409,'Đang cập nhật chỉ mục. Thử lại sau.')
        try:
            with connect(path) as db:
                row=db.execute('SELECT * FROM knowledge WHERE id=?',(knowledge_id,)).fetchone()
                if not row:raise HTTPException(404,'Không tìm thấy tri thức.')
                grant(db,user,row['asset_id'])
                fingerprint,old=operation(db,user,idempotency_key,'knowledge.publish',knowledge_id,body.model_dump())
                if old:return old
                publication=db.execute('SELECT * FROM knowledge_publication WHERE knowledge_id=? AND version=?',(knowledge_id,body.expectedVersion)).fetchone()
                if not publication or publication['validity_status']!='valid':raise HTTPException(409,'Phiên bản không hợp lệ để xuất bản.')
                if row['active_version']==body.expectedVersion and publication['index_status']=='ready':
                    result={'id':knowledge_id,'version':body.expectedVersion,'published':True,'retrievalMode':os.getenv('SMARTMAINT_RETRIEVAL_MODE','keyword')}
                    save_operation(db,user,idempotency_key,fingerprint,result);return result
            from .rag.search import load_runtime_documents
            from .rag.vectors import build_index,VectorError
            docs=load_runtime_documents(path,extra_ids=(knowledge_id,))
            signature=digest(docs)
            if not any(d['id']==knowledge_id and d['version']==str(body.expectedVersion) for d in docs):raise HTTPException(409,'Chưa có nội dung đã duyệt đúng phiên bản.')
            with connect(path) as db:
                db.execute("UPDATE knowledge_publication SET index_status='building' WHERE knowledge_id=? AND version=?",(knowledge_id,body.expectedVersion))
            try:
                mode=os.getenv('SMARTMAINT_RETRIEVAL_MODE','keyword')
                if mode=='vector':build_index(docs)
            except (VectorError,OSError,sqlite3.Error) as error:
                with connect(path) as db:
                    db.execute("UPDATE knowledge_publication SET index_status='failed' WHERE knowledge_id=? AND version=?",(knowledge_id,body.expectedVersion))
                detail=str(error) if isinstance(error,VectorError) else 'Chưa cập nhật được chỉ mục cục bộ.'
                raise HTTPException(503,'Đã duyệt nhưng chưa xuất bản. '+detail+' Bấm Đưa vào RAG để thử lại sau khi khắc phục.') from None
            latest_user=current(request)
            with connect(path) as db:
                db.execute('BEGIN IMMEDIATE');grant(db,latest_user,row['asset_id'])
                if latest_user['role']!='lead' or digest(load_runtime_documents(path,extra_ids=(knowledge_id,)))!=signature:
                    raise HTTPException(409,'Quyền hoặc nguồn đã đổi trong lúc lập chỉ mục. Thử xuất bản lại.')
                db.execute("UPDATE knowledge_publication SET index_status='ready',effective_from=? WHERE knowledge_id=? AND version=?",(now(),knowledge_id,body.expectedVersion))
                db.execute('UPDATE knowledge SET active_version=? WHERE id=?',(body.expectedVersion,knowledge_id))
                result={'id':knowledge_id,'version':body.expectedVersion,'published':True,'retrievalMode':mode}
                audit(db,latest_user,'knowledge.publish',knowledge_id,{'version':body.expectedVersion,'mode':mode})
                save_operation(db,latest_user,idempotency_key,fingerprint,result);return result
        finally:PUBLICATION_LOCK.release()

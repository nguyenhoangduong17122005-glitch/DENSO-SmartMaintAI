"""Append three synthetic, traceable lessons and publications without replacing records."""
import json
import sqlite3

from .domain import digest, encoded, now
from .hozendx import MockHozenDX
from .knowledge import Content
from .store import DEFAULT_DB, ROOT, connect


def _literal(value):
    # Only validated repository fixtures and generated metadata enter this SQL batch.
    # Quoting is required because a remote libSQL sequence has no bind arguments.
    if value is None:
        return 'NULL'
    if isinstance(value, int):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def _statements(sample):
    number = sample['number']
    case_id, report_id = 'BM-KNOWLEDGE-' + number, 'RP-DEMO-CNC-' + number
    proposal_id, knowledge_id = 'DP-DEMO-CNC-' + number, 'KN-DEMO-CNC-' + number
    round_id, decision_id = 'RD-KNOWLEDGE-' + number, 'RV-DEMO-CNC-' + number
    stamp = now()
    content = Content.model_validate({k: v for k, v in sample.items() if k != 'number'}).model_dump()
    context = dict(symptom=content['symptom'], alarm='Chưa xác minh', component='Chưa xác minh',
                   mode='Mô phỏng', productModel='Chưa xác minh', speed='Chưa xác minh',
                   shift='Ca demo', onset='Theo tình huống mô phỏng',
                   environment='Dữ liệu tổng hợp cho demo', changes=[])
    events = [dict(id='EV-KNOWLEDGE-' + number + '-1', type='observation',
                   content=content['symptom'], result='Chưa xác nhận nguyên nhân.'),
              dict(id='EV-KNOWLEDGE-' + number + '-2', type='check',
                   content=content['solution'], result=content['result'])]
    for event in events:
        event.update(performedBy='u-minh', recordedBy='u-minh', performedAt=stamp, recordedAt=stamp)
    rounds = [dict(id=round_id, state='ended', startedAt=stamp, endedAt=stamp,
                   summary=content['result'], nextSteps=content['followUp'], events=events)]
    source = MockHozenDX().get_asset('CNC-04')
    snapshot = dict(caseId=case_id, contextRevision=1, caseDataRevision=1, context=context,
                    sourceHash=digest(source), events=[dict(id=e['id'], revision=1) for e in events],
                    rounds=[dict(id=round_id, revision=1, state='ended')])
    report = dict(summary=content['symptom'], cause=content['cause'], causeStatus=content['causeStatus'],
                  actions=content['solution'], result=content['result'], evidence=content['evidence'],
                  followUp=content['followUp'])
    statements = []

    def insert(table, **values):
        statements.append('INSERT INTO ' + table + '(' + ','.join(values) + ') VALUES(' +
                          ','.join(_literal(v) for v in values.values()) + ');')

    insert('cases', id=case_id, asset_id='CNC-04', owner_id='u-minh', title=content['title'], type='BM',
           work_state='ended', machine_state='unrestored', report_state='confirmed',
           context_json=encoded(context), rounds_json=encoded(rounds), source_snapshot_json=encoded(source),
           updated_at=stamp)
    insert('case_participants', case_id=case_id, user_id='u-minh')
    insert('case_context_versions', case_id=case_id, revision=1, data_revision=1,
           content_json=encoded(context), recorded_by='u-minh', recorded_at=stamp, origin='demo_seed')
    insert('case_source_snapshots', case_id=case_id, asset_id='CNC-04', content_json=encoded(source),
           content_hash=digest(source), captured_at=stamp, origin='demo_seed')
    insert('case_rounds', id=round_id, case_id=case_id, sequence=1, state='ended', started_at=stamp,
           ended_at=stamp, summary=content['result'], remaining_work=content['followUp'], created_by='u-minh')
    for event in events:
        insert('case_events', id=event['id'], case_id=case_id, round_id=round_id, current_revision=1)
        insert('case_event_versions', event_id=event['id'], case_id=case_id, revision=1, kind=event['type'],
               content=event['content'], result=event['result'], performed_by='u-minh', recorded_by='u-minh',
               occurred_at=stamp, recorded_at=stamp, origin='demo_seed')
    insert('case_closures', case_id=case_id, closed_by='u-minh', machine_state='unrestored',
           evidence=content['evidence'], closed_at=stamp)
    insert('reports', id=report_id, case_id=case_id, current_revision=1, status='confirmed')
    insert('report_versions', report_id=report_id, revision=1, content_json=encoded(report),
           cause_status=content['causeStatus'], evidence=content['evidence'], source_data_revision=1,
           source_snapshot_json=encoded(snapshot), source_snapshot_hash=digest(snapshot),
           author_id='u-minh', created_at=stamp)
    for event in events:
        insert('report_source_events', report_id=report_id, report_revision=1, event_id=event['id'], event_revision=1)
    insert('report_confirmations', report_id=report_id, report_revision=1, confirmed_by='u-minh', confirmed_at=stamp)
    insert('proposals', id=proposal_id, author_id='u-minh', asset_id='CNC-04', current_revision=1, status='approved')
    insert('proposal_versions', proposal_id=proposal_id, revision=1, mode='new', content_json=encoded(content),
           source_report_id=report_id, source_report_revision=1, created_by='u-minh', created_at=stamp,
           rationale='Mẫu mô phỏng để trình diễn bài học từ báo cáo đã xác nhận; không phải dữ liệu nhà máy.')
    insert('proposal_contributors', proposal_id=proposal_id, proposal_revision=1, user_id='u-minh')
    insert('review_decisions', id=decision_id, proposal_id=proposal_id, proposal_revision=1, reviewer_id='u-anh',
           decision='approved', feedback='Kiểm duyệt mô phỏng: nội dung có nguồn và ghi rõ giới hạn; chưa xác nhận nguyên nhân thực tế.',
           decided_at=stamp)
    insert('knowledge', id=knowledge_id, asset_id='CNC-04', active_version=None, environment='demo')
    insert('knowledge_versions', knowledge_id=knowledge_id, version=1, content_json=encoded(content),
           content_hash=digest(content), review_decision_id=decision_id, created_at=stamp)
    insert('knowledge_publication', knowledge_id=knowledge_id, version=1, index_status='ready',
           validity_status='valid', effective_from=stamp)
    statements.append('UPDATE knowledge SET active_version=1 WHERE id=' + _literal(knowledge_id) + ';')
    insert('audit', actor_id='u-minh', action='demo.seed_knowledge', object_id=case_id, at=stamp,
           details_json=encoded(dict(environment='demo', isSimulated=True, proposalId=proposal_id,
                                     knowledgeId=knowledge_id, provenance='synthetic_for_demo')))
    return statements


def add_knowledge_samples(path=DEFAULT_DB):
    """One atomic insert-only batch, including on existing hosted Turso databases.

    The batch keeps the remote write transaction short (libSQL has a time limit).
    Deferred foreign keys and all approval/provenance triggers remain enabled.
    Existing sample cases are never repaired or overwritten on subsequent starts.
    """
    fixture = json.loads((ROOT / 'fixtures/cases/cnc-knowledge-samples.json').read_text(encoding='utf-8'))
    if fixture.get('environment') != 'demo' or fixture.get('isSimulated') is not True:
        raise ValueError('Expected simulated knowledge samples')
    # Prepare and validate before acquiring the database write lock.
    batches = [('BM-KNOWLEDGE-' + s['number'], _statements(s)) for s in fixture['samples']]
    with connect(path) as db:
        db.execute('BEGIN IMMEDIATE')
        existing = {row[0] for row in db.execute(
            "SELECT id FROM cases WHERE id IN ('BM-KNOWLEDGE-001','BM-KNOWLEDGE-002','BM-KNOWLEDGE-003')").fetchall()}
        added = [case_id for case_id, _ in batches if case_id not in existing]
        statements = [statement for case_id, batch in batches if case_id not in existing for statement in batch]
        if isinstance(db, sqlite3.Connection):
            # sqlite3.executescript commits an existing transaction; execute each
            # statement here so the entire graph rolls back together on failure.
            for statement in statements:
                db.execute(statement)
        elif statements:
            db.executescript('\n'.join(statements))
    return added


def main():
    import os
    from .config import load_config
    load_config()
    added = add_knowledge_samples(os.getenv('SMARTMAINT_DB', DEFAULT_DB))
    print('Added', len(added), 'synthetic lessons and published knowledge sources.')


if __name__ == '__main__':
    main()

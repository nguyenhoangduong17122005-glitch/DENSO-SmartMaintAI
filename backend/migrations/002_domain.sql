CREATE TABLE assets (
    id TEXT PRIMARY KEY, machine_family TEXT NOT NULL, machine_model TEXT,
    maker TEXT, installed_year INTEGER, plant_id TEXT,
    environment TEXT NOT NULL CHECK(environment IN ('demo','production')),
    metadata_json TEXT NOT NULL CHECK(json_valid(metadata_json))
);
CREATE TABLE case_context_versions (
    case_id TEXT NOT NULL REFERENCES cases(id), revision INTEGER NOT NULL CHECK(revision>0),
    data_revision INTEGER NOT NULL CHECK(data_revision>0), content_json TEXT NOT NULL CHECK(json_valid(content_json)),
    recorded_by TEXT REFERENCES users(id), recorded_at TEXT, origin TEXT NOT NULL,
    PRIMARY KEY(case_id,revision)
);
CREATE TABLE case_source_snapshots (
    case_id TEXT PRIMARY KEY REFERENCES cases(id), asset_id TEXT NOT NULL REFERENCES assets(id),
    content_json TEXT NOT NULL CHECK(json_valid(content_json)), content_hash TEXT NOT NULL,
    captured_at TEXT, origin TEXT NOT NULL
);
CREATE TABLE legacy_case_snapshots (
    case_id TEXT PRIMARY KEY REFERENCES cases(id), payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
    migrated_at TEXT NOT NULL
);
CREATE TABLE case_rounds (
    id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES cases(id), sequence INTEGER NOT NULL CHECK(sequence>0),
    state TEXT NOT NULL CHECK(state IN ('active','ended','legacy')),
    started_at TEXT, ended_at TEXT, summary TEXT NOT NULL DEFAULT '', remaining_work TEXT NOT NULL DEFAULT '',
    created_by TEXT REFERENCES users(id), revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0),
    UNIQUE(case_id,sequence), UNIQUE(id,case_id)
);
CREATE UNIQUE INDEX one_active_round_per_case ON case_rounds(case_id) WHERE state='active';
CREATE TABLE case_events (
    id TEXT PRIMARY KEY, case_id TEXT NOT NULL, round_id TEXT NOT NULL,
    current_revision INTEGER NOT NULL CHECK(current_revision>0), UNIQUE(id,case_id),
    FOREIGN KEY(round_id,case_id) REFERENCES case_rounds(id,case_id),
    FOREIGN KEY(id,current_revision) REFERENCES case_event_versions(event_id,revision) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE case_event_versions (
    event_id TEXT NOT NULL, case_id TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision>0),
    kind TEXT NOT NULL CHECK(kind IN ('observation','check','hypothesis','action','result')),
    content TEXT NOT NULL CHECK(length(trim(content))>0), result TEXT NOT NULL DEFAULT '',
    rationale TEXT NOT NULL DEFAULT '', measurement REAL, unit TEXT,
    performed_by TEXT REFERENCES users(id), recorded_by TEXT REFERENCES users(id),
    occurred_at TEXT, recorded_at TEXT, correction_reason TEXT, origin TEXT NOT NULL,
    PRIMARY KEY(event_id,revision), UNIQUE(event_id,revision,case_id),
    FOREIGN KEY(event_id,case_id) REFERENCES case_events(id,case_id),
    CHECK((measurement IS NULL AND unit IS NULL) OR (measurement IS NOT NULL AND length(trim(unit))>0))
);
CREATE TABLE contribution_confirmations (
    id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES cases(id), contributor_id TEXT NOT NULL REFERENCES users(id),
    scope_hash TEXT NOT NULL, confirmed_at TEXT NOT NULL, UNIQUE(id,case_id)
);
CREATE TABLE confirmation_items (
    confirmation_id TEXT NOT NULL, case_id TEXT NOT NULL, event_id TEXT NOT NULL, event_revision INTEGER NOT NULL,
    PRIMARY KEY(confirmation_id,event_id),
    FOREIGN KEY(confirmation_id,case_id) REFERENCES contribution_confirmations(id,case_id),
    FOREIGN KEY(event_id,event_revision,case_id) REFERENCES case_event_versions(event_id,revision,case_id)
);
CREATE TABLE case_pm_items (
    id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES cases(id), template_id TEXT NOT NULL,
    template_version TEXT NOT NULL, label TEXT NOT NULL, criterion TEXT NOT NULL,
    UNIQUE(id,case_id)
);
CREATE TABLE pm_result_versions (
    item_id TEXT NOT NULL REFERENCES case_pm_items(id), revision INTEGER NOT NULL CHECK(revision>0),
    status TEXT NOT NULL CHECK(status IN ('unperformed','pass','fail','unknown')),
    measurement REAL, unit TEXT, abnormality TEXT, recorded_by TEXT NOT NULL REFERENCES users(id), recorded_at TEXT NOT NULL,
    PRIMARY KEY(item_id,revision),
    CHECK((measurement IS NULL AND unit IS NULL) OR (measurement IS NOT NULL AND length(trim(unit))>0))
);
CREATE TABLE reports (
    id TEXT PRIMARY KEY, case_id TEXT NOT NULL UNIQUE REFERENCES cases(id),
    current_revision INTEGER NOT NULL CHECK(current_revision>0),
    status TEXT NOT NULL CHECK(status IN ('draft','pending','changes','confirmed')),
    FOREIGN KEY(id,current_revision) REFERENCES report_versions(report_id,revision) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE report_versions (
    report_id TEXT NOT NULL REFERENCES reports(id), revision INTEGER NOT NULL CHECK(revision>0),
    content_json TEXT NOT NULL CHECK(json_valid(content_json)),
    cause_status TEXT NOT NULL CHECK(cause_status IN ('unknown','hypothesis','confirmed')),
    evidence TEXT NOT NULL DEFAULT '', source_data_revision INTEGER NOT NULL CHECK(source_data_revision>0),
    source_snapshot_json TEXT NOT NULL CHECK(json_valid(source_snapshot_json)), source_snapshot_hash TEXT NOT NULL,
    author_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, correction_reason TEXT,
    PRIMARY KEY(report_id,revision), CHECK(cause_status!='confirmed' OR length(trim(evidence))>0)
);
CREATE TABLE report_source_events (
    report_id TEXT NOT NULL, report_revision INTEGER NOT NULL, event_id TEXT NOT NULL, event_revision INTEGER NOT NULL,
    PRIMARY KEY(report_id,report_revision,event_id),
    FOREIGN KEY(report_id,report_revision) REFERENCES report_versions(report_id,revision),
    FOREIGN KEY(event_id,event_revision) REFERENCES case_event_versions(event_id,revision)
);
CREATE TABLE report_confirmations (
    report_id TEXT NOT NULL, report_revision INTEGER NOT NULL, confirmed_by TEXT NOT NULL REFERENCES users(id),
    confirmed_at TEXT NOT NULL, PRIMARY KEY(report_id,report_revision),
    FOREIGN KEY(report_id,report_revision) REFERENCES report_versions(report_id,revision)
);
CREATE TABLE proposals (
    id TEXT PRIMARY KEY, author_id TEXT NOT NULL REFERENCES users(id), asset_id TEXT NOT NULL REFERENCES assets(id),
    current_revision INTEGER NOT NULL CHECK(current_revision>0),
    status TEXT NOT NULL CHECK(status IN ('draft','pending','changes','rejected','withdrawn','approved')),
    FOREIGN KEY(id,current_revision) REFERENCES proposal_versions(proposal_id,revision) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE proposal_versions (
    proposal_id TEXT NOT NULL REFERENCES proposals(id), revision INTEGER NOT NULL CHECK(revision>0),
    mode TEXT NOT NULL CHECK(mode IN ('new','update','link')), content_json TEXT NOT NULL CHECK(json_valid(content_json)),
    source_report_id TEXT, source_report_revision INTEGER, target_knowledge_id TEXT, target_version INTEGER,
    rationale TEXT NOT NULL, created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL,
    PRIMARY KEY(proposal_id,revision),
    FOREIGN KEY(source_report_id,source_report_revision) REFERENCES report_confirmations(report_id,report_revision),
    FOREIGN KEY(target_knowledge_id,target_version) REFERENCES knowledge_versions(knowledge_id,version),
    CHECK((source_report_id IS NULL)=(source_report_revision IS NULL)),
    CHECK((mode='new' AND target_knowledge_id IS NULL AND target_version IS NULL)
       OR (mode IN ('update','link') AND target_knowledge_id IS NOT NULL AND target_version IS NOT NULL)),
    CHECK(mode!='link' OR source_report_id IS NOT NULL)
);
CREATE TABLE proposal_contributors (
    proposal_id TEXT NOT NULL, proposal_revision INTEGER NOT NULL, user_id TEXT NOT NULL REFERENCES users(id),
    PRIMARY KEY(proposal_id,proposal_revision,user_id),
    FOREIGN KEY(proposal_id,proposal_revision) REFERENCES proposal_versions(proposal_id,revision)
);
CREATE TABLE review_decisions (
    id TEXT PRIMARY KEY, proposal_id TEXT NOT NULL, proposal_revision INTEGER NOT NULL,
    reviewer_id TEXT NOT NULL REFERENCES users(id),
    decision TEXT NOT NULL CHECK(decision IN ('approved','changes','rejected')), feedback TEXT NOT NULL,
    decided_at TEXT NOT NULL, FOREIGN KEY(proposal_id,proposal_revision) REFERENCES proposal_versions(proposal_id,revision)
);
CREATE UNIQUE INDEX one_approval_per_submission ON review_decisions(proposal_id,proposal_revision) WHERE decision='approved';
CREATE TABLE knowledge (
    id TEXT PRIMARY KEY, asset_id TEXT NOT NULL REFERENCES assets(id),
    active_version INTEGER, environment TEXT NOT NULL CHECK(environment IN ('demo','production')),
    FOREIGN KEY(id,active_version) REFERENCES knowledge_versions(knowledge_id,version) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE knowledge_versions (
    knowledge_id TEXT NOT NULL REFERENCES knowledge(id), version INTEGER NOT NULL CHECK(version>0),
    content_json TEXT NOT NULL CHECK(json_valid(content_json)), content_hash TEXT NOT NULL,
    review_decision_id TEXT NOT NULL UNIQUE REFERENCES review_decisions(id), created_at TEXT NOT NULL,
    PRIMARY KEY(knowledge_id,version)
);
CREATE TABLE knowledge_publication (
    knowledge_id TEXT NOT NULL, version INTEGER NOT NULL,
    index_status TEXT NOT NULL CHECK(index_status IN ('queued','building','ready','failed')),
    validity_status TEXT NOT NULL CHECK(validity_status IN ('valid','withdrawn','needs_review')),
    effective_from TEXT, effective_to TEXT,
    PRIMARY KEY(knowledge_id,version), FOREIGN KEY(knowledge_id,version) REFERENCES knowledge_versions(knowledge_id,version)
);
CREATE TABLE knowledge_case_links (
    case_id TEXT NOT NULL REFERENCES cases(id), knowledge_id TEXT NOT NULL, knowledge_version INTEGER NOT NULL,
    review_decision_id TEXT NOT NULL UNIQUE REFERENCES review_decisions(id),
    PRIMARY KEY(case_id,knowledge_id,knowledge_version),
    FOREIGN KEY(knowledge_id,knowledge_version) REFERENCES knowledge_versions(knowledge_id,version)
);
CREATE TABLE outbox_events (
    id TEXT PRIMARY KEY, event_type TEXT NOT NULL, aggregate_id TEXT NOT NULL, aggregate_version INTEGER NOT NULL,
    payload_json TEXT NOT NULL CHECK(json_valid(payload_json)), created_at TEXT NOT NULL,
    processed_at TEXT, attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts>=0),
    UNIQUE(event_type,aggregate_id,aggregate_version)
);
CREATE INDEX events_by_round ON case_events(case_id,round_id);
CREATE INDEX reports_by_case ON reports(case_id);
CREATE INDEX confirmations_by_case ON contribution_confirmations(case_id,contributor_id);
CREATE TRIGGER confirmation_performer BEFORE INSERT ON confirmation_items BEGIN
    SELECT CASE WHEN NOT EXISTS (
        SELECT 1 FROM case_event_versions v JOIN contribution_confirmations c ON c.id=NEW.confirmation_id
        WHERE v.event_id=NEW.event_id AND v.revision=NEW.event_revision
        AND v.case_id=c.case_id AND v.performed_by=c.contributor_id
    ) THEN RAISE(ABORT,'confirmation must belong to the performer') END;
END;
CREATE TRIGGER independent_review BEFORE INSERT ON review_decisions BEGIN
    SELECT CASE WHEN EXISTS (
        SELECT 1 FROM proposals p WHERE p.id=NEW.proposal_id AND p.author_id=NEW.reviewer_id
    ) OR EXISTS (
        SELECT 1 FROM proposal_contributors c WHERE c.proposal_id=NEW.proposal_id
        AND c.proposal_revision=NEW.proposal_revision AND c.user_id=NEW.reviewer_id
    ) THEN RAISE(ABORT,'reviewer must be independent') END;
    SELECT CASE WHEN NOT EXISTS (
        SELECT 1 FROM users u JOIN proposals p ON p.id=NEW.proposal_id
        JOIN asset_grants g ON g.user_id=u.id AND g.asset_id=p.asset_id
        WHERE u.id=NEW.reviewer_id AND u.role='lead' AND u.active=1
        AND p.current_revision=NEW.proposal_revision
    ) THEN RAISE(ABORT,'reviewer role scope or revision is invalid') END;
END;
CREATE TRIGGER knowledge_requires_approval BEFORE INSERT ON knowledge_versions BEGIN
    SELECT CASE WHEN NOT EXISTS (
        SELECT 1 FROM review_decisions d JOIN proposal_versions p
        ON p.proposal_id=d.proposal_id AND p.revision=d.proposal_revision
        WHERE d.id=NEW.review_decision_id AND d.decision='approved' AND p.mode IN ('new','update')
    ) THEN RAISE(ABORT,'knowledge requires an approved content proposal') END;
END;
CREATE TRIGGER knowledge_activation BEFORE UPDATE OF active_version ON knowledge
WHEN NEW.active_version IS NOT NULL BEGIN
    SELECT CASE WHEN NOT EXISTS (
        SELECT 1 FROM knowledge_publication p WHERE p.knowledge_id=NEW.id AND p.version=NEW.active_version
        AND p.index_status='ready' AND p.validity_status='valid'
    ) THEN RAISE(ABORT,'knowledge version is not ready and valid') END;
END;

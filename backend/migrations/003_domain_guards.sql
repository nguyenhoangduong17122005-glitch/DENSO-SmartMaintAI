CREATE TRIGGER event_revision_sequence BEFORE INSERT ON case_event_versions BEGIN
    SELECT CASE WHEN NEW.revision != COALESCE((SELECT MAX(revision)+1 FROM case_event_versions WHERE event_id=NEW.event_id),1)
    THEN RAISE(ABORT,'event revisions must be sequential') END;
    SELECT CASE WHEN NEW.measurement IS NOT NULL AND (NEW.unit IS NULL OR length(trim(NEW.unit))=0)
    THEN RAISE(ABORT,'measurement requires a unit') END;
END;
CREATE TRIGGER pm_measurement_unit BEFORE INSERT ON pm_result_versions
WHEN NEW.measurement IS NOT NULL AND (NEW.unit IS NULL OR length(trim(NEW.unit))=0) BEGIN
    SELECT RAISE(ABORT,'measurement requires a unit');
END;
CREATE TRIGGER event_lineage_immutable BEFORE UPDATE OF id,case_id,round_id ON case_events BEGIN
    SELECT RAISE(ABORT,'event lineage is immutable');
END;
CREATE TRIGGER report_source_same_case BEFORE INSERT ON report_source_events BEGIN
    SELECT CASE WHEN NOT EXISTS (
        SELECT 1 FROM reports r JOIN case_events e ON e.case_id=r.case_id
        WHERE r.id=NEW.report_id AND e.id=NEW.event_id
    ) THEN RAISE(ABORT,'report event belongs to a different case') END;
END;
CREATE TRIGGER report_confirmation_owner BEFORE INSERT ON report_confirmations BEGIN
    SELECT CASE WHEN NOT EXISTS (
        SELECT 1 FROM reports r JOIN report_versions v ON v.report_id=r.id AND v.revision=NEW.report_revision
        JOIN cases c ON c.id=r.case_id JOIN users u ON u.id=NEW.confirmed_by
        WHERE r.id=NEW.report_id AND r.current_revision=NEW.report_revision
        AND c.owner_id=NEW.confirmed_by AND c.work_state='ended' AND u.active=1 AND u.role='maintenance'
        AND c.data_revision=v.source_data_revision
    ) THEN RAISE(ABORT,'report confirmation requires owner finished work and current source') END;
END;
CREATE TRIGGER knowledge_initial_activation BEFORE INSERT ON knowledge
WHEN NEW.active_version IS NOT NULL BEGIN
    SELECT RAISE(ABORT,'create knowledge inactive then activate a ready version');
END;
CREATE TRIGGER knowledge_content_scope BEFORE INSERT ON knowledge_versions BEGIN
    SELECT CASE WHEN NOT EXISTS (
        SELECT 1 FROM knowledge k JOIN review_decisions d ON d.id=NEW.review_decision_id
        JOIN proposals p ON p.id=d.proposal_id
        WHERE k.id=NEW.knowledge_id AND k.asset_id=p.asset_id AND p.current_revision=d.proposal_revision
    ) THEN RAISE(ABORT,'knowledge scope or proposal revision mismatch') END;
END;
CREATE TRIGGER case_link_requires_approval BEFORE INSERT ON knowledge_case_links BEGIN
    SELECT CASE WHEN NOT EXISTS (
        SELECT 1 FROM review_decisions d JOIN proposal_versions p ON p.proposal_id=d.proposal_id AND p.revision=d.proposal_revision
        JOIN reports r ON r.id=p.source_report_id
        WHERE d.id=NEW.review_decision_id AND d.decision='approved' AND p.mode='link'
        AND r.case_id=NEW.case_id AND p.target_knowledge_id=NEW.knowledge_id AND p.target_version=NEW.knowledge_version
    ) THEN RAISE(ABORT,'case link requires matching approved link proposal') END;
END;
CREATE TRIGGER cases_domain_insert BEFORE INSERT ON cases BEGIN
    SELECT CASE WHEN NEW.type NOT IN ('BM','PM') OR NEW.work_state NOT IN ('active','waiting','ended')
        OR NEW.machine_state NOT IN ('unverified','restored','unrestored') OR NEW.report_state NOT IN ('draft','pending','changes','confirmed')
        OR NEW.context_revision<1 OR NEW.data_revision<1 OR NOT EXISTS(SELECT 1 FROM assets WHERE id=NEW.asset_id)
    THEN RAISE(ABORT,'invalid case state asset or revision') END;
END;
CREATE TRIGGER cases_domain_update BEFORE UPDATE ON cases BEGIN
    SELECT CASE WHEN NEW.type NOT IN ('BM','PM') OR NEW.work_state NOT IN ('active','waiting','ended')
        OR NEW.machine_state NOT IN ('unverified','restored','unrestored') OR NEW.report_state NOT IN ('draft','pending','changes','confirmed')
        OR NEW.context_revision<OLD.context_revision OR NEW.data_revision<OLD.data_revision
        OR NOT EXISTS(SELECT 1 FROM assets WHERE id=NEW.asset_id)
    THEN RAISE(ABORT,'invalid case state asset or revision') END;
END;

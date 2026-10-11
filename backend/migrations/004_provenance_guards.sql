CREATE TRIGGER report_confirmation_contributions BEFORE INSERT ON report_confirmations BEGIN
    SELECT CASE WHEN EXISTS (
        SELECT 1 FROM reports r JOIN case_events e ON e.case_id=r.case_id
        JOIN case_event_versions v ON v.event_id=e.id AND v.revision=e.current_revision
        JOIN users u ON u.id=v.performed_by
        WHERE r.id=NEW.report_id AND u.role='expert' AND NOT EXISTS (
            SELECT 1 FROM confirmation_items i JOIN contribution_confirmations c ON c.id=i.confirmation_id
            WHERE i.event_id=e.id AND i.event_revision=e.current_revision AND c.contributor_id=v.performed_by
        )
    ) THEN RAISE(ABORT,'expert contributions require current confirmations') END;
END;
CREATE TRIGGER proposal_source_scope BEFORE INSERT ON proposal_versions BEGIN
    SELECT CASE WHEN NEW.source_report_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM proposals p JOIN reports r ON r.id=NEW.source_report_id JOIN cases c ON c.id=r.case_id
        WHERE p.id=NEW.proposal_id AND p.asset_id=c.asset_id
    ) THEN RAISE(ABORT,'proposal and source report asset mismatch') END;
END;
CREATE TRIGGER review_source_independence BEFORE INSERT ON review_decisions BEGIN
    SELECT CASE WHEN EXISTS (
        SELECT 1 FROM proposal_versions p JOIN report_source_events s
        ON s.report_id=p.source_report_id AND s.report_revision=p.source_report_revision
        JOIN case_event_versions v ON v.event_id=s.event_id AND v.revision=s.event_revision
        WHERE p.proposal_id=NEW.proposal_id AND p.revision=NEW.proposal_revision
        AND (v.performed_by=NEW.reviewer_id OR v.recorded_by=NEW.reviewer_id)
    ) THEN RAISE(ABORT,'reviewer contributed to the source report') END;
END;
CREATE TRIGGER knowledge_approved_content BEFORE INSERT ON knowledge_versions BEGIN
    SELECT CASE WHEN NOT EXISTS (
        SELECT 1 FROM review_decisions d JOIN proposal_versions p
        ON p.proposal_id=d.proposal_id AND p.revision=d.proposal_revision
        WHERE d.id=NEW.review_decision_id AND p.content_json=NEW.content_json
        AND ((p.mode='new' AND NEW.version=1)
          OR (p.mode='update' AND p.target_knowledge_id=NEW.knowledge_id AND NEW.version=p.target_version+1))
    ) THEN RAISE(ABORT,'knowledge must preserve the approved content and version target') END;
END;

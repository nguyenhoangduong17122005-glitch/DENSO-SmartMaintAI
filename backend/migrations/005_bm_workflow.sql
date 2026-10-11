CREATE TABLE support_requests (
    id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES cases(id),
    requested_by TEXT NOT NULL REFERENCES users(id), expert_id TEXT NOT NULL REFERENCES users(id),
    message TEXT NOT NULL CHECK(length(trim(message))>0),
    status TEXT NOT NULL CHECK(status IN ('pending','accepted','declined','cancelled')),
    created_at TEXT NOT NULL, responded_at TEXT, response_note TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX one_open_support_request ON support_requests(case_id,expert_id)
    WHERE status IN ('pending','accepted');
CREATE TABLE case_closures (
    case_id TEXT PRIMARY KEY REFERENCES cases(id), closed_by TEXT NOT NULL REFERENCES users(id),
    machine_state TEXT NOT NULL CHECK(machine_state IN ('restored','unrestored')),
    evidence TEXT NOT NULL CHECK(length(trim(evidence))>0), closed_at TEXT NOT NULL
);
CREATE TRIGGER immutable_case_closures_update BEFORE UPDATE ON case_closures BEGIN
    SELECT RAISE(ABORT,'immutable closure');
END;
CREATE TRIGGER immutable_case_closures_delete BEFORE DELETE ON case_closures BEGIN
    SELECT RAISE(ABORT,'immutable closure');
END;

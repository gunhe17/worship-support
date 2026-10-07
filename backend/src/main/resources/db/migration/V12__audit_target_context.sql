-- Preserve historical events as unknown context; never infer a target for old rows.
ALTER TABLE audit_log
    ADD COLUMN workspace_id BIGINT,
    ADD COLUMN document_id BIGINT,
    ADD COLUMN membership_id BIGINT,
    ADD COLUMN target_type VARCHAR(30),
    ADD COLUMN target_id BIGINT,
    ADD COLUMN change_field VARCHAR(20),
    ADD COLUMN before_value VARCHAR(40),
    ADD COLUMN after_value VARCHAR(40),
    ADD CONSTRAINT audit_workspace FOREIGN KEY(workspace_id) REFERENCES workspace(id),
    ADD CONSTRAINT audit_document FOREIGN KEY(workspace_id,document_id) REFERENCES document(workspace_id,id),
    ADD CONSTRAINT audit_membership FOREIGN KEY(workspace_id,membership_id) REFERENCES workspace_membership(workspace_id,id),
    ADD CONSTRAINT audit_context CHECK((document_id IS NULL AND membership_id IS NULL) OR workspace_id IS NOT NULL),
    ADD CONSTRAINT audit_target CHECK(
        (target_type IS NULL AND target_id IS NULL) OR
        (target_type IS NOT NULL AND target_id IS NOT NULL AND target_id>0 AND target_type IN
            ('USER','EMAIL','GOOGLE_IDENTITY','WORKSPACE','MEMBERSHIP','DOCUMENT','DOCUMENT_GRANT','INVITATION','YOUTUBE_AUTHORIZATION'))),
    ADD CONSTRAINT audit_change CHECK(
        (change_field IS NULL AND before_value IS NULL AND after_value IS NULL) OR
        (change_field IS NOT NULL AND (before_value IS NOT NULL OR after_value IS NOT NULL) AND (
            (change_field='ROLE' AND (before_value IS NULL OR before_value IN ('ADMIN','MEMBER','MANAGER','EDITOR','VIEWER')) AND (after_value IS NULL OR after_value IN ('ADMIN','MEMBER','MANAGER','EDITOR','VIEWER'))) OR
            (change_field='STATE' AND (before_value IS NULL OR before_value IN ('ACTIVE','ENDED','WITHDRAWN','PENDING','ACCEPTED','REVOKED','EXPIRED')) AND (after_value IS NULL OR after_value IN ('ACTIVE','ENDED','WITHDRAWN','PENDING','ACCEPTED','REVOKED','EXPIRED'))) OR
            (change_field='ACCESS_POLICY' AND (before_value IS NULL OR before_value IN ('OPEN','RESTRICTED')) AND (after_value IS NULL OR after_value IN ('OPEN','RESTRICTED'))) OR
            (change_field IN ('CONNECTION','VERIFICATION','PRIMARY','PASSWORD_ENABLED') AND (before_value IS NULL OR before_value IN ('TRUE','FALSE')) AND (after_value IS NULL OR after_value IN ('TRUE','FALSE')))
        ))),
    ADD INDEX audit_workspace_time(workspace_id,occurred_at,id);

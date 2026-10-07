-- Existing workspaces remain ACTIVE; no data deletion or responsibility selection.
ALTER TABLE workspace
    ADD COLUMN state VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN terminated_at DATETIME(6),
    ADD CONSTRAINT workspace_state CHECK (state IN ('ACTIVE','TERMINATED')),
    ADD CONSTRAINT workspace_termination CHECK (
        (state='ACTIVE' AND terminated_at IS NULL) OR
        (state='TERMINATED' AND terminated_at IS NOT NULL)
    );
ALTER TABLE workspace_membership
    DROP CHECK membership_end,
    ADD CONSTRAINT membership_end CHECK (
        (state='ACTIVE' AND end_reason IS NULL) OR
        (state='ENDED' AND end_reason IS NOT NULL AND end_reason IN
            ('LEFT','REMOVED','USER_WITHDRAWN','WORKSPACE_TERMINATED'))
    );
ALTER TABLE audit_log
    DROP CHECK audit_change,
    ADD CONSTRAINT audit_change CHECK (
        (change_field IS NULL AND before_value IS NULL AND after_value IS NULL) OR
        (change_field IS NOT NULL AND (before_value IS NOT NULL OR after_value IS NOT NULL) AND (
            (change_field='ROLE' AND (before_value IS NULL OR before_value IN ('ADMIN','MEMBER','MANAGER','EDITOR','VIEWER')) AND (after_value IS NULL OR after_value IN ('ADMIN','MEMBER','MANAGER','EDITOR','VIEWER'))) OR
            (change_field='STATE' AND (before_value IS NULL OR before_value IN ('ACTIVE','TERMINATED','ENDED','WITHDRAWN','PENDING','ACCEPTED','REVOKED','EXPIRED')) AND (after_value IS NULL OR after_value IN ('ACTIVE','TERMINATED','ENDED','WITHDRAWN','PENDING','ACCEPTED','REVOKED','EXPIRED'))) OR
            (change_field='ACCESS_POLICY' AND (before_value IS NULL OR before_value IN ('OPEN','RESTRICTED')) AND (after_value IS NULL OR after_value IN ('OPEN','RESTRICTED'))) OR
            (change_field IN ('CONNECTION','VERIFICATION','PRIMARY','PASSWORD_ENABLED') AND (before_value IS NULL OR before_value IN ('TRUE','FALSE')) AND (after_value IS NULL OR after_value IN ('TRUE','FALSE')))
        )));

-- Reject legacy multiple-ADMIN rows instead of choosing/demoting a person.
-- The unique-index build fails without changing their roles. Resolve affected
-- workspaces explicitly before retrying this forward-only migration.
ALTER TABLE workspace_membership
    ADD COLUMN active_admin BIGINT GENERATED ALWAYS AS
        (CASE WHEN state='ACTIVE' AND role='ADMIN' THEN workspace_id ELSE NULL END) STORED,
    ADD CONSTRAINT single_active_admin UNIQUE(active_admin);

-- This is an at-most-one backstop. Creation/transfer/leave capabilities keep
-- exactly one ADMIN in an active workspace, under the workspace transaction lock.

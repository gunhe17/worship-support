-- Forward-only: validate existing rows, never guess a missing lifecycle reason or artifact size.
-- An invalid legacy row stops this migration and needs an explicit operator correction.
ALTER TABLE workspace_membership
    DROP CHECK membership_end,
    ADD CONSTRAINT membership_end CHECK (
        (state='ACTIVE' AND end_reason IS NULL) OR
        (state='ENDED' AND end_reason IS NOT NULL AND end_reason IN ('LEFT','REMOVED','USER_WITHDRAWN'))
    );
ALTER TABLE immutable_export
    DROP CHECK export_artifact,
    ADD CONSTRAINT export_artifact CHECK (
        status<>'SUCCEEDED' OR
        (object_key IS NOT NULL AND artifact_hash IS NOT NULL AND byte_size IS NOT NULL AND byte_size>0)
    );

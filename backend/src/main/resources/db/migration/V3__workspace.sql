CREATE TABLE workspace (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    created_at DATETIME(6) NOT NULL
);
CREATE TABLE workspace_membership (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    role VARCHAR(10) NOT NULL,
    state VARCHAR(10) NOT NULL,
    end_reason VARCHAR(20),
    active_user BIGINT GENERATED ALWAYS AS (CASE WHEN state='ACTIVE' THEN user_id ELSE NULL END) STORED,
    CONSTRAINT membership_workspace FOREIGN KEY(workspace_id) REFERENCES workspace(id),
    CONSTRAINT membership_user FOREIGN KEY(user_id) REFERENCES user_account(id),
    CONSTRAINT active_membership UNIQUE(workspace_id,active_user),
    CONSTRAINT membership_tenant UNIQUE(workspace_id,id),
    CONSTRAINT membership_role CHECK(role IN ('ADMIN','MEMBER')),
    CONSTRAINT membership_state CHECK(state IN ('ACTIVE','ENDED')),
    CONSTRAINT membership_end CHECK((state='ACTIVE' AND end_reason IS NULL) OR (state='ENDED' AND end_reason IN ('LEFT','REMOVED','USER_WITHDRAWN')))
);
CREATE TABLE workspace_invitation (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    inviter_id BIGINT NOT NULL,
    email VARCHAR(254) COLLATE utf8mb4_bin NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    state VARCHAR(10) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    delivery_status VARCHAR(30) NOT NULL,
    CONSTRAINT invitation_workspace FOREIGN KEY(workspace_id) REFERENCES workspace(id),
    CONSTRAINT invitation_actor FOREIGN KEY(inviter_id) REFERENCES user_account(id),
    CONSTRAINT invitation_tenant UNIQUE(workspace_id,id),
    CONSTRAINT invitation_state CHECK(state IN ('PENDING','ACCEPTED','EXPIRED','REVOKED'))
);
CREATE TABLE invitation_command (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    invitation_id BIGINT NOT NULL,
    actor_id BIGINT NOT NULL,
    command_key VARCHAR(100) COLLATE utf8mb4_bin NOT NULL,
    operation VARCHAR(10) NOT NULL,
    CONSTRAINT invitation_command_workspace FOREIGN KEY(workspace_id) REFERENCES workspace(id),
    CONSTRAINT invitation_command_target FOREIGN KEY(workspace_id,invitation_id) REFERENCES workspace_invitation(workspace_id,id),
    CONSTRAINT invitation_command_actor FOREIGN KEY(actor_id) REFERENCES user_account(id),
    CONSTRAINT invitation_command_unique UNIQUE(workspace_id,command_key)
);

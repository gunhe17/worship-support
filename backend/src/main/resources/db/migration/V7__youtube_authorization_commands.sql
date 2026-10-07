CREATE TABLE youtube_authorization (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    encrypted_refresh LONGTEXT NOT NULL,
    CONSTRAINT youtube_authorization_user FOREIGN KEY(user_id) REFERENCES user_account(id)
);
CREATE TABLE youtube_oauth_intent (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    session_version BIGINT NOT NULL,
    state_hash CHAR(64) COLLATE utf8mb4_bin NOT NULL UNIQUE,
    encrypted_verifier LONGTEXT NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    consumed BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT youtube_intent_user FOREIGN KEY(user_id) REFERENCES user_account(id)
);
CREATE TABLE playlist_command (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    document_id BIGINT NOT NULL,
    actor_id BIGINT NOT NULL,
    authorization_id BIGINT NOT NULL,
    command_key VARCHAR(100) COLLATE utf8mb4_bin NOT NULL,
    request_hash CHAR(64) COLLATE utf8mb4_bin NOT NULL,
    marker CHAR(36) COLLATE utf8mb4_bin NOT NULL UNIQUE,
    source_version BIGINT NOT NULL,
    canonical_json LONGTEXT NOT NULL,
    playlist_id VARCHAR(255) COLLATE utf8mb4_bin,
    status VARCHAR(30) NOT NULL,
    started_at DATETIME(6) NOT NULL,
    CONSTRAINT playlist_command_source FOREIGN KEY(workspace_id,document_id) REFERENCES document(workspace_id,id),
    CONSTRAINT playlist_command_actor FOREIGN KEY(actor_id) REFERENCES user_account(id),
    CONSTRAINT playlist_command_unique UNIQUE(workspace_id,command_key),
    CONSTRAINT playlist_snapshot CHECK(JSON_VALID(canonical_json)),
    CONSTRAINT playlist_status CHECK(status IN ('RUNNING','SUCCEEDED','FAILED_RETRYABLE','UNCERTAIN'))
);

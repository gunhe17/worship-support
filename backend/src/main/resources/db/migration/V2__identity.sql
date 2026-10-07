CREATE TABLE user_account (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    state VARCHAR(20) NOT NULL,
    session_version BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL,
    CONSTRAINT user_state CHECK (state IN ('ACTIVE','WITHDRAWN'))
);
CREATE TABLE user_email (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    email VARCHAR(254) COLLATE utf8mb4_bin NOT NULL,
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    primary_email BOOLEAN NOT NULL DEFAULT FALSE,
    verified_email VARCHAR(254) COLLATE utf8mb4_bin GENERATED ALWAYS AS (CASE WHEN verified THEN email ELSE NULL END) STORED,
    primary_user BIGINT GENERATED ALWAYS AS (CASE WHEN primary_email THEN user_id ELSE NULL END) STORED,
    CONSTRAINT email_user FOREIGN KEY (user_id) REFERENCES user_account(id),
    CONSTRAINT email_per_user UNIQUE(user_id, email),
    CONSTRAINT verified_email_owner UNIQUE(verified_email),
    CONSTRAINT one_primary_email UNIQUE(primary_user)
);
CREATE TABLE password_credential (
    user_id BIGINT NOT NULL PRIMARY KEY,
    password_hash VARCHAR(255) NOT NULL,
    CONSTRAINT password_user FOREIGN KEY(user_id) REFERENCES user_account(id)
);
CREATE TABLE external_identity (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    issuer VARCHAR(255) COLLATE utf8mb4_bin NOT NULL,
    subject VARCHAR(255) COLLATE utf8mb4_bin NOT NULL,
    CONSTRAINT identity_user FOREIGN KEY(user_id) REFERENCES user_account(id),
    CONSTRAINT identity_subject UNIQUE(issuer, subject)
);
CREATE TABLE account_token (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    email_id BIGINT,
    kind VARCHAR(20) NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at DATETIME(6) NOT NULL,
    consumed BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT token_user FOREIGN KEY(user_id) REFERENCES user_account(id),
    CONSTRAINT token_email FOREIGN KEY(email_id) REFERENCES user_email(id),
    CONSTRAINT token_kind CHECK(kind IN ('VERIFY','RESET'))
);
CREATE TABLE audit_log (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    actor_id BIGINT NOT NULL,
    event VARCHAR(80) NOT NULL,
    occurred_at DATETIME(6) NOT NULL,
    CONSTRAINT audit_actor FOREIGN KEY(actor_id) REFERENCES user_account(id)
);
CREATE TABLE oidc_intent (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    state_hash CHAR(64) NOT NULL UNIQUE,
    mode VARCHAR(20) NOT NULL,
    user_id BIGINT,
    session_version BIGINT,
    reauthenticated_at DATETIME(6),
    expires_at DATETIME(6) NOT NULL,
    consumed BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT intent_user FOREIGN KEY(user_id) REFERENCES user_account(id),
    CONSTRAINT intent_mode CHECK(mode IN ('LOGIN','LINK','REAUTHENTICATE'))
);

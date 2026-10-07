CREATE TABLE document (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    title VARCHAR(200) NOT NULL,
    type VARCHAR(20) NOT NULL,
    access_policy VARCHAR(20) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    modified_at DATETIME(6) NOT NULL,
    CONSTRAINT document_workspace FOREIGN KEY(workspace_id) REFERENCES workspace(id),
    CONSTRAINT document_tenant UNIQUE(workspace_id,id),
    CONSTRAINT document_type CHECK(type='SETLIST'),
    CONSTRAINT document_access CHECK(access_policy IN ('OPEN','RESTRICTED'))
);
CREATE TABLE document_grant (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    document_id BIGINT NOT NULL,
    membership_id BIGINT NOT NULL,
    role VARCHAR(20) NOT NULL,
    CONSTRAINT grant_document FOREIGN KEY(workspace_id,document_id) REFERENCES document(workspace_id,id),
    CONSTRAINT grant_membership FOREIGN KEY(workspace_id,membership_id) REFERENCES workspace_membership(workspace_id,id),
    CONSTRAINT grant_unique UNIQUE(document_id,membership_id),
    CONSTRAINT grant_role CHECK(role IN ('MANAGER','EDITOR','VIEWER'))
);
CREATE TABLE setlist (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    document_id BIGINT NOT NULL UNIQUE,
    notes TEXT NOT NULL,
    CONSTRAINT setlist_document FOREIGN KEY(workspace_id,document_id) REFERENCES document(workspace_id,id),
    CONSTRAINT setlist_tenant UNIQUE(workspace_id,id)
);

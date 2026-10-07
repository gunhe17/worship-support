CREATE TABLE member_notice (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    recipient_membership_id BIGINT NOT NULL,
    document_id BIGINT,
    kind VARCHAR(30) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    read_at DATETIME(6),
    CONSTRAINT notice_recipient FOREIGN KEY(workspace_id,recipient_membership_id)
        REFERENCES workspace_membership(workspace_id,id),
    CONSTRAINT notice_document FOREIGN KEY(workspace_id,document_id)
        REFERENCES document(workspace_id,id),
    CONSTRAINT notice_kind CHECK(kind IN ('ADMIN_ASSIGNED','MANAGER_ASSIGNED','WORKSPACE_TERMINATED')),
    CONSTRAINT notice_context CHECK(
        (kind='MANAGER_ASSIGNED' AND document_id IS NOT NULL) OR
        (kind IN ('ADMIN_ASSIGNED','WORKSPACE_TERMINATED') AND document_id IS NULL)),
    INDEX notice_recipient_page(recipient_membership_id,id)
);

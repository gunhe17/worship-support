CREATE TABLE score (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    song_id BIGINT,
    object_key VARCHAR(255) COLLATE utf8mb4_bin NOT NULL UNIQUE,
    filename VARCHAR(255) NOT NULL,
    media_type VARCHAR(50) NOT NULL,
    byte_size BIGINT NOT NULL,
    CONSTRAINT score_workspace FOREIGN KEY(workspace_id) REFERENCES workspace(id),
    CONSTRAINT score_song FOREIGN KEY(workspace_id,song_id) REFERENCES song(workspace_id,id),
    CONSTRAINT score_tenant UNIQUE(workspace_id,id),
    CONSTRAINT score_size CHECK(byte_size>0)
);
CREATE TABLE song_reference (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    url VARCHAR(2048) NOT NULL,
    title VARCHAR(200),
    video_id VARCHAR(11) COLLATE utf8mb4_bin,
    CONSTRAINT reference_workspace FOREIGN KEY(workspace_id) REFERENCES workspace(id),
    CONSTRAINT reference_tenant UNIQUE(workspace_id,id)
);
ALTER TABLE setlist_item ADD COLUMN score_id BIGINT NULL, ADD COLUMN reference_id BIGINT NULL,
    ADD CONSTRAINT item_score FOREIGN KEY(workspace_id,score_id) REFERENCES score(workspace_id,id),
    ADD CONSTRAINT item_reference FOREIGN KEY(workspace_id,reference_id) REFERENCES song_reference(workspace_id,id);
CREATE TABLE storage_cleanup_failure (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    object_key VARCHAR(255) COLLATE utf8mb4_bin NOT NULL,
    occurred_at DATETIME(6) NOT NULL,
    CONSTRAINT cleanup_workspace FOREIGN KEY(workspace_id) REFERENCES workspace(id)
);

CREATE TABLE song (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    title VARCHAR(200) NOT NULL,
    artist VARCHAR(200),
    CONSTRAINT song_workspace FOREIGN KEY(workspace_id) REFERENCES workspace(id),
    CONSTRAINT song_tenant UNIQUE(workspace_id,id)
);
CREATE TABLE setlist_item (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    setlist_id BIGINT NOT NULL,
    song_id BIGINT NOT NULL,
    position INT NOT NULL,
    musical_key VARCHAR(32),
    bpm DECIMAL(6,2),
    sessions_json LONGTEXT NOT NULL,
    notes TEXT NOT NULL,
    form_json LONGTEXT NOT NULL,
    CONSTRAINT item_setlist FOREIGN KEY(workspace_id,setlist_id) REFERENCES setlist(workspace_id,id),
    CONSTRAINT item_song FOREIGN KEY(workspace_id,song_id) REFERENCES song(workspace_id,id),
    CONSTRAINT item_order UNIQUE(setlist_id,position),
    CONSTRAINT item_tenant UNIQUE(workspace_id,id),
    CONSTRAINT item_position CHECK(position>=0),
    CONSTRAINT item_bpm CHECK(bpm IS NULL OR bpm>0),
    CONSTRAINT item_sessions CHECK(JSON_VALID(sessions_json)),
    CONSTRAINT item_form CHECK(JSON_VALID(form_json))
);

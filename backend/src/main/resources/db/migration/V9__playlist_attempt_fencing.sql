ALTER TABLE playlist_command ADD COLUMN attempt_id CHAR(36) COLLATE utf8mb4_bin;
UPDATE playlist_command SET attempt_id=UUID() WHERE attempt_id IS NULL;
ALTER TABLE playlist_command MODIFY COLUMN attempt_id CHAR(36) COLLATE utf8mb4_bin NOT NULL;

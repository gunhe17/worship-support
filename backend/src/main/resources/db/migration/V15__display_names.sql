-- No email-derived backfill: a shared display name is not an identity proof.
ALTER TABLE user_account ADD COLUMN display_name VARCHAR(80);

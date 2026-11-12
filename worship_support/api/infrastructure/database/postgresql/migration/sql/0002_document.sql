CREATE TABLE document (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid        NOT NULL REFERENCES workspace (id),
  name             text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
  visibility       text        NOT NULL DEFAULT 'OPEN' CHECK (visibility IN ('OPEN', 'RESTRICTED')),
  trashed_at       timestamptz NULL,
  purged_at        timestamptz NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  CHECK (purged_at IS NULL OR trashed_at IS NOT NULL)
);
CREATE UNIQUE INDEX ux_document_name ON document (workspace_id, normalize_name(name)) WHERE trashed_at IS NULL;
CREATE TABLE document_view_link (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid        NOT NULL,
  document_id      uuid        NOT NULL,
  enabled          boolean     NOT NULL DEFAULT true,
  token_hash       text        NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  scores_included  boolean     NOT NULL,
  revoked_at       timestamptz NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (workspace_id, document_id) REFERENCES document (workspace_id, id)
);
CREATE UNIQUE INDEX ux_view_link_one ON document_view_link (document_id) WHERE revoked_at IS NULL;
CREATE TRIGGER trg_document_no_delete BEFORE DELETE ON document FOR EACH ROW EXECUTE FUNCTION forbid_delete();
CREATE TRIGGER trg_document_no_truncate BEFORE TRUNCATE ON document FOR EACH STATEMENT EXECUTE FUNCTION forbid_delete();
CREATE TRIGGER trg_document_view_link_no_delete BEFORE DELETE ON document_view_link FOR EACH ROW EXECUTE FUNCTION forbid_delete();
CREATE TRIGGER trg_document_view_link_no_truncate BEFORE TRUNCATE ON document_view_link FOR EACH STATEMENT EXECUTE FUNCTION forbid_delete();

CREATE TABLE document_grant (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid        NOT NULL,
  document_id   uuid        NOT NULL,
  member_id     uuid        NOT NULL,
  role          text        NOT NULL CHECK (role IN ('OWNER', 'EDITOR', 'VIEWER')),
  revoked_at    timestamptz NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (workspace_id, document_id) REFERENCES document (workspace_id, id),
  FOREIGN KEY (workspace_id, member_id)   REFERENCES workspace_member (workspace_id, id)
);
CREATE UNIQUE INDEX ux_document_grant_live ON document_grant (document_id, member_id) WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX ux_document_grant_one_owner
  ON document_grant (document_id)
  WHERE role = 'OWNER' AND revoked_at IS NULL;
CREATE FUNCTION revoked_grant_guard() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN
  IF OLD.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'document_grant: 회수된 권한은 바꿀 수 없다. 다시 주려면 새 행' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END
$f$;
CREATE TRIGGER trg_document_grant_revoked BEFORE UPDATE ON document_grant FOR EACH ROW EXECUTE FUNCTION revoked_grant_guard();
CREATE TABLE document_access_request (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         uuid        NOT NULL,
  document_id          uuid        NOT NULL,
  requester_member_id  uuid        NOT NULL,
  requested_role       text        NOT NULL CHECK (requested_role IN ('EDITOR', 'VIEWER')),
  status               text        NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'INVALIDATED')),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (workspace_id, document_id)         REFERENCES document (workspace_id, id),
  FOREIGN KEY (workspace_id, requester_member_id) REFERENCES workspace_member (workspace_id, id)
);
CREATE FUNCTION closed_request_guard() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN
  IF OLD.status <> 'PENDING' THEN
    RAISE EXCEPTION '닫힌 요청은 바꿀 수 없다' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END
$f$;
CREATE TRIGGER trg_document_access_request_closed
  BEFORE UPDATE ON document_access_request
  FOR EACH ROW EXECUTE FUNCTION closed_request_guard();
CREATE UNIQUE INDEX ux_access_request_one_pending
  ON document_access_request (document_id, requester_member_id)
  WHERE status = 'PENDING';
CREATE TRIGGER trg_document_grant_no_delete BEFORE DELETE ON document_grant FOR EACH ROW EXECUTE FUNCTION forbid_delete();
CREATE TRIGGER trg_document_grant_no_truncate BEFORE TRUNCATE ON document_grant FOR EACH STATEMENT EXECUTE FUNCTION forbid_delete();
CREATE TRIGGER trg_access_request_no_delete BEFORE DELETE ON document_access_request FOR EACH ROW EXECUTE FUNCTION forbid_delete();
CREATE TRIGGER trg_access_request_no_truncate BEFORE TRUNCATE ON document_access_request FOR EACH STATEMENT EXECUTE FUNCTION forbid_delete();

CREATE FUNCTION normalize_name(t text) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE
  RETURN lower(normalize(regexp_replace(t, '^\s+|\s+$', '', 'g'), NFC) COLLATE "C");
CREATE TABLE users (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text        NULL CHECK (char_length(name) BETWEEN 1 AND 30),
  status                text        NOT NULL CHECK (status IN ('ACTIVE', 'WITHDRAWN', 'TERMINATED')),
  phone_e164            text        NULL CHECK (phone_e164 ~ '^\+8210[0-9]{8}$'),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'ACTIVE' OR name IS NOT NULL),
  CHECK (status <> 'WITHDRAWN' OR (name IS NULL AND phone_e164 IS NULL))
);
CREATE UNIQUE INDEX ux_users_phone ON users (phone_e164) WHERE phone_e164 IS NOT NULL;
CREATE TABLE user_social_account (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES users (id),
  provider    text        NOT NULL CHECK (provider IN ('GOOGLE', 'KAKAO', 'APPLE')),
  subject     text        NULL CHECK (char_length(btrim(subject)) BETWEEN 1 AND 255),
  provider_email text     NULL CHECK (char_length(provider_email) <= 320),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  unlinked_at timestamptz NULL,
  UNIQUE (provider, subject),
  CHECK ((unlinked_at IS NULL) = (subject IS NOT NULL)),
  CHECK (unlinked_at IS NULL OR provider_email IS NULL)
);
CREATE INDEX ix_user_social_account_user ON user_social_account (user_id);
CREATE TABLE service_policy (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_type         text        NOT NULL,
  body                text        NOT NULL,
  effective_at        timestamptz NOT NULL,
  requires_reconsent  boolean     NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_at >= created_at),
  UNIQUE (policy_type, effective_at)
);
CREATE FUNCTION block_change_of_evidence() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN
  RAISE EXCEPTION '% 는 증명 기록이라 수정하거나 삭제할 수 없다', TG_TABLE_NAME USING ERRCODE = 'integrity_constraint_violation';
END
$f$;
CREATE FUNCTION forbid_delete() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN
  RAISE EXCEPTION '%: 행은 지우지 않는다(끝남은 시각 칼럼으로 남긴다)', TG_TABLE_NAME USING ERRCODE = 'integrity_constraint_violation';
END
$f$;
CREATE FUNCTION force_created_at_now() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN
  NEW.created_at := now();
  RETURN NEW;
END
$f$;
CREATE TRIGGER trg_service_policy_created_at
  BEFORE INSERT ON service_policy
  FOR EACH ROW EXECUTE FUNCTION force_created_at_now();
CREATE TRIGGER trg_service_policy_no_update_delete
  BEFORE UPDATE OR DELETE ON service_policy
  FOR EACH ROW EXECUTE FUNCTION block_change_of_evidence();
CREATE TRIGGER trg_service_policy_no_truncate
  BEFORE TRUNCATE ON service_policy
  FOR EACH STATEMENT EXECUTE FUNCTION block_change_of_evidence();
CREATE TABLE user_consent (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid        NOT NULL REFERENCES users (id),
  service_policy_id  uuid        NOT NULL REFERENCES service_policy (id),
  consent_context    text        NOT NULL CHECK (consent_context IN ('SIGNUP', 'IN_SERVICE')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, service_policy_id)
);
CREATE TRIGGER trg_user_consent_created_at
  BEFORE INSERT ON user_consent
  FOR EACH ROW EXECUTE FUNCTION force_created_at_now();
CREATE TRIGGER trg_user_consent_no_update_delete
  BEFORE UPDATE OR DELETE ON user_consent
  FOR EACH ROW EXECUTE FUNCTION block_change_of_evidence();
CREATE TRIGGER trg_user_consent_no_truncate
  BEFORE TRUNCATE ON user_consent
  FOR EACH STATEMENT EXECUTE FUNCTION block_change_of_evidence();
CREATE TABLE user_termination (
  user_id         uuid        PRIMARY KEY REFERENCES users (id),
  reason_code     text        NOT NULL,
  user_message       text        NOT NULL,
  admin_note      text        NULL,
  terminated_at   timestamptz NOT NULL DEFAULT now(),
  terminated_by_user_id uuid  NOT NULL REFERENCES users (id),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION user_termination_guard() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.reason_code IS DISTINCT FROM OLD.reason_code
       OR NEW.user_message IS DISTINCT FROM OLD.user_message
       OR NEW.terminated_at IS DISTINCT FROM OLD.terminated_at
       OR NEW.terminated_by_user_id IS DISTINCT FROM OLD.terminated_by_user_id THEN
      RAISE EXCEPTION 'user_termination은 admin_note만 수정할 수 있다' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'user_termination은 삭제할 수 없다' USING ERRCODE = 'integrity_constraint_violation';
END
$f$;
CREATE FUNCTION force_terminated_at_now() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN
  NEW.terminated_at := now();
  RETURN NEW;
END
$f$;
CREATE TRIGGER trg_user_termination_terminated_at
  BEFORE INSERT ON user_termination
  FOR EACH ROW EXECUTE FUNCTION force_terminated_at_now();
CREATE TRIGGER trg_user_termination_guard
  BEFORE UPDATE OR DELETE ON user_termination
  FOR EACH ROW EXECUTE FUNCTION user_termination_guard();
CREATE TRIGGER trg_user_termination_no_truncate
  BEFORE TRUNCATE ON user_termination
  FOR EACH STATEMENT EXECUTE FUNCTION user_termination_guard();
CREATE TABLE user_admin_term (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL REFERENCES users (id),
  granted_by_user_id  uuid        NULL REFERENCES users (id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  revoked_at          timestamptz NULL,
  revoked_by_user_id  uuid        NULL REFERENCES users (id),
  CHECK ((revoked_at IS NULL) = (revoked_by_user_id IS NULL)),
  CHECK (revoked_at IS NULL OR revoked_at >= created_at),
  CHECK (granted_by_user_id IS DISTINCT FROM user_id)
);
CREATE UNIQUE INDEX ux_user_admin_term_current ON user_admin_term (user_id) WHERE revoked_at IS NULL;
CREATE FUNCTION user_admin_term_guard() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.revoked_at IS NOT NULL OR NEW.revoked_by_user_id IS NOT NULL THEN
      RAISE EXCEPTION 'user_admin_term은 해제되지 않은 임기로만 만든다' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    NEW.created_at := now();
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.revoked_at IS NULL
       AND NEW.revoked_at IS NOT NULL
       AND NEW.user_id = OLD.user_id
       AND NEW.granted_by_user_id IS NOT DISTINCT FROM OLD.granted_by_user_id
       AND NEW.created_at = OLD.created_at THEN
      NEW.revoked_at := now();
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'user_admin_term은 해제 기록만 추가할 수 있다' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RAISE EXCEPTION 'user_admin_term은 삭제할 수 없다' USING ERRCODE = 'integrity_constraint_violation';
END
$f$;
CREATE TRIGGER trg_user_admin_term_guard
  BEFORE INSERT OR UPDATE OR DELETE ON user_admin_term
  FOR EACH ROW EXECUTE FUNCTION user_admin_term_guard();
CREATE TRIGGER trg_user_admin_term_no_truncate
  BEFORE TRUNCATE ON user_admin_term
  FOR EACH STATEMENT EXECUTE FUNCTION user_admin_term_guard();
CREATE TRIGGER trg_users_no_delete BEFORE DELETE ON users FOR EACH ROW EXECUTE FUNCTION forbid_delete();
CREATE TRIGGER trg_users_no_truncate BEFORE TRUNCATE ON users FOR EACH STATEMENT EXECUTE FUNCTION forbid_delete();
CREATE TRIGGER trg_user_social_account_no_delete BEFORE DELETE ON user_social_account FOR EACH ROW EXECUTE FUNCTION forbid_delete();
CREATE TRIGGER trg_user_social_account_no_truncate BEFORE TRUNCATE ON user_social_account FOR EACH STATEMENT EXECUTE FUNCTION forbid_delete();
CREATE TABLE user_session (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES users (id),
  token_hash     text        NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  device_label   text        NULL CHECK (char_length(device_label) <= 200),
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_used_at   timestamptz NOT NULL DEFAULT now(),
  revoked_at     timestamptz NULL,
  CHECK (last_used_at >= created_at),
  CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);
CREATE INDEX ix_user_session_user ON user_session (user_id) WHERE revoked_at IS NULL;
CREATE FUNCTION user_session_guard() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.token_hash IS DISTINCT FROM OLD.token_hash
     OR NEW.created_at IS DISTINCT FROM OLD.created_at OR OLD.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'user_session: 끝난 로그인은 바꿀 수 없다. 쓴 시각과 끝낸 시각만 남긴다' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END
$f$;
CREATE TRIGGER trg_user_session_guard BEFORE UPDATE ON user_session FOR EACH ROW EXECUTE FUNCTION user_session_guard();
CREATE TRIGGER trg_user_session_no_delete BEFORE DELETE ON user_session FOR EACH ROW EXECUTE FUNCTION forbid_delete();
CREATE TRIGGER trg_user_session_no_truncate BEFORE TRUNCATE ON user_session FOR EACH STATEMENT EXECUTE FUNCTION forbid_delete();

CREATE TABLE user_friendship (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id          uuid        NOT NULL,
  user_id          uuid        NOT NULL REFERENCES users (id),
  friend_user_id   uuid        NOT NULL REFERENCES users (id),
  sent_by_me       boolean     NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  accepted_at      timestamptz NULL,
  ended_at         timestamptz NULL,
  CHECK (user_id <> friend_user_id),
  CHECK (accepted_at IS NULL OR accepted_at >= created_at),
  CHECK (ended_at IS NULL OR ended_at >= coalesce(accepted_at, created_at)),
  UNIQUE (pair_id, user_id)
);
CREATE UNIQUE INDEX ux_user_friendship_live ON user_friendship (user_id, friend_user_id) WHERE ended_at IS NULL;
CREATE FUNCTION user_friendship_guard() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.accepted_at IS NOT NULL OR NEW.ended_at IS NOT NULL THEN
      RAISE EXCEPTION 'user_friendship: 새 관계는 대기 중인 요청으로 만든다' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF EXISTS (SELECT 1 FROM user_block b WHERE b.ended_at IS NULL
               AND ((b.user_id = NEW.user_id AND b.blocked_user_id = NEW.friend_user_id)
                 OR (b.user_id = NEW.friend_user_id AND b.blocked_user_id = NEW.user_id))) THEN
      RAISE EXCEPTION 'user_friendship: 차단된 사이에는 친구 요청을 할 수 없다' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.pair_id IS DISTINCT FROM OLD.pair_id OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.friend_user_id IS DISTINCT FROM OLD.friend_user_id OR NEW.sent_by_me IS DISTINCT FROM OLD.sent_by_me
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'user_friendship: 누가 누구에게 언제 요청했는지는 바꿀 수 없다' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF OLD.accepted_at IS NOT NULL AND NEW.accepted_at IS DISTINCT FROM OLD.accepted_at THEN
    RAISE EXCEPTION 'user_friendship: 수락 기록은 바꿀 수 없다' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF OLD.ended_at IS NOT NULL AND (NEW.ended_at IS DISTINCT FROM OLD.ended_at OR NEW.accepted_at IS DISTINCT FROM OLD.accepted_at) THEN
    RAISE EXCEPTION 'user_friendship: 끝난 관계는 바꿀 수 없다. 다시 친구가 되려면 새로 요청한다' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END
$f$;
CREATE TRIGGER trg_user_friendship_guard
  BEFORE INSERT OR UPDATE ON user_friendship
  FOR EACH ROW EXECUTE FUNCTION user_friendship_guard();
CREATE FUNCTION user_friendship_pair_check() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_friendship m
                 WHERE m.pair_id = NEW.pair_id AND m.id <> NEW.id
                   AND m.user_id = NEW.friend_user_id AND m.friend_user_id = NEW.user_id
                   AND m.sent_by_me = NOT NEW.sent_by_me
                   AND m.created_at = NEW.created_at
                   AND m.accepted_at IS NOT DISTINCT FROM NEW.accepted_at
                   AND m.ended_at IS NOT DISTINCT FROM NEW.ended_at) THEN
    RAISE EXCEPTION 'user_friendship: 짝 행(상대→나)이 없거나 상태가 다르다' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NULL;
END
$f$;
CREATE CONSTRAINT TRIGGER trg_user_friendship_pair
  AFTER INSERT OR UPDATE ON user_friendship
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION user_friendship_pair_check();
CREATE TABLE user_block (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES users (id),
  blocked_user_id  uuid        NOT NULL REFERENCES users (id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  ended_at         timestamptz NULL,
  CHECK (user_id <> blocked_user_id),
  CHECK (ended_at IS NULL OR ended_at >= created_at)
);
CREATE UNIQUE INDEX ux_user_block_live ON user_block (user_id, blocked_user_id) WHERE ended_at IS NULL;
CREATE INDEX ix_user_block_blocked ON user_block (blocked_user_id) WHERE ended_at IS NULL;
CREATE FUNCTION user_block_guard() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.ended_at IS NOT NULL THEN
      RAISE EXCEPTION 'user_block: 새 차단은 풀린 상태로 만들 수 없다' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF EXISTS (SELECT 1 FROM user_friendship f WHERE f.ended_at IS NULL
               AND f.user_id = NEW.user_id AND f.friend_user_id = NEW.blocked_user_id) THEN
      RAISE EXCEPTION 'user_block: 살아 있는 친구·요청을 먼저 끝낸다' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.blocked_user_id IS DISTINCT FROM OLD.blocked_user_id OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR OLD.ended_at IS NOT NULL THEN
    RAISE EXCEPTION 'user_block: 차단을 푸는 기록(ended_at)만 한 번 남길 수 있다' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END
$f$;
CREATE TRIGGER trg_user_block_guard
  BEFORE INSERT OR UPDATE ON user_block
  FOR EACH ROW EXECUTE FUNCTION user_block_guard();
CREATE TRIGGER trg_user_friendship_no_delete BEFORE DELETE ON user_friendship FOR EACH ROW EXECUTE FUNCTION forbid_delete();
CREATE TRIGGER trg_user_friendship_no_truncate BEFORE TRUNCATE ON user_friendship FOR EACH STATEMENT EXECUTE FUNCTION forbid_delete();
CREATE TRIGGER trg_user_block_no_delete BEFORE DELETE ON user_block FOR EACH ROW EXECUTE FUNCTION forbid_delete();
CREATE TRIGGER trg_user_block_no_truncate BEFORE TRUNCATE ON user_block FOR EACH STATEMENT EXECUTE FUNCTION forbid_delete();
CREATE TABLE user_friend_link (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES users (id),
  token_hash  text        NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NULL,
  CHECK (expires_at IS NULL OR expires_at >= created_at)
);
CREATE UNIQUE INDEX ux_user_friend_link_live ON user_friend_link (user_id) WHERE expires_at IS NULL;
CREATE FUNCTION user_friend_link_guard() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.token_hash IS DISTINCT FROM OLD.token_hash
     OR NEW.created_at IS DISTINCT FROM OLD.created_at OR OLD.expires_at IS NOT NULL THEN
    RAISE EXCEPTION 'user_friend_link: 끄는 기록(expires_at)만 한 번 남길 수 있다' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END
$f$;
CREATE TRIGGER trg_user_friend_link_guard BEFORE UPDATE ON user_friend_link FOR EACH ROW EXECUTE FUNCTION user_friend_link_guard();
CREATE TRIGGER trg_user_friend_link_no_delete BEFORE DELETE ON user_friend_link FOR EACH ROW EXECUTE FUNCTION forbid_delete();
CREATE TRIGGER trg_user_friend_link_no_truncate BEFORE TRUNCATE ON user_friend_link FOR EACH STATEMENT EXECUTE FUNCTION forbid_delete();

CREATE TABLE workspace (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 20),
  closed_at   timestamptz NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE workspace_member (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       uuid        NOT NULL REFERENCES workspace (id),
  user_id            uuid        NOT NULL REFERENCES users (id),
  role               text        NOT NULL CHECK (role IN ('MANAGER', 'MEMBER')),
  status             text        NOT NULL CHECK (status IN ('ACTIVE', 'LEFT', 'REMOVED')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id),
  UNIQUE (workspace_id, id),
  CHECK (role <> 'MANAGER' OR status = 'ACTIVE')
);
CREATE UNIQUE INDEX ux_workspace_one_manager
  ON workspace_member (workspace_id)
  WHERE role = 'MANAGER';
CREATE TRIGGER trg_workspace_no_delete BEFORE DELETE ON workspace FOR EACH ROW EXECUTE FUNCTION forbid_delete();
CREATE TRIGGER trg_workspace_no_truncate BEFORE TRUNCATE ON workspace FOR EACH STATEMENT EXECUTE FUNCTION forbid_delete();
CREATE TRIGGER trg_workspace_member_no_delete BEFORE DELETE ON workspace_member FOR EACH ROW EXECUTE FUNCTION forbid_delete();
CREATE TRIGGER trg_workspace_member_no_truncate BEFORE TRUNCATE ON workspace_member FOR EACH STATEMENT EXECUTE FUNCTION forbid_delete();

CREATE TABLE workspace_invite (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         uuid        NOT NULL REFERENCES workspace (id),
  recipient_email      text        NOT NULL CHECK (char_length(recipient_email) <= 320),
  code_hash            text        NOT NULL CHECK (code_hash ~ '^[0-9a-f]{64}$'),
  expires_at           timestamptz NOT NULL,
  accepted_by_user_id  uuid        NULL REFERENCES users (id),
  failed_attempts      smallint    NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  created_at           timestamptz NOT NULL DEFAULT now(),
  CHECK (recipient_email = lower(btrim(recipient_email))),
  CHECK (expires_at <= created_at + interval '7 days')
);
CREATE INDEX ix_workspace_invite_recipient ON workspace_invite (workspace_id, recipient_email, expires_at);
CREATE INDEX ix_workspace_invite_code ON workspace_invite (code_hash);
CREATE TABLE workspace_public_link (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid        NOT NULL REFERENCES workspace (id),
  token_hash    text        NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at    timestamptz NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at IS NULL OR expires_at >= created_at)
);
CREATE UNIQUE INDEX ux_workspace_public_link_live ON workspace_public_link (workspace_id) WHERE expires_at IS NULL;
CREATE FUNCTION workspace_invite_guard() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.accepted_by_user_id IS NOT NULL OR NEW.failed_attempts <> 0 THEN
      RAISE EXCEPTION 'workspace_invite: 새 초대는 들어온 사람·틀린 횟수 없이 만든다' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
     OR NEW.recipient_email IS DISTINCT FROM OLD.recipient_email OR NEW.code_hash IS DISTINCT FROM OLD.code_hash
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'workspace_invite: 주소·코드는 바꿀 수 없다. 만료시키고 새로 보낸다' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF NEW.expires_at > OLD.expires_at THEN
    RAISE EXCEPTION 'workspace_invite: 만료를 늦출 수 없다. 다시 보낸다' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF OLD.accepted_by_user_id IS NOT NULL AND NEW.accepted_by_user_id IS DISTINCT FROM OLD.accepted_by_user_id THEN
    RAISE EXCEPTION 'workspace_invite: 들어온 사람 기록은 바꿀 수 없다' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF NEW.accepted_by_user_id IS NOT NULL AND NEW.expires_at > now() THEN
    RAISE EXCEPTION 'workspace_invite: 들어오면 같은 트랜잭션에서 만료시킨다' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF NEW.failed_attempts < OLD.failed_attempts THEN
    RAISE EXCEPTION 'workspace_invite: 틀린 횟수는 줄일 수 없다' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END
$f$;
CREATE TRIGGER trg_workspace_invite_guard
  BEFORE INSERT OR UPDATE ON workspace_invite
  FOR EACH ROW EXECUTE FUNCTION workspace_invite_guard();
CREATE FUNCTION workspace_public_link_guard() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
     OR NEW.token_hash IS DISTINCT FROM OLD.token_hash OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR OLD.expires_at IS NOT NULL THEN
    RAISE EXCEPTION 'workspace_public_link: 끄는 기록(expires_at)만 한 번 남길 수 있다. 다시 켜려면 새 링크를 만든다' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END
$f$;
CREATE TRIGGER trg_workspace_public_link_guard
  BEFORE UPDATE ON workspace_public_link
  FOR EACH ROW EXECUTE FUNCTION workspace_public_link_guard();
CREATE TRIGGER trg_workspace_invite_no_delete BEFORE DELETE ON workspace_invite FOR EACH ROW EXECUTE FUNCTION forbid_delete();
CREATE TRIGGER trg_workspace_invite_no_truncate BEFORE TRUNCATE ON workspace_invite FOR EACH STATEMENT EXECUTE FUNCTION forbid_delete();
CREATE TRIGGER trg_workspace_public_link_no_delete BEFORE DELETE ON workspace_public_link FOR EACH ROW EXECUTE FUNCTION forbid_delete();
CREATE TRIGGER trg_workspace_public_link_no_truncate BEFORE TRUNCATE ON workspace_public_link FOR EACH STATEMENT EXECUTE FUNCTION forbid_delete();
CREATE TABLE workspace_user_invite (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       uuid        NOT NULL REFERENCES workspace (id),
  recipient_user_id  uuid        NOT NULL REFERENCES users (id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  expires_at         timestamptz NOT NULL,
  accepted_at        timestamptz NULL,
  declined_at        timestamptz NULL,
  CHECK (expires_at <= created_at + interval '7 days'),
  CHECK (accepted_at IS NULL OR declined_at IS NULL)
);
CREATE INDEX ix_workspace_user_invite_ws ON workspace_user_invite (workspace_id, recipient_user_id, expires_at);
CREATE INDEX ix_workspace_user_invite_recipient ON workspace_user_invite (recipient_user_id, expires_at);
CREATE FUNCTION workspace_user_invite_guard() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.accepted_at IS NOT NULL OR NEW.declined_at IS NOT NULL THEN
      RAISE EXCEPTION 'workspace_user_invite: 새 초대는 답 없이 만든다' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
     OR NEW.recipient_user_id IS DISTINCT FROM OLD.recipient_user_id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'workspace_user_invite: 공간·받는 사람은 바꿀 수 없다. 만료시키고 새로 보낸다' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF NEW.expires_at > OLD.expires_at THEN
    RAISE EXCEPTION 'workspace_user_invite: 만료를 늦출 수 없다. 다시 보낸다' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF (OLD.accepted_at IS NOT NULL OR OLD.declined_at IS NOT NULL)
     AND (NEW.accepted_at IS DISTINCT FROM OLD.accepted_at OR NEW.declined_at IS DISTINCT FROM OLD.declined_at) THEN
    RAISE EXCEPTION 'workspace_user_invite: 답은 한 번만 남긴다' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF OLD.accepted_at IS NULL AND OLD.declined_at IS NULL AND (NEW.accepted_at IS NOT NULL OR NEW.declined_at IS NOT NULL) THEN
    IF OLD.expires_at <= now() THEN
      RAISE EXCEPTION 'workspace_user_invite: 만료된 초대에는 답할 수 없다' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF NEW.expires_at > now() THEN
      RAISE EXCEPTION 'workspace_user_invite: 답하면 같은 트랜잭션에서 만료시킨다' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
  END IF;
  RETURN NEW;
END
$f$;
CREATE TRIGGER trg_workspace_user_invite_guard
  BEFORE INSERT OR UPDATE ON workspace_user_invite
  FOR EACH ROW EXECUTE FUNCTION workspace_user_invite_guard();
CREATE TRIGGER trg_workspace_user_invite_no_delete BEFORE DELETE ON workspace_user_invite FOR EACH ROW EXECUTE FUNCTION forbid_delete();
CREATE TRIGGER trg_workspace_user_invite_no_truncate BEFORE TRUNCATE ON workspace_user_invite FOR EACH STATEMENT EXECUTE FUNCTION forbid_delete();

CREATE TABLE workspace_group (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid        NOT NULL REFERENCES workspace (id),
  name             text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz NULL,
  UNIQUE (workspace_id, id)
);
CREATE UNIQUE INDEX ux_workspace_group_name ON workspace_group (workspace_id, normalize_name(name)) WHERE deleted_at IS NULL;
CREATE TABLE workspace_group_member (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid        NOT NULL,
  group_id            uuid        NOT NULL,
  member_id           uuid        NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  removed_at          timestamptz NULL,
  FOREIGN KEY (workspace_id, group_id)  REFERENCES workspace_group (workspace_id, id),
  FOREIGN KEY (workspace_id, member_id) REFERENCES workspace_member (workspace_id, id),
  CHECK (removed_at IS NULL OR removed_at >= created_at)
);
CREATE UNIQUE INDEX ux_group_member_live ON workspace_group_member (group_id, member_id) WHERE removed_at IS NULL;
CREATE FUNCTION group_member_guard() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id OR NEW.group_id IS DISTINCT FROM OLD.group_id
     OR NEW.member_id IS DISTINCT FROM OLD.member_id OR NEW.created_at IS DISTINCT FROM OLD.created_at OR OLD.removed_at IS NOT NULL THEN
    RAISE EXCEPTION 'workspace_group_member: 빠진 기록(removed_at)만 한 번 남길 수 있다. 다시 들어오면 새 행' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END
$f$;
CREATE TRIGGER trg_group_member_guard BEFORE UPDATE ON workspace_group_member FOR EACH ROW EXECUTE FUNCTION group_member_guard();
CREATE TRIGGER trg_workspace_group_no_delete BEFORE DELETE ON workspace_group FOR EACH ROW EXECUTE FUNCTION forbid_delete();
CREATE TRIGGER trg_workspace_group_no_truncate BEFORE TRUNCATE ON workspace_group FOR EACH STATEMENT EXECUTE FUNCTION forbid_delete();
CREATE TRIGGER trg_group_member_no_delete BEFORE DELETE ON workspace_group_member FOR EACH ROW EXECUTE FUNCTION forbid_delete();
CREATE TRIGGER trg_group_member_no_truncate BEFORE TRUNCATE ON workspace_group_member FOR EACH STATEMENT EXECUTE FUNCTION forbid_delete();

CREATE TABLE user_notification (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id  uuid        NOT NULL REFERENCES users (id),
  notification_type  text        NOT NULL CHECK (notification_type ~ '^[A-Z_]{1,100}$'),
  actor_user_id      uuid        NULL REFERENCES users (id),
  target_type        text        NULL CHECK (char_length(target_type) <= 50),
  target_id          uuid        NULL,
  display_text       text        NOT NULL CHECK (char_length(display_text) BETWEEN 1 AND 500),
  created_at         timestamptz NOT NULL DEFAULT now(),
  read_at            timestamptz NULL,
  CHECK ((target_type IS NULL) = (target_id IS NULL)),
  CHECK (read_at IS NULL OR read_at >= created_at)
);
CREATE INDEX ix_user_notification_recipient ON user_notification (recipient_user_id, created_at);
CREATE FUNCTION user_notification_guard() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.recipient_user_id IS DISTINCT FROM OLD.recipient_user_id
     OR NEW.notification_type IS DISTINCT FROM OLD.notification_type OR NEW.actor_user_id IS DISTINCT FROM OLD.actor_user_id
     OR NEW.target_type IS DISTINCT FROM OLD.target_type OR NEW.target_id IS DISTINCT FROM OLD.target_id
     OR NEW.display_text IS DISTINCT FROM OLD.display_text OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR OLD.read_at IS NOT NULL THEN
    RAISE EXCEPTION 'user_notification: 읽은 시각만 한 번 남길 수 있다' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END
$f$;
CREATE TRIGGER trg_user_notification_guard BEFORE UPDATE ON user_notification FOR EACH ROW EXECUTE FUNCTION user_notification_guard();
CREATE TRIGGER trg_user_notification_no_delete BEFORE DELETE ON user_notification FOR EACH ROW EXECUTE FUNCTION forbid_delete();
CREATE TRIGGER trg_user_notification_no_truncate BEFORE TRUNCATE ON user_notification FOR EACH STATEMENT EXECUTE FUNCTION forbid_delete();

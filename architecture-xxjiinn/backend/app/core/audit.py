from __future__ import annotations

import hashlib
import hmac
from dataclasses import dataclass

from app.core.config import settings
from app.core.security import now_utc
from app.domains.audit.repository import AuthAuditLogRecord, AuthAuditLogRepository


def _hmac_optional(value: str | None) -> str | None:
    if not value:
        return None
    return hmac.new(
        settings.access_token_secret.encode("utf-8"),
        value.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


@dataclass
class AuthAuditLogger:
    repository: AuthAuditLogRepository

    def log(
        self,
        *,
        event_type: str,
        result: str,
        user_id: str | None = None,
        email: str | None = None,
        client_ip: str | None = None,
        user_agent: str | None = None,
        reason: str | None = None,
    ) -> None:
        record = AuthAuditLogRecord(
            id=self.repository.next_id(),
            event_type=event_type,
            result=result,
            user_id=user_id,
            email_hash=_hmac_optional(email),
            client_ip_hash=_hmac_optional(client_ip),
            user_agent_hash=_hmac_optional(user_agent),
            reason=reason,
            created_at=now_utc(),
        )
        self.repository.add(record)

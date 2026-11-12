from __future__ import annotations

import sys
from datetime import datetime, timezone

from worship_support.api.infrastructure.mail.common.client import Mail


# #
# console

class Console(Mail):
    def __init__(self):
        self._sent: list[dict] = []

    def send(self, *, to: str, subject: str, body: str) -> None:
        self._sent.append(
            {
                "to": to,
                "subject": subject,
                "body": body,
                "sent_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        del self._sent[:-50]
        print(f"[mail] to={to} subject={subject} body={body}", file=sys.stderr)

    def search(self) -> list[dict]:
        return list(reversed(self._sent))


# #
# client

mail = Console()

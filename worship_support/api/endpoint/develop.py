from __future__ import annotations

from worship_support.api.infrastructure.mail.console.client import mail


# #
# query

def get_mail() -> dict:
    return {"data": mail.search(), "event": []}

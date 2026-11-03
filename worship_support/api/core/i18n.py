from __future__ import annotations

from enum import StrEnum


# #
# locale

class Locale(StrEnum):
    KO = "ko"
    EN = "en"


# #
# catalog

_CATALOG = {
    "work_failed": {
        Locale.KO: "work 처리 실패 (작업: {channel}, 원인: {reason})",
        Locale.EN: "work processing failed (operation: {channel}, reason: {reason})",
    },
    "listen_error": {
        Locale.KO: "LISTEN 실패 (작업: {operation}, 원인: {reason})",
        Locale.EN: "LISTEN failed (operation: {operation}, reason: {reason})",
    },
}


# #
# render

DEFAULT = Locale.KO

def render(*, key: str, params: dict, locale: Locale) -> str:
    templates = _CATALOG[key]
    template = templates.get(locale) or templates[DEFAULT]
    return template.format(**params)

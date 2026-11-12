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
    "database_error": {
        Locale.KO: "DB 실패 (작업: {operation}, 원인: {reason})",
        Locale.EN: "database failed (operation: {operation}, reason: {reason})",
    },
    "unique_violation": {
        Locale.KO: "이미 존재합니다 (식별자: {identifier})",
        Locale.EN: "already exists (identifier: {identifier})",
    },
    "invalid": {
        Locale.KO: "{target} 타입이 올바르지 않습니다",
        Locale.EN: "{target} has an invalid type",
    },
    "invalid_format": {
        Locale.KO: "{target} 형식이 올바르지 않습니다",
        Locale.EN: "{target} has an invalid format",
    },
    "not_found": {
        Locale.KO: "{target} 찾을 수 없습니다 (식별자: {identifier})",
        Locale.EN: "{target} not found (identifier: {identifier})",
    },
    "already_exists": {
        Locale.KO: "{target} 이미 존재합니다 (식별자: {identifier})",
        Locale.EN: "{target} already exists (identifier: {identifier})",
    },
    "unauthorized": {
        Locale.KO: "로그인이 필요합니다",
        Locale.EN: "login required",
    },
    "forbidden": {
        Locale.KO: "권한이 없습니다 (작업: {action})",
        Locale.EN: "permission denied (operation: {action})",
    },
    "workspace_name_taken": {
        Locale.KO: "같은 이름의 공간에 이미 참여하고 있습니다",
        Locale.EN: "you are already in a space with the same name",
    },
    "workspace_name_mismatch": {
        Locale.KO: "공간 이름이 맞지 않습니다",
        Locale.EN: "the space name does not match",
    },
    "workspace_closed": {
        Locale.KO: "종료된 공간입니다",
        Locale.EN: "the space is closed",
    },
    "already_member": {
        Locale.KO: "이미 참여한 공간입니다",
        Locale.EN: "you are already in this space",
    },
    "code_mismatch": {
        Locale.KO: "코드가 맞지 않습니다",
        Locale.EN: "the code does not match",
    },
    "link_unusable": {
        Locale.KO: "쓸 수 없는 링크입니다",
        Locale.EN: "the link can no longer be used",
    },
    "removed_member": {
        Locale.KO: "관리자에게 초대를 받아야 합니다",
        Locale.EN: "you need an invitation from the manager",
    },
    "invite_closed": {
        Locale.KO: "이미 답했거나 기한이 지난 초대입니다",
        Locale.EN: "the invitation was already answered or has expired",
    },
    "manager_must_transfer": {
        Locale.KO: "관리자는 먼저 관리자를 넘겨야 합니다",
        Locale.EN: "the manager must hand over the role first",
    },
    "member_not_active": {
        Locale.KO: "지금 공간에 있는 구성원이 아닙니다",
        Locale.EN: "the person is not an active member",
    },
    "not_friend": {
        Locale.KO: "친구에게만 초대를 보낼 수 있습니다",
        Locale.EN: "you can invite only your friends",
    },
    "blocked": {
        Locale.KO: "친구 요청을 보낼 수 없는 사람입니다",
        Locale.EN: "you cannot send a request to this person",
    },
    "friend_self": {
        Locale.KO: "나에게는 친구 요청을 보낼 수 없습니다",
        Locale.EN: "you cannot befriend yourself",
    },
    "friend_unreachable": {
        Locale.KO: "같은 공간에 있거나 친구 링크로 온 사람에게만 요청할 수 있습니다",
        Locale.EN: "you can send a request only to people in your spaces or via a friend link",
    },
    "friend_exists": {
        Locale.KO: "이미 친구이거나 요청을 보냈습니다",
        Locale.EN: "already friends or a request is pending",
    },
    "friend_request_closed": {
        Locale.KO: "이미 처리된 친구 요청입니다",
        Locale.EN: "the friend request was already handled",
    },
    "friend_quota": {
        Locale.KO: "친구 요청을 너무 많이 보냈습니다 (허용: {limit})",
        Locale.EN: "too many friend requests (allowed: {limit})",
    },
    "document_name_taken": {
        Locale.KO: "같은 이름의 문서가 있습니다",
        Locale.EN: "a document with the same name exists",
    },
    "group_name_taken": {
        Locale.KO: "같은 이름의 그룹이 있습니다",
        Locale.EN: "a group with the same name exists",
    },
}


# #
# render

DEFAULT = Locale.KO

def render(*, key: str, params: dict, locale: Locale) -> str:
    templates = _CATALOG[key]
    template = templates.get(locale) or templates[DEFAULT]
    return template.format(**params)

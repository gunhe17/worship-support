from __future__ import annotations

from dataclasses import dataclass, replace
from uuid import UUID

from worship_support.api.core.entity import Entity as CoreEntity
from worship_support.api.core.validate import typecheck
from worship_support.api.domain.common.moment import Moment
from worship_support.api.domain.notification.display_text import DisplayText
from worship_support.api.domain.notification.kind import Kind
from worship_support.api.domain.notification.target_type import TargetType


# #
# entity

@dataclass(frozen=True, kw_only=True)
class Notification(CoreEntity):
    recipient_user_id: UUID
    kind: Kind
    actor_user_id: UUID | None
    target_type: TargetType | None
    target_id: UUID | None
    display_text: DisplayText
    read_at: Moment | None = None

    @classmethod
    @typecheck
    def new(
        cls,
        *,
        recipient_user_id: UUID,
        kind: Kind,
        actor_user_id: UUID | None,
        target_type: TargetType | None,
        target_id: UUID | None,
        display_text: DisplayText,
    ) -> "Notification":
        return cls(
            recipient_user_id=recipient_user_id,
            kind=kind,
            actor_user_id=actor_user_id,
            target_type=target_type,
            target_id=target_id,
            display_text=display_text,
            by_factory=True,
        )

    # #
    # template

    @classmethod
    @typecheck
    def friend_request(cls, *, recipient_user_id: UUID, actor_user_id: UUID, actor_name: str, pair_id: UUID) -> "Notification":
        return cls._of(recipient_user_id, "FRIEND_REQUEST", actor_user_id, "user_friendship", pair_id, f"{actor_name}님이 친구 요청을 보냈어요")

    @classmethod
    @typecheck
    def friend_accepted(cls, *, recipient_user_id: UUID, actor_user_id: UUID, actor_name: str, pair_id: UUID) -> "Notification":
        return cls._of(recipient_user_id, "FRIEND_ACCEPTED", actor_user_id, "user_friendship", pair_id, f"{actor_name}님이 친구 요청을 수락했어요")

    @classmethod
    @typecheck
    def workspace_invite(cls, *, recipient_user_id: UUID, actor_user_id: UUID, actor_name: str, workspace_name: str, invite_id: UUID) -> "Notification":
        return cls._of(recipient_user_id, "WORKSPACE_INVITE", actor_user_id, "workspace_user_invite", invite_id, f"{actor_name}님이 {workspace_name} 공간에 초대했어요")

    @classmethod
    @typecheck
    def workspace_invite_declined(cls, *, recipient_user_id: UUID, actor_user_id: UUID, actor_name: str, workspace_name: str, invite_id: UUID) -> "Notification":
        return cls._of(recipient_user_id, "WORKSPACE_INVITE_DECLINED", actor_user_id, "workspace_user_invite", invite_id, f"{actor_name}님이 {workspace_name} 공간 초대를 거절했어요")

    @classmethod
    @typecheck
    def member_joined(cls, *, recipient_user_id: UUID, actor_user_id: UUID, actor_name: str, workspace_name: str, member_id: UUID) -> "Notification":
        return cls._of(recipient_user_id, "MEMBER_JOINED", actor_user_id, "workspace_member", member_id, f"{actor_name}님이 {workspace_name} 공간에 들어왔어요")

    @classmethod
    @typecheck
    def member_returned(cls, *, recipient_user_id: UUID, actor_user_id: UUID, actor_name: str, workspace_name: str, member_id: UUID) -> "Notification":
        return cls._of(recipient_user_id, "MEMBER_RETURNED", actor_user_id, "workspace_member", member_id, f"{actor_name}님이 {workspace_name} 공간에 다시 들어왔어요")

    @classmethod
    @typecheck
    def member_left(cls, *, recipient_user_id: UUID, actor_user_id: UUID, actor_name: str, workspace_name: str, member_id: UUID) -> "Notification":
        return cls._of(recipient_user_id, "MEMBER_LEFT", actor_user_id, "workspace_member", member_id, f"{actor_name}님이 {workspace_name} 공간에서 나갔어요")

    @classmethod
    @typecheck
    def member_removed(cls, *, recipient_user_id: UUID, workspace_name: str, workspace_id: UUID) -> "Notification":
        return cls._of(recipient_user_id, "MEMBER_REMOVED", None, "workspace", workspace_id, f"{workspace_name} 공간에서 제외되었어요")

    @classmethod
    @typecheck
    def manager_transferred(cls, *, recipient_user_id: UUID, actor_user_id: UUID, actor_name: str, workspace_name: str, workspace_id: UUID) -> "Notification":
        return cls._of(recipient_user_id, "MANAGER_TRANSFERRED", actor_user_id, "workspace", workspace_id, f"{actor_name}님이 {workspace_name} 공간의 관리자를 넘겨 주었어요")

    @classmethod
    @typecheck
    def workspace_closed(cls, *, recipient_user_id: UUID, workspace_name: str, workspace_id: UUID) -> "Notification":
        return cls._of(recipient_user_id, "WORKSPACE_CLOSED", None, "workspace", workspace_id, f"{workspace_name} 공간이 삭제되었어요")

    @classmethod
    def _of(cls, recipient_user_id, kind, actor_user_id, target_type, target_id, text) -> "Notification":
        return cls.new(
            recipient_user_id=recipient_user_id,
            kind=Kind.from_str(kind),
            actor_user_id=actor_user_id,
            target_type=TargetType.from_str(target_type),
            target_id=target_id,
            display_text=DisplayText.from_str(text[:500]),
        )

    def read(self, *, at: Moment) -> "Notification":
        return replace(self, by_factory=True, read_at=at)

    def to_dict(self):
        return {
            "id": str(self.id),
            "kind": self.kind.to_str(),
            "actor_user_id": (
                str(self.actor_user_id) if self.actor_user_id else None
            ),
            "target_type": (
                self.target_type.to_str() if self.target_type else None
            ),
            "target_id": (
                str(self.target_id) if self.target_id else None
            ),
            "text": self.display_text.to_str(),
            "created_at": (
                self.created_at.isoformat() if self.created_at else None
            ),
            "read": self.read_at is not None,
        }

    def to_model(self):
        return {
            "id": self.id,
            "recipient_user_id": self.recipient_user_id,
            "notification_type": self.kind.to_str(),
            "actor_user_id": self.actor_user_id,
            "target_type": (
                self.target_type.to_str() if self.target_type else None
            ),
            "target_id": self.target_id,
            "display_text": self.display_text.to_str(),
            "read_at": (
                self.read_at.to_datetime() if self.read_at else None
            ),
        }

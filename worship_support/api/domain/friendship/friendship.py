from __future__ import annotations

from dataclasses import dataclass, replace
from uuid import UUID, uuid4

from worship_support.api.core.entity import Entity as CoreEntity
from worship_support.api.core.validate import typecheck
from worship_support.api.domain.common.moment import Moment
from worship_support.api.domain.friendship.sent_by_me import SentByMe


# #
# entity

@dataclass(frozen=True, kw_only=True)
class Friendship(CoreEntity):
    pair_id: UUID
    user_id: UUID
    friend_user_id: UUID
    sent_by_me: SentByMe
    accepted_at: Moment | None = None
    ended_at: Moment | None = None

    @classmethod
    @typecheck
    def new_pair(cls, *, requester_user_id: UUID, recipient_user_id: UUID) -> tuple["Friendship", "Friendship"]:
        pair_id = uuid4()
        sent = cls(
            pair_id=pair_id,
            user_id=requester_user_id,
            friend_user_id=recipient_user_id,
            sent_by_me=SentByMe.from_bool(True),
            by_factory=True,
        )
        received = cls(
            pair_id=pair_id,
            user_id=recipient_user_id,
            friend_user_id=requester_user_id,
            sent_by_me=SentByMe.from_bool(False),
            by_factory=True,
        )
        return sent, received

    def is_friend(self) -> bool:
        return self.accepted_at is not None and self.ended_at is None

    def is_received_request(self) -> bool:
        return self.accepted_at is None and self.ended_at is None and not self.sent_by_me.to_bool()

    def is_sent_request(self) -> bool:
        return self.accepted_at is None and self.ended_at is None and self.sent_by_me.to_bool()

    def accept(self, *, at: Moment) -> "Friendship":
        return replace(self, by_factory=True, accepted_at=at)

    def end(self, *, at: Moment) -> "Friendship":
        return replace(self, by_factory=True, ended_at=at)

    def state(self) -> str:
        if self.ended_at is not None:
            return "ended"
        if self.accepted_at is not None:
            return "friend"
        return "sent" if self.sent_by_me.to_bool() else "received"

    def to_dict(self):
        return {
            "pair_id": str(self.pair_id),
            "user_id": str(self.friend_user_id),
            "state": self.state(),
            "requested_at": (
                self.created_at.isoformat() if self.created_at else None
            ),
            "accepted_at": (
                self.accepted_at.to_str() if self.accepted_at else None
            ),
        }

    def to_model(self):
        return {
            "id": self.id,
            "pair_id": self.pair_id,
            "user_id": self.user_id,
            "friend_user_id": self.friend_user_id,
            "sent_by_me": self.sent_by_me.to_bool(),
            "accepted_at": (
                self.accepted_at.to_datetime() if self.accepted_at else None
            ),
            "ended_at": (
                self.ended_at.to_datetime() if self.ended_at else None
            ),
        }

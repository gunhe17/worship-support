from enum import Enum


class MembershipRole(str, Enum):
    OWNER = "owner"
    ADMIN = "admin"
    EDITOR = "editor"
    VIEWER = "viewer"


class MembershipStatus(str, Enum):
    ACTIVE = "active"
    LEFT = "left"
    REMOVED = "removed"

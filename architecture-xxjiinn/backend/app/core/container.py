from __future__ import annotations

from app.core.audit import AuthAuditLogger
from app.core.database import database
from app.core.security import OpaqueRefreshTokenService, PBKDF2PasswordHasher, SignedTokenService
from app.domains.audit.repository import SQLiteAuthAuditLogRepository
from app.domains.auth.repository import SQLiteRefreshTokenRepository
from app.domains.project.repository import SQLiteProjectRepository
from app.domains.user.repository import SQLiteUserRepository
from app.domains.workspace.repository import (
    SQLiteMembershipRepository,
    SQLiteWorkspaceInviteRepository,
    SQLiteWorkspaceRepository,
)

database.initialize()

user_repository = SQLiteUserRepository(database)
refresh_token_repository = SQLiteRefreshTokenRepository(database)
auth_audit_log_repository = SQLiteAuthAuditLogRepository(database)
workspace_repository = SQLiteWorkspaceRepository(database)
membership_repository = SQLiteMembershipRepository(database)
workspace_invite_repository = SQLiteWorkspaceInviteRepository(database)
project_repository = SQLiteProjectRepository(database)
password_hasher = PBKDF2PasswordHasher()
token_service = SignedTokenService()
refresh_token_service = OpaqueRefreshTokenService()
auth_audit_logger = AuthAuditLogger(auth_audit_log_repository)

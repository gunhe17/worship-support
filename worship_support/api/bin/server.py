from worship_support.api.config import is_develop
from worship_support.api.config import get_server_config
from worship_support.api.server.server import worship_support_api
from worship_support.api.server import middleware
from worship_support.api.server.router import Router
from worship_support.api.endpoint import account
from worship_support.api.endpoint import auth
from worship_support.api.endpoint import develop
from worship_support.api.endpoint import friend
from worship_support.api.endpoint import invite
from worship_support.api.endpoint import join
from worship_support.api.endpoint import notification
from worship_support.api.endpoint import system
from worship_support.api.endpoint import workspace
from worship_support.api.server import exception


# #
# server

server = worship_support_api()

# middleware
server.middleware(middleware.cors(get_server_config().CORS_ORIGINS))
server.middleware(middleware.proxy_headers())

# #
# router

# system
server.router(
    Router(path="/api/system/health", methods=["GET"], endpoint=system.health)
)


# worship
server.router(
    Router(path="/api/auth/logout", methods=["POST"], endpoint=auth.post_logout)
)
server.router(
    Router(path="/api/account/me", methods=["GET"], endpoint=account.get_me)
)
server.router(
    Router(path="/api/account/me", methods=["PATCH"], endpoint=account.patch_me)
)
server.router(
    Router(path="/api/account/sessions", methods=["GET"], endpoint=account.get_sessions)
)
server.router(
    Router(path="/api/account/sessions/revoke", methods=["POST"], endpoint=account.post_revoke_session)
)
server.router(
    Router(path="/api/account/withdraw", methods=["POST"], endpoint=account.post_withdraw)
)
server.router(
    Router(path="/api/workspaces", methods=["GET"], endpoint=workspace.get_search)
)
server.router(
    Router(path="/api/workspaces", methods=["POST"], endpoint=workspace.post_create)
)
server.router(
    Router(path="/api/workspaces/{workspace_id}", methods=["GET"], endpoint=workspace.get_one)
)
server.router(
    Router(path="/api/workspaces/{workspace_id}", methods=["PATCH"], endpoint=workspace.patch_one)
)
server.router(
    Router(path="/api/workspaces/{workspace_id}/close", methods=["POST"], endpoint=workspace.post_close)
)
server.router(
    Router(path="/api/workspaces/{workspace_id}/transfer", methods=["POST"], endpoint=workspace.post_transfer)
)
server.router(
    Router(path="/api/workspaces/{workspace_id}/leave", methods=["POST"], endpoint=workspace.post_leave)
)
server.router(
    Router(path="/api/workspaces/{workspace_id}/members", methods=["GET"], endpoint=workspace.get_members)
)
server.router(
    Router(path="/api/workspaces/{workspace_id}/members/remove", methods=["POST"], endpoint=workspace.post_remove_member)
)
server.router(
    Router(path="/api/workspaces/{workspace_id}/groups", methods=["GET"], endpoint=workspace.get_groups)
)
server.router(
    Router(path="/api/workspaces/{workspace_id}/documents", methods=["GET"], endpoint=workspace.get_documents)
)
server.router(
    Router(path="/api/workspaces/{workspace_id}/documents", methods=["POST"], endpoint=workspace.post_document)
)
server.router(
    Router(path="/api/workspaces/{workspace_id}/groups", methods=["POST"], endpoint=workspace.post_group)
)
server.router(
    Router(path="/api/workspaces/{workspace_id}/invites", methods=["GET"], endpoint=invite.get_search)
)
server.router(
    Router(path="/api/workspaces/{workspace_id}/invites/email", methods=["POST"], endpoint=invite.post_email)
)
server.router(
    Router(path="/api/workspaces/{workspace_id}/invites/friend", methods=["POST"], endpoint=invite.post_friend)
)
server.router(
    Router(path="/api/workspaces/{workspace_id}/invites/cancel", methods=["POST"], endpoint=invite.post_cancel)
)
server.router(
    Router(path="/api/workspaces/{workspace_id}/invites/resend", methods=["POST"], endpoint=invite.post_resend)
)
server.router(
    Router(path="/api/workspaces/{workspace_id}/link", methods=["POST"], endpoint=invite.post_link)
)
server.router(
    Router(path="/api/workspaces/{workspace_id}/link/replace", methods=["POST"], endpoint=invite.post_link_replace)
)
server.router(
    Router(path="/api/join/code/check", methods=["POST"], endpoint=join.post_check_code)
)
server.router(
    Router(path="/api/join/code", methods=["POST"], endpoint=join.post_code)
)
server.router(
    Router(path="/api/join/link/check", methods=["POST"], endpoint=join.post_check_link)
)
server.router(
    Router(path="/api/join/link", methods=["POST"], endpoint=join.post_link)
)
server.router(
    Router(path="/api/join/invite", methods=["POST"], endpoint=join.post_answer_invite)
)
server.router(
    Router(path="/api/friends", methods=["GET"], endpoint=friend.get_search)
)
server.router(
    Router(path="/api/friends/request", methods=["POST"], endpoint=friend.post_request)
)
server.router(
    Router(path="/api/friends/respond", methods=["POST"], endpoint=friend.post_respond)
)
server.router(
    Router(path="/api/friends/block", methods=["POST"], endpoint=friend.post_block)
)
server.router(
    Router(path="/api/friends/link", methods=["POST"], endpoint=friend.post_link)
)
server.router(
    Router(path="/api/friends/by-link", methods=["POST"], endpoint=friend.post_by_link)
)
server.router(
    Router(path="/api/notifications", methods=["GET"], endpoint=notification.get_search)
)
server.router(
    Router(path="/api/notifications/read", methods=["POST"], endpoint=notification.post_read)
)

# develop
if is_develop():
    server.router(
        Router(path="/api/auth/develop-login", methods=["POST"], endpoint=auth.post_develop_login)
    )
    server.router(
        Router(path="/api/develop/mail", methods=["GET"], endpoint=develop.get_mail)
    )

# exception handler
server.exception_handler(exception.client())
server.exception_handler(exception.internal())

# app
app = server.app()


# #
# run

if __name__ == "__main__":
    import uvicorn

    config = get_server_config()

    uvicorn.run(
        app="worship_support.api.bin.server:app",
        host=config.HOST,
        port=config.PORT,
        reload=is_develop(),
    )

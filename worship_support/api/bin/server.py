from worship_support.api.config import is_develop
from worship_support.api.config import get_server_config
from worship_support.api.server.server import worship_support_api
from worship_support.api.server import middleware
from worship_support.api.server.router import Router
from worship_support.api.endpoint import system
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

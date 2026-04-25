import os

from worship_support.api.server.server import worship_support_api
from worship_support.api.server.middleware import cors, proxy_headers
from worship_support.api.server.lifecycle import database
from worship_support.api.server.router import Router
from worship_support.api.endpoint.system import health


# #
# server

server = worship_support_api()

# middleware
server.middleware(cors())
server.middleware(proxy_headers())

# lifecycle
server.lifecycle(database())

# router
server.router(
    Router(path="/health", methods=["GET"], endpoint=health)
)

# app
server.app()


# #
# Run

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        app="worship_support.api.bin.server:app",
        host=str(os.environ["DEVELOP_API_HOST"]),
        port=int(os.environ["DEVELOP_API_CONTAINER_PORT"]),
        reload=True,
    )
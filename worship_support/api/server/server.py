from contextlib import AsyncExitStack, asynccontextmanager

from fastapi import FastAPI

from worship_support.api.server.exception import ExceptionHandler
from worship_support.api.server.lifecycle import Lifecycle
from worship_support.api.server.middleware import Middleware
from worship_support.api.server.router import Router


class Server:
    def __init__(self, name: str):
        self._name = name

        self._middlewares: list[Middleware] = []
        self._routers: list[Router] = []
        self._lifecycles: list[Lifecycle] = []
        self._exception_handlers: list[ExceptionHandler] = []

    def middleware(self, middleware: Middleware):
        self._middlewares.append(middleware)

    def router(self, router: Router):
        self._routers.append(router)

    def lifecycle(self, lifecycle: Lifecycle):
        self._lifecycles.append(lifecycle)

    def exception_handler(self, exception_handler: ExceptionHandler):
        self._exception_handlers.append(exception_handler)

    def app(self):
        lifespan = self._combined_lifespan() if self._lifecycles else None
        app = FastAPI(lifespan=lifespan)

        for middleware in self._middlewares:
            middleware.register(app)

        for router in self._routers:
            router.register(app)

        for exception_handler in self._exception_handlers:
            exception_handler.register(app)

        return app

    def _combined_lifespan(self):
        lifespans = [lifecycle.lifespan() for lifecycle in self._lifecycles]

        @asynccontextmanager
        async def _lifespan(app: FastAPI):
            async with AsyncExitStack() as stack:
                for lifespan in lifespans:
                    await stack.enter_async_context(lifespan(app))
                yield

        return _lifespan


# #
# factory

def worship_support_api():
    return Server(name="worship-support-api")

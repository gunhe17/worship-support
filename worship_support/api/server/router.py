from typing import Any, Callable

from fastapi import APIRouter, FastAPI


class Router:
    def __init__(
        self,
        path: str,
        methods: list[str],
        endpoint: Callable[..., Any],
        dependencies: list | None = None,
    ):
        self._path = path
        self._methods = methods
        self._endpoint = endpoint
        self._dependencies = dependencies or []

    def register(self, app: FastAPI):
        router = APIRouter()
        router.add_api_route(
            path=self._path,
            methods=self._methods,
            endpoint=self._endpoint,
            dependencies=self._dependencies,
        )

        app.include_router(router)
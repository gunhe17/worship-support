from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware


class Middleware:
    def __init__(
        self, 
        middleware_class: type, 
        **options: Any
    ):
        self.middleware_class = middleware_class
        self.options = options

    def register(self, app: FastAPI):
        app.add_middleware(self.middleware_class, **self.options)


# #
# Middleware

def cors():
    return Middleware(
        middleware_class=CORSMiddleware, 
        allow_origins=["*"], 
        allow_credentials=True, 
        allow_methods=["*"], 
        allow_headers=["*"]
    )

def proxy_headers():
    return Middleware(
        middleware_class=ProxyHeadersMiddleware
    )
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.common.exception.exceptions import AppException
from app.presentation.router import post_router, recommend_router, song_router, worship_router, worship_ment_router, youtube_router

app = FastAPI(
    title="Worship Support API",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

_cors_origins = os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(worship_router.router)
app.include_router(post_router.router)
app.include_router(song_router.router)
app.include_router(recommend_router.router)
app.include_router(youtube_router.router)
app.include_router(worship_ment_router.router)


@app.exception_handler(AppException)
async def exception_handler(request: Request, exc: AppException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error_code": exc.error_code, "message": exc.detail},
    )


@app.get("/health")
async def health_check() -> dict:
    return {"status": "ok", "version": "0.1.0"}

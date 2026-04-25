from fastapi import FastAPI

from app.core.http import register_exception_handlers
from app.domains.auth.endpoint import router as auth_router
from app.domains.project.endpoint import router as project_router
from app.domains.user.endpoint import router as user_router
from app.domains.workspace.endpoint import router as workspace_router

app = FastAPI(title="Worship Support API")
register_exception_handlers(app)

app.include_router(auth_router)
app.include_router(user_router)
app.include_router(workspace_router)
app.include_router(project_router)


@app.get("/health")
def health() -> dict[str, object]:
    return {"data": {"status": "ok"}}

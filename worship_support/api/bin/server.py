import os

import uvicorn
from fastapi import FastAPI

app = FastAPI(title="worship-support")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run(
        "worship_support.api.bin.server:app",
        host="0.0.0.0",
        port=int(os.environ["DEVELOP_API_PORT"]),
        reload=True,
    )

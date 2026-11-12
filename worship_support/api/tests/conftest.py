from __future__ import annotations

import os
import uuid

os.environ["DEVELOP_POSTGRES_DB"] = os.environ.get("TEST_POSTGRES_DB", "worship_test")

import httpx
import pytest

from worship_support.api.bin.server import app


# #
# client

class Person:
    def __init__(self, client: httpx.AsyncClient, user: dict, email: str):
        self.client = client
        self.user = user
        self.email = email
        self.id = user["id"]

    async def call(self, method: str, path: str, body: dict | None = None, status: int = 200) -> dict:
        response = await self.client.request(method, path, json=body)
        assert response.status_code == status, (response.status_code, response.text)
        return response.json()


@pytest.fixture
def person():
    clients = []

    async def make(name: str | None = None) -> Person:
        client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")
        clients.append(client)
        email = f"{uuid.uuid4().hex[:10]}@test.example"
        response = await client.post("/api/auth/develop-login", json={"email": email, "name": name or "사람"})
        assert response.status_code == 200, response.text
        return Person(client, response.json()["data"]["user"], email)

    yield make


from __future__ import annotations

import re


async def _code(client, email):
    mails = (await client.get("/api/develop/mail")).json()["data"]
    body = next(mail["body"] for mail in mails if mail["to"] == email)
    return re.search(r"(\d{6})$", body).group(1)


async def test_create_rules(person):
    a = await person()
    assert (await a.call("POST", "/api/workspaces", {"name": "가" * 21}, status=400))["key"] == "invalid_format"
    await a.call("POST", "/api/workspaces", {"name": "가" * 20})
    await a.call("POST", "/api/workspaces", {"name": "주일 2부 찬양팀"})
    assert (await a.call("POST", "/api/workspaces", {"name": " 주일 2부 찬양팀 "}, status=409))["key"] == "workspace_name_taken"
    spaces = (await a.call("GET", "/api/workspaces"))["data"]["spaces"]
    assert all(space["role"] == "MANAGER" and space["member_count"] == 1 for space in spaces)


async def test_email_invite_code(person):
    a, b = await person("관리자"), await person("받는 사람")
    space = (await a.call("POST", "/api/workspaces", {"name": "청년부"}))["data"]
    await a.call("POST", f"/api/workspaces/{space['id']}/invites/email", {"emails": [b.email]})
    code = await _code(a.client, b.email)
    assert (await b.call("POST", "/api/join/code/check", {"code": "12345"}, status=400))["key"] == "invalid_format"
    wrong = "000000" if code != "000000" else "111111"
    assert (await b.call("POST", "/api/join/code/check", {"code": wrong}, status=409))["key"] == "code_mismatch"
    preview = (await b.call("POST", "/api/join/code/check", {"code": code}))["data"]
    assert preview["name"] == "청년부" and preview["manager"]["name"] == "관리자" and preview["member_count"] == 1
    joined = (await b.call("POST", "/api/join/code", {"code": code}))["data"]
    assert joined["already_member"] is False
    await b.call("POST", "/api/join/code", {"code": code}, status=409)
    invites = (await a.call("GET", f"/api/workspaces/{space['id']}/invites"))["data"]
    assert invites["sent"] == [] and invites["past"][0]["state"] == "accepted"
    kinds = [n["kind"] for n in (await a.call("GET", "/api/notifications"))["data"]["items"]]
    assert "MEMBER_JOINED" in kinds


async def test_resend_and_cancel(person):
    a = await person()
    space = (await a.call("POST", "/api/workspaces", {"name": "새 공간"}))["data"]
    sent = (await a.call("POST", f"/api/workspaces/{space['id']}/invites/email", {"emails": ["grace.lee@naver.com"]}))["data"][0]
    first = await _code(a.client, "grace.lee@naver.com")
    await a.call("POST", f"/api/workspaces/{space['id']}/invites/resend", {"kind": "email", "id": sent["id"]})
    second = await _code(a.client, "grace.lee@naver.com")
    invites = (await a.call("GET", f"/api/workspaces/{space['id']}/invites"))["data"]
    assert len(invites["sent"]) == 1
    if first != second:
        b = await person()
        await b.call("POST", "/api/join/code/check", {"code": first}, status=409)
    await a.call("POST", f"/api/workspaces/{space['id']}/invites/cancel", {"kind": "email", "id": invites["sent"][0]["id"]})
    assert (await a.call("GET", f"/api/workspaces/{space['id']}/invites"))["data"]["sent"] == []


async def test_link_and_removed_member(person):
    a, b = await person(), await person()
    space = (await a.call("POST", "/api/workspaces", {"name": "링크 공간"}))["data"]
    token = (await a.call("POST", f"/api/workspaces/{space['id']}/link"))["data"]["token"]
    assert (await a.call("POST", f"/api/workspaces/{space['id']}/link"))["data"]["token"] == token
    await b.call("POST", "/api/join/link", {"token": token})
    members = (await a.call("GET", f"/api/workspaces/{space['id']}/members"))["data"]
    target = next(row for row in members if row["user_id"] == b.id)
    await b.call("POST", f"/api/workspaces/{space['id']}/members/remove", {"member_id": target["id"]}, status=403)
    await a.call("POST", f"/api/workspaces/{space['id']}/members/remove", {"member_id": target["id"]})
    assert (await b.call("POST", "/api/join/link/check", {"token": token}, status=409))["key"] == "removed_member"
    assert (await b.call("POST", "/api/join/link", {"token": token}, status=409))["key"] == "removed_member"
    replaced = (await a.call("POST", f"/api/workspaces/{space['id']}/link/replace", {"mode": "replace"}))["data"]["token"]
    assert replaced != token
    c = await person()
    assert (await c.call("POST", "/api/join/link/check", {"token": token}, status=409))["key"] == "link_unusable"
    await a.call("POST", f"/api/workspaces/{space['id']}/invites/email", {"emails": [b.email]})
    await b.call("POST", "/api/join/code", {"code": await _code(a.client, b.email)})
    kinds = [n["kind"] for n in (await a.call("GET", "/api/notifications"))["data"]["items"]]
    assert "MEMBER_RETURNED" in kinds


async def test_transfer_and_close(person):
    a, b = await person("처음 관리자"), await person("다음 관리자")
    space = (await a.call("POST", "/api/workspaces", {"name": "넘길 공간"}))["data"]
    token = (await a.call("POST", f"/api/workspaces/{space['id']}/link"))["data"]["token"]
    await b.call("POST", "/api/join/link", {"token": token})
    await b.call("PATCH", f"/api/workspaces/{space['id']}", {"name": "바꿈"}, status=403)
    members = (await a.call("GET", f"/api/workspaces/{space['id']}/members"))["data"]
    target = next(row for row in members if row["user_id"] == b.id)
    await a.call("POST", f"/api/workspaces/{space['id']}/transfer", {"member_id": target["id"]})
    assert (await a.call("GET", f"/api/workspaces/{space['id']}"))["data"]["role"] == "MEMBER"
    assert (await b.call("GET", f"/api/workspaces/{space['id']}"))["data"]["role"] == "MANAGER"
    await a.call("POST", f"/api/workspaces/{space['id']}/close", {"confirm_name": "넘길 공간"}, status=403)
    assert (await b.call("POST", f"/api/workspaces/{space['id']}/close", {"confirm_name": "틀린 이름"}, status=409))["key"] == "workspace_name_mismatch"
    await b.call("POST", f"/api/workspaces/{space['id']}/close", {"confirm_name": "넘길 공간"})
    assert (await a.call("GET", f"/api/workspaces/{space['id']}", status=409))["key"] == "workspace_closed"
    assert [n["kind"] for n in (await a.call("GET", "/api/notifications"))["data"]["items"]][0] == "WORKSPACE_CLOSED"
    assert (await a.call("GET", "/api/workspaces"))["data"]["spaces"] == []


async def test_unauthenticated(person):
    import httpx
    from worship_support.api.bin.server import app
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        assert (await client.get("/api/workspaces")).status_code == 401


async def test_withdraw(person):
    a, b = await person("탈퇴할 사람"), await person()
    space = (await a.call("POST", "/api/workspaces", {"name": "혼자 공간"}))["data"]
    shared = (await b.call("POST", "/api/workspaces", {"name": "같이 공간"}))["data"]
    token = (await b.call("POST", f"/api/workspaces/{shared['id']}/link"))["data"]["token"]
    await a.call("POST", "/api/join/link", {"token": token})
    sent = (await a.call("POST", "/api/friends/request", {"user_id": b.id}))["data"]
    await b.call("POST", "/api/friends/respond", {"pair_id": sent["pair_id"], "action": "accept"})
    await a.call("POST", "/api/account/withdraw")
    await a.call("GET", "/api/account/me", status=401)
    assert (await b.call("GET", "/api/friends"))["data"]["friends"] == []
    members = (await b.call("GET", f"/api/workspaces/{shared['id']}/members"))["data"]
    assert [row["user_id"] for row in members] == [b.id]
    other = await person()
    assert (await other.call("POST", "/api/join/link/check", {"token": token}))["data"]["member_count"] == 1
    assert space["id"]

from __future__ import annotations

import asyncio


async def _space(owner, *others):
    space = (await owner.call("POST", "/api/workspaces", {"name": "청년부 찬양팀"}))["data"]
    link = (await owner.call("POST", f"/api/workspaces/{space['id']}/link"))["data"]
    for other in others:
        await other.call("POST", "/api/join/link", {"token": link["token"]})
    return space


async def _friends(a, b):
    sent = (await a.call("POST", "/api/friends/request", {"user_id": b.id}))["data"]
    await b.call("POST", "/api/friends/respond", {"pair_id": sent["pair_id"], "action": "accept"})
    return sent["pair_id"]


async def test_request_and_accept(person):
    a, b = await person("김민수"), await person("문지아")
    await _space(a, b)
    sent = (await a.call("POST", "/api/friends/request", {"user_id": b.id}))["data"]
    assert sent["state"] == "sent"
    notices = (await b.call("GET", "/api/notifications"))["data"]
    assert notices["needs_response"] == 1
    assert notices["items"][0]["kind"] == "FRIEND_REQUEST"
    assert notices["items"][0]["action_state"] == "pending"
    received = (await b.call("GET", "/api/friends"))["data"]["received"]
    assert [row["person"]["id"] for row in received] == [a.id]
    await b.call("POST", "/api/friends/respond", {"pair_id": sent["pair_id"], "action": "accept"})
    mine = (await a.call("GET", "/api/friends"))["data"]
    assert [row["person"]["id"] for row in mine["friends"]] == [b.id]
    assert [space["name"] for space in mine["friends"][0]["shared_spaces"]] == ["청년부 찬양팀"]
    assert (await b.call("GET", "/api/notifications"))["data"]["items"][0]["action_state"] == "accepted"
    assert (await a.call("GET", "/api/notifications"))["data"]["items"][0]["kind"] == "FRIEND_ACCEPTED"


async def test_duplicate_and_crossing_request(person):
    a, b = await person(), await person()
    await _space(a, b)
    await a.call("POST", "/api/friends/request", {"user_id": b.id})
    duplicate = await a.call("POST", "/api/friends/request", {"user_id": b.id}, status=409)
    assert duplicate["key"] == "friend_exists"
    crossed = (await b.call("POST", "/api/friends/request", {"user_id": a.id}))["data"]
    assert crossed["result"] == "accepted"
    assert len((await a.call("GET", "/api/friends"))["data"]["friends"]) == 1


async def test_concurrent_crossing_requests_leave_one_relation(person):
    a, b = await person(), await person()
    await _space(a, b)
    results = await asyncio.gather(
        a.client.post("/api/friends/request", json={"user_id": b.id}),
        b.client.post("/api/friends/request", json={"user_id": a.id}),
    )
    assert sorted(r.status_code for r in results) == [200, 200]
    assert sorted(r.json()["data"]["result"] for r in results) == ["accepted", "requested"]
    assert len((await a.call("GET", "/api/friends"))["data"]["friends"]) == 1


async def test_concurrent_accept_only_once(person):
    a, b = await person(), await person()
    await _space(a, b)
    sent = (await a.call("POST", "/api/friends/request", {"user_id": b.id}))["data"]
    results = await asyncio.gather(*[
        b.client.post("/api/friends/respond", json={"pair_id": sent["pair_id"], "action": "accept"}) for _ in range(3)
    ])
    assert sorted(r.status_code for r in results) == [200, 409, 409]
    accepted = [n for n in (await a.call("GET", "/api/notifications"))["data"]["items"] if n["kind"] == "FRIEND_ACCEPTED"]
    assert len(accepted) == 1


async def test_unfriend_and_request_again(person):
    a, b = await person(), await person()
    await _space(a, b)
    pair = await _friends(a, b)
    await a.call("POST", "/api/friends/respond", {"pair_id": pair, "action": "end"})
    assert (await b.call("GET", "/api/friends"))["data"]["friends"] == []
    again = (await b.call("POST", "/api/friends/request", {"user_id": a.id}))["data"]
    assert again["pair_id"] != pair


async def test_block_rules(person):
    a, b = await person(), await person()
    space = await _space(a, b)
    await _friends(a, b)
    await a.call("POST", "/api/friends/block", {"user_id": b.id, "action": "block"})
    assert (await a.call("GET", "/api/friends"))["data"]["friends"] == []
    assert [row["person"]["id"] for row in (await a.call("GET", "/api/friends"))["data"]["blocked"]] == [b.id]
    assert (await b.call("POST", "/api/friends/request", {"user_id": a.id}, status=409))["key"] == "blocked"
    assert (await a.call("POST", "/api/friends/request", {"user_id": b.id}, status=409))["key"] == "blocked"
    members = (await b.call("GET", f"/api/workspaces/{space['id']}/members"))["data"]
    assert {row["person"]["id"] for row in members} == {a.id, b.id}
    await a.call("POST", "/api/friends/block", {"user_id": b.id, "action": "unblock"})
    assert (await a.call("GET", "/api/friends"))["data"]["friends"] == []
    await b.call("POST", "/api/friends/request", {"user_id": a.id})


async def test_stale_notification_and_foreign_pair(person):
    a, b, c = await person(), await person(), await person()
    await _space(a, b, c)
    sent = (await a.call("POST", "/api/friends/request", {"user_id": b.id}))["data"]
    await c.call("POST", "/api/friends/respond", {"pair_id": sent["pair_id"], "action": "accept"}, status=404)
    await a.call("POST", "/api/friends/respond", {"pair_id": sent["pair_id"], "action": "accept"}, status=409)
    await a.call("POST", "/api/friends/respond", {"pair_id": sent["pair_id"], "action": "end"})
    notice = (await b.call("GET", "/api/notifications"))["data"]["items"][0]
    assert notice["action_state"] == "closed"
    closed = await b.call("POST", "/api/friends/respond", {"pair_id": sent["pair_id"], "action": "accept"}, status=409)
    assert closed["key"] == "friend_request_closed"


async def test_reachability_and_friend_link(person):
    a, b = await person(), await person("링크 주인")
    assert (await a.call("POST", "/api/friends/request", {"user_id": b.id}, status=409))["key"] == "friend_unreachable"
    token = (await b.call("POST", "/api/friends/link", {"mode": "get"}))["data"]["token"]
    preview = (await a.call("POST", "/api/friends/by-link", {"token": token, "action": "check"}))["data"]
    assert preview["owner"]["name"] == "링크 주인" and preview["relation"] == "none"
    await a.call("POST", "/api/friends/by-link", {"token": token, "action": "request"})
    replaced = (await b.call("POST", "/api/friends/link", {"mode": "replace"}))["data"]["token"]
    assert replaced != token
    await a.call("POST", "/api/friends/by-link", {"token": token, "action": "check"}, status=404)


async def test_shared_spaces_follow_membership(person):
    a, b = await person(), await person()
    space = await _space(a, b)
    await _friends(a, b)
    await b.call("POST", f"/api/workspaces/{space['id']}/leave")
    assert (await a.call("GET", "/api/friends"))["data"]["friends"][0]["shared_spaces"] == []
    await b.call("GET", f"/api/workspaces/{space['id']}", status=403)


async def test_friend_invite_flow(person):
    a, b, c = await person("관리자"), await person("친구"), await person("남")
    other = await _space(a, b, c)
    await _friends(a, b)
    space = (await a.call("POST", "/api/workspaces", {"name": "새벽기도 찬양팀"}))["data"]
    assert (await a.call("POST", f"/api/workspaces/{space['id']}/invites/friend", {"user_ids": [c.id]}, status=409))["key"] == "not_friend"
    await a.call("POST", f"/api/workspaces/{space['id']}/invites/friend", {"user_ids": [b.id]})
    home = (await b.call("GET", "/api/workspaces"))["data"]
    invite = home["received_invites"][0]
    assert invite["workspace"]["name"] == "새벽기도 찬양팀" and invite["workspace"]["manager"]["name"] == "관리자"
    joined = (await b.call("POST", "/api/join/invite", {"id": invite["id"], "answer": "accept"}))["data"]
    assert joined["workspace"]["id"] == space["id"]
    assert (await b.call("POST", "/api/join/invite", {"id": invite["id"], "answer": "decline"}, status=409))["key"] == "invite_closed"
    assert (await a.call("POST", f"/api/workspaces/{other['id']}/invites/friend", {"user_ids": [b.id]}, status=409))["key"] == "already_member"
    third = (await a.call("POST", "/api/workspaces", {"name": "수요 예배 찬양"}))["data"]
    await a.call("POST", f"/api/workspaces/{third['id']}/invites/friend", {"user_ids": [b.id]})
    pending = (await b.call("GET", "/api/workspaces"))["data"]["received_invites"][0]
    await b.call("POST", "/api/join/invite", {"id": pending["id"], "answer": "decline"})
    declined = [n for n in (await a.call("GET", "/api/notifications"))["data"]["items"] if n["kind"] == "WORKSPACE_INVITE_DECLINED"]
    assert len(declined) == 1
    invites = (await a.call("GET", f"/api/workspaces/{third['id']}/invites"))["data"]
    assert invites["sent"] == [] and invites["past"][0]["state"] == "declined"
    await a.call("POST", "/api/friends/block", {"user_id": b.id, "action": "block"})
    assert (await a.call("POST", f"/api/workspaces/{third['id']}/invites/friend", {"user_ids": [b.id]}, status=409))["key"] == "not_friend"

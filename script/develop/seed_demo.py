import httpx

API = "http://127.0.0.1:28300"

for name, email in [
    ("박지훈", "a@w.kr"), ("최예린", "b@w.kr"), ("문지아", "c@w.kr"),
    ("박하은", "d@w.kr"), ("김민수", "e@w.kr"), ("김민수", "f@w.kr"),
    ("정하늘", "g@w.kr"), ("이은혜", "h@w.kr"),
]:
    httpx.post(f"{API}/api/auth/develop-login", json={"email": email, "name": name}).raise_for_status()
print("seeded 8 users")

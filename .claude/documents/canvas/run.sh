#!/usr/bin/env bash
# canvas 서버: http://<host>:${PORT:-48217}  (같은 네트워크에서 여러 명 동시 접속)
cd "$(dirname "$0")"
exec python3 - "${PORT:-48217}" <<'PY'
import base64, json, os, shutil, sys
from http.server import HTTPServer, SimpleHTTPRequestHandler

class H(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

    def do_GET(self):
        if self.path == "/": self.path = "/canvas.html"
        super().do_GET()

    def do_POST(self):  # 단일 스레드 서버라 lock 불필요
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        if self.path == "/op":
            rec = json.load(open("record.json"))
            for op in body:
                if op["k"] not in ("boxes", "shapes"): continue
                if op["t"] == "put": rec[op["k"]][op["v"]["id"]] = op["v"]
                else: rec[op["k"]].pop(op["id"], None)
            rec["v"] += 1
            with open("record.json.tmp", "w") as f: json.dump(rec, f, ensure_ascii=False, indent=1)
            os.replace("record.json.tmp", "record.json")
        elif self.path == "/export":
            base = os.path.realpath("exported")
            shutil.rmtree(base, ignore_errors=True); os.makedirs(base)
            for p, b64 in body.items():
                f = os.path.realpath(os.path.join(base, p))
                if not (f.startswith(base + os.sep) and f.endswith(".png")): continue
                os.makedirs(os.path.dirname(f), exist_ok=True)
                with open(f, "wb") as fh: fh.write(base64.b64decode(b64))
        else: return self.send_error(404)
        self.send_response(204); self.end_headers()

print(f"canvas: http://localhost:{sys.argv[1]}")
HTTPServer(("0.0.0.0", int(sys.argv[1])), H).serve_forever()
PY

"""lab 페이지를 로컬에서 음원과 함께 본다. 표준 라이브러리 + kaggle CLI · ffmpeg · Rust 워커.

  python3 _server/serve.py        → http://127.0.0.1:8000  (PORT=47823 python ... 로 포트 변경)

/: 연구 지도. 요청마다 md를 읽어(graph.py) 뷰어에 넣어 보낸다 — 생성 파일 없이 고친 md가 새로고침으로 바로 보인다.

POST /analyze: 실험 페이지에 넣은 오디오 → ffmpeg로 22050Hz 모노 WAV → lab/to-bpm/_worker(Beat This! + DBN, Rust)
 → {beats, downbeats, bpm}. bpm은 lab/to-bpm/_tempo/tempo.py. 연산을 이 Mac에서 하는 유일한 경로 (사용자 결정 2026-10-14).

/sfb/<SongFormBench id>: 공개 경계 시험 음원. _data/songformbench/에 없으면 HF ASLP-lab/SongFormBench(CC-BY-4.0)에서 그 곡만 받아 둔다.
/audio/<YouTube id>: _data/audio-500/audio/에 있으면 그대로, 없으면 그 곡만 Kaggle 데이터셋 gunhe17/worship-audio-500(원본)에서 받아 두고 보낸다
(개인 연구용·배포 금지라 이 컴퓨터 밖으로 내보내지 않는다).
"""
import http.server, json, os, re, subprocess, sys, tempfile, urllib.request
from pathlib import Path

LAB = Path(__file__).resolve().parent.parent
AUDIO = LAB / "_data/audio-500/audio"
WORKER = LAB / "to-bpm/_worker"
MAX_UPLOAD = 300 * 2**20
sys.path.insert(0, str(LAB / "to-bpm/_tempo"))
from tempo import tempo  # noqa: E402
import graph  # noqa: E402
ID = re.compile(r"^/audio/([A-Za-z0-9_-]{11})$")
SFB = re.compile(r"^/sfb/(BHX_[A-Za-z0-9_]+|BC_[0-9a-f]+)$")
SFB_DIR = LAB / "_data/songformbench"
TYPES = {".wav": "audio/wav", ".m4a": "audio/mp4", ".webm": "audio/webm", ".opus": "audio/ogg", ".mp3": "audio/mpeg", ".mp4": "audio/mp4"}


def audio_file(vid):
    hit = [p for p in AUDIO.glob(f"{vid}.*") if p.suffix in TYPES]
    if not hit:  # ponytail: 요청 하나가 받기를 끝까지 기다린다(곡당 수 초). 동시에 여러 곡이면 큐가 필요
        AUDIO.mkdir(parents=True, exist_ok=True)
        for ext in (".webm", ".m4a"):  # 데이터셋은 webm 499곡 + m4a 1곡. id가 -로 시작할 수 있어 --file= 로 넘긴다
            subprocess.run(["kaggle", "datasets", "download", "gunhe17/worship-audio-500", f"--file={vid}{ext}", "-p", str(AUDIO), "-q"],
                           capture_output=True)
            if (AUDIO / f"{vid}{ext}").exists():
                break
        hit = [p for p in AUDIO.glob(f"{vid}.*") if p.suffix in TYPES]
    return hit[0] if hit else None


def sfb_file(song_id):
    subset, ext = ("HarmonixSet", ".wav") if song_id.startswith("BHX_") else ("CN", ".mp3")
    path = SFB_DIR / f"{song_id}{ext}"
    if not path.exists():
        SFB_DIR.mkdir(parents=True, exist_ok=True)
        url = f"https://huggingface.co/datasets/ASLP-lab/SongFormBench/resolve/main/data/audios/{subset}/{song_id}{ext}"
        try:
            path.write_bytes(urllib.request.urlopen(url, timeout=60).read())
        except OSError:
            return None
    return path


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      ".html": "text/html; charset=utf-8", ".md": "text/plain; charset=utf-8", ".json": "application/json; charset=utf-8"}

    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(LAB), **k)

    def end_headers(self):  # 페이지를 다시 만들면 새로고침만으로 반영되게
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def reply(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path != "/analyze":
            return self.send_error(404)
        n = int(self.headers.get("Content-Length") or 0)
        if not 0 < n <= MAX_UPLOAD:
            return self.reply(413, {"error": f"파일 크기는 {MAX_UPLOAD >> 20}MB 이하여야 합니다"})
        exe = WORKER / "target/release/bpm-worker"
        if not exe.exists() or not (WORKER / "models/beat_this.onnx").exists():
            return self.reply(503, {"error": "Rust 워커가 없습니다: cd lab/to-bpm/_worker && ./download-models.sh && cargo build --release"})
        with tempfile.TemporaryDirectory() as d:
            src, wav = Path(d) / "in", Path(d) / "in.wav"
            src.write_bytes(self.rfile.read(n))
            r = subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(src), "-ac", "1", "-ar", "22050", str(wav)],
                               capture_output=True, text=True)
            if r.returncode:
                return self.reply(400, {"error": "오디오로 읽지 못했습니다: " + r.stderr.strip()[-200:]})
            r = subprocess.run([str(exe), str(WORKER / "models"), str(wav)], capture_output=True, text=True)
            if r.returncode:
                return self.reply(500, {"error": "워커 오류: " + r.stderr.strip()[-200:]})
        j = json.loads(r.stdout.strip().splitlines()[-1])
        t = tempo(j["beats"], j["downbeats"])
        self.reply(200, {"beats": j["beats"], "downbeats": j["downbeats"], "bpm": t and t["bpm"]})

    def do_GET(self):
        if self.path in ("/", "/index.html", "/graph.html"):  # graph.html = 예전 주소(열려 있던 탭)
            g, warn = graph.build()
            for w in warn:
                print("경고:", w, file=sys.stderr)
            body = (Path(__file__).parent / "viewer.template.html").read_text().replace("__GRAPH__", json.dumps(g, ensure_ascii=False)).encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            return self.wfile.write(body)
        m, sfb = ID.match(self.path), SFB.match(self.path)
        if not (m or sfb):
            return super().do_GET()
        f = audio_file(m.group(1)) if m else sfb_file(sfb.group(1))
        if not f:
            return self.send_error(404, "음원을 받지 못했습니다")
        # 브라우저가 재생 위치를 옮길 수 있게 Range 요청을 받는다
        size, rng = f.stat().st_size, re.match(r"bytes=(\d*)-(\d*)", self.headers.get("Range", ""))
        a, b = 0, size - 1
        if rng:
            a, b = (int(rng[1]), int(rng[2]) if rng[2] else size - 1) if rng[1] else (size - int(rng[2]), size - 1)
        self.send_response(206 if rng else 200)
        self.send_header("Content-Type", TYPES[f.suffix])
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(b - a + 1))
        if rng:
            self.send_header("Content-Range", f"bytes {a}-{b}/{size}")
        self.end_headers()
        with open(f, "rb") as fh:
            fh.seek(a)
            self.wfile.write(fh.read(b - a + 1))


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"http://127.0.0.1:{port}")
    http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()

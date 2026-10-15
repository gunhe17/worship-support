"""Key Test 페이지(key-measure.html): 찬양곡마다 key 방법 45개의 시간별 key를 띠로 나열한다 (bpm-measure와 같은 형태).

  python lab/_server/build_key_measure.py   → serve.py로 http://127.0.0.1:8000/_server/key-measure.html

입력: key-model-sweep results/v1/out/songs/<id>.json (찬양 500곡 중 측정된 359곡). 곡은 연구 지도 사이드바가 고른다.
방법 순서: 시간별 key를 내는 방법 → 곡 key 하나만 내는 방법, 각각 정답 32곡(합성 29 + 찬양 3) MIREX 점수 순.
"""
import collections, json
from pathlib import Path

HERE = Path(__file__).parent
KS = next((HERE.parent / "to-key").glob("*/key-model-sweep")) / "results"
KEYS = [f"{n} {q}" for q in ("major", "minor") for n in ("C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B")]
ALIAS = {"Db": "C#", "D#": "Eb", "Gb": "F#", "G#": "Ab", "A#": "Bb"}
PROFILE = {"kk": "KK", "temperley": "Temperley", "albrecht": "Albrecht", "diatonic": "diatonic", "krumhansl": "Krumhansl",
           "weichai": "Wei–Chai", "tonictriad": "tonic triad", "temperley2005": "Temperley 2005", "thpcp": "THPCP", "shaath": "Sha'ath",
           "gomez": "Gómez", "noland": "Noland", "edmm": "EDMM", "edma": "EDMA", "bgate": "bgate", "braw": "braw"}
IN = {"mix": "믹스", "stem": "stem"}


def kidx(k):
    n, q = k.split()
    return KEYS.index(f"{ALIAS.get(n, n)} {q}")


def name(m):
    p = m.split("_")
    if m in ("pipe_mix", "pipe_stem"):
        return f"key-pipeline · {IN[p[1]]}"
    if m in ("bl_ess", "bl_lib"):
        return "사전확률 Viterbi · " + ("Essentia" if m == "bl_ess" else "librosa")
    if m == "chord_key":
        return "코드 인식 → key"
    if p[0] == "cnn":
        return f"madmom CNN · {IN[p[1]]}"
    if p[0] == "cnnwin":
        return "madmom CNN 창별"
    if p[0] == "esswin":
        return f"Essentia 창별 · {PROFILE[p[1]]}"
    if p[0] == "tpl":
        return f"템플릿 {PROFILE[p[1]]} · {IN[p[2]]}"
    return f"Essentia {PROFILE[p[1]]} · {IN[p[2]]}"


def runs(e, dur):
    """방법 출력 → [[시작, key 번호], ...] (같은 key가 이어지면 합친다)."""
    if "segments" in e:
        r = [[s["start"], kidx(s["key"])] for s in e["segments"]]
    elif "windows" in e:
        r = [[w[0], kidx(w[1])] for w in e["windows"]]
    else:
        r = [[0.0, kidx(e["key"])]]
    out = []
    for t, k in r:
        if not out or out[-1][1] != k:
            out.append([round(t, 1), k])
    return out


S = json.load(open(KS / "v1-summary/out/summary.json"))
mirex = {m: v.get("mirex", 0) for m, v in S["global"].items()}
songs, seen = [], set()
for f in sorted((KS / "v1/out/songs").glob("*.json")):
    d = json.load(open(f))
    if d["set"] != "w500":
        continue
    ms = {m: runs(e, d["dur"]) for m, e in d["methods"].items() if e.get("key") or e.get("segments") or e.get("windows")}
    votes = collections.Counter(e["key"] for e in d["methods"].values() if e.get("key"))
    top, n = votes.most_common(1)[0]
    songs.append({"id": d["id"], "team": d["team"], "title": d["title"], "dur": d["dur"], "key": kidx(top), "agree": n, "n": sum(votes.values()), "m": ms})
    seen.update(ms)
timeline = lambda m: m.startswith(("pipe", "esswin", "cnnwin"))
order = sorted(seen, key=lambda m: (not timeline(m), -mirex.get(m, 0), m))
meta = {m: {"name": name(m), "mirex": mirex.get(m), "line": timeline(m)} for m in order}
data = json.dumps({"keys": KEYS, "order": order, "meta": meta, "songs": songs}, ensure_ascii=False, separators=(",", ":"))
(HERE / "key-measure.html").write_text((HERE / "key-measure.template.html").read_text().replace("__DATA__", data))
print("key-measure.html", len(songs), "songs", len(order), "methods", len(data) // 1024, "KB")

"""측정 페이지(bpm-measure.html): 찬양 500곡의 BPM 방법별 곡선. bpm-model-sweep results/{a,b,c}의 w500 원시 출력만 읽는다.

  python lab/_server/build_bpm_song.py

곡선은 beat 간격을 그대로 BPM으로 바꾼 값이다 (반·두 배 통일 없음, 8박 이동 중앙값만).
합의 템포 = ±4% 안에 가장 많은 방법이 모인 템포 (Beat This! + DBN 템포가 없을 때 곡 템포).
"""
import json, math, statistics, sys, unicodedata, urllib.parse
from pathlib import Path

HERE = Path(__file__).parent
BPM = HERE.parent / "to-bpm"
RES = next(BPM.glob("*/bpm-model-sweep")) / "results"
W500 = next(BPM.glob("*/bpm-pipeline")) / "results/worship500-v1/out/worship500.json"
NAMES = {
    "beatthis_final0": "Beat This! final0", "beatthis_small0": "Beat This! small0", "beatthis_final0_dbn": "Beat This! + DBN",
    "madmom_dbn": "madmom RNN + DBN", "beatnet": "BeatNet", "librosa_beat": "librosa beat_track", "librosa_plp": "librosa PLP",
    "ess_multifeature": "Essentia multifeature", "ess_degara": "Essentia Degara", "ess_tempocnn": "Essentia TempoCNN",
    "deeprhythm": "DeepRhythm", "madmom_tempo": "madmom 템포", "librosa_tempo": "librosa tempo", "ess_percival": "Essentia Percival",
}
STEP = 2  # 곡선 간격(초). 500곡을 한 파일에 넣으려고 1초 대신 2초
TOL = math.log(1.04)


def curve(beats):
    """beat 간격 → BPM, 8박 이동 중앙값, STEP초 격자의 정수 BPM 목록과 시작 시각."""
    t = [(a + b) / 2 for a, b in zip(beats, beats[1:])]
    v = [60 / (b - a) for a, b in zip(beats, beats[1:])]
    v = [statistics.median(v[max(0, i - 4):i + 4]) for i in range(len(v))]
    t0, out, j = int(beats[0]) + 1, [], 0
    for s in range(t0, int(beats[-1]), STEP):
        while j + 1 < len(t) and t[j + 1] <= s:
            j += 1
        out.append(round(v[j]))
    return t0, out


def song(sid, sset, res=RES):
    ms, dur = {}, 0
    for x in "abc":
        p = res / x / "out" / x.upper() / sset / f"{sid}.json"
        if not p.exists():  # B 커널(BeatNet·madmom)은 시간 제한으로 500곡 중 417곡만 돌았다
            continue
        try:
            row = json.load(open(p))
        except ValueError:  # 채점 전에 멈춘 커널이 쓰다 만 파일
            continue
        for k, m in row["methods"].items():
            tempo = m.get("tempo") or (m.get("analysis") or {}).get("bpm_median")
            if not tempo:
                continue
            e = {"t": round(tempo, 1)}
            if m.get("beats") and len(m["beats"]) > 10:
                e["t0"], e["c"] = curve(m["beats"])
                e["bar"] = [round(b, 1) for b in m["beats"][::4]]  # 4박마다 점
                dur = max(dur, m["beats"][-1])
            elif m.get("local"):
                e["c"] = [round(v) for v in m["local"]]  # TempoCNN 창 값: 곡 길이에 고르게 편다
            ms[k] = e
    tem = [e["t"] for k, e in ms.items()]
    best = max(tem, key=lambda c: (sum(abs(math.log(t / c)) <= TOL for t in tem), -abs(c - 120)))
    grp = [t for t in tem if abs(math.log(t / best)) <= TOL]
    return {"dur": round(dur, 1), "cons": round(statistics.median(grp), 1), "agree": len(grp), "m": ms}


nfc = lambda t: unicodedata.normalize("NFC", t)  # 원본 제목은 NFD라 한글 검색이 안 맞는다
songs = [{"id": x["id"], "team": nfc(x["team"]), "title": nfc(x["title"]), **song(x["id"], "w500")} for x in json.load(open(W500))]
# 측정 페이지(연구 지도 to BPM › 측정): 찬양 500곡, 시안 M1. 곡 템포 = _tempo/tempo.py (Beat This! + DBN 마디), 없으면 합의 템포
sys.path.insert(0, str(BPM / "_tempo"))
from tempo import tempo  # noqa: E402
w500 = []
for s in songs:
    p = RES / "a/out/A/w500" / f"{s['id']}.json"
    m = json.load(open(p))["methods"].get("beatthis_final0_dbn", {}) if p.exists() else {}
    r = tempo(m.get("beats") or [], m.get("downbeats") or [])
    w500.append({"id": s["id"], "team": s["team"], "title": s["title"], "dur": s["dur"], "tempo": r["bpm"] if r else s["cons"],
                 "m": {k: {x: e[x] for x in ("t", "t0", "c") if x in e} for k, e in s["m"].items()}})  # 4박 점은 쓰지 않아 뺀다
# 클릭용 박은 페이지에 넣지 않고 고를 때 곡별 결과 JSON을 받는다 (serve.py가 lab을 그대로 보낸다)
res = "../" + urllib.parse.quote(str(RES.relative_to(HERE.parent)))
data = json.dumps({"names": NAMES, "res": res, "songs": w500}, ensure_ascii=False, separators=(",", ":"))
(HERE / "bpm-measure.html").write_text((HERE / "bpm-measure.template.html").read_text().replace("__DATA__", data))
print("bpm-measure.html", len(w500), "songs", len(data) // 1024, "KB")

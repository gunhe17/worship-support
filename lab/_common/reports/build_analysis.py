"""찬양 음원 분석 결과 뷰어(analysis.html) 생성. 저장소 안의 결과 JSON만 읽어 template.html에 넣는다.

  python lab/_common/reports/build_analysis.py   → analysis.html(트랙 뷰어), layouts.html(Tailwind 레이아웃 4종)

BPM: bpm-pipeline worship500-v1(+v5 정답 3곡) + bpm-model-sweep results/{a,b,c}
key: key-model-sweep results/v1(곡별) + v1-summary(채점)
"""
import glob, json, statistics
from pathlib import Path

HERE = Path(__file__).parent
LAB = HERE.parent.parent
BPM = LAB / "audio-to-bpm/experiments"
KEY = LAB / "audio-to-key/experiments/key-model-sweep/results"


def bars_of(beats, downs):
    out, j = [], 0
    for x, y in zip(downs, downs[1:]):
        while j < len(beats) and beats[j] < x - 0.05:
            j += 1
        k = j
        while k < len(beats) and beats[k] < y - 0.05:
            k += 1
        out.append([round(x, 2), k - j])
        j = k
    return out


def bpm_data():
    rows = json.load(open(BPM / "bpm-pipeline/results/worship500-v1/out/worship500.json"))
    for f in glob.glob(str(BPM / "bpm-pipeline/results/v5/out/*.auto.json")):
        x = json.load(open(f))
        x.update(id=x["file"], team=None, title=x["file"], duration=x["sections"][-1]["end"], set="gt3",
                 bpm_median=statistics.median(p[1] for p in x["tempo_curve"]))
        rows.append(x)
    songs = []
    for x in rows:
        c = x["tempo_curve"]
        songs.append({"id": x["id"], "set": x.get("set", "w500"), "team": x.get("team"), "title": x["title"], "dur": x["duration"],
                      "bpm": round(x["bpm_median"]), "st": x["stable"], "lo": x["bpm_range"][0], "hi": x["bpm_range"][1], "alt": x["alternates"],
                      "meter": x["meter"], "sec": [[q["start"], q["end"], q["bpm"]] for q in x["sections"]],
                      "ct": [round(p[0], 1) for p in c], "cb": [round(p[1]) for p in c],
                      "bars": [[round(b["start"], 2), b["n_beats"]] for b in x["bars"]], "bend": round(x["bars"][-1]["end"], 2) if x["bars"] else 0})
    sweep = {}
    for g in "abc":
        for f in glob.glob(str(BPM / f"bpm-model-sweep/results/{g}/out/*/w500/*.json")) + glob.glob(str(BPM / f"bpm-model-sweep/results/{g}/out/*/gt3/*.json")):
            r = json.load(open(f)); cur = sweep.setdefault(r["id"], {})
            for n, m in r["methods"].items():
                d = {}
                if "tempo" in m:
                    d["t"] = m["tempo"]
                a = m.get("analysis")
                if a and "error" not in a:
                    d.update(sec=[[q["start"], q["end"], q["bpm"]] for q in a["sections"]], med=a["bpm_median"], st=a["stable"], lo=a["bpm_range"][0], hi=a["bpm_range"][1], m=a.get("meter"))
                if "downbeats" in m and "beats" in m and len(m["downbeats"]) > 1:
                    d.update(bars=bars_of(m["beats"], m["downbeats"]), bend=m["downbeats"][-1])
                cur[n] = d
    return {"songs": songs}, sweep


def key_data():
    summ = json.load(open(KEY / "v1-summary/out/summary.json"))
    out = []
    for f in sorted(glob.glob(str(KEY / "v1/out/songs/*.json"))):
        r = json.load(open(f)); M = {}
        for n, m in r.get("methods", {}).items():
            if "segments" in m:
                M[n] = {"k": m.get("key"), "seg": [[s["start"], s["end"], s["key"]] for s in m["segments"]]}
            elif "windows" in m:
                M[n] = {"win": [[w[0], w[1]] for w in m["windows"]]}
            else:
                M[n] = {"k": m.get("key"), **({"s2": m["second"]} if "second" in m else {}),
                        **({"st": round(m.get("strength", m.get("score", 0)), 3)} if ("strength" in m or "score" in m) else {})}
        ch = r.get("methods", {}).get("chord_key", {}).get("chords")
        out.append({"id": r["id"], "set": r["set"], "team": r.get("team"), "title": r.get("title") or r["id"], "dur": r.get("dur"),
                    "truth": r.get("truth"), "main": r.get("main"), "kind": r.get("kind"), "m": M,
                    **({"ch": [[a, b, l] for a, b, l in ch if l != "N"]} if ch else {})})
    return {"songs": out, "keyup": {c["id"]: c["votes"] for c in summ["keyup_candidates"]}, "global": summ["global"], "mod": summ["modulation"],
            "core": ["bl_ess", "bl_lib", "chord_key", "pipe_stem", "pipe_mix", "cnn_mix", "tpl_kk_mix"]}


if __name__ == "__main__":
    bd, sw = bpm_data()
    j = lambda o: json.dumps(o, ensure_ascii=False, separators=(",", ":"))
    kd = j(key_data())
    for tpl, out in (("template.html", "analysis.html"), ("layouts.template.html", "layouts.html")):  # 트랙 뷰어 / Tailwind 레이아웃 4종
        html = (HERE / tpl).read_text().replace("__KEY__", kd).replace("__BPM__", j(bd)).replace("__SWEEP__", j(sw))
        (HERE / out).write_text(html)
    have = sorted({n for v in sw.values() for n in v})
    print(f"analysis.html {len(html) / 1e6:.1f}MB · BPM 방법 {have}")

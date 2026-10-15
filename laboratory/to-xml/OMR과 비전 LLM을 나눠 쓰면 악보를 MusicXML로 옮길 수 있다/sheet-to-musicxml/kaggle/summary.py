# Kaggle CPU kernel: aggregate candidate scores + rhythm-consistency (fixed measure regex).
# Inputs (kernel_sources): gunhe17/sheet-xml-audiveris, gunhe17/sheet-xml-vlm
# Output: /kaggle/working/out/summary.json  (numbers only, no melody content)
import glob, json, os, re, statistics as st, zipfile

OUT = "/kaggle/working/out"; os.makedirs(OUT, exist_ok=True)
AUD = glob.glob("/kaggle/input/**/out/scores_audiveris_A.json", recursive=True)[0].rsplit("/", 1)[0]
VLM = [p.rsplit("/", 1)[0] for p in glob.glob("/kaggle/input/**/out/scores_*VL*_A.json", recursive=True)]
VLM = VLM[0] if VLM else None
print("audiveris:", AUD, "| vlm:", VLM, flush=True)

def read_xml(f):
    if f.endswith(".mxl"):
        z = zipfile.ZipFile(f); n = [x for x in z.namelist() if x.endswith(".xml") and "container" not in x][0]
        return z.read(n).decode("utf-8", "ignore")
    return open(f, encoding="utf-8", errors="ignore").read()

def rhythm(x):
    div = re.search(r"<divisions>(\d+)</divisions>", x); div = int(div[1]) if div else 1
    b = re.search(r"<beats>(\d+)</beats>\s*<beat-type>(\d+)</beat-type>", x, re.S)
    beats, btype = (int(b[1]), int(b[2])) if b else (4, 4)
    expect = beats * div * 4 // btype
    parts = re.split(r"(<measure(?:\s[^>]*)?>)", x)[1:]          # not <measure-numbering>
    ms = [body.split("</measure>")[0] for body in parts[1::2]]
    ok = partial = bad = 0
    for i, mt in enumerate(ms):
        cur = 0
        for tag, body in re.findall(r"<(note|backup|forward)\b[^>]*>(.*?)</\1>", mt, re.S):
            d = re.search(r"<duration>(\d+)</duration>", body)
            if not d: continue
            v = int(d[1])
            cur += -v if tag == "backup" else (0 if tag == "note" and "<chord" in body else v)
        if cur == expect: ok += 1
        elif i in (0, len(ms) - 1) and 0 < cur < expect: partial += 1
        else: bad += 1
    k = re.search(r"<fifths>(-?\d+)</fifths>", x)
    return {"measures": len(ms), "ok": ok, "partial": partial, "bad": bad, "fifths": int(k[1]) if k else None}

def rhythm_dir(pattern, exclude=None):
    res = {}
    files = sorted(glob.glob(pattern))
    if exclude: files = [f for f in files if not re.match(exclude, os.path.basename(f))]
    for f in files:
        try: res[os.path.basename(f)] = rhythm(read_xml(f))
        except Exception as e: res[os.path.basename(f)] = {"error": repr(e)[:120]}
    tot = [v for v in res.values() if "ok" in v]
    m = sum(v["measures"] for v in tot)
    return {"files": res, "total": {"files": len(tot), "measures": m, "ok": sum(v["ok"] for v in tot),
            "partial": sum(v["partial"] for v in tot), "bad": sum(v["bad"] for v in tot),
            "ok_rate": round(sum(v["ok"] for v in tot) / m, 4) if m else None}}

def agg(scores):
    out = {}
    for var in ("clean", "lowres"):
        out[var] = {}
        rows = {k: d for k, d in scores.items() if k.endswith(var)}
        for det in ("notes", "signatures", "barlines", "chords", "lyrics", "all"):
            v = [d[det]["omr_ned"] for d in rows.values() if isinstance(d.get(det), dict) and d[det].get("omr_ned") is not None]
            out[var][det] = None if not v else {"mean": round(st.mean(v), 4), "median": round(st.median(v), 4),
                                                "min": round(min(v), 4), "max": round(max(v), 4), "n": len(v),
                                                "over_0_5": sum(x > 0.5 for x in v)}
        out[var]["per_song_notes"] = {k.rsplit("_", 1)[0]: (d.get("notes") or {}).get("omr_ned") for k, d in rows.items()}
    return out

summary = {"setA": json.load(open(f"{AUD}/setA.json")), "candidates": {}}
summary["candidates"]["audiveris"] = {
    "scores": agg(json.load(open(f"{AUD}/scores_audiveris_A.json"))),
    "rhythm_A": rhythm_dir(f"{AUD}/audiveris/A/*.mxl")["total"],
    "rhythm_B": rhythm_dir(f"{AUD}/audiveris/B/*.mxl"),
    "timing_s": json.load(open(f"{AUD}/audiveris/timing.json")),
}
if VLM:
    for sf in glob.glob(f"{VLM}/scores_*_A.json"):
        name = os.path.basename(sf)[len("scores_"):-len("_A.json")]
        d = json.load(open(sf))
        summary["candidates"][name] = {
            "scores": agg(d["scores"]),
            "abc_convert_ok": {"ok": sum(d["convert_ok"].values()), "n": len(d["convert_ok"])},
            "rhythm_A": rhythm_dir(f"{VLM}/{name}/a[0-9][0-9]_*.musicxml")["total"],
            "rhythm_B": rhythm_dir(f"{VLM}/{name}/*.musicxml", exclude=r"a\d\d_"),  # set A ids are a00..a19
            "timing_s": json.load(open(f"{VLM}/{name}/_timing.json")) if os.path.exists(f"{VLM}/{name}/_timing.json") else {},
        }
json.dump(summary, open(f"{OUT}/summary.json", "w"), ensure_ascii=False, indent=1)
for name, c in summary["candidates"].items():
    print(name, {v: (c["scores"][v]["notes"] or {}).get("mean") for v in ("clean", "lowres")},
          "rhythm A", c["rhythm_A"].get("ok_rate"), "B", c["rhythm_B"]["total"].get("ok_rate"), flush=True)

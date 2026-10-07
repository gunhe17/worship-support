# Reference-free proxy comparison of the 3 STT models on per-section crops (no ground-truth lyrics available).
import json, re, glob
from difflib import SequenceMatcher
from statistics import mean
M = ["whisper-large-v3", "whisper-turbo-ko-ghost613", "qwen3-asr-1.7b"]
HALLU = ["한글자막", "자막", "감사합니다", "안녕하세요", "시청", "구독", "좋아요", "영상"]
norm = lambda t: re.sub(r"[^가-힣a-zA-Z0-9]", "", t or "")
sim = lambda a, b: SequenceMatcher(None, a, b).ratio() if a and b else 0.0
loopy = lambda t: bool(re.search(r"(.{2,8}?)\1{3,}", norm(t)))
st = {m: {"n": 0, "hallu": 0, "loop": 0, "empty": 0, "consensus": [], "mixvoc": [], "chars": []} for m in M}
for f in sorted(glob.glob("results/kaggle-v1/out/*.json")):
    if f.endswith(("segments.json", "timing.json")): continue
    songid = f.split("/")[-1][:-5]
    g6 = json.load(open(f"results/kaggle-ghost613/out/{songid}.ghost613.json"))
    for i, g in enumerate(json.load(open(f))["sections"]):
        g["stt"]["whisper-turbo-ko-ghost613"] = g6[str(i)]
        for inp in ("mix", "vocals"):
            for m in M:
                t = g["stt"][m][inp]; s = st[m]; s["n"] += 1
                s["hallu"] += any(h in t for h in HALLU); s["loop"] += loopy(t); s["empty"] += len(norm(t)) < 2
                s["chars"].append(len(norm(t)))
                others = [norm(g["stt"][o][inp]) for o in M if o != m]
                s["consensus"].append(mean(sim(norm(t), o) for o in others))
        for m in M:
            st[m]["mixvoc"].append(sim(norm(g["stt"][m]["mix"]), norm(g["stt"][m]["vocals"])))
print(f"{'model':<28}{'crops':>6}{'hallu%':>8}{'loop%':>7}{'empty%':>8}{'consensus':>10}{'mix~voc':>9}{'avg chars':>10}")
for m in M:
    s = st[m]; n = s["n"]
    print(f"{m:<28}{n:>6}{100*s['hallu']/n:>8.1f}{100*s['loop']/n:>7.1f}{100*s['empty']/n:>8.1f}{mean(s['consensus']):>10.3f}{mean(s['mixvoc']):>9.3f}{mean(s['chars']):>10.1f}")

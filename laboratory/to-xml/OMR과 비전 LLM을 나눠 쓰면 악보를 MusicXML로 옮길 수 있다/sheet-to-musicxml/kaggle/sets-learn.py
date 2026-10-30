# Kaggle CPU: a learned word classifier in place of the hand rules' last step (LOG 59). Per GT word box (sets-gt.json,
# LOG 55) matched to a sets v9 token: geometry vs the staves, OCR text / confidence, row neighbours, the rules' own call.
# Leave-one-sheet-out gradient boosting (train on 13 sheets, score the 14th) vs the rules on the same boxes (C/L/N/X).
import glob, json, re
import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier

GT = json.load(open(next(iter(glob.glob("/kaggle/input/**/sets-gt.json", recursive=True)))))
SETS = json.load(open(next(iter(glob.glob("/kaggle/input/**/sets.json", recursive=True)))))["sheets"]
HANGUL = re.compile(r"[가-힣ㄱ-ㅎㅏ-ㅣ]")
CHORD = re.compile(r"[(\[]?[A-G][#b♯♭]?(?:maj|min|dim|aug|sus|add|m|M|[0-9]|[+\-°ø()])*(?:/[A-G][#b♯♭]?)?[)\]]?")
RULE = {"chord": "C", "lyric": "L", "staff": "N", "ignore": "X"}
LABELS = "CLNX"


def text_features(t, conf):
    s = t.replace(" ", "").replace("I", "/").replace("|", "/")
    return [conf, len(s), bool(HANGUL.search(t)), bool(CHORD.fullmatch(s)), bool(re.match(r"[(\[]?[A-G]", s)),
            bool(re.fullmatch(r"[0-9]+\.?", s)), bool(re.search(r"[A-Za-z]{2,}", t)), bool(re.fullmatch(r"[-~_=]+", s))]


def features(sheet, q, tokens):
    p = sheet["p"]; x0, y0, x1, y1 = q["box"]; cy, cx = (y0 + y1) / 2, (x0 + x1) / 2
    st = [s["staff_box"] for s in sheet["sets"]]
    xs = [s for s in st if s[0] - 2 * p < x1 and x0 < s[1] + 2 * p] or st
    above = min([cy - s[3] for s in xs if s[3] < cy], default=99 * p); below = min([s[2] - cy for s in xs if s[2] > cy], default=99 * p)
    inside = any(s[2] <= cy <= s[3] for s in xs)
    near = min(xs, key=lambda s: min(abs(cy - s[2]), abs(cy - s[3])))
    row = [t for t in tokens if t is not q and abs((t["box"][1] + t["box"][3]) / 2 - cy) < 0.5 * max(1, y1 - y0) and abs((t["box"][0] + t["box"][2]) / 2 - cx) < 30 * p]
    rh = [bool(HANGUL.search(t["text"])) and t["conf"] >= 0.5 for t in row]
    rc = [bool(CHORD.fullmatch(t["text"].replace(" ", ""))) for t in row]
    gap = min([abs(t["box"][0] - x1) for t in row] + [abs(x0 - t["box"][2]) for t in row], default=99 * p)
    return [(y1 - y0) / p, (x1 - x0) / p, (x1 - x0) / max(1, y1 - y0), min(above, 99 * p) / p, min(below, 99 * p) / p, inside,
            (x0 - near[0]) / p, (near[1] - x1) / p, cy / 3508, len(row), np.mean(rh) if rh else 0, np.mean(rc) if rc else 0, gap / p,
            *text_features(q["text"], q["conf"]),
            *[q["row"] == k for k in ("chord", "lyric", "other")], *[q["cls"] == k for k in RULE]]


# data
X, y, group, rule = [], [], [], []
for stem, rows in GT.items():
    sheet = SETS[stem]; tk = {tuple(t["box"]): t for t in sheet["tokens"]}
    for kind, x0, y0, x1, y1, want in rows:
        q = tk.get((x0, y0, x1, y1))
        if kind != "w" or q is None: continue
        X.append(features(sheet, q, sheet["tokens"])); y.append(want); group.append(stem); rule.append(RULE[q["cls"]])
X = np.array(X, float); y = np.array(y); group = np.array(group); rule = np.array(rule)
print("boxes", len(y), "sheets", len(set(group)), flush=True)

# leave one sheet out
pred = np.empty_like(y)
for variant, cols in (("with-rules", slice(None)), ("no-rules", slice(0, X.shape[1] - 4))):
    for i, stem in enumerate(sorted(set(group)), 1):
        tr, te = group != stem, group == stem
        model = HistGradientBoostingClassifier(max_iter=300, learning_rate=0.08, random_state=0).fit(X[tr][:, cols], y[tr])
        pred[te] = model.predict(X[te][:, cols])
        print(f"progress {i}/14 0s {variant}", flush=True)
    per = {s: [int((rule[group == s] == y[group == s]).sum()), int((pred[group == s] == y[group == s]).sum()), int((group == s).sum())] for s in sorted(set(group))}
    conf = {}
    for a, b in zip(y, pred):
        if a != b: conf[f"{a}>{b}"] = conf.get(f"{a}>{b}", 0) + 1
    print("selftest", variant, "rules", int((rule == y).sum()), "learned", int((pred == y).sum()), "/", len(y),
          "errors", sorted(conf.items(), key=lambda q: -q[1]), flush=True)
    print("selftest", variant, "per sheet [rules, learned, n]", json.dumps(per), flush=True)

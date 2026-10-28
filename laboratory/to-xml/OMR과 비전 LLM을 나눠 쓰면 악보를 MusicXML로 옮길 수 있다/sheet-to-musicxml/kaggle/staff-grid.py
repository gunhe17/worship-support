# Kaggle CPU probe: can the page's staff grid find the staves v1 missed (LOG 44-46)?
# Staves on one page share the x range, the body height (4 gaps) and a regular system pitch. From the detected staves
# predict where more staves should be (gaps of >= 2 pitches = "inside", beyond the first/last = "outside") and measure
# deterministic evidence there; the same evidence on the detected staves ("found") and halfway between two staves
# ("mid", chord/lyric rows) are the references.
# Evidence at a position (best top within +-1 gap):
#   s: per slot (5 lines, gap apart) median over the staff columns of the line response (staff-500 response(), max +-2 rows)
#   b: same between the slots (half a gap off)      -> structure = strong slots, empty between
#   edge_l / edge_r: share of rows top..bottom where the column band at the staff's x start / end is ink (< ink_T)
#   out_l / out_r: same share 1-2 gaps above and below (a system barline stops at the staff)
import glob, json, os
import cv2, numpy as np
from PIL import Image

OUT = "/kaggle/working/out"; os.makedirs(f"{OUT}/crops", exist_ok=True)
W8 = 2480

def load(path):
    pim = Image.open(path).convert("RGBA"); bg = Image.new("RGBA", pim.size, (255, 255, 255, 255)); bg.alpha_composite(pim)
    return cv2.cvtColor(np.array(bg.convert("RGB")), cv2.COLOR_RGB2BGR)

def response(g, k):
    return cv2.morphologyEx(g, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (1, int(k)))).astype(np.float32) - g

found = glob.glob("/kaggle/input/**/staff.json", recursive=True)
staff = json.load(open(next(p for p in found if "p6x" not in p)))["sheets"]
p6x = json.load(open(next(p for p in found if "p6x" in p)))["sheets"]
paths = {os.path.basename(p).rsplit(".", 1)[0]: p for p in glob.glob("/kaggle/input/**/*", recursive=True)
         if p.lower().endswith((".png", ".jpg", ".jpeg", ".gif"))}

def main_staves(r):
    # body-spacing staves only (multi-head finds are other sizes, LOG 42)
    out = [dict(top=min(v[1][0] for v in s["strips"]), bot=max(v[1][4] for v in s["strips"]), x=s["x"])
           for s in r.get("staves", []) if s["head_p"] == r["p"]]
    return sorted(out, key=lambda s: s["top"])

def evidence(rmax, ink, y0, gap, x0, x1, H):
    best = None
    for y in range(int(y0 - gap), int(y0 + gap) + 1):
        rows = [round(y + i * gap) for i in range(5)]; mids = [round(y + (i + 0.5) * gap) for i in range(4)]
        if rows[0] < 0 or rows[-1] >= H: continue
        s = [float(np.median(rmax[v, x0:x1])) for v in rows]
        sc = sum(sorted(s)[-3:])
        if best is None or sc > best[0]: best = (sc, y, s, [float(np.median(rmax[v, x0:x1])) for v in mids])
    if best is None: return None
    _, y, s, b = best; y1 = round(y + 4 * gap); w = max(1, round(gap / 2))
    def share(xc, a, z):
        a, z = max(0, a), min(H, z)
        return round(float(ink[a:z, max(0, xc - w):xc + w + 1].any(axis=1).mean()), 3) if z > a else None
    edge = lambda xc: dict(on=share(xc, y, y1 + 1), up=share(xc, round(y - 2 * gap), round(y - gap)),
                           dn=share(xc, round(y1 + gap), round(y1 + 2 * gap)))
    return dict(y=y, s=[round(v, 1) for v in s], b=[round(v, 1) for v in b], left=edge(x0), right=edge(x1))

res = {}
for stem in sorted(staff):
    r = p6x.get(stem) or staff[stem]; st = main_staves(r)
    if len(st) < 2 or stem not in paths: res[stem] = dict(skip=f"{len(st)} staves"); continue
    img = load(paths[stem]); f = W8 / img.shape[1]
    im = img if f == 1.0 else cv2.resize(img, None, fx=f, fy=f, interpolation=cv2.INTER_CUBIC if f > 1 else cv2.INTER_AREA)
    g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY); H = g.shape[0]
    rmax = cv2.dilate(response(g, r["k"]), np.ones((5, 1), np.uint8)); ink = g < r["ink_T"]
    gap = float(np.median([s["bot"] - s["top"] for s in st])) / 4
    x0 = int(np.median([s["x"][0] for s in st])); x1 = int(np.median([s["x"][1] for s in st]))
    tops = [s["top"] for s in st]; d = np.diff(tops)
    pitch = float(np.median(d[d <= 1.4 * d.min()]))
    pos = [("found", t) for t in tops] + [("mid", (a + b) / 2) for a, b in zip(tops, tops[1:]) if b - a < 1.4 * pitch]
    for a, b in zip(tops, tops[1:]):
        n = round((b - a) / pitch)
        if n >= 2 and abs((b - a) / n - pitch) <= 0.25 * pitch: pos += [("inside", a + j * (b - a) / n) for j in range(1, n)]
    for sign, start in ((-1, tops[0]), (1, tops[-1])):
        y = start + sign * pitch
        while 0 <= y and y + 4 * gap < H and len([p for p in pos if p[0] == "outside"]) < 6: pos.append(("outside", y)); y += sign * pitch
    out = []
    for kind, y0 in pos:
        e = evidence(rmax, ink, y0, gap, x0, x1, H)
        if e: out.append(dict(kind=kind, y0=round(y0), **e))
    res[stem] = dict(p=r["p"], tau=r["tau"], gap=round(gap, 2), pitch=round(pitch, 1), x=[x0, x1], H=H, pos=out)
    for i, e in enumerate(out):
        if e["kind"] in ("inside", "outside"):
            y = e["y"]; a = max(0, round(y - 3 * gap)); crop = im[a:round(y + 7 * gap)].copy()
            cv2.rectangle(crop, (x0, y - a), (x1, round(y + 4 * gap) - a), (0, 160, 0), 2)
            cv2.imwrite(f"{OUT}/crops/{stem}_{i}_{e['kind']}.jpg", cv2.resize(crop, (1240, max(1, round(crop.shape[0] * 0.5)))), [cv2.IMWRITE_JPEG_QUALITY, 85])
    print(stem, "pitch", round(pitch), [(e["kind"], e["y"], [round(v) for v in e["s"]], e["left"]["on"]) for e in out if e["kind"] != "found"], flush=True)

json.dump(res, open(f"{OUT}/grid.json", "w"), separators=(",", ":"))
# summary per kind: weakest of the 3 strongest slots / tau, mean between / tau, left/right edge coverage
rows = [(e["kind"], sorted(e["s"])[-3] / v["tau"], np.mean(e["b"]) / v["tau"], e["left"]["on"], e["right"]["on"])
        for v in res.values() if "pos" in v for e in v["pos"]]
for kind in ("found", "mid", "inside", "outside"):
    a = np.array([x[1:] for x in rows if x[0] == kind], dtype=float)
    if len(a): print(kind, len(a), "q10/50/90 top3/tau", np.round(np.percentile(a[:, 0], [10, 50, 90]), 2),
                     "between/tau", np.round(np.percentile(a[:, 1], [10, 50, 90]), 2),
                     "edgeL", np.round(np.percentile(a[:, 2], [10, 50, 90]), 2), "edgeR", np.round(np.percentile(a[:, 3], [10, 50, 90]), 2), flush=True)

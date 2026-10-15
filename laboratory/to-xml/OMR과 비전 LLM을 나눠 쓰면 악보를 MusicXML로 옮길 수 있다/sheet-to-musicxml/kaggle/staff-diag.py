# Kaggle CPU diagnostic: why did staff_systems() miss one staff on 2 pages? Replays every step on the same working image
# (alpha flattened, width 2000) and records: each candidate line row (y, fraction of page width covered after the
# horizontal opening), the grouping into staves (gap threshold = 2.5 x median line spacing), which groups were kept (>=5
# lines) and why others were dropped. Also saves a picture: page with every candidate line drawn, coloured by the staff
# group it ended in (grey = dropped group), plus the per-row coverage profile in the missed staff's y range.
import glob, json, os
import cv2, numpy as np
from PIL import Image

OUT = "/kaggle/working/out"; os.makedirs(OUT, exist_ok=True)
CASES = {"markers_ju-ui-ireum-nopimyeo_1": (1357, 1452), "welove_loving-you-more_1": (1058, 1211)}   # missed rows (y0, y1)

def runs(mask):
    idx = np.flatnonzero(np.diff(np.r_[0, mask.astype(np.int8), 0])); return list(zip(idx[::2], idx[1::2]))

res = {}
for path in glob.glob("/kaggle/input/**/*", recursive=True):
    stem = os.path.basename(path).rsplit(".", 1)[0]
    if stem not in CASES: continue
    pim = Image.open(path).convert("RGBA"); bg = Image.new("RGBA", pim.size, (255, 255, 255, 255)); bg.alpha_composite(pim)
    img = cv2.cvtColor(np.array(bg.convert("RGB")), cv2.COLOR_RGB2BGR)
    k = 2000 / img.shape[1]; img = cv2.resize(img, None, fx=k, fy=k, interpolation=cv2.INTER_CUBIC if k > 1 else cv2.INTER_AREA)
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY); H, W = g.shape
    bw = cv2.threshold(g, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
    ad = cv2.adaptiveThreshold(g, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY_INV, 31, 15)
    both = cv2.bitwise_or(bw, ad)
    horiz = cv2.morphologyEx(both, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (max(20, W // 20), 1)))
    cover = horiz.sum(1) / (255 * W)                          # fraction of page width that is long-horizontal ink
    rr = runs(cover > 0.18)
    lines = [(a + b) // 2 for a, b in rr]
    diffs = np.diff(lines); typical = float(np.median(diffs))
    groups, cur = [], [lines[0]]
    for p, y in zip(lines, lines[1:]):
        if y - p <= typical * 2.5: cur.append(y)
        else: groups.append(cur); cur = [y]
    groups.append(cur)
    y0, y1 = CASES[stem]
    info = {"width": W, "height": H, "typical_spacing": typical, "n_candidate_lines": len(lines),
            "candidate_lines": [{"y": int(y), "run": [int(a), int(b)], "cover": round(float(cover[a:b].max()), 3)} for (a, b), y in zip(rr, lines)],
            "groups": [{"lines": [int(v) for v in gr], "n": len(gr), "kept": len(gr) >= 5,
                        "span": int(gr[-1] - gr[0]), "spacings": [int(v) for v in np.diff(gr)]} for gr in groups],
            "missed_range_profile": [{"y": int(y), "cover": round(float(cover[y]), 3)} for y in range(y0, y1) if cover[y] > 0.05]}
    res[stem] = info
    # picture: every candidate line coloured by group (kept groups cycle colours, dropped = grey), missed range boxed
    vis = img.copy()
    pal = [(214, 120, 42), (0, 140, 0), (0, 0, 220), (180, 0, 180), (0, 160, 200)]
    for gi, gr in enumerate(groups):
        col = pal[gi % len(pal)] if len(gr) >= 5 else (150, 150, 150)
        for y in gr: cv2.line(vis, (0, int(y)), (W - 1, int(y)), col, 2)
        cv2.putText(vis, f"g{gi}:{len(gr)}", (5, int(gr[0]) - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.9, col, 2)
    cv2.rectangle(vis, (0, y0), (W - 1, y1), (0, 0, 255), 3)
    cv2.imwrite(f"{OUT}/{stem}_lines.jpg", cv2.resize(vis, (1000, round(H * 1000 / W))), [cv2.IMWRITE_JPEG_QUALITY, 85])
    print(stem, json.dumps({k2: v for k2, v in info.items() if k2 != "candidate_lines"})[:3000], flush=True)
    # native-resolution check of the missed staff: crop (x4 nearest) + per-row darkest/median gray across the width
    ys0, ys1 = int((y0 - 10) / k), int((y1 + 10) / k)
    src = cv2.cvtColor(np.array(bg.convert("RGB")), cv2.COLOR_RGB2GRAY)[ys0:ys1]
    left = src[:, : src.shape[1] // 3]
    cv2.imwrite(f"{OUT}/{stem}_native_crop.png", cv2.resize(left, None, fx=4, fy=4, interpolation=cv2.INTER_NEAREST))
    info["native_rows"] = [{"y_native": int(ys0 + i), "min": int(r.min()), "p10": int(np.percentile(r, 10)), "median": int(np.median(r))}
                           for i, r in enumerate(src)]
    info["native_scale"] = round(1 / k, 3)
json.dump(res, open(f"{OUT}/staff_diag.json", "w"), indent=1)

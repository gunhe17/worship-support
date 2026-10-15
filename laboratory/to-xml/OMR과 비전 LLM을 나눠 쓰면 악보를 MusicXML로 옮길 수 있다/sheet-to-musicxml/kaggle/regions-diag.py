# Kaggle CPU diagnostic (one sheet): why v7's dilated-note mask did not pull the tie under markers system 4 into the staff.
# Recomputes v7's staff components for that system (same thresholds, no OCR: the lyric boxes are known to be 30px below),
# then lists every non-staff component below the staff that is wider than 2 line gaps (tie/slur candidates) with the
# numbers each v7 condition used. Also counts how the same area splits under Otsu ink vs v7's dark-ink threshold.
import glob, json, os
import cv2, numpy as np

OUT = "/kaggle/working/out"; os.makedirs(OUT, exist_ok=True)
SYS = 3                                                    # 0-based: 4th system
def runs(mask):
    idx = np.flatnonzero(np.diff(np.r_[0, mask.astype(np.int8), 0])); return list(zip(idx[::2], idx[1::2]))
def staff_mask(bw):
    return cv2.morphologyEx(bw, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (max(20, bw.shape[1] // 20), 1)))
def staff_systems(bw):
    horiz = staff_mask(bw); w = bw.shape[1]
    lines = [(a + b) // 2 for a, b in runs(horiz.sum(1) > 0.18 * 255 * w)]
    typical = np.median(np.diff(lines)) or 1
    groups, cur = [], [lines[0]]
    for p, y in zip(lines, lines[1:]):
        if y - p <= typical * 2.5: cur.append(y)
        else: groups.append(cur); cur = [y]
    groups.append(cur); out = []
    for g in groups:
        if len(g) < 5: continue
        cols = np.flatnonzero(horiz[g[0]:g[-1] + 1].any(0))
        out.append((g[0], g[-1], (g[-1] - g[0]) / 4, int(cols.min()), int(cols.max())))
    return out

path = next(p for p in glob.glob("/kaggle/input/**/*", recursive=True) if "markers" in p and p.lower().endswith((".png", ".jpg", ".jpeg")))
img = cv2.imread(path); k = 2000 / img.shape[1]
img = cv2.resize(img, None, fx=k, fy=k, interpolation=cv2.INTER_CUBIC if k > 1 else cv2.INTER_AREA)
g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY); H, W = g.shape
otsu_t, bw = cv2.threshold(g, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
ad = cv2.adaptiveThreshold(g, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY_INV, 31, 15)
top, bot, gap, x0, x1 = staff_systems(cv2.bitwise_or(bw, ad))[SYS]
thr = min(otsu_t, 150); dark = ((g < thr) * 255).astype(np.uint8)
n, lab, stats, _ = cv2.connectedComponentsWithStats(dark, connectivity=8)
band = lab[top:bot + 1, x0:x1 + 1]; ids = set(np.unique(band[band > 0]).tolist())
y0, y1, keep = top, bot, []
for i in ids:
    x, y, w, h, a = stats[i]
    if h > 12 * gap: continue
    y0, y1 = min(y0, y), max(y1, y + h); keep.append(i)
r = max(1, int(round(gap))); yA, yB = max(0, y0 - r), min(H, y1 + r + 1)
near_full = np.zeros_like(g, np.uint8)
near_full[yA:yB] = cv2.dilate(np.isin(lab[yA:yB], keep).astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1)))
info = {"image": os.path.basename(path), "otsu_threshold": float(otsu_t), "dark_threshold": float(thr), "lines": [int(top), int(bot)],
        "gap": round(float(gap), 2), "staff_box_y": [int(y0), int(y1)], "radius_px": r, "window_y": [int(yA), int(yB)], "candidates": []}
keepset = set(keep)
for i in range(1, n):
    x, y, w, h, a = map(int, stats[i])
    if i in keepset or w < 2 * gap or y < bot or y > bot + 4 * gap or x + w < x0 or x > x1: continue
    m = lab == i; ys, xs = np.nonzero(m)
    # the same area under Otsu ink: how many pieces does the curve make there?
    sub_otsu = bw[y:y + h, x:x + w] > 0
    n_otsu = cv2.connectedComponents(sub_otsu.astype(np.uint8), connectivity=8)[0] - 1
    n_dark = cv2.connectedComponents((dark[y:y + h, x:x + w] > 0).astype(np.uint8), connectivity=8)[0] - 1
    info["candidates"].append({
        "id": i, "bbox_xywh": [x, y, w, h], "w_gaps": round(w / gap, 2), "h_gaps": round(h / gap, 2), "area": a,
        "in_window": bool(y >= yA and y + h <= yB), "bottom_minus_windowB": int(y + h - yB),
        "inside_fraction": round(float(near_full[m].mean()), 3),
        "left_end_inside": bool(near_full[ys[xs.argmin()], xs.min()]), "right_end_inside": bool(near_full[ys[xs.argmax()], xs.max()]),
        "gap_to_lines_top_gaps": round((y - bot) / gap, 2),
        "pieces_dark_in_bbox": int(n_dark), "pieces_otsu_in_bbox": int(n_otsu),
        "mean_gray": round(float(g[m].mean()), 1)})
    # crop for eyes: gray | dark mask | mask overlay (red = dilated note mask, blue = this component)
    pad = 2 * r; ya, yb, xa, xb = max(0, y - pad * 2), min(H, y + h + pad), max(0, x - pad), min(W, x + w + pad)
    vis = cv2.cvtColor(g[ya:yb, xa:xb], cv2.COLOR_GRAY2BGR)
    ov = vis.copy(); ov[near_full[ya:yb, xa:xb] > 0] = (80, 80, 255); ov[m[ya:yb, xa:xb]] = (255, 120, 0)
    big = lambda z: cv2.resize(z, None, fx=4, fy=4, interpolation=cv2.INTER_NEAREST)
    cv2.imwrite(f"{OUT}/cand_{i}.png", np.vstack([big(vis), big(cv2.cvtColor(dark[ya:yb, xa:xb], cv2.COLOR_GRAY2BGR)), big(ov)]))
print(json.dumps(info, indent=1))
json.dump(info, open(f"{OUT}/diag.json", "w"), indent=1)

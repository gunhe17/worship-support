# Kaggle CPU diagnostic (6 sheets): is "calibrate the ink threshold per sheet from the staff lines' own darkness" valid?
# Old rule: ink = gray < min(Otsu, 150)  (added to stop a light watermark bridging lyrics to the staff; side effect: light
# staff lines / stems vanished). New rule: measure the gray of the detected staff-line pixels and of the paper, then
#   T = line_p90 + 0.35 * (paper - line_p90)   -> anything at least about as dark as the staff lines is ink.
# Per sheet we report the numbers and save a picture: black = ink under both, red = ink only under the new rule (recovered),
# cyan = non-paper pixels still excluded by the new rule (should be watermark), plus the height of the staff-connected
# component under each rule (a jump means the watermark started bridging text into the staff).
import glob, json, os
import cv2, numpy as np
from PIL import Image

OUT = "/kaggle/working/out"; os.makedirs(OUT, exist_ok=True)
PICK = ["ywam_first-and-last_1", "hillsong_still_1", "fia_my-jesus_1", "agapao_i-remember-psalm77_1", "jus_return-to-lord_1", "markers_love-of-god_1"]

def runs(mask):
    idx = np.flatnonzero(np.diff(np.r_[0, mask.astype(np.int8), 0])); return list(zip(idx[::2], idx[1::2]))
def staff_mask(bw):
    return cv2.morphologyEx(bw, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (max(20, bw.shape[1] // 20), 1)))
def staff_systems(bw):
    horiz = staff_mask(bw); w = bw.shape[1]
    lines = [(a + b) // 2 for a, b in runs(horiz.sum(1) > 0.18 * 255 * w)]
    if len(lines) < 5: return [], horiz
    typical = np.median(np.diff(lines)) or 1
    groups, cur = [], [lines[0]]
    for p, y in zip(lines, lines[1:]):
        if y - p <= typical * 2.5: cur.append(y)
        else: groups.append(cur); cur = [y]
    groups.append(cur)
    return [(g[0], g[-1], (g[-1] - g[0]) / 4) for g in groups if len(g) >= 5], horiz

def staff_component_extent(ink, systems):
    """median height (in line gaps) of the union of components touching each staff's lines"""
    n, lab, st, _ = cv2.connectedComponentsWithStats(ink.astype(np.uint8), connectivity=8)
    hs = []
    for top, bot, gap in systems:
        ids = set(np.unique(lab[top:bot + 1][lab[top:bot + 1] > 0]).tolist())
        if not ids: continue
        y0 = min(st[i][1] for i in ids); y1 = max(st[i][1] + st[i][3] for i in ids)
        hs.append((y1 - y0) / gap)
    return round(float(np.median(hs)), 2) if hs else None, round(float(max(hs)), 2) if hs else None

res = {}
for path in sorted(glob.glob("/kaggle/input/**/*", recursive=True)):
    stem = os.path.basename(path).rsplit(".", 1)[0]
    if stem not in PICK: continue
    pim = Image.open(path).convert("RGBA"); bg = Image.new("RGBA", pim.size, (255, 255, 255, 255)); bg.alpha_composite(pim)
    img = cv2.cvtColor(np.array(bg.convert("RGB")), cv2.COLOR_RGB2BGR)
    def line_gray(im):
        g0 = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
        o0, b0 = cv2.threshold(g0, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        a0 = cv2.adaptiveThreshold(g0, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY_INV, 31, 15)
        sy, hz = staff_systems(cv2.bitwise_or(b0, a0)); px = []
        for top, bot, gap in sy:
            for yl in range(top, bot + 1):
                if hz[yl].sum() > 0.18 * 255 * g0.shape[1]: px.append(g0[max(0, yl - 1):yl + 2].min(0)[hz[yl] > 0])
        px = np.concatenate(px) if px else np.array([0])
        return {"width": im.shape[1], "systems": len(sy), "line_p50": float(np.percentile(px, 50)), "line_p90": float(np.percentile(px, 90))}
    orig = line_gray(img)
    k = 2000 / img.shape[1]; img = cv2.resize(img, None, fx=k, fy=k, interpolation=cv2.INTER_CUBIC if k > 1 else cv2.INTER_AREA)
    resized = line_gray(img)
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    otsu, bw = cv2.threshold(g, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    ad = cv2.adaptiveThreshold(g, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY_INV, 31, 15)
    systems, horiz = staff_systems(cv2.bitwise_or(bw, ad))
    # staff-line pixels = the long horizontal structure on the detected line rows (thin core: the darkest pixel per column)
    line_px = []
    for top, bot, gap in systems:
        for yl in range(top, bot + 1):
            if horiz[yl].sum() > 0.18 * 255 * g.shape[1]:
                line_px.append(g[max(0, yl - 1):yl + 2].min(0)[horiz[yl] > 0])
    line_px = np.concatenate(line_px) if line_px else np.array([0])
    paper = float(np.percentile(g, 90))           # most of the page is paper
    lp50, lp90 = float(np.percentile(line_px, 50)), float(np.percentile(line_px, 90))
    T = lp90 + 0.35 * (paper - lp90)
    old = g < min(otsu, 150); new = g < T
    nonpaper_excluded = (g >= T) & (g < paper - 12)
    # colour page: black both, red recovered, cyan excluded non-paper
    vis = np.full_like(img, 255)
    vis[old & new] = (0, 0, 0); vis[new & ~old] = (0, 0, 230); vis[nonpaper_excluded] = (230, 200, 0)
    vis = cv2.resize(vis, (1000, round(vis.shape[0] * 1000 / vis.shape[1])), interpolation=cv2.INTER_AREA)
    cv2.imwrite(f"{OUT}/{stem}_ink.png", vis)
    # colour of excluded non-paper pixels (is the watermark coloured?) -> mean saturation
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    res[stem] = {"orig": orig, "resized": resized, "systems": len(systems), "otsu": round(float(otsu), 1), "old_T": round(float(min(otsu, 150)), 1),
                 "line_gray_p50": round(lp50, 1), "line_gray_p90": round(lp90, 1), "paper_gray": round(paper, 1), "new_T": round(T, 1),
                 "ink_px_old": int(old.sum()), "ink_px_new": int(new.sum()), "recovered_px": int((new & ~old).sum()),
                 "excluded_nonpaper_px": int(nonpaper_excluded.sum()),
                 "excluded_mean_saturation": round(float(hsv[..., 1][nonpaper_excluded].mean()), 1) if nonpaper_excluded.any() else None,
                 "staff_extent_gaps_old": staff_component_extent(old, systems), "staff_extent_gaps_new": staff_component_extent(new, systems)}
    print(stem, res[stem], flush=True)
json.dump(res, open(f"{OUT}/ink.json", "w"), indent=1)

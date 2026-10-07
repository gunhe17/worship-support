# Kaggle CPU diagnostic (7 sheets): compare ink thresholds
#   A staff   : current stage 0 (staff-line gray p90 + 0.35*(paper-p90), floor min(Otsu,150))
#   B dist    : distribution only - 3-class multi-Otsu on NON-paper pixels (g < paper-8); ink = darkest class
#   C hybrid  : candidate thresholds = histogram valleys of non-paper pixels + multi-Otsu cuts; pick the LOWEST candidate
#               that keeps >= 90% of the core pixels of the confidently found staves (falls back to B if none found)
# For each method: threshold, share of staff-line core pixels kept, and how many staves a line search on THAT ink finds
# (rows merged +-2 px, >= 5 evenly spaced lines). Picture per sheet: histogram with the three thresholds + three ink renders.
import glob, json, os
import cv2, numpy as np
from PIL import Image
from skimage.filters import threshold_multiotsu, threshold_triangle, threshold_li, threshold_yen, threshold_minimum

OUT = "/kaggle/working/out"; os.makedirs(OUT, exist_ok=True)
PICK_RENDER = ["ywam_first-and-last_1", "agapao_i-remember-psalm77_1", "fia_my-jesus_1", "jus_return-to-lord_1", "teamluke_built-together_1", "hillsong_still_1"]

def runs(mask):
    idx = np.flatnonzero(np.diff(np.r_[0, mask.astype(np.int8), 0])); return list(zip(idx[::2], idx[1::2]))
def find_staves(ink, merge=0, frac=0.18):
    """lines = rows whose long-horizontal ink covers > frac of the width; optional +-merge rows; staves = >=5 lines"""
    W = ink.shape[1]
    hz = cv2.morphologyEx(ink.astype(np.uint8) * 255, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (max(20, W // 20), 1)))
    if merge: hz = cv2.dilate(hz, np.ones((2 * merge + 1, 1), np.uint8))
    lines = [(a + b) // 2 for a, b in runs(hz.sum(1) > frac * 255 * W)]
    if len(lines) < 5: return [], hz
    typ = np.median(np.diff(lines)); groups, cur = [], [lines[0]]
    for p, y in zip(lines, lines[1:]):
        if y - p <= typ * 2.5: cur.append(y)
        else: groups.append(cur); cur = [y]
    groups.append(cur)
    return [g for g in groups if len(g) >= 5], hz

res = {}
for path in sorted(glob.glob("/kaggle/input/**/*", recursive=True)):
    stem = os.path.basename(path).rsplit(".", 1)[0]
    if not path.lower().endswith((".png", ".jpg", ".jpeg", ".gif")): continue
    pim = Image.open(path).convert("RGBA"); bg = Image.new("RGBA", pim.size, (255, 255, 255, 255)); bg.alpha_composite(pim)
    img = cv2.cvtColor(np.array(bg.convert("RGB")), cv2.COLOR_RGB2BGR)
    k = 2000 / img.shape[1]; img = cv2.resize(img, None, fx=k, fy=k, interpolation=cv2.INTER_CUBIC if k > 1 else cv2.INTER_AREA)
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY); H, W = g.shape
    otsu = cv2.threshold(g, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[0]; base = min(otsu, 150)
    paper = float(np.percentile(g, 90))
    # confident staves with the current detector (Otsu | adaptive)
    bw = g < otsu; ad = cv2.adaptiveThreshold(g, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY_INV, 31, 15) > 0
    staves0, hz0 = find_staves(bw | ad)
    core = []
    for grp in staves0:
        for yl in grp: core.append(g[max(0, yl - 1):yl + 2].min(0)[hz0[yl] > 0])
    core = np.concatenate(core) if core else np.array([], np.uint8)
    # A staff-based
    if core.size:
        p90 = float(np.percentile(core, 90)); TA = max(base, p90 + 0.35 * (paper - p90))
    else: TA = base
    # B distribution only
    nonpaper = g[g < paper - 8]
    try: cuts = [float(c) for c in threshold_multiotsu(nonpaper, classes=3)]
    except Exception: cuts = [float(otsu)]
    TB = cuts[0]
    # C hybrid: valleys of the smoothed non-paper histogram + multi-Otsu cuts, lowest one keeping >=90% of staff core
    hist = np.bincount(nonpaper, minlength=256).astype(float); sm = np.convolve(hist, np.ones(9) / 9, mode="same")
    valleys = [v for v in range(5, 250) if sm[v] < sm[v - 1] and sm[v] <= sm[v + 1] and sm[v] < 0.5 * sm[max(0, v - 30):v].max(initial=0)]
    cands = sorted(set([int(c) for c in cuts] + valleys))
    TC, why = TB, "fallback: no confident staff"
    if core.size:
        ok = [c for c in cands if (core < c).mean() >= 0.90]
        TC, why = (float(ok[0]), "lowest candidate keeping >=90% staff core") if ok else (TA, "no candidate kept 90% -> staff rule")
    # distribution-only thresholds (no staff knowledge). Shape/clustering/entropy methods on the whole page histogram,
    # plus edge-conditioned ones: gray of strong-gradient pixels (ink-paper boundaries; low-contrast watermark edges are weak)
    def safe(f):
        try: return float(f())
        except Exception: return float("nan")
    gx = cv2.Sobel(g, cv2.CV_32F, 1, 0, ksize=3); gy = cv2.Sobel(g, cv2.CV_32F, 0, 1, ksize=3); mag = np.hypot(gx, gy)
    strong = mag > max(1.0, float(cv2.threshold(np.clip(mag / mag.max() * 255, 0, 255).astype(np.uint8), 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[0]) / 255 * mag.max())
    near = cv2.dilate(strong.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    T_methods = {
        "D_otsu": float(otsu),
        "E_multi_upper": cuts[1] if len(cuts) > 1 else float(otsu),
        "F_triangle": safe(lambda: threshold_triangle(g)),
        "G_li": safe(lambda: threshold_li(g)),
        "H_yen": safe(lambda: threshold_yen(g)),
        "I_valley": safe(lambda: threshold_minimum(g)),
        "J_edge_median": float(np.median(g[strong])) if strong.any() else float("nan"),
        "K_edge_otsu": float(cv2.threshold(g[near].reshape(-1, 1), 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[0]) if near.any() else float("nan"),
    }
    flow = {}
    for name, T in T_methods.items():
        if not np.isfinite(T): flow[name] = {"T": None, "staves": 0, "groups_over5": 0, "staff_core_kept": None}; continue
        ink = g < T; st, _ = find_staves(ink, merge=2)
        six = sum(1 for grp in st if len(grp) > 5)
        flow[name] = {"T": round(T, 1), "staves": len(st), "groups_over5": six,
                      "staff_core_kept": round(float((core < T).mean()), 3) if core.size else None}
    out = {"flow": flow, "W": W, "otsu": round(otsu, 1), "paper": round(paper, 1), "staves_current_detector": len(staves0), "candidates": cands, "hybrid_reason": why}
    renders = []
    if stem not in PICK_RENDER:
        res[stem] = out; print(stem, json.dumps(flow), flush=True); continue
    for name, T in (("A_staff", TA), ("D_otsu", T_methods["D_otsu"]), ("F_triangle", T_methods["F_triangle"]), ("J_edge_median", T_methods["J_edge_median"])):
        ink = g < T
        st1, _ = find_staves(ink, merge=2)
        if not np.isfinite(T): T = TA
        out[name] = {"T": round(float(T), 1), "staff_core_kept": round(float((core < T).mean()), 3) if core.size else None,
                     "ink_share": round(float(ink.mean()), 4), "staves_found_merge2": len(st1)}
        r = np.where(ink, 0, 255).astype(np.uint8)
        r = cv2.resize(r, (600, round(H * 600 / W)), interpolation=cv2.INTER_AREA)
        r = cv2.cvtColor(r, cv2.COLOR_GRAY2BGR); cv2.putText(r, f"{name} T={T:.0f}", (8, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 230), 2)
        renders.append(r)
    # histogram plot (log counts of all pixels) with thresholds
    full = np.bincount(g.ravel(), minlength=256).astype(float); lg = np.log10(full + 1)
    ph, pw = renders[0].shape[0], 520; plot = np.full((ph, pw, 3), 255, np.uint8)
    bh = ph - 60
    for v in range(256):
        x = 10 + int(v * (pw - 20) / 255); hgt = int(lg[v] / lg.max() * (bh - 20))
        cv2.line(plot, (x, bh), (x, bh - hgt), (120, 120, 120), 2)
    for i_, ((name, T), col) in enumerate(zip((("A", TA), ("D", T_methods["D_otsu"]), ("F", T_methods["F_triangle"]), ("J", T_methods["J_edge_median"])), ((214, 120, 42), (0, 140, 0), (0, 0, 230), (180, 0, 180)))):
        if not np.isfinite(T): continue
        x = 10 + int(T * (pw - 20) / 255); cv2.line(plot, (x, 0), (x, bh), col, 2); cv2.putText(plot, f"{name}{T:.0f}", (min(x + 3, pw - 60), 20 + 22 * i_), cv2.FONT_HERSHEY_SIMPLEX, 0.6, col, 2)
    if core.size:
        for q, col in ((50, (180, 0, 180)), (90, (180, 0, 180))):
            x = 10 + int(np.percentile(core, q) * (pw - 20) / 255); cv2.line(plot, (x, bh), (x, bh + 15), col, 3)
    cv2.putText(plot, "gray 0 ... 255 (log count); purple ticks = staff line p50/p90", (8, ph - 20), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (60, 60, 60), 1)
    cv2.imwrite(f"{OUT}/{stem}_compare.jpg", np.hstack([plot] + renders), [cv2.IMWRITE_JPEG_QUALITY, 85])
    res[stem] = out
    print(stem, json.dumps(out), flush=True)
json.dump(res, open(f"{OUT}/dist.json", "w"), indent=1)

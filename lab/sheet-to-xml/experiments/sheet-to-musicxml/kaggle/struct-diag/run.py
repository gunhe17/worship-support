# Kaggle CPU experiment (100 sheets): find the staff STRUCTURE without any ink threshold, then derive the ink threshold from
# the gray distribution on the found staff lines.
# 1. thin-dark-line response, contrast based (no black/white decision): vertical black top-hat = closing(g, 1xk) - g.
#    A line printed light grey still is darker than the paper right above/below it, so it responds.
# 2. keep only LONG horizontal response (horizontal opening of the response), row score s(y) = mean over the row.
# 3. interline p from the autocorrelation of s(y); staves = combs of 5 teeth spaced p (+-2 px per tooth) on s(y) peaks;
#    a comb is accepted with >= 4 strong teeth (the 5th may be faint: "4 lines + a gap that fits").
# 4. ink threshold from the gray of the found line pixels: T = max(min(Otsu,150), p90 + 0.35*(paper - p90)).
# Compared with: expected staff count (current 698 + 2 known misses = 700) and the current stage-0 threshold.
import glob, json, os
import cv2, numpy as np
from PIL import Image

OUT = "/kaggle/working/out"; os.makedirs(OUT, exist_ok=True)
# staves missed by v2 (top line y from the current detector, working-image coordinates)
CASES = {"gospel_like-woman-at-the-well_1": [450, 1723], "jus_only-jesus_1": [2470]}
RENDER = {"ywam_first-and-last_1", "markers_ju-ui-ireum-nopimyeo_1", "welove_loving-you-more_1", "teamluke_built-together_1",
          "hillsong_still_1", "agapao_i-remember-psalm77_1"}

def local_peaks(s, min_gap):
    pk = [y for y in range(1, len(s) - 1) if s[y] >= s[y - 1] and s[y] > s[y + 1]]
    pk.sort(key=lambda y: -s[y]); keep = []
    for y in pk:
        if all(abs(y - z) >= min_gap for z in keep): keep.append(y)
    return sorted(keep)

res = {}
for path in sorted(p for p in glob.glob("/kaggle/input/**/*", recursive=True) if p.lower().endswith((".png", ".jpg", ".jpeg", ".gif"))):
    stem = os.path.basename(path).rsplit(".", 1)[0]
    pim = Image.open(path).convert("RGBA"); bg = Image.new("RGBA", pim.size, (255, 255, 255, 255)); bg.alpha_composite(pim)
    img = cv2.cvtColor(np.array(bg.convert("RGB")), cv2.COLOR_RGB2BGR)
    k = 2000 / img.shape[1]; img = cv2.resize(img, None, fx=k, fy=k, interpolation=cv2.INTER_CUBIC if k > 1 else cv2.INTER_AREA)
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY); H, W = g.shape
    # 1-2. long thin dark horizontal response
    th = cv2.morphologyEx(g, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (1, 9))).astype(np.float32) - g
    # v1 kept only uninterrupted long runs (horizontal opening): noteheads sitting on the middle lines break the response
    # into short pieces, so middle lines vanished and combs failed. Row score = median response over the central columns:
    # a staff line responds on most columns even if noteheads cover some of them; text rows respond only sporadically.
    x0c, x1c = W // 10, W - W // 10
    s = np.median(th[:, x0c:x1c], axis=1).astype(np.float32)
    longh = th                                          # line-pixel mask below uses the raw response
    # 3a. interline from autocorrelation of the line profile
    z = s - s.mean(); ac = np.correlate(z, z, mode="full")[len(z) - 1:]
    lags = np.arange(len(ac)); win = (lags >= 6) & (lags <= 60)
    p = int(lags[win][np.argmax(ac[win])])
    # 3b. strong-line level from the clearest peaks
    pk = local_peaks(s, max(3, p // 2))
    heights = np.array([s[y] for y in pk]); strong_level = float(np.percentile(heights, 90)) if len(heights) else 0.0
    tau = 0.25 * strong_level                      # a tooth is "strong" above this
    weak = 0.04 * strong_level                     # the 5th tooth may be this faint (or missing)
    def tooth(y):                                  # best response within +-2 px of the expected tooth position
        a, b = max(0, y - 2), min(H, y + 3); i = int(np.argmax(s[a:b])); return a + i, float(s[a + i])
    cands = []
    for y0 in pk:
        if s[y0] < tau: continue
        for shift in range(5):                      # y0 may be any of the 5 teeth
            top = y0 - shift * p
            if top < 0 or top + 4 * p >= H: continue
            teeth = [tooth(top + i * p) for i in range(5)]
            # re-anchor each tooth on the previous one to absorb slight spacing drift
            ys, vs = [teeth[0][0]], [teeth[0][1]]
            for i in range(1, 5):
                yy, vv = tooth(ys[-1] + p); ys.append(yy); vs.append(vv)
            n_strong = sum(v >= tau for v in vs)
            if n_strong >= 4 and min(vs) >= weak * 0 and np.std(np.diff(ys)) <= 2.0:
                cands.append((sum(vs), ys, vs, n_strong))
    cands.sort(key=lambda c: -c[0]); staves = []
    for sc, ys, vs, ns in cands:
        if all(abs(ys[0] - t["lines"][0]) > 2.5 * p for t in staves):
            staves.append({"lines": [int(v) for v in ys], "teeth": [round(v / strong_level, 2) for v in vs], "n_strong": ns})
    staves.sort(key=lambda t: t["lines"][0])
    # 4. ink threshold from the gray of the found line pixels (columns where the line response is present)
    otsu = cv2.threshold(g, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[0]; base = min(otsu, 150); paper = float(np.percentile(g, 90))
    px = []
    for t in staves:
        for y in t["lines"]:
            cols = longh[y] > max(1.0, 0.5 * float(s[y]))     # columns where this line actually responds
            px.append(g[max(0, y - 1):y + 2].min(0)[cols])
    px = np.concatenate(px) if px else np.array([])
    if px.size:
        lp50, lp90 = float(np.percentile(px, 50)), float(np.percentile(px, 90)); T = max(base, lp90 + 0.35 * (paper - lp90))
    else: lp50 = lp90 = None; T = base
    res[stem] = {"interline": p, "n_staves": len(staves), "staves": staves, "line_p50": lp50, "line_p90": lp90, "T_struct": round(T, 1),
                 "weak_tooth_staves": sum(1 for t in staves if t["n_strong"] == 4)}
    if stem in CASES:                               # why missed: profile + teeth + crop around each missed staff
        info = {"interline": p, "tau": round(tau, 3), "weak": round(weak, 3), "strong_level": round(strong_level, 3), "cases": []}
        for ci, top in enumerate(CASES[stem]):
            a, b = max(0, top - 2 * p), min(H, top + 7 * p)
            prof = [round(float(v), 2) for v in s[a:b]]
            peaks_here = [int(y) for y in pk if a <= y < b]
            info["cases"].append({"top": top, "range": [a, b], "profile": prof, "peaks": peaks_here,
                                  "peak_heights": [round(float(s[y]), 2) for y in peaks_here]})
            crop = img[a:b].copy()
            pr = np.full((b - a, 300, 3), 255, np.uint8)
            for i, v in enumerate(s[a:b]): cv2.line(pr, (0, i), (int(min(1.0, v / max(strong_level, 1e-6)) * 290), i), (120, 120, 120), 1)
            cv2.line(pr, (int(0.25 * 290), 0), (int(0.25 * 290), b - a - 1), (0, 0, 230), 1)
            cv2.imwrite(f"{OUT}/{stem}_case{ci}.png", np.hstack([crop, pr]))
            # annotated picture for the user: (1) the central band the row score uses (blue), (2) per column whether the
            # staff's lines are present (bar under the crop: green present / grey absent), (3) per vertical strip the 5
            # strongest line rows (short coloured ticks) + a dashed reference at the left strip's top line
            ann = img[a:b].copy(); hh = b - a
            cv2.rectangle(ann, (x0c, 0), (x1c, hh - 1), (230, 120, 0), 3)
            cv2.putText(ann, "row score = median over this band", (x0c + 8, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (230, 120, 0), 2)
            band_rows = slice(max(0, top - a - 2), min(hh, top - a + 4 * p + 3))
            present = (th[a:b][band_rows] > 8).sum(0) >= 3          # >= 3 of the staff rows respond in this column
            bar = np.full((26, W, 3), 255, np.uint8); bar[:, present] = (0, 170, 0); bar[:, ~present] = (200, 200, 200)
            frac = float(present[x0c:x1c].mean())
            cv2.putText(bar, f"line present in {frac * 100:.0f}% of the band (needs > 50% for a median)", (10, 19), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)
            cols8 = [(0, 0, 230), (0, 140, 255), (0, 170, 0), (200, 0, 200), (230, 120, 0)]
            ref = None
            for j in range(8):
                xa, xb = j * W // 8, (j + 1) * W // 8
                prof = np.median(th[a:b, xa:xb], axis=1)
                cand = [y for y in range(1, hh - 1) if prof[y] >= prof[y - 1] and prof[y] > prof[y + 1] and prof[y] > 4]
                cand.sort(key=lambda y: -prof[y]); pick = []
                for y in cand:
                    if all(abs(y - z) >= max(3, p // 2) for z in pick): pick.append(y)
                    if len(pick) == 5: break
                for r, y in enumerate(sorted(pick)):
                    cv2.line(ann, (xa + 10, y), (xb - 10, y), cols8[r], 3)
                if j == 0 and pick: ref = min(pick)
            if ref is not None:
                for xx in range(0, W, 24): cv2.line(ann, (xx, ref), (xx + 12, ref), (0, 0, 0), 1)
            cv2.imwrite(f"{OUT}/{stem}_case{ci}_ann.png", np.vstack([ann, bar]))
            info["cases"][-1]["line_present_frac_in_band"] = round(frac, 3)
            # also the tilt: per vertical strip (8 strips), the row of max response near the top line
            strips = []
            for j in range(8):
                xa, xb = j * W // 8, (j + 1) * W // 8
                col = np.median(th[a:b, xa:xb], axis=1); strips.append(int(a + np.argmax(col)))
            info["cases"][-1]["strip_argmax_rows"] = strips
        res.setdefault("_diag", {})[stem] = info
    if stem in RENDER:                              # picture: found combs (green = strong tooth, orange = faint tooth)
        vis = img.copy()
        for t in staves:
            for y, v in zip(t["lines"], t["teeth"]):
                cv2.line(vis, (0, y), (W - 1, y), (0, 170, 0) if v * strong_level >= tau else (0, 140, 255), 2)
        prof = np.full((H, 300, 3), 255, np.uint8)
        for y in range(H): cv2.line(prof, (0, y), (int(min(1, s[y] / max(strong_level, 1e-6)) * 290), y), (120, 120, 120), 1)
        cv2.line(prof, (int(0.25 * 290), 0), (int(0.25 * 290), H - 1), (0, 0, 230), 1)
        both = np.hstack([vis, prof]); both = cv2.resize(both, (1150, round(H * 1150 / both.shape[1])))
        cv2.imwrite(f"{OUT}/{stem}_struct.jpg", both, [cv2.IMWRITE_JPEG_QUALITY, 85])
    print(stem, p, len(staves), res[stem]["T_struct"], flush=True)
json.dump(res, open(f"{OUT}/struct.json", "w"), indent=1)

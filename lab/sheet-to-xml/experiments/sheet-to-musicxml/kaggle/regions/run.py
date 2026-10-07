# Kaggle CPU kernel: box the three regions of a lead sheet — staff (incl. stems/beams/ledger notes that
# leave the 5 lines), chord symbols above it, lyrics below it.
# Staff: OpenCV line projection (from songform-crop-stt/scripts/staff_crop.py), then grow the box over every
#        connected stroke that touches the staff lines, plus small non-text blobs just outside (ledger whole notes).
# Text:  EasyOCR (ko+en) boxes, classified by position + script: hangul below a staff -> lyric,
#        non-hangul within ~5 line gaps above a staff -> chord, the rest -> other (title, measure numbers...).
# Output: out/<stem>_boxes.jpg (overlay, 1000px wide), out/regions.json
import glob, json, os, re, subprocess, sys, time

OUT = "/kaggle/working/out"; os.makedirs(OUT, exist_ok=True)
subprocess.run(f"{sys.executable} -m pip install -q easyocr > /dev/null 2>&1", shell=True)
import cv2, numpy as np, easyocr

def binarize(g): return cv2.threshold(g, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
def runs(mask):
    idx = np.flatnonzero(np.diff(np.r_[0, mask.astype(np.int8), 0])); return list(zip(idx[::2], idx[1::2]))
def staff_mask(bw):
    return cv2.morphologyEx(bw, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (max(20, bw.shape[1] // 20), 1)))

def staff_systems(bw):
    """-> [(top, bottom, gap, x0, x1)] of 5-line staves (top/bottom = outer staff lines)."""
    horiz = staff_mask(bw); w = bw.shape[1]
    lines = [(a + b) // 2 for a, b in runs(horiz.sum(1) > 0.18 * 255 * w)]
    if len(lines) < 5: return []
    typical = np.median(np.diff(lines)) or 1
    groups, cur = [], [lines[0]]
    for p, y in zip(lines, lines[1:]):
        if y - p <= typical * 2.5: cur.append(y)
        else: groups.append(cur); cur = [y]
    groups.append(cur)
    out = []
    for g in groups:
        if len(g) < 5: continue
        cols = np.flatnonzero(horiz[g[0]:g[-1] + 1].any(0))
        out.append((g[0], g[-1], (g[-1] - g[0]) / 4, int(cols.min()), int(cols.max())))
    return out

def overlaps(a, b):  # boxes (x0, y0, x1, y1)
    return a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]

HANGUL = re.compile(r"[가-힣]")
CHORD = re.compile(r"[A-G][#b♯♭h5']?(?:maj|min|dim|aug|sus|add|m|M|[0-9]|[()+\-#b♯♭'?/Il|:\s]|[A-G])*")  # tolerant of OCR ("/"->I, "♭"->h/5)
reader = easyocr.Reader(["ko", "en"], gpu=False, verbose=False)
res = {}
for path in sorted(p for p in glob.glob("/kaggle/input/**/*", recursive=True) if p.lower().endswith((".png", ".jpg", ".jpeg"))):
    stem = os.path.basename(path).rsplit(".", 1)[0]; t0 = time.time()
    img = cv2.imread(path)
    k = 2000 / img.shape[1]                      # normalise width so thresholds and OCR see similar sizes
    img = cv2.resize(img, None, fx=k, fy=k, interpolation=cv2.INTER_CUBIC if k > 1 else cv2.INTER_AREA)
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY); bw = binarize(g); H, W = bw.shape
    # v1 lost 4 of 8 staves under a light watermark with global Otsu only -> OR an adaptive threshold for line finding
    ad = cv2.adaptiveThreshold(g, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY_INV, 31, 15)
    systems = staff_systems(cv2.bitwise_or(bw, ad))

    # 1) text boxes
    texts = []
    for quad, txt, conf in reader.readtext(img):
        xs, ys = [p[0] for p in quad], [p[1] for p in quad]
        texts.append({"box": [int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys))], "text": txt, "conf": round(float(conf), 3)})

    # 2) staff regions: union of connected components touching the staff lines
    # components on DARK ink only: light watermark pixels (YWAM) otherwise bridge lyrics to the staff lines
    otsu = cv2.threshold(g, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[0]
    dark = ((g < min(otsu, 150)) * 255).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(dark, connectivity=8)
    staff_boxes, staff_ids = [], []
    for top, bot, gap, x0, x1 in systems:
        band = lab[top:bot + 1, x0:x1 + 1]
        ids = set(np.unique(band[band > 0]).tolist())
        y0, y1 = top, bot; keep = []
        for i in ids:
            x, y, w, h, a = stats[i]
            # the staff lines themselves are one component spanning the width; any stroke touching them joins it
            if h > 12 * gap: continue            # guard against a component that runs into the next system
            y0, y1 = min(y0, y), max(y1, y + h); keep.append(i)
        # detached blobs just outside the lines (ledger-line notes without stems, dots, ties) that are not text
        # (v6 rule; v7's dilated-note mask was tried and reverted: it lost more than it gained, see LOG 12)
        for i in range(1, n):
            x, y, w, h, a = stats[i]
            if i in ids or x + w < x0 or x > x1 or a < 4: continue
            # ledger-line note size only: single-letter chords OCR missed ("G", "C") are ~1.5-2 gaps tall
            near = (top - 1.5 * gap <= y + h <= top) or (bot <= y <= bot + 1.5 * gap)
            if near and h <= 1.3 * gap and not any(overlaps((x, y, x + w, y + h), t["box"]) for t in texts):
                y0, y1 = min(y0, y), max(y1, y + h); keep.append(i)
        staff_ids.append(keep)
        staff_boxes.append({"box": [x0, int(y0), x1, int(y1)], "lines": [int(top), int(bot)], "gap": round(gap, 2),
                            "stem_ext_up": round((top - y0) / gap, 2), "stem_ext_down": round((y1 - bot) / gap, 2)})

    # 3) classify text against the staff LINES (not the stem-extended box: stems reach chord height)
    #    chord: just above a staff, starts with A-G, no hangul;  lyric: below a staff within ~9 gaps
    for t in texts:
        x0, y0, x1, y1 = t["box"]; cy = (y0 + y1) / 2; txt = t["text"].strip()
        above = max((s for s in staff_boxes if s["lines"][1] < cy), key=lambda s: s["lines"][1], default=None)
        below = min((s for s in staff_boxes if s["lines"][0] > cy), key=lambda s: s["lines"][0], default=None)
        inside = any(s["lines"][0] <= cy <= s["lines"][1] and s["box"][0] <= cx <= s["box"][2]
                     for s in staff_boxes for cx in [(x0 + x1) / 2])
        t["kind"], t["system"] = "other", None
        if inside: pass
        elif (below and -0.5 * below["gap"] <= below["lines"][0] - y1 <= 6 * below["gap"]
              and CHORD.fullmatch(txt) and not HANGUL.search(txt) and len(txt) <= 12):
            t["kind"], t["system"] = "chord", staff_boxes.index(below)
        elif above and cy - above["lines"][1] <= 9 * above["gap"] and re.search(r"[^\W\d_]", txt):
            t["kind"], t["system"] = "lyric", staff_boxes.index(above)

    # 5) split each system into three PNGs by pixel ownership (the stem-extended staff box overlaps the chord row,
    #    so rectangles alone would cut chords): staff = staff-connected strokes only, upper/lower = everything else.
    #    upper/lower boundary between two systems = centre of the widest ink-free row run between them.
    sd = f"{OUT}/split/{stem}"; os.makedirs(sd, exist_ok=True)
    staff_px = np.zeros_like(bw, dtype=bool)
    for keep in staff_ids: staff_px |= np.isin(lab, keep)
    staff_px = cv2.dilate(staff_px.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)   # take anti-aliased edges too
    other_ink = (dark > 0) & ~staff_px
    rest_all = np.where(staff_px[..., None], np.full_like(img, 255), img)
    med_gap = float(np.median([sb["gap"] for sb in staff_boxes]))
    def cut(a, b, x0, x1):  # widest blank row run of non-staff ink in [a, b) -> its centre
        if b <= a: return (a + b) // 2
        blank = ~other_ink[a:b, x0:x1 + 1].any(1); rr = runs(blank)
        return a + (max(rr, key=lambda r: r[1] - r[0])[0] + max(rr, key=lambda r: r[1] - r[0])[1]) // 2 if rr else (a + b) // 2
    bounds = []
    for i, sb in enumerate(staff_boxes):
        x0, _, x1, _ = sb["box"]; top, bot = sb["lines"]; gap = sb["gap"]
        if i == 0:
            ch = [t["box"][1] for t in texts if t["kind"] == "chord" and t["system"] == 0]
            up = int(min(ch) - gap) if ch else int(top - 5 * gap)
        else: up = bounds[-1][1]
        if i + 1 < len(staff_boxes):
            ly = [t["box"][3] for t in texts if t["kind"] == "lyric" and t["system"] == i]
            ch = [t["box"][1] for t in texts if t["kind"] == "chord" and t["system"] == i + 1]
            a = max(ly) if ly else staff_boxes[i]["lines"][1]
            b = min(ch) if ch and min(ch) > a else staff_boxes[i + 1]["lines"][0]
            lo = cut(a, b, x0, x1)
            # the widest blank run can also be inside the next system's chord row / stems -> keep it below this staff box
            lo = max(lo, sb["box"][3] + 1)
        else:
            ly = [t["box"][3] for t in texts if t["kind"] == "lyric" and t["system"] == i]
            lo = int(max(ly) + gap) if ly else int(bot + 6 * gap)
        bounds.append((max(0, up), min(H, lo)))
    pad = 10; white = np.full_like(img, 255); split = []
    for i, (sb, (up, lo)) in enumerate(zip(staff_boxes, bounds)):
        x0, y0, x1, y1 = sb["box"]; xa, xb = max(0, x0 - pad), min(W, x1 + pad); top, bot = sb["lines"]
        own = np.where(staff_px[..., None], img, white)          # staff strokes only
        rest = np.where(staff_px[..., None], white, img)         # everything but staff strokes
        parts = {"upper": rest[up:top, xa:xb], "staff": own[y0:y1 + 1, xa:xb], "lower": rest[bot + 1:lo, xa:xb]}
        for name, im_ in parts.items():
            if im_.size: cv2.imwrite(f"{sd}/s{i + 1:02d}_{name}.png", im_)
        split.append({"upper": [up, top], "staff": [y0, y1], "lower": [bot + 1, lo], "x": [xa, xb]})
    # preview: the three strips of every system stacked with a colour bar on the left
    bar = {"upper": (52, 104, 235), "staff": (214, 120, 42), "lower": (0, 140, 0)}; rows_ = []
    for i in range(len(staff_boxes)):
        for name in ("upper", "staff", "lower"):
            fp = f"{sd}/s{i + 1:02d}_{name}.png"
            if not os.path.exists(fp): continue
            im_ = cv2.imread(fp); im_ = cv2.copyMakeBorder(im_, 4, 4, 14, 4, cv2.BORDER_CONSTANT, value=(255, 255, 255))
            im_[:, :8] = bar[name]; rows_.append(im_)
        rows_.append(np.full((28, 10, 3), 225, np.uint8))
    if rows_:
        wmax = max(r.shape[1] for r in rows_)
        pv = np.vstack([cv2.copyMakeBorder(r, 0, 0, 0, wmax - r.shape[1], cv2.BORDER_CONSTANT, value=(255, 255, 255) if r.shape[0] != 28 else (225, 225, 225)) for r in rows_])
        pv = cv2.resize(pv, (1000, round(pv.shape[0] * 1000 / pv.shape[1])), interpolation=cv2.INTER_AREA)
        cv2.imwrite(f"{OUT}/{stem}_split.jpg", pv, [cv2.IMWRITE_JPEG_QUALITY, 80])

    # 6) rows by ink: every band between two staves (and above the first / below the last) is cut into rows at
    #    ink-free horizontal runs of the non-staff ink. Thin tall vertical strokes (volta / repeat bracket sides) are
    #    ignored for the profile because they bridge rows. Rows are saved in page order: b00 = above system 1,
    #    b01 = between systems 1 and 2, ...  No row is assigned to "upper" or "lower" yet.
    ncomp_o, lab_o, st_o, _ = cv2.connectedComponentsWithStats(other_ink.astype(np.uint8), connectivity=8)
    vert = np.zeros(ncomp_o, bool)
    for j in range(1, ncomp_o):
        _, _, w_, h_, _ = st_o[j]
        vert[j] = h_ > 2 * med_gap and w_ < 0.4 * med_gap
    prof_ink = other_ink & ~vert[lab_o]
    edges = [(bounds[0][0], staff_boxes[0]["lines"][0])] + \
            [(staff_boxes[i]["lines"][1] + 1, staff_boxes[i + 1]["lines"][0]) for i in range(len(staff_boxes) - 1)] + \
            [(staff_boxes[-1]["lines"][1] + 1, bounds[-1][1])]
    xa, xb = max(0, min(sb["box"][0] for sb in staff_boxes) - 10), min(W, max(sb["box"][2] for sb in staff_boxes) + 10)
    rows = []
    for bi, (ya, yb) in enumerate(edges):
        if yb - ya < 2: continue
        cnt_ = prof_ink[ya:yb, xa:xb].sum(1)
        tol = max(2, int(0.003 * (xb - xa)))            # a few stray pixels (hyphen tips, dust) still count as blank
        rr = [(ya + r0, ya + r1) for r0, r1 in runs(cnt_ > tol)]
        merged = []                                        # close sub-pixel splits inside one glyph row
        for r0, r1 in rr:
            if merged and r0 - merged[-1][1] < 0.15 * med_gap: merged[-1] = (merged[-1][0], r1)
            else: merged.append((r0, r1))
        for ri, (r0, r1) in enumerate(merged):
            ink = int(prof_ink[r0:r1, xa:xb].sum())
            if ink < 30: continue                            # dust
            c0, c1 = max(ya, r0 - 3), min(yb, r1 + 3)
            fn = f"b{bi:02d}_r{ri + 1:02d}.png"
            cv2.imwrite(f"{sd}/{fn}", rest_all[c0:c1, xa:xb])
            above_ = staff_boxes[bi - 1]["lines"][1] if bi > 0 else None
            below_ = staff_boxes[bi]["lines"][0] if bi < len(staff_boxes) else None
            rows.append({"band": bi, "row": ri + 1, "file": fn, "y": [int(r0), int(r1)], "h_gaps": round((r1 - r0) / med_gap, 2),
                         "from_staff_above_gaps": round((r0 - above_) / med_gap, 2) if above_ is not None else None,
                         "to_staff_below_gaps": round((below_ - r1) / med_gap, 2) if below_ is not None else None,
                         "ink_px": ink})

    # 4) overlay
    vis = img.copy()
    col = {"staff": (214, 120, 42), "chord": (52, 104, 235), "lyric": (0, 140, 0), "other": (150, 150, 150)}
    for s in staff_boxes: cv2.rectangle(vis, tuple(s["box"][:2]), tuple(s["box"][2:]), col["staff"], 4)
    for t in texts: cv2.rectangle(vis, tuple(t["box"][:2]), tuple(t["box"][2:]), col[t["kind"]], 3 if t["kind"] != "other" else 2)
    vis = cv2.resize(vis, (1000, round(H * 1000 / W)), interpolation=cv2.INTER_AREA)
    cv2.imwrite(f"{OUT}/{stem}_boxes.jpg", vis, [cv2.IMWRITE_JPEG_QUALITY, 80])
    cnt = {kd: sum(t["kind"] == kd for t in texts) for kd in ("chord", "lyric", "other")}
    res[stem] = {"width_in": round(W / k), "systems": len(staff_boxes), "staff": staff_boxes, "texts": texts,
                 "counts": cnt, "split": split, "rows": rows, "seconds": round(time.time() - t0, 1)}
    print(stem, len(staff_boxes), "systems", cnt, [(s["stem_ext_up"], s["stem_ext_down"]) for s in staff_boxes][:4], res[stem]["seconds"], "s", flush=True)
json.dump(res, open(f"{OUT}/regions.json", "w"), ensure_ascii=False, indent=1, default=int)

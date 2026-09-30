# Kaggle kernel (100 sheets): stage 0 per-document ink threshold from the staff lines + staff region =
# body rectangle (top..bottom line) + note protrusions. Otherwise identical to regions-100.
# Kaggle kernel (100-sheet set): box the three regions of a lead sheet — staff (incl. stems/beams/ledger notes that
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
import torch
from PIL import Image
reader = easyocr.Reader(["ko", "en"], gpu=torch.cuda.is_available(), verbose=False)
print("OCR on GPU:", torch.cuda.is_available(), flush=True)
res = {}
PICK = {"ywam_first-and-last_1", "hillsong_still_1", "agapao_i-remember-psalm77_1", "fia_my-jesus_1", "jus_return-to-lord_1", "markers_love-of-god_1"}

def calibrate_ink(img, g, systems, horiz, alpha=0.35, default=150.0):
    """Stage 0: per-document ink threshold. Staff lines are printed with the music ink, so 'at least as dark as the
    staff lines' = music ink; anything lighter (paper, watermark) is not. Returns (ink mask, report)."""
    otsu = cv2.threshold(g, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[0]
    base = min(otsu, default)
    px = []
    for top, bot, gap, x0, x1 in systems:
        for yl in range(top, bot + 1):
            if horiz[yl].sum() > 0.18 * 255 * g.shape[1]:
                cols = horiz[yl] > 0
                px.append(g[max(0, yl - 1):yl + 2].min(0)[cols])       # darkest of +-1 row = line core
    rep = {"base_T": round(float(base), 1), "flags": []}
    if not px:
        rep["flags"].append("no_staff_for_calibration"); rep["T"] = rep["base_T"]; return g < base, rep
    px = np.concatenate(px); paper = float(np.percentile(g, 90))
    lp50, lp90 = float(np.percentile(px, 50)), float(np.percentile(px, 90))
    T = max(base, lp90 + alpha * (paper - lp90))
    rep.update({"line_p50": round(lp50, 1), "line_p90": round(lp90, 1), "paper": round(paper, 1), "T": round(T, 1)})
    if paper - lp90 < 40: rep["flags"].append("low_contrast")
    ink = g < T
    # (a "light saturated = watermark" colour rule was tried and removed: it deleted dark-red chord symbols and blue
    #  segno/Fine marks on 23 sheets, while fia's pink watermark was already excluded by darkness alone -> 0 px needed)
    # ponytail: add a colour rule back only if a watermark as dark as the lines but coloured shows up
    # a watermark as dark as the staff lines cannot be separated by darkness: large ink blobs far from any staff
    return ink, rep

for path in sorted(p for p in glob.glob("/kaggle/input/**/*", recursive=True) if p.lower().endswith((".png", ".jpg", ".jpeg", ".gif"))):
    stem = os.path.basename(path).rsplit(".", 1)[0]
    try:
        stem = os.path.basename(path).rsplit(".", 1)[0]; t0 = time.time()
        # decode with PIL and flatten transparency onto white: cv2.imread drops alpha, so a transparent-background PNG
        # whose hidden RGB is black read as an all-black page ("no staff found"); PIL also covers GIF
        pim = Image.open(path).convert("RGBA")
        bg = Image.new("RGBA", pim.size, (255, 255, 255, 255)); bg.alpha_composite(pim)
        img = cv2.cvtColor(np.array(bg.convert("RGB")), cv2.COLOR_RGB2BGR)
        k = 2000 / img.shape[1]                      # normalise width so thresholds and OCR see similar sizes
        img = cv2.resize(img, None, fx=k, fy=k, interpolation=cv2.INTER_CUBIC if k > 1 else cv2.INTER_AREA)
        g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY); bw = binarize(g); H, W = bw.shape
        # v1 lost 4 of 8 staves under a light watermark with global Otsu only -> OR an adaptive threshold for line finding
        ad = cv2.adaptiveThreshold(g, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY_INV, 31, 15)
        systems = staff_systems(cv2.bitwise_or(bw, ad))
        if not systems: raise ValueError("no staff found")

        # 1) text boxes
        texts = []
        for quad, txt, conf in reader.readtext(img):
            xs, ys = [p[0] for p in quad], [p[1] for p in quad]
            texts.append({"box": [int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys))], "text": txt, "conf": round(float(conf), 3)})

        # 2) staff regions: union of connected components touching the staff lines
        # components on DARK ink only: light watermark pixels (YWAM) otherwise bridge lyrics to the staff lines
        # stage 0: document-specific ink (replaces the fixed min(Otsu, 150), which dropped light staff lines/stems)
        ink_mask, calib = calibrate_ink(img, g, systems, staff_mask(cv2.bitwise_or(bw, ad)))
        dark = (ink_mask * 255).astype(np.uint8)
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
        # staff region = the whole body (top..bottom line, full staff width) + the protruding notes found above
        for sb in staff_boxes:
            staff_px[sb["lines"][0]:sb["lines"][1] + 1, sb["box"][0]:sb["box"][2] + 1] = True
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
        # row gaps are found on the BASE ink (min(Otsu,150)), not the calibrated one: the higher per-document threshold
        # also picks up anti-aliased halos and faint specks that close the thin blank band between a tie row and the lyric
        # row (gifted b07_r01 merged a tie into the lyrics). Calibrated ink is only needed to cut the staff region.
        core_ink = (g < calib["base_T"]) & ~staff_px
        prof_ink = core_ink & ~vert[lab_o]
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

        # 7) detect the three REAL problems agreed with the user (everything else is merged logically later):
        #    (a) musical-symbol pieces and lyrics in the same row PNG, (b) a whole staff inside a row PNG,
        #    (c) staff ink that ends up in no PNG at all (whitened: not in the staff cut-out, and inside the staff lines
        #        so no row covers it either). Also counts bands with no lyric row (info for the upper/lower grouping).
        PD = f"{OUT}/problems"; os.makedirs(PD, exist_ok=True)
        probs = []; tb = [t["box"] for t in texts]; tpad = int(0.2 * med_gap)
        def in_text(x, y, w, h):
            return any(x < b[2] + tpad and b[0] - tpad < x + w and y < b[3] + tpad and b[1] - tpad < y + h for b in tb)
        lyric_bands = set(); feats = []
        def arc_resid(i, x, y, w, h):          # mean distance of the piece's pixels from their best straight line
            ys_, xs_ = np.nonzero(lab_o[y:y + h, x:x + w] == i)
            if len(xs_) < 3 or np.ptp(xs_) == 0: return 0.0
            A_ = np.vstack([xs_, np.ones_like(xs_)]).T; coef = np.linalg.lstsq(A_, ys_, rcond=None)[0]
            return float(np.abs(ys_ - A_ @ coef).mean())
        def long_lines(r0, r1):                 # staff-like lines: horizontal runs longer than half the page width
            # a slightly tilted line spreads over several pixel rows, so no single row is long enough (probably why the page-level
            # detector missed welove_1's staff) -> merge +-2 rows before measuring
            hm = cv2.dilate(staff_mask(cv2.bitwise_or(bw, ad)[r0:r1]), np.ones((5, 1), np.uint8))
            return len(runs(hm.sum(1) > 0.4 * 255 * W))
        for r in rows:
            r0, r1 = r["y"]
            # lyric = OCR text whose centre is in the row with >= 3 hangul chars (a chord OCR'd with a stray hangul char stays out)
            # ponytail: English-only lyrics (teamluke) are not seen as lyrics; add a Latin-word rule if that matters
            # English lyrics (teamluke): a below-staff text with a 3+ letter word that is not a chord name
            lyr = [t for t in texts if r0 <= (t["box"][1] + t["box"][3]) / 2 <= r1 and (len(HANGUL.findall(t["text"])) >= 3 or
                   (t["kind"] == "lyric" and re.search(r"[A-Za-z]{3,}", t["text"]) and not CHORD.fullmatch(t["text"].strip())
                    and not re.search(r"(?i)\b(fine|coda|d\.?\s?s|d\.?\s?c|rit|al|to|only|in|segno)\b", t["text"])))]
            syms = []
            for i in np.unique(lab_o[r0:r1, xa:xb]).tolist():
                if i == 0: continue
                x, y, w, h, a = map(int, st_o[i])
                # v1-v3 judged pieces by shape and kept flagging hangul strokes / slanted extender dashes that OCR boxes
                # missed. Those sit at the SAME height as the lyrics; ties, slurs and brackets sit above or below them.
                # So: a non-text piece >= 1 gap wide or tall whose vertical centre is outside every lyric box's height range,
                # and that is not a frame drawn around a text (boxed section labels).
                cy = y + h / 2
                in_band = any(t["box"][1] - tpad <= cy <= t["box"][3] + tpad for t in lyr)
                frame = any(x <= (b[0] + b[2]) / 2 <= x + w and y <= (b[1] + b[3]) / 2 <= y + h for b in tb)
                # final rule (tuned on the 14 human-checked sheets: 4/5 real rows, 2 false rows): a tie/slur-shaped piece -
                # wide, flat, hollow and curved. Hyphens/extenders are solid straight lines; hangul strokes are compact.
                # ponytail: a volta bracket touching its "1." text box is taken as text and missed (jus); add a bracket rule if needed
                if lyr and not frame and not in_text(x, y, w, h) and w >= 1.8 * med_gap and 0.4 * med_gap <= h <= 1.6 * med_gap \
                        and a / max(1, w * h) < 0.4 and arc_resid(i, x, y, w, h) >= 0.09 * med_gap:
                    syms.append([x, y, w, h])
                # feature dump for rule tuning (every non-tiny piece in a lyric row)
                if lyr and (w >= 0.5 * med_gap or h >= 0.5 * med_gap):
                    ys_, xs_ = np.nonzero(lab_o[y:y + h, x:x + w] == i)
                    if len(xs_) > 2 and np.ptp(xs_) > 0:
                        A_ = np.vstack([xs_, np.ones_like(xs_)]).T; coef = np.linalg.lstsq(A_, ys_, rcond=None)[0]
                        resid = float(np.abs(ys_ - A_ @ coef).mean())
                    else: resid = 0.0
                    lb = [t["box"] for t in lyr]
                    ov = max((max(0, min(y + h, b_[3]) - max(y, b_[1])) / max(1, h)) for b_ in lb)
                    dy = min(min(abs(y + h - b_[1]), abs(y - b_[3])) for b_ in lb) / med_gap
                    feats.append({"file": r["file"], "x": x, "y": y, "w": round(w / med_gap, 2), "h": round(h / med_gap, 2),
                                  "fill": round(a / max(1, w * h), 3), "resid": round(resid / med_gap, 3), "in_text": in_text(x, y, w, h),
                                  "in_band": in_band, "frame": frame, "vert": bool(vert[i]), "lyric_vert_overlap": round(ov, 2),
                                  "dy_to_lyric": round(dy, 2), "above": bool(y + h / 2 < min(b_[1] for b_ in lb))})
            r["lyric_boxes"], r["symbol_parts"] = len(lyr), len(syms)
            if lyr: lyric_bands.add(r["band"])
            ev = None
            if lyr and syms:
                ev = f"{stem}_{r['file']}"
                probs.append({"type": "symbol_lyric_mixed", "file": r["file"], "band": r["band"], "n_lyric_boxes": len(lyr),
                              "n_symbols": len(syms), "evidence": ev})
            # (v7 reused staff_systems() here and missed the same staff it had missed on the page) -> count long lines instead
            r["long_lines"] = long_lines(r0, r1) if r["h_gaps"] > 3 else 0
            if r["long_lines"] >= 4:     # 5 staff lines, one may be broken by a label box (welove_1: 4); other rows: <= 1
                ev = f"{stem}_{r['file']}"
                probs.append({"type": "staff_in_row", "file": r["file"], "band": r["band"], "evidence": ev})
            if ev:                                 # evidence: row crop, red = symbol pieces, green = lyric text boxes
                c0 = max(0, r0 - 3); vis = rest_all[c0:min(H, r1 + 3), xa:xb].copy()
                for x, y, w, h in syms: cv2.rectangle(vis, (x - xa, y - c0), (x - xa + w, y - c0 + h), (0, 0, 230), 2)
                for t in lyr: cv2.rectangle(vis, (t["box"][0] - xa, t["box"][1] - c0), (t["box"][2] - xa, t["box"][3] - c0), (0, 160, 0), 2)
                cv2.imwrite(f"{PD}/{ev}", vis)
        ink_ref = bw > 0        # global Otsu ink; the adaptive threshold also marked light watermark edges as "lost" (fia)
        # anti-aliased 1-2px fringes around kept strokes are not lost symbols (downscaled hi-res sheets scored 10-17%)
        near_staff = cv2.dilate(staff_px.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool)
        for i, sb in enumerate(staff_boxes):
            top, bot = sb["lines"]; x0, _, x1, _ = sb["box"]
            ink = ink_ref[top:bot + 1, x0:x1 + 1]; lost = ink & ~near_staff[top:bot + 1, x0:x1 + 1]
            # text boxes overlapping the staff lines are not "lost symbols"
            for b in tb:
                ya_, yb_ = max(top, b[1]) - top, min(bot + 1, b[3]) - top
                if yb_ > ya_: lost[ya_:yb_, max(0, b[0] - x0):max(0, b[2] - x0)] = False
            ratio = float(lost.sum()) / max(1, int(ink.sum())); sb["lost_ink_ratio"] = round(ratio, 3)
            if ratio > 0.08:
                ev = f"{stem}_s{i + 1:02d}_lost.png"
                vis = img[top:bot + 1, x0:x1 + 1].copy(); vis[lost] = (0, 0, 230)
                cv2.imwrite(f"{PD}/{ev}", vis)
                probs.append({"type": "staff_ink_lost", "file": f"s{i + 1:02d}_staff.png", "lost_ratio": round(ratio, 3), "evidence": ev,
                              "severity": "high" if ratio >= 0.2 else "low"})
        nb = len(staff_boxes) + 1
        no_lyric = [b for b in range(1, nb - 1) if b not in lyric_bands]      # between-staff bands only

        # 4) overlay
        vis = img.copy()
        col = {"staff": (214, 120, 42), "chord": (52, 104, 235), "lyric": (0, 140, 0), "other": (150, 150, 150)}
        for s in staff_boxes: cv2.rectangle(vis, tuple(s["box"][:2]), tuple(s["box"][2:]), col["staff"], 4)
        for t in texts: cv2.rectangle(vis, tuple(t["box"][:2]), tuple(t["box"][2:]), col[t["kind"]], 3 if t["kind"] != "other" else 2)
        vis = cv2.resize(vis, (1000, round(H * 1000 / W)), interpolation=cv2.INTER_AREA)
        cv2.imwrite(f"{OUT}/{stem}_boxes.jpg", vis, [cv2.IMWRITE_JPEG_QUALITY, 80])
        cnt = {kd: sum(t["kind"] == kd for t in texts) for kd in ("chord", "lyric", "other")}
        res[stem] = {"width_in": round(W / k), "systems": len(staff_boxes), "staff": staff_boxes, "texts": texts,
                     "calibration": calib, "counts": cnt, "split": split, "rows": rows, "problems": probs, "bands_without_lyrics": no_lyric, "piece_features": feats, "seconds": round(time.time() - t0, 1)}
        print(stem, len(staff_boxes), "systems", cnt, [(s["stem_ext_up"], s["stem_ext_down"]) for s in staff_boxes][:4], res[stem]["seconds"], "s", flush=True)
    except Exception as e:                   # one bad sheet must not stop the other 99
        res[stem] = {"error": repr(e)[:200]}; print(stem, "ERROR", repr(e)[:200], flush=True)
json.dump(res, open(f"{OUT}/regions.json", "w"), ensure_ascii=False, indent=1, default=int)

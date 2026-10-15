# Cut a printed lead sheet into crops: per staff system, or per measure (barline to barline).
# Each crop keeps the chord row above the staff and the lyric row below it.
# Classical CV only (OpenCV) - no model, runs in a second on CPU.
# Usage: python staff_crop.py <image> [outdir] [--measures] [--bars N] [--debug]
import sys
from pathlib import Path
import cv2, numpy as np

def binarize(img):
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
    return cv2.threshold(g, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]

def runs(mask, min_len=1):
    """[(start, end_exclusive)] of True runs in a 1-D boolean array."""
    idx = np.flatnonzero(np.diff(np.r_[0, mask.astype(np.int8), 0]))
    return [(a, b) for a, b in zip(idx[::2], idx[1::2]) if b - a >= min_len]

def staff_mask(bw):
    w = bw.shape[1]
    return cv2.morphologyEx(bw, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (max(20, w // 8), 1)))

def staff_systems(bw):
    """-> [(top, bottom, line_gap)] of the 5-line staves, top/bottom = outer staff lines."""
    w = bw.shape[1]
    horiz = staff_mask(bw)
    lines = [((a + b) // 2) for a, b in runs(horiz.sum(1) > 0.18 * 255 * w)]
    if len(lines) < 5: return []
    gaps = np.diff(lines)
    typical = np.median([g for g in gaps if g > 0]) or 1
    systems, cur = [], [lines[0]]
    for prev, y in zip(lines, lines[1:]):
        if y - prev <= typical * 2.5:
            cur.append(y)
        else:
            systems.append(cur); cur = [y]
    systems.append(cur)
    return [(s[0], s[-1], (s[-1] - s[0]) / 4) for s in systems if len(s) >= 5]

def bands(bw, systems, img_h):
    """Expand each staff to include the chord row above and the lyric row below,
    stopping halfway to the neighbouring system so bands never overlap."""
    out = []
    for i, (top, bot, gap) in enumerate(systems):
        prev_bot = systems[i - 1][1] if i else 0
        next_top = systems[i + 1][0] if i + 1 < len(systems) else img_h
        out.append((int(max(prev_bot + (top - prev_bot) * 0.45 if i else max(0, top - 3 * gap), 0)),
                    int(min(bot + (next_top - bot) * 0.55 if i + 1 < len(systems) else min(img_h, bot + 4 * gap), img_h))))
    return out

def without_staff(bw, gap):
    """Erase staff lines but keep vertical strokes: subtracting the staff mask also cuts
    barlines/stems at every line, so the vertical runs are closed back up afterwards."""
    n = cv2.subtract(bw, staff_mask(bw))
    return cv2.morphologyEx(n, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (1, max(3, int(gap)))))

def barlines(nostaff, top, bot, gap):
    """x of measure boundaries: a column dark across >=90% of the staff height. A note stem
    reaches at most 3.5/4 = 87.5% of it, which is what separates barlines from stems."""
    col = (nostaff[top:bot + 1] > 0).mean(0)
    return [(a + b) // 2 for a, b in runs(col >= 0.90, 1) if b - a <= max(2, int(gap))]

def crop(path, outdir, per_measure=False, bars=1, debug=False):
    img = cv2.imread(str(path))
    bw = binarize(img)
    sysL = staff_systems(bw)
    if not sysL:
        print(f"{Path(path).name}: no staff found"); return 0
    nostaff = without_staff(bw, np.median([g for *_, g in sysL]))
    bnd = bands(bw, sysL, img.shape[0])
    outdir = Path(outdir); outdir.mkdir(parents=True, exist_ok=True)
    stem, n, vis = Path(path).stem, 0, img.copy()
    for i, ((top, bot, gap), (y0, y1)) in enumerate(zip(sysL, bnd)):
        xs = barlines(nostaff, top, bot, gap)
        if debug:
            cv2.rectangle(vis, (0, y0), (img.shape[1] - 1, y1), (0, 140, 255), 2)
            for x in xs: cv2.line(vis, (x, top), (x, bot), (255, 0, 0), 2)
        if per_measure and len(xs) >= 2:
            edges = xs[::bars] + ([xs[-1]] if (len(xs) - 1) % bars else [])
            for j, (a, b) in enumerate(zip(edges, edges[1:])):
                pad = int(gap * 2)
                cv2.imwrite(str(outdir / f"{stem}_s{i:02d}m{j:02d}.png"),
                            img[y0:y1, max(0, a - pad):min(img.shape[1], b + pad)]); n += 1
        else:
            cv2.imwrite(str(outdir / f"{stem}_s{i:02d}.png"), img[y0:y1]); n += 1
    if debug: cv2.imwrite(str(outdir / f"{stem}_DEBUG.png"), vis)
    print(f"{Path(path).name}: {len(sysL)} systems, "
          f"measures/system {[max(0, len(barlines(nostaff, *s)) - 1) for s in sysL]}, wrote {n}")
    return n

if __name__ == "__main__":
    a = [x for x in sys.argv[1:] if not x.startswith("--")]
    f = [x for x in sys.argv[1:] if x.startswith("--")]
    bars = next((int(x.split("=")[1]) for x in f if x.startswith("--bars=")), 1)
    crop(a[0], a[1] if len(a) > 1 else "crops", "--measures" in f, bars, "--debug" in f)

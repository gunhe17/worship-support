# Kaggle CPU diagnostic: why are some lines of the missed staves (LOG 44) weak in the line response?
# For each missed staff and one detected staff on the same page, per line: grey profile across the line in the ORIGINAL
# image and in the working image (A4 width 2480, cubic), darkest value, width at half depth, and the line response
# (vertical close - grey, staff-500 response()) for several kernel sizes k. Median over the staff's columns.
# Also saves the original pixels around each staff, nearest-upscaled, to see how the lines are drawn.
import glob, json, os
import cv2, numpy as np
from PIL import Image

OUT = "/kaggle/working/out"; os.makedirs(f"{OUT}/crops", exist_ok=True)
W8 = 2480
# working-px line rows from staff-miss diag (missed) and staff.json (detected reference on the same page)
CASES = {
    "jrabbit_sarangeun-love-is_1": dict(k=9, x=(169, 2296), staves={
        "missed-1": [1628, 1650, 1672, 1692, 1714], "missed-2": [1973, 1995, 2015, 2037, 2059], "found": [1283, 1306, 1328, 1348, 1369]}),
    "jus_nae-moseup-idaero_1": dict(k=7, x=(177, 2302), staves={
        "missed": [1751, 1767, 1782, 1798, 1813], "found": [1323, 1338, 1356, 1369, 1386]}),
    "susanghanstreet_o-juyeo_1": dict(k=9, x=(103, 2382), staves={
        "missed": [824, 839, 855, 872, 887], "found": [1055, 1071, 1087, 1102, 1120]}),
}
KS = [3, 5, 7, 9, 11, 13, 15]

def load(path):
    pim = Image.open(path).convert("RGBA"); bg = Image.new("RGBA", pim.size, (255, 255, 255, 255)); bg.alpha_composite(pim)
    return cv2.cvtColor(np.array(bg.convert("RGB")), cv2.COLOR_RGB2BGR)

def response(g, k):
    return cv2.morphologyEx(g, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (1, int(k)))).astype(np.float32) - g

def profile(g, y, x0, x1, half):
    # median grey per row over the columns; columns crossed by notes/stems are a minority, the median ignores them
    rows = np.arange(int(round(y)) - half, int(round(y)) + half + 1)
    rows = rows[(rows >= 0) & (rows < g.shape[0])]
    return rows, np.median(g[rows, x0:x1].astype(np.float32), axis=1)

def depth_width(rows, prof, paper):
    darkest = float(prof.min()); half = (paper + darkest) / 2
    i = int(prof.argmin()); a = i
    while a > 0 and prof[a - 1] <= half: a -= 1
    b = i
    while b < len(prof) - 1 and prof[b + 1] <= half: b += 1
    return round(darkest, 1), b - a + 1, int(rows[i])

res = {}
paths = {os.path.basename(p).rsplit(".", 1)[0]: p for p in glob.glob("/kaggle/input/**/*", recursive=True)
         if p.lower().endswith((".png", ".jpg", ".jpeg", ".gif"))}
for stem, case in CASES.items():
    # same order as staff-500: resize the colour image, then grey
    im = load(paths[stem]); f = W8 / im.shape[1]; g0 = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
    g = cv2.cvtColor(cv2.resize(im, None, fx=f, fy=f, interpolation=cv2.INTER_CUBIC), cv2.COLOR_BGR2GRAY)
    paper = float(np.percentile(g, 90)); paper0 = float(np.percentile(g0, 90))
    x0, x1 = case["x"]; o0, o1 = int(x0 / f), int(x1 / f)
    resp = {k: response(g, k) for k in KS}
    out = dict(scale=round(f, 4), orig=list(g0.shape[::-1]), paper=paper, paper_orig=paper0, staves={})
    for name, ys in case["staves"].items():
        lines = []
        for y in ys:
            # working image
            rows, prof = profile(g, y, x0, x1, 8)
            dk, wd, yd = depth_width(rows, prof, paper)
            r_k = {k: round(float(np.median(resp[k][max(0, yd - 2):yd + 3, x0:x1].max(axis=0))), 1) for k in KS}
            # original image: the line centre in original px and its fractional position
            yo = yd / f
            rows0, prof0 = profile(g0, yo, o0, o1, 3)
            dk0, wd0, yd0 = depth_width(rows0, prof0, paper0)
            lines.append(dict(y=yd, darkest=dk, width=wd, resp=r_k, y_orig=round(yo, 2), frac=round(yo - np.floor(yo), 2),
                              orig_darkest=dk0, orig_width=wd0, orig_rows=[int(v) for v in rows0], orig_profile=[round(float(v)) for v in prof0],
                              profile=[round(float(v)) for v in prof]))
        out["staves"][name] = lines
        # original pixels around the staff, 160 columns from the staff's middle, nearest x8
        ya, yb = int(ys[0] / f) - 4, int(ys[-1] / f) + 5; xm = (o0 + o1) // 2
        crop = g0[max(0, ya):yb, xm - 80:xm + 80]
        cv2.imwrite(f"{OUT}/crops/{stem}_{name}.png", cv2.resize(crop, None, fx=8, fy=8, interpolation=cv2.INTER_NEAREST))
    res[stem] = out
    for name, lines in out["staves"].items():
        print(stem, name, [(l["darkest"], l["width"], l["resp"][case["k"]], l["orig_darkest"], l["orig_width"], l["frac"]) for l in lines], flush=True)
json.dump(res, open(f"{OUT}/why.json", "w"), indent=1)

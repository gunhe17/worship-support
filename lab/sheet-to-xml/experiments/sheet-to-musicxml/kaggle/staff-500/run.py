# Kaggle CPU: staff detection v1 (STAFF_DETECTION.md / PARAMETERS.md P1-P14), run on 100 sheets. Detection only.
# prep(P8) -> 1 thin-line response(P1) -> 2 interline = mode of per-column gaps(P2) -> 3 per-strip 5-line comb
# (P4,P3,P9,P10,P11,P12,P14,P13) -> 4 link strips(P5,P6), dedup, extent -> 5 thickness, ink threshold(P7).
import glob, json, os
import cv2, numpy as np
from PIL import Image

# v2: bridge gaps covered by ink; dedup needs x overlap too
OUT = "/kaggle/working/out"; os.makedirs(f"{OUT}/vis", exist_ok=True)
PAR = dict(P1_mult=3.0, P1_init=9, P2=(6, 60), P3=0.5, P4=5.0, P5=0.5, P6=2, P7=dict(q_line=90, alpha=0.35, q_paper=90),
           P8=2480, P9=0.25, P10=(90, 0.25), P11=0, P12=0.10,
           P13=(0.70, 0.50), P14=0.5, P15=(99.5, 0.30, 6.0), P16=2.0, P17=0.5, P6x=6)

def load(path):
    pim = Image.open(path).convert("RGBA"); bg = Image.new("RGBA", pim.size, (255, 255, 255, 255)); bg.alpha_composite(pim)
    return cv2.cvtColor(np.array(bg.convert("RGB")), cv2.COLOR_RGB2BGR)

def response(g, k):
    return cv2.morphologyEx(g, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (1, int(k)))).astype(np.float32) - g

ORIG_PX = [1.0]   # size of one original pixel in working px (A4 scale factor)

def line_mask(th):
    q, frac, floor = PAR["P15"]                  # line point: response >= frac x the strongest (q-th pct), at least floor
    return th > max(floor, frac * float(np.percentile(th, q)))

def interline(th, full=False):
    """step 2: per column, distances between consecutive line-response centres; mode over all columns (P2 range).
    full=True also returns the smoothed distance histogram (for extra spacing candidates)."""
    m = line_mask(th); lo, hi = PAR["P2"]; hist = np.zeros(hi + 2); five = np.zeros(hi + 2)
    for x in range(0, m.shape[1], 2):
        c = m[:, x].astype(np.int8); d = np.diff(np.r_[0, c, 0]); st, en = np.where(d == 1)[0], np.where(d == -1)[0]
        if len(st) < 2: continue
        cen = (st + en - 1) / 2.0; gf = np.diff(cen)
        gaps = gf.round().astype(int); gaps = gaps[(gaps >= lo) & (gaps <= hi)]
        np.add.at(hist, gaps, 1)
        for i in range(len(gf) - 3):                  # 5 lines crossing this column: 4 consecutive near-equal gaps
            w = gf[i:i + 4]; mu = float(w.mean())
            if lo <= mu <= hi and float(np.std(w)) <= max(PAR["P12"] * mu, ORIG_PX[0]):
                five[int(round(mu))] += 1
    if hist.sum() == 0: return (None, None) if full else None
    sm = np.convolve(hist, [1, 2, 1], "same")       # +-1 px jitter of thin lines
    return (int(np.argmax(sm)), np.convolve(five, [1, 1, 1], "same")) if full else int(np.argmax(sm))

def spacing_candidates(five, p_main):
    """multi-head: other peaks of the 5-line spacing distribution. A peak counts when its support is at least what one
    minimum-length staff (P6 strips of P4 x spacing, step-2 samples every 2nd column) would give; not within 15% of a chosen one."""
    lo, hi = PAR["P2"]; out = []
    for d in sorted(range(lo + 1, min(hi, len(five) - 2)), key=lambda d: -five[d]):
        need = PAR["P6"] * PAR["P4"] * d / 2
        if five[d] < need: continue
        if not (five[d] >= five[d - 1] and five[d] > five[d + 1]): continue
        if any(abs(d - c) <= 0.15 * c for c in [p_main] + [c for c, _ in out]): continue
        out.append((int(d), int(five[d])))
    return out

def lines_through_cover(th, g, base, p):
    """1-1: join the line points of step 2 into horizontal lines. Along each row (+-1 px), a run of columns that are either
    line-seen or covered by ink is one line; it ends where the row meets paper. A run with real line pixels lends its line
    strength to the covered columns inside it (line under a beam/notehead), so step 3 sees the line there too."""
    m = line_mask(th); k3 = np.ones((3, 1), np.uint8)
    seen = cv2.dilate(m.astype(np.uint8), k3) > 0
    cover = (cv2.dilate((g < base).astype(np.uint8), k3) > 0) & ~seen
    nonpaper = seen | cover; th2 = th.copy(); W = th.shape[1]; filled = 0
    for y in range(th.shape[0]):
        r = nonpaper[y]
        if not r.any(): continue
        d = np.diff(np.r_[0, r.astype(np.int8), 0]); st, en = np.where(d == 1)[0], np.where(d == -1)[0]
        rid = np.cumsum(d[:W] == 1) * r                                   # run id per column, 0 = paper
        sv = seen[y]; nseen = np.bincount(rid, weights=sv, minlength=len(st) + 1)
        sth = np.bincount(rid, weights=np.where(sv, th[y], 0), minlength=len(st) + 1)
        strength = sth / np.maximum(nseen, 1)
        ok = nseen >= PAR["P16"] * p                                               # a real line piece, not a short stroke
        ok[0] = False
        fill = cover[y] & ok[rid]
        if fill.any(): th2[y, fill] = np.maximum(th2[y, fill], strength[rid][fill]); filled += int(fill.sum())
    return th2, filled

def peaks(s, gap):
    pk = [y for y in range(1, len(s) - 1) if s[y] >= s[y - 1] and s[y] > s[y + 1]]
    pk.sort(key=lambda y: -s[y]); keep = []
    for y in pk:
        if all(abs(y - z) >= gap for z in keep): keep.append(y)
    return sorted(keep)

def detect(g, k, p_force=None):
    H, W = g.shape; th = response(g, k); p = p_force or interline(th)
    if p is None: return dict(p=None, staves=[], tabs=[], dropped=[], k=k), th
    sw = max(8, int(round(PAR["P4"] * p))); ns = max(1, W // sw)
    edges = np.linspace(0, W, ns + 1).astype(int)
    base = min(cv2.threshold(g, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[0], 150.0)
    th_l, n_filled = lines_through_cover(th, g, base, p)        # v5: step 3 reads joined lines, not raw per-strip response
    prof = [np.quantile(th_l[:, edges[j]:edges[j + 1]], PAR["P3"], axis=1).astype(np.float32) for j in range(ns)]
    pks = [peaks(s, max(2, int(PAR["P14"] * p))) for s in prof]
    hts = np.array([s[y] for s, pk in zip(prof, pks) for y in pk]) if any(pks) else np.array([0.0])
    tau = PAR["P10"][1] * float(np.percentile(hts, PAR["P10"][0])); tol = max(1, int(round(PAR["P9"] * p)))
    def tooth(s, y):
        a, b = max(0, y - tol), min(H, y + tol + 1)
        if a >= b: return y, 0.0
        i = int(np.argmax(s[a:b])); return a + i, float(s[a + i])
    strips = []                                     # per strip: list of combs
    for j, (s, pk) in enumerate(zip(prof, pks)):
        cands = []
        for y0 in pk:
            if s[y0] < tau: continue
            for sh in range(5):
                top = y0 - sh * p
                if top - tol < 0 or top + 4 * p + tol >= H: continue
                ys, vs = [], []
                y, v = tooth(s, top); ys.append(y); vs.append(v)
                for i in range(1, 5): y, v = tooth(s, ys[-1] + p); ys.append(y); vs.append(v)
                if sum(v >= tau for v in vs) < 5 - PAR["P11"]: continue
                if np.std(np.diff(ys)) > max(PAR["P12"] * p, ORIG_PX[0]): continue   # never finer than one original pixel
                if len(set(ys)) < 5: continue
                up, vu = tooth(s, ys[0] - p); dn, vd = tooth(s, ys[-1] + p)
                cands.append(dict(j=j, ys=ys, vs=vs, score=float(sum(vs)), med=float(np.median(vs)), up=float(vu), dn=float(vd)))
        cands.sort(key=lambda c: -c["score"]); keep = []
        for c in cands:
            if all(abs(c["ys"][0] - d["ys"][0]) > tol for d in keep): keep.append(c)
        strips.append(keep)
    # step 4: link neighbouring strips (top line within P5*p)
    chains = []; active = []
    for j in range(ns):
        nxt = []; used = set()
        for c in strips[j]:
            best = None
            for ci, ch in enumerate(active):
                if ci in used: continue
                d = abs(ch[-1]["ys"][0] - c["ys"][0])
                if d <= PAR["P5"] * p and (best is None or d < best[0]): best = (d, ci)
            if best: used.add(best[1]); active[best[1]].append(c); nxt.append(active[best[1]])
            else: ch = [c]; chains.append(ch); nxt.append(ch)
        active = nxt
    # bridge: a line hidden under a beam/notehead is covered by INK, a line that really ends has PAPER.
    # Join chain a -> later chain b (same height within P5*p) when no run of >= P14*p columns has >= 4 of 5 lines on paper.
    base = min(cv2.threshold(g, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[0], 150.0)
    def on_line(x, y):                              # line response or ink at (x, y+-1)
        y = int(round(y)); a, b = max(0, y - 1), min(H, y + 2)
        return th[a:b, x].max() > tau or g[a:b, x].min() < base
    def bridgeable(ca, cb):
        xa, xb = edges[ca["j"] + 1], edges[cb["j"]]; run = 0
        for x in range(xa, xb):
            t = (x - xa) / max(1, xb - xa)
            paper = sum(not on_line(x, ca["ys"][i] + t * (cb["ys"][i] - ca["ys"][i])) for i in range(5))
            run = run + 1 if paper >= 4 else 0
            if run >= max(2, int(PAR["P17"] * p)): return False
        return True
    chains.sort(key=lambda ch: ch[0]["j"]); bridged = {}
    merged = True
    while merged:
        merged = False
        for a in chains:
            nxt = [b for b in chains if b is not a and b[0]["j"] > a[-1]["j"] + 1
                   and abs(b[0]["ys"][0] - a[-1]["ys"][0]) <= PAR["P5"] * p]
            nxt.sort(key=lambda b: b[0]["j"])
            for b in nxt[:1]:
                if bridgeable(a[-1], b[0]):
                    bridged[id(a)] = bridged.get(id(a), 0) + bridged.pop(id(b), 0) + 1
                    a.extend(b); chains.remove(b); merged = True; break
            if merged: break
    for ch in chains: ch[0]["bridged"] = bridged.get(id(ch), 0)
    chains = [ch for ch in chains if len(ch) >= PAR["P6"]]
    # dedup: candidates that overlap vertically AND horizontally = same staff -> keep the stronger
    def yr(ch): return min(c["ys"][0] for c in ch), max(c["ys"][4] for c in ch)
    def xr(ch): return edges[ch[0]["j"]], edges[ch[-1]["j"] + 1]
    def over(u, v): return not (u[1] < v[0] or u[0] > v[1])
    chains.sort(key=lambda ch: -sum(c["score"] for c in ch)); kept, dropped = [], []
    for ch in chains:
        hit = next((k2 for k2 in kept if over(yr(ch), yr(k2)) and over(xr(ch), xr(k2))), None)
        (dropped if hit else kept).append(ch)
    staves, tabs = [], []
    for ch in kept:
        xs = np.array([(edges[c["j"]] + edges[c["j"] + 1]) / 2 for c in ch]); Y = np.array([c["ys"] for c in ch], float)
        def ly(i, x): return float(np.interp(x, xs, Y[:, i]))
        # extent: walk outward from the chain's end strips; end where >=4 of 5 lines vanish for >= P14*p columns
        def present(x):
            return sum(on_line(x, ly(i, x)) for i in range(5))
        def walk(x, step, lim):
            last, run = x, 0
            while 0 <= x < W and abs(x - lim) > 0:
                if present(x) >= 2: last, run = x, 0       # not ">= 4 of 5 vanished"
                else:
                    run += 1
                    if run >= max(2, int(PAR["P17"] * p)): break
                x += step
            return last
        j0, j1 = ch[0]["j"], ch[-1]["j"]
        x0 = walk(int(xs[0]), -1, -1); x1 = walk(int(xs[-1]), 1, W)   # no search limit: end only where lines meet paper
        # 6+ lines (P13): extra line above/below that is as long (>=70% of strips) and as strong (>=50%) -> tab-like
        ext = {}
        for side in ("up", "dn"):
            same = sum(c[side] >= PAR["P13"][1] * c["med"] for c in ch) / len(ch); ext[side] = round(same, 2)
        # diag: along each line and the would-be 6th line above/below, which columns are line/ink vs paper
        cx = np.arange(x0, x1 + 1)
        def cover(yy):
            yy = np.clip(np.round(yy).astype(int), 1, H - 2)
            on = np.zeros(len(cx), bool)
            for dy in (-1, 0, 1): on |= (th[yy + dy, cx] > tau) | (g[yy + dy, cx] < base)
            d = np.diff(np.r_[0, (~on).astype(np.int8), 0]); runs = np.where(d == -1)[0] - np.where(d == 1)[0]
            return on, float(on.mean()), int(runs.max()) if len(runs) else 0
        LY = np.array([np.interp(cx, xs, Y[:, i]) for i in range(5)]); gp = (LY[4] - LY[0]) / 4
        diag = {}
        # seen-only: fraction of columns where a real thin line is visible (ink-covered columns do NOT count)
        mseen = line_mask(th)
        def seen_cov(yy):
            yy = np.clip(np.round(yy).astype(int), 1, H - 2); on = np.zeros(len(cx), bool)
            for dy in (-1, 0, 1): on |= mseen[yy + dy, cx]
            return float(on.mean())
        diag["seen"] = [round(seen_cov(LY[i]), 3) for i in range(5)]
        for name, yy in [("up", LY[0] - gp), ("dn", LY[4] + gp)] + [(f"l{i}", LY[i]) for i in range(5)]:
            on, cv, mr = cover(yy)
            diag[name] = dict(cov=round(cv, 3), max_paper=mr, runs=int((np.diff(on.astype(np.int8)) == 1).sum()))
        diag["strip_ratio"] = {sd: [round(c[sd] / max(c["med"], 1e-6), 2) for c in ch] for sd in ("up", "dn")}
        rec = dict(diag=diag, x=[int(x0), int(x1)], xc=[int((edges[c["j"]] + edges[c["j"] + 1]) // 2) for c in ch], head_p=int(p), strips=[[int(c["j"]), [int(v) for v in c["ys"]]] for c in ch],
                   n_strips=len(ch), weak_strips=sum(1 for c in ch if min(c["vs"]) < tau), extra_line_frac=ext,
                   tilt_px=int(Y[:, 0].max() - Y[:, 0].min()), bridged=ch[0].get("bridged", 0))
        (tabs if max(ext.values()) >= PAR["P13"][0] else staves).append(rec)
    staves.sort(key=lambda r: r["strips"][0][1][0]); tabs.sort(key=lambda r: r["strips"][0][1][0])
    drp = [dict(j=[ch[0]["j"], ch[-1]["j"]], top=ch[0]["ys"][0]) for ch in dropped]
    return dict(filled_px=n_filled, p=p, k=int(k), tau=round(tau, 2), strip_w=sw, edges=[int(e) for e in edges], n_strips_page=ns, staves=staves, tabs=tabs, dropped=drp), th

def thickness(th, res):
    m = line_mask(th); runs = []
    for r in res["staves"]:
        for j, ys in r["strips"]:
            e = res["edges"]; x = (e[j] + e[j + 1]) // 2
            for y in ys:
                for xx in range(max(0, x - 10), min(m.shape[1], x + 10), 2):
                    if not m[y, xx]: continue
                    a = y
                    while a > 0 and m[a - 1, xx]: a -= 1
                    b = y
                    while b < m.shape[0] - 1 and m[b + 1, xx]: b += 1
                    runs.append(b - a + 1)
    return int(np.bincount(runs).argmax()) if runs else None

res = {}
paths = sorted(p for p in glob.glob("/kaggle/input/**/*", recursive=True) if p.lower().endswith((".png", ".jpg", ".jpeg", ".gif")))
for path in paths:
    stem = os.path.basename(path).rsplit(".", 1)[0]
    try:
        img = load(path); h0, w0 = img.shape[:2]
        # prep (P8): assume an A4 page and normalise the width to A4 at 300 dpi; no measuring before step 1
        f = PAR["P8"] / w0; ORIG_PX[0] = f
        im = img if f == 1.0 else cv2.resize(img, None, fx=f, fy=f, interpolation=cv2.INTER_CUBIC if f > 1 else cv2.INTER_AREA)
        g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
        k = PAR["P1_init"]; r, th = detect(g, k); t = thickness(th, r) if r["p"] else None; rounds = 1
        if t and r["p"]:
            k2 = int(min(PAR["P1_mult"] * t, r["p"] / 2 - 0.5)); k2 = max(3, k2)
            if abs(k2 - k) >= 2:
                r2, th2 = detect(g, k2); rounds = 2
                if len(r2["staves"]) >= len(r["staves"]): r, th = r2, th2; t = thickness(th, r) or t
        # multi-head: run the 5-line search again for each other spacing peak; keep staves that overlap no kept staff
        heads = []
        # candidates from the working response and from a narrow (4 px) one, so closely spaced small staves also show up
        cands = []
        for th_k in (th, response(g, 4)):
            _, sm = interline(th_k, full=True)
            if r["p"] and sm is not None:
                for c in spacing_candidates(sm, r["p"]):
                    if not any(abs(c[0] - d) <= 0.15 * d for d, _ in cands): cands.append(c)
        if r["p"]:
            def box(st): return (st["x"][0], st["x"][1], min(y[0] for _, y in st["strips"]), max(y[4] for _, y in st["strips"]))
            def over(a, b): return not (a[1] < b[0] or a[0] > b[1] or a[3] < b[2] or a[2] > b[3])
            kept = [box(st) for st in r["staves"] + r["tabs"]]
            for pc, ratio in cands:
                kc = max(3, min(r["k"], int(pc / 2 - 0.5)))
                rc, _ = detect(g, kc, p_force=pc); added = 0
                for st in rc["staves"]:
                    b = box(st)
                    if st["n_strips"] < PAR["P6x"]: continue      # a staff at another spacing must be longer (P6x)
                    if any(over(b, kb) for kb in kept): continue
                    r["staves"].append(st); kept.append(b); added += 1
                heads.append(dict(p=pc, support=ratio, k=kc, found=len(rc["staves"]), added=added, found_list=[dict(x=t["x"], top=t["strips"][0][1][0], n_strips=t["n_strips"]) for t in rc["staves"]]))
            r["staves"].sort(key=lambda st: st["strips"][0][1][0])
        r["heads"] = heads
        # step 5: ink threshold from the found staff lines (darkest in centre +- half thickness)
        otsu = cv2.threshold(g, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[0]; base = min(otsu, 150.0)
        paper = float(np.percentile(g, PAR["P7"]["q_paper"])); px = []; hw = max(1, (t or 2) // 2)
        for st in r["staves"]:
            if st["head_p"] != r["p"]: continue
            for j, ys in st["strips"]:
                a, b = r["edges"][j], r["edges"][j + 1]
                for y in ys:
                    seg = g[max(0, y - hw):y + hw + 1, a:b].min(0); px.append(seg[th[y, a:b] > r["tau"]])
        px = np.concatenate(px) if px else np.array([])
        lq = float(np.percentile(px, PAR["P7"]["q_line"])) if px.size else None
        T = max(base, lq + PAR["P7"]["alpha"] * (paper - lq)) if lq is not None else base
        r.update(stem=stem, orig=[w0, h0], scale=round(f, 4), thickness=t, rounds=rounds, ink_T=round(min(T, paper), 1),
                 line_q90=lq, paper=paper, to2000=round(2000 / (w0 * f), 5))
        res[stem] = r
        # picture: staves green (weak strip comb orange), tab-like red, dropped dup magenta
        vis = im.copy(); E = r.get("edges", [0])
        for st, col in [(s_, (0, 170, 0)) for s_ in r["staves"]] + [(s_, (0, 0, 230)) for s_ in r["tabs"]]:
            pts = [(xc, ys) for xc, (j, ys) in zip(st["xc"], st["strips"])]
            for i in range(5):
                poly = np.array([[int(x), int(ys[i])] for x, ys in pts], np.int32)
                cv2.polylines(vis, [poly], False, col, 2)
            y0 = st["strips"][0][1][0]; y1 = st["strips"][-1][1][4]
            cv2.line(vis, (st["x"][0], y0 - 6), (st["x"][0], y1 + 6), (230, 120, 0), 3)
            cv2.line(vis, (st["x"][1], y0 - 6), (st["x"][1], y1 + 6), (230, 120, 0), 3)
        for d in r["dropped"]:
            cv2.rectangle(vis, (E[d["j"][0]], d["top"]), (E[d["j"][1] + 1], d["top"] + 4 * r["p"]), (200, 0, 200), 2)
        vis = cv2.resize(vis, (1100, round(vis.shape[0] * 1100 / vis.shape[1])), interpolation=cv2.INTER_AREA)
        cv2.imwrite(f"{OUT}/vis/{stem}.jpg", vis, [cv2.IMWRITE_JPEG_QUALITY, 80])
        print(stem, "f", round(f, 2), "p", r["p"], "k", r["k"], "t", t, "staves", len(r["staves"]), "tabs", len(r["tabs"]),
              "dropped", len(r["dropped"]), "T", r["ink_T"], "heads", heads, flush=True)
    except Exception as e:
        import traceback; res[stem] = {"error": repr(e), "tb": traceback.format_exc()}; print(stem, "ERROR", e, flush=True)
json.dump(dict(params=PAR, sheets=res), open(f"{OUT}/staff.json", "w"), indent=1, default=float)

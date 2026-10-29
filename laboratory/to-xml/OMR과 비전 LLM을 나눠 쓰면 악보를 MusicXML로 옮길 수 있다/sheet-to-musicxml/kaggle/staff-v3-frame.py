# Kaggle CPU: staff detection v2 = v1 (staff-500.py, STAFF_DETECTION.md / PARAMETERS.md) + recovery by spacing structure
# (LOG 45, 48). v1 needs all 5 lines >= tau; sheets shrunk by the publisher draw some lines faint or not at all.
# Recovery: outside every v1 staff, a comb counts when >= R_strong of its 5 slots reach R_frac x tau, the slots between
# its lines and right outside it stay empty (< R_frac x tau), and the chain is >= P6x strips long. Self-check at the end:
# the page grid (LOG 48) predicts further staves; any predicted spot with staff evidence that no staff covers is reported.
# v3 = v2 + frame (LOG 51): same-row pieces of one staff are merged (a 2-column layout repeats its column ranges, a
# collage piece does not), the 5 lines are traced on a fixed grid over the whole x0..x1 (box top/bottom from that trace),
# and each end is typed bar / page / open; an open end far from the page's staff frame is reported (edge_check).
import glob, json, os, time
from multiprocessing import Pool
import cv2, numpy as np
cv2.setNumThreads(1)                                # before any cv2 call: a thread pool alive at fork deadlocks the Pool workers
from PIL import Image

OUT = "/kaggle/working/out"; os.makedirs(f"{OUT}/vis", exist_ok=True); os.makedirs(f"{OUT}/added", exist_ok=True)
PAR = dict(P1_mult=3.0, P1_init=9, P2=(6, 60), P3=0.5, P4=5.0, P5=0.5, P6=2, P7=dict(q_line=90, alpha=0.35, q_paper=90),
           P8=2480, P9=0.25, P10=(90, 0.25), P11=0, P12=0.10,
           P13=(0.70, 0.50), P14=0.5, P15=(99.5, 0.30, 6.0), P16=2.0, P17=0.5, P6x=6,
           R_strong=3, R_frac=0.5, F_frame=2.0, F_bar=0.9)
ONLY = None                                         # quick runs: list of stems
FROM = True                                         # frame-only runs: True = staves from the v2 kernel's staff.json

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

def detect(g, k, p_force=None, relax=False):
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
    lo_t = PAR["R_frac"] * tau                      # relax: a slot "has a line" at this level, "is empty" below it
    strips = []                                     # per strip: list of combs
    for j, (s, pk) in enumerate(zip(prof, pks)):
        cands = []
        for y0 in pk:
            if s[y0] < (lo_t if relax else tau): continue
            for sh in range(5):
                top = y0 - sh * p
                if top - tol < 0 or top + 4 * p + tol >= H: continue
                ys, vs = [], []
                y, v = tooth(s, top); ys.append(y); vs.append(v)
                for i in range(1, 5):
                    y, v = tooth(s, ys[-1] + p)
                    if relax and v < lo_t: y = ys[-1] + p        # empty slot: keep the comb's spacing, not a noise peak
                    ys.append(y); vs.append(v)
                if len(set(ys)) < 5: continue
                if relax:
                    strong = [i for i in range(5) if vs[i] >= lo_t]
                    if len(strong) < PAR["R_strong"]: continue
                    fit = np.polyfit(strong, [ys[i] for i in strong], 1)
                    # +1 px: line rows are whole pixels; at p ~10 on a shrunk page that alone breaks 10% (LOG 49)
                    if np.abs(np.polyval(fit, strong) - [ys[i] for i in strong]).max() > max(PAR["P12"] * p, ORIG_PX[0]) + 1.0: continue
                    if abs(fit[0] - p) > PAR["P9"] * p: continue
                    # whole interval, not the midpoint: a comb at a 4:3 wrong spacing has real lines off-midpoint (LOG 49)
                    # +2 px around each line: a 1 px line drawn across two rows spans up to 4 rows (yerum-conti 477-480)
                    def zone(a, b): return float(s[max(0, a):min(H, b)].max()) if min(H, b) > max(0, a) else 0.0
                    ex = tol + 2
                    between = [zone(ys[i] + ex + 1, ys[i + 1] - ex) for i in range(4)]
                    if np.mean(between) >= lo_t: continue
                    if max(zone(ys[0] - p - ex, ys[0] - ex), zone(ys[4] + ex + 1, ys[4] + p + ex + 1)) >= lo_t: continue
                else:
                    if sum(v >= tau for v in vs) < 5 - PAR["P11"]: continue
                    if np.std(np.diff(ys)) > max(PAR["P12"] * p, ORIG_PX[0]): continue   # never finer than one original pixel
                up, vu = tooth(s, ys[0] - p); dn, vd = tooth(s, ys[-1] + p)
                # relax: a comb shifted by one line has a real line right outside it (LOG 49)
                if relax and max(vu, vd) >= lo_t: continue
                score = float(sum(vs))
                cands.append(dict(j=j, ys=ys, vs=vs, score=score, med=float(np.median(vs)), up=float(vu), dn=float(vd)))
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
    t_on = lo_t if relax else tau
    def on_line(x, y):                              # line response or ink at (x, y+-1)
        y = int(round(y)); a, b = max(0, y - 1), min(H, y + 2)
        return th[a:b, x].max() > t_on or g[a:b, x].min() < base
    def bridgeable(ca, cb):
        xa, xb = edges[ca["j"] + 1], edges[cb["j"]]; run = 0
        for x in range(xa, xb):
            t = (x - xa) / max(1, xb - xa)
            paper = sum(not on_line(x, ca["ys"][i] + t * (cb["ys"][i] - ca["ys"][i])) for i in range(5))
            run = run + 1 if paper >= 4 else 0
            if run >= max(2, int(PAR["P17"] * p)): return False
        return True
    chains.sort(key=lambda ch: ch[0]["j"]); bridged = {}
    # a merge a+b changes only the successor of a and of chains whose successor was b; every earlier chain already
    # failed, so resume there, not from the start (same merges; restarting cost 1,689 s on reubenmorgan, LOG 52)
    tried, succ = {}, {}; i = 0
    while i < len(chains):
        a = chains[i]
        b = min((b for b in chains if b is not a and b[0]["j"] > a[-1]["j"] + 1
                 and abs(b[0]["ys"][0] - a[-1]["ys"][0]) <= PAR["P5"] * p), key=lambda b: b[0]["j"], default=None)
        succ[id(a)] = b
        if b is None: i += 1; continue
        pair = (id(a[-1]), id(b[0]))
        if pair not in tried: tried[pair] = bridgeable(a[-1], b[0])
        if not tried[pair]: i += 1; continue
        bridged[id(a)] = bridged.get(id(a), 0) + bridged.pop(id(b), 0) + 1
        a.extend(b); chains.remove(b)
        i = next((h for h in range(i) if succ[id(chains[h])] is b), i)
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
            for dy in (-1, 0, 1): on |= (th[yy + dy, cx] > t_on) | (g[yy + dy, cx] < base)
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
        (tabs if max(ext.values()) >= PAR["P13"][0] and not relax else staves).append(rec)   # relax: outside slots are empty already
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

def grid_check(g, r):
    """self-check (LOG 48): body-spacing staves predict more staves at the system pitch (gaps of >= 2 pitches, beyond
    the first/last); a predicted spot with >= R_strong slots >= R_frac x tau and empty between that overlaps no staff = miss."""
    st = sorted([dict(top=min(v[1][0] for v in s["strips"]), bot=max(v[1][4] for v in s["strips"]), x=s["x"])
                 for s in r["staves"] if s["head_p"] == r["p"]], key=lambda s: s["top"])
    if len(st) < 2: return []
    H = g.shape[0]; lo_t = PAR["R_frac"] * r["tau"]
    rmax = cv2.dilate(response(g, r["k"]), np.ones((5, 1), np.uint8))
    gap = float(np.median([s["bot"] - s["top"] for s in st])) / 4
    x0 = int(np.median([s["x"][0] for s in st])); x1 = int(np.median([s["x"][1] for s in st]))
    tops = [s["top"] for s in st]; d = np.diff(tops); pitch = float(np.median(d[d <= 1.4 * d.min()]))
    if pitch < 5 * gap: return []                                   # systems closer than a staff height: no grid
    pos = []
    for a, b in zip(tops, tops[1:]):
        n = round((b - a) / pitch)
        if n >= 2 and abs((b - a) / n - pitch) <= 0.25 * pitch: pos += [a + j * (b - a) / n for j in range(1, n)]
    for sign, start in ((-1, tops[0]), (1, tops[-1])):
        y = start + sign * pitch
        while 0 <= y and y + 4 * gap < H: pos.append(y); y += sign * pitch
    allbox = [(min(v[1][0] for v in s["strips"]), max(v[1][4] for v in s["strips"])) for s in r["staves"] + r["tabs"]]
    miss = []
    for y0 in pos:
        # pick among spots that pass the structure test; picking first can land on a lyric row next to the staff
        best = None
        for y in range(int(y0 - gap), int(y0 + gap) + 1):
            rows = [round(y + i * gap) for i in range(5)]
            if rows[0] < 0 or rows[-1] >= H: continue
            s = [float(np.median(rmax[v, x0:x1])) for v in rows]
            b = [float(np.median(rmax[round(y + (i + 0.5) * gap), x0:x1])) for i in range(4)]
            if sum(v >= lo_t for v in s) < PAR["R_strong"] or np.mean(b) >= lo_t: continue
            if best is None or sum(sorted(s)[-3:]) > best[0]: best = (sum(sorted(s)[-3:]), y, s)
        if best is None: continue
        _, y, s = best
        if any(not (y + 4 * gap < a - gap or y > z + gap) for a, z in allbox): continue
        miss.append(dict(y=int(y), x=[x0, x1], s=[round(v / r["tau"], 2) for v in s]))
    return miss

def top_of(s): return min(v[1][0] for v in s["strips"])
def bot_of(s): return max(v[1][4] for v in s["strips"])

def merge_fragments(staves):
    """two staves on one row, side by side, same spacing, and neither x range repeats on the page (+-F_frame x p) = pieces
    of one staff (collage page, streamofpraise LOG 50). A 2-column layout repeats its column ranges, so it stays split."""
    def framed(s, pool):
        t = PAR["F_frame"] * s["head_p"]
        return any(o is not s and abs(o["x"][0] - s["x"][0]) <= t and abs(o["x"][1] - s["x"][1]) <= t for o in pool)
    pool, log = list(staves), []
    while True:
        pair = None
        for a in sorted(pool, key=lambda s: s["x"][0]):
            row = [b for b in pool if b is not a and b["head_p"] == a["head_p"] and b["x"][0] > a["x"][1]
                   and min(bot_of(a), bot_of(b)) - max(top_of(a), top_of(b)) >= 0.5 * min(bot_of(a) - top_of(a), bot_of(b) - top_of(b))]
            if not row: continue
            b = min(row, key=lambda s: s["x"][0])
            if not framed(a, pool) and not framed(b, pool): pair = (a, b); break
        if pair is None: return pool, log
        a, b = pair
        m = dict(a, x=[a["x"][0], b["x"][1]], xc=a["xc"] + b["xc"], strips=a["strips"] + b["strips"], n_strips=a["n_strips"] + b["n_strips"],
                 pieces=a.get("pieces", 1) + b.get("pieces", 1), recovered=bool(a.get("recovered") or b.get("recovered")))
        log.append(dict(top=[top_of(a), top_of(b)], x=[a["x"], b["x"]], gap=b["x"][0] - a["x"][1]))
        pool = [s for s in pool if s is not a and s is not b] + [m]

def frame(g, th, st, tau, ink_T):
    """5 line rows on a grid of P4 x p steps over x0..x1: between found strips the interpolated rows (measured; a re-search
    there only snaps to beams, LOG 51); past them walked outward point by point from the end strip, the 5 rows shifted
    together +-tol in the window's median response (spacing kept; the shift taken only if >= 3 lines >= R_frac x tau, else
    the previous rows stay). A linear extrapolation drifted off over long untraced ends (markers-plate, LOG 51).
    Ends: from p/2 inside the end, walk outward while >= 2 lines go on (line response or ink at their rows); stopping at
    a column inked over >= F_bar of line 1..5 = bar (the end moves to it when it is outside), at more than P17 x p columns
    with < 2 lines = lines ended (same rule as step 7; a bar pasted apart from the lines stays outside, streamofpraise).
    No fixed search distance: palmer's final bar sat 3.3p past the strips, beyond a 3p window (LOG 51). Within p of the
    page side = page; else open."""
    H, W = g.shape; p = st["head_p"]; x0, x1 = st["x"]; tol = max(1, int(round(PAR["P9"] * p))); lo = PAR["R_frac"] * tau
    xc = np.array(st["xc"], float); Y = np.array([ys for _, ys in st["strips"]], float); o = np.argsort(xc); xc, Y = xc[o], Y[o]
    def est(x, i): return float(np.interp(x, xc, Y[:, i]))
    def bar_frac(x, ys):
        a, b = max(0, ys[0]), min(H, ys[4] + 1)
        return float((g[a:b, x - 1:x + 2].min(1) < ink_T).mean()) if 1 <= x < W - 1 and b > a else 0.0
    def end(xe, out):
        ys = [int(round(est(xe, i))) for i in range(5)]; near = max(3, p / 2); miss = 0
        def on(c, d): return sum(th[max(0, y + d - 1):y + d + 2, c].max() > lo or g[max(0, y + d - 1):y + d + 2, c].min() < ink_T for y in ys)
        band = [c for c in range(int(xe - out * near), xe + out, out) if 0 <= c < W]      # strip rows may be off at the end: settle them first
        d0 = max(range(-tol, tol + 1), key=lambda t: (sum(on(c, t) for c in band), -abs(t)))
        ys = [y + d0 for y in ys]
        for x in range(int(xe - out * near), W if out > 0 else -1, out):
            if bar_frac(x, ys) >= PAR["F_bar"]: return (xe if (x - xe) * out <= near else x), "bar"
            if (x - xe) * out <= near: continue
            d = max((0, -1, 1), key=lambda t: on(x, t))      # rows follow the lines 1 px per column: hand-drawn slope (palmer, LOG 51)
            if on(x, d) >= 2: ys = [y + d for y in ys]; miss = 0
            else: miss += 1
            if miss > PAR["P17"] * p: break
        return xe, ("page" if xe <= p or xe >= W - 1 - p else "open")
    x0, e0 = end(int(x0), -1); x1, e1 = end(int(x1), 1)
    n = max(2, int(np.ceil((x1 - x0) / (PAR["P4"] * p))) + 1); half = PAR["P4"] * p / 2; lines = []
    def measure(x, e, d):
        a, b = int(max(x0, x - half)), int(min(x1 + 1, x + half + 1))      # window stays inside the staff at the ends
        r0, r1 = int(max(0, min(e) - d - 2)), int(min(H, max(e) + d + 3))
        prof = np.quantile(th[r0:r1, a:b], PAR["P3"], axis=1)
        def hit(dy): return [float(prof[max(0, c - 1):c + 2].max()) if 0 <= c < len(prof) else 0.0 for c in (int(round(v + dy)) - r0 for v in e)]
        dy = max(range(-d, d + 1), key=lambda t: (sum(v >= lo for v in hit(t)), sum(hit(t)), -abs(t)))
        if sum(v >= lo for v in hit(dy)) < 3: dy = 0
        return [int(round(v + dy)) for v in e], sum(v >= lo for v in hit(dy))
    xs = [int(round(x)) for x in np.linspace(x0, x1, n)]; at = {}
    for x in xs:
        if len(xc) < 2 or xc[0] <= x <= xc[-1]: at[x] = [x, *measure(x, [est(x, i) for i in range(5)], 0)]
    if len(xc) >= 2:
        for pts, prev in (([x for x in xs if x < xc[0]][::-1], list(Y[0])), ([x for x in xs if x > xc[-1]], list(Y[-1]))):
            for x in pts: ys, seen = measure(x, prev, tol); at[x] = [x, ys, seen]; prev = ys
    lines = [at[x] for x in xs]
    return dict(x=[int(x0), int(x1)], lines=lines, ends=[e0, e1], seen=round(sum(l[2] for l in lines) / (5 * len(lines)), 3),
                box=[int(x0), int(x1), int(min(top_of(st), *(l[1][0] for l in lines))), int(max(bot_of(st), *(l[1][4] for l in lines)))])

def edge_check(r):
    """self-check: an open end is explained when another staff ends at the same x on that side (+-F_frame x p: page frame
    or a column of a 2-column page) or it is the first staff's left indent; any other open end is reported."""
    sts = r["staves"]; out = []
    if len(sts) < 2: return []
    first = min(sts, key=lambda s: s["box"][2])
    for s in sts:
        for side in (0, 1):
            if s["ends"][side] != "open" or (side == 0 and s is first): continue
            if any(o is not s and abs(o["x"][side] - s["x"][side]) <= PAR["F_frame"] * s["head_p"] for o in sts): continue
            out.append(dict(top=s["box"][2], side="lr"[side], x=s["x"][side]))
    return out

def selftest():
    # 6 staves, gap 20: 4 normal, #2 with lines 2/3 faint (like jrabbit), #4 with line 3 missing (like jus)
    g = np.full((3508, 2480), 255, np.uint8)
    for n in range(6):
        top = 300 + n * 500
        for i in range(5):
            if n == 4 and i == 2: continue
            shade = 220 if n == 2 and i in (1, 2) else 40
            cv2.line(g, (200, top + 20 * i), (2280, top + 20 * i), int(shade), 2)
        for x in range(400, 2200, 150): cv2.ellipse(g, (x, top + 30 + (x // 150 % 4) * 10), (12, 9), -20, 0, 360, 0, -1)
    cv2.line(g, (2280, 300), (2280, 381), 40, 3)                     # staff 0: final barline right, open start left
    ORIG_PX[0] = 1.0
    r, th = detect(g, 9); v1 = sorted(min(v[1][0] for v in s["strips"]) for s in r["staves"])
    r2, _ = detect(g, 9, p_force=r["p"], relax=True); v2 = sorted(min(v[1][0] for v in s["strips"]) for s in r2["staves"])
    print("selftest p", r["p"], "v1", v1, "relax", v2, flush=True)
    assert len(v1) == 4 and 1300 not in [round(y, -2) for y in v1], v1
    assert [round(y, -2) for y in v2] == [300, 800, 1300, 1800, 2300, 2800], v2
    # frame: staff 0 traced over its whole width, open left, bar right
    s0 = min(r["staves"], key=top_of); f0 = frame(g, th, s0, r["tau"], 128.0)
    print("selftest frame", s0["x"], f0["ends"], f0["box"], f0["seen"], flush=True)
    assert f0["ends"] == ["open", "bar"] and abs(s0["x"][0] - 200) <= 20 and abs(s0["x"][1] - 2280) <= 20, f0
    assert all(abs(l[1][0] - 300) <= 2 and abs(l[1][4] - 380) <= 2 for l in f0["lines"]), f0["lines"]
    # frame: strips end 19p before the final bar (palmer had 3.3p) and read 4 px high (slope): the end walks along the lines to the bar
    o = [i for i in range(len(s0["xc"])) if s0["xc"][i] <= 1900]
    s2 = dict(s0, x=[s0["x"][0], 1900], xc=[s0["xc"][i] for i in o], strips=[[s0["strips"][i][0], [y - 4 for y in s0["strips"][i][1]]] for i in o])
    f2 = frame(g, th, s2, r["tau"], 128.0)
    print("selftest frame walk", f2["x"], f2["ends"], flush=True)
    assert f2["ends"][1] == "bar" and abs(f2["x"][1] - 2280) <= 3, f2["x"]
    # frame: strips only on the right half, the first 6 tilted 2 px (noise): the untraced left half must still follow the lines
    o = sorted(i for i in range(len(s0["xc"])) if s0["xc"][i] >= 1200)
    s1 = dict(s0, xc=[s0["xc"][i] for i in o], strips=[(s0["strips"][i][0], [y + min(j, 5) // 2 for y in s0["strips"][i][1]]) for j, i in enumerate(o)])
    f1 = frame(g, th, s1, r["tau"], 128.0)
    print("selftest frame half", s1["xc"][0], f1["box"], f1["seen"], flush=True)
    assert all(abs(l[1][0] - 300) <= 2 and abs(l[1][4] - 380) <= 2 for l in f1["lines"]), f1["lines"]
    # merge: a collage row (2 pieces, offset 12 px) joins; a 2-column layout (repeated column ranges) stays split
    def rec(x0, x1, top): return dict(x=[x0, x1], xc=[(x0 + x1) // 2], strips=[[0, [top + 20 * i for i in range(5)]]], head_p=20, n_strips=1)
    pool = [rec(100, 2300, 300), rec(100, 2300, 800), rec(119, 521, 1306), rec(541, 2226, 1294), rec(100, 2300, 1800),
            rec(189, 1155, 2300), rec(1528, 2391, 2304), rec(189, 1155, 2700), rec(1528, 2391, 2702)]
    out, log = merge_fragments(pool)
    print("selftest merge", len(out), log, flush=True)
    assert len(out) == 8 and len(log) == 1 and [119, 2226] in [s["x"] for s in out], log

selftest()
res = {}
if FROM: FROM = json.load(open(next(q for q in glob.glob("/kaggle/input/**/staff.json", recursive=True))))["sheets"]
paths = sorted(p for p in glob.glob("/kaggle/input/**/*", recursive=True) if p.lower().endswith((".png", ".jpg", ".jpeg", ".gif")) and "/out/" not in p)   # not a kernel source's vis
def run(path):
    stem = os.path.basename(path).rsplit(".", 1)[0]
    try:
        img = load(path); h0, w0 = img.shape[:2]
        # prep (P8): assume an A4 page and normalise the width to A4 at 300 dpi; no measuring before step 1
        f = PAR["P8"] / w0; ORIG_PX[0] = f
        im = img if f == 1.0 else cv2.resize(img, None, fx=f, fy=f, interpolation=cv2.INTER_CUBIC if f > 1 else cv2.INTER_AREA)
        g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
        if FROM:                                    # frame-only: staves from v2 (detection unchanged since LOG 49)
            r = FROM[stem]; th = response(g, r["k"]); t = r["thickness"]; rounds = r["rounds"]; recovered = r["recovered"]
        else:
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
            # recovery: at every spacing a staff was found with, search by structure where no staff is (1 gap margin)
            # v1 tabs are searched too: a real staff there replaces the tab (yerum-conti, LOG 49)
            recovered = []
            if r["p"]:
                kept = [box(st) for st in r["staves"]]
                # largest spacing first: a small comb fits between the lines of a larger staff (yerum-conti, LOG 49)
                for pc in sorted({r["p"]} | {st["head_p"] for st in r["staves"]}, reverse=True):
                    kc = r["k"] if pc == r["p"] else max(3, min(r["k"], int(pc / 2 - 0.5)))
                    rc, _ = detect(g, kc, p_force=pc, relax=True)
                    for st in rc["staves"]:
                        b = box(st)
                        if st["n_strips"] < PAR["P6x"]: continue
                        if any(over((b[0], b[1], b[2] - pc, b[3] + pc), kb) for kb in kept): continue
                        st["recovered"] = True; r["staves"].append(st); kept.append(b)
                        tab = [t_ for t_ in r["tabs"] if over(box(t_), b)]
                        r["tabs"] = [t_ for t_ in r["tabs"] if t_ not in tab]
                        recovered.append(dict(p=pc, x=st["x"], top=b[2], bottom=b[3], n_strips=st["n_strips"], replaced_tab=len(tab)))
                r["staves"].sort(key=lambda st: st["strips"][0][1][0])
        r["recovered"] = recovered
        r["staves"], r["merged"] = merge_fragments(r["staves"]); r["staves"].sort(key=top_of)
        # step 5: ink threshold from the found staff lines (darkest in centre +- half thickness)
        otsu = cv2.threshold(g, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[0]; base = min(otsu, 150.0)
        paper = float(np.percentile(g, PAR["P7"]["q_paper"])); px = []; hw = max(1, (t or 2) // 2)
        for st in r["staves"]:
            if st["head_p"] != r["p"] or st.get("recovered"): continue      # keep v1's ink threshold
            for j, ys in st["strips"]:
                a, b = r["edges"][j], r["edges"][j + 1]
                for y in ys:
                    seg = g[max(0, y - hw):y + hw + 1, a:b].min(0); px.append(seg[th[y, a:b] > r["tau"]])
        px = np.concatenate(px) if px else np.array([])
        lq = float(np.percentile(px, PAR["P7"]["q_line"])) if px.size else None
        T = max(base, lq + PAR["P7"]["alpha"] * (paper - lq)) if lq is not None else base
        r.update(stem=stem, orig=[w0, h0], scale=round(f, 4), thickness=t, rounds=rounds, ink_T=round(min(T, paper), 1),
                 line_q90=lq, paper=paper, to2000=round(2000 / (w0 * f), 5))
        r["grid_miss"] = grid_check(g, r) if r["p"] else []
        ths = {r["p"]: th}
        for st in r["staves"] + r["tabs"]:
            pc = st["head_p"]
            if pc not in ths: ths[pc] = response(g, max(3, min(r["k"], int(pc / 2 - 0.5))))
            st.update(frame(g, ths[pc], st, r["tau"], r["ink_T"]))
        r["edge_check"] = edge_check(r) if r["p"] else []
        result = r
        for i, a in enumerate(r["recovered"]):
            gp = (a["bottom"] - a["top"]) / 4; y0 = max(0, int(a["top"] - 3 * gp)); crop = im[y0:int(a["bottom"] + 3 * gp)].copy()
            cv2.rectangle(crop, (a["x"][0], a["top"] - y0), (a["x"][1], a["bottom"] - y0), (230, 120, 0), 2)
            cv2.imwrite(f"{OUT}/added/{stem}_{i}.jpg", cv2.resize(crop, (1240, max(1, crop.shape[0] // 2))), [cv2.IMWRITE_JPEG_QUALITY, 85])
        # picture: staves green, recovered blue, tab-like red, dropped dup magenta; end marks bar blue, open orange, page grey
        vis = im.copy(); E = r.get("edges", [0])
        for st, col in [(s_, (230, 120, 0) if s_.get("recovered") else (0, 170, 0)) for s_ in r["staves"]] + [(s_, (0, 0, 230)) for s_ in r["tabs"]]:
            for i in range(5):
                poly = np.array([[x, ys[i]] for x, ys, _ in st["lines"]], np.int32)
                cv2.polylines(vis, [poly], False, col, 2)
            for side, (x, ys, _) in ((0, st["lines"][0]), (1, st["lines"][-1])):
                ec = {"bar": (230, 120, 0), "open": (0, 140, 255), "page": (128, 128, 128)}[st["ends"][side]]
                cv2.line(vis, (x, ys[0] - 6), (x, ys[4] + 6), ec, 3)
        for d in r["dropped"]:
            cv2.rectangle(vis, (E[d["j"][0]], d["top"]), (E[d["j"][1] + 1], d["top"] + 4 * r["p"]), (200, 0, 200), 2)
        vis = cv2.resize(vis, (1100, round(vis.shape[0] * 1100 / vis.shape[1])), interpolation=cv2.INTER_AREA)
        cv2.imwrite(f"{OUT}/vis/{stem}.jpg", vis, [cv2.IMWRITE_JPEG_QUALITY, 80])
        print(stem, "f", round(f, 2), "p", r["p"], "k", r["k"], "t", t, "staves", len(r["staves"]), "tabs", len(r["tabs"]),
              "dropped", len(r["dropped"]), "T", r["ink_T"], "recovered", recovered, "grid_miss", r["grid_miss"],
              "merged", r["merged"], "edge_check", r["edge_check"], flush=True)
    except Exception as e:
        import traceback; result = {"error": repr(e), "tb": traceback.format_exc()}; print(stem, "ERROR", e, flush=True)
    return stem, result

todo = [q for q in paths if ONLY is None or os.path.basename(q).rsplit(".", 1)[0] in ONLY]
if FROM: todo = [q for q in todo if os.path.basename(q).rsplit(".", 1)[0] in FROM]
t0 = time.time()
with Pool(os.cpu_count()) as pool:                 # sheets are independent: one process per core
    for i, (stem, result) in enumerate(pool.imap_unordered(run, todo), 1):
        res[stem] = result; print(f"progress {i}/{len(todo)} {time.time() - t0:.0f}s", flush=True)   # _server/kaggle.py --watch
res = dict(sorted(res.items()))
json.dump(dict(params=PAR, sheets=res), open(f"{OUT}/staff.json", "w"), indent=1, default=float)

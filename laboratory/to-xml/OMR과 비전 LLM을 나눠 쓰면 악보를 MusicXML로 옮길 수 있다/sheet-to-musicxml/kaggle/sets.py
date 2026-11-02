# Kaggle GPU: chord / staff / lyric sets, one set per staff, by pixel ownership (LOG 54). Staves = staff detection v3
# (sheet-staff-v3 staff.json, STAFF_DETECTION.md, final LOG 53). Every ink pixel (g < ink_T) goes to exactly one of
# set k chord / set k staff / set k lyric / ignored (title, labels, measure numbers, brackets, dust ...).
# Staff: pure staff-line pixels + every component touching a staff body + non-text marks near a staff (ties, ledger notes).
# Text: the other components grouped into rows and words, each word read by EasyOCR (recognizer only, our own boxes, so
# one-letter chords are read too, LOG 10); a chord row belongs to the staff below, lyric rows to the staff above.
import glob, json, os, re, subprocess, sys, time
subprocess.run(f"{sys.executable} -m pip install -q paddlepaddle-gpu -i https://www.paddlepaddle.org.cn/packages/stable/cu126/ > /dev/null 2>&1", shell=True)
# paddle-gpu brings its own NCCL, which breaks the preinstalled torch that paddleocr imports if present; torch is unused here
subprocess.run(f"{sys.executable} -m pip uninstall -y -q torch torchvision torchaudio > /dev/null 2>&1", shell=True)
if subprocess.run([sys.executable, "-c", "import paddle; assert paddle.device.is_compiled_with_cuda()"]).returncode:
    subprocess.run(f"{sys.executable} -m pip install -q paddlepaddle > /dev/null 2>&1", shell=True)
subprocess.run(f"{sys.executable} -m pip install -q paddleocr > /dev/null 2>&1", shell=True)
import cv2, numpy as np
from paddleocr import TextRecognition
from PIL import Image
from sklearn.ensemble import HistGradientBoostingClassifier

OUT = "/kaggle/working/out"
for d in ("vis", "label", "gt"): os.makedirs(f"{OUT}/{d}", exist_ok=True)
TEST = ["agapao_bedeuroui-gobaek_1", "allnations_modeun-neungryeokgwa-gwonse_1", "streamofpraise_juneun-naui-bit_1", "susanghanstreet_o-juyeo_1", "nomunhwan_geuga-jjillimeun_1", "yerum-conti_naega-yesureul-motbakatseumnida-conti_1", "yerum-conti_juleul-wihan-igose-conti_1", "jrabbit_sarangeun-love-is_1", "palmer_gujuyeo-gwangpung_1", "markers-plate_saranaen-mankeum-saranghan-mankeum_2", "simhyeongjin_eunhyeroda_1", "wecclesia_meonjeo-first_1", "markers_ju-ui-ireum-nopimyeo_1", "theoneworship_naneun-mideumeuro_1"]   # GT test set (LOG 55)
TRAIN = ["bridge-impact_majimak-nare_1", "jesusdivine_hangaji_1", "seraphim_sesangeul-saneun-jihye_2", "kimyoungpyo_kkeutnaji-aneun-yebae_2", "kimsuji_chukbok-ui-tongno_1", "mideumuisaramdeul_ije-neun-sarang_1", "traditional_chansonghara-yeohowaui-jongdeura_1", "mattredman-levites_abeojiui-norae_1", "david-jonathan_deureora-junimui-eumseong_1", "lnmorris_na-eoneunal-kkumsogeul_1", "ccmhub-jeonseongjin_sonbbyeokchimyeo-chum-chwo_1", "kim-bokyu_adameun-malhagon-haji_1", "bogeumseongga_junimui-sup_1", "choi-u-gyu_naega-saraganeun-him_1", "holyimpact_eunhyeui-bicheuro_1", "ccmhub-jeonggeunyeong_duryeowo-malla_1", "gohyeongwon_modeun-ireum-wie-ttwieonan-ireum_1", "sim-jong-ho_gamsahameuro_1", "hongisaac_hananimui-segye_1", "jus_sipjaga_1", "philwickham-levites_ju-yesu-naui-san-somang_1", "leegilseung_gyeongbaehari-ju_1", "kimseokgyun_gasigwan_1", "yesumaeul_saranghaeyo-nae-abeoji_1", "billyfunk_give-thanks-and-praise_1", "tabernacle_blessed_1", "maggidawn_geuneun-uri-joereul_1", "leedojin_lords-love-for-me_1", "don-besig_i-mideum-deouk-gutsera_1", "a5_gohyeongwon_sesang-modeun-minjogi_1", "minhoki_naega-yeonyakhaedo_1", "leehyukjin_god-is-working_1", "mungyeongil_naega-eodum-sogeseo_1", "leeminseop_dangsineun-sarangbatgi_1", "youngsan-singers_naui-ane-geohara_1", "isaiah61_on-uju-jeone_2"]   # GT train set (LOG 60)
ONLY = TEST + TRAIN
PAR = dict(W=2480, word_gap=0.5, row_gap=0.1, chord_reach=4.0, lyric_first=8.0, lyric_reach=4.0, mark_reach=4.0, conf=0.3, title=4.0, start=3.5, learn_sure=0.7,
           tie=dict(w=1.8, h=(0.4, 1.6), fill=0.4, flat=0.4), frame=dict(small=4.0, min=1.0, fill=0.35, edge=0.85), dust=0.05)
CLS = {"chord": 1, "staff": 2, "lyric": 3, "ignore": 4}
SECTION = re.compile(r"verse|chorus|bridge|intro|outro|interlude|ending|coda|fine|tag|pre-|key|rit\.|repeat|D\.\s?[SC]|copyright|©|rights|administered|permission|www\.|\.com", re.I)
COPY = re.compile(r"©|@|copyright|admin|rights|ccli|www\.|\.com", re.I)          # one hit -> the whole row (OCR garbles the rest)
HANGUL = re.compile(r"[가-힣ㄱ-ㅎㅏ-ㅣ]")
CHORD = re.compile(r"[(\[]?[A-G][#b♯♭]?(?:maj|min|dim|aug|sus|add|m|M|[0-9]|[+\-°ø()])*(?:/[A-G][#b♯♭]?)?[)\]]?")

import paddle
model = TextRecognition(model_name="korean_PP-OCRv5_mobile_rec", device="gpu:0" if paddle.device.is_compiled_with_cuda() else "cpu")   # LOG 56
print("OCR device:", "gpu" if paddle.device.is_compiled_with_cuda() else "cpu", flush=True)


def recognize(g, hl):                                               # hl = [[x0, x1, y0, y1]] -> [(text, conf)]
    crops = [cv2.cvtColor(g[y0:y1, x0:x1], cv2.COLOR_GRAY2BGR) for x0, x1, y0, y1 in hl]
    return [(r["rec_text"], float(r["rec_score"])) for r in model.predict(input=crops)] if crops else []
GT = next((json.load(open(q)) for q in glob.glob("/kaggle/input/**/sets-gt.json", recursive=True)), {})   # [kind, x0, y0, x1, y1, C|L|N|X]
GTCLS = {"C": "chord", "L": "lyric", "N": "staff", "X": "ignore"}
STAFF = json.load(open(next(q for q in glob.glob("/kaggle/input/**/staff.json", recursive=True))))["sheets"]


def load(path):
    pim = Image.open(path).convert("RGBA"); bg = Image.new("RGBA", pim.size, (255, 255, 255, 255)); bg.alpha_composite(pim)
    return cv2.cvtColor(np.array(bg.convert("RGB")), cv2.COLOR_RGB2BGR)


def kind_of(text):
    t = text.replace(" ", "").replace("I", "/").replace("|", "/")      # EasyOCR reads the slash of G/B as I or |
    if CHORD.fullmatch(t): return "chord"
    # OCR-garbled chords: A-G first, then short, or with a digit / bracket / slash ("GMz", "EonD)", "A(onBr)B'")
    if not HANGUL.search(t) and re.match(r"[(\[]?[A-G]", t) and len(t) <= 14 and (len(t) <= 3 or re.search(r"[0-9()/\[\]]", t)): return "chord"
    if HANGUL.search(text): return "lyric"
    if re.fullmatch(r"[0-9]+\.?", t): return "num"
    if re.search(r"[A-Za-z]{2,}", text): return "latin"
    if re.fullmatch(r"[-~_]+", t): return "dash"
    return "other"


LETTER = {"chord": "C", "lyric": "L", "staff": "N", "ignore": "X"}


def features(*, p, sb, q, tokens, H):                              # LOG 59
    x0, y0, x1, y1 = q["box"]; cy, cx = (y0 + y1) / 2, (x0 + x1) / 2
    xs = [s for s in sb if s[0] - 2 * p < x1 and x0 < s[1] + 2 * p] or sb
    above = min([cy - s[3] for s in xs if s[3] < cy], default=99 * p); below = min([s[2] - cy for s in xs if s[2] > cy], default=99 * p)
    near_ = min(xs, key=lambda s: min(abs(cy - s[2]), abs(cy - s[3])))
    row = [t for t in tokens if t is not q and abs((t["box"][1] + t["box"][3]) / 2 - cy) < 0.5 * max(p, y1 - y0) and abs((t["box"][0] + t["box"][2]) / 2 - cx) < 30 * p]
    rh = [bool(HANGUL.search(t["text"])) and t["conf"] >= 0.5 for t in row]
    rc = [bool(CHORD.fullmatch(t["text"].replace(" ", ""))) for t in row]
    gap = min([abs(t["box"][0] - x1) for t in row] + [abs(x0 - t["box"][2]) for t in row], default=99 * p)
    t = q["text"]; s = t.replace(" ", "").replace("I", "/").replace("|", "/")
    # a hyphen sits between two syllables at their mid-height; a tenuto / ledger dash does not (LOG 61)
    hg = [u for u in row if HANGUL.search(u["text"])]
    lg = min([x0 - u["box"][2] for u in hg if u["box"][2] <= x0 + p], default=99 * p)
    rg = min([u["box"][0] - x1 for u in hg if u["box"][0] >= x1 - p], default=99 * p)
    dy = (cy - float(np.median([(u["box"][1] + u["box"][3]) / 2 for u in hg]))) / p if hg else 99.0
    # a second lyric verse right above the next staff: another row lies between it and the staff, a syllable above it
    rid = {id(u) for u in row}
    mid = [u for u in tokens if u is not q and id(u) not in rid and y1 < (u["box"][1] + u["box"][3]) / 2 < cy + below and abs((u["box"][0] + u["box"][2]) / 2 - cx) < 30 * p]
    up = any(HANGUL.search(u["text"]) and min(x1, u["box"][2]) - max(x0, u["box"][0]) > 0.5 * min(x1 - x0, u["box"][2] - u["box"][0])
             and 0 < cy - (u["box"][1] + u["box"][3]) / 2 < 3 * p for u in tokens if u is not q)
    return [(y1 - y0) / p, (x1 - x0) / p, (x1 - x0) / max(1, y1 - y0), min(above, 99 * p) / p, min(below, 99 * p) / p,
            any(s_[2] <= cy <= s_[3] for s_ in xs), (x0 - near_[0]) / p, (near_[1] - x1) / p, cy / H, len(row),
            float(np.mean(rh)) if rh else 0.0, float(np.mean(rc)) if rc else 0.0, gap / p,
            q["conf"], len(s), bool(HANGUL.search(t)), bool(CHORD.fullmatch(s)), bool(re.match(r"[(\[]?[A-G]", s)),
            bool(re.fullmatch(r"[0-9]+\.?", s)), bool(re.search(r"[A-Za-z]{2,}", t)), bool(re.fullmatch(r"[-~_=]+", s)),
            min(lg, 99 * p) / p, min(rg, 99 * p) / p, dy, len(mid), sum(bool(CHORD.fullmatch(u["text"].replace(" ", ""))) for u in mid), up,
            *[q["row"] == k for k in ("chord", "lyric", "other")], *[q["rule"] == k for k in LETTER]]


def run(path):
    stem = os.path.basename(path).rsplit(".", 1)[0]; r = STAFF[stem]
    img = load(path); f = PAR["W"] / img.shape[1]
    im = cv2.resize(img, None, fx=f, fy=f, interpolation=cv2.INTER_CUBIC if f > 1 else cv2.INTER_AREA)
    g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY); H, W = g.shape
    p, t = r["p"], r["thickness"] or 2; ink = g < r["ink_T"]
    cls = np.zeros((H, W), np.uint8); sid = np.full((H, W), -1, np.int16)
    staves = r["staves"]; h = t // 2 + 1
    # a staff stopping well short of its column with ink (notes) beyond: the lines faded out (streamofpraise, LOG 61), so it
    # runs on, flat, to where the column's other staves end
    staves = [dict(st) for st in staves]
    for st in staves:
        x0, x1, y0, y1 = st["box"]
        mates = [s["box"][1] for s in staves if s is not st and min(x1, s["box"][1]) - max(x0, s["box"][0]) > 0.5 * (x1 - x0) and s["box"][1] > x1]
        if len(mates) < 2: continue
        R = int(np.median(mates))
        if R - x1 < 4 * p or any(s is not st and s["box"][0] < R and x1 < s["box"][1] and s["box"][2] < y1 and y0 < s["box"][3] for s in staves): continue
        if ink[y0:y1, x1:R].any(0).mean() < 0.15: continue
        st["box"] = [x0, R, y0, y1]; st["lines"] = [*st["lines"], [R, st["lines"][-1][1]]]
        print(stem, "staff extended", x1, "->", R, flush=True)

    # staff lines: a short vertical ink run on a line is the line itself; a long one is a crossing stroke (stem, barline)
    rest = ink.copy(); body = np.full((H, W), -1, np.int16); sb = []
    for k, st in enumerate(staves):
        xs = [q[0] for q in st["lines"]]; Y = np.array([q[1] for q in st["lines"]], float)
        cx = np.arange(st["box"][0], min(W, st["box"][1] + 1))
        LY = np.round(np.stack([np.interp(cx, xs, Y[:, i]) for i in range(5)])).astype(int)
        for x, top, bot in zip(cx, LY[0] - h, LY[4] + h + 1): body[max(0, top):min(H, bot), x] = k
        for i in range(5):
            for x, y in zip(cx, LY[i]):
                a, b = max(0, y - h), min(H, y + h + 1)
                if not ink[a:b, x].any(): continue
                up, dn = a, b
                while up > 0 and ink[up - 1, x]: up -= 1
                while dn < H and ink[dn, x]: dn += 1
                if dn - up <= t + 3: rest[up:dn, x] = False; cls[up:dn, x][ink[up:dn, x]] = CLS["staff"]; sid[up:dn, x][ink[up:dn, x]] = k
        sb.append((st["box"][0], st["box"][1], st["box"][2], st["box"][3]))

    n, lab, stats, _ = cv2.connectedComponentsWithStats(rest.astype(np.uint8), connectivity=8)
    owner = {}                                                    # component -> (class, set)
    m = (lab > 0) & (body >= 0)
    pairs, cnt = np.unique(lab[m].astype(np.int64) * 64 + body[m], return_counts=True)
    best = {}
    for pr, c in zip(pairs, cnt):
        i, k = int(pr // 64), int(pr % 64)
        if c > best.get(i, (0, -1))[0]: best[i] = (c, k)
    for i, (_, k) in best.items(): owner[i] = ("staff", k)

    def box(i): x, y, w, hh = stats[i, :4]; return int(x), int(y), int(x + w), int(y + hh)
    def near(b, below):                                           # nearest staff above (below=False) / below the box centre, x-overlapping
        cy = (b[1] + b[3]) / 2                                    # by centre: a chord may touch the top line (palmer)
        c = [(k, s) for k, s in enumerate(sb) if s[0] - 2 * p < b[2] and b[0] < s[1] + 2 * p and ((s[2] > cy) if below else (s[3] < cy))]
        if not c: return None, 1e9
        k, s = min(c, key=lambda q: (q[1][2] - cy) if below else (cy - q[1][3]))
        return k, (max(0, s[2] - b[3]) if below else max(0, b[1] - s[3]))
    def vdist(b):
        ka, da = near(b, False); kb, db = near(b, True)
        inside = [k for k, s in enumerate(sb) if s[0] - 2 * p < b[2] and b[0] < s[1] + 2 * p and s[2] <= b[3] and b[1] <= s[3]]
        if inside: return inside[0], 0
        return (ka, da) if da <= db else (kb, db)

    free = [i for i in range(1, n) if i not in owner]
    # frames: hollow rectangles (ink along the box edges). Letter-sized (section label A/B) -> frame and contents ignored;
    # larger (Key up, Tag, a boxed chord group) -> frame ignored, contents keep only chords
    fr = PAR["frame"]; framed = set()
    for i in free:
        x0, y0, x1, y1 = box(i); w, hh = x1 - x0, y1 - y0
        if min(w, hh) < fr["min"] * p or stats[i, 4] >= fr["fill"] * w * hh: continue
        e = max(2, int(0.15 * min(w, hh))); sub = lab[y0:y1, x0:x1] == i
        if sub[e:-e, e:-e].sum() > (1 - fr["edge"]) * sub.sum(): continue
        # closed on all four sides: a volta bracket (open below) is not a frame (markers-plate 1./2.)
        if min(sub[:e].any(0).mean(), sub[-e:].any(0).mean(), sub[:, :e].any(1).mean(), sub[:, -e:].any(1).mean()) < 0.8: continue
        inner = [j for j in free if j != i and box(j)[0] > x0 and box(j)[2] < x1 and box(j)[1] > y0 and box(j)[3] < y1]
        owner[i] = ("ignore", -1)
        if max(w, hh) <= fr["small"] * p:
            for j in inner: owner[j] = ("ignore", -1)
        else: framed.update(inner)
    free = [i for i in free if i not in owner]
    voltas = []
    for i in free:
        x0, y0, x1, y1 = box(i); w, hh = x1 - x0, y1 - y0
        if w < 3 * p or hh < 0.5 * p or hh > 4 * p: continue   # 4p: a volta glued to its "1." (markers-plate, LOG 62)
        sub = lab[y0:y1, x0:x1] == i; e = max(2, int(0.2 * hh))
        if sub[:e].any(0).mean() >= 0.8 and sub[:, :e].any(1).mean() >= 0.6 and sub[-e:, e:-e].any(0).mean() < 0.2 and stats[i, 4] < 0.3 * w * hh:
            owner[i] = ("ignore", -1); voltas.append((x0, y0, x1, y1))
    def volta_near(b):                                            # inside a volta's hook corner (its "1." / "2.")
        return [v for v in voltas if v[0] - p <= b[0] and b[2] <= v[0] + 2.5 * p and v[1] - p <= b[1] and b[3] <= v[3] + p]
    free = [i for i in free if i not in owner]
    for i in free:                                                # dust
        if stats[i, 4] < PAR["dust"] * p * p: owner[i] = ("ignore", -1)
    # ties / slurs: wide, thin, hollow curves -> staff notation (LOG 18)
    tie = PAR["tie"]
    for i in free:
        if i in owner: continue
        x0, y0, x1, y1 = box(i); w, hh = x1 - x0, y1 - y0
        # an arc is thin in every column; a big lyric letter (ㄷ, ㄹ) has a full-height stroke (palmer)
        # and flat: the ㅅ of 수 is an arc too (agapao, GT run11)
        if w >= tie["w"] * p and tie["h"][0] * p <= hh <= min(tie["h"][1] * p, tie["flat"] * w) and stats[i, 4] < tie["fill"] * w * hh \
                and (lab[y0:y1, x0:x1] == i).sum(0).max() <= 0.5 * hh:
            k, d = vdist(box(i))
            owner[i] = ("staff", k) if k is not None and d <= PAR["mark_reach"] * p else ("ignore", -1)
    free = sorted((i for i in free if i not in owner), key=lambda i: stats[i, 1])

    # rows: components whose y ranges overlap (within row_gap x p); words: x gap < word_gap x p inside a row
    # a component joins the row whose core (median top..median bottom of its members) covers half of it, so a chord row
    # touching the lyric row above stays its own row (jrabbit, palmer)
    # core = 25th pct top .. 75th pct bottom: with the median, the many top-only pieces (틀, 느, hyphens) pulled the core up
    # and the bottom 받침 (ㅇ of 랑) formed a row of their own (GT run7). Rows stay inside one page column: on a 2-column
    # page the left chord row and the right lyric row share a y (yerum-conti)
    cols = []
    for s in sorted(sb):
        c_ = next((c_ for c_ in cols if min(c_[1], s[1]) - max(c_[0], s[0]) > 0.5 * (s[1] - s[0])), None)
        if c_: c_[0], c_[1] = min(c_[0], s[0]), max(c_[1], s[1])
        else: cols.append([s[0], s[1]])
    def col(b): cx = (b[0] + b[2]) / 2; return next((j for j, c_ in enumerate(cols) if c_[0] - 2 * p <= cx <= c_[1] + 2 * p), -1)
    rows = []
    for i in sorted(free, key=lambda i: stats[i, 1] + stats[i, 3] / 2):
        b = box(i); best = None; cb = col(b)
        for row in rows[-16:]:
            if row["col"] != cb: continue
            ov = min(b[3], row["c1"]) - max(b[1], row["c0"])
            if ov >= 0.5 * max(1, min(b[3] - b[1], row["c1"] - row["c0"])) and (best is None or ov > best[0]): best = (ov, row)
        if best:
            row = best[1]; row["ids"].append(i); row["t"].append(b[1]); row["b"].append(b[3])
            row["c0"], row["c1"] = float(np.percentile(row["t"], 25)), float(np.percentile(row["b"], 75))
        else: rows.append(dict(ids=[i], t=[b[1]], b=[b[3]], c0=b[1], c1=b[3], col=cb))
    for row in rows: row["y0"], row["y1"] = min(row["t"]), max(row["b"])
    rows.sort(key=lambda r_: r_["c0"]); last = {k: s[3] for k, s in enumerate(sb)}   # lyric chain: bottom of the staff / last lyric row
    tokens = []
    for row in rows:
        ids = sorted(row["ids"], key=lambda i: stats[i, 0]); words = []
        for i in ids:
            b = box(i)
            if words and b[0] - words[-1]["x1"] < PAR["word_gap"] * p: words[-1]["ids"].append(i); words[-1]["x1"] = max(words[-1]["x1"], b[2])
            else: words.append(dict(ids=[i], x0=b[0], x1=b[2]))
        for w in words:
            w["y0"] = min(box(i)[1] for i in w["ids"]); w["y1"] = max(box(i)[3] for i in w["ids"])
        pad = max(2, p // 4); y0, y1 = max(0, row["y0"] - pad), min(H, row["y1"] + pad)
        hl = [[max(0, w["x0"] - pad), min(W, w["x1"] + pad), y0, y1] for w in words]
        read = recognize(g, hl)
        for w, (text, conf) in zip(words, read):
            w["text"], w["conf"] = text, float(conf); w["kind"] = kind_of(text) if conf >= PAR["conf"] else "mark"
        for w in words: w["framed"] = all(i in framed for i in w["ids"])
        kinds = [w["kind"] for w in words]; rh = row["c1"] - row["c0"]
        nc, nl = kinds.count("chord"), kinds.count("lyric") + kinds.count("latin")
        nh = sum(w["kind"] == "lyric" and w["conf"] >= 0.5 for w in words)          # PP-OCRv5 reads real lyrics at 0.3-0.8 (LOG 57)
        rb = (min(w["x0"] for w in words), row["c0"], max(w["x1"] for w in words), row["c1"])
        kb_, db_ = near(rb, True); ka_, da_ = near(rb, False)
        # position: right above a staff and nearer to it than to the staff above = where a chord row sits; OCR often
        # reads lone A/D/E as Hangul or digits, so such a row is a chord row unless it is clearly Hangul (simhyeongjin)
        # but not with a letter-high row between it and the staff: that one is the chord row, this a second verse (susanghanstreet)
        chord_pos = kb_ is not None and db_ <= max(3 * p, 1.5 * rh) and db_ < da_ and not any(
            r_ is not row and r_["col"] == row["col"] and r_["c0"] >= row["c1"] and r_["c1"] <= sb[kb_][2] and len(r_["ids"]) >= 3
            and r_["c1"] - r_["c0"] >= 0.5 * rh for r_ in rows)
        row["kind"] = ("chord" if (nc and nc >= nl) or (chord_pos and nh < 0.5 * len(words)) else "lyric" if nl else "other")
        ch = [w["y1"] - w["y0"] for w in words if w["kind"] == "chord"]; ch = float(np.median(ch)) if ch else rh
        reach = max(PAR["chord_reach"] * p, 2 * rh)
        def lyric_ok(k):                                          # per staff: a 2-column page has two chains in one row
            return k is not None and row["c0"] - last[k] <= max((PAR["lyric_first"] if last[k] == sb[k][3] else PAR["lyric_reach"]) * p, 2 * rh)
        copy = any(COPY.search(w["text"]) for w in words) and sum(w["kind"] == "latin" for w in words) >= 2; pc = -1e9   # pc: right end of the last chord in the row
        for w in words:
            b = (w["x0"], w["y0"], w["x1"], w["y1"]); hw = w["y1"] - w["y0"]; t_ = w["text"].strip(); k_ = w["kind"]
            kb, db = near(b, True); ka, _ = near(b, False)
            notation = lambda: (lambda kd: ("staff", kd[0]) if kd[0] is not None and kd[1] <= PAR["mark_reach"] * p else ("ignore", -1))(vdist(b))
            if w["framed"] and k_ != "chord" or SECTION.search(t_) or any(volta_near(b)) or copy or hw > PAR["title"] * p and k_ != "chord": c = ("ignore", -1)   # staggered chords on a small-p page (yerum)
            elif row["kind"] == "chord":
                start = kb is not None and b[2] <= sb[kb][0] + PAR["start"] * p   # above the clef: measure number
                if start: c = ("ignore", -1)
                # tuplet: a 3 smaller than the chords, or a 3 read with its bracket ("3~", "37"); a B read as 3 is chord-high
                elif re.fullmatch(r"[-~—_(\[]*3[-~—_)\]7]*", t_) and (hw < 0.8 * ch or b[2] - b[0] >= 2.5 * hw): c = notation(); w["sure"] = True
                # a second verse set tight under the first (susanghanstreet): same-size glyph right under a syllable, often
                # garbled by OCR into a chord letter; a chord row keeps a gap from the lyric row above
                elif not (k_ == "chord" and w["conf"] >= 0.9) and any(HANGUL.search(u["text"]) and u["row"] == "lyric" and 0 <= b[1] - u["box"][3] < 0.5 * hw
                         and min(b[2], u["box"][2]) - max(b[0], u["box"][0]) >= 0.6 * min(b[2] - b[0], u["box"][2] - u["box"][0])
                         and abs((b[2] - b[0]) - (u["box"][2] - u["box"][0])) < 0.3 * (b[2] - b[0])
                         and abs(hw - (u["box"][3] - u["box"][1])) < 0.3 * hw for u in tokens):
                    c = ("lyric", ka) if lyric_ok(ka) else ("ignore", -1); w["sure"] = True
                    if c[0] == "lyric": w["kind"] = "lyric"; w["chain"] = ka
                elif (k_ == "chord" or k_ == "latin" or (k_ == "num" and t_ in ("0", "5", "6", "8", "9"))   # G read as 6, Cb as 0
                      or (k_ == "num" and (b[0] - pc <= 2 * p or hw >= 0.8 * ch))                         # the 7 of B7, B7 read as 37
                      or (k_ in ("mark", "other") and (re.match(r"[(\[]?[A-G]", t_) or hw >= 0.6 * ch))):
                    w["kind"] = "chord"; pc = b[2]; w["sure"] = k_ == "chord" and w["conf"] >= 0.9 and len(t_) >= 3   # bracketed chords read surely (markers_ju)
                    c = ("chord", kb) if kb is not None and db <= reach else ("ignore", -1)
                elif k_ in ("mark", "other", "dash", "num"): c = notation()                           # tuplet 3, rest read as 7
                else: c = ("ignore", -1)
            elif row["kind"] == "lyric":
                start = ka is not None and b[2] <= sb[ka][0] + 2.5 * p          # verse / measure numbers at the line start
                if start: c = ("ignore", -1)
                elif k_ in ("mark", "other") and ka is not None and b[1] - sb[ka][3] < 1.0 * p: c = notation()   # a note right under the staff (jrabbit)
                elif lyric_ok(ka):
                    w["kind"] = "lyric"; c = ("lyric", ka); w["chain"] = ka
                else: c = ("ignore", -1)
            elif k_ in ("mark", "other", "dash", "num"): c = notation()
            else: c = ("ignore", -1)
            for i in w["ids"]: owner[i] = c
            tokens.append(dict(text=w["text"], conf=round(w["conf"], 2), kind=w["kind"], row=row["kind"], rule=c[0], cls=c[0], set=c[1], sure=w.get("sure", False),
                               box=[int(v) for v in b], ids=[int(i) for i in w["ids"]]))
        for w in words:
            if "chain" in w: last[w["chain"]] = max(last[w["chain"]], row["y1"])
        row["x0"], row["x1"] = rb[0], rb[2]

    # learned call (LOG 59-60): a classifier trained on the GT train sheets re-decides every word from the rules' call,
    # its geometry against the staves, its OCR text and its row neighbours; the set follows the definition
    for q in tokens: q["x"] = features(p=p, sb=sb, q=q, tokens=tokens, H=H)
    if MODEL is not None and tokens:
        prob = MODEL.predict_proba(np.array([q["x"] for q in tokens], float))
        for q, pr in zip(tokens, prob):
            want = MODEL.classes_[pr.argmax()]
            if want == LETTER[q["rule"]] or pr.max() < PAR["learn_sure"] or q["sure"]: continue   # rules the train sheets rarely show
            b = q["box"]; kb, _ = near(b, True); ka, _ = near(b, False); kv, _ = vdist(b)
            c = {"C": ("chord", kb), "L": ("lyric", ka), "N": ("staff", kv), "X": ("ignore", -1)}[want]
            if c[1] is None: c = ("ignore", -1)
            for i in q["ids"]: owner[i] = c
            q["cls"], q["set"] = c
    # a short staff above every full one is a legend (markers_ju: the opening motif in a box): all of it ignored
    long_ = [s for s in sb if s[1] - s[0] >= 0.3 * max(s_[1] - s_[0] for s_ in sb)]
    mini = {k for k, s in enumerate(sb) if s[1] - s[0] < 0.3 * max(s_[1] - s_[0] for s_ in sb) and s[3] < min(s_[2] for s_ in long_)}
    for i, (c, k) in owner.items():
        if k in mini: owner[i] = ("ignore", -1)
    for q in tokens:
        if q["set"] in mini: q["cls"], q["set"] = "ignore", -1
    for k in mini: cls[sid == k] = CLS["ignore"]; sid[sid == k] = -1
    for row in rows:
        ks = [owner[i][1] for i in row["ids"] if owner.get(i, ("", -1))[0] == row["kind"]]
        row["set"] = max(set(ks), key=ks.count) if ks else None

    # glyphs glued to a staff component (a lyric touching a stem, a chord touching a slur): a piece of the component
    # inside a chord / lyric row core that is letter-shaped (wide, row-high, filled) and reads as that kind goes to the row
    glue = []
    for i, (c, k) in owner.items():
        if c != "staff": continue
        x0, y0, x1, y1 = box(i)
        for row in rows:
            if row["set"] is None or row["c1"] <= y0 or row["c0"] >= y1 or row["x1"] < x0 or row["x0"] > x1: continue
            a, b_ = int(max(y0, row["c0"])), int(min(y1, row["c1"])); rh = row["c1"] - row["c0"]
            if b_ - a < 2 or rh < 2: continue
            m_, pl, ps, _ = cv2.connectedComponentsWithStats((lab[a:b_, x0:x1] == i).astype(np.uint8), connectivity=8)
            for j in range(1, m_):
                px_, py_, pw, ph, pa = ps[j]
                if pw < 0.6 * p or ph < 0.5 * rh or pa < 0.2 * pw * ph: continue
                hl = [[max(0, x0 + px_ - p // 4), min(W, x0 + px_ + pw + p // 4), max(0, a - p // 4), min(H, b_ + p // 4)]]
                text, conf = recognize(g, hl)[0]
                kind = kind_of(text) if conf >= PAR["conf"] else "mark"
                if kind == row["kind"]: glue.append((a, x0, pl == j, row["kind"], row["set"], text))

    # paint ownership
    lut_c = np.zeros(n, np.uint8); lut_s = np.full(n, -1, np.int16)
    for i, (c, k) in owner.items(): lut_c[i] = CLS[c]; lut_s[i] = k
    cm = lab > 0; cls[cm] = lut_c[lab[cm]]; sid[cm] = lut_s[lab[cm]]
    for a, x0, mk, kind, k, _ in glue:
        h_, w_ = mk.shape; cls[a:a + h_, x0:x0 + w_][mk] = CLS[kind]; sid[a:a + h_, x0:x0 + w_][mk] = k
    label = np.where(cls == 0, 0, np.where(sid >= 0, cls.astype(np.int16) * 40 + sid + 1, cls.astype(np.int16) * 40)).astype(np.uint8)
    cv2.imwrite(f"{OUT}/label/{stem}.png", label)               # value = class x 40 + set + 1 (ignore = 160)

    # sets: flexible outline = contour of the region's pixels closed by p/2
    ker = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (max(3, p // 2) | 1,) * 2); sets = []
    vis = (im * 0.25 + 191).astype(np.uint8); col = {1: (200, 90, 0), 2: (0, 150, 0), 3: (0, 120, 230), 4: (150, 150, 150)}
    for c, bgr in col.items(): vis[cls == c] = bgr
    for k in range(len(staves)):
        rec = dict(staff_box=list(sb[k]))
        for name in ("chord", "staff", "lyric"):
            mk = ((cls == CLS[name]) & (sid == k)).astype(np.uint8)
            if not mk.any(): rec[name] = None; continue
            cont, _ = cv2.findContours(cv2.dilate(mk, ker), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            ys, xs = np.nonzero(mk)
            rec[name] = dict(px=int(mk.sum()), box=[int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())],
                             outline=[c_.reshape(-1, 2).tolist() for c_ in cont])
            cv2.polylines(vis, cont, True, col[CLS[name]], 2)
        rec["chords"] = [q["text"] for q in tokens if q["cls"] == "chord" and q["set"] == k]
        rec["lyrics"] = [q["text"] for q in tokens if q["cls"] == "lyric" and q["set"] == k]
        sets.append(rec)
    vis = cv2.resize(vis, (1240, round(H * 1240 / W)), interpolation=cv2.INTER_AREA)
    cv2.imwrite(f"{OUT}/vis/{stem}.jpg", vis, [cv2.IMWRITE_JPEG_QUALITY, 85])
    # ground-truth sheets: full-resolution page tiles with numbered boxes, no prediction drawn (blind labels);
    # words + staff components reaching > 1p out of the staff over >= p columns (a lyric / chord glyph glued to a stem)
    items = [dict(id=j, kind="w", box=q["box"], cls=q["cls"], set=q["set"]) for j, q in enumerate(tokens)]
    for i, (c, k) in sorted(owner.items()):
        if c != "staff" or k is None or k < 0: continue
        x0, y0, x1, y1 = box(i); s = sb[k]; yy = np.arange(y0, y1)
        out_ = (lab[y0:y1, x0:x1] == i)[(yy < s[2] - p) | (yy > s[3] + p)]
        if out_.size and out_.any(0).sum() >= p: items.append(dict(id=len(items), kind="s", box=[x0, y0, x1, y1], cls="staff", set=k))
    TH, M, tiles = 700, 120, {}
    for ty in range(0, H, TH):
        for tx in (0, W // 2):
            name = f"{stem}__{ty // TH}_{tx // (W // 2)}"; core = [tx, ty, tx + W // 2, min(H, ty + TH)]
            mine = [q for q in items if core[0] <= (q["box"][0] + q["box"][2]) / 2 < core[2] and core[1] <= (q["box"][1] + q["box"][3]) / 2 < core[3]]
            if not mine: continue
            X0, Y0, X1, Y1 = max(0, core[0] - M), max(0, core[1] - M), min(W, core[2] + M), min(H, core[3] + M)
            crop = im[Y0:Y1, X0:X1].copy()
            cv2.rectangle(crop, (core[0] - X0, core[1] - Y0), (core[2] - X0 - 1, core[3] - Y0 - 1), (190, 190, 190), 1)
            for q in mine:
                q["tile"] = name; b = q["box"]; bgr = (0, 0, 255) if q["kind"] == "w" else (255, 0, 0)
                cv2.rectangle(crop, (b[0] - X0 - 2, b[1] - Y0 - 2), (b[2] - X0 + 2, b[3] - Y0 + 2), bgr, 1)
                cv2.putText(crop, ("s" if q["kind"] == "s" else "") + str(q["id"]), (b[0] - X0, max(12, b[1] - Y0 - 4)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.55, bgr, 1, cv2.LINE_AA)
            if stem not in GT: cv2.imwrite(f"{OUT}/gt/{name}.jpg", crop, [cv2.IMWRITE_JPEG_QUALITY, 90])
            tiles[name] = core
    # score against the blind labels (sets-gt.json): a word box passes when the majority class of its non-staff-line ink is
    # the label, in the set the definition gives (chord -> staff below, lyric -> staff above); an s-box labelled L / C
    # (a glyph glued to a stem) passes when that class owns some of its ink
    fails, total = [], 0
    for kind, x0, y0, x1, y1, want in (GT.get(stem, []) if stem in TEST else []):
        sub = rest[y0:y1, x0:x1]; c_ = cls[y0:y1, x0:x1][sub]; s_ = sid[y0:y1, x0:x1][sub]
        if not c_.size or kind == "s" and want not in "LC": continue
        total += 1; cw = CLS[GTCLS[want]]
        if kind == "s":
            ok = (c_ == cw).sum() >= PAR["dust"] * p * p; got = int(np.bincount(c_, minlength=5).argmax())
        else:
            got = int(np.bincount(c_, minlength=5).argmax()); ok = got == cw
            if ok and want in "LC":
                k_ = near((x0, y0, x1, y1), want == "C")[0]; ok = int(np.bincount(s_[c_ == cw] + 1).argmax()) - 1 == k_
        if not ok: fails.append(dict(kind=kind, box=[x0, y0, x1, y1], want=want, got=[k for k, v in CLS.items() if v == got] or ["none"]))
    px = {c: int((cls == v).sum()) for c, v in CLS.items()}
    print(stem, "sets", len(sets), "rows", [r_["kind"][0] for r_ in rows], "px", px, "gt items", len(items), "tiles", len(tiles), "glue", [(q[3][0], q[5]) for q in glue], flush=True)
    if stem in GT and stem in TEST: print(stem, "score", total - len(fails), "/", total, flush=True)
    return dict(p=p, sets=sets, tokens=tokens, rows=[dict(kind=r_["kind"], y=[int(r_["y0"]), int(r_["y1"])]) for r_ in rows], px=px,
                gt=dict(tiles=tiles, items=items), score=dict(total=total, fails=fails))


paths = sorted(q for q in glob.glob("/kaggle/input/**/*", recursive=True) if q.lower().endswith((".png", ".jpg", ".jpeg", ".gif")) and "/out/" not in q)
todo = [q for q in paths if os.path.basename(q).rsplit(".", 1)[0] in STAFF and (ONLY is None or os.path.basename(q).rsplit(".", 1)[0] in ONLY)]
t0 = time.time(); MODEL = None
# train: the rules alone on the GT train sheets, then fit on their words (the test sheets are never seen)
train = [q for q in todo if os.path.basename(q).rsplit(".", 1)[0] in TRAIN and os.path.basename(q).rsplit(".", 1)[0] in GT]
X, y = [], []
for i, q in enumerate(train, 1):
    stem = os.path.basename(q).rsplit(".", 1)[0]; tk = {tuple(t["box"]): t for t in run(q)["tokens"]}
    for kind, x0, y0, x1, y1, want in GT[stem]:
        if kind == "w" and (x0, y0, x1, y1) in tk: X.append(tk[(x0, y0, x1, y1)]["x"]); y.append(want)
    print(f"progress {i}/{len(train)} {time.time() - t0:.0f}s train", flush=True)
if X:
    MODEL = HistGradientBoostingClassifier(max_iter=300, learning_rate=0.08, random_state=0).fit(np.array(X, float), y)
    print("selftest model trained on", len(y), "words from", len(train), "sheets", flush=True)
res = {}; t0 = time.time()
for i, q in enumerate(todo, 1):
    stem = os.path.basename(q).rsplit(".", 1)[0]
    try:
        res[stem] = run(q)
        for t in res[stem]["tokens"]: t.pop("x"); t.pop("ids")
    except Exception as e:
        import traceback; res[stem] = {"error": repr(e), "tb": traceback.format_exc()}; print(stem, "ERROR", e, flush=True)
    print(f"progress {i}/{len(todo)} {time.time() - t0:.0f}s", flush=True)    # _server/kaggle.py --watch
sc = [v["score"] for v in res.values() if "score" in v]; fails = [f for q in sc for f in q["fails"]]
kinds = {}
for f_ in fails: kinds[f"{f_['want']}>{f_['got'][0]}"] = kinds.get(f"{f_['want']}>{f_['got'][0]}", 0) + 1
print("selftest score", sum(q["total"] for q in sc) - len(fails), "/", sum(q["total"] for q in sc), sorted(kinds.items(), key=lambda q: -q[1]), flush=True)
json.dump(dict(params=PAR, sheets=res), open(f"{OUT}/sets.json", "w"), indent=1, ensure_ascii=False)

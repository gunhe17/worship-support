"""Audio → key (전조 포함). librosa + numpy, 선택: demucs(MIT). 비상업 라이선스 모델 없음.

  python key.py <audio> [--stems] [-o out.json]   # 한 곡
  python key.py --selftest                       # 합성 곡(G → Ab)으로 확인
  python key.py                                  # Kaggle: selftest + 찬양 wav(방법 3개, stems) + GTZAN·GiantSteps 채점

비교 방법: pipe(이 파일), ess·lib(사용자 detect_musical_key.py: 15초 창 5초 간격 + 전역 사전확률 Viterbi).
ess는 Essentia(AGPL)라 연구 비교용으로만 쓴다.

절차 (lab/audio-to-key/survey.md 2.10):
 1. 입력: 원곡 믹스, 또는 Demucs로 bass+other만 (--stems)
 2. 튜닝 추정 → beat(믹스에서) → beat 단위 CQT 크로마 (median)
 3. 16 beat 창, 4 beat 간격으로 24개 key 템플릿(Krumhansl–Kessler)과 상관계수
 4. Viterbi (자기 전이 STAY, 같은 조성 ±1/±2 반음 이동에 가산점) → key 경로
 5. 짧은 구간(< MIN_SEG beat)은 더 잘 맞는 이웃에 합침
 6. 구간 사이 변화 분류: up/down(전조 후보), relative, fifth, mode, other
    전조 = 같은 장단조, ±1/±2 반음, 두 구간 strength ≥ STRONG
출력: {key, changes[], segments[{start, end, key, strength, runner_up}]}
"""
import argparse, glob, json, os, subprocess, sys
import numpy as np, librosa

SR = 22050
NAMES = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]
MAJ = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
MIN = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
WIN, HOP = 16, 4   # beat
MIN_SEG = 32       # beat (4/4 기준 8마디)
STAY = 0.99        # Viterbi 자기 전이 확률
STEP_BONUS = 3     # 같은 조성 ±1/±2 반음 이동 가중
BETA = 20          # 상관계수 → 방출 확률 날카로움
STRONG = 0.5       # 전조로 인정할 최소 strength (구간 평균 상관계수)


def key_name(k):
    return f"{NAMES[k % 12]} {'major' if k < 12 else 'minor'}"


def templates():  # 24 x 12, k<12: 장조 으뜸음 k, k>=12: 단조 으뜸음 k-12
    T = np.array([np.roll(p, k) for p in (MAJ, MIN) for k in range(12)])
    return (T - T.mean(1, keepdims=True)) / T.std(1, keepdims=True)


def load(path, stems, device):
    mix, _ = librosa.load(path, sr=SR, mono=True)
    if not stems:
        return mix, mix
    from demucs.api import Separator
    sep = Separator(model="htdemucs", device=device)
    _, s = sep.separate_audio_file(path)
    harm = (s["bass"] + s["other"]).mean(0).cpu().numpy()
    return mix, librosa.resample(harm, orig_sr=sep.samplerate, target_sr=SR)


def beat_chroma(mix, harm):
    tuning = float(librosa.estimate_tuning(y=harm, sr=SR))
    _, beats = librosa.beat.beat_track(y=mix, sr=SR)
    C = librosa.feature.chroma_cqt(y=harm, sr=SR, tuning=tuning)
    Cb = librosa.util.sync(C, beats, aggregate=np.median)
    times = librosa.frames_to_time(np.r_[0, beats], sr=SR)
    return Cb, times, tuning


def window_scores(Cb):
    T = templates()
    starts = np.arange(0, max(1, Cb.shape[1] - WIN + 1), HOP)
    S = []
    for s in starts:
        v = Cb[:, s:s + WIN].mean(1)
        S.append(T @ ((v - v.mean()) / (v.std() + 1e-9)) / 12)  # Pearson r
    return np.array(S), starts


def viterbi(S):
    n, K = S.shape
    E = BETA * S
    E -= np.logaddexp.reduce(E, axis=1, keepdims=True)
    A = np.ones((K, K))
    for i in range(K):
        for j in range(K):
            if i // 12 == j // 12 and (j - i) % 12 in (1, 2, 10, 11):
                A[i, j] = STEP_BONUS
    np.fill_diagonal(A, 0)
    A *= (1 - STAY) / A.sum(1, keepdims=True)
    np.fill_diagonal(A, STAY)
    logA = np.log(A)
    D, back = E[0].copy(), np.zeros((n, K), int)
    for t in range(1, n):
        M = D[:, None] + logA
        back[t] = M.argmax(0)
        D = M.max(0) + E[t]
    path = [int(D.argmax())]
    for t in range(n - 1, 0, -1):
        path.append(int(back[t, path[-1]]))
    return path[::-1]


def squash(runs):
    out = []
    for r in runs:
        if out and out[-1][2] == r[2]:
            out[-1][1] = r[1]
        else:
            out.append(list(r))
    return out


def runs_of(path, S):
    runs = squash([[t, t + 1, k] for t, k in enumerate(path)])
    while len(runs) > 1:
        i = min(range(len(runs)), key=lambda i: runs[i][1] - runs[i][0])
        if (runs[i][1] - runs[i][0]) * HOP >= MIN_SEG:
            break
        j = max((j for j in (i - 1, i + 1) if 0 <= j < len(runs)),
                key=lambda j: S[runs[i][0]:runs[i][1], runs[j][2]].mean())
        runs[i][2] = runs[j][2]
        runs = squash(runs)
    return runs


def change_type(a, b):
    d = (b % 12 - a % 12) % 12
    if a // 12 == b // 12:
        if d in (1, 2):
            return f"up +{d}", True
        if d in (10, 11):
            return f"down -{12 - d}", True
        return ("fifth" if d in (5, 7) else "other"), False
    rel = (a < 12 and d == 9) or (a >= 12 and d == 3)
    return ("relative" if rel else "mode"), False


def analyze(mix, harm):
    Cb, times, tuning = beat_chroma(mix, harm)
    S, starts = window_scores(Cb)
    runs = runs_of(viterbi(S), S)
    dur = len(mix) / SR

    def t_at(w):  # 창 w가 시작되는 경계의 시각 (앞뒤 창 중심 사이)
        return 0.0 if w == 0 else float(times[min(starts[w] + (WIN - HOP) // 2, len(times) - 1)])

    segs = []
    for t0, t1, k in runs:
        m = S[t0:t1].mean(0)
        alt = max((j for j in range(24) if j != k), key=lambda j: m[j])
        segs.append({"start": round(t_at(t0), 1), "end": round(t_at(t1) if t1 < len(S) else dur, 1),
                     "key": key_name(k), "k": k, "strength": round(float(m[k]), 3),
                     "runner_up": key_name(alt), "runner_up_strength": round(float(m[alt]), 3)})
    changes = []
    for a, b in zip(segs, segs[1:]):
        typ, step = change_type(a["k"], b["k"])
        changes.append({"at": b["start"], "from": a["key"], "to": b["key"], "type": typ,
                        "modulation": step and min(a["strength"], b["strength"]) >= STRONG})
    cover = {}
    for s in segs:
        cover[s["key"]] = cover.get(s["key"], 0) + s["end"] - s["start"]
    for s in segs:
        s.pop("k")
    return {"key": max(cover, key=cover.get), "changes": changes, "segments": segs,
            "tuning": round(tuning, 3), "n_beats": int(Cb.shape[1]),
            "bpm_est": round(60 / float(np.median(np.diff(times[1:]))), 1) if len(times) > 2 else None}


def synth():  # 72 BPM, I–V–vi–IV, G major 12마디(40초) → Ab major 6마디(20초), 킥 매 박
    bar = 4 * 60 / 72
    t = np.arange(int(bar * SR)) / SR
    hz = lambda m: 440 * 2 ** ((m - 69) / 12)
    kick = np.zeros_like(t)
    for b in range(4):
        tb = t - b * bar / 4
        kick += np.where(tb >= 0, np.sin(2 * np.pi * 60 * tb) * np.exp(-tb * 30), 0)
    out = []
    for tonic, nbars in ((7, 12), (8, 6)):
        for b in range(nbars):
            root, q = [(0, (0, 4, 7)), (7, (0, 4, 7)), (9, (0, 3, 7)), (5, (0, 4, 7))][b % 4]
            r = (tonic + root) % 12
            notes = [60 + r + i for i in q] + [36 + r]
            x = sum(np.sin(2 * np.pi * hz(m) * h * t) / h for m in notes for h in (1, 2, 3, 4))
            out.append(0.1 * x / len(notes) + 0.5 * kick)
    return np.concatenate(out).astype(np.float32)


def selftest():
    assert parse_key("Ab major") == parse_key("G# major") == 8 and parse_key("F minor") == 17
    assert [score(parse_key(e), parse_key("E major"))[0] for e in ("E major", "B major", "C# minor", "E minor")] \
        == ["correct", "fifth_up", "relative", "parallel"]
    assert score(parse_key("Ab major"), parse_key("F minor"))[0] == "relative"
    y = synth()
    r = analyze(y, y)
    print(json.dumps(r, ensure_ascii=False))
    keys = [s["key"] for s in r["segments"]]
    assert keys[0] == "G major" and keys[-1] == "Ab major", keys
    mods = [c for c in r["changes"] if c["modulation"]]
    assert len(mods) == 1 and mods[0]["type"] == "up +1" and abs(mods[0]["at"] - 40) < 8, r["changes"]
    print("SELFTEST OK")
    return r


# ---- baseline: 사용자 detect_musical_key.py (함수만 옮김, yt-dlp 제외) ----
BL_SR = 44100
PITCH = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def parse_key(s):  # "G# minor", "Ab major", "Eb minor" → 0..23 (장조 0..11, 단조 12..23), 실패 시 None
    p = s.strip().replace("\u266f", "#").replace("\u266d", "b").split()
    if len(p) < 2 or p[1].lower() not in ("major", "minor"):
        return None
    n = p[0][0].upper() + p[0][1:]
    flat = {"Db": "C#", "Eb": "D#", "Gb": "F#", "Ab": "G#", "Bb": "A#", "Cb": "B", "Fb": "E", "E#": "F", "B#": "C"}
    n = flat.get(n, n)
    if n not in PITCH:
        return None
    return PITCH.index(n) + (12 if p[1].lower() == "minor" else 0)


def bl_essentia(seg, sr):
    import essentia.standard as es
    return es.KeyExtractor()(seg.astype(np.float32))


def bl_librosa(seg, sr):
    chroma = librosa.feature.chroma_cqt(y=seg, sr=sr).mean(axis=1)
    if chroma.sum() > 0: chroma /= chroma.sum()
    bk, bs, bc = "C", "major", -2.0
    for i in range(12):
        for prof, name in [(MAJ, "major"), (MIN, "minor")]:
            c = np.corrcoef(chroma, np.roll(prof, i))[0, 1]
            if c > bc: bc, bk, bs = c, PITCH[i], name
    return bk, bs, max(0.0, min(1.0, bc))


def bl_analyze(audio, sr, key_fn, win_sec=15, hop_sec=5, switch_penalty=6.0, prior_weight=2.0):
    win, hop = int(sr * win_sec), int(sr * hop_sec)
    raw = []
    for start in range(0, max(1, len(audio) - win + 1), hop):
        k, s, st = key_fn(audio[start:start + win].copy(), sr)
        raw.append((start / sr, f"{k} {s}", st))
    states = sorted({k for _, k, _ in raw}); S = len(states)
    idx = {k: i for i, k in enumerate(states)}
    support = np.zeros(S)
    for _, k, st in raw: support[idx[k]] += st
    prior = np.log(support / support.sum() + 1e-6) * prior_weight

    def emit(rep, st):
        p = np.full(S, (1.0 - st) / max(S - 1, 1)); p[idx[rep]] = st
        return np.log(p + 1e-9) + prior

    T = len(raw); dp = np.full((T, S), -1e18); bp = np.zeros((T, S), dtype=int)
    dp[0] = emit(raw[0][1], raw[0][2])
    for t in range(1, T):
        e = emit(raw[t][1], raw[t][2])
        for s in range(S):
            tr = dp[t - 1] - switch_penalty; tr[s] = dp[t - 1][s]
            b = int(np.argmax(tr)); dp[t][s] = tr[b] + e[s]; bp[t][s] = b
    path = [int(np.argmax(dp[-1]))]
    for t in range(T - 1, 0, -1): path.append(bp[t][path[-1]])
    smooth = [states[i] for i in path[::-1]]
    dur = len(audio) / sr
    segs = []
    for t, (sec, _, _) in enumerate(raw):
        if not segs or segs[-1]["key"] != smooth[t]:
            if segs: segs[-1]["end"] = round(sec, 1)
            segs.append({"start": round(sec, 1), "end": round(dur, 1), "key": smooth[t]})
    return {"segments": segs, "raw": [(round(a, 1), k, round(float(st), 3)) for a, k, st in raw]}


def run_method(path, method, stems=False, device="cpu"):
    """→ {segments[{start,end,key}], ...}. 곡 key 정의는 미정(README 결정 1)이라 채점용으로만 longest를 붙인다."""
    if method == "pipe":
        r = analyze(*load(path, stems, device))
    else:
        y, _ = librosa.load(path, sr=BL_SR, mono=True)
        r = bl_analyze(y, BL_SR, bl_essentia if method == "ess" else bl_librosa)
    cover = {}
    for s in r["segments"]:
        cover[s["key"]] = cover.get(s["key"], 0) + s["end"] - s["start"]
    r["longest"] = max(cover, key=cover.get)
    return r


# ---- 채점 (MIREX 가중 점수, 관계조 허용 정확도) ----
def score(est, ref):  # est, ref: 0..23 → (범주, MIREX 점수)
    if est is None:
        return "none", 0.0
    if est == ref:
        return "correct", 1.0
    em, rm, et, rt = est // 12, ref // 12, est % 12, ref % 12
    if em == rm and (et - rt) % 12 == 7:
        return "fifth_up", 0.5
    if em == rm and (et - rt) % 12 == 5:
        return "fifth_down", 0.0
    if em != rm and (et - rt) % 12 == (9 if rm == 0 else 3):
        return "relative", 0.3
    if em != rm and et == rt:
        return "parallel", 0.2
    return "other", 0.0


def summarize(rows, methods):
    out = {}
    for m in methods:
        cats = [r[m]["cat"] for r in rows if m in r]
        n = len(cats)
        if not n:
            continue
        cnt = {c: cats.count(c) for c in sorted(set(cats))}
        out[m] = {"n": n, "acc": round(cnt.get("correct", 0) / n, 3),
                  "acc_rel": round((cnt.get("correct", 0) + cnt.get("relative", 0)) / n, 3),
                  "mirex": round(sum(r[m]["mirex"] for r in rows if m in r) / n, 3), "cats": cnt}
    return out


def _eval_one(item):
    path, ref, meta, methods = item
    row = {"file": os.path.basename(path), "ref": key_name(ref), **meta}
    for m in methods:
        try:
            r = run_method(path, m)
            est = parse_key(r["longest"])
            cat, pts = score(est, ref)
            row[m] = {"est": r["longest"], "cat": cat, "mirex": pts, "n_seg": len(r["segments"])}
        except Exception as e:
            row[m] = {"est": None, "cat": "error", "mirex": 0.0, "err": str(e)[:200]}
    return row


def eval_set(name, items, methods, out):
    from multiprocessing import Pool
    with Pool(os.cpu_count()) as pool:
        rows = []
        for i, row in enumerate(pool.imap_unordered(_eval_one, [(*it, methods) for it in items], chunksize=4)):
            rows.append(row)
            if i % 50 == 0:
                print(name, i, len(items), flush=True)
    summ = {"all": summarize(rows, methods)}
    for g in sorted({r.get("genre") for r in rows} - {None}):
        summ[g] = summarize([r for r in rows if r.get("genre") == g], methods)
    json.dump(rows, open(f"{out}/{name}_rows.json", "w"), ensure_ascii=False, indent=1)
    json.dump(summ, open(f"{out}/{name}_summary.json", "w"), ensure_ascii=False, indent=1)
    print(name, json.dumps(summ["all"], ensure_ascii=False), flush=True)


def gtzan_items():  # 오디오: Kaggle GTZAN, 정답: github alexanderlerch/gtzan_key (A=0 기준, -1 = 전조/불명)
    wavs = sorted(glob.glob("/kaggle/input/**/genres_original/*/*.wav", recursive=True))
    if not wavs:
        return []
    gt = "/kaggle/working/gtzan_key"
    subprocess.run(f"git clone -q --depth 1 https://github.com/alexanderlerch/gtzan_key {gt}", shell=True)
    items = []
    for w in wavs:
        genre, base = w.split("/")[-2], os.path.basename(w)[:-4]
        f = f"{gt}/gtzan_key/genres/{genre}/{base}.lerch.txt"
        if not os.path.exists(f):
            continue
        n = int(open(f).read().split()[0])
        if n < 0:
            continue
        items.append((w, (n % 12 + 9) % 12 + (12 if n >= 12 else 0), {"genre": genre}))
    return items


def giantsteps_items():
    items = []
    for f in sorted(glob.glob("/kaggle/input/**/giantsteps-key-dataset/annotations/key/*.key", recursive=True)):
        base = os.path.basename(f)[:-4]
        mp3 = glob.glob(f"{os.path.dirname(os.path.dirname(os.path.dirname(f)))}/audio/{base}.mp3")
        ref = parse_key(open(f).read())
        if mp3 and ref is not None:
            items.append((mp3[0], ref, {}))
    return items


def kaggle():
    out = "/kaggle/working/out"
    os.makedirs(out, exist_ok=True)
    subprocess.run(f"{sys.executable} -m pip install -q demucs essentia", shell=True)
    import torch
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print("device", device, os.cpu_count(), "cpu", flush=True)
    try:
        json.dump(selftest(), open(f"{out}/selftest.json", "w"), ensure_ascii=False, indent=1)
    except AssertionError as e:
        print("SELFTEST FAIL", e, flush=True)
    for wav in sorted(w for w in glob.glob("/kaggle/input/**/*.wav", recursive=True) if "genres_original" not in w):
        name = os.path.basename(wav)[:-4]
        for m, stems in (("pipe", False), ("pipe", True), ("ess", False), ("lib", False)):
            tag = m + (".stems" if stems else "")
            r = {"file": name, "method": tag, **run_method(wav, m, stems, device)}
            json.dump(r, open(f"{out}/{name}.{tag}.json", "w"), ensure_ascii=False, indent=1)
            print(name, tag, [(s["start"], s["key"]) for s in r["segments"]], flush=True)
    methods = ["pipe", "ess", "lib"]
    for name, items in (("gtzan", gtzan_items()), ("giantsteps", giantsteps_items())):
        print(name, len(items), "items", flush=True)
        if items:
            eval_set(name, items, methods, out)

if __name__ == "__main__":
    if len(sys.argv) == 1 and os.path.isdir("/kaggle/input"):
        kaggle()
    else:
        ap = argparse.ArgumentParser()
        ap.add_argument("audio", nargs="?")
        ap.add_argument("--stems", action="store_true")
        ap.add_argument("--device", default="cuda")
        ap.add_argument("--selftest", action="store_true")
        ap.add_argument("-o")
        a = ap.parse_args()
        if a.selftest:
            selftest()
        else:
            r = analyze(*load(a.audio, a.stems, a.device))
            s = json.dumps(r, ensure_ascii=False, indent=1)
            open(a.o, "w").write(s) if a.o else print(s)

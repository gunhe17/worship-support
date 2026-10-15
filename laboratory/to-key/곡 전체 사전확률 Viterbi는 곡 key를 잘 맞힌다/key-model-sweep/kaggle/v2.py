"""key 모델 일괄 시험 (Kaggle 한 번 실행). build.py가 key-pipeline/kaggle/key.py 사본을 KEY_SRC로 넣어 kaggle/sweep.py를 만든다.

입력: 합성 곡 30곡(정답 확실) + 정답 있는 찬양 3곡 + 찬양 500곡(정답 없음)
1단계(GPU): 곡마다 Demucs htdemucs → bass+other(harm) → /kaggle/temp/harm/<id>.npy
2단계(CPU 4프로세스): 곡마다 모든 방법 실행 + 특징 저장
  pipe_mix / pipe_stem   key-pipeline analyze (템플릿 + Viterbi + 전조 규칙)
  bl_ess / bl_lib        사용자 detect_musical_key.py (15초/5초 창 + 전역 사전확률 Viterbi)
  ess_<profile>_<in>     Essentia HPCP(한 번) → es.Key 프로파일 16종, 믹스·stem (KeyExtractor 근사)
  esswin_<profile>       Essentia 창별(15초/5초) key, temperley·bgate·edma (믹스)
  cnn_<in>               madmom CNN key, 곡 전체 (믹스·stem) + 창별 확률(30초/10초, 믹스)
  chord_key              madmom CNN+CRF 코드 인식 → 코드 길이 가중 key (코드열도 저장)
  tpl_<profile>_<in>     librosa beat 크로마 평균 × 템플릿 3종(KK, Temperley, Albrecht–Shanahan)
특징: out/feat/<id>.npz (beat 크로마 믹스·stem, beat 시각, HPCP 2fps, 템플릿 창 점수, CNN 창 확률)
집계: out/summary.json (합성·3곡 정답 채점, 전조 검출, 500곡 방법 간 일치도, key up 후보)
라이선스: Essentia(AGPL)·madmom 모델(비상업)은 연구 비교용. 서비스 후보는 pipe·tpl(librosa/numpy).
"""
import glob, json, os, subprocess, sys, time, types, traceback
import numpy as np

KEY_SRC = '"""Audio → key (전조 포함). librosa + numpy, 선택: demucs(MIT). 비상업 라이선스 모델 없음.\n\n  python key.py <audio> [--stems] [-o out.json]   # 한 곡\n  python key.py --selftest                       # 합성 곡(G → Ab)으로 확인\n  python key.py                                  # Kaggle: selftest + 찬양 wav(방법 3개, stems) + GTZAN·GiantSteps 채점\n\n비교 방법: pipe(이 파일), ess·lib(사용자 detect_musical_key.py: 15초 창 5초 간격 + 전역 사전확률 Viterbi).\ness는 Essentia(AGPL)라 연구 비교용으로만 쓴다.\n\n절차 (lab/to-key/survey.md 2.10):\n 1. 입력: 원곡 믹스, 또는 Demucs로 bass+other만 (--stems)\n 2. 튜닝 추정 → beat(믹스에서) → beat 단위 CQT 크로마 (median)\n 3. 16 beat 창, 4 beat 간격으로 24개 key 템플릿(Krumhansl–Kessler)과 상관계수\n 4. Viterbi (자기 전이 STAY, 같은 조성 ±1/±2 반음 이동에 가산점) → key 경로\n 5. 짧은 구간(< MIN_SEG beat)은 더 잘 맞는 이웃에 합침\n 6. 구간 사이 변화 분류: up/down(전조 후보), relative, fifth, mode, other\n    전조 = 같은 장단조, ±1/±2 반음, 두 구간 strength ≥ STRONG\n출력: {key, changes[], segments[{start, end, key, strength, runner_up}]}\n"""\nimport argparse, glob, json, os, subprocess, sys\nimport numpy as np, librosa\n\nSR = 22050\nNAMES = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]\nMAJ = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])\nMIN = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])\nWIN, HOP = 16, 4   # beat\nMIN_SEG = 32       # beat (4/4 기준 8마디)\nSTAY = 0.99        # Viterbi 자기 전이 확률\nSTEP_BONUS = 3     # 같은 조성 ±1/±2 반음 이동 가중\nBETA = 20          # 상관계수 → 방출 확률 날카로움\nSTRONG = 0.5       # 전조로 인정할 최소 strength (구간 평균 상관계수)\n\n\ndef key_name(k):\n    return f"{NAMES[k % 12]} {\'major\' if k < 12 else \'minor\'}"\n\n\ndef templates():  # 24 x 12, k<12: 장조 으뜸음 k, k>=12: 단조 으뜸음 k-12\n    T = np.array([np.roll(p, k) for p in (MAJ, MIN) for k in range(12)])\n    return (T - T.mean(1, keepdims=True)) / T.std(1, keepdims=True)\n\n\ndef load(path, stems, device):\n    mix, _ = librosa.load(path, sr=SR, mono=True)\n    if not stems:\n        return mix, mix\n    from demucs.api import Separator\n    sep = Separator(model="htdemucs", device=device)\n    _, s = sep.separate_audio_file(path)\n    harm = (s["bass"] + s["other"]).mean(0).cpu().numpy()\n    return mix, librosa.resample(harm, orig_sr=sep.samplerate, target_sr=SR)\n\n\ndef beat_chroma(mix, harm):\n    tuning = float(librosa.estimate_tuning(y=harm, sr=SR))\n    _, beats = librosa.beat.beat_track(y=mix, sr=SR)\n    C = librosa.feature.chroma_cqt(y=harm, sr=SR, tuning=tuning)\n    Cb = librosa.util.sync(C, beats, aggregate=np.median)\n    times = librosa.frames_to_time(np.r_[0, beats], sr=SR)\n    return Cb, times, tuning\n\n\ndef window_scores(Cb):\n    T = templates()\n    starts = np.arange(0, max(1, Cb.shape[1] - WIN + 1), HOP)\n    S = []\n    for s in starts:\n        v = Cb[:, s:s + WIN].mean(1)\n        S.append(T @ ((v - v.mean()) / (v.std() + 1e-9)) / 12)  # Pearson r\n    return np.array(S), starts\n\n\ndef viterbi(S):\n    n, K = S.shape\n    E = BETA * S\n    E -= np.logaddexp.reduce(E, axis=1, keepdims=True)\n    A = np.ones((K, K))\n    for i in range(K):\n        for j in range(K):\n            if i // 12 == j // 12 and (j - i) % 12 in (1, 2, 10, 11):\n                A[i, j] = STEP_BONUS\n    np.fill_diagonal(A, 0)\n    A *= (1 - STAY) / A.sum(1, keepdims=True)\n    np.fill_diagonal(A, STAY)\n    logA = np.log(A)\n    D, back = E[0].copy(), np.zeros((n, K), int)\n    for t in range(1, n):\n        M = D[:, None] + logA\n        back[t] = M.argmax(0)\n        D = M.max(0) + E[t]\n    path = [int(D.argmax())]\n    for t in range(n - 1, 0, -1):\n        path.append(int(back[t, path[-1]]))\n    return path[::-1]\n\n\ndef squash(runs):\n    out = []\n    for r in runs:\n        if out and out[-1][2] == r[2]:\n            out[-1][1] = r[1]\n        else:\n            out.append(list(r))\n    return out\n\n\ndef runs_of(path, S):\n    runs = squash([[t, t + 1, k] for t, k in enumerate(path)])\n    while len(runs) > 1:\n        i = min(range(len(runs)), key=lambda i: runs[i][1] - runs[i][0])\n        if (runs[i][1] - runs[i][0]) * HOP >= MIN_SEG:\n            break\n        j = max((j for j in (i - 1, i + 1) if 0 <= j < len(runs)),\n                key=lambda j: S[runs[i][0]:runs[i][1], runs[j][2]].mean())\n        runs[i][2] = runs[j][2]\n        runs = squash(runs)\n    return runs\n\n\ndef change_type(a, b):\n    d = (b % 12 - a % 12) % 12\n    if a // 12 == b // 12:\n        if d in (1, 2):\n            return f"up +{d}", True\n        if d in (10, 11):\n            return f"down -{12 - d}", True\n        return ("fifth" if d in (5, 7) else "other"), False\n    rel = (a < 12 and d == 9) or (a >= 12 and d == 3)\n    return ("relative" if rel else "mode"), False\n\n\ndef analyze(mix, harm):\n    Cb, times, tuning = beat_chroma(mix, harm)\n    S, starts = window_scores(Cb)\n    runs = runs_of(viterbi(S), S)\n    dur = len(mix) / SR\n\n    def t_at(w):  # 창 w가 시작되는 경계의 시각 (앞뒤 창 중심 사이)\n        return 0.0 if w == 0 else float(times[min(starts[w] + (WIN - HOP) // 2, len(times) - 1)])\n\n    segs = []\n    for t0, t1, k in runs:\n        m = S[t0:t1].mean(0)\n        alt = max((j for j in range(24) if j != k), key=lambda j: m[j])\n        segs.append({"start": round(t_at(t0), 1), "end": round(t_at(t1) if t1 < len(S) else dur, 1),\n                     "key": key_name(k), "k": k, "strength": round(float(m[k]), 3),\n                     "runner_up": key_name(alt), "runner_up_strength": round(float(m[alt]), 3)})\n    changes = []\n    for a, b in zip(segs, segs[1:]):\n        typ, step = change_type(a["k"], b["k"])\n        changes.append({"at": b["start"], "from": a["key"], "to": b["key"], "type": typ,\n                        "modulation": step and min(a["strength"], b["strength"]) >= STRONG})\n    cover = {}\n    for s in segs:\n        cover[s["key"]] = cover.get(s["key"], 0) + s["end"] - s["start"]\n    for s in segs:\n        s.pop("k")\n    return {"key": max(cover, key=cover.get), "changes": changes, "segments": segs,\n            "tuning": round(tuning, 3), "n_beats": int(Cb.shape[1]),\n            "bpm_est": round(60 / float(np.median(np.diff(times[1:]))), 1) if len(times) > 2 else None}\n\n\ndef synth():  # 72 BPM, I–V–vi–IV, G major 12마디(40초) → Ab major 6마디(20초), 킥 매 박\n    bar = 4 * 60 / 72\n    t = np.arange(int(bar * SR)) / SR\n    hz = lambda m: 440 * 2 ** ((m - 69) / 12)\n    kick = np.zeros_like(t)\n    for b in range(4):\n        tb = t - b * bar / 4\n        kick += np.where(tb >= 0, np.sin(2 * np.pi * 60 * tb) * np.exp(-tb * 30), 0)\n    out = []\n    for tonic, nbars in ((7, 12), (8, 6)):\n        for b in range(nbars):\n            root, q = [(0, (0, 4, 7)), (7, (0, 4, 7)), (9, (0, 3, 7)), (5, (0, 4, 7))][b % 4]\n            r = (tonic + root) % 12\n            notes = [60 + r + i for i in q] + [36 + r]\n            x = sum(np.sin(2 * np.pi * hz(m) * h * t) / h for m in notes for h in (1, 2, 3, 4))\n            out.append(0.1 * x / len(notes) + 0.5 * kick)\n    return np.concatenate(out).astype(np.float32)\n\n\ndef selftest():\n    assert parse_key("Ab major") == parse_key("G# major") == 8 and parse_key("F minor") == 17\n    assert [score(parse_key(e), parse_key("E major"))[0] for e in ("E major", "B major", "C# minor", "E minor")] \\\n        == ["correct", "fifth_up", "relative", "parallel"]\n    assert score(parse_key("Ab major"), parse_key("F minor"))[0] == "relative"\n    y = synth()\n    r = analyze(y, y)\n    print(json.dumps(r, ensure_ascii=False))\n    keys = [s["key"] for s in r["segments"]]\n    assert keys[0] == "G major" and keys[-1] == "Ab major", keys\n    mods = [c for c in r["changes"] if c["modulation"]]\n    assert len(mods) == 1 and mods[0]["type"] == "up +1" and abs(mods[0]["at"] - 40) < 8, r["changes"]\n    print("SELFTEST OK")\n    return r\n\n\n# ---- baseline: 사용자 detect_musical_key.py (함수만 옮김, yt-dlp 제외) ----\nBL_SR = 44100\nPITCH = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]\n\n\ndef parse_key(s):  # "G# minor", "Ab major", "Eb minor" → 0..23 (장조 0..11, 단조 12..23), 실패 시 None\n    p = s.strip().replace("\\u266f", "#").replace("\\u266d", "b").split()\n    if len(p) < 2 or p[1].lower() not in ("major", "minor"):\n        return None\n    n = p[0][0].upper() + p[0][1:]\n    flat = {"Db": "C#", "Eb": "D#", "Gb": "F#", "Ab": "G#", "Bb": "A#", "Cb": "B", "Fb": "E", "E#": "F", "B#": "C"}\n    n = flat.get(n, n)\n    if n not in PITCH:\n        return None\n    return PITCH.index(n) + (12 if p[1].lower() == "minor" else 0)\n\n\ndef bl_essentia(seg, sr):\n    import essentia.standard as es\n    return es.KeyExtractor()(seg.astype(np.float32))\n\n\ndef bl_librosa(seg, sr):\n    chroma = librosa.feature.chroma_cqt(y=seg, sr=sr).mean(axis=1)\n    if chroma.sum() > 0: chroma /= chroma.sum()\n    bk, bs, bc = "C", "major", -2.0\n    for i in range(12):\n        for prof, name in [(MAJ, "major"), (MIN, "minor")]:\n            c = np.corrcoef(chroma, np.roll(prof, i))[0, 1]\n            if c > bc: bc, bk, bs = c, PITCH[i], name\n    return bk, bs, max(0.0, min(1.0, bc))\n\n\ndef bl_analyze(audio, sr, key_fn, win_sec=15, hop_sec=5, switch_penalty=6.0, prior_weight=2.0):\n    win, hop = int(sr * win_sec), int(sr * hop_sec)\n    raw = []\n    for start in range(0, max(1, len(audio) - win + 1), hop):\n        k, s, st = key_fn(audio[start:start + win].copy(), sr)\n        raw.append((start / sr, f"{k} {s}", st))\n    states = sorted({k for _, k, _ in raw}); S = len(states)\n    idx = {k: i for i, k in enumerate(states)}\n    support = np.zeros(S)\n    for _, k, st in raw: support[idx[k]] += st\n    prior = np.log(support / support.sum() + 1e-6) * prior_weight\n\n    def emit(rep, st):\n        p = np.full(S, (1.0 - st) / max(S - 1, 1)); p[idx[rep]] = st\n        return np.log(p + 1e-9) + prior\n\n    T = len(raw); dp = np.full((T, S), -1e18); bp = np.zeros((T, S), dtype=int)\n    dp[0] = emit(raw[0][1], raw[0][2])\n    for t in range(1, T):\n        e = emit(raw[t][1], raw[t][2])\n        for s in range(S):\n            tr = dp[t - 1] - switch_penalty; tr[s] = dp[t - 1][s]\n            b = int(np.argmax(tr)); dp[t][s] = tr[b] + e[s]; bp[t][s] = b\n    path = [int(np.argmax(dp[-1]))]\n    for t in range(T - 1, 0, -1): path.append(bp[t][path[-1]])\n    smooth = [states[i] for i in path[::-1]]\n    dur = len(audio) / sr\n    segs = []\n    for t, (sec, _, _) in enumerate(raw):\n        if not segs or segs[-1]["key"] != smooth[t]:\n            if segs: segs[-1]["end"] = round(sec, 1)\n            segs.append({"start": round(sec, 1), "end": round(dur, 1), "key": smooth[t]})\n    return {"segments": segs, "raw": [(round(a, 1), k, round(float(st), 3)) for a, k, st in raw]}\n\n\ndef run_method(path, method, stems=False, device="cpu"):\n    """→ {segments[{start,end,key}], ...}. 곡 key 정의는 미정(README 결정 1)이라 채점용으로만 longest를 붙인다."""\n    if method == "pipe":\n        r = analyze(*load(path, stems, device))\n    else:\n        y, _ = librosa.load(path, sr=BL_SR, mono=True)\n        r = bl_analyze(y, BL_SR, bl_essentia if method == "ess" else bl_librosa)\n    cover = {}\n    for s in r["segments"]:\n        cover[s["key"]] = cover.get(s["key"], 0) + s["end"] - s["start"]\n    r["longest"] = max(cover, key=cover.get)\n    return r\n\n\n# ---- 채점 (MIREX 가중 점수, 관계조 허용 정확도) ----\ndef score(est, ref):  # est, ref: 0..23 → (범주, MIREX 점수)\n    if est is None:\n        return "none", 0.0\n    if est == ref:\n        return "correct", 1.0\n    em, rm, et, rt = est // 12, ref // 12, est % 12, ref % 12\n    if em == rm and (et - rt) % 12 == 7:\n        return "fifth_up", 0.5\n    if em == rm and (et - rt) % 12 == 5:\n        return "fifth_down", 0.0\n    if em != rm and (et - rt) % 12 == (9 if rm == 0 else 3):\n        return "relative", 0.3\n    if em != rm and et == rt:\n        return "parallel", 0.2\n    return "other", 0.0\n\n\ndef summarize(rows, methods):\n    out = {}\n    for m in methods:\n        cats = [r[m]["cat"] for r in rows if m in r]\n        n = len(cats)\n        if not n:\n            continue\n        cnt = {c: cats.count(c) for c in sorted(set(cats))}\n        out[m] = {"n": n, "acc": round(cnt.get("correct", 0) / n, 3),\n                  "acc_rel": round((cnt.get("correct", 0) + cnt.get("relative", 0)) / n, 3),\n                  "mirex": round(sum(r[m]["mirex"] for r in rows if m in r) / n, 3), "cats": cnt}\n    return out\n\n\ndef _eval_one(item):\n    path, ref, meta, methods = item\n    row = {"file": os.path.basename(path), "ref": key_name(ref), **meta}\n    for m in methods:\n        try:\n            r = run_method(path, m)\n            est = parse_key(r["longest"])\n            cat, pts = score(est, ref)\n            row[m] = {"est": r["longest"], "cat": cat, "mirex": pts, "n_seg": len(r["segments"])}\n        except Exception as e:\n            row[m] = {"est": None, "cat": "error", "mirex": 0.0, "err": str(e)[:200]}\n    return row\n\n\ndef eval_set(name, items, methods, out):\n    from multiprocessing import Pool\n    with Pool(os.cpu_count()) as pool:\n        rows = []\n        for i, row in enumerate(pool.imap_unordered(_eval_one, [(*it, methods) for it in items], chunksize=4)):\n            rows.append(row)\n            if i % 50 == 0:\n                print(name, i, len(items), flush=True)\n    summ = {"all": summarize(rows, methods)}\n    for g in sorted({r.get("genre") for r in rows} - {None}):\n        summ[g] = summarize([r for r in rows if r.get("genre") == g], methods)\n    json.dump(rows, open(f"{out}/{name}_rows.json", "w"), ensure_ascii=False, indent=1)\n    json.dump(summ, open(f"{out}/{name}_summary.json", "w"), ensure_ascii=False, indent=1)\n    print(name, json.dumps(summ["all"], ensure_ascii=False), flush=True)\n\n\ndef gtzan_items():  # 오디오: Kaggle GTZAN, 정답: github alexanderlerch/gtzan_key (A=0 기준, -1 = 전조/불명)\n    wavs = sorted(glob.glob("/kaggle/input/**/genres_original/*/*.wav", recursive=True))\n    if not wavs:\n        return []\n    gt = "/kaggle/working/gtzan_key"\n    subprocess.run(f"git clone -q --depth 1 https://github.com/alexanderlerch/gtzan_key {gt}", shell=True)\n    items = []\n    for w in wavs:\n        genre, base = w.split("/")[-2], os.path.basename(w)[:-4]\n        f = f"{gt}/gtzan_key/genres/{genre}/{base}.lerch.txt"\n        if not os.path.exists(f):\n            continue\n        n = int(open(f).read().split()[0])\n        if n < 0:\n            continue\n        items.append((w, (n % 12 + 9) % 12 + (12 if n >= 12 else 0), {"genre": genre}))\n    return items\n\n\ndef giantsteps_items():\n    items = []\n    for f in sorted(glob.glob("/kaggle/input/**/giantsteps-key-dataset/annotations/key/*.key", recursive=True)):\n        base = os.path.basename(f)[:-4]\n        mp3 = glob.glob(f"{os.path.dirname(os.path.dirname(os.path.dirname(f)))}/audio/{base}.mp3")\n        ref = parse_key(open(f).read())\n        if mp3 and ref is not None:\n            items.append((mp3[0], ref, {}))\n    return items\n\n\ndef kaggle():\n    out = "/kaggle/working/out"\n    os.makedirs(out, exist_ok=True)\n    subprocess.run(f"{sys.executable} -m pip install -q demucs essentia", shell=True)\n    import torch\n    device = "cuda" if torch.cuda.is_available() else "cpu"\n    print("device", device, os.cpu_count(), "cpu", flush=True)\n    try:\n        json.dump(selftest(), open(f"{out}/selftest.json", "w"), ensure_ascii=False, indent=1)\n    except AssertionError as e:\n        print("SELFTEST FAIL", e, flush=True)\n    for wav in sorted(w for w in glob.glob("/kaggle/input/**/*.wav", recursive=True) if "genres_original" not in w):\n        name = os.path.basename(wav)[:-4]\n        for m, stems in (("pipe", False), ("pipe", True), ("ess", False), ("lib", False)):\n            tag = m + (".stems" if stems else "")\n            r = {"file": name, "method": tag, **run_method(wav, m, stems, device)}\n            json.dump(r, open(f"{out}/{name}.{tag}.json", "w"), ensure_ascii=False, indent=1)\n            print(name, tag, [(s["start"], s["key"]) for s in r["segments"]], flush=True)\n    methods = ["pipe", "ess", "lib"]\n    for name, items in (("gtzan", gtzan_items()), ("giantsteps", giantsteps_items())):\n        print(name, len(items), "items", flush=True)\n        if items:\n            eval_set(name, items, methods, out)\n\nif __name__ == "__main__":\n    if len(sys.argv) == 1 and os.path.isdir("/kaggle/input"):\n        kaggle()\n    else:\n        ap = argparse.ArgumentParser()\n        ap.add_argument("audio", nargs="?")\n        ap.add_argument("--stems", action="store_true")\n        ap.add_argument("--device", default="cuda")\n        ap.add_argument("--selftest", action="store_true")\n        ap.add_argument("-o")\n        a = ap.parse_args()\n        if a.selftest:\n            selftest()\n        else:\n            r = analyze(*load(a.audio, a.stems, a.device))\n            s = json.dumps(r, ensure_ascii=False, indent=1)\n            open(a.o, "w").write(s) if a.o else print(s)\n'
T0 = time.time()
DEADLINE = 11.0 * 3600  # Kaggle 12시간 제한 전에 집계까지 마치도록
OUT, TMP = "/kaggle/working/out", "/kaggle/temp"
SR, SR44 = 22050, 44100
ESS_PROFILES = ["diatonic", "krumhansl", "temperley", "weichai", "tonictriad", "temperley2005", "thpcp", "shaath",
                "gomez", "noland", "faraldo", "pentatonic", "edmm", "edma", "bgate", "braw"]
TPL = {  # 장조, 단조 (C 기준)
    "kk": ([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88],
           [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]),
    "temperley": ([5, 2, 3.5, 2, 4.5, 4, 2, 4.5, 2, 3.5, 1.5, 4], [5, 2, 3.5, 4.5, 2, 4, 2, 4.5, 3.5, 2, 1.5, 4]),
    "albrecht": ([.238, .006, .111, .006, .137, .094, .016, .214, .009, .080, .008, .081],
                 [.220, .006, .104, .123, .019, .103, .012, .214, .062, .022, .061, .052]),
}

km = types.ModuleType("keypipe")
exec(compile(KEY_SRC, "key.py", "exec"), km.__dict__)
NAMES = km.NAMES
kname = lambda k: None if k is None else f"{NAMES[k % 12]} {'major' if k < 12 else 'minor'}"
pk = lambda s: km.parse_key(s) if s else None


# ---------------- 입력 ----------------
def synth(spec):
    """spec: {tonic, mode, bpm, kind} → (audio 44.1k, truth[(start, key)])"""
    rng = np.random.default_rng(spec["seed"])
    beat = 60 / spec["bpm"]; bar = 4 * beat
    prog = {0: [(0, (0, 4, 7)), (7, (0, 4, 7)), (9, (0, 3, 7)), (5, (0, 4, 7))],      # I V vi IV
            1: [(0, (0, 3, 7)), (8, (0, 4, 7)), (3, (0, 4, 7)), (10, (0, 4, 7))]}    # i VI III VII
    t0, m0 = spec["tonic"], spec["mode"]
    plan = {"none": [(t0, m0, 60)], "up1": [(t0, m0, 40), ((t0 + 1) % 12, m0, 20)], "up2": [(t0, m0, 40), ((t0 + 2) % 12, m0, 20)],
            "relative": [(t0, m0, 30), ((t0 + (9 if m0 == 0 else 3)) % 12, 1 - m0, 30)],
            "return": [(t0, m0, 25), ((t0 + 5) % 12, m0, 20), (t0, m0, 25)]}[spec["kind"]]
    n = int(bar * SR44); t = np.arange(n) / SR44
    hz = lambda m: 440 * 2 ** ((m - 69) / 12)
    out, truth, now = [], [], 0.0
    for tonic, mode, sec in plan:
        truth.append((round(now, 2), tonic + 12 * mode))
        bars = max(1, round(sec / bar))
        for b in range(bars):
            root, q = prog[mode][b % 4]
            r = (tonic + root) % 12
            notes = [60 + r + i for i in q] + [36 + r]
            x = sum(np.sin(2 * np.pi * hz(m) * h * t) / h for m in notes for h in (1, 2, 3)) * 0.08 / len(notes)
            for k in range(4):
                tk = t - k * beat
                x = x + np.where(tk >= 0, np.sin(2 * np.pi * 55 * tk) * np.exp(-np.clip(tk, 0, None) * 25), 0) * (0.6 if k % 2 == 0 else 0.0)
                x = x + np.where(tk >= 0, rng.standard_normal(n) * np.exp(-np.clip(tk, 0, None) * 60), 0) * 0.05
            out.append(x)
        now += bars * bar
    return np.concatenate(out).astype(np.float32), truth


def synth_specs():
    specs, i = [], 0
    for bpm in (60, 90, 140):
        for kind in ("none", "up1", "up2", "relative", "return"):
            for mode in (0, 1):
                specs.append({"id": f"synth_{bpm}_{kind}_{'maj' if mode == 0 else 'min'}", "set": "synth", "bpm": bpm,
                              "kind": kind, "mode": mode, "tonic": [0, 2, 4, 5, 7, 9, 10][i % 7], "seed": i})
                i += 1
    return specs


GT3 = {  # lab/to-arrangement-form/SongFormer 구간과 구간별 분석으로 key·BPM·송폼을 함께 잴 수 있다/audio-analysis-test/LOG.md 6번
    "anointing_rejoice": {"main": ["E major"], "truth": [(0, "E major")]},
    "jus_return-to-lord": {"main": ["Ab major", "F minor"], "truth": None},  # 원곡 전조 미확인
    "markers_love-of-god": {"main": ["E major", "F major"], "truth": [(0, "E major"), (190, "F major")]},
}


def items():
    its = synth_specs()
    for wav in sorted(glob.glob("/kaggle/input/**/audio/*.wav", recursive=True)):
        n = os.path.basename(wav)[:-4]
        if n in GT3:
            its.append({"id": n, "set": "gt3", "path": wav})
    sj = glob.glob("/kaggle/input/**/songs.json", recursive=True)
    if sj:
        root = os.path.dirname(sj[0])
        for s in json.load(open(sj[0])):
            src = [f for f in glob.glob(f"{root}/{s['id']}.*") if not f.endswith(".json")]
            if src:
                its.append({"id": s["id"], "set": "w500", "path": src[0], "team": s["team"], "title": s["title"]})
    return its


def audio44(it):
    if it["set"] == "synth":
        return synth(it)[0]
    wav = f"{TMP}/dec_{os.getpid()}_{it['id']}.wav"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", it["path"], "-ac", "1", "-ar", str(SR44), wav])
    import soundfile as sf
    y, _ = sf.read(wav, dtype="float32")
    os.remove(wav)
    return y


# ---------------- 1단계: Demucs ----------------
def stage1(its):
    import torch
    from demucs.api import Separator
    sep = Separator(model="htdemucs", device="cuda" if torch.cuda.is_available() else "cpu")
    os.makedirs(f"{TMP}/harm", exist_ok=True)
    for i, it in enumerate(its):
        dst = f"{TMP}/harm/{it['id']}.npy"
        if os.path.exists(dst) or time.time() - T0 > 6 * 3600:
            continue
        try:
            y = audio44(it)
            x = torch.from_numpy(np.stack([y, y]))
            _, s = sep.separate_tensor(x, SR44)
            h = (s["bass"] + s["other"]).mean(0).cpu().numpy()
            import librosa
            np.save(dst, librosa.resample(h, orig_sr=sep.samplerate, target_sr=SR).astype(np.float16))
        except Exception as e:
            print("demucs fail", it["id"], repr(e)[:100], flush=True)
        if i % 50 == 0:
            print(f"stage1 {i}/{len(its)} {time.time() - T0:.0f}s", flush=True)


# ---------------- 2단계: 방법들 ----------------
def tpl_matrix(name):
    maj, mnr = (np.array(v, float) for v in TPL[name])
    T = np.array([np.roll(p, k) for p in (maj, mnr) for k in range(12)])
    return (T - T.mean(1, keepdims=True)) / T.std(1, keepdims=True)


def corr24(v, T):
    v = (v - v.mean()) / (v.std() + 1e-9)
    return T @ v / 12


def top2(scores):
    o = np.argsort(scores)[::-1]
    return {"key": kname(int(o[0])), "score": round(float(scores[o[0]]), 3), "second": kname(int(o[1])), "second_score": round(float(scores[o[1]]), 3)}


def hpcp_frames(y, sr):
    import essentia.standard as es
    w = es.Windowing(type="blackmanharris62"); spec = es.Spectrum()
    peaks = es.SpectralPeaks(orderBy="magnitude", magnitudeThreshold=1e-5, minFrequency=25, maxFrequency=3500, maxPeaks=60, sampleRate=sr)
    hp = es.HPCP(size=36, referenceFrequency=440, harmonics=4, bandPreset=True, minFrequency=25, maxFrequency=3500,
                 weightType="cosine", nonLinear=False, windowSize=1.0, sampleRate=sr)
    fr = []
    for f in es.FrameGenerator(y.astype(np.float32), frameSize=4096, hopSize=2048, startFromZero=True):
        fq, mg = peaks(spec(w(f)))
        fr.append(hp(fq, mg))
    return np.array(fr, dtype=np.float32), 2048 / sr


def ess_key(pcp, profile):
    import essentia.standard as es
    k, s, st, _ = es.Key(profileType=profile, pcpSize=36, numHarmonics=4, slope=0.6, usePolyphony=True, useThreeChords=True)(pcp.astype(np.float32))
    return f"{k} {s}", float(st)


CHORD_W = {0: {(0, "maj"): 1, (5, "maj"): .8, (7, "maj"): .8, (9, "min"): .6, (2, "min"): .5, (4, "min"): .3},
           1: {(0, "min"): 1, (5, "min"): .8, (7, "maj"): .8, (7, "min"): .5, (8, "maj"): .6, (3, "maj"): .5, (10, "maj"): .5}}
CH_ROOT = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}


def chord_key(chords):
    sc = np.zeros(24)
    for a, b, lab in chords:
        if ":" not in lab:
            continue
        r, q = lab.split(":")
        r = CH_ROOT.get(r)
        if r is None:
            continue
        for k in range(24):
            sc[k] += (b - a) * CHORD_W[k // 12].get(((r - k % 12) % 12, q), 0)
    return sc


def run_item(it):
    if time.time() - T0 > DEADLINE:
        return {"id": it["id"], "set": it["set"], "skipped": "deadline"}
    import librosa
    row = {k: it[k] for k in ("id", "set", "team", "title", "kind", "bpm", "mode", "tonic") if k in it}
    M, err, feat = {}, {}, {}

    def run(name, fn):
        try:
            M[name] = fn()
        except Exception as e:
            err[name] = repr(e)[:160]

    y44 = audio44(it)
    if it["set"] == "synth":
        row["truth"] = [(a, kname(k)) for a, k in synth(it)[1]]
    elif it["set"] == "gt3":
        row["truth"] = GT3[it["id"]]["truth"]; row["main"] = GT3[it["id"]]["main"]
    row["dur"] = round(len(y44) / SR44, 1)
    mix = librosa.resample(y44, orig_sr=SR44, target_sr=SR)
    hp = f"{TMP}/harm/{it['id']}.npy"
    harm = np.load(hp).astype(np.float32) if os.path.exists(hp) else None
    inputs = {"mix": mix} if harm is None else {"mix": mix, "stem": harm}

    # key-pipeline
    def pipe(h):
        r = km.analyze(mix, h)
        return {"key": r["key"], "segments": r["segments"], "changes": r["changes"]}
    run("pipe_mix", lambda: pipe(mix))
    if harm is not None:
        run("pipe_stem", lambda: pipe(harm))

    # 사용자 baseline
    def bl(fn):
        r = km.bl_analyze(y44, SR44, fn)
        cov = {}
        for s in r["segments"]:
            cov[s["key"]] = cov.get(s["key"], 0) + s["end"] - s["start"]
        return {"key": max(cov, key=cov.get), "segments": r["segments"]}
    run("bl_ess", lambda: bl(km.bl_essentia))
    run("bl_lib", lambda: bl(km.bl_librosa))

    # librosa 템플릿 3종 × 입력
    for inp, h in inputs.items():
        try:
            Cb, times, _ = km.beat_chroma(mix, h)
            feat[f"chroma_{inp}"] = Cb.astype(np.float16); feat["beat_times"] = times.astype(np.float32)
            for name in TPL:
                T = tpl_matrix(name)
                M[f"tpl_{name}_{inp}"] = top2(corr24(Cb.mean(1), T))
                st = np.arange(0, max(1, Cb.shape[1] - 16 + 1), 4)
                feat[f"tplwin_{name}_{inp}"] = np.array([corr24(Cb[:, s:s + 16].mean(1), T) for s in st], dtype=np.float16)
        except Exception as e:
            err[f"tpl_{inp}"] = repr(e)[:160]

    # Essentia HPCP → 프로파일 16종, 창별 3종
    for inp, h in inputs.items():
        try:
            y = y44 if inp == "mix" else librosa.resample(h, orig_sr=SR, target_sr=SR44)
            H, hop = hpcp_frames(y, SR44)
            feat[f"hpcp_{inp}"] = H[::max(1, int(round(0.5 / hop)))].astype(np.float16)
            mean = H.mean(0)
            for p in ESS_PROFILES:
                run(f"ess_{p}_{inp}", lambda p=p: dict(zip(("key", "strength"), ess_key(mean, p))))
            if inp == "mix":
                w, s = int(15 / hop), int(5 / hop)
                for p in ("temperley", "bgate", "edma"):
                    run(f"esswin_{p}", lambda p=p: {"windows": [(round(i * hop, 1), *ess_key(H[i:i + w].mean(0), p)) for i in range(0, max(1, len(H) - w + 1), s)]})
        except Exception as e:
            err[f"ess_{inp}"] = repr(e)[:160]

    # madmom CNN key, 코드
    try:
        from madmom.audio.signal import Signal
        from madmom.features.key import CNNKeyRecognitionProcessor, key_prediction_to_label
        cnn = CNNKeyRecognitionProcessor()
        for inp, h in inputs.items():
            y = y44 if inp == "mix" else librosa.resample(h, orig_sr=SR, target_sr=SR44)
            run(f"cnn_{inp}", lambda y=y: {"key": key_prediction_to_label(cnn(Signal(y, sample_rate=SR44)))})
        w, s = 30 * SR44, 10 * SR44
        probs = [cnn(Signal(y44[a:a + w], sample_rate=SR44))[0] for a in range(0, max(1, len(y44) - w + 1), s)]
        feat["cnnwin_mix"] = np.array(probs, dtype=np.float16)
        M["cnnwin_mix"] = {"windows": [(i * 10, key_prediction_to_label(p[None])) for i, p in enumerate(probs)]}
    except Exception as e:
        err["cnn"] = repr(e)[:160]
    try:
        from madmom.audio.signal import Signal
        from madmom.features.chords import CNNChordFeatureProcessor, CRFChordRecognitionProcessor
        ch = CRFChordRecognitionProcessor()(CNNChordFeatureProcessor()(Signal(y44, sample_rate=SR44)))
        chords = [(round(float(a), 2), round(float(b), 2), str(l)) for a, b, l in ch]
        M["chord_key"] = {**top2(chord_key(chords)), "chords": chords}
    except Exception as e:
        err["chord"] = repr(e)[:160]

    row["methods"], row["errors"] = M, err
    os.makedirs(f"{OUT}/songs", exist_ok=True); os.makedirs(f"{OUT}/feat", exist_ok=True)
    json.dump(row, open(f"{OUT}/songs/{it['id']}.json", "w"), ensure_ascii=False)
    np.savez_compressed(f"{OUT}/feat/{it['id']}.npz", **feat)
    return {"id": it["id"], "set": it["set"], "n_methods": len(M), "n_err": len(err)}


# ---------------- 집계 ----------------
def global_key(m):
    return pk(m.get("key")) if isinstance(m, dict) else None


def events(m):  # 방법 출력 → [(시각, key)] 변화 이벤트
    if "segments" in m:
        segs = m["segments"]
        return [(s["start"], pk(s["key"])) for s in segs[1:]]
    if "windows" in m:
        w = m["windows"]
        return [(b[0], pk(b[1])) for a, b in zip(w, w[1:]) if b[1] != a[1]]
    return []


def summarize(src=OUT):
    rows = [json.load(open(f)) for f in sorted(glob.glob(f"{src}/songs/*.json"))]
    os.makedirs(OUT, exist_ok=True)
    names = sorted({n for r in rows for n in r.get("methods", {})})
    S = {"n": {s: sum(r["set"] == s for r in rows) for s in ("synth", "gt3", "w500")}, "methods": names, "global": {}, "modulation": {}, "agreement": {}}
    # 곡 key 채점: 합성(첫 key, relative 곡은 두 key 모두 정답) + 3곡(main 목록 중 하나)
    for n in names:
        cats, mir = {}, []
        for r in rows:
            if r["set"] not in ("synth", "gt3") or n not in r.get("methods", {}):
                continue
            est = global_key(r["methods"][n])
            if est is None:
                continue
            refs = [pk(r["truth"][0][1])] if r["set"] == "synth" else [pk(x) for x in r["main"]]
            if r["set"] == "synth" and r.get("kind") in ("relative", "up1", "up2"):
                refs.append(pk(r["truth"][-1][1]))
            best = max((km.score(est, ref) for ref in refs), key=lambda c: c[1])
            cats[best[0]] = cats.get(best[0], 0) + 1; mir.append(best[1])
        if mir:
            S["global"][n] = {"n": len(mir), "mirex": round(float(np.mean(mir)), 3), "correct": round(cats.get("correct", 0) / len(mir), 3), "cats": cats}
    # 전조 검출: 합성 곡 정답 변화 이벤트 vs 방법 이벤트 (±10초, 도착 key 일치)
    for n in names:
        tp = fp = fn = 0
        for r in rows:
            if r["set"] != "synth" or n not in r.get("methods", {}) or not ("segments" in r["methods"][n] or "windows" in r["methods"][n]):
                continue
            truth = [(a, pk(k)) for a, k in r["truth"][1:]]
            ev = events(r["methods"][n]); used = set()
            for a, k in truth:
                hit = next((i for i, (b, e) in enumerate(ev) if i not in used and abs(b - a) <= 10 and e == k), None)
                if hit is None:
                    fn += 1
                else:
                    tp += 1; used.add(hit)
            fp += len(ev) - len(used)
        if tp + fp + fn:
            S["modulation"][n] = {"tp": tp, "fp": fp, "fn": fn, "precision": round(tp / (tp + fp), 3) if tp + fp else None, "recall": round(tp / (tp + fn), 3) if tp + fn else None}
    # 500곡: 방법 간 곡 key 일치도 (정확 / 나란한조 허용)
    w = [r for r in rows if r["set"] == "w500"]
    gl = [n for n in names if any(global_key(r["methods"].get(n, {})) is not None for r in w)]
    for a in gl:
        for b in gl:
            if a >= b:
                continue
            pairs = [(global_key(r["methods"][a]), global_key(r["methods"][b])) for r in w if a in r["methods"] and b in r["methods"]]
            pairs = [(x, y) for x, y in pairs if x is not None and y is not None]
            if pairs:
                ex = np.mean([x == y for x, y in pairs])
                rel = np.mean([x == y or km.score(x, y)[0] == "relative" for x, y in pairs])
                S["agreement"][f"{a}|{b}"] = [round(float(ex), 3), round(float(rel), 3), len(pairs)]
    # key up 후보: pipe·bl 계열이 같은 장단조 +1/+2 상승을 낸 곡
    cand = []
    for r in w:
        votes = []
        for n in ("pipe_mix", "pipe_stem", "bl_ess", "bl_lib"):
            m = r["methods"].get(n)
            if not m or "segments" not in m:
                continue
            ks = [pk(s["key"]) for s in m["segments"]]
            if any(a is not None and b is not None and a // 12 == b // 12 and (b - a) % 12 in (1, 2) for a, b in zip(ks, ks[1:])):
                votes.append(n)
        if len(votes) >= 2:
            cand.append({"id": r["id"], "team": r.get("team"), "title": r.get("title"), "votes": votes})
    S["keyup_candidates"] = cand
    S["errors"] = {}
    for r in rows:
        for k in r.get("errors", {}):
            S["errors"][k] = S["errors"].get(k, 0) + 1
    json.dump(S, open(f"{OUT}/summary.json", "w"), ensure_ascii=False, indent=1)
    print("SUMMARY n", S["n"], "errors", S["errors"], flush=True)
    top = sorted(S["global"].items(), key=lambda x: -x[1]["mirex"])[:15]
    for n, v in top:
        print("GLOBAL", n, v, flush=True)
    for n, v in S["modulation"].items():
        print("MOD", n, v, flush=True)
    print("KEYUP candidates", len(cand), flush=True)


def selftest():
    y, truth = synth({"tonic": 7, "mode": 0, "bpm": 90, "kind": "up1", "seed": 0})
    assert [kname(k) for _, k in truth] == ["G major", "Ab major"], truth
    assert km.parse_key("Ab major") == km.parse_key("G# major") == 8 and pk("A minor") == 21
    sc = chord_key([(0, 4, "G:maj"), (4, 8, "D:maj"), (8, 12, "E:min"), (12, 16, "C:maj")])
    assert kname(int(np.argmax(sc))) == "G major", kname(int(np.argmax(sc)))
    print("SELFTEST OK", flush=True)



DONE = set(["-0MSF8U3hek", "-0tANkmlN-4", "-1F1qDC0J5g", "-6YAK8u9wiw", "-B3w7mjRK6I", "-p8O4ENLc0I", "-zl2AnMQf54", "0-x3pCO9IUc", "04pa-qgxhrA", "05GLD2hPmWc", "08F4mCbyc2k", "0Eq3R4P_NdQ", "0R75_3L-moE", "1J4Vum7WuRs", "1TSgDWi323g", "1UBsTYjh91Y", "1hpiguKhKdM", "1s7rKwr-S_E", "1xYP3RrXGXw", "2p4P73XThJM", "2q5-Vyir8RQ", "2ry81Mlrgro", "2tSN0sQiLe4", "2vOI8DDkln8", "2yQKZnSBQBA", "2zRUhhBQt5g", "3ByvD-JCUT8", "3EdaZKGEGbI", "3KpuKinKz6U", "3NNBppCgpqs", "3RCr0VPTemU", "3ZcpQ_1ltSQ", "3gF_odzDqls", "4KDP6E2Kezo", "4jH3MqokNMw", "4v0oHeJ8-2k", "5A3MNxbFtRQ", "5JvEYRcuJNE", "5Pldr52Y6Mk", "5_AS1TCdKeU", "5lMftHwFar8", "5phB9B4z1RE", "670Jgq7SJcY", "6CG2v0FSFK0", "6RUSp_XVmRs", "6Xdy8I6aGpg", "6ZLaChORt7o", "6iMaNhNVFbk", "6vqvSEtKUVA", "7X6_5hYxrZA", "7kuBu5Qa3PA", "7oxs8NVWOsc", "7zx_SuQ-Puc", "8-UUGS3KuJs", "8BdDeDFyJx8", "8Dqq3tXN6ug", "8PEKtpFsWiI", "8uzlzxH1kvA", "9NhESBIGvWc", "9SFwuyQTxKg", "9Th_CT9Le1o", "9WC1VHaYWF0", "9h44OUxrQbM", "9ypxWDqUNL4", "A0FUMbDKmLA", "A6P5jyKGrcc", "AXCuHNnHRRM", "AlSeiyNGDh0", "AmwX2-BIpRU", "ApHcXxQPSC4", "BTnfn5tjfDs", "BcIWMvIz7Tg", "BqDz7o8S7DI", "C2hKv2CxrsM", "C8ysOmmGDlU", "CDKxavzv-zk", "DCDJcBZ8tp0", "DCcOHcLS1Fg", "DDhMM8Phfcw", "DJJnhs3XOs0", "DLkSoGgOMa8", "DPFWcaIiBTY", "DTDexumWKhw", "DTn_spKxlag", "DUZubycHbJI", "DkGxuWoDCSk", "DvgW58wQK70", "Dy82rJfUvNQ", "ETK8xbwE6M0", "EjcYiIVRI0w", "EqDL2-OW1Z4", "F2GTMAFdTWc", "F79exVlGWTw", "F7VX4zuUwX0", "FAEQpV6zkUE", "FPLFd6F3FU8", "FV5nMb93UwY", "FY2M5-xpfIU", "FZ37qTofQUM", "Fi2waeWY18g", "Fii5b6zvM6o", "Fp7fXO2ke-c", "FzsbhbBN4Yk", "GbLDiHTTseI", "GkE-in0mjqk", "H0ThSHosCe4", "H1rWgHpCBm8", "H79FL5F4Mak", "H7A39tM-crA", "HAPjUmYaklk", "HHupVXtnjRs", "H_2TIL-1c1g", "Hng3fLxtH6c", "HnsegN8Fwlc", "I6zEuEteBKI", "IEBTRN-txPU", "IFX1nyHpKp8", "IRxLKV8KzUI", "IToU4fzyIBo", "IiOuxduQmrM", "IwXxu4i-Q1o", "J5Mh2nEC5C0", "JDJCc1kPb5k", "JGqENiEQ3l4", "JKOwGMp5AlA", "JQ0BiwhseVU", "JfvrrrdJlUI", "JoO5xhY1qHo", "JowMbhzzb4Y", "JriRxS4NuUs", "KAIuTUg7iR4", "KEIUmybsN9U", "KIuOe2OmpNI", "KS4wNLfGD1s", "L2QueVJKGRY", "LCscWAAg-lg", "Lea0HuEJIo0", "Lh3VLft12lE", "M7gnF1VNwtk", "MPpxiJlWQCU", "MpKbK7P1hkM", "Mteo0S_vNkA", "N7pl458SJo0", "NGB2VVH5Z80", "NGUK4kiIB9c", "NNeb-IqWjN0", "NtWG05adY2Q", "O3kKjbGeJ_A", "O8RTmyWdIQs", "O8xMq9mjie8", "OR1i0zG8hDY", "Oeo5YbeBACo", "OmnhVyt1yBE", "OnBy6_auuA4", "OvKBsdTnlYE", "P0JwfVX49sM", "P9XkfeUoaNw", "PJA_DZabzFs", "PNfbZIAiEuI", "PV3LJu68nwk", "PklFusQuQ0Q", "PpLAIl8oquk", "Pqtp9Y0rLZ4", "Q377AqjOiI8", "QSdlAz1Togo", "R0H84nOJbvM", "R9z0ISZJSig", "RHwKFNv_9pk", "RIy5TuLRq80", "RUIvOfg1ROk", "S7BA0fmwiAY", "SAWH-Cd_zMo", "SMHOOmD_YA0", "SU_5T0u0dBI", "SZ1_POwK8yo", "SiFHu0jsUCQ", "SorZzUesTR8", "TWJ8u4hdJ0M", "Ti7YZh7UHFM", "Tk23p0NiVos", "TtH4qHWdTto", "U2FI3vdoTY8", "URIr6q-BKUM", "UcDRHqXZS-4", "UnVnAZSnEbs", "UnuvgNqb5OA", "V0Xr_FWmQQ8", "V3B3ZtPeP28", "VEB1yvUtaAg", "VXtdNHspT5o", "Vdjk2jozY-o", "VeuP0yejeYM", "VyAeMJ88CV4", "VzpPlYs7bxE", "W1uussHIX9o", "WAZwsM5B4EQ", "WJCk35xzHFM", "WT8Xx_HIqZ0", "WaE5v4NoAV0", "Wm5an1RZDaU", "XNVhg688J2o", "XlXVxpA8QgU", "Xll9o8RKkis", "Xm22G0JmbWw", "Y0Uiss0-ukc", "YEuuN_5stFY", "YHOJGBVxiD4", "YMpAk9T1NyM", "YTE7W2DOK8U", "YnyY7dsWPg0", "Z0ZFf1JkiMM", "Z3LyJ0eRdB0", "ZO3fUqVKnVw", "ZWquExqPvO0", "Z_Q0vq1huNM", "_3OLrU45C-w", "_8AgjhoBiV8", "_9y0rclhPNI", "_D-OwkGIF1M", "_RRHcSpqkMo", "_sEP_PugVfk", "a6U52DaHu7o", "aDHiaC_m4vM", "aVkqePxJKUA", "aZdI6xOt58c", "acS4DAMFGWA", "bJEkHtWpUxw", "bL1xgf18G7Y", "bgdU5_BbACM", "bqv6-Ol_Kzg", "c0WVuloAaX8", "c7OyG-fhFZc", "c8sIb-3kzrU", "cSu0JoIWP7g", "c_JlmmpNlDo", "cmvL6ppJHO8", "dN12aR02yiM", "dtdUwy2vWhA", "dwnjxyNEN00", "eMWCKZjztZ0", "eb42F1T_UlQ", "eftWD6OjHjQ", "ele4YXY84lY", "fNJFmLOBjqU", "fXw8-B0j_gQ", "fZXFfEKlRSo", "ff3i8tkOrR4", "frLpGV7Hg7s", "gGDsTiqsaOw", "gPGvNQbvd84", "gfNH21Q9tOk", "h7XUqm7KrjA", "hDp-hZRBiqo", "hTl1LpcM9xs", "hyCXdZfnwxk", "iPNs1m7XIQ0", "iVRc9wcA95Q", "ij3JtLBdehk", "iqQfEWTGMRc", "j60IY7LiIgw", "jLpl1zteVWA", "jSXVzVZyXfY", "k5yZsgQRa7k", "k8qloQzenSo", "kD_j5sZbFko", "kNw-JcQZilc", "kQVZCuwS73w", "kdFH0iSBU9I", "kgSifDGxsmA", "kgTBGxIa-BU", "kpaU3qE_l-M", "kwFW0zE80UU", "lJv9v9gX9ik", "lQqrbc_JUzA", "loyMVf97mz8", "mAv5kLm72JU", "mcC-Dp1x-o4", "mgS_ng-wAqY", "mtoCa0odUQg", "nHj9n3OU6iw", "nUTvfKu7q3c", "nlmlzkMcRQQ", "oAJ34_Ogfs0", "opCAoa0Bce8", "ovjWMKsks2Y", "p3BBGQMSjNc", "pZuW2CV0mXY", "pjtqG9-R5Mk", "q3gNFkgFhyY", "q7bCFfwakqA", "q8l0l2Rqoaw", "qDyCoSMia48", "qGCOrFeD4Hk", "qj302tHU0GY", "qwv4YHLA2js", "rJi0wNooA2Q", "rlgvUfQAsAo", "roh3jsvkTZ0", "s2lbtF_ljWo", "s3HySr8EoTY", "sBCmnxEXHRc", "sD3Lv2NWPwA", "sDoY-zjVBGA", "sxmvTLUd--U", "tAIu_LC9E58", "tCDffrPOfD4", "tJNAg7b91Eg", "tMjSg5lFFaU", "tmzMdyVKOZY", "tqvaGtNJMo8", "trh3btQmcVk", "tw81eyMIlXQ", "tzywGuk2Y9I", "u2coqlh3re8", "uATTd3cMEh8", "uDl1eSK2qw0", "uOUpjKfqQOY", "uYOQHKaQTuE", "uf7gnjnE6So", "ufEXsxOS3mE", "uigD6DqFqZU", "v2WOHXgT1lA", "v2qSI2tzGOo", "vG_E39ZYAjs", "vKr84g3CKOM", "vQeAmrM17BM", "vayy8ddqnRc", "vmBoN2IwONk", "voxye9mvxg8", "vr_ASu9WHkk", "vwGJ9bslrxI", "vwGOFdY-dw0", "w4ELHTfDrdU", "w53nMo8jx5o", "wSFLJjwTqDc", "wTSKqEs4K5w", "wa1mN8wNmyk", "wiwKnVTqIWU", "x4XlGpEwLlo", "xYf8GCzeoN4", "xfegFyBxYnQ", "xtBnkPYqBr0", "yGKaEGwTvtc", "yKcxnsdhDAg", "yKz4Im6uTcI", "yOReWzYunCU", "yRdByPgkBVI", "ycJgvKV22Ho", "yfWzBI1pjgg", "yg2TRUSPhiY", "yhiCeCJ2zbU", "yqJL8off9FU", "yu2HxAOXCUA", "yvIUefLeiLk", "zHEyzrRdXQ4", "zt1A1jrqUyg", "ztWbZq0Cp6s", "zvrAdnhi1xA", "zwPAhTzoDRY"])  # v1 곡별 결과가 있는 500곡 (359)

if __name__ == "__main__":
    for r, ds, fs in os.walk("/kaggle/input"):
        if r.count("/") <= 6:
            print("INPUT", r, len(fs), ds[:5], fs[:3], flush=True)
    done = glob.glob("/kaggle/input/**/songs/*.json", recursive=True)
    if done and not glob.glob("/kaggle/input/**/songs.json", recursive=True):  # 집계 전용: 앞 커널 출력만 붙인 경우
        summarize(os.path.dirname(os.path.dirname(done[0])))
        sys.exit(0)
    sh = lambda c: subprocess.run(c, shell=True)
    pip = f"{sys.executable} -m pip install -q"
    sh(f"{pip} cython numpy soundfile demucs essentia > /kaggle/working/pip.log 2>&1")
    sh(f"{pip} --no-build-isolation 'git+https://github.com/CPJKU/madmom' >> /kaggle/working/pip.log 2>&1")
    selftest()
    its = [i for i in items() if i["set"] == "w500" and i["id"] not in DONE]  # v2: v1에서 못 돈 500곡만
    print("items", {s: sum(i["set"] == s for i in its) for s in ("synth", "gt3", "w500")}, flush=True)
    stage1(its)
    print(f"stage1 done {time.time() - T0:.0f}s", flush=True)
    from multiprocessing import get_context
    with get_context("fork").Pool(4, maxtasksperchild=25) as pool:
        for i, r in enumerate(pool.imap_unordered(run_item, its)):
            if i % 25 == 0 or r.get("n_err"):
                print("stage2", i, r, f"{time.time() - T0:.0f}s", flush=True)
    print("v2 done (집계는 v1 결과와 합쳐서 따로)", flush=True)

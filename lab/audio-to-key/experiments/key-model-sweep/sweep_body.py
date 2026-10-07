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

KEY_SRC = None  # build.py가 채움
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


GT3 = {  # lab/_common/experiments/audio-analysis-test/LOG.md 6번
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


def summarize():
    rows = [json.load(open(f)) for f in sorted(glob.glob(f"{OUT}/songs/*.json"))]
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


if __name__ == "__main__":
    sh = lambda c: subprocess.run(c, shell=True)
    pip = f"{sys.executable} -m pip install -q"
    sh(f"{pip} cython numpy soundfile demucs essentia > /kaggle/working/pip.log 2>&1")
    sh(f"{pip} --no-build-isolation 'git+https://github.com/CPJKU/madmom' >> /kaggle/working/pip.log 2>&1")
    selftest()
    its = items()
    print("items", {s: sum(i["set"] == s for i in its) for s in ("synth", "gt3", "w500")}, flush=True)
    stage1(its)
    print(f"stage1 done {time.time() - T0:.0f}s", flush=True)
    from multiprocessing import get_context
    with get_context("fork").Pool(4, maxtasksperchild=25) as pool:
        for i, r in enumerate(pool.imap_unordered(run_item, its)):
            if i % 25 == 0 or r.get("n_err"):
                print("stage2", i, r, f"{time.time() - T0:.0f}s", flush=True)
    summarize()

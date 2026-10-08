"""BPM·beat 방법 일괄 시험. build.py가 GROUP과 bpm-pipeline/kaggle/bpm.py 사본(BPM_SRC)을 넣어 kaggle-a/b/c/s/sweep.py를 만든다.

GROUP A (GPU): beatthis_final0, beatthis_small0, beatthis_final0_dbn, deeprhythm, allin1
GROUP B (CPU): madmom_dbn (RNN beat + RNN downbeat + DBN), madmom_tempo, beatnet
GROUP C (CPU): librosa_beat, librosa_tempo, librosa_plp, ess_multifeature, ess_degara, ess_percival, ess_tempocnn
GROUP S (CPU): A·B·C 출력(데이터셋으로 올린 것)을 모아 채점·집계
대상: GTZAN 999클립(정답: github TempoBeatDownbeat/gtzan_tempo_beat) → 정답 3곡 → 찬양 500곡
beat를 내는 방법은 bpm.py analyze(반·두 배 통일, 안정/범위, 구간, 마디)를 같은 방식으로 적용한다.
라이선스: madmom 모델·TempoCNN 비상업, Essentia·DeepRhythm AGPL, BeatNet CC BY, Beat This!·All-In-One 코드 MIT.
"""
import glob, json, os, subprocess, sys, time, types
import numpy as np

GROUP = None    # build.py가 채움
BPM_SRC = None  # build.py가 채움
T0 = time.time()
DEADLINE = 10.5 * 3600
OUT, TMP = "/kaggle/working/out", "/kaggle/temp"
SR = 44100
km = types.ModuleType("bpmpipe")
exec(compile(BPM_SRC, "bpm.py", "exec"), km.__dict__)
sh = lambda c, t=None: subprocess.run(c, shell=True, timeout=t)
PIP = f"{sys.executable} -m pip install -q"


# ---------------- 입력 ----------------
def items():
    its = []
    for w in sorted(glob.glob("/kaggle/input/**/genres_original/*/*.wav", recursive=True)):
        g, n = os.path.basename(w)[:-4].split(".")
        its.append({"id": f"gtzan_{g}_{n}", "set": "gtzan", "path": w})
    for w in sorted(glob.glob("/kaggle/input/**/audio/*.wav", recursive=True)):
        n = os.path.basename(w)[:-4]
        if n in ("anointing_rejoice", "jus_return-to-lord", "markers_love-of-god"):
            its.append({"id": n, "set": "gt3", "path": w})
    sj = glob.glob("/kaggle/input/**/songs.json", recursive=True)
    if sj:
        root = os.path.dirname(sj[0])
        for s in json.load(open(sj[0])):
            src = [f for f in glob.glob(f"{root}/{s['id']}.*") if not f.endswith(".json")]
            if src:
                its.append({"id": s["id"], "set": "w500", "path": src[0], "team": s["team"], "title": s["title"]})
    return its


def wav_of(it):  # 모든 방법이 같은 44.1k mono wav를 읽음
    dst = f"{TMP}/wav/{it['id']}.wav"
    if not os.path.exists(dst):
        os.makedirs(f"{TMP}/wav", exist_ok=True)
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", it["path"], "-ac", "1", "-ar", str(SR), dst])
    return dst


def pack(beats=None, downs=None, tempo=None, extra=None):
    """방법 출력 → 공통 형식. beat가 있으면 bpm.py analyze 결과를 붙인다."""
    r = {}
    if tempo is not None:
        r["tempo"] = round(float(tempo), 2)
    if beats is not None:
        beats = np.asarray(beats, float)
        downs = np.asarray(downs if downs is not None else [], float)
        r["beats"] = [round(float(x), 3) for x in beats]
        if len(downs):
            r["downbeats"] = [round(float(x), 3) for x in downs]
        a = km.analyze(beats, downs)
        if "error" not in a:
            bars = a.pop("bars")
            run = best = 0
            for b in bars:
                run = run + 1 if b["n_beats"] == 2 else 0
                best = max(best, run)
            a["max_run2"] = best
            a.pop("tempo_curve")
        r["analysis"] = a
    if extra:
        r.update(extra)
    return r


# ---------------- 방법 ----------------
def setup():
    sh(f"{PIP} cython numpy soundfile mir_eval > /kaggle/working/pip.log 2>&1")
    if GROUP in ("A", "B"):
        sh(f"{PIP} --no-build-isolation 'git+https://github.com/CPJKU/madmom' >> /kaggle/working/pip.log 2>&1")
    if GROUP == "A":
        sh(f"{PIP} beat-this deeprhythm >> /kaggle/working/pip.log 2>&1")
        try:  # All-In-One: NATTEN 빌드가 실패하면 이 방법만 빠짐
            sh(f"{PIP} natten allin1 >> /kaggle/working/allin1_pip.log 2>&1", t=1800)
        except Exception as e:
            print("allin1 install timeout", e, flush=True)
    if GROUP == "B":
        sh(f"{PIP} --no-deps BeatNet >> /kaggle/working/pip.log 2>&1")
        os.makedirs("/kaggle/working/stub", exist_ok=True)  # BeatNet이 import하는 pyaudio(실시간용) 대역
        open("/kaggle/working/stub/pyaudio.py", "w").write("paInt16=8\nclass PyAudio:\n    def __init__(self,*a,**k): raise RuntimeError('no audio device')\n")
        sys.path.insert(0, "/kaggle/working/stub")
    if GROUP == "C":
        sh(f"{PIP} essentia-tensorflow >> /kaggle/working/pip.log 2>&1")
        sh("wget -q -O /kaggle/working/deeptemp-k16-3.pb https://essentia.upf.edu/models/tempo/tempocnn/deeptemp-k16-3.pb")


def methods_A():
    import torch
    from beat_this.inference import File2Beats
    dev = "cuda" if torch.cuda.is_available() else "cpu"
    M = {"beatthis_final0": File2Beats(checkpoint_path="final0", device=dev, dbn=False),
         "beatthis_small0": File2Beats(checkpoint_path="small0", device=dev, dbn=False)}
    out = {k: (lambda p, f=f: pack(*f(p))) for k, f in M.items()}
    try:
        f = File2Beats(checkpoint_path="final0", device=dev, dbn=True)
        out["beatthis_final0_dbn"] = lambda p: pack(*f(p))
    except Exception as e:
        print("beatthis dbn unavailable", repr(e)[:120], flush=True)
    try:
        from deeprhythm import DeepRhythmPredictor
        dr = DeepRhythmPredictor()
        def _dr(p):
            t, c = dr.predict(p, include_confidence=True)
            return pack(tempo=t, extra={"confidence": round(float(c), 3)})
        out["deeprhythm"] = _dr
    except Exception as e:
        print("deeprhythm unavailable", repr(e)[:120], flush=True)
    try:
        import allin1
        def _ai(p):
            r = allin1.analyze(p, out_dir=None, demix_dir=f"{TMP}/demix", spec_dir=f"{TMP}/spec", keep_byproducts=False)
            return pack(r.beats, r.downbeats, r.bpm, {"segments": [[round(s.start, 2), round(s.end, 2), s.label] for s in r.segments]})
        out["allin1"] = _ai
    except Exception as e:
        print("allin1 unavailable", repr(e)[:160], flush=True)
    return out


def methods_B():
    from madmom.features.beats import RNNBeatProcessor, DBNBeatTrackingProcessor
    from madmom.features.downbeats import RNNDownBeatProcessor, DBNDownBeatTrackingProcessor
    from madmom.features.tempo import TempoEstimationProcessor
    rb, db = RNNBeatProcessor(), DBNBeatTrackingProcessor(fps=100)
    rd, dd = RNNDownBeatProcessor(), DBNDownBeatTrackingProcessor(beats_per_bar=[3, 4], fps=100)
    te = TempoEstimationProcessor(fps=100)
    def _mad(p):
        act = rb(p)
        beats = db(act)
        d = dd(rd(p))
        tempi = te(act)
        return {"madmom_dbn": pack(d[:, 0], d[d[:, 1] == 1, 0], extra={"beats_only_dbn": [round(float(x), 3) for x in beats]}),
                "madmom_tempo": pack(tempo=tempi[0][0], extra={"candidates": [[round(float(t), 1), round(float(s), 3)] for t, s in tempi[:5]]})}
    out = {"_madmom": _mad}
    try:
        from BeatNet.BeatNet import BeatNet
        bn = BeatNet(1, mode="offline", inference_model="DBN", plot=[], thread=False)
        def _bn(p):
            o = bn.process(p)
            return pack(o[:, 0], o[o[:, 1] == 1, 0])
        out["beatnet"] = _bn
    except Exception as e:
        print("beatnet unavailable", repr(e)[:160], flush=True)
    return out


def methods_C():
    import librosa
    import essentia.standard as es
    def _lib(p):
        y, sr = librosa.load(p, sr=22050, mono=True)
        t, bf = librosa.beat.beat_track(y=y, sr=sr)
        oenv = librosa.onset.onset_strength(y=y, sr=sr)
        tg = librosa.feature.tempo(onset_envelope=oenv, sr=sr)[0]
        pulse = librosa.beat.plp(onset_envelope=oenv, sr=sr)
        pb = np.flatnonzero(librosa.util.localmax(pulse))
        return {"librosa_beat": pack(librosa.frames_to_time(bf, sr=sr), tempo=np.atleast_1d(t)[0]),
                "librosa_tempo": pack(tempo=tg),
                "librosa_plp": pack(librosa.frames_to_time(pb, sr=sr))}
    def _ess(p):
        a = es.MonoLoader(filename=p, sampleRate=SR)()
        o = {}
        for m in ("multifeature", "degara"):
            bpm, ticks, conf, est, _ = es.RhythmExtractor2013(method=m)(a)
            o[f"ess_{m}"] = pack(ticks, tempo=bpm, extra={"confidence": round(float(conf), 3), "candidates": [round(float(x), 1) for x in list(est)[:5]]})
        o["ess_percival"] = pack(tempo=es.PercivalBpmEstimator()(a))
        try:
            a11 = es.MonoLoader(filename=p, sampleRate=11025)()
            g, loc, _ = es.TempoCNN(graphFilename="/kaggle/working/deeptemp-k16-3.pb")(a11)
            o["ess_tempocnn"] = pack(tempo=g, extra={"local": [round(float(x), 1) for x in loc]})
        except Exception as e:
            o["_err_tempocnn"] = repr(e)[:120]
        return o
    return {"_librosa": _lib, "_essentia": _ess}


def run_item(it, M):
    if time.time() - T0 > DEADLINE:
        return None
    dst = f"{OUT}/{GROUP}/{it['set']}/{it['id']}.json"
    if os.path.exists(dst):
        return None
    p = wav_of(it)
    row = {"id": it["id"], "set": it["set"], "methods": {}, "errors": {}, "secs": {}}
    for name, fn in M.items():
        t = time.time()
        try:
            r = fn(p)
            if name.startswith("_"):  # 여러 방법을 한 번에 내는 묶음
                for k, v in r.items():
                    (row["errors"] if k.startswith("_err") else row["methods"])[k] = v
            else:
                row["methods"][name] = r
        except Exception as e:
            row["errors"][name] = repr(e)[:160]
        row["secs"][name] = round(time.time() - t, 1)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    json.dump(row, open(dst, "w"))
    if os.path.exists(p):  # 디스크 절약
        os.remove(p)
    return row


def worker_init():
    global WM
    WM = methods_B() if GROUP == "B" else methods_C()


def worker(it):
    r = run_item(it, WM)
    return (it["id"], None if r is None else (len(r["methods"]), list(r["errors"])))


# ---------------- 집계 (GROUP S) ----------------
def summarize():
    import mir_eval
    gt = "/kaggle/working/gt"
    sh(f"git clone -q --depth 1 https://github.com/TempoBeatDownbeat/gtzan_tempo_beat {gt}")
    rows = {}
    for f in glob.glob("/kaggle/input/**/*.json", recursive=True):
        if "/gtzan/" not in f and "/gt3/" not in f and "/w500/" not in f:
            continue
        r = json.load(open(f))
        cur = rows.setdefault(r["id"], {"id": r["id"], "set": r["set"], "methods": {}, "errors": {}})
        cur["methods"].update(r["methods"]); cur["errors"].update(r["errors"])
    names = sorted({n for r in rows.values() for n in r["methods"]})
    est_tempo = lambda m: (m.get("analysis") or {}).get("bpm_median") or m.get("tempo")
    near = lambda a, b: abs(a / b - 1) <= 0.04
    oct_ok = lambda a, b: any(near(a, b * f) for f in (1, 2, 0.5, 3, 1 / 3))
    S = {"n": {s: sum(r["set"] == s for r in rows.values()) for s in ("gtzan", "gt3", "w500")}, "methods": names, "gtzan": {}, "w500": {}, "agreement": {}}
    tb = mir_eval.beat.trim_beats
    for n in names:
        acc1 = acc2 = bf = dfm = mok = cnt = nb = nd = nm = 0
        fact = {}
        for r in rows.values():
            if r["set"] != "gtzan" or n not in r["methods"]:
                continue
            key = r["id"]
            try:
                ann = np.loadtxt(f"{gt}/beats/{key}.beats", ndmin=2); gtt = float(np.loadtxt(f"{gt}/tempo/{key}.bpm"))
            except Exception:
                continue
            m = r["methods"][n]; e = est_tempo(m)
            if e:
                cnt += 1; acc1 += near(e, gtt); acc2 += oct_ok(e, gtt)
                if not near(e, gtt) and oct_ok(e, gtt):
                    f = min((2, 0.5, 3, 1 / 3), key=lambda f: abs(np.log(e / gtt / f))); fact[str(round(f, 2))] = fact.get(str(round(f, 2)), 0) + 1
            if "beats" in m:
                nb += 1; bf += mir_eval.beat.f_measure(tb(ann[:, 0]), tb(np.array(m["beats"])))
            if "downbeats" in m and ann.shape[1] > 1:
                nd += 1; dfm += mir_eval.beat.f_measure(tb(ann[ann[:, 1] == 1, 0]), tb(np.array(m["downbeats"])))
                gm = int(ann[:, 1].max()); mm = (m.get("analysis") or {}).get("meter")
                nm += 1; mok += gm == mm
        if cnt:
            S["gtzan"][n] = {"n": cnt, "acc1": round(acc1 / cnt, 3), "acc2": round(acc2 / cnt, 3), "octave_factors": fact,
                             "beat_f": round(bf / nb, 3) if nb else None, "downbeat_f": round(dfm / nd, 3) if nd else None, "meter_ok": round(mok / nm, 3) if nm else None}
    W = [r for r in rows.values() if r["set"] == "w500"]
    for n in names:
        ms = [r["methods"][n] for r in W if n in r["methods"]]
        an = [m["analysis"] for m in ms if "error" not in m.get("analysis", {"error": 1})]
        tem = [est_tempo(m) for m in ms if est_tempo(m)]
        S["w500"][n] = {"n": len(ms), "tempo_median": round(float(np.median(tem)), 1) if tem else None,
                        "tempo_hist": np.histogram(tem, bins=range(40, 260, 10))[0].tolist() if tem else None,
                        "stable": round(float(np.mean([a["stable"] for a in an])), 3) if an else None,
                        "multi_section": round(float(np.mean([len(a["sections"]) > 1 for a in an])), 3) if an else None,
                        "mean_sections": round(float(np.mean([len(a["sections"]) for a in an])), 2) if an else None,
                        "run2_songs": round(float(np.mean([a.get("max_run2", 0) >= 2 for a in an if a.get("meter")])), 3) if any(a.get("meter") for a in an) else None,
                        "meter4": round(float(np.mean([a.get("meter") == 4 for a in an if a.get("meter")])), 3) if any(a.get("meter") for a in an) else None}
    for a in names:
        for b in names:
            if a >= b:
                continue
            pr = [(est_tempo(r["methods"][a]), est_tempo(r["methods"][b])) for r in W if a in r["methods"] and b in r["methods"]]
            pr = [(x, y) for x, y in pr if x and y]
            if pr:
                S["agreement"][f"{a}|{b}"] = [round(float(np.mean([near(x, y) for x, y in pr])), 3), round(float(np.mean([oct_ok(x, y) for x, y in pr])), 3), len(pr)]
    S["errors"] = {}
    for r in rows.values():
        for k in r["errors"]:
            S["errors"][k] = S["errors"].get(k, 0) + 1
    os.makedirs(OUT, exist_ok=True)
    json.dump(S, open(f"{OUT}/summary.json", "w"), indent=1)
    json.dump(list(rows.values()), open(f"{OUT}/merged.json", "w"))
    print("SUMMARY", S["n"], "errors", S["errors"], flush=True)
    for n, v in sorted(S["gtzan"].items(), key=lambda x: -x[1]["acc2"]):
        print("GTZAN", n, v, flush=True)
    for n, v in S["w500"].items():
        print("W500", n, {k: v[k] for k in v if k != "tempo_hist"}, flush=True)


if __name__ == "__main__":
    if GROUP == "S":
        sh(f"{PIP} mir_eval > /dev/null 2>&1")
        summarize(); sys.exit(0)
    setup()
    its = items()
    print("GROUP", GROUP, "items", {s: sum(i["set"] == s for i in its) for s in ("gtzan", "gt3", "w500")}, flush=True)
    if GROUP == "A":
        M = methods_A()
        print("methods", list(M), flush=True)
        for i, it in enumerate(its):
            r = run_item(it, M)
            if i % 50 == 0 or (r and r["errors"]):
                print(i, it["id"], r and (len(r["methods"]), r["errors"], r["secs"]), f"{time.time() - T0:.0f}s", flush=True)
    else:
        from multiprocessing import get_context
        with get_context("fork").Pool(4, initializer=worker_init) as pool:
            for i, r in enumerate(pool.imap_unordered(worker, its, chunksize=4)):
                if i % 100 == 0 or (r[1] and r[1][1]):
                    print(i, r, f"{time.time() - T0:.0f}s", flush=True)
    print("DONE", f"{time.time() - T0:.0f}s", flush=True)

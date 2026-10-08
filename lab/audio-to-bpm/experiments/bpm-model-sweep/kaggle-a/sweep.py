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

GROUP = "A"
BPM_SRC = '"""Audio → BPM · 박자 · 마디. Beat This!(MIT) + numpy. 비상업 라이선스 모델 없음.\n\n  python bpm.py <audio> [--feel ballad|mid|up] [-o out.json]   # 한 곡\n  python bpm.py --selftest                                     # 합성 곡 2개로 확인\n  python bpm.py                                                # Kaggle: selftest + /kaggle/input 의 모든 wav\n                                                               #   (GTZAN이 마운트돼 있으면 정확도 평가 모드,\n                                                               #    songs.json이 있으면 찬양 음원 일괄 모드)\n\n절차 (lab/audio-to-bpm/survey.md 1.7):\n 1. Beat This!(DBN 없이) → beats, downbeats\n 2. 지역 템포: 8 beat 창, 4 beat 간격, 간격 중앙값\n 3. 반·두 배 통일: 곡 기준 템포 T(지역 템포 중앙값)를 정하고 모든 지역 템포를 T와 같은 옥타브로 접음\n    T의 옥타브: --feel 이 있으면 그 중심(ballad 70 / mid 100 / up 135)에 가장 가까운 {T/2, T, 2T}\n 4. 안정 판정: 접은 지역 템포의 p90/p10 ≤ 1+STABLE → bpm 하나, 아니면 bpm_range [p10, p90]\n 5. 구간별 템포: 평활화한 템포 곡선이 현재 구간 중앙값에서 ±STABLE/2 넘게 MIN_RUN 창 연속 벗어나면 새 구간\n 6. 마디: downbeat ~ 다음 downbeat, 마디당 beat 수의 최빈값 = 박자\n출력: {bpm | null, bpm_range, stable, alternates, sections[], meter, bars[], tempo_curve[]}\n"""\nimport argparse, glob, json, os, subprocess, sys, tempfile\nfrom collections import Counter\nimport numpy as np\n\nWIN, HOP = 8, 4       # beat\nSTABLE = 0.08         # p90/p10 허용 폭 (±4%)\nMIN_RUN = 4           # 새 템포 구간으로 인정할 연속 창 수 (= 16 beat)\nFEEL = {"ballad": 70, "mid": 100, "up": 135}\n\n\ndef fold(x, ref):  # x를 ref와 같은 옥타브(ref/√2 ~ ref·√2)로\n    while x > ref * 2 ** 0.5:\n        x /= 2\n    while x < ref / 2 ** 0.5:\n        x *= 2\n    return x\n\n\ndef sections(beats, f, end):\n    n = len(f)\n    sm = np.array([np.median(f[max(0, i - 2):i + 3]) for i in range(n)])\n    tol = np.log(1 + STABLE / 2)\n    starts, out = [0], 0\n    for i in range(1, n):\n        out = out + 1 if abs(np.log(sm[i] / np.median(sm[starts[-1]:i]))) > tol else 0\n        if out >= MIN_RUN:\n            starts.append(i - MIN_RUN + 1)\n            out = 0\n    bounds = starts + [n]\n    tempi = [float(np.median(f[a:b])) for a, b in zip(bounds, bounds[1:])]\n    # 경계 다듬기: 창 시작 시각은 평활화·창 길이만큼 늦음 → 주변 beat 간격으로 앞/뒤 템포가 가장 잘 갈리는 beat\n    bpm_at = 60 / np.diff(beats)\n    cut = [0]\n    for j, w in enumerate(starts[1:], 1):\n        lo, hi = max(cut[-1] + 1, (w - 3) * HOP), min(len(bpm_at) - 1, (w + 1) * HOP)\n        cost = lambda p: (sum(np.log(fold(x, tempi[j - 1]) / tempi[j - 1]) ** 2 for x in bpm_at[max(0, p - WIN):p])\n                          + sum(np.log(fold(x, tempi[j]) / tempi[j]) ** 2 for x in bpm_at[p:p + WIN]))\n        cut.append(min(range(lo, hi + 1), key=cost) if hi >= lo else w * HOP)\n    secs = []\n    for j, bpm in enumerate(tempi):\n        t0 = float(beats[cut[j]])\n        t1 = float(beats[cut[j + 1]]) if j + 1 < len(cut) else end\n        if secs and abs(np.log(bpm / secs[-1]["bpm"])) <= tol:  # 이웃과 같은 템포면 합침\n            secs[-1]["end"] = round(t1, 1)\n            continue\n        secs.append({"start": round(t0, 1), "end": round(t1, 1), "bpm": bpm})\n    for x in secs:\n        x["bpm"] = round(x["bpm"])\n    return secs\n\n\ndef beats_of(path, device):\n    from beat_this.inference import File2Beats\n    b, d = File2Beats(checkpoint_path="final0", device=device, dbn=False)(path)\n    return np.asarray(b), np.asarray(d)\n\n\ndef analyze(beats, downs, feel=None):\n    if len(beats) < WIN + 1:\n        return {"error": "too few beats", "n_beats": len(beats)}\n    local, times = [], []\n    for i in range(0, len(beats) - WIN, HOP):\n        local.append(60 / np.median(np.diff(beats[i:i + WIN + 1])))\n        times.append(float(beats[i]))\n    T = float(np.median(local))\n    if feel:\n        T = min((T / 2, T, T * 2), key=lambda c: abs(np.log(c / FEEL[feel])))\n    folded = np.array([fold(x, T) for x in local])\n    lo, mid, hi = np.percentile(folded, [10, 50, 90])\n    stable = hi / lo <= 1 + STABLE\n    bars = []\n    for a, b in zip(downs[:-1], downs[1:]):\n        bars.append({"start": round(float(a), 2), "end": round(float(b), 2),\n                     "n_beats": int(((beats >= a - 0.05) & (beats < b - 0.05)).sum())})\n    meter = Counter(x["n_beats"] for x in bars).most_common(1)[0][0] if bars else None\n    return {\n        "bpm": round(float(mid)) if stable else None,\n        "bpm_range": [round(float(lo)), round(float(hi))],\n        "bpm_median": round(float(mid), 1),\n        "stable": bool(stable),\n        "alternates": [round(float(mid) / 2), round(float(mid) * 2)],\n        "sections": sections(beats, folded, round(float(beats[-1]), 1)),\n        "feel": feel,\n        "meter": meter,\n        "n_bars": len(bars),\n        "odd_bars": sum(x["n_beats"] != meter for x in bars),\n        "pickup_beats": int((beats < downs[0] - 0.05).sum()) if len(downs) else None,\n        "octave_flips": int(sum(abs(np.log2(f / x)) > 0.5 for f, x in zip(folded, local))),\n        "tempo_curve": [[round(t, 1), round(float(f), 1)] for t, f in zip(times, folded)],\n        "bars": bars,\n    }\n\n\n# ---- selftest: 합성 드럼 + 화음(마디마다 바뀜)\nSR = 44100\n\n\ndef synth(bpms, bars_each=12):\n    rng = np.random.default_rng(0)\n    out = []\n    for bpm in bpms:\n        beat = 60 / bpm\n        n = int(4 * beat * SR)\n        t = np.arange(n) / SR\n        for bar in range(bars_each):\n            x = 0.05 * sum(np.sin(2 * np.pi * 220 * 2 ** (s / 12) * t) for s in [(0, 4, 7), (7, 11, 14), (9, 12, 16), (5, 9, 12)][bar % 4])\n            for k in range(8):  # 8분음표\n                tk = t - k * beat / 2\n                on = tk >= 0\n                env = lambda r: np.where(on, np.exp(-np.clip(tk, 0, None) * r), 0)\n                x = x + 0.15 * rng.standard_normal(n) * env(80)                     # 하이햇\n                if k in (0, 4):\n                    x = x + (1.0 if k == 0 else 0.7) * np.sin(2 * np.pi * 55 * tk) * env(25)  # 킥 (1박 강하게)\n                if k in (2, 6):\n                    x = x + 0.5 * rng.standard_normal(n) * env(30)                  # 스네어\n            out.append(x)\n    return np.concatenate(out).astype(np.float32)\n\n\ndef selftest(device, out=None):\n    import soundfile as sf\n    res = {}\n    for name, bpms in (("steady72", [72]), ("change120to96", [120, 96])):\n        path = os.path.join(tempfile.gettempdir(), f"{name}.wav")\n        sf.write(path, synth(bpms), SR)\n        b, d = beats_of(path, device)\n        r = analyze(b, d)\n        r.pop("bars")\n        r["beats"] = [round(float(x), 3) for x in b]  # 진단용\n        r["downbeats"] = [round(float(x), 3) for x in d]\n        res[name] = r\n        print(name, json.dumps({k: v for k, v in r.items() if k not in ("beats", "downbeats", "tempo_curve")}), flush=True)\n    if out:\n        json.dump(res, open(out, "w"), indent=1)\n    s, c = res["steady72"], res["change120to96"]\n    assert s["stable"] and any(abs(s["bpm"] - v) <= 2 for v in (72, 144)), s\n    assert not c["stable"], c\n    sec = c["sections"]  # Beat This!는 급격한 템포 전환을 3–5초 늦게 따라감 → 오디오 경로는 구간 수·비율만 확인\n    assert len(sec) == 2 and abs(sec[1]["bpm"] / sec[0]["bpm"] - 0.8) < 0.04, sec\n    # 구간 나누기 로직: 모델 없이 정확한 beat로 경계 24±1초\n    b = np.r_[np.arange(0, 24, 0.5), 24 + np.arange(0, 30, 0.625)]\n    sec = analyze(b, b[::4])["sections"]\n    assert len(sec) == 2 and abs(sec[0]["end"] - 24) <= 1 and (sec[0]["bpm"], sec[1]["bpm"]) == (120, 96), sec\n    print("SELFTEST OK", flush=True)\n    return res\n\n\ndef gtzan_eval(wavs, device, out):\n    """GTZAN 1,000클립(30초) × 정답(github TempoBeatDownbeat/gtzan_tempo_beat): tempo Acc1/Acc2, beat·downbeat F, 박자."""\n    import mir_eval\n    gt = "/kaggle/working/gt"\n    subprocess.run(f"git clone -q --depth 1 https://github.com/TempoBeatDownbeat/gtzan_tempo_beat {gt}", shell=True)\n    rows = []\n    for wav in wavs:\n        genre, num = os.path.basename(wav)[:-4].split(".")\n        key = f"gtzan_{genre}_{num}"\n        if not os.path.exists(f"{gt}/beats/{key}.beats"):\n            continue\n        try:\n            ann = np.loadtxt(f"{gt}/beats/{key}.beats", ndmin=2)\n            has_pos = ann.shape[1] > 1  # 일부 정답은 beat 위치(마디 안 몇 번째 박) 열이 없음\n            gt_b = ann[:, 0]\n            gt_d = ann[ann[:, 1] == 1, 0] if has_pos else np.array([])\n            gt_meter = int(ann[:, 1].max()) if has_pos else None\n            gt_tempo = float(np.loadtxt(f"{gt}/tempo/{key}.bpm"))\n            b, d = beats_of(wav, device)\n            r = analyze(b, d)\n        except Exception as e:  # 깨진 파일(jazz.00054 등)·정답 형식 문제\n            rows.append({"clip": key, "genre": genre, "error": repr(e)[:100]})\n            continue\n        if "error" in r:\n            rows.append({"clip": key, "genre": genre, "error": r["error"]})\n            continue\n        est = r["bpm_median"]\n        ratio = est / gt_tempo\n        tb = mir_eval.beat.trim_beats\n        rows.append({\n            "clip": key, "genre": genre, "gt_tempo": round(gt_tempo, 1), "est": est,\n            "stable": r["stable"], "n_sections": len(r["sections"]),\n            "acc1": abs(ratio - 1) <= 0.04,\n            "acc2": any(abs(ratio / f - 1) <= 0.04 for f in (1, 2, 0.5, 3, 1 / 3)),\n            "beat_f": round(mir_eval.beat.f_measure(tb(gt_b), tb(b)), 3),\n            "downbeat_f": round(mir_eval.beat.f_measure(tb(gt_d), tb(d)), 3) if len(gt_d) > 1 else None,\n            "gt_meter": gt_meter, "meter": r["meter"], "meter_ok": (gt_meter == r["meter"]) if gt_meter else None,\n        })\n    json.dump(rows, open(f"{out}/gtzan_rows.json", "w"), indent=1)\n    ok = [x for x in rows if "error" not in x]\n    def summ(xs):\n        m = lambda k: round(float(np.mean([x[k] for x in xs if x[k] is not None])), 3)\n        return {"n": len(xs), "acc1": m("acc1"), "acc2": m("acc2"), "beat_f": m("beat_f"),\n                "downbeat_f": m("downbeat_f"), "meter_ok": m("meter_ok"), "stable": m("stable")}\n    summary = {"all": summ(ok), "errors": len(rows) - len(ok),\n               "by_genre": {g: summ([x for x in ok if x["genre"] == g]) for g in sorted({x["genre"] for x in ok})}}\n    json.dump(summary, open(f"{out}/gtzan_summary.json", "w"), indent=1)\n    print("GTZAN", json.dumps(summary), flush=True)\n\n\ndef worship_batch(songs_json, device, out):\n    """lab/_common/datasets/audio-500: webm/m4a → ffmpeg wav(임시) → beats → analyze. 정답 없음."""\n    root = os.path.dirname(songs_json)\n    tmp = "/kaggle/temp/wav"\n    os.makedirs(tmp, exist_ok=True)\n    rows = []\n    songs = json.load(open(songs_json))\n    for i, s in enumerate(songs):\n        src = [f for f in glob.glob(f"{root}/{s[\'id\']}.*") if not f.endswith(".json")]\n        if not src:\n            continue\n        wav = f"{tmp}/{s[\'id\']}.wav"\n        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", src[0], "-ac", "1", "-ar", "44100", wav])\n        try:\n            r = analyze(*beats_of(wav, device))\n        except Exception as e:\n            r = {"error": repr(e)[:120]}\n        if os.path.exists(wav):\n            os.remove(wav)\n        rows.append({"id": s["id"], "team": s["team"], "title": s["title"], "duration": s["duration"], **r})\n        if i % 50 == 0:\n            print(f"{i}/{len(songs)}", s["team"], r.get("bpm"), r.get("bpm_range"), flush=True)\n    json.dump(rows, open(f"{out}/worship500.json", "w"), ensure_ascii=False)\n    ok = [x for x in rows if "error" not in x]\n    print("WORSHIP", json.dumps({"n": len(rows), "ok": len(ok), "stable": sum(x["stable"] for x in ok),\n                                 "multi_section": sum(len(x["sections"]) > 1 for x in ok),\n                                 "meter": dict(Counter(x["meter"] for x in ok))}), flush=True)\n\n\ndef kaggle():\n    out = "/kaggle/working/out"\n    os.makedirs(out, exist_ok=True)\n    subprocess.run(f"{sys.executable} -m pip install -q beat-this soundfile mir_eval", shell=True)\n    import torch\n    device = "cuda" if torch.cuda.is_available() else "cpu"\n    print("device", device, flush=True)\n    try:\n        selftest(device, f"{out}/selftest.json")\n    except AssertionError as e:\n        print("SELFTEST FAIL", e, flush=True)\n    sj = glob.glob("/kaggle/input/**/songs.json", recursive=True)\n    if sj:\n        return worship_batch(sj[0], device, out)\n    gtzan = sorted(glob.glob("/kaggle/input/**/genres_original/*/*.wav", recursive=True))\n    if gtzan:\n        return gtzan_eval(gtzan, device, out)\n    for wav in sorted(glob.glob("/kaggle/input/**/*.wav", recursive=True)):\n        name = os.path.basename(wav)[:-4]\n        b, d = beats_of(wav, device)\n        for feel in (None,):  # 결정 2: 우선 auto만\n            r = {"file": name, **analyze(b, d, feel)}\n            json.dump(r, open(f"{out}/{name}.{feel or \'auto\'}.json", "w"), indent=1)\n            print(name, feel or "auto", r.get("bpm"), r.get("bpm_range"),\n                  [(x["start"], x["bpm"]) for x in r.get("sections", [])], "meter", r.get("meter"),\n                  "bars", r.get("n_bars"), "odd", r.get("odd_bars"), "flips", r.get("octave_flips"), flush=True)\n\n\nif __name__ == "__main__":\n    if len(sys.argv) == 1 and os.path.isdir("/kaggle/input"):\n        kaggle()\n    else:\n        ap = argparse.ArgumentParser()\n        ap.add_argument("audio", nargs="?")\n        ap.add_argument("--feel", choices=list(FEEL))\n        ap.add_argument("--device", default="cuda")\n        ap.add_argument("--selftest", action="store_true")\n        ap.add_argument("-o")\n        a = ap.parse_args()\n        if a.selftest:\n            selftest(a.device)\n        else:\n            r = analyze(*beats_of(a.audio, a.device), a.feel)\n            s = json.dumps(r, indent=1)\n            open(a.o, "w").write(s) if a.o else print(s)\n'
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

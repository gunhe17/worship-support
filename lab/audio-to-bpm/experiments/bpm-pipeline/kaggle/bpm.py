"""Audio → BPM · 박자 · 마디. Beat This!(MIT) + numpy. 비상업 라이선스 모델 없음.

  python bpm.py <audio> [--feel ballad|mid|up] [-o out.json]   # 한 곡
  python bpm.py --selftest                                     # 합성 곡 2개로 확인
  python bpm.py                                                # Kaggle: selftest + /kaggle/input 의 모든 wav
                                                               #   (GTZAN이 마운트돼 있으면 정확도 평가 모드,
                                                               #    songs.json이 있으면 찬양 음원 일괄 모드)

절차 (lab/audio-to-bpm/survey.md 1.7):
 1. Beat This!(DBN 없이) → beats, downbeats
 2. 지역 템포: 8 beat 창, 4 beat 간격, 간격 중앙값
 3. 반·두 배 통일: 곡 기준 템포 T(지역 템포 중앙값)를 정하고 모든 지역 템포를 T와 같은 옥타브로 접음
    T의 옥타브: --feel 이 있으면 그 중심(ballad 70 / mid 100 / up 135)에 가장 가까운 {T/2, T, 2T}
 4. 안정 판정: 접은 지역 템포의 p90/p10 ≤ 1+STABLE → bpm 하나, 아니면 bpm_range [p10, p90]
 5. 구간별 템포: 평활화한 템포 곡선이 현재 구간 중앙값에서 ±STABLE/2 넘게 MIN_RUN 창 연속 벗어나면 새 구간
 6. 마디: downbeat ~ 다음 downbeat, 마디당 beat 수의 최빈값 = 박자
출력: {bpm | null, bpm_range, stable, alternates, sections[], meter, bars[], tempo_curve[]}
"""
import argparse, glob, json, os, subprocess, sys, tempfile
from collections import Counter
import numpy as np

WIN, HOP = 8, 4       # beat
STABLE = 0.08         # p90/p10 허용 폭 (±4%)
MIN_RUN = 4           # 새 템포 구간으로 인정할 연속 창 수 (= 16 beat)
FEEL = {"ballad": 70, "mid": 100, "up": 135}


def fold(x, ref):  # x를 ref와 같은 옥타브(ref/√2 ~ ref·√2)로
    while x > ref * 2 ** 0.5:
        x /= 2
    while x < ref / 2 ** 0.5:
        x *= 2
    return x


def sections(beats, f, end):
    n = len(f)
    sm = np.array([np.median(f[max(0, i - 2):i + 3]) for i in range(n)])
    tol = np.log(1 + STABLE / 2)
    starts, out = [0], 0
    for i in range(1, n):
        out = out + 1 if abs(np.log(sm[i] / np.median(sm[starts[-1]:i]))) > tol else 0
        if out >= MIN_RUN:
            starts.append(i - MIN_RUN + 1)
            out = 0
    bounds = starts + [n]
    tempi = [float(np.median(f[a:b])) for a, b in zip(bounds, bounds[1:])]
    # 경계 다듬기: 창 시작 시각은 평활화·창 길이만큼 늦음 → 주변 beat 간격으로 앞/뒤 템포가 가장 잘 갈리는 beat
    bpm_at = 60 / np.diff(beats)
    cut = [0]
    for j, w in enumerate(starts[1:], 1):
        lo, hi = max(cut[-1] + 1, (w - 3) * HOP), min(len(bpm_at) - 1, (w + 1) * HOP)
        cost = lambda p: (sum(np.log(fold(x, tempi[j - 1]) / tempi[j - 1]) ** 2 for x in bpm_at[max(0, p - WIN):p])
                          + sum(np.log(fold(x, tempi[j]) / tempi[j]) ** 2 for x in bpm_at[p:p + WIN]))
        cut.append(min(range(lo, hi + 1), key=cost) if hi >= lo else w * HOP)
    secs = []
    for j, bpm in enumerate(tempi):
        t0 = float(beats[cut[j]])
        t1 = float(beats[cut[j + 1]]) if j + 1 < len(cut) else end
        if secs and abs(np.log(bpm / secs[-1]["bpm"])) <= tol:  # 이웃과 같은 템포면 합침
            secs[-1]["end"] = round(t1, 1)
            continue
        secs.append({"start": round(t0, 1), "end": round(t1, 1), "bpm": bpm})
    for x in secs:
        x["bpm"] = round(x["bpm"])
    return secs


def beats_of(path, device):
    from beat_this.inference import File2Beats
    b, d = File2Beats(checkpoint_path="final0", device=device, dbn=False)(path)
    return np.asarray(b), np.asarray(d)


def analyze(beats, downs, feel=None):
    if len(beats) < WIN + 1:
        return {"error": "too few beats", "n_beats": len(beats)}
    local, times = [], []
    for i in range(0, len(beats) - WIN, HOP):
        local.append(60 / np.median(np.diff(beats[i:i + WIN + 1])))
        times.append(float(beats[i]))
    T = float(np.median(local))
    if feel:
        T = min((T / 2, T, T * 2), key=lambda c: abs(np.log(c / FEEL[feel])))
    folded = np.array([fold(x, T) for x in local])
    lo, mid, hi = np.percentile(folded, [10, 50, 90])
    stable = hi / lo <= 1 + STABLE
    bars = []
    for a, b in zip(downs[:-1], downs[1:]):
        bars.append({"start": round(float(a), 2), "end": round(float(b), 2),
                     "n_beats": int(((beats >= a - 0.05) & (beats < b - 0.05)).sum())})
    meter = Counter(x["n_beats"] for x in bars).most_common(1)[0][0] if bars else None
    return {
        "bpm": round(float(mid)) if stable else None,
        "bpm_range": [round(float(lo)), round(float(hi))],
        "bpm_median": round(float(mid), 1),
        "stable": bool(stable),
        "alternates": [round(float(mid) / 2), round(float(mid) * 2)],
        "sections": sections(beats, folded, round(float(beats[-1]), 1)),
        "feel": feel,
        "meter": meter,
        "n_bars": len(bars),
        "odd_bars": sum(x["n_beats"] != meter for x in bars),
        "pickup_beats": int((beats < downs[0] - 0.05).sum()) if len(downs) else None,
        "octave_flips": int(sum(abs(np.log2(f / x)) > 0.5 for f, x in zip(folded, local))),
        "tempo_curve": [[round(t, 1), round(float(f), 1)] for t, f in zip(times, folded)],
        "bars": bars,
    }


# ---- selftest: 합성 드럼 + 화음(마디마다 바뀜)
SR = 44100


def synth(bpms, bars_each=12):
    rng = np.random.default_rng(0)
    out = []
    for bpm in bpms:
        beat = 60 / bpm
        n = int(4 * beat * SR)
        t = np.arange(n) / SR
        for bar in range(bars_each):
            x = 0.05 * sum(np.sin(2 * np.pi * 220 * 2 ** (s / 12) * t) for s in [(0, 4, 7), (7, 11, 14), (9, 12, 16), (5, 9, 12)][bar % 4])
            for k in range(8):  # 8분음표
                tk = t - k * beat / 2
                on = tk >= 0
                env = lambda r: np.where(on, np.exp(-np.clip(tk, 0, None) * r), 0)
                x = x + 0.15 * rng.standard_normal(n) * env(80)                     # 하이햇
                if k in (0, 4):
                    x = x + (1.0 if k == 0 else 0.7) * np.sin(2 * np.pi * 55 * tk) * env(25)  # 킥 (1박 강하게)
                if k in (2, 6):
                    x = x + 0.5 * rng.standard_normal(n) * env(30)                  # 스네어
            out.append(x)
    return np.concatenate(out).astype(np.float32)


def selftest(device, out=None):
    import soundfile as sf
    res = {}
    for name, bpms in (("steady72", [72]), ("change120to96", [120, 96])):
        path = os.path.join(tempfile.gettempdir(), f"{name}.wav")
        sf.write(path, synth(bpms), SR)
        b, d = beats_of(path, device)
        r = analyze(b, d)
        r.pop("bars")
        r["beats"] = [round(float(x), 3) for x in b]  # 진단용
        r["downbeats"] = [round(float(x), 3) for x in d]
        res[name] = r
        print(name, json.dumps({k: v for k, v in r.items() if k not in ("beats", "downbeats", "tempo_curve")}), flush=True)
    if out:
        json.dump(res, open(out, "w"), indent=1)
    s, c = res["steady72"], res["change120to96"]
    assert s["stable"] and any(abs(s["bpm"] - v) <= 2 for v in (72, 144)), s
    assert not c["stable"], c
    sec = c["sections"]  # Beat This!는 급격한 템포 전환을 3–5초 늦게 따라감 → 오디오 경로는 구간 수·비율만 확인
    assert len(sec) == 2 and abs(sec[1]["bpm"] / sec[0]["bpm"] - 0.8) < 0.04, sec
    # 구간 나누기 로직: 모델 없이 정확한 beat로 경계 24±1초
    b = np.r_[np.arange(0, 24, 0.5), 24 + np.arange(0, 30, 0.625)]
    sec = analyze(b, b[::4])["sections"]
    assert len(sec) == 2 and abs(sec[0]["end"] - 24) <= 1 and (sec[0]["bpm"], sec[1]["bpm"]) == (120, 96), sec
    print("SELFTEST OK", flush=True)
    return res


def gtzan_eval(wavs, device, out):
    """GTZAN 1,000클립(30초) × 정답(github TempoBeatDownbeat/gtzan_tempo_beat): tempo Acc1/Acc2, beat·downbeat F, 박자."""
    import mir_eval
    gt = "/kaggle/working/gt"
    subprocess.run(f"git clone -q --depth 1 https://github.com/TempoBeatDownbeat/gtzan_tempo_beat {gt}", shell=True)
    rows = []
    for wav in wavs:
        genre, num = os.path.basename(wav)[:-4].split(".")
        key = f"gtzan_{genre}_{num}"
        if not os.path.exists(f"{gt}/beats/{key}.beats"):
            continue
        try:
            ann = np.loadtxt(f"{gt}/beats/{key}.beats", ndmin=2)
            has_pos = ann.shape[1] > 1  # 일부 정답은 beat 위치(마디 안 몇 번째 박) 열이 없음
            gt_b = ann[:, 0]
            gt_d = ann[ann[:, 1] == 1, 0] if has_pos else np.array([])
            gt_meter = int(ann[:, 1].max()) if has_pos else None
            gt_tempo = float(np.loadtxt(f"{gt}/tempo/{key}.bpm"))
            b, d = beats_of(wav, device)
            r = analyze(b, d)
        except Exception as e:  # 깨진 파일(jazz.00054 등)·정답 형식 문제
            rows.append({"clip": key, "genre": genre, "error": repr(e)[:100]})
            continue
        if "error" in r:
            rows.append({"clip": key, "genre": genre, "error": r["error"]})
            continue
        est = r["bpm_median"]
        ratio = est / gt_tempo
        tb = mir_eval.beat.trim_beats
        rows.append({
            "clip": key, "genre": genre, "gt_tempo": round(gt_tempo, 1), "est": est,
            "stable": r["stable"], "n_sections": len(r["sections"]),
            "acc1": abs(ratio - 1) <= 0.04,
            "acc2": any(abs(ratio / f - 1) <= 0.04 for f in (1, 2, 0.5, 3, 1 / 3)),
            "beat_f": round(mir_eval.beat.f_measure(tb(gt_b), tb(b)), 3),
            "downbeat_f": round(mir_eval.beat.f_measure(tb(gt_d), tb(d)), 3) if len(gt_d) > 1 else None,
            "gt_meter": gt_meter, "meter": r["meter"], "meter_ok": (gt_meter == r["meter"]) if gt_meter else None,
        })
    json.dump(rows, open(f"{out}/gtzan_rows.json", "w"), indent=1)
    ok = [x for x in rows if "error" not in x]
    def summ(xs):
        m = lambda k: round(float(np.mean([x[k] for x in xs if x[k] is not None])), 3)
        return {"n": len(xs), "acc1": m("acc1"), "acc2": m("acc2"), "beat_f": m("beat_f"),
                "downbeat_f": m("downbeat_f"), "meter_ok": m("meter_ok"), "stable": m("stable")}
    summary = {"all": summ(ok), "errors": len(rows) - len(ok),
               "by_genre": {g: summ([x for x in ok if x["genre"] == g]) for g in sorted({x["genre"] for x in ok})}}
    json.dump(summary, open(f"{out}/gtzan_summary.json", "w"), indent=1)
    print("GTZAN", json.dumps(summary), flush=True)


def worship_batch(songs_json, device, out):
    """lab/_common/datasets/audio-500: webm/m4a → ffmpeg wav(임시) → beats → analyze. 정답 없음."""
    root = os.path.dirname(songs_json)
    tmp = "/kaggle/temp/wav"
    os.makedirs(tmp, exist_ok=True)
    rows = []
    songs = json.load(open(songs_json))
    for i, s in enumerate(songs):
        src = [f for f in glob.glob(f"{root}/{s['id']}.*") if not f.endswith(".json")]
        if not src:
            continue
        wav = f"{tmp}/{s['id']}.wav"
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", src[0], "-ac", "1", "-ar", "44100", wav])
        try:
            r = analyze(*beats_of(wav, device))
        except Exception as e:
            r = {"error": repr(e)[:120]}
        if os.path.exists(wav):
            os.remove(wav)
        rows.append({"id": s["id"], "team": s["team"], "title": s["title"], "duration": s["duration"], **r})
        if i % 50 == 0:
            print(f"{i}/{len(songs)}", s["team"], r.get("bpm"), r.get("bpm_range"), flush=True)
    json.dump(rows, open(f"{out}/worship500.json", "w"), ensure_ascii=False)
    ok = [x for x in rows if "error" not in x]
    print("WORSHIP", json.dumps({"n": len(rows), "ok": len(ok), "stable": sum(x["stable"] for x in ok),
                                 "multi_section": sum(len(x["sections"]) > 1 for x in ok),
                                 "meter": dict(Counter(x["meter"] for x in ok))}), flush=True)


def kaggle():
    out = "/kaggle/working/out"
    os.makedirs(out, exist_ok=True)
    subprocess.run(f"{sys.executable} -m pip install -q beat-this soundfile mir_eval", shell=True)
    import torch
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print("device", device, flush=True)
    try:
        selftest(device, f"{out}/selftest.json")
    except AssertionError as e:
        print("SELFTEST FAIL", e, flush=True)
    sj = glob.glob("/kaggle/input/**/songs.json", recursive=True)
    if sj:
        return worship_batch(sj[0], device, out)
    gtzan = sorted(glob.glob("/kaggle/input/**/genres_original/*/*.wav", recursive=True))
    if gtzan:
        return gtzan_eval(gtzan, device, out)
    for wav in sorted(glob.glob("/kaggle/input/**/*.wav", recursive=True)):
        name = os.path.basename(wav)[:-4]
        b, d = beats_of(wav, device)
        for feel in (None,):  # 결정 2: 우선 auto만
            r = {"file": name, **analyze(b, d, feel)}
            json.dump(r, open(f"{out}/{name}.{feel or 'auto'}.json", "w"), indent=1)
            print(name, feel or "auto", r.get("bpm"), r.get("bpm_range"),
                  [(x["start"], x["bpm"]) for x in r.get("sections", [])], "meter", r.get("meter"),
                  "bars", r.get("n_bars"), "odd", r.get("odd_bars"), "flips", r.get("octave_flips"), flush=True)


if __name__ == "__main__":
    if len(sys.argv) == 1 and os.path.isdir("/kaggle/input"):
        kaggle()
    else:
        ap = argparse.ArgumentParser()
        ap.add_argument("audio", nargs="?")
        ap.add_argument("--feel", choices=list(FEEL))
        ap.add_argument("--device", default="cuda")
        ap.add_argument("--selftest", action="store_true")
        ap.add_argument("-o")
        a = ap.parse_args()
        if a.selftest:
            selftest(a.device)
        else:
            r = analyze(*beats_of(a.audio, a.device), a.feel)
            s = json.dumps(r, indent=1)
            open(a.o, "w").write(s) if a.o else print(s)



# ================= gt-sweep: 정답 있는 전곡 세트 (build.py가 bpm-model-sweep의 sweep_body.py 뒤에 붙인다) =================
# RWC-G 27곡(팝·록·댄스, 어느 모델도 학습하지 않음) · RWC-P 100곡(Beat This!·madmom 학습) · Slakh2100 템포 변화 150곡(MIDI 합성)
# 음원은 커널 안에서 받는다 (계정마다 커널을 나눠 돌리므로 비공개 데이터셋을 공유할 수 없다).
import random, shutil, tarfile
DATA, ANN = "/kaggle/temp/data", "/kaggle/temp/rwc-annotations"
RWC = "https://zenodo.org/records/18656623/files"  # RWC Music Database 2.0, CC BY-NC 4.0
SLK = "https://huggingface.co/datasets/projectlosangeles/Slakh2100/resolve/main"  # Slakh2100 redux 16 kHz, CC BY 4.0
N_CHANGE, N_CONST = 100, 50


ONLY = None  # 다시 잴 곡 id. None이면 전부 (채점 커널은 이전 출력에 없는 곡만 다시 잰다)
want = lambda i: ONLY is None or i in ONLY


def rwc_items():
    if not os.path.exists(ANN):
        sh(f"git clone -q --depth 1 https://github.com/rwc-music/rwc-annotations {ANN}")
    its = []
    for coll, ids in (("G", range(1, 28)), ("P", range(1, 101))):
        for i in ids:
            rid = f"RWC_{coll}{i:03d}"
            b = np.loadtxt(f"{ANN}/01_annotations_preprocessed/beats/RWC-{coll}/{rid}.csv", delimiter=";", skiprows=1, ndmin=2)
            its.append({"id": rid, "set": f"rwc-{coll.lower()}", "path": f"{DATA}/rwc/{rid}.wav",
                        "gt_beats": b[:, 0].tolist(), "gt_downs": b[b[:, 1] == 1, 0].tolist()})
    return its


def fetch_rwc(its):
    os.makedirs(f"{DATA}/rwc", exist_ok=True)
    miss = [it["id"] for it in its if it["set"].startswith("rwc") and want(it["id"]) and not os.path.exists(it["path"])]
    # RWC-P: Zenodo가 연결당 0.1–0.3 MB/s라 HF 사본(taohu/rwc-pop, 원본 WAV 100곡)을 쓴다. 정답은 공식 rwc-annotations
    if any(i.startswith("RWC_P") for i in miss):
        import pyarrow.parquet as pq
        for k in range(9):
            pf = f"{DATA}/rwc-pop-{k}.parquet"
            sh(f"curl -sL -o {pf} https://huggingface.co/datasets/taohu/rwc-pop/resolve/main/data/train-0000{k}-of-00009.parquet")
            for r in pq.read_table(pf, columns=["track_id", "audio"]).to_pylist():
                if r["track_id"] in miss:
                    open(f"{DATA}/rwc/{r['track_id']}.wav", "wb").write(r["audio"]["bytes"])
            os.remove(pf)
    # RWC-G: Zenodo뿐이라 곡마다 따로 Range 연결을 열어 동시에 받는다
    g = [i for i in miss if i.startswith("RWC_G")]
    if g:
        from remotezip import RemoteZip
        from concurrent.futures import ThreadPoolExecutor
        with RemoteZip(f"{RWC}/RWC-G.zip") as z:
            names = {os.path.basename(n)[:-4]: n for n in z.namelist() if n.endswith(".wav")}
        def get(rid):
            dst = f"{DATA}/rwc/{rid}.wav"
            for _ in range(3):
                if os.path.exists(dst):
                    return
                try:
                    with RemoteZip(f"{RWC}/RWC-G.zip") as z, z.open(names[rid]) as src, open(dst + ".part", "wb") as f:
                        shutil.copyfileobj(src, f, 1 << 20)
                    os.rename(dst + ".part", dst)
                except Exception as e:
                    print("rwc-g retry", rid, repr(e)[:100], flush=True)
        with ThreadPoolExecutor(14) as ex:
            list(ex.map(get, g))


def slakh_items():
    """MIDI 템포맵으로 고른다: 템포가 4% 넘게 바뀌는 곡 100 + 일정한 곡 50 (seed 0, 계정이 달라도 같은 곡)."""
    import pretty_midi
    root = f"{DATA}/slakh_midi"
    if not os.path.exists(root):
        os.makedirs(root)
        sh(f"curl -sL {SLK}/slakh2100_redux-mix_midis_only.tar.gz | tar xz -C {root}")
    paths = {}  # 곡마다 전체 MIDI 하나 (all_src.mid가 있으면 그것)
    for p in sorted(glob.glob(f"{root}/**/*.mid", recursive=True)):
        tid = next((x.split(".")[0] for x in p.split("/") if x.startswith("Track")), None)
        if tid and "omitted" not in p and (tid not in paths or p.endswith("all_src.mid")):
            paths[tid] = p
    change, const = [], []
    for tid, p in sorted(paths.items()):
        try:
            pm = pretty_midi.PrettyMIDI(p)
            _, tempi = pm.get_tempo_changes()
            beats, downs = pm.get_beats(), pm.get_downbeats()
        except Exception:
            continue
        # ponytail: 이상한 템포 이벤트(곡 템포의 0.55배 미만·1.8배 초과)가 있는 곡은 뺀다. 들리는 박과 MIDI 격자가 다를 수 있다
        if len(beats) < 64 or tempi.min() < 0.55 * np.median(tempi) or tempi.max() > 1.8 * np.median(tempi) or not (50 <= tempi.min() and tempi.max() <= 220):
            continue
        loc = 60 / np.array([np.median(np.diff(beats[i:i + 9])) for i in range(0, len(beats) - 8, 4)])
        r = loc.max() / loc.min()
        it = {"id": f"slakh_{tid}", "set": "slakh", "tid": tid, "path": f"{DATA}/slakh/{tid}.wav",
              "gt_beats": [round(float(x), 3) for x in beats], "gt_downs": [round(float(x), 3) for x in downs]}
        (change if r > 1.04 else const if r < 1.01 else []).append(it)
    rnd = random.Random(0)
    picks = rnd.sample(change, min(N_CHANGE, len(change))) + rnd.sample(const, min(N_CONST, len(const)))
    print("slakh midi", len(paths), "change", len(change), "const", len(const), flush=True)
    return sorted(picks, key=lambda it: it["id"])


def fetch_slakh(its):
    os.makedirs(f"{DATA}/slakh", exist_ok=True)
    miss = {it["tid"] for it in its if it["set"] == "slakh" and want(it["id"]) and not os.path.exists(it["path"])}
    if not miss:
        return
    import requests  # 16 GB 묶음을 받으면서 풀어 고른 곡의 mix.wav만 꺼낸다
    with requests.get(f"{SLK}/slakh2100_16kHz_wav_redux_mix_only.tar.gz", stream=True, timeout=60) as r:
        with tarfile.open(fileobj=r.raw, mode="r|gz") as tf:
            for m in tf:
                tid = next((x.split(".")[0] for x in m.name.split("/") if x.startswith("Track")), None)
                if tid in miss and m.name.endswith("mix.wav"):
                    with tf.extractfile(m) as src, open(f"{DATA}/slakh/{tid}.wav", "wb") as f:
                        shutil.copyfileobj(src, f, 1 << 20)
                    miss.discard(tid)
                    if not miss:
                        break


def items():
    sh(f"{PIP} remotezip pretty_midi requests pyarrow >> /kaggle/working/pip.log 2>&1")
    return rwc_items() + slakh_items()


def restore():
    """채점 커널: 이전 측정 출력(로컬로 받아 비공개 데이터셋으로 올린 것)에서 온전한 곡별 JSON을 가져온다.
    오류로 끝난 커널 버전의 출력은 kernel_sources로 붙지 않는다."""
    n = 0
    for f in glob.glob(f"/kaggle/input/**/{GROUP}/*/*.json", recursive=True):
        try:
            json.load(open(f))
        except ValueError:
            continue
        dst = f"{OUT}/{GROUP}/{os.path.basename(os.path.dirname(f))}/{os.path.basename(f)}"
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy(f, dst)
        n += 1
    print("restored", n, flush=True)


# ---------------- 채점 (각 커널이 자기 방법만) ----------------
def local_curve(beats, grid):
    """beat 간격 → BPM, 8박 이동 중앙값, grid 시각마다 값 (bpm-song 페이지 곡선과 같은 방식)."""
    beats = np.asarray(beats, float)
    if len(beats) < 10:
        return np.full(len(grid), np.nan)
    t = (beats[1:] + beats[:-1]) / 2
    v = 60 / np.diff(beats)
    v = np.array([np.median(v[max(0, i - 4):i + 4]) for i in range(len(v))])
    idx = np.clip(np.searchsorted(t, grid) - 1, 0, len(v) - 1)
    out = v[idx]
    out[(grid < beats[0]) | (grid > beats[-1])] = np.nan
    return out


def score(its):
    import mir_eval
    near = lambda a, b: abs(a / b - 1) <= 0.04
    oct_ok = lambda a, b: any(near(a, b * f) for f in (1, 2, 0.5, 3, 1 / 3))
    est_tempo = lambda m: (m.get("analysis") or {}).get("bpm_median") or m.get("tempo")
    per = {}  # set → method → 지표 목록
    for it in its:
        f = f"{OUT}/{GROUP}/{it['set']}/{it['id']}.json"
        if not os.path.exists(f):
            continue
        row = json.load(open(f))
        gb, gd = np.array(it["gt_beats"]), np.array(it["gt_downs"])
        gt_t = 60 / np.median(np.diff(gb))
        grid = np.arange(np.ceil(gb[0]), gb[-1], 1.0)
        gl = local_curve(gb, grid)
        row["gt"] = {"beats": it["gt_beats"], "downs": it["gt_downs"], "tempo": round(float(gt_t), 2)}
        row["scores"] = {}
        for n, m in row["methods"].items():
            s = {}
            e = est_tempo(m)
            if e:
                s.update(acc1=bool(near(e, gt_t)), acc2=bool(oct_ok(e, gt_t)), oe=round(float(np.log2(e / gt_t)), 3))
                el = local_curve(m["beats"], grid) if "beats" in m else np.full(len(grid), float(e))
                ok = ~np.isnan(gl) & ~np.isnan(el)
                if ok.any():
                    s["local1"] = round(float(np.mean(np.abs(el[ok] / gl[ok] - 1) <= 0.04)), 3)
                    s["local2"] = round(float(np.mean([oct_ok(a, b) for a, b in zip(el[ok], gl[ok])])), 3)
            if "beats" in m and len(m["beats"]):
                eb = np.array(m["beats"])
                s["beat_f"] = round(float(mir_eval.beat.f_measure(mir_eval.beat.trim_beats(gb), mir_eval.beat.trim_beats(eb))), 3)
                s["beat_f0"] = round(float(mir_eval.beat.f_measure(gb, eb)), 3)  # 앞 5초 포함
                _, cmlt, _, amlt = mir_eval.beat.continuity(mir_eval.beat.trim_beats(gb), mir_eval.beat.trim_beats(eb))
                s.update(cmlt=round(float(cmlt), 3), amlt=round(float(amlt), 3))
            if "downbeats" in m and len(m["downbeats"]) and len(gd):
                s["down_f"] = round(float(mir_eval.beat.f_measure(gd, np.array(m["downbeats"]))), 3)
            row["scores"][n] = s
            for k, v in s.items():
                per.setdefault(it["set"], {}).setdefault(n, {}).setdefault(k, []).append(float(v))
        json.dump(row, open(f + ".tmp", "w")); os.replace(f + ".tmp", f)  # 쓰다 멈춰도 원본이 남게
    S = {st: {n: {k: round(float(np.mean(v)), 3) for k, v in ks.items()} | {"n": len(ks.get("acc1", ks.get("beat_f", [])))}
              for n, ks in ms.items()} for st, ms in per.items()}
    json.dump(S, open(f"{OUT}/summary_{GROUP}.json", "w"), indent=1)
    for st, ms in S.items():
        for n, v in ms.items():
            print("SCORE", st, n, v, flush=True)


if __name__ == "__main__":
    setup()
    its = items()
    restore()
    need = [it for it in its if not os.path.exists(f"{OUT}/{GROUP}/{it['set']}/{it['id']}.json")]
    ONLY = {it["id"] for it in need}
    print("GROUP", GROUP, "items", len(its), "to measure", len(need), flush=True)
    t = time.time(); fetch_slakh(its); fetch_rwc(its); print("fetched", f"{time.time() - t:.0f}s", flush=True)
    need = [it for it in need if os.path.exists(it["path"])]
    if GROUP == "A":
        M = methods_A()
        print("methods", list(M), flush=True)
        for i, it in enumerate(need):
            r = run_item(it, M)
            if i % 25 == 0 or (r and r["errors"]):
                print(i, it["id"], r and (len(r["methods"]), r["errors"], r["secs"]), f"{time.time() - T0:.0f}s", flush=True)
    elif need:
        from multiprocessing import get_context
        with get_context("fork").Pool(min(4, len(need)), initializer=worker_init) as pool:
            for i, r in enumerate(pool.imap_unordered(worker, need, chunksize=2)):
                if i % 25 == 0 or (r[1] and r[1][1]):
                    print(i, r, f"{time.time() - T0:.0f}s", flush=True)
    score(its)
    print("DONE", f"{time.time() - T0:.0f}s", flush=True)

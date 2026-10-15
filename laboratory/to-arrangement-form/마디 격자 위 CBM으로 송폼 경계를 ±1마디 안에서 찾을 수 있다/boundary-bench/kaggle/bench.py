from __future__ import annotations

import io
import json
import subprocess
import sys
import time
import urllib.request
import zipfile
from pathlib import Path

import numpy as np


# #
# config

WORK = Path("/kaggle/working")
OUT = WORK / "out"
DATA = Path("/tmp/songformbench")  # 입력은 /kaggle/working 밖에: 출력에 섞이면 내려받기가 수천 파일이 된다
HARMONIX = Path("/tmp/harmonixset")
SR = 22050
HOP = 32  # as_seg 예제 값: 마디를 96칸으로 고르게 자르려고 작은 hop
SUBDIVISION = 96
FOOTE_HALF = 8  # 체커보드 커널 = 16마디
LAPLACIAN_K = 5
BOOTSTRAP = 10000
METHODS = ["grid-8bar", "foote-bar", "laplacian-bar", "cbm-modulo8", "cbm-none"]


# #
# run

def run() -> None:
    started = time.time()
    setup()
    self_check()
    import as_seg.model.errors as as_seg_errors

    songs = load_songs()
    tracker = beat_tracker()
    OUT.mkdir(parents=True, exist_ok=True)
    for index, song in enumerate(songs):
        destination = OUT / f"{song['id']}.json"
        if destination.exists():
            continue
        try:
            result = analyze(
                song=song,
                tracker=tracker,
            )
            destination.write_text(json.dumps(result))
        except (Exception, as_seg_errors.ArgumentException, as_seg_errors.AbnormalBehaviorException) as error:  # as_seg 예외는 BaseException 상속
            print("error", song["id"], repr(error)[:300], flush=True)
        if index % 25 == 0:
            print(index, song["id"], f"{time.time() - started:.0f}s", flush=True)
    summary = summarize(
        rows=[json.loads(p.read_text()) for p in sorted(OUT.glob("*.json"))],
    )
    (WORK / "summary.json").write_text(json.dumps(summary, indent=1))
    print(json.dumps(summary, indent=1), flush=True)
    print("DONE", f"{time.time() - started:.0f}s", flush=True)


# #
# setup

def setup() -> None:
    pip = f"{sys.executable} -m pip install -q"
    commands = [
        f"{pip} cython numpy as-seg mir_eval huggingface_hub beat-this",
        f"{pip} --no-build-isolation 'git+https://github.com/CPJKU/madmom'",
    ]
    for command in commands:
        subprocess.run(f"{command} >> {WORK}/pip.log 2>&1", shell=True, check=True)
    from huggingface_hub import snapshot_download

    snapshot_download(
        repo_id="ASLP-lab/SongFormBench",
        repo_type="dataset",
        local_dir=DATA,
        allow_patterns=["data/SongFormBench.jsonl", "data/audios/*"],
    )
    archive = urllib.request.urlopen("https://github.com/urinieto/harmonixset/archive/refs/heads/master.zip").read()
    zipfile.ZipFile(io.BytesIO(archive)).extractall(HARMONIX)


def self_check() -> None:
    # 채점: 정답 = 정답이면 100, 한 마디 민 경계는 같은 마디 0 · ±1마디 100
    downbeats = np.arange(49) * 2.0
    reference_bars = [0, 16, 32, 48]
    reference_seconds = [0.0, 32.0, 64.0]
    exact = score(reference_seconds=reference_seconds, end_seconds=96.0, estimate_bars=reference_bars, downbeats=downbeats)
    shifted = score(reference_seconds=reference_seconds, end_seconds=96.0, estimate_bars=[0, 17, 33, 48], downbeats=downbeats)
    assert exact["bar0"][2] == 1 and exact["bar1"][2] == 1, exact
    assert shifted["bar0"][2] == 0 and shifted["bar1"][2] == 1, shifted
    # 정렬: 첫 박이 0.0초이고 16마디마다 소리가 바뀌는 합성 곡 → CBM이 16·32를 같은 마디로 찾아야 한다 (v1 버그 재발 검사, Foote는 같은 행렬이라 출력만 본다)
    time_axis = np.arange(int(96 * SR)) / SR
    tone = lambda f: np.sin(2 * np.pi * f * time_axis) + 0.5 * np.sin(4 * np.pi * f * time_axis)
    noise = np.random.default_rng(0).standard_normal(len(time_axis)) * 0.3
    part = (time_axis // 32).astype(int)
    signal = np.where(part == 0, tone(220), np.where(part == 1, tone(330) * 0.5 + noise, noise)).astype(np.float32)
    cqt, mfcc = laplacian_features(signal=signal)
    estimates = segment(downbeats=downbeats, log_mel=log_mel_of(signal=signal), cqt=cqt, mfcc=mfcc)
    for method, bars in estimates.items():
        print("self_check", method, bars, flush=True)
    for method in ("cbm-modulo8", "cbm-none"):
        assert {16, 32} <= set(estimates[method]), (method, estimates[method])
    print("self_check ok", flush=True)


def load_songs() -> list[dict]:
    lines = (DATA / "data/SongFormBench.jsonl").read_text().splitlines()
    return [
        json.loads(line) for line in lines
    ]


def beat_tracker():
    import torch
    from beat_this.inference import File2Beats

    return File2Beats(
        checkpoint_path="final0",
        device="cuda" if torch.cuda.is_available() else "cpu",
        dbn=True,
    )


# #
# analyze

def analyze(*, song: dict, tracker) -> dict:
    import librosa

    path = DATA / song["audio_path"]
    signal, _ = librosa.load(path, sr=SR, mono=True)
    reference = [x["start"] for x in song["labels"] if x["label"] != "end"]
    end = next(x["start"] for x in song["labels"] if x["label"] == "end")
    # grid
    grids = {"beat-this": np.asarray(tracker(str(path))[1], dtype=float)}
    if song["subset"] == "HarmonixSet":
        grids["harmonix"] = harmonix_downbeats(song_id=song["id"])
    # segment
    log_mel = log_mel_of(signal=signal)
    cqt, mfcc = laplacian_features(signal=signal)
    scored = {}
    for name, downbeats in grids.items():
        downbeats = without_short_bars(downbeats=downbeats[downbeats < len(signal) / SR])
        if len(downbeats) < 9:
            continue
        estimates = segment(
            downbeats=downbeats,
            log_mel=log_mel,
            cqt=cqt,
            mfcc=mfcc,
        )
        scored[name] = {
            method: score(
                reference_seconds=reference,
                end_seconds=end,
                estimate_bars=bars,
                downbeats=downbeats,
            )
            for method, bars in estimates.items()
        }
        scored[name]["_downbeats"] = [round(float(t), 3) for t in downbeats]
    return {
        "id": song["id"],
        "subset": song["subset"],
        "duration": song["duration"],
        "grids": scored,
    }


def without_short_bars(*, downbeats: np.ndarray) -> np.ndarray:
    # 0.3초 미만 마디는 음악적으로 없다 (첫 박 중복 검출). as_seg가 이런 마디에서 예외를 던져 v2 첫 실행이 멈췄다
    kept = [downbeats[0]]
    for time_point in downbeats[1:]:
        if time_point - kept[-1] >= 0.3:
            kept.append(time_point)
    return np.asarray(kept)


def harmonix_downbeats(*, song_id: str) -> np.ndarray:
    name = song_id.split("_", 1)[1]
    rows = np.loadtxt(next(HARMONIX.glob(f"*/dataset/beats_and_downbeats/{name}.txt")))
    return rows[rows[:, 1] == 1, 0]


def log_mel_of(*, signal: np.ndarray) -> np.ndarray:
    from as_seg.model.signal_to_spectrogram import FeatureObject

    feature = FeatureObject(sr=SR, feature="log_mel", hop_length=HOP, mel_grill=True)
    return feature.get_spectrogram(signal)


def laplacian_features(*, signal: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    import librosa

    cqt = librosa.amplitude_to_db(
        np.abs(librosa.cqt(y=signal, sr=SR, bins_per_octave=36, n_bins=7 * 36)),
        ref=np.max,
    )
    mfcc = librosa.feature.mfcc(y=signal, sr=SR)
    return cqt, mfcc


def segment(*, downbeats: np.ndarray, log_mel: np.ndarray, cqt: np.ndarray, mfcc: np.ndarray) -> dict[str, list[int]]:
    import as_seg.autosimilarity_computation as similarity
    import as_seg.barwise_input as barwise
    import as_seg.CBM_algorithm as cbm

    bars = list(zip(downbeats[:-1], downbeats[1:]))
    count = len(bars)
    # as_seg는 0.0초에 시작하는 첫 마디를 무음으로 보고 빼서 마디 번호가 한 칸 앞당겨진다 (v1 버그). 1ms 늦춰 남긴다
    if bars[0][0] == 0:
        bars[0] = (1e-3, bars[0][1])
    barwise_tf = barwise.barwise_TF_matrix(log_mel, bars, HOP / SR, SUBDIVISION)
    # 끝 마디가 스펙트로그램 밖이면 as_seg가 뒤에서만 뺀다: 번호는 그대로, 끝 경계만 count로 맞춘다
    assert count - 2 <= len(barwise_tf) <= count, (len(barwise_tf), count)
    cosine = similarity.switch_autosimilarity(barwise_tf, "cosine")
    rbf = similarity.switch_autosimilarity(barwise_tf, "rbf")
    return {
        "grid-8bar": sorted(set(list(range(0, count, 8)) + [count])),
        "foote-bar": foote(ssm=cosine, count=count),
        "laplacian-bar": laplacian(downbeats=downbeats, cqt=cqt, mfcc=mfcc),
        "cbm-modulo8": frontiers(segments=cbm.compute_cbm(rbf, penalty_weight=1, penalty_func="modulo8", bands_number=7)[0], count=count),
        "cbm-none": frontiers(segments=cbm.compute_cbm(rbf, penalty_weight=0, penalty_func="modulo8", bands_number=7)[0], count=count),
    }


def frontiers(*, segments, count: int) -> list[int]:
    return sorted(
        {0, count} | {int(s) for s, _ in segments if 0 < s < count}
    )


def foote(*, ssm: np.ndarray, count: int) -> list[int]:
    import librosa

    size = len(ssm)
    sign = np.sign(np.arange(-FOOTE_HALF, FOOTE_HALF) + 0.5)
    taper = np.exp(-0.5 * (np.arange(-FOOTE_HALF, FOOTE_HALF) + 0.5) ** 2 / (FOOTE_HALF / 2) ** 2)
    kernel = np.outer(sign * taper, sign * taper)
    padded = np.pad(ssm, FOOTE_HALF, mode="constant")
    novelty = np.array([
        np.sum(kernel * padded[i:i + 2 * FOOTE_HALF, i:i + 2 * FOOTE_HALF]) for i in range(size + 1)
    ])
    novelty = np.maximum(novelty, 0) / (novelty.max() or 1)
    # 경계 사이 최소 2마디. 문헌 기본값이 아니라 이 시험에서 고정한 값
    peaks = librosa.util.peak_pick(novelty, pre_max=2, post_max=2, pre_avg=4, post_avg=4, delta=0.05, wait=2)
    return sorted(
        {0, count} | {int(p) for p in peaks if 0 < p < count}
    )


def laplacian(*, downbeats: np.ndarray, cqt: np.ndarray, mfcc: np.ndarray) -> list[int]:
    import librosa
    import scipy
    from sklearn.cluster import KMeans

    # McFee & Ellis 2014 (librosa 예제)를 박 대신 마디 노드로. 필터 크기는 박 기준 7·9를 마디 기준 3으로 줄임
    frames = librosa.time_to_frames(downbeats, sr=SR)
    cqt_sync = bar_columns(matrix=cqt, frames=frames, aggregate=np.median)
    mfcc_sync = bar_columns(matrix=mfcc, frames=frames, aggregate=np.mean)
    recurrence = librosa.segment.recurrence_matrix(cqt_sync, width=3, mode="affinity", sym=True)
    recurrence = librosa.segment.timelag_filter(scipy.ndimage.median_filter)(recurrence, size=(1, 3))
    path_distance = np.sum(np.diff(mfcc_sync, axis=1) ** 2, axis=0)
    sigma = np.median(path_distance)
    path_similarity = np.exp(-path_distance / sigma)
    path = np.diag(path_similarity, k=1) + np.diag(path_similarity, k=-1)
    degree_path = np.sum(path, axis=1)
    degree_recurrence = np.sum(recurrence, axis=1)
    mu = degree_path.dot(degree_path + degree_recurrence) / np.sum((degree_path + degree_recurrence) ** 2)
    affinity = mu * recurrence + (1 - mu) * path
    normalized = scipy.sparse.csgraph.laplacian(affinity, normed=True)
    _, vectors = scipy.linalg.eigh(normalized)
    vectors = scipy.ndimage.median_filter(vectors, size=(3, 1))
    norms = np.cumsum(vectors ** 2, axis=1) ** 0.5
    features = vectors[:, :LAPLACIAN_K] / (norms[:, LAPLACIAN_K - 1:LAPLACIAN_K] + 1e-9)
    labels = KMeans(n_clusters=LAPLACIAN_K, n_init=10, random_state=0).fit_predict(features)
    changes = 1 + np.flatnonzero(labels[1:] != labels[:-1])
    return sorted(
        {0, len(labels)} | {int(c) for c in changes}
    )


def bar_columns(*, matrix: np.ndarray, frames: np.ndarray, aggregate) -> np.ndarray:
    return np.stack(
        [aggregate(matrix[:, a:max(b, a + 1)], axis=1) for a, b in zip(frames[:-1], frames[1:])],
        axis=1,
    )


# #
# score

def score(*, reference_seconds: list[float], end_seconds: float, estimate_bars: list[int], downbeats: np.ndarray) -> dict:
    import mir_eval

    count = len(downbeats) - 1
    reference_bars = sorted(
        {0, count} | {int(np.argmin(np.abs(downbeats - t))) for t in reference_seconds}
    )
    intervals = lambda b: np.stack([np.asarray(b[:-1], dtype=float), np.asarray(b[1:], dtype=float)], axis=1)
    reference_times = sorted(set(reference_seconds) | {end_seconds})
    estimate_times = [float(downbeats[b]) for b in estimate_bars]
    measured = {}
    for key, reference, estimate, window in (
        ("bar0", reference_bars, estimate_bars, 0.5),
        ("bar1", reference_bars, estimate_bars, 1.0),
        ("s0.5", reference_times, estimate_times, 0.5),
        ("s3", reference_times, estimate_times, 3.0),
    ):
        precision, recall, f = mir_eval.segment.detection(
            intervals(reference),
            intervals(estimate),
            window=window,
            trim=True,
        )
        measured[key] = [round(precision, 4), round(recall, 4), round(f, 4)]
    measured["bars"] = estimate_bars
    measured["reference_bars"] = reference_bars
    return measured


# #
# summarize

def summarize(*, rows: list[dict]) -> dict:
    rng = np.random.default_rng(0)
    summary = {}
    for subset in ("HarmonixSet", "CN"):
        for grid in ("harmonix", "beat-this"):
            songs = [r["grids"][grid] for r in rows if r["subset"] == subset and grid in r["grids"]]
            if not songs:
                continue
            table = {}
            for method in METHODS:
                table[method] = {}
                for key in ("bar0", "bar1", "s0.5", "s3"):
                    values = np.array([s[method][key][2] for s in songs])
                    means = rng.choice(values, size=(BOOTSTRAP, len(values))).mean(axis=1)
                    table[method][key] = {
                        "f": round(float(values.mean()), 4),
                        "ci95": [round(float(np.percentile(means, 2.5)), 4), round(float(np.percentile(means, 97.5)), 4)],
                        "p": round(float(np.mean([s[method][key][0] for s in songs])), 4),
                        "r": round(float(np.mean([s[method][key][1] for s in songs])), 4),
                    }
            summary[f"{subset}/{grid}"] = {"n": len(songs), "methods": table}
    return summary


if __name__ == "__main__":
    run()

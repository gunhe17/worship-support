"""구간 하나(박·첫 박 시각) → 그 구간의 대표 템포. 박 출력은 Beat This! final0 + DBN. 표준 라이브러리만.

  from tempo import tempo
  tempo(beats, downs)  → {"bpm", "alternates": [×½, ×2], "method": "bars" | "beats"}
  python tempo.py       → 자체 확인

계산 (feature.md 구조 결정):
 1. bars: 첫 박이 3개 이상이면 마디 길이 평균 ÷ 마디당 박 수(최빈값). 길이가 중앙값 ±TOL 밖인 마디는 뺀다
 2. beats: 아니면 박 간격 평균. 간격이 중앙값 ±WIDE 밖인 것은 뺀다 (±4%로 자르면 20ms 격자 한 칸이 경계에 걸려 치우친다)
박 시각이 20ms 격자라 간격 중앙값을 쓰지 않고 평균을 낸다. 마디는 박 4개 길이라 격자 오차가 1/4로 준다.
"""
import statistics
from collections import Counter

TOL = 0.04   # 마디 길이 허용 폭
WIDE = 0.10  # 박 간격 허용 폭
EDGE = 0.05  # 박이 마디 경계에 걸칠 때 여유 (초)


def tempo(beats, downs=()):
    beats, downs = sorted(beats), sorted(downs)
    if len(beats) < 2:
        return None
    bpm, method = None, "beats"
    if len(downs) >= 3:
        bars = [(z - a, sum(a - EDGE <= t < z - EDGE for t in beats)) for a, z in zip(downs, downs[1:])]
        n = Counter(k for _, k in bars).most_common(1)[0][0]
        mid = statistics.median(L for L, _ in bars)
        keep = [L for L, _ in bars if abs(L / mid - 1) <= TOL]  # 박 하나가 빠져도 마디 길이는 첫 박으로 정해진다
        if n and keep:
            bpm, method = 60 * n * len(keep) / sum(keep), "bars"
    if bpm is None:
        iv = [b - a for a, b in zip(beats, beats[1:])]
        mid = statistics.median(iv)
        keep = [x for x in iv if abs(x / mid - 1) <= WIDE] or [mid]
        bpm = 60 * len(keep) / sum(keep)
    return {"bpm": round(bpm, 1), "alternates": [round(bpm / 2, 1), round(bpm * 2, 1)], "method": method}


if __name__ == "__main__":
    # 123.4 BPM 4/4, 박을 20ms 격자에 찍고 박 하나를 빠뜨림 → 마디·박 둘 다 ±0.5% 안
    q = lambda t: round(t / 0.02) * 0.02
    beats = [q(1 + i * 60 / 123.4) for i in range(128)]
    downs = beats[::4]
    del beats[37]
    for d in (downs, ()):
        r = tempo(beats, d)
        assert abs(r["bpm"] / 123.4 - 1) <= 0.005, r
    assert tempo(beats, downs)["method"] == "bars" and tempo(beats)["method"] == "beats"
    # 중앙값은 격자 값(120.0 또는 125.0)에 붙는다 → 평균이 필요한 이유
    iv = sorted(b - a for a, b in zip(beats, beats[1:]))
    assert abs(60 / statistics.median(iv) / 123.4 - 1) > 0.01
    # 3/4: 마디당 박 수를 세어 쓴다
    b3 = [i * 0.5 for i in range(60)]
    assert tempo(b3, b3[::3])["bpm"] == 120.0
    print("ok")

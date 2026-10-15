# 진행 기록

## 2026-10-08

### 1. v1 실행
- 커널 A·B·C 동시 push. All-In-One은 NATTEN 설치 실패 시 해당 방법만 빠지도록, BeatNet은 pyaudio 대역 모듈로 설치

### 2. 통합 결과 페이지 (BPM·key 토글)
- https://claude.ai/artifact/4NJzmUx8MGdoF53YLU19oP (비공개). 커널 A 결과(Beat This! small0·final0+DBN, DeepRhythm)까지 반영, B·C는 끝나면 추가
- 커널 A: 1.6시간에 완료(GTZAN 1,000 + 3 + 500). All-In-One은 NATTEN 빌드 실패로 제외, jazz.00054는 깨진 파일

### 3. 결과 (A 1.6시간 / B 10.6시간, 찬양 417곡 / C 끊김, 찬양 500곡) → 집계 `results/summary/out/summary.json`
- 집계 커널 `gunhe17/worship-bpm-sweep-s`: 끊긴 커널 출력은 다른 커널에 안 붙어 결과를 데이터셋 `gunhe17/worship-bpm-sweep-v1-out`으로 올려 집계. C가 쓰다 만 파일 1개(gtzan_classical_00029)는 건너뜀
- **GTZAN (약 995클립)**

| 방법 | Acc2 | Acc1 | beat F | downbeat F | 박자 |
|---|---|---|---|---|---|
| madmom RNN+DBN | **0.946** | 0.774 | 0.861 | 0.647 | **0.947** |
| madmom 템포 | 0.945 | 0.773 | – | – | – |
| Beat This! final0 (현재) | 0.943 | 0.816 | **0.891** | **0.786** | 0.780 |
| Beat This! small0 | 0.941 | 0.817 | 0.885 | 0.772 | 0.744 |
| Beat This! final0 + DBN | 0.940 | **0.827** | 0.879 | 0.775 | **0.949** |
| Essentia multifeature | 0.926 | 0.740 | 0.805 | – | – |
| DeepRhythm | 0.918 | 0.684 | – | – | – |
| Essentia degara | 0.910 | 0.720 | 0.813 | – | – |
| Essentia TempoCNN | 0.906 | 0.755 | – | – | – |
| Essentia Percival | 0.890 | 0.660 | – | – | – |
| BeatNet | 0.885 | 0.732 | 0.790 | 0.548 | 0.691 |
| librosa beat_track | 0.884 | 0.690 | 0.763 | – | – |
| librosa tempo | 0.840 | 0.662 | – | – | – |
| librosa PLP | 0.798 | 0.190 | 0.650 | – | – |

- **찬양 500곡**
  - 2박 마디가 이어진 곡: Beat This! final0 75% / small0 83% → **DBN을 붙이면 0%** (Beat This!+DBN, madmom DBN 모두). DBN이 마디 길이를 일정하게 강제하기 때문
  - 박자 4박 비율: +DBN 93.4%, madmom DBN 93.8%, final0 90.6%
  - 템포 단위: Beat This! 계열·madmom DBN 곡 중앙값 85–90(발라드를 느리게), librosa·Essentia·DeepRhythm 120–129(두 배 쪽)
  - 구간 수 평균: madmom DBN 1.87, +DBN 1.93, final0 2.07 / Essentia multifeature 4.33, degara 5.47, BeatNet 4.21, librosa PLP 11.6 (구간이 잘게 쪼개짐)
- 해석: 템포(Acc2)는 상위 5개가 0.94–0.95로 차이가 작음. **Beat This! final0 + DBN이 쟁점 6(연속 2박 마디)을 없애고 박자 정답률을 0.78 → 0.95로 올림**, 대가는 beat F −0.012, downbeat F −0.011
- DeepRhythm 자체 주장(Acc1 95.9%)은 GTZAN에서 재현되지 않음(0.684, ±4% 기준)

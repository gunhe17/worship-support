# gt-sweep LOG

## 1. 준비 (2026-10-13)
- Kaggle 시험(bpm-probe): gunhe17 T4 사용 가능, miinggu는 GPU 대기열에서 멈춰 CPU만 씀. KEY_2는 인증 실패.
- 다운로드 속도: HF 46–121 MB/s, Zenodo 0.1–0.3 MB/s → RWC-P는 HF `taohu/rwc-pop` 원본 WAV, RWC-G 27곡만 Zenodo(곡마다 Range 연결).
- Slakh: MIDI 1,710곡(omitted 제외) 중 템포 변화 292 · 일정 1,232 → seed 0으로 100 + 50.

## 2. 측정 (23:11 시작)
- A(T4) 약 42분, C(CPU) 약 1시간, B(CPU, madmom·BeatNet) 약 3시간. 세 커널 모두 측정은 끝났으나 채점에서 `TypeError: Object of type bool is not JSON serializable`(numpy bool)로 멈춤. 첫 곡(RWC_G001) 파일만 깨짐.
- 고침: `bool()` 변환, 곡별 JSON은 임시 파일에 쓴 뒤 교체. 측정 출력을 비공개 데이터셋 `<계정>/bpm-gt-sweep-out`으로 올리고 `kaggle-{a,b,c}-score`가 이어받아 빠진 곡만 다시 재고 채점.
- 오류로 끝난 커널 버전의 출력은 `kernel_sources`로 붙지 않았다. miinggu 데이터셋은 이어받기에 실패(restored 0)해 B는 277곡을 다시 쟀다(16,485초). 원인은 확인하지 않음.

## 3. 결과 (곡 평균, %)
| 방법 | RWC-G 템포 | RWC-G 구간 템포 | RWC-G 박 F | RWC-G 첫 박 F | RWC-P 박 F | Slakh 템포 | Slakh 구간 템포 | Slakh 박 F |
|---|---|---|---|---|---|---|---|---|
| Beat This! final0 | 100 | 95.4 | 96.6 | 90.4 | 99.4 | 87.3 | 83.3 | 89.9 |
| Beat This! + DBN | 100 | 96.8 | 96.6 | 93.2 | 98.8 | 88.7 | 86.9 | 90.9 |
| Beat This! small0 | 100 | 93.1 | 95.6 | 88.9 | 98.9 | 88.7 | 84.2 | 90.1 |
| madmom RNN + DBN | 100 | 98.7 | 95.1 | 87.1 | 97.2 | 84.0 | 83.2 | 89.1 |
| BeatNet | 100 | 94.6 | 88.0 | 67.7 | 88.5 | 76.7 | 74.7 | 83.7 |
| Essentia Degara | 85.2 | 83.7 | 87.8 | – | 84.6 | 70.0 | 66.9 | 80.1 |
| Essentia multifeature | 85.2 | 83.2 | 87.5 | – | 86.3 | 70.0 | 67.4 | 79.3 |
| librosa beat_track | 88.9 | 86.9 | 83.4 | – | 81.8 | 78.7 | 76.9 | 77.3 |
| librosa PLP | 0 | 2.0 | 63.2 | – | 65.2 | 3.3 | 5.3 | 58.5 |
| Essentia TempoCNN | 100 | 99.0 | – | – | – | 87.3 | 80.5 | – |
| Essentia Percival | 96.3 | 95.4 | – | – | – | 80.7 | 75.1 | – |
| DeepRhythm | 92.6 | 91.5 | – | – | – | 86.0 | 80.6 | – |
| madmom 템포 | 88.9 | 88.1 | – | – | – | 66.7 | 62.7 | – |
| librosa tempo | 81.5 | 79.4 | – | – | – | 68.7 | 65.3 | – |

- 템포 = Acc1(±4%), 반·두 배를 허용하면(Acc2) PLP를 빼고 RWC-G는 모두 100%.
- 기준 A(model=final0).beat-f1 ≥ 0.85: RWC-G 0.966 · RWC-P 0.994 · Slakh 0.899 → 성공.
- Slakh 박 F에는 합성 음원과 MIDI 사이 오프셋(재지 않음)이 섞여 있을 수 있다.
- 세트별 전체 지표(CMLt·AMLt·앞 5초 포함 박 F·반·두 배 오차)는 `results/*/out/summary_*.json`, 곡별 점수는 곡 JSON의 `scores`.

## 4. 재집계 (2026-10-14, `rescore.py` → `results/rescore.json`)
- 정답이 틀린 Slakh 4곡을 뺐다 (14개 방법이 모두 틀림): Track00112·00209·01995는 템포 정보가 없는 MIDI의 기본값 120(모든 방법 박 F ≈ 0.23), Track01533은 템포는 모두 맞았는데 박 F ≈ 0.03(오프셋). Slakh 146곡 = 템포 변화 97 + 일정 49.
- 비교는 모두 Beat This! final0 기준, 곡 단위로 짝지었다. 템포 Acc1은 정확 McNemar, 구간 템포와 박 F는 짝 부트스트랩 95% 구간.

| 세트 | final0 템포 / 구간 / 박 F | 유의한 차이 (상대 − final0) | 유의하지 않음 |
|---|---|---|---|
| RWC-G 27 | 100 / 95.4 / 96.6 | 구간 템포: madmom DBN +3.2 [+0.1, +7.5], TempoCNN +3.6 [+0.4, +8.0], small0 −2.4 | 박 F: madmom DBN −1.6 [−6.2, +1.5] · 템포는 상위 5개 모두 100 |
| RWC-P 100 | 100 / 99.4 / 99.4 | 템포: TempoCNN 9:0 (p=0.004), DeepRhythm 21:0 (p<0.001) · 박 F: madmom DBN −2.1 | 템포: madmom DBN 3:0 (p=0.25) |
| Slakh 146 | 89.0 / 85.0 / 91.9 | +DBN: 구간 템포 +3.6 [+2.1, +5.3], 박 F +1.0 [+0.5, +1.5] | 템포: 상위 5개 모두 p ≥ 0.27 |
| Slakh 변화 97 | 87.6 / 83.3 / 91.2 | +DBN: 구간 템포 +3.7 · DeepRhythm 구간 템포 −6.9 | TempoCNN 구간 템포 −5.1 [−10.7, +0.4] |
| Slakh 일정 49 | 91.8 / 88.5 / 93.3 | +DBN: 구간 템포 +3.3 | madmom DBN 템포 5:0 (p=0.06) |

- Slakh에서 템포가 바뀌는 곡과 일정한 곡의 차이: final0 템포 실패 12/97 vs 4/49로 방향은 맞지만 유의하지 않다. 일정한 합성 곡도 실녹음(127곡 실패 0)보다 낮다 → 낮은 원인은 템포 변화보다 합성 음원·MIDI 정답 쪽이 크다.
- Beat This! final0의 Slakh 템포 실패 중 다수는 반·두 배다: 60–89 BPM을 두 배로 9곡, 140–150 BPM을 반으로 4곡. 실녹음 느린 곡(90 BPM 미만 31곡)은 두 배 오류 0.
- fact 세 개의 제목을 이 결과에 맞게 좁혔다 (best-on-unseen: 박 위치는 madmom DBN과 동률 · synth-tempo-change-harder: 원인은 합성 · tempo-trackers-steadier: RWC-G에서만).

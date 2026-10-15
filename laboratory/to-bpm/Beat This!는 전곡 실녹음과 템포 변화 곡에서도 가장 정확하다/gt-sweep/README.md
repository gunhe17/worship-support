# 정답 있는 전곡 세트 채점 (gt-sweep)

bpm-model-sweep의 방법 14개를 정답이 있는 전곡 세트에 돌리고 각 커널 안에서 채점한다.

| 세트 | 곡 | 음원 | 정답 | 학습한 방법 |
|---|---|---|---|---|
| RWC-G G001–G027 | 27 (팝·발라드·록·메탈·댄스) | Zenodo 18656623 `RWC-G.zip` (곡마다 Range 연결) | rwc-annotations `beats/RWC-G` | 없음 |
| RWC-P | 100 (J-pop) | HF `taohu/rwc-pop` 원본 WAV (Zenodo는 0.1–0.3 MB/s) | rwc-annotations `beats/RWC-P` | Beat This!, madmom downbeat |
| Slakh2100 | 150 = 템포 변화 100 + 일정 50 (seed 0) | HF `projectlosangeles/Slakh2100` 16 kHz mix (받으면서 풀어 고른 곡만) | `all_src.mid` 템포맵 (pretty_midi) | 문서상 없음 (TempoCNN의 LMD Tempo와 곡이 겹칠 수 있음) |

- 커널: `gunhe17/bpm-gt-sweep-a` (T4, Beat This!·DeepRhythm), `gunhe17/bpm-gt-sweep-c` (CPU, librosa·Essentia), `miinggu/bpm-gt-sweep-b` (CPU, madmom·BeatNet). 계정이 달라 비공개 데이터셋을 공유할 수 없어 커널마다 음원을 받는다.
- `python build.py` → `kaggle/{a,b,c}.py` = bpm-model-sweep `sweep_body.py`(방법·실행부) + `gt_extra.py`(세트·채점).
- 지표: 정답 템포 = 정답 박 간격 중앙값. Acc1(±4%), Acc2(×2·×3·½·⅓), 구간 템포(1초마다 8박 중앙값이 ±4% 안인 비율), beat F(mir_eval, 앞 5초 제외 / `beat_f0` 포함), CMLt·AMLt, downbeat F.
- Slakh는 합성음이고 보컬이 없다. 오디오와 MIDI 사이 오프셋은 재지 않았다. 템포맵에 이상한 이벤트(곡 템포의 0.55배 미만·1.8배 초과)가 있는 곡은 뺐다.
- 결과: `results/{a,b,c}/out/` (`kaggle kernels output`), 곡별 JSON에 방법 출력·정답·점수, `summary_{A,B,C}.json`에 세트별 평균.

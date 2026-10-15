# 마디 경계 공개 세트 시험 (boundary-bench)

- 왜: 찬양곡에는 구간 정답이 없어서, 정답이 있는 공개 대중가요 300곡으로 마디 격자 위 경계 방법의 정확도를 잰다 (to-bpm 결정 9와 같은 방침). 조사: [마디 단위 송폼 경계 검출](../../_survey/deep-research/reports/마디%20단위%20송폼%20경계%20검출.md)
- 데이터: HF `ASLP-lab/SongFormBench` (CC-BY-4.0) — Harmonix 200곡 + 중국어 100곡. 음원은 mel을 BigVGAN으로 복원한 소리. Harmonix 정답 박·첫 박은 github `urinieto/harmonixset` (MIT). 커널이 둘 다 직접 받는다
- 마디 격자 2종: `harmonix` = 정답 첫 박 (Harmonix만, 경계 방법만의 정확도), `beat-this` = Beat This! final0 + DBN (전체 파이프라인)
- 방법 (모두 마디 번호로 경계를 낸다):
  - `grid-8bar`: 첫 마디부터 8마디마다 (바닥선)
  - `foote-bar`: Barwise TF(log-mel, 마디당 96칸) cosine 자기유사도 + 16마디 체커보드 novelty
  - `laplacian-bar`: McFee & Ellis Laplacian을 마디 노드로 (CQT 반복 + MFCC 이웃, k=5)
  - `cbm-modulo8` / `cbm-none`: as_seg CBM, Barwise TF RBF 자기유사도, 7-band, 길이 벌점 modulo8 / 없음
- 채점: 정답 경계를 가장 가까운 첫 박으로 옮겨 마디 번호로 바꾼 뒤 mir_eval `detection(trim=True)`. `bar0` = 같은 마디, `bar1` = ±1마디, `s0.5`·`s3` = 초 단위 (문헌 비교용). 곡 평균 F + 곡 bootstrap 95% CI
- 하이퍼파라미터는 문헌·예제 값으로 고정 (튜닝 없음)

## 실행
```
python3 ../../../_server/kaggle.py . songform-boundary-bench
kaggle kernels output gunhe17/songform-boundary-bench -p results/v1
```
출력: `out/<id>.json` (곡별 격자·방법별 P/R/F와 경계 마디), `summary.json` (세트·격자·방법별 평균 F와 CI)

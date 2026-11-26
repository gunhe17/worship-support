# segmenter

sets.py(LOG 69–70)가 쓰는 텍스트·기호 분할 모델. 반 해상도(가로 1240) 페이지의 픽셀마다 종이 0 / 텍스트 1 / 기호 2.

## 재현 순서

| 단계 | 명령 | 출력 |
|---|---|---|
| 실 악보 정답 | `data.py --images <worship-sheet-images-500> --staff <sheet-staff-v3 out/staff.json> --out <data>/seg` | GT 86장 `.npz` |
| 합성 악보 | `rounds/synthetic.json`의 줄마다 `synthesize.py --out <data>/<dir> --start <start> --count <count> --boost '<boost>'` | 1,200장 `.npz` |
| 학습 | `train.py rounds/r0.json --data <data> --out <models>` → `r1.json` → `r2.json` | `seg_r2.pt` |
| 내보내기 | `export.py --weights <models>/seg_r2.pt --out seg.onnx` | 데이터셋 gunhe17/worship-sheet-seg-model |

- 악보 이미지는 저작권 때문에 저장소에 두지 않는다(Kaggle 비공개 데이터셋).
- 시트 목록(TEST·TRAIN·MORE)은 `kaggle/sets.py`에서 읽는다. 학습은 TRAIN만, MORE·TEST는 sets.py 채점용.
- 실행은 `segmenter/` 안에서(`train.py`가 `data.py`의 시트 목록을 import).
- `--boost`(라운드별 유형 강조): `triplet` 잇단음표 빈도 배수, `triplet_text`·`triplet_flat`·`triplet_below` 잇단음표 중 숫자를 텍스트 글꼴로·괄호를 평평하게·음표 아래에 둘 비율, `chord_tight`·`chord_font` 코드를 오선 위 0.5–2.0칸에 붙일·코드 글꼴을 바꿀 페이지 비율. 모두 기호·텍스트 라벨은 그대로.
- `rounds/tuplet-boxes.json`: TRAIN의 잇단음표 GT 상자(에이전트 유형 분류 결과). r1·r2가 그 주변을 집중해서 자른다.
- r0은 원래 다른 스크립트로 학습해(표본 추출 순서가 다름) 같은 설정이어도 가중치가 비트 단위로 같지는 않다. r1·r2는 같은 시작 가중치에서 비트 단위로 재현된다.

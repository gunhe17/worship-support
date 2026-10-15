# to-xml 가설

## OMR과 비전 LLM을 나눠 쓰면 악보를 MusicXML로 옮길 수 있다

### experiment-omr-vlm — 악보 54장에서 Audiveris와 Qwen3-VL 비교
where: lab/to-xml/OMR과 비전 LLM을 나눠 쓰면 악보를 MusicXML로 옮길 수 있다/sheet-to-musicxml
- 데이터: openewld-20-clean · openewld-20-lowres · sheets-worship-14
- 틀: {조건} → keep-main-part
- 조건 A: audiveris(version=5.11, lang=kor+eng)
- 조건 B: qwen3-vl(size=4B, max_tokens=2500) → abc-to-musicxml
- 지표: omr-ned
- 기준: B.omr-ned ≤ 0.3
- 환경: kaggle-cpu × 1 · kaggle-t4 × 1
- 결과: 실패

### 사실

#### fact-audiveris-misses-korean-lyrics — Audiveris는 한글 가사를 음표에 거의 붙이지 못한다.
kind: 실패 요인 · supports: [OMR과 비전 LLM을 나눠 쓰면 악보를 MusicXML로 옮길 수 있다] · about: [audiveris]

#### fact-audiveris-splits-parts — Audiveris는 한 성부 리드시트를 여러 파트로 나누므로 음표가 가장 많은 파트만 남겨야 한다.
kind: 부수 사실 · supports: [] · about: [audiveris]

#### fact-audiveris-structure-reliable — Audiveris는 찬양 악보의 조표와 마디 구조를 정확히 읽는다.
kind: 부수 사실 · supports: [OMR과 비전 LLM을 나눠 쓰면 악보를 MusicXML로 옮길 수 있다] · about: [audiveris]

#### fact-small-vlm-cannot-transcribe-notes — 작은 비전 LLM(Qwen3-VL-4B)은 같은 음표를 반복하는 환각 때문에 음표를 전사하지 못한다.
kind: 실패 요인 · supports: [] · about: [qwen3-vl]

## 오선 구조를 먼저 찾으면 악보의 오선을 빠짐없이 검출할 수 있다

### experiment-staff-detection — 악보 500장에서 오선 검출 채점
where: lab/to-xml/OMR과 비전 LLM을 나눠 쓰면 악보를 MusicXML로 옮길 수 있다/sheet-to-musicxml (kaggle/staff-strip, staff-500, staff-p6x)
- 데이터: sheets-100 → sheets-500
- 틀: normalize-width(px=2480) → {조건}
- 조건 A: staff-comb(lines=5) → bridge-gaps → multi-head
- 지표: staff-miss
- 기준: A.staff-miss = 0개
- 환경: kaggle-cpu × 1
- 결과: 성공

### 사실

#### fact-small-agent-review-unreliable — 작은 에이전트(haiku)의 눈 검토는 실제 오선 누락을 놓쳐 믿기 어렵다.
kind: 부수 사실 · supports: [] · about: [to-xml]

#### fact-staff-structure-first-works — 진하기 대신 줄 간격 구조로 찾으면 연한 줄 하나가 빠져도 오선 전체를 놓치지 않는다.
kind: 성공 요인 · supports: [오선 구조를 먼저 찾으면 악보의 오선을 빠짐없이 검출할 수 있다] · about: [to-xml]

#### fact-thin-lines-split-pixels — 1px 오선은 픽셀 경계에 걸리면 연한 두 행으로 갈라진다.
kind: 부수 사실 · supports: [] · about: [to-xml]

## 오선 진하기로 악보별 잉크 기준을 정하면 연한 오선을 살리고 워터마크를 거를 수 있다

### experiment-ink-threshold — 악보 100장에서 잉크 기준 9가지 비교
where: lab/to-xml/OMR과 비전 LLM을 나눠 쓰면 악보를 MusicXML로 옮길 수 있다/sheet-to-musicxml (kaggle/ink-diag, regions-calib, regions-100, dist-diag)
- 데이터: sheets-6 → sheets-100
- 틀: {조건} → staff-region
- 조건 A: ink-from-staff(k=0.35, cap=150)
- 조건 B: ink-dist(method=otsu3|yen|edge-median|otsu|triangle|edge-otsu|li|valley)
- 지표: faint-staff-kept · watermark-removed
- 기준: A.faint-staff-kept = 100%
- 환경: kaggle-cpu × 1
- 결과: 성공

### 사실

#### fact-distribution-threshold-weaker — 픽셀 분포만으로 정한 잉크 기준은 가는 획의 회색 가장자리를 잃어 오선 기준보다 약하다.
kind: 부수 사실 · about: [to-xml]

#### fact-ink-from-staff — 오선 줄의 회색값이 그 악보의 실제 잉크 진하기를 대표해서 연한 오선과 워터마크를 가르는 기준이 된다.
kind: 성공 요인 · supports: [오선 진하기로 악보별 잉크 기준을 정하면 연한 오선을 살리고 워터마크를 거를 수 있다] · about: [to-xml]

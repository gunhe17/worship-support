# 곡 오디오 분석 조사: Key(전조 포함) · Arrangement · BPM

- 조사일: 2026-09-28
- 목적: 곡 오디오 파일을 입력하면 **key(곡 중 key up/down 포함)**, **arrangement(예: Verse > Chorus)**, **BPM**을 반환하는 기능의 측정 방법 조사
- 대상 도메인: 예배/CCM 곡 (스튜디오 음원 + 라이브 녹음)

---

## 0. 조사 방법과 범위

### 조사 영역
| 영역 | 세부 주제 |
|---|---|
| BPM | tempo/beat/downbeat tracking, 반/두 배 템포 오류(octave error), 라이브 템포 드리프트, 6/8 박자 |
| Key | 곡 전체 key, 시간에 따른 local key·전조 검출, 보조 수단인 코드 인식 |
| Arrangement | 구간 분할(boundary) + 기능 라벨(verse/chorus/bridge…), 가사 기반 방법, audio-LLM |
| 공통 | 음원 분리(Demucs) 전처리, 평가 지표·데이터셋, 라이선스·설치 가능성, 상용 제품(Moises, Chordify, Mixed In Key, Tunebat, MultiTracks, Loop Community, Planning Center) |
| 예배 도메인 | 가사를 미리 아는 경우가 많음, 라이브 녹음, 마지막 후렴 key up |

### 조사 수단
- **Claude 리서치 에이전트 3개**(BPM / Key / 구조): 웹 검색·페이지 확인으로 논문, 라이브러리, 벤치마크, 라이선스 조사
- **Grok CLI 3개**(BPM / Key / 구조): `x_keyword_search`, `x_semantic_search`, `x_thread_fetch`로 X를 검색하고 웹 검색을 병행. 실무자 의견, 2025~26 최신 동향, 현장 이슈 수집
- 원문 6개는 모두 각 기능 폴더의 `sources/`에 그대로 보존:
  - [claude-bpm.md](../audio-to-bpm/sources/claude-bpm.md) · [claude-key.md](../audio-to-key/sources/claude-key.md) · [claude-structure.md](../audio-sheet-to-arrangement-form/sources/claude-structure.md)
  - [grok-bpm.md](../audio-to-bpm/sources/grok-bpm.md) · [grok-key.md](../audio-to-key/sources/grok-key.md) · [grok-structure.md](../audio-sheet-to-arrangement-form/sources/grok-structure.md)

### 핵심 결론 (한 줄)
> 세 요소는 서로 의존하므로 **분석 순서가 중요**하다.
> `beat/downbeat → 구간(마디 경계에 맞춤) → 구간별 key(반복 구간을 서로 비교해 전조 확인)`
> 구간별 tempo도 구간 경계가 정해진 뒤에 계산한다.

---

## 4. 전체 통합 파이프라인 (초안)

```
입력 오디오
 └─ ffmpeg 디코딩 (44.1kHz WAV) + 튜닝 추정
     ├─ [1] Beat This! (DBN 없이) → beats, downbeats
     │      └─ 박자(마디 박 수) 추정, octave 후보 {T/2, T, 2T}(+×3, ÷3)
     ├─ [2] SongFormer (+ 선택: allin1) → 구간 경계와 기능 라벨
     │      ├─ 경계를 downbeat에 스냅
     │      └─ (가사 악보가 있으면) WhisperX + 구간 DP → Verse 1/2, Chorus, Tag…
     ├─ [3] 구간별 BPM (median 간격) + 템포 곡선 + 안정성 플래그 + half-time 플래그
     └─ [4] Demucs bass+other → 구간별 크로마 → 구간별 key (Krumhansl/Temperley + 코드 모델)
            └─ 반복 chorus의 OTI (+1/+2) + 구간 key 차이 → 전조 판정
출력: { bpm: {value, alternates, meter, feel, stability, curve},
        key: {primary, changes: [{at, from, to, section}], runner_up},
        arrangement: [{label, start, end, confidence}] }
```

---

## 5. 결정·확인이 필요한 사항

1. **라이선스 정책**: 상업 서비스라면 **madmom 모델(NC), Essentia(AGPL) / TempoCNN(NC), KeyMyna(라이선스 미표기)**는 제외된다. 남는 후보는 **Beat This!(MIT), librosa(ISC), Demucs(MIT), BTC(MIT), allin1(MIT, 단 madmom의 어느 부분을 쓰는지 확인 필요)**다. Chordino는 GPL이다. SongFormer는 백본 가중치 라이선스를 확인해야 한다.
2. **검증 세트 구축**: 예배곡 공개 벤치마크는 없다. **30~50곡(스튜디오와 라이브 반반)**을 직접 라벨링한다.
   - 지표: BPM Acc1, Acc2, beat F1 / key MIREX weighted + 전조 검출 여부 / 구간 HR.5F, HR3F, ACC
   - 같은 곡의 스튜디오 버전과 라이브 버전을 학습과 테스트에 나눠 넣지 않는다(cover-song 효과).
3. **첫 스파이크**: Colab MCP(이 세션에서 설정 완료)로 Colab GPU에서 Beat This!, SongFormer, allin1을 예배곡 5~10곡에 돌려 비교한다. SongFormer의 pip/CPU 동작, Beat This! CPU 실행 시간(small 모델로 곡당 수 초로 추정), allin1 CPU 실행 시간(곡당 수십 초로 추정)은 **아직 측정하지 않았다.**
4. **검증되지 않은 가정**: 6/8 곡의 BPM을 점4분음표 기준으로 보고하는 것이 CCLI/SongSelect 관례와 맞는지 확인이 필요하다.
5. **출력 규약**: 오디오 key와 차트 key(카포, 남녀 key)를 구분하고, 전조(transpose)는 별도 기능으로 둔다.

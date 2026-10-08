# BPM·beat 측정 방법 후보 (보충 조사, 2026-10-08)

기존 조사: [survey.md](survey.md) 1.2(방법 계열)·1.3(벤치마크)·1.5(라이선스). 여기서는 빠진 도구와 실행 가능성만 보충한다.

| # | 방법 | 방식 | 출력 | 라이선스 | 비고 |
|---|---|---|---|---|---|
| 1 | Beat This! | Transformer, DBN 없음 | beat, downbeat | MIT | 현재 파이프라인. GTZAN Acc2 94.5%(우리 측정). small·DBN 변형 비교 가능 |
| 2 | madmom RNN+DBN | RNN + 동적 베이즈망 | beat, downbeat, 템포 | 모델 CC BY-NC-SA | DBN이 템포 일관성 강제 → 구간 쪼개짐(쟁점 13) 감소 가능 |
| 3 | librosa beat_track / tempo / PLP | onset 자기상관 + DP | beat, 템포(시변) | ISC | 기준선. 120 BPM 쪽으로 끌림 |
| 4 | Essentia RhythmExtractor2013 (multifeature/degara) | onset 특징 조합 | beat, 템포, 후보 | AGPL | 후보·강도 제공 |
| 5 | Essentia PercivalBpmEstimator | 자기상관 + 펄스 상관 | 곡 템포 | AGPL | 빠름 |
| 6 | Essentia TempoCNN | CNN 12초 창 다수결 | 곡·구간 템포 | 모델 비상업 | |
| 7 | All-In-One | Demucs 분리 → 통합 모델 | 템포, beat, downbeat, 구간·기능 라벨 | 코드 MIT(madmom) | Harmonix beat F1 0.958. 송폼에도 활용 가능, NATTEN 설치 까다로움 |
| 8 | BeatNet (오프라인) | CRNN + DBN/파티클 필터 | beat, downbeat, 템포, 박자 | CC BY 4.0(madmom) | 2026-04 업데이트 |
| 9 | DeepRhythm | CNN 템포 분류 | 곡 템포 | AGPL | 자체 953곡 Acc1 95.9%(±2%, 자체 측정), 곡당 0.02초 |
| 10 | Phasefinder | beat 위상 예측 | beat, BPM | AGPL | 개인 프로젝트, 우선순위 낮음 |
| – | aubio, BTrack | 고전 onset 방식 | beat, 템포 | GPL | librosa와 유사, 생략 가능 |

## Logic Pro (로컬, 12.2 설치됨)
- Smart Tempo: 오디오 → 템포 맵(시변). BPM Counter 플러그인도 있음
- 자동화 API 없음(GUI 조작만), 로컬 연산(“연산은 Kaggle” 원칙과 충돌), 템포 맵 내보내기 방법 확인 필요(MIDI 내보내기에 템포 이벤트가 담길 가능성)
- → 전 곡 비교보다 20–30곡 참고 기준으로 쓰는 것이 현실적

## 일괄 시험 안
- 대상: GTZAN 996(정답) + 찬양 500(방법 간 비교)
- 방법 1–9, 12시간 제한 때문에 커널 2–3개로 나눠 동시 실행
- 영역: Acc1/Acc2, beat·downbeat F, 박자, 반·두 배 방향, 구간 쪼개짐(13), 연속 2박 마디(6)

출처: https://pypi.org/project/deeprhythm/ · https://awesome.ecosyste.ms/projects/github.com%2Fbleugreen%2Fphasefinder · https://essentia.upf.edu/tutorial_rhythm_beatdetection.html · https://essentia.upf.edu/reference/std_PercivalBpmEstimator.html · GitHub API 라이선스 조회(2026-10-08)

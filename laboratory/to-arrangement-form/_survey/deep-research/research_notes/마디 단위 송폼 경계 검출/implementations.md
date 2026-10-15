# 송폼 경계 검출: 바로 쓸 수 있는 오픈소스 구현 카탈로그 (Kaggle T4 기준)

조사일: 2026-10-15. GitHub의 license/pushed_at/release 값은 GitHub REST API(`api.github.com/repos/<owner>/<repo>`)로, PyPI 값은 `pypi.org/pypi/<pkg>/json`으로, HF 라이선스 태그는 `huggingface.co/api/models/<id>`로 직접 확인했다.

## 요약 표 (상세 근거는 아래 섹션에 있음)

| 구현 | 코드 라이선스 | 가중치 라이선스 | 최신 릴리스 / 마지막 push | 내 beat/downbeat 주입 | 상업 사용 |
|---|---|---|---|---|---|
| MSAF (urinieto/msaf) | MIT | 해당 없음 (비학습형) | PyPI 0.1.80 (2023-06) / main 2026-05 | 가능 (JAMS beat 주석 + `ann_beatsync`) | OK |
| librosa segment | ISC | 해당 없음 | 1.0.0 (2026-08, Python>=3.12) / 0.11.0 (Python>=3.8) | 가능 (`librosa.util.sync`에 원하는 프레임 전달) | OK |
| as_seg / CBM (Marmoret) | BSD-3-Clause | 해당 없음 | as-seg 0.1.12 (2026-04) | 가능 (`bars` 인자를 직접 받음) | OK |
| All-In-One (allin1) | MIT | MIT (HF 태그) | 1.1.0 (2023-10) / 2024-05 | 불가 (자체 beat/downbeat/segment 동시 추정) | 표기상 OK, 학습 데이터(Harmonix) 확인 필요 |
| SongFormer | CC BY 4.0 | CC BY 4.0 배지. 단 MuQ 가중치가 CC-BY-NC-4.0 | 릴리스 없음 / 2026-05 | 불가 | **NC 체인** (MuQ 때문에) |
| madmom | BSD (코드) | **CC BY-NC-SA 4.0** (모델 파일) | 0.16.1 (2018-11) / main 2026-03 | (구조 분석 기능은 없음) | 모델 파일은 **NC** |
| Essentia SBic | **AGPL-3.0** | 해당 없음 | PyPI 2.1b6.dev1438 (2026-05) | 프레임 특징을 직접 넣음 (beat-sync도 가능) | AGPL 의무 발생 |
| MERT v1 (m-a-p) | Apache-2.0 | **CC-BY-NC-4.0** | 2025-05 | 해당 없음 (임베딩) | **NC** |
| MuQ (tencent-ailab) | MIT | **CC-BY-NC-4.0** | muq 0.1.0 (2024-12) | 해당 없음 | **NC** |
| MusicFM (minzwon) | MIT + Apache-2.0 (일부 파일) | MIT (HF 태그) | 2024-02 | 해당 없음 | OK (표기상) |
| LAION CLAP | CC0-1.0 | Apache-2.0 (HF) | 2025-05 | 해당 없음 | OK |
| MAEST (mtg-upf) | (Essentia 계열) | **CC-BY-NC-SA-4.0** | 2025-05 | 해당 없음 | **NC** |
| pychorus | MIT | 해당 없음 | 0.1 (2018-05) / 2023-12 | 불가 | OK (기능이 후렴 1개 검출뿐임) |
| Spleeter | MIT | (구조 분석 없음) | v2.3.0 (2021-09) | — | 구조 분석 기능 없음 |

---

## 1. MSAF (urinieto/msaf): 알고리즘, 라이선스, 호환성, 커스텀 beat 사용

### Takeaway
MSAF는 MIT 라이선스다. 현재 main 브랜치에는 `cnmf, fmc2d, foote, olda, scluster, sf, vmo, cbm`이 들어 있다. PyPI 0.1.80(2023)은 메타데이터가 낡아서 최신 numpy/scipy에서 import할 때 바로 깨지므로, **GitHub main을 설치해야 한다.** JAMS 파일의 `beat.*` 주석을 "annotated beats"로 읽어 `ann_beatsync` 특징으로 쓰는 경로가 있다. 따라서 Beat This!의 beat 또는 downbeat를 JAMS로 써 넣으면 커스텀 beat/마디 동기화를 할 수 있다.

### Cited Findings
- 라이선스는 MIT다. 스타 560, 마지막 push 2026-05-13, 최신 GitHub 릴리스 v0.1.80(2023-06-25) — [GitHub API urinieto/msaf](https://api.github.com/repos/urinieto/msaf), [README license badge](https://github.com/urinieto/msaf)
- PyPI 최신은 0.1.80(업로드 2023-06-25)이다. `install_requires`는 `audioread, cvxopt, decorator, enum34, jams>=0.3.0, joblib, librosa>=0.6.0, mir_eval, matplotlib, numpy>=1.8.0, pandas, scikit-learn, scipy, seaborn, vmo>=0.3.3`이다 — [PyPI msaf](https://pypi.org/pypi/msaf/json), [setup.py](https://github.com/urinieto/msaf/blob/main/setup.py)
- 알려진 깨짐(issue #163, 2025-04): PyPI 휠의 메타데이터와 달리 실제로는 numpy<2, scipy<1.8이 필요하다. 그렇지 않으면 import 시 `` `np.float_` was removed in the NumPy 2.0 release `` 또는 `ImportError: cannot import name 'inf' from 'scipy'` 오류가 난다. 한 사용자는 "Python >= 3.11에서 빌드 에러"를 보고했다. 메인테이너는 "the latest PyPi version of MSAF is out of date. Please, install the latest from the main of this repo"라고 답했다 — [msaf issue #163](https://github.com/urinieto/msaf/issues/163)
- main 브랜치 `msaf/algorithms/__init__.py`의 알고리즘 목록은 `cnmf, fmc2d, foote, olda, scluster, sf, vmo, cbm`이다. "spectral"이라는 독립 모듈은 없다. McFee & Ellis의 Laplacian(spectral clustering)은 `scluster`다 — [msaf/algorithms](https://github.com/urinieto/msaf/tree/main/msaf/algorithms)
- CBM(Marmoret)이 main 브랜치에 boundary 전용 알고리즘으로 들어 있다(`is_boundary_type = True`, `is_label_type = False`). 기본 설정은 `ssm_type="rbf", penalty_func="modulo8", max_size=32, bands_number=7`이다 — [msaf/algorithms/cbm/config.py](https://github.com/urinieto/msaf/blob/main/msaf/algorithms/cbm/config.py)
- 특징 타입은 `FeatureTypes = Enum("FeatureTypes", "framesync est_beatsync ann_beatsync")`이다. 주석은 "est_beatsync: Beat-synchronous using estimated beats with librosa", "ann_beatsync: Beat-synchronous using annotated beats from ground-truth"이다 — [msaf/base.py](https://github.com/urinieto/msaf/blob/main/msaf/base.py)
- `read_ann_beats()`는 `file_struct.ref_file`(JAMS)에서 `jam.search(namespace="beat.*")`의 첫 번째 주석을 읽어 beat 시간으로 쓴다 — [msaf/base.py](https://github.com/urinieto/msaf/blob/main/msaf/base.py)
- 오래된 핀 고정 requirements.txt가 남아 있다(`librosa==0.6.1, numpy==1.19.5, scipy==1.1.0` 등). 이것을 설치하면 안 된다 — [requirements.txt](https://github.com/urinieto/msaf/blob/main/requirements.txt)
- 바마다(barwise) 특징을 MSAF에 넣자는 기능 제안 이슈는 아직 열려 있다 — [msaf issue #154](https://github.com/urinieto/msaf/issues/154)

### Inferences
- 마디 단위로 경계를 잡으려면 **Beat This!의 downbeat 시간을 JAMS `beat` 네임스페이스로 써 넣고 `feat_type=ann_beatsync`로 돌리면** 마디 동기 SSM 위에서 foote/sf/scluster/cbm을 그대로 쓸 수 있다. CBM의 `modulo8` 페널티는 단위가 마디일 때 의미가 맞는다.
- 설치는 `pip install git+https://github.com/urinieto/msaf`이고 `cvxopt`와 `vmo`가 같이 들어온다. `cvxopt`(cnmf용)와 `vmo`는 휠 가용성이 Python 버전에 따라 다르므로 Kaggle의 최신 Python(6절)에서는 빌드 실패 위험이 있다.
- MSAF 내부의 `est_beatsync`는 librosa beat tracker를 쓴다. 우리 파이프라인이라면 `ann_beatsync`를 써야 한다.

### Gaps
- main 브랜치가 numpy 2.x와 scipy 최신 버전에서 실제로 import되는지는 직접 실행해 확인하지 못했다(로컬 실행 금지 정책). 메인테이너는 "main should work fine"이라고만 답했다.
- cvxopt/vmo의 Python 3.12/3.13 휠 존재 여부는 확인하지 못했다.

---

## 2. librosa segment API와 Laplacian segmentation 예제

### Takeaway
librosa는 ISC 라이선스다. `segment.recurrence_matrix / path_enhance / timelag_filter / agglomerative`와 McFee-Ellis Laplacian 예제를 쓰면 의존성 부담 없이 마디 동기 SSM 기반 경계를 만들 수 있다. 단 **librosa 1.0.0(2026-08)은 Python>=3.12를 요구한다.** 3.10/3.11 환경이라면 0.11.0을 써야 한다.

### Cited Findings
- 라이선스는 ISC다. 최신 릴리스 1.0.0(2026-08-11), 마지막 push 2026-10-06 — [GitHub API librosa/librosa](https://api.github.com/repos/librosa/librosa)
- PyPI의 librosa 1.0.0은 `requires_python >=3.12`다. 0.11.0은 `>=3.8`이고 의존성은 `numpy>=1.22.3, numba>=0.51.0, scipy>=1.6.0, scikit-learn>=1.1.0, soundfile>=0.12.1, soxr>=0.3.2` 등이다 — [PyPI librosa](https://pypi.org/pypi/librosa/json), [PyPI librosa 0.11.0](https://pypi.org/pypi/librosa/0.11.0/json)
- 0.11.0에서 "Numpy 2.0 is now supported."가 되었다. 1.0.0에서는 "Support for Python 3.14", "Adopted SPEC0"이 추가되었다. 1.0.0과 0.11.0 changelog에 segment 함수의 제거나 변경 항목은 없다(1.0.0은 subsegment 예제 문서 수정만) — [librosa changelog](https://librosa.org/doc/latest/changelog.html)
- 0.7.0에서 `path_enhance`가 추가되었다("Near-diagonal path enhancement for recurrence, self- or cross-similarity matrices"). 0.10.0에서 `recurrence_matrix`/`cross_similarity`의 bandwidth 옵션이 확장되었다 — [librosa changelog](https://librosa.org/doc/latest/changelog.html)

### Inferences
- Laplacian 예제(공식 갤러리 "Laplacian segmentation")는 beat 프레임으로 `librosa.util.sync`를 수행한다. 그 자리에 Beat This!의 beat나 downbeat 프레임을 넣으면 마디 동기가 된다. 코드가 약 100줄 수준이고 GPU가 필요 없다(CPU, 곡당 수 초 수준으로 추정, 미측정).
- MSAF `scluster`도 같은 알고리즘이므로, MSAF 설치 문제를 피하려면 librosa 예제를 그대로 옮겨 쓰는 편이 가장 가볍다.

### Gaps
- Laplacian 갤러리 예제 페이지의 최신 코드는 직접 fetch하지 않았다(changelog로 API 존속만 확인). 곡당 런타임도 실측하지 않았다.

---

## 3. All-In-One (mir-aidj/all-in-one, `pip install allin1`)

### Takeaway
코드는 MIT이고, HF 가중치(`taejunkim/allinone`)에도 MIT 태그가 있다. beat, downbeat, 기능 라벨(verse/chorus 등)이 붙은 segment를 한 번에 내놓는다. 그러나 **NATTEN API 변경 때문에 현재 상태로는 최신 NATTEN에서 동작하지 않는다.** 구버전 NATTEN은 최신 torch에서 빌드되지 않는 사실상 유지보수 중단 상태다. 내부에서 Demucs로 4-stem 분리를 반드시 수행한다. 사용자가 beat를 주입하는 경로는 문서화되어 있지 않다.

### Cited Findings
- 코드 MIT, 스타 860, 마지막 push 2024-05-09, GitHub 릴리스 없음 — [GitHub API mir-aidj/all-in-one](https://api.github.com/repos/mir-aidj/all-in-one)
- PyPI allin1 최신은 1.1.0(업로드 2023-10-10)이다. `requires_dist`는 `demucs, huggingface-hub, hydra-core, librosa, matplotlib, natten; platform_system == 'Darwin', numpy, omegaconf`이다. **Linux에서는 natten이 자동 설치되지 않는다** — [PyPI allin1](https://pypi.org/pypi/allin1/json)
- HF 가중치 `taejunkim/allinone`은 `license:mit` 태그가 있고 8-fold 체크포인트(`all-fold0-...pth` 등)로 구성된다. 마지막 수정은 2023-10-30 — [HF API taejunkim/allinone](https://huggingface.co/api/models/taejunkim/allinone)
- README의 설치 절차: torch 설치, NATTEN 설치(Linux는 NATTEN 웹사이트에서), `pip install git+https://github.com/CPJKU/madmom`, `pip install allin1`, (MP3라면) ffmpeg 설치. 오디오는 Demucs로 bass/drums/other/vocals로 분리하고, `-k/--keep-byproducts`일 때만 분리 결과를 보존한다(`--demix-dir`, `--spec-dir`). 출력 JSON에는 `bpm, beats, downbeats, beat_positions, segments[{start,end,label}]`가 있다. 라벨은 start, end, intro, outro, break, bridge, inst, solo, verse, chorus이다. RTX 4090에서 10곡(33분)을 73초에 처리했다. 가중치 라이선스와 GPU 메모리 요구량은 README에 없다 — [all-in-one README](https://github.com/mir-aidj/all-in-one)
- issue #30(2025-05): "This project is NOT compatible with the latest NATTEN"이다. import 경로를 바꾸어도 `Expected attention dim was 5, got 9` 오류가 난다. 댓글은 "Older versions of NATTEN do not build anymore"이고, 이후 PR #27로 해결했다는 보고가 있다(미병합) — [issue #30](https://github.com/mir-aidj/all-in-one/issues/30), [PR #27](https://github.com/mir-aidj/all-in-one/pull/27)
- 그 밖의 미병합 PR: #36 "Natten compatibility fix and working Dockerfiles"(GPU Dockerfile 포함), #39 "Run neighborhood attention in plain PyTorch on CPU and MPS; make NATTEN optional" — [PR #36](https://github.com/mir-aidj/all-in-one/pull/36), [PR #39](https://github.com/mir-aidj/all-in-one/pull/39)
- NATTEN changelog: 0.17.5(2025-03)에서 "Dropped deprecated ops (`natten.functional.natten*d{qk,qkrpb,av}`)". 0.20.0(2025-06)에서 "`na{1,2,3}d_{qk,qkrpb,av}` APIs and respective backends have been dropped", "Dropped support for RPB", "`torch < 2.7` is no longer officially supported". 0.21.x는 torch 2.8~2.10과 Python 3.13/3.14 휠을 지원한다. changelog에는 SM75(T4)를 0.17.0 항목에서만 언급한다 — [NATTEN CHANGELOG](https://github.com/SHI-Labs/NATTEN/blob/main/CHANGELOG.md)
- NATTEN 자체는 MIT이고 최신 0.21.7(2026-07-26)이다 — [GitHub API SHI-Labs/NATTEN](https://api.github.com/repos/SHI-Labs/NATTEN)
- Demucs: facebookresearch/demucs는 MIT이고 **archived**(마지막 push 2024-04)다. 포크 adefossez/demucs(MIT)는 2026-08까지 push가 있다 — [GitHub API facebookresearch/demucs](https://api.github.com/repos/facebookresearch/demucs), [GitHub API adefossez/demucs](https://api.github.com/repos/adefossez/demucs)

### Inferences
- allin1의 DiNAT 모델은 RPB가 있는 1D/2D neighborhood attention(unfused `qkrpb`)을 쓴다. 따라서 **NATTEN ≥0.20에서는 원래 구현이 동작할 수 없다.** 현실적인 선택지는 (a) PR #39처럼 순수 PyTorch NA로 교체하는 것(T4에서도 동작하지만 느릴 수 있음), (b) 구 torch(≤2.5 등)와 NATTEN 0.17.x 조합을 별도 venv로 고정하는 것이다(Kaggle 기본 torch와 충돌, 빌드 시간이 김).
- 마디 경계 정밀도가 목적이면 allin1 segment 경계를 그대로 쓰기보다 **우리 downbeat 그리드에 스냅**하는 후처리가 필요하다(allin1은 자체 beat로 segment를 만든다).
- 가중치 MIT 태그가 있어도 학습 데이터인 Harmonix Set의 이용 조건은 별개다. 상업 사용 전에 법무 확인이 필요하다.
- Demucs 분리(htdemucs)는 T4에서 곡당 수십 초 수준이고 6분 이상 곡에서 메모리 피크가 생길 수 있다(미측정, 추정).

### Gaps
- T4에서의 allin1 곡당 VRAM과 런타임 실측치는 찾지 못했다.
- Harmonix Set 저장소(urinieto/harmonixset)의 라이선스 필드는 GitHub API에서 비어 있어 확인하지 못했다.
- PR #27/#36/#39가 NATTEN 0.21 + torch 2.8 + T4에서 동작하는지 검증 자료는 없다.

---

## 4. SongFormer (ASLP-lab) 및 MuQ/MusicFM 의존성

### Takeaway
SongFormer 코드와 체크포인트에는 CC BY 4.0이 표기되어 있다. 하지만 추론에 필요한 **MuQ 체크포인트가 CC-BY-NC-4.0**이므로 전체 파이프라인은 사실상 비상업용이다(이슈 #9에서 공식 답변 대기 중). 420초 윈도우에서 MuQ와 MusicFM 두 conformer의 hidden state가 쌓여 16 GB 카드에서 OOM이 난다는 것은 저장소 PR에서도 문서화되어 있다.

### Cited Findings
- 저장소 LICENSE 파일은 "Creative Commons Attribution 4.0 International Public License"이다(GitHub API spdx는 NOASSERTION). 스타 179, 마지막 push 2026-05-14, 릴리스 없음 — [SongFormer LICENSE](https://github.com/ASLP-lab/SongFormer/blob/main/LICENSE), [GitHub API](https://api.github.com/repos/ASLP-lab/SongFormer)
- HF 모델 카드(`ASLP-lab/SongFormer`)에는 license 메타데이터 태그가 없고 README 배지만 "License-CC BY 4.0"이다. 파일은 `SongFormer.pt`, `SongFormer.safetensors`, `config.json`이다 — [HF ASLP-lab/SongFormer](https://huggingface.co/ASLP-lab/SongFormer), [HF API](https://huggingface.co/api/models/ASLP-lab/SongFormer)
- 설치는 `conda create -n songformer python=3.10`, `pip install -r requirements.txt`, `python utils/fetch_pretrained.py`이다. 첫 실행 시 HF에서 MuQ 가중치를 받는다. 특징은 MuQ 30s/420s와 MusicFM 30s/420s다. torch 신버전에서는 `musicfm_25hz.py`를 `torch.load(model_path, weights_only=False)`로 고쳐야 할 수 있다. 출력은 `start_time label` 형식이고 8개 라벨(평가 시 pre-chorus는 verse로 매핑), `merge_continuous_segments` 옵션이 있다 — [SongFormer README](https://github.com/ASLP-lab/SongFormer)
- PR #8(2026-06, draft): "Each 420s audio window triggers ~30 forward passes ... (2 models x (1 long-window + 14 short-windows)). Peak VRAM can exceed available capacity on 16GB cards." 원인은 "Materializes full hidden-state tuples (~970 MB)", "Uses FP32 throughout with no Flash Attention on MusicFM"이다. 대책은 early-exit, FP16, chunked attention이다 — [PR #8](https://github.com/ASLP-lab/SongFormer/pull/8)
- issue #3: "Floating point exception caused by insufficient sequence length in Transformer inference"(closed) — [issue #3](https://github.com/ASLP-lab/SongFormer/issues/3)
- issue #9(2026-09, open): 상업 서버 통합을 검토하던 사용자가 "the relevant MuQ checkpoint appears to be licensed under CC-BY-NC-4.0", "MusicFM checkpoint terms are unclear"라며 공식 확인을 요청했다 — [issue #9](https://github.com/ASLP-lab/SongFormer/issues/9)
- MuQ: 코드 MIT(tencent-ailab/MuQ, 마지막 push 2025-08). HF `OpenMuQ/MuQ-large-msd-iter`와 `OpenMuQ/MuQ-MuLan-large`는 모두 `license:cc-by-nc-4.0`이다. PyPI `muq` 0.1.0(2024-12) — [GitHub API MuQ](https://api.github.com/repos/tencent-ailab/MuQ), [HF API MuQ-large-msd-iter](https://huggingface.co/api/models/OpenMuQ/MuQ-large-msd-iter), [HF API MuQ-MuLan-large](https://huggingface.co/api/models/OpenMuQ/MuQ-MuLan-large)
- MusicFM: 코드는 "dual-licensed ... MIT ... `modules/flash_conformer.py` is ... Apache License 2.0"이다. HF `minzwon/MusicFM` 가중치는 `license:mit` 태그(파일 `pretrained_msd.pt`, `pretrained_fma.pt`)다. 저장소 마지막 push는 2024-02 — [musicfm LICENSE](https://github.com/minzwon/musicfm/blob/main/LICENSE), [HF API minzwon/MusicFM](https://huggingface.co/api/models/minzwon/MusicFM)

### Inferences
- T4(SM75)는 FlashAttention 2를 지원하지 않는다(PR #8도 MusicFM flash를 SM80+로 제한). 따라서 T4에서의 실질 대책은 FP16, early-exit, 420s 윈도우 축소(예: 240s)다. 윈도우를 줄이면 모델이 학습한 장기 문맥과 달라져 정확도에 영향이 있을 수 있다.
- 우리 downbeat를 주입하는 인터페이스는 없다. 출력 경계를 마디 그리드로 스냅하는 후처리가 필요하다.
- Python 3.10 conda 환경 전제라서 Kaggle 기본 Python(6절)과 다르다. requirements 핀을 풀어야 할 가능성이 크다(README도 "remove version constraints"를 권함).

### Gaps
- SongFormer 저자 측의 상업 이용 공식 답변은 아직 없다(issue #9 open).
- T4 + FP16에서 몇 초 윈도우까지 OOM 없이 도는지 공개 실측은 찾지 못했다.

---

## 5. 기타 후보: as_seg/CBM, madmom, Essentia, 임베딩 모델, pychorus, Spleeter

### Takeaway
**마디 단위 경계를 직접 겨냥한 구현은 Marmoret의 as_seg(CBM, BSD-3)**다. `bars` 리스트를 인자로 받으므로 Beat This!의 downbeat를 그대로 넣을 수 있다. madmom 모델 파일은 CC BY-NC-SA라서 우리 파이프라인의 madmom DBN 사용도 점검이 필요하다. 임베딩 중 MERT, MuQ, MAEST는 NC이고, CLAP(LAION)과 MusicFM은 허용적이다.

### Cited Findings
- **as_seg (Marmoret)**: PyPI `as-seg` 0.1.12(2026-04-22), license BSD, 홈페이지는 gitlab.imt-atlantique.fr/a23marmo/autosimilarity_segmentation이다. GitHub 미러 `ax-le/autosimilarity_segmentation`은 BSD-3-Clause이고 push 2026-07-17. 의존성은 `base_audio, librosa>0.10.0, mir_eval, mirdata>=0.3.3, numpy>=1.26.4, tensorly>=0.5.1, scipy, scikit-learn, pandas` 등이다 — [PyPI as-seg](https://pypi.org/pypi/as-seg/json), [GitHub API ax-le repos](https://api.github.com/users/ax-le/repos)
- as_seg README: "The current version contains the CBM algorithm [1], along with an implementation of Foote's novelty". 참고문헌은 Marmoret, Cohen, Bimbot, "Barwise Music Structure Analysis with the Correlation Block-Matching Segmentation Algorithm", TISMIR 2023이다. "developed with Python 3.8.5" — [as_seg README](https://github.com/ax-le/autosimilarity_segmentation)
- as_seg API: `barwise_input.barwise_TF_matrix(spectrogram, bars, hop_length_seconds, subdivision)` → `autosimilarity_computation.switch_autosimilarity(..., "cosine")` → `CBM_algorithm.compute_cbm(autosimilarity, min_size=1, max_size=32, penalty_weight=1, penalty_func="modulo8", bands_number=None)` → `data_manipulation.segments_from_bar_to_time(segments, bars)`. 기본 bar 추정 함수 `get_bars_from_audio_madmom`은 `RNNDownBeatProcessor` + `DBNDownBeatTrackingProcessor(beats_per_bar=[3,4], fps=100)`을 쓴다(이 경우 madmom NC 모델 파일 사용) — [as_seg/example.py](https://github.com/ax-le/autosimilarity_segmentation/blob/main/as_seg/example.py), [as_seg/data_manipulation.py](https://github.com/ax-le/autosimilarity_segmentation/blob/main/as_seg/data_manipulation.py), [as_seg/CBM_algorithm.py](https://github.com/ax-le/autosimilarity_segmentation/blob/main/as_seg/CBM_algorithm.py)
- Marmoret의 관련 저장소: `BarMusComp`(BSD-3, PyPI `barmuscomp` 0.1.6, 2024-07; barwise 압축 기반), `msa_deep_embeddings`(BSD-3, push 2026-07), `MusicNTD`/`MusicAE`(BSD-3, 2022) — [GitHub API ax-le repos](https://api.github.com/users/ax-le/repos), [PyPI barmuscomp](https://pypi.org/pypi/barmuscomp/json)
- **madmom**: 소스 코드는 BSD-2-Clause 형식이다. "All model and data files are distributed under ... Creative Commons Attribution-NonCommercial-ShareAlike 4.0"이고, 상업 이용 시 Gerhard Widmer에게 문의하라고 되어 있다. PyPI 0.16.1(2018-11-14)의 license 필드는 "BSD, CC BY-NC-SA" — [madmom LICENSE](https://github.com/CPJKU/madmom/blob/main/LICENSE), [PyPI madmom](https://pypi.org/pypi/madmom/json)
- madmom 0.16.1은 numpy>=1.24에서 `np.float`/`np.int` 제거 때문에 11개 파일에서 깨진다(`from madmom.features import DBNDownBeatTrackingProcessor` → `AttributeError: module 'numpy' has no attribute 'float'`) — [madmom issue #557](https://github.com/CPJKU/madmom/issues/557). 새 릴리스 요청 이슈(#553)와 Python 3.14 / NumPy 2.4+ 호환 PR(#559)이 열려 있다 — [issue #553](https://github.com/CPJKU/madmom/issues/553), [PR #559](https://github.com/CPJKU/madmom/pull/559)
- madmom main 브랜치(2026-03 push)는 소스에서 `np.float`/`np.int` 별칭이 제거되어 docstring에만 남아 있고, `pyproject.toml` 빌드 요구사항은 `cython>=0.25`, `numpy>2`이다. 따라서 `pip install git+https://github.com/CPJKU/madmom`이 최신 numpy 환경의 정석이다 — [madmom main source](https://github.com/CPJKU/madmom), [GitHub API CPJKU/madmom](https://api.github.com/repos/CPJKU/madmom)
- **Essentia**: 라이선스 AGPL-3.0(push 2026-10-14). PyPI `essentia` 2.1b6.dev1438(2026-05-19) — [GitHub API MTG/essentia](https://api.github.com/repos/MTG/essentia), [PyPI essentia](https://pypi.org/pypi/essentia/json)
- Essentia `SBic`: 입력은 특징 행렬(행=특징, 열=프레임), 출력은 segment 경계 프레임 인덱스다. 파라미터는 `cpw=1.5, inc1=60, inc2=20, minLength=10, size1=300, size2=200`이다. "segments audio using the Bayesian Information Criterion"이며 단계는 coarse, fine, validation 3단계다 — [Essentia SBic reference](https://essentia.upf.edu/reference/std_SBic.html)
- **MERT**: 코드 Apache-2.0(yizhilll/MERT). HF `m-a-p/MERT-v1-330M`와 `MERT-v1-95M` 가중치는 모두 `license:cc-by-nc-4.0` — [GitHub API yizhilll/MERT](https://api.github.com/repos/yizhilll/MERT), [HF API MERT-v1-330M](https://huggingface.co/api/models/m-a-p/MERT-v1-330M), [HF API MERT-v1-95M](https://huggingface.co/api/models/m-a-p/MERT-v1-95M)
- **CLAP (LAION)**: 코드 CC0-1.0. HF `laion/clap-htsat-unfused`와 `laion/larger_clap_music`는 `license:apache-2.0` — [GitHub API LAION-AI/CLAP](https://api.github.com/repos/LAION-AI/CLAP), [HF API larger_clap_music](https://huggingface.co/api/models/laion/larger_clap_music)
- **MAEST**: HF `mtg-upf/discogs-maest-30s-pw-129e`는 `license:cc-by-nc-sa-4.0` — [HF API MAEST](https://huggingface.co/api/models/mtg-upf/discogs-maest-30s-pw-129e)
- **pychorus**: MIT, PyPI 0.1(2018-05), 마지막 push 2023-12 — [GitHub API vivjay30/pychorus](https://api.github.com/repos/vivjay30/pychorus), [PyPI pychorus](https://pypi.org/pypi/pychorus/json)
- **Spleeter**: MIT, 최신 릴리스 v2.3.0(2021-09) — [GitHub API deezer/spleeter](https://api.github.com/repos/deezer/spleeter)
- **Beat This!**: MIT, v1.1.0(2026-04-14) — [GitHub API CPJKU/beat_this](https://api.github.com/repos/CPJKU/beat_this)

### Inferences
- **우리 상황에 가장 직결되는 것은 as_seg CBM이다.** 마디(bar) 단위로 SSM을 만들고 block 구조를 동적계획법으로 분할하므로 출력 경계가 처음부터 마디 경계다. `get_bars_from_audio_madmom` 대신 Beat This!의 downbeat 쌍 `[(d0,d1),(d1,d2),...]`를 넘기면 madmom NC 모델 파일을 쓰지 않는다. 연산은 CPU의 NumPy 동적계획법이므로 곡당 비용이 낮을 것으로 보인다(미측정).
- madmom NC 이슈: `DBNDownBeatTrackingProcessor` 자체는 HMM 파라미터만 쓰고 pkl 모델 파일을 로드하지 않는 것으로 보인다(추론). 반면 `RNNDownBeatProcessor`/`RNNBeatProcessor`는 NC 모델 파일을 쓴다. 우리 파이프라인이 Beat This! activation + madmom DBN만 쓴다면 NC 모델 파일 의존이 없을 가능성이 높으므로 코드 경로를 확인해야 한다.
- Essentia SBic은 비지도 BIC 분할이라 화자/음색 변화 검출에 가깝고, 송폼 반복 구조는 보지 못한다. AGPL이라서 서버 측 사용에도 소스 공개 의무 해석 이슈가 있으므로 우선순위가 낮다.
- 임베딩을 마디 동기 SSM 특징으로 쓰려면 상업 가능한 조합은 CLAP(Apache-2.0)과 MusicFM(MIT 태그)이다. MERT, MuQ, MAEST는 연구용으로만 써야 한다.
- pychorus는 후렴 1개 구간(시작 시간)만 찾는 2018년 코드라 경계 검출기로는 부적합하다. Spleeter는 구조 분석 기능이 없다(TensorFlow 의존, 2021 이후 릴리스 없음).

### Gaps
- "SpecTNT"(ByteDance) 구조 분석 공개 코드와 가중치는 확인하지 못했다(조사 범위 내에서 공식 저장소를 찾지 못함).
- "msaf-fork"나 "musicstructure"라는 이름의 독립 PyPI 패키지는 조사하지 못했다. ax-le/msaf(MIT, 2024-01)는 CBM을 넣기 위한 포크로 보인다(main에 이미 병합됨).
- BEATs(microsoft/unilm) 가중치 라이선스는 HF API에서 인증 오류로 확인하지 못했다.
- `DBNDownBeatTrackingProcessor`가 모델 파일을 쓰지 않는다는 점은 코드로 검증하지 않은 추론이다.

---

## 6. Kaggle 실행 시 함정

### Takeaway
**Kaggle 이미지의 Python이 가정한 3.10/3.11이 아닐 가능성이 높다.** Kaggle/docker-python main의 Dockerfile은 Colab 런타임(2026-09-17 빌드)을 베이스로 하며 패키지 경로가 `python3.13`이다. 이 경우 MSAF(PyPI), madmom 0.16.1(PyPI), allin1+NATTEN 구버전, SongFormer(py3.10 핀)가 모두 설치 단계에서 깨질 수 있다.

### Cited Findings
- Kaggle GPU 이미지는 `FROM us-docker.pkg.dev/colab-images/public/runtime:release-colab-external-images_20260917-060051_RC00`이고, `ARG PACKAGE_PATH=/usr/local/lib/python3.13/dist-packages`이며, 패키지는 `uv pip install --system`으로 설치한다 — [Kaggle docker-python Dockerfile.tmpl](https://github.com/Kaggle/docker-python/blob/main/Dockerfile.tmpl)
- Docker Hub의 kaggle/python 이미지는 "stale"이고 현행 이미지는 gcr.io/kaggle-gpu-images/python에 있다 — [Docker Hub kaggle/python](https://hub.docker.com/r/kaggle/python)
- madmom 0.16.1과 numpy>=1.24 비호환 — [madmom issue #557](https://github.com/CPJKU/madmom/issues/557). MSAF PyPI와 numpy 2 / scipy 신버전 비호환, 그리고 "build errors with Python >= 3.11" 보고 — [msaf issue #163](https://github.com/urinieto/msaf/issues/163)
- NATTEN 0.20+는 allin1이 쓰는 unfused/RPB API를 제거했고, 0.21.x 휠은 torch 2.8~2.10을 대상으로 한다 — [NATTEN CHANGELOG](https://github.com/SHI-Labs/NATTEN/blob/main/CHANGELOG.md)
- allin1은 MP3 디코딩에 ffmpeg가 필요하다(README: `sudo apt install ffmpeg`) — [all-in-one README](https://github.com/mir-aidj/all-in-one)
- SongFormer는 첫 실행 시 HF Hub에서 MuQ를 다운로드한다. `HF_HOME` 지정을 권장한다 — [SongFormer README](https://github.com/ASLP-lab/SongFormer). 16 GB 카드 OOM — [SongFormer PR #8](https://github.com/ASLP-lab/SongFormer/pull/8)

### Inferences
- **인터넷 의존**: allin1(HF 가중치 + Demucs 가중치 다운로드), SongFormer(MuQ와 MusicFM 다운로드), madmom git 설치, NATTEN 휠 모두 인터넷이 필요하다. 제출이나 오프라인 노트북이라면 휠과 체크포인트를 Kaggle Dataset으로 미리 올려 `pip install --no-index --find-links`로 설치해야 한다.
- **권장 설치 형태(예)**:
  - madmom: `pip install --no-build-isolation git+https://github.com/CPJKU/madmom` (Cython 필요. 빌드 요구사항이 numpy>2이므로 numpy 2 환경에 맞음)
  - MSAF: `pip install git+https://github.com/urinieto/msaf` (cvxopt와 vmo 빌드 실패 시 `--no-deps`로 설치하고 필요한 것만 수동 설치)
  - as_seg: `pip install as-seg` (mirdata와 tensorly도 같이 설치됨. 우리는 `bars`를 직접 주므로 madmom은 불필요)
  - librosa: 이미지 기본 버전 사용. Python 3.13이면 1.0.0도 설치 가능
  - allin1: `pip install allin1 --no-deps` 후 PR #39(순수 PyTorch NA) 패치를 적용하는 것이 NATTEN 빌드 지옥을 피하는 가장 현실적인 경로(검증 필요)
- **긴 오디오(6분 이상)**: SongFormer는 420s 윈도우 × 2모델 × 15 패스에서 OOM이 난다. FP16과 early-exit을 쓰거나 윈도우를 줄여야 한다. allin1과 Demucs도 전곡을 한 번에 처리하므로 VRAM을 관찰해야 한다. SSM 계열(MSAF, librosa, CBM)은 마디 수 N(6분, 120BPM 4/4 ≈ 180마디)에 대해 N×N 행렬이라 메모리 문제가 없다.
- Kaggle 노트북 설정의 "Environment: Pin to original"로 구 이미지를 고정할 수 있지만, 현재 Python 버전은 노트북에서 `python --version`으로 직접 확인하는 것이 가장 확실하다.

### Gaps
- Kaggle 노트북의 실제 Python 버전을 실행으로 확인하지 못했다(로컬과 Kaggle 실행 없이 Dockerfile 경로에서 추론).
- cvxopt, vmo, madmom(main)의 Python 3.13 빌드 성공 여부는 검증하지 못했다.
- allin1 PR #39 경로의 T4 런타임과 정확도 동일성은 검증하지 못했다.

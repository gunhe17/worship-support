I'll research music structure analysis across recent papers, libraries, and practitioner posts, then write a cited report. First I'm loading the research workflow and searching both the web and X.The best open system for labeling intro, verse, chorus, and bridge is **SongFormer** (October 2025, revised April 2026). It is the first model in this line that keeps **pre-chorus** as its own class. Strict boundaries are still only about 65–70% within half a second, audio-only models systematically confuse verse with chorus, and none of the worship products auto-label a raw live recording. They ship human song maps.

Numbers below are not interchangeable. Harmonix cross-validation, SongFormBench, and RWC-Pop use different label maps.

## What to ship for a worship audio feature

Use **SongFormer** for the section timeline, and keep **All-In-One** (`allin1`) only if you also need beats, downbeats, and one global BPM from the same pass. SongFormer does not estimate tempo. Neither model numbers repeated choruses, neither detects a last-chorus key-up, and neither speaks the worship chart vocabulary (post-chorus, turnaround, refrain, vamp).

A workable pipeline for live CCM is:

1. SongFormer boundaries and 8-class labels.
2. A separate key and tempo track on the beat grid. A modulation stays inside the chorus. It is not a new section.
3. If you have CCLI, SongSelect, or Genius lyrics, force-align them and override labels: repeated lyric blocks are choruses, unique blocks are verses, no lyrics is intro, instrumental, or outro.
4. Map the result onto a MultiTracks-style song map and expect a human to rename pre-chorus, tag, and vamp.

## How the field scores this

| Metric | Meaning | What "good" looks like in 2025–26 |
| --- | --- | --- |
| **HR.5F** | Boundary F-measure if the hit is within **0.5 s** | Best reported: **0.703** |
| **HR3F** | Same, within **3 s** | Often **0.78–0.85**. Too loose for a chart that must land on a downbeat |
| **ACC** | Share of time whose **functional** label matches | Best reported: **0.807** (English pop subset), **0.891** (Chinese subset) |

A 0.70 HR.5F still misses about three in ten boundaries by more than half a second. On a 4-minute song that is several sections a music director would move by hand.

## SongFormer (current open state of the art)

Paper: [SongFormer: Scaling Music Structure Analysis with Heterogeneous Supervision](https://arxiv.org/abs/2510.02797) (v3, 8 April 2026). Code and weights: [github.com/ASLP-lab/SongFormer](https://github.com/ASLP-lab/SongFormer), [Hugging Face](https://huggingface.co/ASLP-lab/SongFormer).

It fuses **MuQ** and **MusicFM** at two window lengths, **30 s** (how those encoders were trained) and **420 s** (most of a song). A 4-layer Transformer then predicts boundaries and one of eight labels:

`intro`, `verse`, `pre-chorus`, `chorus`, `bridge`, `inst`, `silence`, `outro`.

Training uses a learned **source embedding** so noisy or partial labels do not wipe out the clean ones. **SongFormDB** is about **14k** songs. **SongFormBench** is 300 expert-checked songs (200 from Harmonix, 100 Chinese), with no train overlap by audio fingerprint. Inference post-processing is the same peak-pick as All-In-One. Runtime is **2–4 seconds per song** on an NVIDIA L40, with no Demucs and no beat tracker. ([paper](https://arxiv.org/html/2510.02797))

Published scores, 7-class evaluation. **Pre-chorus is folded into verse** at test time, because older models have no pre-chorus head. Source: [GitHub README](https://github.com/ASLP-lab/SongFormer) and [Table II](https://arxiv.org/html/2510.02797).

**SongFormBench-HarmonixSet (200 songs)**

| Method | ACC | HR.5F | HR3F |
| --- | --- | --- | --- |
| Harmonic-CNN | 0.680 | 0.559 | — |
| SpecTNT (36 s) | 0.723 | 0.558 | — |
| All-In-One | 0.740 | 0.596 | 0.730 |
| MusicFM (Zhang et al.) | 0.725 | 0.640 | 0.729 |
| MuQ_iter | 0.772 | — | — |
| LinkSeg-7 | 0.780 | 0.630 | 0.762 |
| Temporal adaptation (Zhang 2025) | 0.787 | 0.610 | 0.801 |
| Gemini 2.5 Pro | 0.748 | **0.423** | **0.813** |
| SongFormer, Harmonix only | 0.795 | **0.703** | 0.784 |
| SongFormer, full mix | **0.807** | 0.696 | 0.780 |

**SongFormBench-CN:** full SongFormer **ACC 0.891**, best HR.5F **0.690**. All-In-One falls to HR.5F **0.563**. Gemini HR.5F **0.412**, HR3F **0.833**.

**RWC-Pop (held out):** full SongFormer **ACC 0.814**, HR.5F **0.650**, HR3F **0.804**. LinkSeg is ACC 0.747 / HR.5F 0.648. The Harmonix-only SongFormer already leads HR.5F at **0.651**.

Pitfalls that matter for worship audio:

- Adding the noisier sets (including Gemini labels) **raises ACC and slightly lowers HR.5F**. Gemini function labels were kept. Its boundaries were not, because they are off by up to about **2 seconds**. ([paper, §III-A](https://arxiv.org/html/2510.02797))
- The README calls ACC "boundary detection accuracy." The paper defines it as **framewise label accuracy**. Use the paper.
- At inference the source embedding must be the Harmonix one. Other embeddings change the label schema.
- Songs longer than 420 s are split. A 20-minute live set should be cut on silence first.
- Pre-chorus exists in the model and disappears in the headline metrics. If you need it, score it yourself.
- Studio western pop and Chinese pop are the training domain. A congregational recording is not.

## All-In-One

[Kim and Nam, WASPAA 2023](https://arxiv.org/abs/2307.16425). Package: [mir-aidj/all-in-one](https://github.com/mir-aidj/all-in-one), PyPI `allin1`, [Hugging Face demo](https://huggingface.co/spaces/taejunkim/all-in-one). A 2026 repackage, [`all-in-one-infer`](https://pypi.org/project/all-in-one-infer/), keeps the same model and reports discrete BPM, beats, and segments identical to the madmom backend.

One network predicts **tempo, beats, downbeats, boundaries, and labels** from **Demucs-separated** spectrograms, using dilated neighborhood attention. Labels, from the package:

`start`, `end`, `intro`, `outro`, `break`, `bridge`, `inst`, `solo`, `verse`, `chorus`.

There is **no pre-chorus**. On the authors' Harmonix 8-fold setup, later papers cite structure **HR.5F 0.660** ([Zhang et al., 2025](https://arxiv.org/html/2507.13572v1)). The same system, rescored by SongFormer on the expert 7-class subset, is **ACC 0.740 / HR.5F 0.596 / HR3F 0.730**. The drop is the protocol, not a different checkpoint.

The default `harmonix-all` ensemble is eight folds. The README timed **10 songs, 33 minutes, in 73 seconds** on an RTX 4090. ([README](https://raw.githubusercontent.com/mir-aidj/all-in-one/main/README.md))

Why people still reach for it: it is the only strong open model that also returns a beat grid and one BPM, which is what [@deepfates](https://x.com/deepfates/status/1851009216859029762) demonstrated on Replicate in October 2024 ([model card in the reply](https://x.com/deepfates/status/1851010284636553502)). Joint training helps. The paper's ablation says beats, downbeats, and segments improve each other, and demixing helps structure.

Where it fails on church audio:

- One global BPM. A ritardando, a double-time chorus, or a dragged organ tempo ([@LDSBoomstick](https://x.com/LDSBoomstick/status/2104321466204615153)) becomes a single wrong number, and every boundary that is snapped to that grid moves with it.
- Demucs on a live room pulls the congregation into the vocal stem and smears the "other" stem. Structure was trained on separated studio stems.
- `break` and `solo` are not what a chart calls a turnaround, tag, or vamp.
- First run downloads on the order of **1.5 GB** of weights ([MusicTech Lab, 29 Jan 2026](https://musictechlab.io/blog/music-data/automatic-song-structure-analysis-how-ai-detects-intro-verse-chorus)).

## Other 2024–2026 models

**LinkSeg** (Buisson, McFee, Essid, [ISMIR 2024](https://github.com/morgan76/LinkSeg)). Predicts whether every pair of frames is same-segment, same-section, or different, then a graph-attention layer emits boundaries and labels. Seven classes: intro, verse, chorus, bridge, instrumental, outro, silence. A 9-class checkpoint also exists. On SongFormBench-Harmonix it is second on labels (**ACC 0.780**) and behind SongFormer on strict boundaries (**HR.5F 0.630**). It is good at "these two stretches match" even when the name is wrong. That is useful for numbering Chorus 1 and Chorus 2, and bad when verse and chorus share a groove, which is normal in CCM.

**Temporal adaptation of MusicFM** ([Zhang et al., July 2025](https://arxiv.org/abs/2507.13572)). Stretching a 30-second foundation encoder to 100–180 seconds raises Harmonix **ACC to 0.787** and **HR3F to 0.801**, but **HR.5F falls to 0.610** from MusicFM's 0.640. SongFormer cites this and refuses the tradeoff: keep the 30-second features for edges, add a 420-second stream for form.

**MuQ** ([Zhu et al., Jan 2025](https://arxiv.org/abs/2501.01108)). The iteration variant is reported at Harmonix **ACC 0.772** with no boundary numbers in the SongFormer table. SongFormer uses layer 10 of both MuQ and MusicFM.

**Korzeniowski and Vogl, ISMIR 2025**, [Simple and Effective Semantic Song Segmentation](https://doi.org/10.5281/zenodo.17706573). A CNN on a log-frequency spectrogram plus self-similarity lag matrices. Their label map is the trap for worship charts: **pre-chorus and prechorus become verse, refrain becomes chorus, rap becomes verse**. They also found **up to 22% overlap between SALAMI and RWC-Pop** train and test splits, so older "SOTA on RWC" claims are partly leakage. Their proposed fix is to test on McGill Billboard.

**Cheng, Nakano, and Goto, SMC 2025** ([PDF](https://staff.aist.go.jp/m.goto/PAPER/SMC2025cheng.pdf)). Boundary detection only. A standard self-similarity matrix shows homogeneous sections as blocks and repeats as diagonals. Their repetition-aware matrices make the diagonals look like blocks. A checkerboard kernel on that matrix alone scores **F 0.761 on RWC-Pop**, and a CNN on the stacked matrices beats prior boundary numbers on RWC-Pop, Beatles, and SALAMI. No verse or chorus names.

**Barwise symbolic boundaries** ([Eldeeb and Malandro, Sept 2025](https://arxiv.org/abs/2509.16566)). MIDI piano-roll classifier, **F1 0.77**, better than synthesizing to audio and running an audio segmenter. Only relevant if you already have a chart or MIDI, not a phone recording.

**MIREX 2025** still defines the community task as seven functions: intro, verse, chorus, bridge, inst, outro, and other/silence ([wiki](https://www.music-ir.org/mirex/wiki/2025:Music_Structure_Analysis)). Pre-chorus is outside the official task. That is why papers keep deleting it.

## Self-similarity and MSAF

The classical method is Foote's self-similarity matrix plus a checkerboard kernel slid on the diagonal. Peaks are boundaries. Müller’s tutorial is the clearest account: [TISMIR 2024, novelty functions](https://transactions.ismir.net/articles/10.5334/tismir.202) and the [Audiolabs notebook](https://www.audiolabs-erlangen.de/resources/MIR/FMP/C4/C4S4_NoveltySegmentation.html).

It fails in ways that match worship sets:

- **AAAA** and **ABAB** produce little or no novelty. A chorus-heavy song (verse, chorus, verse, chorus, chorus) is exactly that case. The [structure-feature notebook](https://audiolabs-erlangen.de/resources/MIR/FMP/C4/C4S4_StructureFeature.html) says this outright.
- A short kernel false-triggers on fills and crowd noise. A long kernel eats 2-bar and 4-bar turnarounds, the sections MultiTracks bothers to name.
- Tempo drift bends the diagonal stripes, so repeats stop looking like repeats. Live coding work in 2025 still uses the same chroma, MFCC, and RMS novelty stack and reports the same fragility ([Barate et al.](https://www.researchgate.net/publication/392147345_Structural_Analysis_of_Live_Coding_Performances_Through_Novelty-based_MIR_Methodologies)).

**MSAF** ([Nieto and Bello, ISMIR 2015/2016](https://github.com/urinieto/msaf), [docs](https://msaf.readthedocs.io)) is the library that wraps those algorithms: checkerboard (boundaries only), 2D Fourier magnitude coefficients (labels only), constrained clustering, convex NMF, Laplacian segmentation, ordinal LDA, shift-invariant PLCA, structural features. It scores **hit rate** for boundaries and **pairwise frame clustering** for labels. The labels are **A, B, C**, not verse and chorus. Harmonix itself was first baselined with MSAF ([Nieto et al., ISMIR 2019](https://ccrma.stanford.edu/~urinieto/MARL/publications/ISMIR2019-Nieto-Harmonix.pdf)). A January 2026 production note ranks it "medium" against allin1 "high" and librosa "basic" ([MusicTech Lab](https://musictechlab.io/blog/music-data/automatic-song-structure-analysis-how-ai-detects-intro-verse-chorus)). Use it to propose boundaries when a neural model over-smooths a live tape. Do not use it to name sections.

Peeters' 2023 SSM-loss and novelty-loss ([arXiv:2309.02243](https://arxiv.org/pdf/2309.02243.pdf)) is the learned version of the same idea. It still does not emit functional names by itself.

## Lyrics, then alignment

Audio alone cannot reliably tell verse from chorus. The February 2026 **BASS** benchmark says this directly. Repeated melody and repeated lyrics are the actual cue ([Jang et al.](https://arxiv.org/abs/2602.04085)).

What is published:

- **Lyrics-only chorus detection.** Watanabe and Goto train a sequence labeler on lyric-line self-similarity. A Japanese model transfers to English. Repetition pattern is language-independent ([IEICE 2023](https://www.jstage.jst.go.jp/article/transinf/E106.D/9/E106.D_2022EDP7139/_article)). Fell et al. (COLING 2018) is the older CNN version: exact repeats become chorus, the last short repeat becomes outro ([PDF](https://aclanthology.org/C18-1174.pdf)).
- **SongPrep** (Tan et al., 22 Sept 2025, [arXiv:2509.17404](https://arxiv.org/abs/2509.17404)). The pipeline version runs structure first, then transcribes only verse, chorus, and bridge. On their set, **Whisper WER is 27.7%** and a fine-tuned Zipformer is **25.8%**. A wav2vec2 aligner then stops long instrumental stretches from being called verse or chorus. Their end-to-end model, **SongPrepE2E**, drops structure diarization error from **25.0% to 16.1%** on SSLD-200 and does not need a separator. That paper is aimed at cleaning data for song generation, not at church charts, but the correction trick is the right one.
- **Whisper as an aligner, not a transcriber.** [WEALY](https://arxiv.org/abs/2510.08176) uses Whisper decoder embeddings for lyrics matching. [RefWhisper](https://dl.acm.org/doi/10.1145/3625135.3625154) conditions on incomplete reference lyrics. A readability study found Whisper's line breaks often match lyric lines, and that **running Demucs first can make Whisper worse** ([arXiv:2408.06370](https://arxiv.org/html/2408.06370v1)).
- **SongFormer already does a weak version of this** for part of its training data: YouTube text, checked with the [SOFA](https://github.com/qiuqiao/SOFA) singing aligner, drop the song if more than 10% of segments miss by over 1 second ([§III-A](https://arxiv.org/html/2510.02797)).

For a known worship song the lyrics path is more reliable than another point of ACC. Align the official lyric, mark repeated stanzas as chorus, and use the audio model only for the edges and for sections with no words. It breaks on ad-libs, congregation singing over the vocal, spoken prayer, and "oh" vamps that are not in the CCLI chart.

## Audio LLMs

**Gemini 2.5 Pro**, prompted for a full timeline in the SongFormer protocol: decent labels, poor edges. Harmonix subset **ACC 0.748, HR.5F 0.423, HR3F 0.813**. The authors describe boundaries as coarse, up to about 2 seconds, with format and monotonicity failures that they had to filter. ([SongFormer §I and §IV-D](https://arxiv.org/html/2510.02797))

**BASS** ([arXiv:2602.04085](https://arxiv.org/abs/2602.04085), 3 Feb 2026) tests 14 audio LMs, including Gemini 2.5 Pro, Gemini 2.5 Flash, Qwen3-Omni, Step-Audio-R1, Kimi Audio, Music Flamingo, Audio Flamingo 3, and SALMONN, on 1,993 songs. Structural segmentation is among the worst categories. Lyric transcription is among the best. Findings you can use:

- Asking for the **whole** form beats asking "where are the verses?" The average gap is **7.63 points**.
- Accuracy is highest on the **intro** and falls toward the **outro**.
- **Verse and chorus are the main confusion.** The paper says acoustic information alone should not be expected to separate them.
- The label set they ask for includes **pre-chorus and post-chorus**, which no MIREX model emits.

[@jmacftw](https://x.com/jmacftw/status/2104116197017202796) (27 Sept 2026) describes the pattern that matches these numbers. Classical DSP for spectrogram, chroma, loudness, tempo, and key, with uncertainty flagged, and only then a small Gemini call for open questions. He calls it "as close as we can get without models trained specifically" for hearing. [@Kujar3](https://x.com/Kujar3/status/2103887986748219568) (26 Sept 2026) watched an agent separate stems, read the spectrogram, and run a timed lyric extractor. That stack is more honest than handing the mix to an audio LLM and trusting the timestamps.

## Products worship teams actually use

None of these is a published segmenter. They are the **label schema and the UX** your output has to match.

**Moises Sections.** Auto-detects sections and loops them on a downbeat. The help page lists default names such as intro, chorus, and verse, with rename on paid plans ([help article](https://help.moises.ai/hc/en-us/articles/10138829000988-How-do-I-use-Sections), 2 Oct 2023). The marketing page also says default names "Sections A, B, and C" and explicitly mentions church musicians facing songs without a clear structure ([song-parts](https://moises.ai/features/song-parts/), [announcement](https://moises.ai/newsroom/product-announcements/new-song-sections-feature/)). No precision, recall, or label set has been published. The Apple developer story is about stem separation, not form ([Apple, June 2025](https://developer.apple.com/articles/moises/)). Treat it as a product existence proof, not a benchmark.

**MultiTracks Playback and ChartBuilder.** Sections are authored on the **downbeat of a bar**. A newly uploaded cloud song is **one section named Intro** until a person adds markers ([how-to](https://helpcenter.multitracks.com/en/articles/5077698-how-to-create-edit-cloud-song-sections-in-playback)). Catalog songs arrive with a map. The vocabulary is wider than any MIR paper: numbered chorus, pre-chorus, and bridge, plus **post-chorus, turnaround, refrain, rap**, and short interludes ([blog, 18 Feb 2019](https://www.multitracks.com/blog/updated-song-sections-guide-cues)). Playback also has a **Click** section and a **Count Off** ([click sections](https://helpcenter.multitracks.com/en/articles/6813885-adding-click-sections-within-a-song-in-playback)). Guide cues speak the next section. Premium users reorder, delete, and loop sections, and ChartBuilder follows that map ([custom arrangements](https://helpcenter.multitracks.com/en/articles/6437439-how-to-create-custom-arrangements-in-playback), [ChartBuilder](https://helpcenter.multitracks.com/en/articles/5132233-chartbuilder-user-guide)). This is the target format, not an algorithm.

**Loop Community Prime.** Purchased tracks ship with section blocks. Custom audio still needs manual markers on the bar grid. Users then drag, delete, and duplicate sections, and band cues update ([arrangement tutorial](https://loopcommunity.com/blog/2019/08/how-to-customize-your-arrangement-in-prime/), [2024 charts video](https://www.youtube.com/watch?v=J2RAgGPfMmY)). Rehearse can loop a section. The FAQ says Rehearse works inside WorshipTools, and **Planning Center integration is not available yet** ([FAQ](https://loopcommunity.com/en-US/faq)). Their own X post (7 April 2026) is about **custom** cues so a band can follow a mystery medley, not about auto-segmentation ([@LoopCommunity](https://x.com/LoopCommunity/status/2041533383478579589)).

**Planning Center Services.** Structure is text. An arrangement has a **sequence** (Intro, Verse 1, Chorus, Bridge x2), parsed from chord-chart headings such as `[Verse]` and `[Chorus]`. The API returns `{label, lyrics}` from that chart, not from audio ([ArrangementSections](https://api.planningcenteronline.com/docs/apps/services/versions/2018-11-01/vertices/arrangement_sections), [Lyrics and Chords editor](https://help.planningcenter.com/en/139440-use-the-lyrics---chords-editor.html)). The editor still supports **mid-song key changes**, which is how a last-chorus key-up should be stored ([2011 release note](https://www.planningcenter.com/blog/2011/01/lyrics-chords-and-a-little-more), still in the editor's Options menu). BPM and meter are typed fields. Charts import from MultiTracks, SongSelect, and PraiseCharts ([Services](https://www.planningcenter.com/services)). A 2021 walkthrough shows why Chorus 1 and Chorus 2 exist: the chords may match while the words do not ([video](https://www.youtube.com/watch?v=rMv-MmqRxqw)).

## What people on X are actually saying

X search from 2024 through today did **not** turn up technical threads from the MIR authors (Kim, Nieto, McFee, the SongFormer group). The public conversation is practitioners and product demos.

- **The model musicians noticed** is All-In-One, not SongFormer. @deepfates (28 Oct 2024, about 2,400 likes) posted that a Replicate model separates stems, finds BPM, and marks verse and chorus faster than the song plays. [Post](https://x.com/deepfates/status/1851009216859029762), [link](https://x.com/deepfates/status/1851010284636553502). A reply is the Audacity baseline: people used to do this by hand ([@daniel_nguyenx](https://x.com/daniel_nguyenx/status/1851081098262167592)).
- **Builders do not trust one black-box call.** Spectrogram plus chroma plus a lyric timer, then a light Gemini pass. [jmacftw](https://x.com/jmacftw/status/2104116197017202796), [Kujar3](https://x.com/Kujar3/status/2103887986748219568).
- **Worship posts are about whether the room can sing the arrangement**, not about segmentation accuracy. Brant Hansen (22 Dec 2025) tells musicians to pick a singable key, turn down, and stop rearranging familiar songs ([post](https://x.com/branthansen/status/2003200553443348883)). Svigel (7 Sept 2026) and Fiene (1 Sept 2026) make the same point about embellishment and range ([Svigel](https://x.com/Svigel/status/2096798910274494566), [Fiene](https://x.com/HansFiene/status/2094736394060996854)). That is why a detected map that renames the chorus, or that misses the key-up, is a product failure even when ACC looks fine.
- **Vendor claims without numbers** are easy to find. @itsshara_ai (26 July 2026) says OiiOii splits a track into intro, verse, and chorus before a video edit ([post](https://x.com/itsshara_ai/status/2081266192816468323)). There is no evaluation attached.

## Pitfalls specific to live worship recordings

- **Last-chorus key-up.** Novelty and stem energy both spike, so models insert a boundary and often name the new stretch bridge or outro. The function is still chorus. Store it as chorus plus a key change, the way Planning Center already does.
- **Pre-chorus, post-chorus, turnaround, tag.** Harmonix annotations contain these words ([label histogram](https://ccrma.stanford.edu/~urinieto/MARL/publications/ISMIR2019-Nieto-Harmonix.pdf)). All-In-One and MIREX delete them. SongFormer keeps pre-chorus and then hides it in the official score. MultiTracks treats them as first-class.
- **Chorus 1 versus Chorus 2.** Same chords, different words. Audio models emit one class. Only lyrics, or LinkSeg-style "same section" links plus lyric identity, can number them.
- **Vamp, prayer, crowd, spoken count-off.** They violate the block assumption. MSAF will over-segment. A neural model trained on studio pop will call the noise intro, break, or inst.
- **Domain shift is already measured.** All-In-One's strict boundary score goes from 0.596 on the revised Harmonix subset to **0.563** on SongFormBench-CN. A phone recording from a sanctuary is a larger shift than that.
- **Do not quote a single accuracy.** 0.660, 0.596, and 0.703 are three different evaluations of "how good is structure analysis." For a charting tool, HR.5F and a per-class verse/chorus error are the numbers that predict user edits. HR3F will look fine and still be a bar late.

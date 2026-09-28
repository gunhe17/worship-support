I'll research 2024–2026 beat, downbeat, and tempo tracking from MIR papers, libraries, and what practitioners report, then turn that into a cited report. Starting with X and the web in parallel.**For worship and CCM audio, do not ship one global BPM.** Track beats with Beat This! (no dynamic Bayesian network), and on steady studio tracks cross-check that grid with All-In-One plus a TempoCNN tempo vote. Surface half-time, double-time, and triple candidates instead of hiding them. Published beat F1 is high on clean pop and still fails when the pulse is ambiguous or the tempo moves.

Nothing below was measured on congregational live recordings. The closest public sets are Harmonix and Yamaha J-pop (produced pop) and SMC / ASAP (ambiguous pulse, classical tempo change).

## How to read the numbers

Beat F1 (±70 ms) only asks whether a beat landed near a label. It can look excellent while the tracker is on the offbeat or at half or double time for long stretches.

- **CMLt** requires the correct metrical level and an unbroken beat-to-beat chain.
- **AMLt** still requires continuity, but it accepts half-time, double-time, and offbeats.
- **Acc1** is global tempo within 4%. **Acc2** also accepts factors of 2 and 3 (and their reciprocals). The Acc2−Acc1 gap is the usual “octave error” report. Hendrik Schreiber’s definition is in his ISMIR 2017 paper: [archives.ismir.net/ismir2017/paper/000137.pdf](https://archives.ismir.net/ismir2017/paper/000137.pdf). Metric definitions: [tempobeatdownbeat.github.io/tutorial/intro.html](https://tempobeatdownbeat.github.io/tutorial/intro.html).

On Yamaha’s private pop sets at MIREX 2025, Beat This! shows the gap clearly. J-pop beat F1 is **94.00**, but CMLc is **69.66** and AMLt is **89.57**. Local hits are common; a stable correct tactus is not. Source: [music-ir.org/mirex/wiki/2025:Audio_Beat_Tracking_Results](https://music-ir.org/mirex/wiki/2025:Audio_Beat_Tracking_Results) (19 Sep 2025). MIREX also notes Beat This! there used 999 GTZAN songs versus 993 in the paper, so the GTZAN F1 (**89.02**) is not identical to the paper’s **89.1**.

## What is actually state of the art

### Beat This! — default beat and downbeat model

Francesco Foscarin, Jan Schlüter, and Gerhard Widmer, ISMIR 2024. Convolutional frontend plus a rotary transformer (~20M parameters, ~78 MB checkpoints `final0`–`final2`). It picks peaks at 50 frames/s inside ±70 ms, with no DBN. Code: [github.com/CPJKU/beat_this](https://github.com/CPJKU/beat_this). Paper: [arxiv.org/abs/2407.21658](https://arxiv.org/abs/2407.21658).

Held-out GTZAN, mean of three seeds, from the paper’s Table 2:

| System | Beat F1 | Beat CMLt | Beat AMLt | Downbeat F1 | Downbeat CMLt | Downbeat AMLt |
|---|---:|---:|---:|---:|---:|---:|
| Hung et al. 2022 (SpecTNT+TCN+DBN, not open) | 88.7 | 81.2 | 92.0 | 75.6 | 71.5 | 88.1 |
| Beat This! | **89.1±0.3** | 79.8±0.6 | 89.8±0.4 | **78.3±0.4** | 67.3±0.8 | 79.1±0.4 |

It wins F1 and loses continuity. The authors say the network inserts non-periodic beats on hard pieces, and that putting the madmom DBN back raises some continuity scores while **lowering F1**, because the DBN rewrites predictions that fall outside its assumptions. A ~2M “small” model still matches prior F1.

8-fold scores that matter for this product, same paper: Ballroom beat/downbeat F1 **97.5 / 95.3** (stable dance meter works). Harmonix **95.8 / 90.7**. Beatles **94.5 / 88.8**. SMC beats only **62.7**. ASAP piano **76.3 / 61.2**. RWC Classical **77.1 / 66.3**. They discarded ASAP’s rubato annotations, so expressive classical is still the failure mode even after that.

Why this is the right live model: the DBN used by almost every previous “SOTA” system assumes tempo inside **[55, 215] BPM**, beats per bar in **{3, 4}**, one tempo-variability setting tuned on pop/rock/dance, and no mid-piece meter change. Beat This! was trained with time-signature changes and high tempo variation specifically to drop those constraints. Files longer than 30 s are split into **non-overlapping 30 s chunks and concatenated**. That follows a local tempo push, and it can also phase-glitch at the chunk boundary.

Pitfalls: downbeats are weaker than beats (GTZAN downbeat CMLt 67.3). GTZAN itself has bad labels (`jazz.00000`, `jazz.00002`, `blues.00015`, and others listed in the paper). MIREX 2025 marks the Beat This! SMC number (**F1 71.81**) as trained on SMC, so it is not a generalization score; the paper’s 8-fold **62.7** is the honest one. KG-ApolloBeats’ GTZAN F1 **92.53** is starred as trained on GTZAN. The fair KG submission (ApolloBeats 2) is **88.21**, below Beat This!. Yamaha’s own BeatU system is stronger on Yamaha J-pop (**F1 96.58**, CMLt **94.46**) and weaker on GTZAN (**84.93**) and SMC (**53.14**). Treat BeatU as in-domain, not as a general replacement. No public BeatU weights showed up in these sources.

### All-In-One — use when you also need the section map

Taejun Kim and Juhan Nam, WASPAA 2023. One ~300K-parameter model: Demucs stems in, madmom DBN out, plus segment boundaries and functional labels (intro, verse, chorus, bridge, outro). Paper: [arxiv.org/abs/2307.16425](https://arxiv.org/abs/2307.16425). Code: [github.com/mir-aidj/all-in-one](https://github.com/mir-aidj/all-in-one).

Harmonix 8-fold, their Table 1 (western pop, the closest public proxy to studio CCM):

| | Beat F1 | CMLt | AMLt | Downbeat F1 | CMLt | AMLt | Boundary HR.5F | Label PWF | Sf |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| All-In-One | **0.958** | 0.913 | 0.964 | **0.915** | 0.873 | 0.932 | **0.660** | **0.738** | 0.769 |
| TCN + demix (Böck & Davies family) | 0.946 | 0.898 | 0.950 | 0.894 | 0.850 | 0.919 | 0.619 | 0.715 | 0.738 |

Removing demixed inputs “drastically decreases” all four tasks. Joint beat/downbeat/boundary training helps; the structure-label head is more like long-term timbre and does not help downbeats the same way. It still uses the madmom DBN, so it inherits the [55, 215] BPM and {3, 4} bar-length assumptions Beat This! removed. Harmonix-only training, no extra data. A boundary F1 of 0.66 at ±0.5 s means section edges are useful, not bar-accurate. MIREX 2025 structure: a MusicFM baseline trained on Harmonix scored HR.5 **0.644**; an “All-in-One variant” trained on 6k external songs scored accuracy **0.720** but HR.5 only **0.590** ([mirex structure results](https://music-ir.org/mirex/wiki/2025:Music_Structure_Analysis_Results)).

People are already running this in production as a black box. On 28 Oct 2024, @deepfates (2.4k likes) pointed at a Replicate port that “take[s] apart a song into separate tracks, find[s] the bpm and identif[ies] the verse and chorus” faster than listening: [x.com/deepfates/status/1851009216859029762](https://x.com/deepfates/status/1851009216859029762), model link in [the follow-up](https://x.com/deepfates/status/1851010284636553502). The maintained port is [replicate.com/sakemin/all-in-one-music-structure-analyzer](https://replicate.com/sakemin/all-in-one-music-structure-analyzer) (about 249k runs, ~67 s on an A100). That BPM is derived from the beat grid, not a separate tempo head.

### madmom — still the post-processor, not the 2024 detector

Sebastian Böck et al. RNN ensemble plus a DBN/HMM. `DBNBeatTrackingProcessor` defaults: **min_bpm 55, max_bpm 215, transition_lambda 100**. Higher lambda means “prefer a constant tempo from one beat to the next.” Docs: [madmom.readthedocs.io](https://madmom.readthedocs.io/en/latest/modules/features/beats.html). Downbeat tracking **requires** `beats_per_bar`; the usual list is 3 and 4, and the DBN models **one bar length at a time**, so it cannot change meter ([CPJKU/madmom#413](https://github.com/CPJKU/madmom/issues/413)). On that issue, half-length bars (a 2-beat turnaround into a chorus) make it flip toward 6-time, or stay in 4 and land 50% of the bars out of phase.

BeatNet’s 2021 comparison, same DBN family, GTZAN offline: Böck beat/downbeat F1 **79.09 / 51.36** versus BeatNet+DBN **80.64 / 54.07** ([arxiv.org/abs/2108.03576](https://arxiv.org/abs/2108.03576)). That is a different generation from Beat This!’s 89.1 / 78.3.

PyPI `madmom 0.16.1` breaks on Python ≥ 3.10 and NumPy ≥ 1.24. Beat This! and BeatNet both tell you to install `git+https://github.com/CPJKU/madmom.git` ([BeatNet README](https://github.com/mjhydri/BeatNet)). On a maintained GitHub thread, tightening `min_bpm`/`max_bpm` around the true tempo still left a **2× beat rate**; the suggested knobs are a higher `transition_lambda` when tempo really is constant, or clipping the activation, not “the BPM range will save you” ([discussion #503](https://github.com/CPJKU/madmom/discussions/503)). A 60 s file was reported at ~9.6 s of beat tracking on one CPU ([issue #403](https://github.com/CPJKU/madmom/issues/403)).

Chiu, Müller, Davies, Su, and Yang (IEEE/ACM TASLP 2023) show the madmom HMM **assuming a slower, stable tempo and ignoring true local peaks** on Chopin mazurkas and ASAP. Even an oracle activation does not fully fix that HMM. Beat This! cites this as the reason a DBN is the wrong post-process for tempo variation: [mir.dei.uc.pt/pdf/Journals/MERGE/TASLP_2023_Chiu.pdf](https://mir.dei.uc.pt/pdf/Journals/MERGE/TASLP_2023_Chiu.pdf).

### BeatNet and BEAST — only if you need causal, low-latency tracking

You are analyzing a file, so offline is the right mode. Online numbers are much worse, especially downbeats.

BeatNet (Heydari, Cwitkowitz, Duan, ISMIR 2021), causal CRNN plus a particle filter, no time-signature input. GTZAN online beat/downbeat F1 **75.44 / 46.49**; Ballroom online **77.41 / 47.45**. Paper: [arxiv.org/abs/2108.03576](https://arxiv.org/abs/2108.03576). BeatNet+ (TISMIR 2024) retrains for drum-light and sung audio and reports GTZAN **80.62 / 56.51** against BeatNet’s 75.44 / 46.69 in the project README: [transactions.ismir.net BeatNet+](https://transactions.ismir.net/articles/10.5334/tismir.198), [BeatNet-Plus README](https://github.com/mjhydri/BeatNet-Plus).

BEAST (Chang and Su, ICASSP 2024), streaming transformer, still uses an online DBN. On GTZAN at 46 ms latency: beat/downbeat F1 **80.04 / 46.78**. At 743 ms: **83.65 / 52.54**. BeatNet’s 75.44 / 46.49 is the baseline they beat. Table: [arxiv.org/html/2312.17156v3](https://arxiv.org/html/2312.17156v3). The IEEE abstract’s 52.73 downbeat figure is a different operating point than the 46 ms row ([ieeexplore 10446611](https://ieeexplore.ieee.org/document/10446611/)).

### TempoCNN / Essentia — global BPM with a confidence, not a beat grid

Schreiber and Müller, ISMIR 2018, “a single-step CNN.” Essentia runs the exported graphs (`deeptemp-k16-3.pb` and the DeepSquare family) on **12 s slices, 6 s hop**, and takes a **majority vote**. Essentia’s own tutorial says that vote “is only recommended when a constant tempo can be assumed,” and that local BPMs come with probabilities you should keep: [essentia.upf.edu/tutorial_rhythm_beatdetection.html](https://essentia.upf.edu/tutorial_rhythm_beatdetection.html). Package: [github.com/hendriks73/tempo-cnn](https://github.com/hendriks73/tempo-cnn).

Their 2018 model, strict global tempo: Combined Acc1 **74.2%**, Acc2 **92.1%** ([ISMIR 2018 slides](https://files.speakerdeck.com/presentations/997571f8706e4404b79bc16fa4d84b10/A-13_141_schreiber.pdf)). A later comparison table puts schr at Combined Acc1 **74.2** / Acc2 **92.1**, böck (madmom tempo) at **69.5 / 93.6**, and a 2021 multi-scale model at **79.8 / 91.9** ([arxiv.org/pdf/2109.01607](https://arxiv.org/pdf/2109.01607)). Per-set Acc1 from that table: Ballroom schr **92.0**, GTZAN **69.4**, GiantSteps **73.0**, **SMC 33.6**. SMC is the “there is no single tempo” set (Holzapfel et al.). About 18 points of Combined estimates are saved only by allowing ×2 or ×3. DeepSquare, a later Schreiber model, reaches Ballroom Acc1 **92.4%** ([arxiv.org/pdf/1903.10839](https://arxiv.org/pdf/1903.10839)).

Essentia’s older `RhythmExtractor2013` still returns several BPM hypotheses with strengths. That multi-hypothesis output is what you want on screen. The CNN is the better single guess when the tempo is actually constant.

### librosa — a baseline people still ship

`librosa.beat.beat_track` is Ellis’s 2007 dynamic-programming tracker: onset strength, one tempo from autocorrelation, then peaks consistent with that tempo. Defaults include `start_bpm=120` and `tightness=100`. Docs: [librosa beat_track](https://librosa.org/doc/main/api/generated/librosa.beat.beat_track.html). The maintainers’ own advanced tutorial says a single tempo “is not well suited for songs that have radical shifts in tempo, e.g., entire sections that speed up or slow down”: [plot_dynamic_beat](https://librosa.org/doc/main/auto_tutorials/03-advanced/plot_dynamic_beat.html). There is a time-varying path (`librosa.feature.tempo(..., aggregate=None)` passed back in as `bpm`), and it is off by default. `std_bpm` defaults to 1.0, a very peaky prior around 120.

Schreiber, answering a user whose 146 BPM track came back as 73.5, calls this the octave error and points them at TempoCNN and Essentia rather than more librosa preprocessing: [stackoverflow.com/a/61630189](https://stackoverflow.com/a/61630189). As of August 2024, production scripts were still breaking because 0.10.2 returns tempo as a length-1 array, not a float ([librosa#1867](https://github.com/librosa/librosa/issues/1867)). On 27 Sep 2026 a practitioner described a real edit pipeline as “librosa gave the beat grid (129 BPM)” after Demucs and Whisper: [x.com/RubenHorbach/status/2104095433819615272](https://x.com/RubenHorbach/status/2104095433819615272). That is evidence of what people reach for, not of accuracy. MIREX’s classical baseline on the same 2025 page (QM Tempo Tracker, CD1) scores GTZAN F1 **81.19** and SMC F1 **33.66**, in the same band as a careful DSP tracker and far under Beat This! on SMC.

### 2025 papers that are not drop-in replacements

BeatFM (Ru et al., ICME 2025) fine-tunes MERT or MusicFM. On GTZAN their MusicFM variant reports downbeat F1 **79.6** against a Beat This! number of **75.5**, and the MERT variant reports beat CMLt **82.7** against **79.9**. Those Beat This! figures match the paper’s smaller or limited-data row, not the full model’s downbeat F1 of **78.3**. The arXiv abstract says “Early draft for discussion only… conclusions subject to change”: [arxiv.org/abs/2508.09790](https://arxiv.org/abs/2508.09790). No production weights turned up. “Beat tracking as object detection” (Oct 2025) reports competitive, not better, numbers: [arxiv.org/abs/2510.14391](https://arxiv.org/abs/2510.14391).

## Octave and half-time errors

Two different mistakes get called “double time.”

1. **Metrical-level error.** The tracker locks to the tatum, the backbeat, or the bar instead of the tactus. Acc2 exists because this is the dominant tempo bug. On the Combined tempo sets, letting ×2 and ×3 through moves accuracy from the mid-70s to the low-90s ([arxiv.org/pdf/2109.01607](https://arxiv.org/pdf/2109.01607)). Beat This! is explicit that AMLt is a weak test of this, because it assumes the meter never changes and that a bar always divides by 2 or 3 ([arxiv.org/abs/2407.21658](https://arxiv.org/abs/2407.21658), §4.3).
2. **Half-time feel at a constant click.** The grid BPM does not change. The snare moves to beat 3; hats and the subdivision stay on the original clock. Wikipedia: [en.wikipedia.org/wiki/Half-time_(music)](https://en.wikipedia.org/wiki/Half-time_(music)). Drummer-facing version: [drumhelper.com](https://drumhelper.com/learning-drums/half-time-vs-double-time-in-music/). A detector that trusts snare onsets will report half the chart tempo. One that trusts hats will report the click, or double it.

Worship drummers already live on that ambiguity. A Worship Solutions lesson on Kari Jobe’s “Forever” sets the metronome at **76 BPM** and then tells the drummer to practice the same song at **152**, because a quarter-note click is so spacious that the worship leader and the acoustic guitar drift, while an eighth-note click locks the hat: [worshipsolutions.com/how-to-play-drums-with-a-metronome](https://www.worshipsolutions.com/how-to-play-drums-with-a-metronome). A 2024 worship-drum lesson treats “halftime feel” as a normal chorus groove, not a tempo change: [youtube.com/watch?v=khEIYHqcBP4](https://www.youtube.com/watch?v=khEIYHqcBP4). A Japanese drummer posting a halftime fill on 27 Jul 2026 states the tempo as **60 BPM**, i.e. the slow pulse, not the subdivision: [x.com/HITSUTA/status/2081688630385598884](https://x.com/HITSUTA/status/2081688630385598884).

DJ software shows the same failure in public. During Grimes’s April 2024 Coachella set, imported tracks were at double tempo ([x.com/shane1409/status/1779344894500254104](https://x.com/shane1409/status/1779344894500254104)). Working DJs called it a known Rekordbox behavior, with the fix “divide by 2,” and said to drop sync: [x.com/KPopPapi/status/1779482018444636468](https://x.com/KPopPapi/status/1779482018444636468), [x.com/SamBingaMusic/status/1779570695829156111](https://x.com/SamBingaMusic/status/1779570695829156111), [x.com/dirtmonkeymusic/status/1779855394744983782](https://x.com/dirtmonkeymusic/status/1779855394744983782). The same producer said tempo-change songs make sync “more of a chore than it sounds” ([follow-up](https://x.com/dirtmonkeymusic/status/1779922197986865439)). Later posts are the same bug from the booth: “bpm ×2, had to half them one by one” ([x.com/chairkicker/status/2052501882816381154](https://x.com/chairkicker/status/2052501882816381154), 7 May 2026); “Rekordbox half-times my higher BPM stuff” ([x.com/zakunuva/status/1910920413942522026](https://x.com/zakunuva/status/1910920413942522026), 12 Apr 2025). Halving or doubling inside Rekordbox can also wipe ID3 metadata ([x.com/BillyLane/status/1971574993650581752](https://x.com/BillyLane/status/1971574993650581752), 26 Sep 2025).

madmom’s floor of 55 BPM makes slow half-time ballads (high 40s to low 50s) illegal, so the DBN would rather lock an octave up. Constraining the range does not reliably stop that, per discussion #503 above.

**Practical rule:** always return BPM, BPM/2, and BPM×2, plus the ×3 and ÷3 pair when the IOI histogram is trimodal. Pick the chart tempo as the pulse a metronome would click for the band, and show the other candidates when local windows disagree. TempoCNN’s per-window probabilities are a ready-made confidence. Beat This! IOI variance across the 30 s chunks is the other.

## Tempo drift in live recordings

A single scalar BPM is the wrong object for a live worship take.

- The DBN’s `transition_lambda` (default 100) is an exponential penalty on tempo change. It is why madmom sounds stable on click tracks and why it **skips true beats** when the performance speeds up, as Chiu et al. showed even with perfect activations.
- Beat This! refuses a global-tempo multi-task head for the same reason: “it assumes an (almost) constant tempo… which is not the case for many kinds of music” ([arxiv.org/abs/2407.21658](https://arxiv.org/abs/2407.21658), §2). The cost is those non-periodic insertions and the 30 s seams.
- Essentia tells you not to majority-vote TempoCNN unless tempo is constant. On a live file, keep the local 12 s estimates and treat disagreement as the result.
- librosa’s default tracker tolerates “small” fluctuation around one tempo and tells you to pass a tempo curve yourself if sections actually change speed ([dynamic-beat tutorial](https://librosa.org/doc/main/auto_tutorials/03-advanced/plot_dynamic_beat.html)).
- SMC, built by sampling pieces where listeners disagree or the tempo moves, still sits at beat F1 **62.7** for Beat This! and Acc1 **33.6** for TempoCNN. That is the ceiling to expect on drum-less intros, congregational noise, and rubato piano, not Harmonix’s 0.96.
- Human evidence, not a measured “last chorus +4 BPM” (I did not find a 2024–2026 study of that): the same worship team says a song that felt like 78 two years ago may be 85 now ([worshipchordbook.com/tools/bpm-tap](https://worshipchordbook.com/tools/bpm-tap)), and the drumming guide’s instruction is “don’t chase the click; reset on the next downbeat” ([worshiponline.com/worship-drumming-guide](https://worshiponline.com/worship-drumming-guide/), 4 Apr 2026). Drift is normal. A tracker that cannot represent it will either average through the push or octave-flip when the chorus hats get busier.

A key change into the last chorus does not change the beat period. It does change the arrangement density, which is exactly when half-time versus double-time feel tends to flip. Run tempo **per section** after you have boundaries, not once per file.

## Compound meter (6/8)

Musicians do not count fast 6/8 as six. The beat is the dotted quarter, two beats per bar; the eighth note is the division. Slow 6/8 is often conducted in six. Open Music Theory: [viva.pressbooks.pub](https://viva.pressbooks.pub/openmusictheory/chapter/compound-meters-and-time-signatures/). Same distinction, with the slow-versus-fast conducting switch: [Baylor rhythm text](https://openbooks.library.baylor.edu/rhythm/chapter/2/).

That is a factor-of-3 error, which Acc2 forgives and a chart UI must not. A 6/8 song felt in two at dotted-quarter = 70 is an eighth-note pulse of 210, right at madmom’s default ceiling of 215, so the DBN is pushed to pick the quarter (≈105, neither the musician’s beat nor a clean octave) or to clip. `beats_per_bar=[3, 4]` cannot represent “two dotted quarters.” Passing `2` is possible but explodes an already large state space (3-plus-4 is already ~26k HMM states, [#413](https://github.com/CPJKU/madmom/issues/413)), and the RNN was not trained as a 6/8 specialist.

Beat This! can emit a varying number of beats per bar because it has no DBN meter list. It still only knows the levels present in the annotations. Ballroom triple meter is a solved case for it (downbeat F1 95.3) because waltz tactus is consistent and percussive. A slow worship 6/8 with a hat on every eighth is the unsolved case: three plausible tactus rates, and the “correct” one depends on tempo and on whether the band counts in two or in six.

DJs already do this conversion by hand. @RamonPang (17 Sep 2024) describes hitting a transition from **212 BPM in 5/4** to **169.6 BPM in 4/4** “on the triplet”: [x.com/RamonPang/status/1836126340984259007](https://x.com/RamonPang/status/1836126340984259007). 212 × 4/5 = 169.6. The usable tempo is a meter conversion, not the raw detector output.

## What people on X say works in production

MIR researchers are thin on X in 2024–2026; the concrete production talk is from DJs and people wiring pipelines.

| Who | What they trust | URL |
|---|---|---|
| @deepfates, Oct 2024 | All-In-One on Replicate for stems + BPM + verse/chorus, as a single call | [status/1851009216859029762](https://x.com/deepfates/status/1851009216859029762) |
| @RubenHorbach, 27 Sep 2026 | Demucs, then Whisper, then **librosa** for a 129 BPM grid so cuts land on beats | [status/2104095433819615272](https://x.com/RubenHorbach/status/2104095433819615272) |
| @jmacftw, 27 Sep 2026 | DSP first (spectrogram, chroma, loudness, **tempo and key with an uncertainty flag**), LLM only to describe. “None of that takes a model call.” | [status/2104116197017202796](https://x.com/jmacftw/status/2104116197017202796) |
| @dirtmonkeymusic, @KPopPapi, @chairkicker, @zakunuva, 2024–2026 | Rekordbox will double or half the tempo; the working fix is ÷2 or ×2 by hand, then leave sync off if the song changes tempo | [dirtmonkey](https://x.com/dirtmonkeymusic/status/1779855394744983782), [KPopPapi](https://x.com/KPopPapi/status/1779482018444636468), [chairkicker](https://x.com/chairkicker/status/2052501882816381154), [zakunuva](https://x.com/zakunuva/status/1910920413942522026) |
| @MireloAI, 10 Jul 2026 | Commercial audio-to-MIDI from the full mix, with chords, key, **and tempo** as context, not as the product | [status/2075536492177354771](https://x.com/MireloAI/status/2075536492177354771) |

The pattern is consistent with the papers. Practitioners want one BPM they can sync to, they know it will be wrong by a factor of two, and they correct it manually. Researchers who publish the strongest F1 (Foscarin et al.) are the ones telling you that a single tempo and a {3, 4} DBN are the wrong model for anything that drifts or changes meter.

## A concrete setup for this feature

Studio CCM, click or tight band, you also need Intro › Verse › Chorus:

1. All-In-One for boundaries, labels, beats, and downbeats.
2. TempoCNN local votes on the same file. If the median inter-beat interval and the TempoCNN majority disagree by ~2 or ~3, show both and do not auto-pick.
3. Optionally run Beat This! with `--dbn` only as a continuity check. If the DBN grid and the raw grid diverge, the track is outside the DBN’s assumptions; keep the raw grid.

Live recording, drum-less intro, spontaneous chorus, tempo push:

1. Beat This! `final0` **without** the DBN.
2. Tempo curve = median inter-beat interval inside each 30 s chunk, then again inside each All-In-One section if you run it only for labels. Do not majority-vote the whole file.
3. Confidence = fraction of TempoCNN windows that land on the same octave, plus beat-to-beat IOI coefficient of variation. SMC-like material should come back as “unstable,” not as 128.00.
4. Meter hypothesis from downbeat spacing (2, 3, 4, 6). If spacing says 2 and the eighth-note energy is strong, label it compound (felt in two) rather than “BPM ×3.”
5. Half-time flag: snare/backbeat period ≈ 2 × beat period while hats continue at the beat or the eighth. Report the click BPM and the feel, the way the 76-vs-152 lesson does.

Do not use librosa’s default `beat_track` as the source of the number you store. It is fine as a tempogram picture. Do not clamp to [55, 215] or to 4/4 before you have looked. Downbeat F1 is the weak number in every system above (high 70s offline on GTZAN, high 40s online); section labels should come from a structure model, not from “every fourth beat.”

## Gaps that will show up on your files

- No public beat dataset is worship, congregational, or “live board mix with spoken intro.” Harmonix/J-pop numbers will overstate accuracy on those files. SMC (~63 beat F1) and ASAP downbeats (~61) are the conservative expectation.
- Annotation noise is large enough that Foscarin et al. published corrected labels ([github.com/CPJKU/beat_this_annotations](https://github.com/CPJKU/beat_this_annotations)) and listed GTZAN files experts would not agree on.
- From 2026, MIREX will disallow training on GTZAN. Any model whose only claim is a GTZAN F1, especially a starred one, is not a reason to switch.
- BeatFM’s continuity improvement is the right thing to watch, and the paper tells you not to treat the conclusion as final.

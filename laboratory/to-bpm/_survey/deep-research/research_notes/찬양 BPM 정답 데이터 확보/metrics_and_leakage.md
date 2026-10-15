# Evaluation metrics, protocols, and training-data leakage for tempo / beat / downbeat tracking (as of Oct 2026)

Scope: 14 methods: Beat This! final0/small0 with and without DBN, madmom RNN+DBN beat/downbeat, madmom tempo, BeatNet, librosa beat_track/tempo/PLP, Essentia RhythmExtractor2013 multifeature/degara, PercivalBpmEstimator, TempoCNN, and DeepRhythm. Test data: new full-length worship songs plus public datasets.

---

## 1. Metric definitions, standard tolerances, and mir_eval implementation

### Takeaway
Use `mir_eval.beat.evaluate` for beats and downbeats. Its defaults are F ±70 ms, Cemgil σ=40 ms, Goto, P-score 0.2, continuity 17.5%, and IG with 41 bins, and it **trims the first 5 s automatically**. mir_eval has **no Accuracy1/Accuracy2 function**. `mir_eval.tempo.detection` is the MIREX two-tempo P-score with an 8% tolerance. Implement Acc1/Acc2 yourself (4% tolerance) or use Schreiber's `tempo_eval`. Report OE/AOE, the log2 ratio of estimated to reference tempo, alongside them.

### Cited Findings
**Beat metrics (mir_eval.beat defaults)**
- `trim_beats(beats, min_beat_time=5.0)` removes beats before 5 s. Every docs example trims the reference and the estimate first — [mir_eval beat docs](https://mir-eval.readthedocs.io/latest/api/beat.html)
- In the source, `beat.evaluate()` calls `trim_beats` on both the reference and the estimate through `filter_kwargs`. Trimming therefore happens **by default** in `evaluate()`. Pass `min_beat_time=0` to disable it — [mir_eval/beat.py](https://github.com/mir-evaluation/mir_eval/blob/main/mir_eval/beat.py)
- `f_measure`: `f_measure_threshold=0.07` (±70 ms) — [mir_eval beat docs](https://mir-eval.readthedocs.io/latest/api/beat.html)
- `cemgil`: `cemgil_sigma=0.04`. It returns `cemgil_score` (original reference) and `cemgil_max` (best over metrical variations) — [mir_eval beat docs](https://mir-eval.readthedocs.io/latest/api/beat.html)
- `goto`: threshold 0.35, mu 0.2, sigma 0.2. The score is binary, 0 or 1 — [mir_eval beat docs](https://mir-eval.readthedocs.io/latest/api/beat.html)
- `p_score`: `p_score_threshold=0.2` × median inter-annotation interval. It is McKinney's impulse-train cross-correlation — [mir_eval beat docs](https://mir-eval.readthedocs.io/latest/api/beat.html)
- `continuity` returns CMLc, CMLt, AMLc and AMLt. Phase and period thresholds are both 0.175 — [mir_eval beat docs](https://mir-eval.readthedocs.io/latest/api/beat.html)
- The AML variations in mir_eval are exactly these five: the original reference, off-beat, double tempo, half tempo (odd beats) and half tempo (even beats). **There are no ×3 or ⅓ variants**, so a triple-level error in 6/8 or 3/4 counts as wrong even under AML — [mir_eval/beat.py `_get_reference_beat_variations`](https://github.com/mir-evaluation/mir_eval/blob/main/mir_eval/beat.py)
- `information_gain`: bins=41, and an even bin count triggers a warning. mir_eval **normalizes** the score to (log2(bins) − H)/log2(bins), giving a value in [0, 1]. A source comment says "the beat evaluation toolbox does not normalize", so the toolbox reports bits, up to log2(41) ≈ 5.36. Do not mix the two scales in a comparison table — [mir_eval/beat.py](https://github.com/mir-evaluation/mir_eval/blob/main/mir_eval/beat.py)
- Edge cases: an empty estimate or reference raises a warning and the score is 0. P-score, continuity and IG return 0 when either sequence has ≤1 beat. Beats must be 1-D, in seconds and increasing — [mir_eval/beat.py](https://github.com/mir-evaluation/mir_eval/blob/main/mir_eval/beat.py); [docs](https://mir-eval.readthedocs.io/latest/api/beat.html)
- Downbeats are evaluated with the same beat functions applied to downbeat times. Beat This! reports downbeat F1/CMLt/AMLt this way, using mir_eval defaults with the 5 s trim. The authors say they "don't necessarily approve" of the trimming — [Foscarin et al. 2024, arXiv 2407.21658](https://arxiv.org/html/2407.21658)
- Böck et al. 2016 also evaluate both beats and downbeats with F1 at ±70 ms — [Böck, Krebs, Widmer ISMIR 2016](https://archives.ismir.net/ismir2016/paper/000186.pdf)

**Tempo metrics**
- `mir_eval.tempo.detection(reference_tempi, reference_weight, estimated_tempi, tol=0.08)`. A hit means `|est−ref| <= tol*ref`. It returns `p_score = w*hits[0] + (1−w)*hits[1]`, `one_correct` and `both_correct`, and expects two reference tempi and two estimates. This is the MIREX-style metric, **not** Acc1/Acc2 — [mir_eval tempo docs](https://mir-eval.readthedocs.io/latest/api/tempo.html); [tempo.py](https://github.com/mir-evaluation/mir_eval/blob/main/mir_eval/tempo.py)
- Pitfalls in `mir_eval.tempo`: the weight applies to index 0 and the tempi are expected in ascending order. The docs are also inconsistent about whether the weight must be "> 0" or lie in [0, 1] — [mir_eval tempo docs](https://mir-eval.readthedocs.io/latest/api/tempo.html)
- Accuracy 1 counts an estimate as correct only against the single annotated tempo. Accuracy 2 also accepts integer multiples and fractions, used to absorb the "tempo octave problem" — [Böck, Krebs, Widmer ISMIR 2015](https://www.ismir2015.uma.es/articles/196_Paper.pdf)
- The conventional tolerance is ±4%. Schreiber et al. call it "somewhat arbitrary": the Friberg & Sundberg JND it is usually justified with is about 2.5%, not 4% — [Schreiber, Urbano, Müller 2020 TISMIR](https://transactions.ismir.net/articles/10.5334/tismir.43)
- Schreiber et al. find that binary Acc1/Acc2 hide the direction and size of errors, and that Acc2 lacks construct validity for DJ-type uses. They rated P-score (8%) as without formal justification, and industry experts called it "not useful" — [Schreiber et al. 2020](https://transactions.ismir.net/articles/10.5334/tismir.43)
- The proposed metrics are OE1 = log2(ŷ/y), with octave errors clustering near ±1 and ±1.58, OE2 = the smallest-magnitude OE over octave-related candidates, and AOE = |OE|. They recommend reporting distributions and plotting Acc1/Acc2 against tolerance — [Schreiber et al. 2020](https://transactions.ismir.net/articles/10.5334/tismir.43)
- Schreiber recommends the median IBI, or the median inter-corresponding-beat interval (ICBI), over the mean IBI when deriving a global reference tempo from beat annotations — [Schreiber et al. 2020](https://transactions.ismir.net/articles/10.5334/tismir.43)
- Tolerances differ between sources. DeepRhythm's historical README benchmark used **±2%** for Acc1/Acc2. Its 2026 `docs/benchmarks.md` switched to 4% and "half, double, one-third, and triple" for Acc2, and warns to use `--tolerance 0.02` only to compare with the old README — [DeepRhythm README](https://github.com/bleugreen/deeprhythm); [docs/benchmarks.md](https://github.com/bleugreen/deeprhythm/blob/main/docs/benchmarks.md)

### Inferences
- Acc1 should be `abs(est-ref) <= 0.04*ref`. Acc2 is the same test against ref × {1, 2, 3, ½, ⅓}. For worship music in 6/8, consider adding ×1.5 and ×⅔ as a separate diagnostic bucket: dotted-quarter versus eighth-note pulse confusions fall outside both Acc2 and mir_eval AML.
- Primary beat metrics: F1, CMLt and AMLt, which match the Beat This! and Böck tables and allow comparison with the literature. Secondary: IG (mir_eval-normalized, labelled as such), Cemgil and P-score.
- Keep a 0 s trim variant as well as the 5 s one. In full-length worship songs the first 5 s are often a pad or piano intro, which is exactly where trackers fail (see §5).

### Gaps
- I did not fetch the Davies, Degara & Plumbley 2009 tech report (C4DM-TR-09-06) or Gouyon et al. 2006 directly. The definitions above come from mir_eval's implementation and later papers. The original rationale for the 5 s trim (removing the period trackers need to settle) is not verified from the primary source here.
- No standard "meter accuracy" metric exists in mir_eval. Meter is usually scored as the fraction of tracks whose estimated beats-per-bar matches the reference. I found no canonical citation for it.

---

## 2. Time-varying tempo, tempo changes, and the octave choice

### Takeaway
No library standard exists for scoring a local tempo curve. Build it from the beat annotations: compute a reference local tempo from the median IBI over a sliding window, then score each frame of the estimate within ±4% (and the octave-tolerant variant), plus OE. Score the octave or metrical-level choice separately from beat placement, using the CML vs. AML gap, Cemgil vs. cemgil_max, OE1 clusters, or the annotation coverage ratio (ACR).

### Cited Findings
- Standard beat metrics assume a fixed relationship between reference and estimate. They do not reveal a tracker that misses a later tempo change or switches between half and double tempo. Chiu et al. 2022 propose the **annotation coverage ratio (ACR)**: build reference sequences at every metrical level and test the estimate against them over time, used alongside the existing metrics. Published in IEEE SPL vol. 29, pp. 2153–2157 — [arXiv 2210.06817](https://arxiv.org/abs/2210.06817)
- Tempo instability strongly affects global-tempo scores. Restricting SMC to tracks with a coefficient of variation c_var < 0.1 raised ACC2 by 18.4 points for Böck's method, 11.5 for Schreiber's and 10.0 for Percival's. 99.4% of Ballroom tracks have c_var < 0.1. Only about half of SMC lies within ±4% of the normalized tempo, against ≥91% for GTZAN and Ballroom — [Schreiber et al. 2020](https://transactions.ismir.net/articles/10.5334/tismir.43)
- librosa's own docs say its default beat tracker is not suited to songs with radical tempo shifts or gradual accelerations. Its dynamic-tempo mode estimates a tempo at every time point — [librosa time-varying tempo tutorial](https://librosa.org/doc/dev/auto_tutorials/03-advanced/plot_dynamic_beat.html)
- The madmom DBN used for Beat This! `--dbn` uses madmom defaults: `beats_per_bar=[3,4]`, `min_bpm=55`, `max_bpm=215`, `transition_lambda=100`. Foscarin et al. removed the DBN because it imposes the 55–215 BPM range, 3 or 4 beats per bar, and a fixed tempo variability. With the DBN, Beat This! beat F1 fell from 89.1 to 88.1 and downbeat F1 from 78.3 to 77.4, but downbeat CMLt rose from 67.3 to 73.3 — [beat_this postprocessor.py](https://github.com/CPJKU/beat_this/blob/main/beat_this/model/postprocessor.py); [Foscarin et al. 2024](https://arxiv.org/html/2407.21658)
- The pattern "Beat This! has higher F1 but lower CMLt/AMLt than Hung et al." (GTZAN beat CMLt 79.8 vs 81.2, AMLt 89.8 vs 92.0) is a continuity effect. The DBN-free model makes local errors that break continuity — [Foscarin et al. 2024](https://arxiv.org/html/2407.21658)
- The OE1 histogram (log2 ratio) separates octave errors (±1, ±1.58) from small tempo errors. Octave errors in Ballroom concentrate in Jive, Quickstep and Viennese Waltz, about 30% of the set — [Schreiber et al. 2020](https://transactions.ismir.net/articles/10.5334/tismir.43)

### Inferences (proposed protocol)
- **Global tempo:** Acc1, Acc2 and AOE1/AOE2 against the median-IBI reference. Report the octave-error rate separately as `Acc2 − Acc1`, broken down by the factor matched (×2, ½, ×3, ⅓, ×1.5).
- **Beat-level octave choice:** for each track, label the metrical level as correct if CMLt > AMLt − ε, or otherwise as whichever AML variant wins. Report "phase/period correct but level wrong" (AMLt − CMLt) separately from placement accuracy (F1 at the correct level).
- **Local tempo:** compute the reference local BPM as 60/median(IBI) over a window of about 8 beats or 4 s, at a 0.1 s hop. The estimated local tempo comes from the method's beats in the same way, or from librosa's dynamic tempo or PLP curve. Report the fraction of frames within ±4% (L-Acc1) and within octave-tolerant ±4% (L-Acc2).
- **Tempo change points:** annotate section boundaries where the tempo shifts by more than about 4%. Detect changes in the estimated local tempo curve and score precision, recall and F with a tolerance of about ±2 bars, plus mean detection lag. This uses the same structure as `mir_eval.onset`/`segment` boundary F-measure, adapted to tempo. It is a home-grown protocol and has no published standard.
- For worship sets with intentional tempo changes (key or tempo lift in a final chorus, half-time bridge), evaluate per section. A half-time bridge annotated at the full tempo will show up as an "octave error" that a musician may consider correct. Decide the annotation policy first: annotate the felt pulse per section, and store an alternate-level field as Schreiber's two-tempo approach does.

### Gaps
- I found no published "Schreiber tempo-curve metric" specifically for local tempo curves. Schreiber's 2020 work concerns global tempo. A standard local-tempo or tempo-change F-measure with a citable definition was not found in this search.

---

## 3. Training-data leakage per model

### Takeaway
Almost every public beat dataset (Ballroom, Beatles, Hainsworth, SMC, HJDB, RWC, Harmonix, Rock Corpus, Carnatic and others) was in the training set of at least one neural model. **GTZAN is the only public dataset that every model with documented training data held out:** Beat This! final/small, madmom beat, tempo and downbeat, BeatNet model 1, TempoCNN, and all-in-one. The new worship-song set is clean for every model, and it is the only fully fair data here. DeepRhythm's training data is undisclosed, so it cannot be cleared for any public set.

### Cited Findings
**(a) Beat This! (Foscarin, Schlüter, Widmer, ISMIR 2024)**
- Training and validation data: 18 datasets (counting the 4 RWC subsets separately), 4,556 tracks: Simac, SMC, Hainsworth, Ballroom, HJDB, Beatles, Harmonix, RWC (classical, pop, royalty-free, jazz), TapCorrect, JAAH, Filosax, ASAP, Groove MIDI, GuitarSet, Candombe. The test set is **GTZAN only** (993 pieces after discarding one unannotated track and six without downbeats) — [Foscarin et al. 2024](https://arxiv.org/html/2407.21658)
- Checkpoints: `final0-2` (main, about 78 MB) and `small0-2` (about 8.1 MB) are "trained on all data except the GTZAN dataset". `fold0..fold7` come from 8-fold CV with one seed per fold. `single_final0-2` use the single split, about 15% validation per dataset. `hung0-2` use only Hung et al.'s data, except GTZAN — [beat_this README](https://github.com/CPJKU/beat_this)
- README: "the results may be unfairly good if you run inference on any file from the training datasets… an evaluation with `final*` or `small*` can only be performed fairly on GTZAN or other datasets we didn't consider in our paper. … consider targeting the validation part of the single split (with `single_final*`), or of the 8-fold cross-validation (with `fold*`)" — [beat_this README](https://github.com/CPJKU/beat_this)
- For CV, each dataset is split into 8 parts. The Böck & Davies splits are reused, and versions of the same piece stay in the same fold — [Foscarin et al. 2024](https://arxiv.org/html/2407.21658)
- License: code and weights are MIT. Some training audio is copyrighted or under limited CC licenses — [beat_this README](https://github.com/CPJKU/beat_this)

**(b) madmom**
- `RNNBeatProcessor` (offline) defaults to `BEATS_BLSTM = beats/2015/beats_blstm_[1-8].pkl`, an ensemble of 8 networks. Other model sets are `BEATS_LSTM` (2016, online), `BEATS_TCN` (2019) and `DOWNBEATS_BLSTM = downbeats/2016/downbeats_blstm_[1-8].pkl` — [madmom_models `__init__.py`](https://github.com/CPJKU/madmom_models/blob/master/__init__.py); [madmom beats.py](https://github.com/CPJKU/madmom/blob/main/madmom/features/beats.py)
- 2015 tempo paper (Böck, Krebs, Widmer, ISMIR 2015, the basis of madmom's comb-filter tempo): the beat RNN was trained with 8-fold CV on the sets marked * in Table 1, which are **Ballroom, Hainsworth and SMC**. Evaluation covered Klapuri, GTZAN, ISMIR04, Beatles, ACM Mirum, HJDB and others as unseen sets. Results on Ballroom, Hainsworth and SMC are CV results — [Böck et al. 2015](https://www.ismir2015.uma.es/articles/196_Paper.pdf)
- 2016 joint beat/downbeat paper (`RNNDownBeatProcessor`): trained with 8-fold CV on Ballroom (685 tracks, 13 Sturm duplicates removed), Beatles (180), Hainsworth (222), HJDB (235), RWC Popular (100), Robbie Williams (65), Rock (200), Carnatic (176), Cretan (42) and Turkish (93). **Held out for testing only: GTZAN (999), Klapuri (320/474) and SMC (217)** — [Böck, Krebs, Widmer ISMIR 2016](https://archives.ismir.net/ismir2016/paper/000186.pdf)
- License: madmom model files are **CC BY-NC-SA 4.0**. Commercial use requires contacting G. Widmer, and pickled processors using them inherit the license — [madmom_models README](https://github.com/CPJKU/madmom_models)

**(c) BeatNet (Heydari, Cwitkowitz, Duan, ISMIR 2021)**
- Datasets in Table 1: Ballroom, Beatles, Carnatic, GTZAN and Rock Corpus, used for training, validation and testing "with different splits and arrangements for various experiments". There are three experiments: (1) test on GTZAN, "unseen from training of all comparison methods"; (2) Ballroom held out; (3) Rock Corpus held out. Metric: F-measure at ±70 ms — [BeatNet paper, arXiv 2108.03576](https://arxiv.org/abs/2108.03576)
- The released weights are labelled "Model 1: Pre-trained weights (GTZAN)", "Model 2: (Ballroom)" and "Model 3: (Rock Corpus)". The repo license is CC-BY-4.0 — [BeatNet GitHub](https://github.com/mjhydri/BeatNet)

**(d) Essentia TempoCNN (Schreiber & Müller, ISMIR 2018)**
- Training set "Train" has 8,596 tracks: **LMD Tempo** (3,611 Lakh-MIDI-matched 30 s previews), **MTG Tempo** (derived from the GiantSteps MTG Key EDM set), and **EBall = Extended Ballroom \ Ballroom** (3,826 tracks of 30 s). The original Ballroom was excluded because it "is still used as test dataset today". The split was 90/10 train/validation. Tests covered ACM Mirum, ISMIR04, Ballroom, Hainsworth, GTZAN, SMC and GiantSteps — [Schreiber & Müller 2018](http://ismir2018.ircam.fr/doc/pdfs/141_Paper.pdf)
- The Essentia models page lists deepsquare-k16, deeptemp-k4 and deeptemp-k16 as "trained on the Extended Ballroom, LMDTempo, and MTGTempo datasets", with 256 BPM classes from 30 to 286 BPM. Essentia's general statement: MTG-created models are CC BY-NC-SA 4.0 — [Essentia models](https://essentia.upf.edu/models.html)
- The original tempo-cnn repository code and models are AGPL-3.0 — [hendriks73/tempo-cnn](https://github.com/hendriks73/tempo-cnn)

**(e) DeepRhythm**
- The README and docs **do not disclose the training data**. The README's historical benchmark is "953 songs, mostly Electronic, Hip Hop, Pop, and Rock", Acc ±2%, with no statement that this set is held out. The 2026 `benchmarks.md` reports DeepRhythm 0.7 on Ballroom (698 tracks: Acc1 61.17%, Acc2 86.96%), GTZAN (998: 68.44 / 91.78) and GiantSteps v2 (661: 71.26 / 98.49), at a 4% tolerance. It also mentions "historical scripts used 256 clips for training". License: AGPL-3.0 — [DeepRhythm GitHub](https://github.com/bleugreen/deeprhythm); [benchmarks.md](https://github.com/bleugreen/deeprhythm/blob/main/docs/benchmarks.md)

**(f) all-in-one (Kim & Nam 2023)**
- "The models are trained on the Harmonix Set with 8-fold cross-validation." `harmonix-all` (the default) averages the 8 fold models, and `harmonix-foldN` are single-fold models. License: MIT — [all-in-one GitHub](https://github.com/mir-aidj/all-in-one); paper [arXiv 2307.16425](https://arxiv.org/abs/2307.16425)

### Contamination matrix (inference from the findings above)
| Dataset | Beat This! final/small | madmom beat (2015) & tempo | madmom downbeat (2016) | BeatNet model 1 | TempoCNN | DeepRhythm | all-in-one (harmonix-all) |
|---|---|---|---|---|---|---|---|
| **GTZAN** | clean | clean | clean | clean | clean | unknown | clean* |
| Ballroom | **trained** | **trained** | **trained** | **trained** | clean (EBall overlap removed) | unknown | clean* |
| Extended Ballroom | probably clean (not listed; overlaps Ballroom) | overlap via Ballroom | overlap via Ballroom | overlap via Ballroom | **trained** | unknown | clean* |
| Hainsworth | **trained** | **trained** | **trained** | clean | clean | unknown | clean* |
| SMC | **trained** | **trained** | clean (test) | clean | clean | unknown | clean* |
| Beatles | **trained** | clean | **trained** | **trained** | clean | unknown | clean* |
| HJDB | **trained** | clean | **trained** | clean | clean | unknown | clean* |
| RWC Pop | **trained** | clean | **trained** | clean | clean | unknown | clean* |
| Harmonix | **trained** | clean | clean | clean | clean | unknown | **trained (all folds)** |
| Rock Corpus | not listed (clean?) | clean | **trained** ("Rock" [6]) | **trained** | clean | unknown | clean* |
| GiantSteps Tempo | clean | clean | clean | clean | **possible** overlap (MTG Key ⊂ Beatport) | **suspect** (Acc2 98.5%) | clean* |
| ACM Mirum / ISMIR04 | clean | clean | clean | clean | clean | unknown | clean* |
| Worship set (new) | clean | clean | clean | clean | clean | clean (presumably) | clean |

\* All-in-one may include other pretraining. Its README names only Harmonix.

DSP methods (librosa beat_track/tempo/PLP, Essentia multifeature/Degara/Percival) have no learned weights, but their default parameters were tuned on public sets. Treat that as mild design bias, not leakage.

### Inferences
- **GTZAN is the only public set fair for every model whose training data is documented.** Even so, DeepRhythm is not cleared. Use corrected GTZAN annotations (Percival/Tzanetakis or Marchand), since about 2.4% of GTZAN tempo annotations were corrected ([Schreiber et al. 2020](https://transactions.ismir.net/articles/10.5334/tismir.43)). Note that GTZAN is 30 s excerpts, which is not representative of full songs.
- **Do Beat This! fold checkpoints allow clean evaluation?** Yes, but only on the Beat This! training datasets, and only when each track is scored with the fold model that held it out (`--aggregation-type k-fold`, using the split files from the beat_this annotations repo). They give no advantage on the worship set, where `final*` is already clean. Fold models are slightly weaker (trained on 7/8 of the data), so do not mix fold-CV numbers for Beat This! with "full-trained" numbers for other models on the same table without saying so.
- madmom's released ensembles average 8 CV networks, so the ensemble has collectively seen **every** track of its training sets. CV-style fair evaluation is impossible with the shipped models on Ballroom, Hainsworth, SMC (beat) or Beatles, RWC and others (downbeat).
- BeatNet's label "(GTZAN)" most likely means "the GTZAN-test experiment", i.e. trained on Ballroom, Beatles, Carnatic and Rock Corpus. I infer this from the paper's experiment design; the README does not state it explicitly. Model 2 and Model 3 probably include GTZAN in training, so do not use them on GTZAN.
- Recommended fair comparison sets: (1) the new worship set (primary); (2) GTZAN (corrected annotations) for beat, downbeat and tempo; (3) ACM Mirum and ISMIR04 Songs for tempo only, excluding DeepRhythm or flagging it as "unknown". Ballroom, Hainsworth, SMC, Beatles and Harmonix should be reported only as "seen-data reference", never as a ranking.
- License note for productization: the madmom models and Essentia TempoCNN are NC; tempo-cnn and DeepRhythm are AGPL; Beat This!, all-in-one and BeatNet are MIT or CC-BY.

### Gaps
- DeepRhythm's training data could not be determined from the README, docs or code tree. A GiantSteps Acc2 of 98.5% against Acc1 of 71% suggests EDM training, but that is not confirmed.
- I did not check whether Beat This!'s Harmonix or TapCorrect material overlaps Rock Corpus or GTZAN artists or songs.
- I did not verify whether madmom's `beats/2015` files are exactly the networks of the 2015 tempo paper (Ballroom/Hainsworth/SMC). The folder year and the 8-network count match, but the docstring cites only Böck & Schedl 2011.
- I did not check whether all-in-one's training also used Beat This!-style extra data, or where its paper reports external tests.

---

## 4. Cross-dataset evaluation, statistics, and sample size

### Takeaway
Compare per track and paired: every method on the same tracks. Use the Wilcoxon signed-rank test or a paired bootstrap of the mean difference for continuous metrics (F1, CMLt, AOE), and McNemar for binary ones (Acc1/Acc2). Correct for multiple comparisons across 14 methods. To resolve differences of 2–5 percentage points you need roughly 70–200 tracks for F1-type metrics and 300–900 tracks for binary Acc1, so a worship set of about 100 songs can only detect the larger differences.

### Cited Findings
- Schreiber et al. assess dataset adequacy with Generalizability Theory's dependability Φ, using 0.95 as the threshold. With ACC1/ACC2, only ISMIR04 Songs, Ballroom and GiantSteps Tempo are large enough. With OE1, all seven datasets they tested reach 0.95. On MIREX 2018 results, Φ is 0.95 for One Correct, 0.92 for P-Score and 0.67 for Both Correct. Their repository implements McNemar for ACC1/ACC2 and t-tests for paired algorithms — [Schreiber et al. 2020](https://transactions.ismir.net/articles/10.5334/tismir.43)
- They advise avoiding Hainsworth and combined RWC as too small. GTZAN is borderline in size. SMC suits only low-accuracy use cases with OE1/AOE1 — [Schreiber et al. 2020](https://transactions.ismir.net/articles/10.5334/tismir.43)
- Annotation quality bounds measured accuracy. Re-annotating GiantSteps Tempo moved Böck's ACC1 from 58.9 to 64.8 and ACC2 from 86.4 to 94.0. Corrected shares: Ballroom 4.6%, ACM Mirum 9.6%, GTZAN 2.4% — [Schreiber et al. 2020](https://transactions.ismir.net/articles/10.5334/tismir.43)
- Böck et al. 2016 ran statistical significance tests between systems on the test sets and warn that CV, leave-one-dataset-out and overlapping train/test results are "not directly comparable" — [Böck et al. 2016](https://archives.ismir.net/ismir2016/paper/000186.pdf)
- Beat This! reports mean ± std over 3 seeds. On GTZAN, final versus small differ by only 0.3 F1 (89.1 vs 88.8) — [Foscarin et al. 2024](https://arxiv.org/html/2407.21658)
- Schreiber et al. recommend publishing all estimates and annotations, using open evaluation code (mir_eval, tempo_eval), and not comparing numbers across annotation versions — [Schreiber et al. 2020](https://transactions.ismir.net/articles/10.5334/tismir.43)

### Inferences (my calculations, not from a source)
- Paired continuous metric, normal approximation, α=0.05 two-sided, power 0.8: n ≈ ((1.96+0.84)·σ_d/δ)². With an assumed per-track SD of differences σ_d ≈ 0.15 (typical F1 spread between strong trackers; check on your data), δ=0.05 needs n≈71 and δ=0.03 needs n≈196. With σ_d≈0.10, δ=0.03 needs n≈87.
- Binary Acc1 with McNemar: assuming a discordant-pair rate of about 10%, δ=0.05 needs n≈310 and δ=0.03 needs n≈870. Use AOE (continuous) to gain power, as Schreiber's Φ result also suggests.
- Run a pilot of about 30 songs to estimate σ_d, then size the set. Report 95% bootstrap CIs (10k resamples over tracks; resample songs, not segments, to respect clustering). Apply Holm correction across pairwise tests, or a Friedman test with Nemenyi post-hoc for the 14-way ranking.
- Report per-subgroup results: genre or style (ballad, upbeat, 6/8), length (excerpt ≤30 s vs. full song), studio vs. live, presence of drums, and tempo range bins (<70, 70–100, 100–140, >140 BPM). Show results with and without the 5 s trim.
- Because GTZAN is 30 s excerpts and the worship set is full songs, report metrics on full songs **and** on random 30 s windows of them. This separates the effect of length from the effect of domain.
- Run Beat This! seeds 0–2 (final0/1/2) if time allows. A seed spread of about 0.3–0.6 pp means differences of that size between methods are noise.

### Gaps
- I found no published per-track variance figures for beat F1 differences between specific modern trackers, so the σ_d values above are assumptions.
- I did not find literature that uses bootstrapping specifically for beat tracking (Schreiber 2020 does not discuss it).

---

## 5. Pitfalls specific to full-length songs (worship context)

### Takeaway
Full songs break the assumptions behind the excerpt-era datasets. Drumless intros, rubato or free-time sections, fades, applause and crowd singing, live tempo drift, and half-time bridges are where trackers and DBN priors fail. The 5 s trim hides only a small part of this. Annotate and score these regions explicitly.

### Cited Findings
- The 5 s trim exists to discard the start, and Beat This!'s authors say they don't necessarily approve of it — [Foscarin et al. 2024](https://arxiv.org/html/2407.21658); [mir_eval docs](https://mir-eval.readthedocs.io/latest/api/beat.html)
- The DBN prior (3 or 4 beats per bar, 55–215 BPM, fixed tempo variability) constrains odd meters, metre changes and extreme tempos — [Foscarin et al. 2024](https://arxiv.org/html/2407.21658); [beat_this postprocessor.py](https://github.com/CPJKU/beat_this/blob/main/beat_this/model/postprocessor.py)
- BeatNet oversamples long files in training "given that some datasets (e.g., Beatles) contain full songs and others (e.g., Ballroom) contain short excerpts", which acknowledges the length mismatch — [BeatNet paper](https://arxiv.org/abs/2108.03576)
- Tempo-unstable material (SMC-like) lowers global-tempo accuracy sharply; see the c_var result in §2 — [Schreiber et al. 2020](https://transactions.ismir.net/articles/10.5334/tismir.43)
- librosa's static `beat_track` is not suited to radical tempo shifts or gradual accelerations — [librosa tutorial](https://librosa.org/doc/dev/auto_tutorials/03-advanced/plot_dynamic_beat.html)
- Several models only see short context. TempoCNN trains on 30 s clips and DeepRhythm's benchmark uses 8 s clips, so a global tempo is aggregated from local estimates — [Schreiber & Müller 2018](http://ismir2018.ircam.fr/doc/pdfs/141_Paper.pdf); [DeepRhythm benchmarks.md](https://github.com/bleugreen/deeprhythm/blob/main/docs/benchmarks.md)

### Inferences (protocol recommendations)
- Annotate a **region mask**: intro or outro without a pulse, free-time or rubato, fade, spoken prayer, applause. Score beats (a) on the whole song and (b) only inside "pulsed" regions. mir_eval scores silence false positives as FPs, so report both.
- For global BPM on a song with sections, define the reference as the dominant tempo, i.e. the median ICBI over pulsed regions, and also store per-section tempi. A song with a tempo lift is scored per section, not globally.
- Live recordings: crowd singing and applause produce spurious onsets, and drift of ±2–3% over a song can push a single global BPM outside the ±4% tolerance for part of the song. Report the local Acc1 fraction (§2) and the reference c_var per track so drift is visible.
- Half-time bridges and 6/8 ballads: annotate the musician-felt level, plus an alternate level. Report AMLt−CMLt and the ×1.5 or ⅔ bucket so that level choices are not mixed up with tracking failures.
- Fades: annotators usually stop when the pulse becomes inaudible, while trackers continue. Truncate scoring at the annotated end, or mask the fade.
- Run long files through every model end to end, not chunked. Check that each tool handles the length: some limit or chunk the input (e.g. BeatNet online/offline modes, DeepRhythm clips). Record the processing mode used.

### Gaps
- I found no published benchmark of beat tracking on worship or CCM music, and no full-song-specific evaluation standard. Recommendations in this section beyond the cited facts are my own synthesis.

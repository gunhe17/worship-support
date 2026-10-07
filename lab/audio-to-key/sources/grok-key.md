I'll research key detection and modulation tracking from recent MIR work and practitioner reports, using both X and the web, then write a cited report. First I'm checking the research workflow so the search stays structured.The report has to rest on primary sources, so I’m searching recent MIR papers and what producers and worship musicians actually say about key and modulation tools.The first pass mixed in unrelated “key finder” posts. I’m narrowing to MIR papers and to what DJs, producers, and worship players report about specific tools.A single global key label will miss the last-chorus key-up that worship charts care about. Estimate the key per section, keep the runner-up, and use chords to separate a real modulation from a relative-major/minor tie.

## What to trust, in one pass

On clean, single-key pop, the best published audio models land around **80% strict** and **85% MIREX-weighted**. On electronic music the same models fall to about **68% strict**. Nothing in the 2024–2026 literature reports a comparable number for live worship recordings or for “verse in G, last chorus in A♭.” Local-key systems that do track modulations were measured on classical song cycles, and even the best of those only reach about **78–80% of frames** on songs they have never seen. Commercial tools disagree with each other on a large minority of tracks. Treat every automatic key as a hypothesis with a second choice.

The scoring used by MIREX, and still the 2025 Audio Key Detection task, is not strict accuracy. Same key and mode scores 1.0, a perfect fifth 0.5, the relative major or minor 0.3, the parallel major or minor 0.2, and anything else 0. A “85%” headline can hide the exact mistakes that break a chord chart. Sources: [MIREX 2025 Audio Key Detection](https://www.music-ir.org/mirex/wiki/2025:Audio_Key_Detection), [mir_eval key scoring](https://github.com/mir-evaluation/mir_eval/blob/master/mir_eval/key.py).

## Why one number fails a modulation

The standard pipeline is still: spectrum, fold energy into 12 pitch classes (a chroma or HPCP), average across the file, correlate that average with 24 templates. Korzeniowski and Widmer state the consequence directly: a single global key “fails to cope with pieces that contain key modulations.” [End-to-end CNN key estimation, ISMIR 2017](https://ar5iv.labs.arxiv.org/html/1706.02921).

Essentia’s streaming `Key` does exactly that average. It “accumulates a stream of HPCP vectors and computes its mean.” [Essentia Key](https://essentia.upf.edu/reference/std_Key.html). A last chorus that is only the final quarter of the song cannot win a time-average unless it is also much louder. If it is louder, the opposite failure happens: the modulated key becomes “the” key and the verse disappears. Yannick Feige, who builds DJ software, put the same limit in practitioner language in June 2026: a seven-minute track does not have one key, “best you get is where it mostly lives,” and reverb and echo smear the chroma further. [x.com/yannickfe/status/2061804905841541528](https://x.com/yannickfe/status/2061804905841541528).

Two different modulations show up in this repertoire, and they need different outputs:

- **Truck-driver / last-chorus key-up.** Same progression, tonic jumps +1 semitone, sometimes +2, usually with no pivot, and it does not return. A pop-song explainer from 2025 notes that many pop songs “move up a semitone or a tone for the last chorus.” [pitchdetector.com song key finder](https://pitchdetector.com/song-key-finder/).
- **Section modulation that returns.** Verse in one key, chorus a whole tone or a minor third higher, then back. A 2025 theory video walks through “We Are the Champions” (E♭ verse, F chorus, back to E♭). [Don’t bore us… key change the chorus](https://www.youtube.com/watch?v=Jht-dYmkYpU). A single change-point at the end will miss this.

A third case is not a modulation at all: the axis loop (C–G–Am–F, or Am–F–C–G). Same seven notes the whole way. Reporting a key change there is a relative-mode error, covered below.

## Key profiles

A profile is 12 weights, one per pitch class, rotated to each of 12 tonics, once for major and once for minor. The estimated key is the rotation with the highest correlation.

**Krumhansl (Krumhansl–Kessler, 1982).** Probe-tone ratings: listeners judged how well each pitch fit a cadence. The C-major vector used by Essentia is `6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88`; C minor is `6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17`. Essentia’s own note: they “should work generally fine for pop music.” [Essentia Key](https://essentia.upf.edu/reference/std_Key.html), vectors in [essentia key.cpp](https://github.com/MTG/essentia/blob/master/src/algorithms/tonal/key.cpp). Temperley reprints the same experiment and points at the failure mode: in the minor profile the flattened seventh outranks the leading tone, so C minor looks a lot like E♭ major. [Temperley 1999 PDF](http://davidtemperley.com/wp-content/uploads/2015/11/temperley-mp99.pdf). A 2021 probe-tone study also found the Krumhansl major profile fits classical listeners better than rock listeners. [Vuvan et al. context, Music Perception 2021](https://online.ucpress.edu/mp/article/38/5/425/117147/Probe-Tone-Paradigm-Reveals-Less-Differentiated).

**Temperley (1999).** Corpus-derived replacement for those ratings, plus a simpler match, a present/absent count inside short segments instead of raw duration, and an explicit penalty for changing key from one segment to the next. That last piece is the template version of modulation tracking. Essentia’s Temperley vectors are major `5.0, 2.0, 3.5, 2.0, 4.5, 4.0, 2.0, 4.5, 2.0, 3.5, 1.5, 4.0` and minor `5.0, 2.0, 3.5, 4.5, 2.0, 4.0, 2.0, 4.5, 3.5, 2.0, 1.5, 4.0`. The docs say they “perform best on [euroclassical] repertoire (especially in minor).” [Essentia Key](https://essentia.upf.edu/reference/std_Key.html), [JSTOR abstract](https://www.jstor.org/stable/40285812). On the classical MIREX 2005 set, Essentia with Temperley profiles (submission FJH2) scored **0.634 correct, 0.761 weighted**, behind Cannam/Noland at **0.827 / 0.868**. The same family collapses on EDM. [MIREX 2016 FJH abstract](https://www.music-ir.org/mirex/abstracts/2016/FJH2.pdf).

**EDMA / EDMM / bgate (Faraldo et al.).** These are not cognitive profiles. EDMA is the median pitch-class profile of an electronic-dance corpus; EDMM is that profile hand-tweaked so that it **reports major as minor**, because most EDM is minor. `bgate` (the current Essentia default) is the Beatport median with the four weakest bins zeroed. [Essentia Key](https://essentia.upf.edu/reference/std_Key.html), [Faraldo, Jordà, Herrera, AES Semantic Audio 2017](https://mtg.upf.edu/system/files/publications/aes_FARALDO_cameraReady.pdf).

MIREX-weighted scores from that 2017 paper:

| Profile | GiantSteps | Beatport | Shaath |
|---|---|---|---|
| Essentia baseline | 0.448 | 0.453 | 0.467 |
| edma | 0.673 | 0.636 | 0.688 |
| edmm | 0.720 | 0.638 | 0.767 |
| bgate | 0.725 | 0.734 | 0.741 |

Strict correct on GiantSteps was only **0.581 (edma), 0.642 (edmm), 0.641 (bgate)**. Same paper, same sets, strict correct for the commercial and open tools: GiantSteps **KeyFinder 0.604, Mixed In Key 0.672, bgate 0.641**; Beatport **0.548 / 0.657 / 0.637**; Shaath **0.674 / 0.720 / 0.663**. So in 2017, on EDM, Mixed In Key beat the academic EDM profiles on strict accuracy, and a profile trained for that genre roughly doubled a general-purpose Essentia baseline. The authors’ conclusion is the one that matters for worship audio: “algorithms tailored for this specific style seem to outperform general purpose algorithms,” because tonal practice differs by genre. [Faraldo 2017](https://mtg.upf.edu/system/files/publications/aes_FARALDO_cameraReady.pdf).

**Do not ship Essentia’s default for CCM.** `profileType` now defaults to `bgate`, an EDM profile. `edmm` will call major songs minor on purpose. For worship and pop, set `krumhansl` or `temperley`. [Essentia Key](https://essentia.upf.edu/reference/std_Key.html).

Shaath profiles, also in Essentia, are Krumhansl reshaped for pop and electronic music and are what the open-source KeyFinder uses. Faraldo reports that edma “normally perform[s] better than Shaath’s” on EDM, not that Shaath is wrong for pop. [Essentia Key](https://essentia.upf.edu/reference/std_Key.html).

## CNN global-key models

**Korzeniowski and Widmer, 2017.** First end-to-end key CNN. Log-frequency spectrogram at 5 frames/second, 8192-sample frames, 65 Hz–2.1 kHz, 24 bands/octave, computed in madmom. Five conv layers, a frame embedding, global average, 24-way softmax. No chord stage and no hand-built profile. Trained on the matching genre, weighted score **74.3 on GiantSteps** against **70.1 for EDMM**, and **83.9 on a Billboard pop/rock split** against **78.7**. A pop-trained net tested on EDM fell to **57.3**. One model on both genres scored **69.2 (EDM) and 79.7 (pop)**. Cross-genre errors were specifically relative and parallel minor. They also report that a recurrent layer on top of the frame embedding did not beat simple averaging. [ISMIR 2017](https://ar5iv.labs.arxiv.org/html/1706.02921).

**Same authors, 2018, the model madmom actually ships.** They train on random 20-second snippets (classical: first 30 seconds only, because pieces modulate) and replace the dense head with an all-convolutional net, AllConv. Test-set MIREX scores for one genre-agnostic model:

| Set | Weighted | Correct | Fifth | Relative | Parallel | Other |
|---|---|---|---|---|---|---|
| GiantSteps | 74.6 | 67.9 | 7.0 | 8.1 | 4.1 | 12.9 |
| Billboard | 85.1 | 79.9 | 5.6 | 4.2 | 6.2 | 4.2 |
| Their classical set | 96.6 | 95.2 | 1.4 | 1.4 | 1.4 | 0.7 |

The classical number is not a modulation score. They used only the opening 30 seconds and took the key from the title, and they wrote “tracking key modulations is left for future work.” A specialized net trained on the wrong genre does much worse: their earlier CK1 scores **72.8** weighted on Billboard, and the classical BD1 system scores **59.6** on GiantSteps. Short excerpts are also worse than the full piece. Their conclusion, which is the design constraint for local key: the model has to see the harmonic coherence of the whole passage, not a couple of seconds. [ISMIR 2018](https://ar5iv.labs.arxiv.org/html/1808.05340).

`madmom.features.key.CNNKeyRecognitionProcessor` is this 2018 network, as an ensemble, and it returns 24 class probabilities rather than a hard label. [madmom key docs](https://madmom.readthedocs.io/en/latest/modules/features/key.html), [source](https://github.com/CPJKU/madmom/blob/master/madmom/features/key.py). It is a **global** estimator. Run it on a section, not on a full live recording, if you want the key change.

**Schreiber and Müller, key-cnn, 2019.** Directional-filter CNNs for tempo and key. Their best key net, DeepSquare, reached about **49.9% strict accuracy on GTZAN Key**, a few points above a VGG-style DeepSpec, with GiantSteps strict accuracy in the same low-50s range for the stronger spectrogram nets. Those figures are strict, on a notoriously messy annotation set, so they are not comparable to the 74.6 weighted GiantSteps number above. The useful part for this feature is the tool: `keygram` writes a **frame-level key posterior** (CSV or PNG) “useful for identifying modulations,” with a configurable hop. [SMC 2019](https://arxiv.org/abs/1903.10839), [key-cnn](https://github.com/hendriks73/key-cnn).

A later reimplementation of the 2018 KeyNet, trained on GiantSteps-MTG, published its own GiantSteps comparison: **keynet.pt weighted 73.51 / correct 66.72**, **Mixed In Key 8.3 weighted 75.70 / correct 69.37**, **Rekordbox 7.12 weighted 65.53 / correct 56.79**. [MusicalKeyCNN](https://github.com/a1ex90/MusicalKeyCNN). That is the cleanest public head-to-head of a CNN against Mixed In Key and Rekordbox, and it is EDM, not worship.

## Local key and modulation tracking

The research line that actually outputs a key over time is local key estimation, mostly on classical audio.

**Schreiber, Weiß, Müller, ICASSP 2020.** Nine performances of Schubert’s *Winterreise*, three expert annotators. An HMM and a CNN both land near **70% frame accuracy** when the test songs were not in training (song split about **69% HMM / 72% CNN**; “neither” split about **71% / 73%**). If the same songs are seen in other recordings, the CNN jumps to about **96%**. They call that the cover-song effect: the net memorized the progression. A large share of the remaining “errors” are places where the annotators already disagreed, or a musically close key (fifth, relative). [ICASSP 2020 local key](https://www.audiolabs-erlangen.de/content/05_fau/professor/00_mueller/03_publications/2020_SchreiberWM_LocalKey_ICASSP_PrintedVersion.pdf).

**Ding and Weiß, OctaveNet, EUSIPCO 2024.** Same Winterreise set. OctaveNet rearranges a CQT so that octaves and pitch classes are grouped before a small conv + bidirectional LSTM stack (about 150k parameters, 24-way frame output). Frame scores:

| Model | Version split | Song split | Neither split |
|---|---|---|---|
| HMM | 76 | 67 | 71 |
| CNN | 95 | 71 | 73 |
| OctaveNet | 96.23 | **80.00** | **77.75** |

The gain that matters is the song split and the neither split, not the 96% on known pieces. They train on 20-second segments. This is still 24 lieder with piano and voice, not a live band. [EUSIPCO 2024 PDF](https://eurasip.org/Proceedings/Eusipco/Eusipco2024/pdfs/0000026.pdf).

**Gedizlioğlu and Erol, Musicae Scientiae, April 2024.** A regularization method versus an HMM on 80 pieces of mixed genre. Mean MIREX score **0.899** versus **0.826**. The HMM was perfect on 41 of the 80 and badly wrong on many of the rest, because a wrong key on one measure poisons the next. [Sage, 22 Apr 2024](https://journals.sagepub.com/doi/10.1177/10298649241245075). That is the practical warning for a last-chorus key-up: a strong “stay in this key” prior, which is what makes verse frames stable, will also smear or swallow a modulation that lasts one chorus.

There is no 2024–2026 public benchmark of these models on CCM, live multitracks, or truck-driver modulations. Transferring Winterreise’s 80% onto a Hillsong live recording would be a guess.

## Chords as the helper, not the key model

Korzeniowski and Widmer noted in 2017 that joint key-and-chord systems were musically attractive and, at that time, still lost to dedicated key systems at MIREX. [ISMIR 2017](https://ar5iv.labs.arxiv.org/html/1706.02921). Chords are still the right way to **time** a modulation and to **break a relative-key tie**, because a key profile cannot see that the progression just started resolving to a new tonic.

**Chordino / NNLS chroma (Mauch and Dixon, Queen Mary).** Chordino is the Vamp plugin. The front end solves a non-negative least squares problem to get an approximate note transcription before chroma, which cuts the fundamental-versus-overtone confusions that ordinary chroma makes on extended chords. On the MIREX 2009 chord collection and metric they reported about **80%**, against a previous best of **74%**. [Mauch and Dixon 2010](https://zenodo.org/records/1416598). It emits a chord sequence, not a key. You still have to reduce that sequence to a tonic.

**BTC (Park et al., ISMIR 2019).** A bidirectional Transformer on CQT, one training stage, no required CRF. On a 5-fold mix of Isophonics (Beatles, Queen, Carole King, Zweieck), Robbie Williams, and USPop, maj-min vocabulary (25 labels): **root 83.8 ± 1.0, maj-min 82.7 ± 1.0**. Large vocabulary (170 labels): **triads 75.9, sevenths 71.8, MIREX 80.8**. CNN+CRF still edged it on several maj-min numbers (maj-min **83.1**). Code: [jayg996/BTC-ISMIR19](https://github.com/jayg996/BTC-ISMIR19). Paper: [ar5iv HTML](https://ar5iv.labs.arxiv.org/html/1907.02698). A 2026 re-evaluation on USPop alone is lower and more honest about dataset shift: BTC maj-min **0.763**, root **0.820**, against a CRNN at **0.780** maj-min and a Mamba variant (BMACE) at **0.768**. [A Mamba-Based Model for Automatic Chord Recognition, Jan 2026](https://arxiv.org/html/2601.02101v1). A 2025 BTC variant claimed **+1.2 to +2.2 points** on MIREX chord metrics over mainstream baselines. [BTC-FDAA-FGF, Computers and Electrical Engineering, Oct 2025](https://www.sciencedirect.com/science/article/abs/pii/S0045790625004987).

Frame-level chord accuracy in the low 80s on studio pop means a wrong chord every few bars. That is good enough to see a tonic move from G to A♭ and stay there. It is not good enough to print an unrehearsed chart. A bass player on X said the quiet part in November 2025: “chordify is wrong a lot so i have to figure it out by ear.” [x.com/jonimonstr/status/1985491362050170979](https://x.com/jonimonstr/status/1985491362050170979). Chordify’s own help text only says the transpose control “shows you in which key the song is written.” It publishes no accuracy. [Chordify support, updated 15 Sep 2026](https://support.chordify.net/hc/en-us/articles/360002164538-How-to-use-Premium-features).

The reduction from chords to key, for this feature:

- Histogram of chord roots inside a section, weighted by duration, scored against the diatonic sets. A worship-facing tool already tells users that if two keys tie, pick the chord the phrase rests on. [WorshipChordBook key finder](https://worshipchordbook.com/tools/key-finder).
- A modulation is a **new** tonic that persists, not one borrowed chord. Secondary dominants (a D major inside G) must not flip the key. Temperley’s change penalty and the HMM self-loop exist for this reason. [Temperley 1999](http://davidtemperley.com/wp-content/uploads/2015/11/temperley-mp99.pdf).
- The tell for minor, against its relative major, is the major chord on scale degree 5 (E or E7 in A minor). That G♯ is not in C major. [Relative major vs minor, Aug 2026](https://guitartoolhub.com/blog/is-my-song-in-c-or-a-minor-relative-major-vs-minor).

## Relative major, minor, and the fifth

C major and A minor use the same seven notes. The profile correlation between them is high by construction, which is why MIREX gives that error partial credit instead of treating it as a total miss. [ISMIR 2018 metric definition](https://ar5iv.labs.arxiv.org/html/1808.05340). On Billboard, AllConv’s relative error was **4.2%** and its parallel error **6.2%**. On GiantSteps the relative error was **8.1%**. Those are the calls that put the band on the wrong home chord while every other chord name still “looks right.”

Feige’s June 2026 thread is the practitioner version of the same three error classes. Relative keys are the same Camelot number with the letter flipped (8A versus 8B), “and software mixes them up all the time.” A loud fifth makes a detector call C major as G, one Camelot slot away, “wrong, but close enough that nothing screams.” Kick, sub, and bass can dominate the chroma so the low end, not the harmonic center, wins. [x.com/yannickfe/status/2061804905841541528](https://x.com/yannickfe/status/2061804905841541528). An engineer posting on 24 Sep 2026 measured the underlying fact without a neural net: pitch histograms of keys a fifth apart already correlate at **0.50**, because those keys share six of seven notes. A model he probed rediscovered the circle of fifths only because it failed to destroy that structure. His “99%” figure is a linear read-out of a symbolic next-note model’s hidden state, not audio key accuracy. [x.com/pburghdoom/status/2103152638334525861](https://x.com/pburghdoom/status/2103152638334525861).

Essentia exposes the tie directly: `strength` and `firstToSecondRelativeStrength`. If those two are close, the honest output is “G major, or E minor,” not a single word. [Essentia Key](https://essentia.upf.edu/reference/std_Key.html).

Modal worship writing (Dorian vamps, Mixolydian ♭VII) makes this worse. A detector with only 24 major/minor classes will name the parent key. No current Essentia profile or madmom head has a Dorian class. [Essentia’s 24-way major/minor output](https://essentia.upf.edu/reference/std_Key.html).

## What people say about Moises, Chordify, Tunebat, and Mixed In Key

X in 2024–2026 has a lot of DJ and producer talk and almost no worship-MD posts that name these tools and give a count. The worship-specific evidence below is from product pages, not from a measured MD survey.

**Mixed In Key** is the tool working DJs tell each other to buy, and they still do not trust it alone.

- Ibiza DJ and Berklee Online instructor ENDO, 20 Aug 2025, after checking thousands of tracks on piano: “Mixed in key is by far the best out there. I was shocked with how inaccurate the other programs were.” [x.com/DJEndoLive/status/1958230433088348427](https://x.com/DJEndoLive/status/1958230433088348427).
- The post he was answering, from producer MATIRAMIC the same day: “Even when using Mixed In Key, I will always recommend double-checking. No software can ever be 100% accurate.” [x.com/matiramic/status/1958212100460773395](https://x.com/matiramic/status/1958212100460773395).
- Kenyan producer and hobbyist DJ 98Patrobas, 10 Nov 2025: Serato and Rekordbox key analysis are poor next to VirtualDJ; otherwise “you just get Mixed In Key,” or use your ears. [x.com/98_patrobas/status/1987851351045366001](https://x.com/98_patrobas/status/1987851351045366001).
- Feige, 2 Jun 2026: the same file in Rekordbox, Serato, and Mixed In Key can return three keys, and that is not three bugs. [thread](https://x.com/yannickfe/status/2061804905841541528).

Published numbers, with the bias labeled:

- Academic, EDM, 2017: Mixed In Key strict correct **67.2%** on GiantSteps, **65.7%** on a Beatport set, **72.0%** on the Shaath set. [Faraldo 2017](https://mtg.upf.edu/system/files/publications/aes_FARALDO_cameraReady.pdf).
- Independent reimplementation, GiantSteps: Mixed In Key 8.3 **69.37% correct / 75.70 weighted**, ahead of a KeyNet clone and well ahead of Rekordbox 7.12 (**56.79 / 65.53**). [MusicalKeyCNN](https://github.com/a1ex90/MusicalKeyCNN).
- Crossfader, 16 Dec 2024, sponsored by Mixed In Key: on 200-plus tracks, only **39%** of keys matched across Mixed In Key 11, Rekordbox, and Serato; Serato differed from Mixed In Key on **45%**, Rekordbox on **38%**. Sheet-music checks, they say, favored Mixed In Key. This measures **disagreement**, not accuracy. [wearecrossfader.co.uk](https://wearecrossfader.co.uk/blog/mixed-in-key-11/).
- Freqblog, Apr 2026, repeats those same 39 / 45 / 38 figures and attributes them to DJ-community comparisons “since 2019.” Not a new study. [freqblog.com](https://freqblog.com/blog/mixed-in-key-vs-rekordbox-serato-key-detection/).
- Dubspot, 10 May 2026, a 200-track test from a DJ school: Mixed In Key 11 **178/200 = 89%** strict, KeyFinder **76%**, Rekordbox 7 **69%**, Beatport’s stored key **60%**. They report **94%** on dance, **90%** pop, **87%** hip-hop instrumentals, and **80%** on jazz/soul, “where modulation, extended-chord harmony, and rubato” hurt every system. Treat this as a vendor-adjacent lab note, not a paper. [blog.dubspot.com](https://blog.dubspot.com/dubspot-lab-report-mixed-in-key-vs-beatport).
- Magnetic Magazine’s Jan 2025 Mixed In Key 11 review says it “almost always” got the key, with occasional mismatches that had to be edited by hand. [magneticmag.com](https://magneticmag.com/2025/01/mixed-in-key-11-review/).

**Tunebat** is a lookup plus a rough estimator, and practitioners complain about it more than they praise it.

- Its catalog was built on Spotify Audio Features. Spotify deprecated that API on **27 Nov 2024**, so the database is frozen at pre-deprecation values. The analyzer and the database can disagree on the same song, and Tunebat’s own FAQ calls analyzer results estimates. [Parrser on the Spotify collapse, 25 Mar 2026](https://parrser.com/spotify-collapse), [sessionapps.com, 2026](https://sessionapps.com/best-key-and-bpm-detection-tools/).
- A DJ’s spreadsheet comparison, posted on Reddit in 2021 and still the most concrete public count, put Tunebat strict accuracy at **37–48%** across several datasets, Spotify at **15–39%**, and Mixed In Key at **74–86%** (one older set at 100%, which is not believable as a general rate). [r/DJs comparison](https://www.reddit.com/r/DJs/comments/m3q97z/key_detection_comparison_spotify_vs_tunebat_vs/).
- Parrser, 2026, says DJ communities put that Spotify-derived accuracy near **38%**, with relative-key swaps (A minor returned as C major) as the typical failure. [parrser.com](https://parrser.com/spotify-collapse).
- AudioCipher’s 2023 upload test found Tunebat’s characteristic miss to be a **fifth** (B minor labeled F minor, C minor labeled G minor), worse on sparse and ambient audio than on dense quantized tracks. [audiocipher.com](https://www.audiocipher.com/post/song-analyzer).
- On X in 2026 the complaints that surface are about tempo, which is the same pipeline: “how tunebat feels giving me the wrong bpm” ([x.com/VISUNGG/status/2103379335722029516](https://x.com/VISUNGG/status/2103379335722029516)) and a Japanese producer calling Tunebat’s BPM “a lie and dangerous” ([x.com/alien_taco0106/status/2098019627666489795](https://x.com/alien_taco0106/status/2098019627666489795)).

**Chordify.** No accuracy table turned up for 2024–2026. The in-the-wild comment is the one already quoted: wrong often enough that a player redoes it by ear. [x.com/jonimonstr/status/1985491362050170979](https://x.com/jonimonstr/status/1985491362050170979). Its transpose UI will also shift an entire detected key by a semitone, which is exactly what a last-chorus modulation is. If the detector averaged the two keys, transpose then moves both sections together and the key-up vanishes. [Chordify support](https://support.chordify.net/hc/en-us/articles/360002164538-How-to-use-Premium-features).

**Moises.** No 2024–2026 quantitative key study showed up in web or X search. X queries for “Moises” plus “key” are drowned out by footballer Moisés Caicedo. The only hands-on note found is AudioCipher in October 2023: key and tempo were “accurate for the majority” of a small follow-up set, and both are secondary to stem separation. [audiocipher.com](https://www.audiocipher.com/post/song-analyzer). Do not budget the feature on Moises’ key field.

**LLM key answers are worse than the DSP.** A musician who looks up a lot of keys wrote on 19 Aug 2026 that Google’s AI overview “gets it wrong 100% of the time,” including when every real source agrees. [x.com/TallBart/status/2089925544356024388](https://x.com/TallBart/status/2089925544356024388). An engineer describing a music-agent tool on 27 Sep 2026 does the split the right way: chromagram, loudness, tempo, and key come from signal processing and are allowed to be uncertain; a language model is only asked questions on top of that. [x.com/jmacftw/status/2104116197017202796](https://x.com/jmacftw/status/2104116197017202796).

## Pitfalls that will show up on worship and live recordings

- **Default Essentia profile is an EDM profile.** `bgate` by default, and `edmm` forces minor. Set `krumhansl` or `temperley` for this catalog. [Essentia Key](https://essentia.upf.edu/reference/std_Key.html).
- **Detuning is off unless you ask.** `KeyExtractor` defaults to `hpcpSize` 12. The average-detuning correction only works when `hpcpSize` is above 12. Live worship, older recordings, and tracks tuned sharp of A440 need 36 bins and `averageDetuningCorrection`. [KeyExtractor](https://essentia.upf.edu/reference/streaming_KeyExtractor.html).
- **The low end votes too hard.** Kick, bass guitar, and sub dominate chroma. Feige names this as a main cause of wrong EDM keys; a live drum kit does the same thing. [Feige thread](https://x.com/yannickfe/status/2061804905841541528). High-pass or harmonic-percussive separation before the chroma, or trust the chord model’s bass-versus-harmony split more than the raw profile.
- **Speech, crowd, and the talk-up.** A pastor’s intro or a crowd swell is inharmonic energy. If it is inside the averaged window it dilutes `strength`. Cut non-music regions before key estimation. Structure segmentation is doing key estimation a favor here, not only producing the Intro > Verse > Chorus string.
- **Pads and distorted guitars.** AudioCipher saw Tunebat fail on ambient pads and solo lines, and do better on dense quantized mixes. [audiocipher.com](https://www.audiocipher.com/post/song-analyzer). A verse that is only piano and vocal is a different problem from a full-band chorus of the same song. Estimate them separately.
- **Short sections.** The 2018 CNN was trained on 20-second crops and still did worse when tested on short excerpts than on the whole piece. A 8-second turnaround is not a reliable key window. Aggregate a section, or pool every chorus, before you trust a label. [ISMIR 2018](https://ar5iv.labs.arxiv.org/html/1808.05340).
- **Self-transition versus the key-up.** An HMM or a high key-change penalty keeps the verse stable and can miss a one-chorus modulation. A memoryless frame classifier flickers. For this product the decision should be sectional: one key per arranged section, then a change only if the next stable section is +1 or +2 semitones and its own strength is high. That matches truck-driver form better than frame-level Winterreise tracking. The HMM failure mode is documented by Gedizlioğlu and Erol. [2024](https://journals.sagepub.com/doi/10.1177/10298649241245075).
- **Capo, male/female keys, and “the chart key.”** Detection hears the recording. A chart in G with a capo, or a female-key down-transpose, is a different number. WorshipChordBook notes that piano-driven worship often lives in B♭, E♭, and A♭, which profile methods handle fine but guitarists then capo away from. [WorshipChordBook](https://worshipchordbook.com/tools/key-finder). Report the audio key, and let transposition be a separate step.
- **Don’t fine-tune on other mixes of the same song and call it generalization.** The Winterreise CNN went from about 72% on new songs to about 96% on new recordings of songs it had already seen. [ICASSP 2020](https://www.audiolabs-erlangen.de/content/05_fau/professor/00_mueller/03_publications/2020_SchreiberWM_LocalKey_ICASSP_PrintedVersion.pdf). Holding out a live version of a song whose studio mix was in training will flatter the model.

## A concrete pipeline for this feature

No code, just the decision order that the evidence supports.

1. Segment the recording into arrangement sections first. Run key and chords inside sections, never on the whole file.
2. Run two global estimators per section. Essentia `Key` with `profileType=krumhansl` (pop) or `temperley` (if minor-mode errors dominate), `hpcpSize=36`, detuning correction on. In parallel, madmom’s `CNNKeyRecognitionProcessor`, which is the 2018 AllConv ensemble and returns a 24-way distribution. [madmom](https://madmom.readthedocs.io/en/latest/modules/features/key.html).
3. Run a chord model on the same audio. BTC if you want the stronger published pop numbers (about **83%** maj-min WCSR on the 2019 Beatles/pop mix, lower on a later USPop-only rerun). Chordino if you want a simple Vamp/NNLS pipeline and can accept 2010-era chord accuracy around **80%** on that older metric. [BTC](https://ar5iv.labs.arxiv.org/html/1907.02698), [NNLS](https://zenodo.org/records/1416598).
4. Accept a section key only when the two estimators agree, or when they disagree by a relative or parallel pair and the chord tally breaks the tie (final chord of the phrase, plus a major V if you are choosing minor). If `firstToSecondRelativeStrength` is low, return both labels.
5. Emit a modulation only when a later section’s accepted tonic is **one or two semitones** above an earlier section’s, both strengths are high, and the new tonic holds for the rest of that section. Keep the opening key as the song key and attach the change (“G major, last chorus A♭ major”). Do not emit a modulation for a relative-key flip with no new pitch-class content.
6. Show the fifth-related runner-up whenever it is close. That is the error class both the MIREX weights and working DJs say is silent until the mix clashes. [Feige](https://x.com/yannickfe/status/2061804905841541528), [MIREX](https://www.music-ir.org/mirex/wiki/2025:Audio_Key_Detection).
7. Do not use Tunebat or Spotify catalog keys as ground truth, and do not ask a language model to name the key. Use a language model, if at all, only to phrase a result the DSP already flagged as uncertain.

Expected accuracy, if the implementation is careful: on a clean studio worship track with one key, in the neighborhood of the Billboard CNN result, roughly **80% strict, 85% weighted**, with the remaining errors concentrated on relative, parallel, and fifth. [ISMIR 2018](https://ar5iv.labs.arxiv.org/html/1808.05340). On a live recording with a last-chorus key-up, nobody has published the number. The failure mode to design against is not random wrong keys. It is a confident single key that picked either the verse or the final chorus and dropped the other.

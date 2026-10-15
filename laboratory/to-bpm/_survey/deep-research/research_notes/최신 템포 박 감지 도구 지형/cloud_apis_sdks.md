# Cloud APIs, commercial SDKs, and web services for tempo, beat, and downbeat timestamps (as of Oct 2026)

Scope note: this pass used about 17 search/fetch calls. The prior note (`Logic 템포 감지 배치 활용/commercial_alternatives.md`) already covers zplane AUFTAKT v4 features, Superpowered (BPM + first beat only), Spotify's Nov-2024 closure, the Cyanite BPM tag, Mixed In Key, the BytePlus beat SDK, and DJ apps. This note adds to it and does not repeat it. Many vendor pages were not fetched: Moises app, AudioShake, LALAL.AI, Tunebat, Musicstax, GetSongBPM, ACRCloud, AudD, Musixmatch, SoundHound, Hooktheory, and YouTube. Their entries are in Gaps.

## Q1. What does each service return, how is it called, and what does it cost?

### Takeaway
Two services found return per-beat timestamps through an HTTP API callable from Kaggle: the Music.AI "Transcription – Beats" module and the Replicate-hosted All-In-One analyzer. Only All-In-One explicitly returns downbeats and sections. Music.AI documents only `bpm` + `beatMap` (beat time + beat number). The others (Cyanite, Spotify, AcousticBrainz CSV, Chordify) give global BPM only, are closed, or have no public API.

### Cited Findings
**Music.AI (Moises B2B platform)**
- Pricing: "Transcription – Beats" costs $0.03/min pay-as-you-go ($0.0285 Professional). Chords and Sections cost $0.04/min each ($0.038 Professional). Business/Enterprise pricing is volume-based. — [Music.AI pricing](https://music.ai/pricing/)
- The free pay-as-you-go tier has 48 h temporary storage and 2 concurrent processing jobs. Professional includes 100 GB permanent storage. — [Music.AI pricing](https://music.ai/pricing/)
- The Beats module outputs `bpm` (one number for the track) and `beatMap` (a JSON string of beat annotations, each with start time and beat number). The page does not mention downbeats, beat-in-bar, or tempo changes, and makes no accuracy claims. — [Music.AI Beats module](https://music.ai/modules/transcription/beats/)
- The Chords module returns a timeline of chord annotations plus the root key. — [Music.AI modules](https://music.ai/modules/)
- Platform model: Modules are chained into Workflows, and Jobs run a workflow on files. Input is a public URL, or an upload server that issues temporary signed URLs. Access is via an authenticated API or a no-code dashboard. — [Music.AI docs](https://music.ai/docs/)

**All-In-One Music Structure Analyzer (Kim & Nam, WASPAA 2023) on Replicate**
- `sakemin/all-in-one-music-structure-analyzer` outputs tempo (BPM), beats, downbeats, segment boundaries, and segment labels (intro/verse/chorus/bridge/outro). It runs on an Nvidia A100 (40GB), costs about $0.068/run (~14 runs per $1, varies with input), typically finishes within 60 s, and is open source and runnable locally via Docker. — [Replicate: sakemin](https://replicate.com/sakemin/all-in-one-music-structure-analyzer). A search snippet of an older snapshot gave ~$0.10–0.11/run. — [internal.replicate.com mirror](https://internal.replicate.com/sakemin/all-in-one-music-structure-analyzer)
- `cwalo/all-in-one-music-structure-analysis` also returns structure, BPM, and downbeats, and demixes stems (snippet: ~$0.15/run, under 3 min). — [Replicate: cwalo](https://replicate.com/cwalo/all-in-one-music-structure-analysis); [API schema](https://replicate.com/cwalo/all-in-one-music-structure-analysis/api/schema); [cog wrapper source](https://github.com/cwalo/cog-all-in-one)
- `jhurliman/allinone-targetbpm` is a fork with a `target_bpm` parameter that holds the beat tracker within ±1 BPM. Its author notes the original model sometimes misdetects tempo by half or double. — [Replicate readme](https://replicate.com/jhurliman/allinone-targetbpm/readme)

**Cyanite.ai**
- The API is GraphQL. A 2021 changelog says `AudioAnalysisV6Result.bpm`, `.key`, and `.timeSignature` (a string, e.g. "3/4") replace the deprecated FullScale/FastMusicalAnalysis types. — [Cyanite changelog](https://cyanite.ai/?p=10503); [Cyanite getting started](https://cyanite.ai/getting-started)
- The FAQ lists BPM, Tempo, Key, genres, moods, and instruments as generated metadata. Beat timestamps are not mentioned. — [Cyanite FAQ](https://cyanite.ai/faq/)

**Spotify Web API**
- Since 2024-11-27, `/v1/audio-analysis/{id}` (beats, bars, tatums, sections) and `/v1/audio-features` return 403 for new apps. Apps that already had extended quota access kept it. — [Spotify dev blog](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api); [third-party guide, 2026](https://www.rapidevelopers.com/md/api-automations/how-to-automate-spotify-listening-reports-using-the-api)
- In Feb 2026, Development Mode apps got further restrictions (popularity, followers, top tracks, new releases). No official replacement for audio analysis was found. — [rapidevelopers guide](https://www.rapidevelopers.com/md/api-automations/how-to-automate-spotify-listening-reports-using-the-api); [musiciwant: alternatives](https://musiciwant.com/studio/spotify-audio-features-alternative)
- A third-party write-up says independent tests found GetSongBPM/Tunebat BPM/key values not always accurate. These are metadata lookups, not analysis of the user's audio. — [musiciwant](https://musiciwant.com/studio/spotify-audio-features-alternative)

**AcousticBrainz (shut down; dumps remain)**
- Data collection stopped in 2022, and the site and API stay up for now. Data is CC0. — [acousticbrainz.org](https://acousticbrainz.org/); [beets plugin doc (deprecated)](https://docs.beets.io/en/latest/plugins/acousticbrainz.html)
- Dumps (snapshot 2022-06-23): full low-level and high-level JSON of 29,460,584 submissions in 30 zstd archives, a 100k sample, and low-level CSVs (lowlevel/rhythm/tonal). The rhythm CSV includes `bpm` but not `beats_position`. The full dumps are not deduplicated. — [AcousticBrainz download](https://acousticbrainz.org/download)
- `beats_position` is an Essentia RhythmDescriptors/RhythmExtractor2013 output, so the low-level JSON likely contains it. This is unverified in the dump. — [Essentia RhythmDescriptors](https://essentia.upf.edu/reference/std_RhythmDescriptors.html)

**Chordify**: consumer app that extracts chords from YouTube, Deezer, SoundCloud, or uploaded files. Premium exports MIDI. No public API or developer program was found. — [protein.xyz on Chordify](https://www.protein.xyz/chordify/); [ISMIR 2015 LBD (Chordify)](https://www.ismir2015.uma.es/LBD/LBD42.pdf)

**Klangio**: says its API offers transcription, source separation, beat tracking, and chord/strum recognition, with self-serve plans from a free tier, volume contracts, and on-device licensing. A third-party connector exposes only transcription and strum jobs (input: URL or Base64 audio). — [OOMOL Klangio skill](https://oomol.com/es/skills/oo-klangio/source.md); [Songscription vs Klangio](https://www.songscription.ai/blog/songscription-vs-klangio)

**zplane AUFTAKT SDK**: every SDK delivery has a 3-week evaluation period. It ships static libs, C/C++ headers, docs, and examples. License types are commercial, server, in-house, and academic. Fees depend on product and platform count and are usually royalty-based. — [zplane licensing](https://licensing.zplane.de/licensing). (Features and the CLI example are in the prior note.)

### Inferences
- Kaggle-callable (outbound HTTP) options: Music.AI, Replicate, Cyanite, Klangio. Kaggle notebooks need internet enabled, and API keys go in Kaggle Secrets. A zplane SDK would run on Kaggle only if a Linux static lib is licensed. Linux support was not confirmed.
- Cost for ~500 songs × ~5 min ≈ 2,500 min: Music.AI Beats ≈ $75 (plus ≈ $100 each for Sections or Chords). Replicate All-In-One at ~$0.07–0.15/run ≈ $35–75. Both are cheap enough.
- All-In-One is open source (`allin1` pip package), so the "commercial" Replicate route only buys hosted GPUs. It is not an independent method. Running it in a Kaggle notebook directly avoids upload ToS issues entirely.

### Gaps
- The Music.AI beatMap's exact JSON (is beat number = position in bar, i.e. downbeat = 1?), rate limits beyond 2 concurrent jobs, and any Python SDK: not confirmed.
- Current Cyanite API pricing and the full schema (api-docs.cyanite.ai) were not fetched.
- Not fetched or found: Moises consumer app (no API), AudioShake (stems/lyrics; no beat output found), LALAL.AI, Hooktheory, Tunebat/Musicstax/GetSongBPM API terms, ACRCloud/AudD/Musixmatch/SoundHound BPM fields, Superpowered/Elastique updates, Hugging Face Inference Endpoints hosting Beat This!/madmom, and whether YouTube Music/Google exposes BPM (no source found).

## Q2. Data retention and ToS for uploading commercially released worship songs

### Takeaway
Vendors put the copyright burden on the uploader. Music.AI requires you to warrant that you hold "all rights necessary" for it to process the content. Uploading commercial worship recordings (CCLI-licensed songs, label-owned masters) to third-party clouds is therefore a ToS and copyright risk, even for research. Local or Kaggle-hosted open models avoid this.

### Cited Findings
- Music.AI ToS §7(a): the customer "represent[s] and warrant[s] that you possess all rights necessary for us to receive, process, and create" outputs. The customer is solely responsible for permissions. — [Music.AI terms](https://music.ai/terms/)
- §7(c): the license does not include rights to train or fine-tune models on customer content without opt-in. But §7(a) allows use "to improve or develop our products and services", and §7(d) gives Music.AI ownership of Usage Data derived from content. — [Music.AI terms](https://music.ai/terms/)
- §7(b): Music.AI may delete content and outputs at any time and may retain content "indefinitely in anonymized form". The free tier keeps files 48 h. — [Music.AI terms](https://music.ai/terms/); [pricing](https://music.ai/pricing/)
- The Spotify closure was framed as security and anti-scraping. — [musiciwant](https://musiciwant.com/studio/spotify-audio-features-alternative)

### Inferences
- Owning CDs, or having a CCLI streaming/copy license, does not obviously grant the right to upload masters to a processing vendor. Treat every cloud upload as requiring rights clearance, or limit it to self-recorded or permissively licensed audio.
- Replicate: uploaded inputs go to a third-party model host. Its retention terms were not checked (gap). Same rights-warranty concern.

### Gaps
- Replicate, Cyanite, Klangio, and Chordify ToS/retention clauses were not fetched.
- No legal source on research or TDM exceptions (e.g., EU DSM Art. 3/4, Korean copyright law) for sending audio to processors.

## Q3. Accuracy evidence, LLM tempo estimation, and a ranking for the pipeline

### Takeaway
No independent accuracy benchmark was found for Music.AI, Cyanite, Klangio, or any commercial API. All-In-One has published academic results (WASPAA 2023). For LLMs, no 2025–2026 evaluation of Gemini or GPT-4o tempo estimation was found. The research audio-LLM evidence (LLark, TEMPO) shows LLM numeric tempo lagging dedicated estimators.

### Cited Findings
- LLark frames tempo as a prompted question scored with Acc2 (±4%, octave-tolerant). It notes the LLM lagged a dedicated feature extractor, which scored 0.947 Acc2 on the dataset. — [LLark arXiv 2310.07160](https://arxiv.org/pdf/2310.07160)
- TEMPO (2026 preprint) reports tempo accuracy within 4% for audio-LLMs. Its baselines are Qwen3-Omni and Audio Flamingo Next, not Gemini or GPT-4o. — [arXiv 2608.29999](https://arxiv.org/pdf/2608.29999)
- TAG-Bench (2026) evaluates temporal audio grounding across 21 systems, including Gemini-3.1-Pro. Whether tempo or beats are included was not verified. — [arXiv 2609.01542](https://arxiv.org/pdf/2609.01542)
- All-In-One is known to make half/double tempo errors (fork author). — [allinone-targetbpm readme](https://replicate.com/jhurliman/allinone-targetbpm/readme)

### Inferences
Ranking for adding a comparison method over several hundred worship songs:
1. **All-In-One (allin1)**: beats + downbeats + BPM + sections, open source. Run it inside Kaggle (preferred, no upload ToS), or use Replicate (~$0.07/run, HTTP) if GPU setup fails.
2. **Music.AI Beats (+ Sections/Chords)**: the only real commercial black box with HTTP beat timestamps. Cheap (~$75/500 songs) and Kaggle-callable. It is a proprietary, independent model (Moises), which makes it useful as an "industry" reference. Downsides: downbeat semantics unconfirmed, rights warranty required.
3. **zplane AUFTAKT v4 SDK**: the richest commercial output (beats, downbeats, tempo/meter changes). Needs a 3-week eval license, Linux availability is unknown, and the license is royalty-oriented.
4. **Klangio API**: claims beat tracking. Endpoint and pricing unverified.
5. **Cyanite**: global BPM + time signature only, useful for tempo-only sanity checks.
6. **AcousticBrainz dump**: free CC0 Essentia BPM (and likely beats_position in JSON). Only for songs with MusicBrainz IDs submitted before 2022, and the old Essentia algorithm is weak. Low value.
7. **Spotify / GetSongBPM / Tunebat / Chordify / LLMs (Gemini/GPT)**: closed, metadata-only, no API, or no evidence of beat-level accuracy. Not suitable as beat methods. An LLM could at most be a curiosity global-BPM baseline.

### Gaps
- No vendor-published or third-party beat F-measure for Music.AI, Cyanite, Klangio, or AUFTAKT.
- No direct Gemini, GPT-4o, or GPT-5 audio tempo evaluation was found. It would need an in-house test.

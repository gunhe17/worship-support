//! 오디오 파일 → Beat This!(final0) + DBN 박·첫 박. 한 파일에 JSON 한 줄.
//!
//!   bpm-worker <models 폴더> <audio.wav> [audio2.wav …]
//!   → {"file": "...", "beats": [초…], "downbeats": [초…]}
//!
//! models 폴더: mel_spectrogram.onnx · beat_this.onnx (download-models.sh).
//! 디코딩은 symphonia(WAV·MP3·FLAC·OGG). 그 밖의 형식은 serve.py가 ffmpeg로 WAV로 바꿔 넘긴다.
mod dbn;

use beat_this::{BeatThis, RtenRuntime};
use std::path::Path;

fn list(xs: &[f64]) -> String {
    xs.iter().map(|x| format!("{x:.3}")).collect::<Vec<_>>().join(",")
}

fn main() -> anyhow::Result<()> {
    let args: Vec<String> = std::env::args().collect();
    anyhow::ensure!(args.len() >= 3, "사용법: bpm-worker <models 폴더> <audio> [audio …]");
    let dir = Path::new(&args[1]);
    let mut bt = BeatThis::new(&RtenRuntime, &dir.join("mel_spectrogram.onnx"), &dir.join("beat_this.onnx"))?;
    for f in &args[2..] {
        let a = bt.analyze_file(Path::new(f))?;
        let (beats, downs) = dbn::track(&a.beat_logits, &a.downbeat_logits);
        let name = f.replace('\\', "\\\\").replace('"', "\\\"");
        println!(r#"{{"file":"{name}","beats":[{}],"downbeats":[{}]}}"#, list(&beats), list(&downs));
    }
    Ok(())
}

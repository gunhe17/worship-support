#!/bin/sh
# Beat This! ONNX 모델 받기 (danigb/beat-this-rs, MIT). beat_this.onnx = 전체 모델(final0), sha256 확인.
set -e
cd "$(dirname "$0")" && mkdir -p models && cd models
curl -fsSL -o mel_spectrogram.onnx https://raw.githubusercontent.com/danigb/beat-this-rs/main/models/mel_spectrogram.onnx
curl -fsSL -o beat_this.onnx https://github.com/danigb/beat-this-rs/releases/download/model-large/beat_this.onnx
curl -fsSL -o beat_this.onnx.sha256 https://github.com/danigb/beat-this-rs/releases/download/model-large/beat_this.onnx.sha256
shasum -a 256 -c beat_this.onnx.sha256

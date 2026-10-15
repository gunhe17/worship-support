"""찬양 500곡 전체를 Whisper large-v3로 받아쓴다 (원곡 믹스 그대로, 곡 전체).

설정은 songform-crop-stt에서 가장 정확했던 것(CER 중앙값 0.107)과 같다:
faster-whisper large-v3 fp16, language=ko, vad_filter=False(VAD가 노래를 음성 아님으로 자름), condition_on_previous_text=False(반복 환각), beam 5.
출력: /kaggle/working/out/<id>.json = {id, team, title, dur, secs, segments: [[시작, 끝, 가사], ...]}. 곡마다 바로 저장해서 끊겨도 이어 돌린다.
"""
import glob, json, os, subprocess, sys, time
import numpy as np

T0, DEADLINE = time.time(), 11 * 3600
OUT = "/kaggle/working/out"
os.makedirs(OUT, exist_ok=True)
subprocess.run(f"{sys.executable} -m pip install -q faster-whisper > /kaggle/working/pip.log 2>&1", shell=True)
from faster_whisper import WhisperModel

sj = glob.glob("/kaggle/input/**/songs.json", recursive=True)[0]
root = os.path.dirname(sj)
songs = json.load(open(sj))
print("songs", len(songs), "root", root, flush=True)
fw = WhisperModel("large-v3", device="cuda", compute_type="float16")
done = 0
for i, s in enumerate(songs):
    dst = f"{OUT}/{s['id']}.json"
    if os.path.exists(dst):
        continue
    if time.time() - T0 > DEADLINE:
        print("deadline, stop at", i, flush=True)
        break
    src = [f for f in glob.glob(f"{root}/{s['id']}.*") if not f.endswith(".json")]
    if not src:
        continue
    t = time.time()
    try:
        # 파일 경로를 주면 faster-whisper가 PyAV로 읽는데, Kaggle의 새 PyAV와 호출이 맞지 않아(metadata_errors) ffmpeg로 직접 16 kHz 모노 배열을 만든다
        pcm = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", src[0], "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True, check=True).stdout
        audio = np.frombuffer(pcm, np.float32)
        segs, info = fw.transcribe(audio, language="ko", vad_filter=False, condition_on_previous_text=False, beam_size=5)
        rows = [[round(x.start, 2), round(x.end, 2), x.text.strip()] for x in segs]
        json.dump({"id": s["id"], "team": s["team"], "title": s["title"], "dur": round(info.duration, 1), "secs": round(time.time() - t, 1),
                   "segments": rows}, open(dst + ".tmp", "w"), ensure_ascii=False)
        os.replace(dst + ".tmp", dst)
        done += 1
    except Exception as e:
        print("error", s["id"], repr(e)[:200], flush=True)
    if i % 25 == 0:
        print(i, s["id"], f"{time.time() - t:.0f}s", f"total {time.time() - T0:.0f}s", flush=True)
print("DONE", done, f"{time.time() - T0:.0f}s", flush=True)

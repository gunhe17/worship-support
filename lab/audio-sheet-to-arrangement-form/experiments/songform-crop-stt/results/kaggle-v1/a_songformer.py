
import glob, json, os, time
SRC, W, OUT = "/kaggle/input/datasets/gunhe17/worship-songform-pool", "/kaggle/working", "/kaggle/working/out"
SONGS = json.load(open(f"{SRC}/songs.json"))
PAD = 1.5
def tlog(k, v):
    p = f"{OUT}/timing.json"; d = json.load(open(p)) if os.path.exists(p) else {}
    d[k] = round(v, 1); json.dump(d, open(p, "w"), indent=1)

import sys, torch
from huggingface_hub import snapshot_download
from transformers import AutoModel
d = snapshot_download("ASLP-lab/SongFormer", ignore_patterns=["SongFormer.pt", "SongFormer.safetensors"])
sys.path.append(d); os.environ["SONGFORMER_LOCAL_DIR"] = d
m = AutoModel.from_pretrained(d, trust_remote_code=True, low_cpu_mem_usage=False).to("cuda").eval()
m.config.win_size = m.config.hop_size = 180
for s in SONGS:
    t = time.time()
    segs = [x for x in m(f"{SRC}/audio/{s['id']}.wav") if x["end"] - x["start"] > 0.5]
    json.dump(segs, open(f"{OUT}/{s['id']}.segments.json", "w"), indent=1)
    tlog(f"songformer/{s['id']}", time.time() - t); print("songformer", s["id"], len(segs), flush=True)

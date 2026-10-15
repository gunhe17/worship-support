# Usage: python songformer_run.py <audio> [device] [win_seconds]
# ponytail: default 420s window needs ~13GB+ RAM for a 6-min song on CPU/MPS (full attention); pass e.g. 180 on a 24GB Mac   -> prints segments JSON + runtime
import os, sys, json, time
from huggingface_hub import snapshot_download
from transformers import AutoModel
d = snapshot_download("ASLP-lab/SongFormer", ignore_patterns=["SongFormer.pt", "SongFormer.safetensors"])
sys.path.append(d); os.environ["SONGFORMER_LOCAL_DIR"] = d
dev = sys.argv[2] if len(sys.argv) > 2 else "cpu"
t = time.time()
m = AutoModel.from_pretrained(d, trust_remote_code=True, low_cpu_mem_usage=False).to(dev).eval()
if len(sys.argv) > 3: m.config.win_size = m.config.hop_size = int(sys.argv[3])
print(f"load {time.time()-t:.1f}s", file=sys.stderr)
t = time.time()
res = m(sys.argv[1])
print(f"infer {time.time()-t:.1f}s on {dev}", file=sys.stderr)
print(json.dumps(res, ensure_ascii=False, indent=1, default=float))

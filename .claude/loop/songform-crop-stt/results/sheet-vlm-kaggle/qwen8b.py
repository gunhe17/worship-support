
import glob, json, os, subprocess, sys, time
subprocess.run(f"{sys.executable} -m pip install -q -U bitsandbytes accelerate", shell=True)
import torch
from transformers import AutoProcessor, Qwen3VLForConditionalGeneration
MODEL = "Qwen/Qwen3-VL-8B-Instruct"
out = os.path.join("/kaggle/working/vlm", MODEL.split("/")[-1]); os.makedirs(out, exist_ok=True)
kw = dict(dtype=torch.float16, device_map="cuda:0")
from transformers import BitsAndBytesConfig
kw["quantization_config"] = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_compute_dtype=torch.float16)
kw.pop("dtype")
# 2048 visual tokens max (~1267x1267). A full A4 sheet downscales; research says small Hangul
# suffers, so this is the number to revisit if CER is poor.
proc = AutoProcessor.from_pretrained(MODEL, max_pixels=2048 * 28 * 28)
m = Qwen3VLForConditionalGeneration.from_pretrained(MODEL, **kw).eval()
timing = {}
for img in sorted(sorted(p for p in glob.glob("/kaggle/input/datasets/gunhe17/worship-sheet-images/*") if p.lower().endswith((".png",".jpg",".jpeg")))):
    t = time.time()
    try:
        msg = [{"role": "user", "content": [{"type": "image", "url": img}, {"type": "text", "text": "\uc774 \uc545\ubcf4 \uc774\ubbf8\uc9c0\ub97c \uc77d\uace0 JSON\ub9cc \ucd9c\ub825\ud558\uc138\uc694. \uc124\uba85 \uae08\uc9c0.\n{\"title\": \"\", \"key\": \"\", \"time_signature\": \"\", \"tempo\": \"\", \"sections\": [{\"tag\": \"\", \"lyrics\": \"\", \"chords\": \"\"}]}\n\uaddc\uce59:\n- lyrics: \uc74c\ud45c \uc544\ub798 \ud55c\uad6d\uc5b4 \uac00\uc0ac\ub97c \uc790\uc5f0\uc2a4\ub7ec\uc6b4 \ubb38\uc7a5\uc73c\ub85c \uc774\uc5b4 \ubd99\uc774\uc138\uc694. \uc74c\uc808 \uc0ac\uc774 \ud558\uc774\ud508(-)\uacfc \uacf5\ubc31\uc740 \uc81c\uac70\ud569\ub2c8\ub2e4.\n- tag: \uc545\ubcf4\uc5d0 \ud45c\uc2dc\ub41c \uad6c\uac04\uba85(Verse, Chorus, V, C, A, B \ub4f1). \ud45c\uc2dc\uac00 \uc5c6\uc73c\uba74 \uac00\uc0ac \ud750\ub984\uc73c\ub85c \ucd94\uc815\ud558\uc138\uc694. \ub9c8\ub514 \ubc88\ud638\ub294 \uc4f0\uc9c0 \ub9c8\uc138\uc694.\n- chords: \ud574\ub2f9 \uad6c\uac04\uc758 \ucf54\ub4dc \uae30\ud638\ub97c \uc21c\uc11c\ub300\ub85c."}]}]
        inp = proc.apply_chat_template(msg, add_generation_prompt=True, tokenize=True,
                                       return_dict=True, return_tensors="pt").to(m.device)
        with torch.no_grad():
            g = m.generate(**inp, max_new_tokens=1500, do_sample=False)
        txt = proc.decode(g[0][inp["input_ids"].shape[1]:], skip_special_tokens=True)
    except Exception as e:
        txt = f"ERROR: {e!r}"[:400]
    torch.cuda.empty_cache()
    open(os.path.join(out, os.path.basename(img).rsplit(".", 1)[0] + ".json"), "w").write(txt)
    timing[os.path.basename(img)] = round(time.time() - t, 1)
    print(f"  {os.path.basename(img)}: {timing[os.path.basename(img)]}s", flush=True)
json.dump(timing, open(os.path.join(out, "_timing.json"), "w"), indent=1)

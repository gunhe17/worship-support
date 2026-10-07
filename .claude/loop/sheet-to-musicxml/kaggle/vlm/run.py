# Kaggle T4 kernel: sheet image -> MusicXML accuracy, candidate 2 = vision LLM -> ABC -> MusicXML.
# Reuses images + answer keys produced by kernel gunhe17/sheet-xml-audiveris (kernel_sources).
# Lyrics are deliberately left out: priority is notes (pitch/rhythm), then chords/structure.
import glob, json, os, re, shutil, signal, subprocess, sys, textwrap, time, urllib.request

try:
    urllib.request.urlopen("https://pypi.org", timeout=10); net = True
except Exception:
    net = False
print(f"PRECHECK gpu={shutil.which('nvidia-smi') is not None} internet={net}", flush=True)
if not (shutil.which("nvidia-smi") and net): sys.exit("PRECHECK failed")

W = "/kaggle/working"; OUT = f"{W}/out"; os.makedirs(OUT, exist_ok=True)
SRC = glob.glob("/kaggle/input/**/out/setA.json", recursive=True)[0].rsplit("/", 1)[0]
print("inputs from", SRC, flush=True)
PY = sys.executable
subprocess.run(f"{PY} -m pip install -q -U musicdiff 'transformers>=4.57' accelerate > {OUT}/pip.log 2>&1", shell=True)

PROMPT = """Transcribe this sheet music image into ABC notation (ABC 2.1) as exactly as possible.
Requirements:
- Header: X:1, T:<title>, M:<time signature>, L:1/8, K:<key signature>
- Every note with correct pitch (octave via , and ') and duration relative to L:1/8, rests as z
- Chord symbols in double quotes right before the note they sit on, e.g. "Am7"A2
- Bar lines |, repeats |: and :|, first/second endings [1 and [2
- Do NOT include lyrics (no w: lines)
Output only the ABC inside one ```abc code block."""

STAGE = r'''
import glob, json, os, time, torch
from transformers import AutoProcessor, Qwen3VLForConditionalGeneration
MODEL, MAXPIX, OUTD = "__MODEL__", __MAXPIX__, "__OUTD__"
os.makedirs(OUTD, exist_ok=True)
proc = AutoProcessor.from_pretrained(MODEL, max_pixels=MAXPIX)
m = Qwen3VLForConditionalGeneration.from_pretrained(MODEL, dtype=torch.float16, device_map="cuda:0").eval()
imgs = sorted(glob.glob("__SRC__/images/A/*")) + sorted(glob.glob("__SRC__/images/B/*"))
timing = {}
for img in imgs:
    stem = os.path.basename(img).rsplit(".", 1)[0]
    t = time.time()
    try:
        msg = [{"role": "user", "content": [{"type": "image", "url": img}, {"type": "text", "text": __PROMPT__}]}]
        inp = proc.apply_chat_template(msg, add_generation_prompt=True, tokenize=True, return_dict=True,
                                       return_tensors="pt").to(m.device)
        with torch.no_grad():
            g = m.generate(**inp, max_new_tokens=2500, do_sample=False, repetition_penalty=1.05)
        txt = proc.decode(g[0][inp["input_ids"].shape[1]:], skip_special_tokens=True)
    except Exception as e:
        txt = f"ERROR: {e!r}"[:400]
    torch.cuda.empty_cache()
    open(f"{OUTD}/{stem}.abc.txt", "w").write(txt)
    timing[stem] = round(time.time() - t, 1)
    print(f"  {stem}: {timing[stem]}s", flush=True)
json.dump(timing, open(f"{OUTD}/_timing.json", "w"), indent=1)
'''
def stage(model, maxpix):
    outd = f"{OUT}/{model.split('/')[-1]}"
    code = (STAGE.replace("__MODEL__", model).replace("__MAXPIX__", str(maxpix)).replace("__OUTD__", outd)
                 .replace("__SRC__", SRC).replace("__PROMPT__", json.dumps(PROMPT)))
    p = f"{W}/stage_{model.split('/')[-1]}.py"; open(p, "w").write(code)
    print(f"\n===== {model}", flush=True)
    subprocess.run(f"{PY} {p} 2>&1 | grep -vE 'Warning|warn|it/s\\]' | tail -80", shell=True)
    return outd

outdirs = [stage("Qwen/Qwen3-VL-4B-Instruct", 2048 * 28 * 28)]

# ---------------- ABC -> MusicXML, then score ----------------
import music21 as m21, musicdiff
DL = musicdiff.DetailLevel
DETAILS = {"notes": DL.NotesAndRests, "signatures": DL.Signatures, "barlines": DL.Barlines,
           "chords": DL.ChordSymbols, "all": DL.AllObjects}
class TO(Exception): pass
signal.signal(signal.SIGALRM, lambda *a: (_ for _ in ()).throw(TO()))

def abc_to_xml(txt, dst):
    m = re.search(r"```(?:abc)?\s*(.*?)```", txt, re.S)
    abc = (m.group(1) if m else txt).strip()
    if "X:" not in abc: abc = "X:1\n" + abc
    try:
        s = m21.converter.parse(abc, format="abc")
        s.write("musicxml", dst); return True
    except Exception as e:
        open(dst + ".err", "w").write(repr(e)[:500]); return False

def omr_ned(pred, gt, detail):
    if not os.path.exists(pred): return {"omr_ned": 1.0, "failed": "no output"}
    signal.alarm(600)
    try:
        r = musicdiff._diff_omr_ned_metrics(pred, gt, detail)
        return None if r is None else {"omr_ned": round(r.omr_ned, 4), "gt_syms": r.gt_numsyms,
                                       "pred_syms": r.pred_numsyms, "edits": r.omr_edit_distance}
    except TO: return {"omr_ned": None, "failed": "timeout"}
    except Exception as e: return {"omr_ned": None, "failed": repr(e)[:120]}
    finally: signal.alarm(0)

setA = json.load(open(f"{SRC}/setA.json"))
for outd in outdirs:
    name = os.path.basename(outd)
    conv = {}
    for t in sorted(glob.glob(f"{outd}/*.abc.txt")):
        stem = os.path.basename(t)[:-len(".abc.txt")]
        conv[stem] = abc_to_xml(open(t).read(), f"{outd}/{stem}.musicxml")
    print(f"{name}: ABC->MusicXML ok {sum(conv.values())}/{len(conv)}", flush=True)
    scores = {}
    for a in setA:
        for var in ("clean", "lowres"):
            key = f"{a['id']}_{var}"
            scores[key] = {k: omr_ned(f"{outd}/{key}.musicxml", f"{SRC}/gt/{a['id']}.musicxml", d) for k, d in DETAILS.items()}
            print(f"  {key}: " + " ".join(f"{k}={(v or {}).get('omr_ned')}" for k, v in scores[key].items()), flush=True)
    json.dump({"convert_ok": conv, "scores": scores}, open(f"{OUT}/scores_{name}_A.json", "w"), indent=1)
subprocess.run(f"du -sh {OUT}", shell=True)

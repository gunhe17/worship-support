# Kaggle GPU kernel: installs deps, runs SongFormer (420s default + 180s window) and analyze.py on each song.
# Inputs: private dataset mounted under /kaggle/input/<slug>/ with audio/*.wav and scripts/*.py
# Outputs: /kaggle/working/results/*
import glob, os, shutil, subprocess, sys

def sh(cmd):
    print("$", cmd, flush=True)
    subprocess.run(cmd, shell=True, check=False)

src = glob.glob("/kaggle/input/**/scripts", recursive=True)[0].rsplit("/", 1)[0]
work = "/kaggle/working"
shutil.copytree(f"{src}/scripts", f"{work}/scripts", dirs_exist_ok=True)
os.makedirs(f"{work}/results", exist_ok=True)

import socket, urllib.request
gpu = shutil.which("nvidia-smi") is not None
try:
    urllib.request.urlopen("https://pypi.org", timeout=10); net = True
except Exception as e:
    net = False; print("internet check failed:", e)
print(f"PRECHECK gpu={gpu} internet={net}", flush=True)
if not (gpu and net):
    sys.exit("PRECHECK failed: need GPU + internet (phone-verified account)")
sh("nvidia-smi --query-gpu=name,memory.total --format=csv")
pip = f"{sys.executable} -m pip install -q"
sh(f"{pip} cython numpy > {work}/results/pip.log 2>&1")
sh(f"{pip} --no-build-isolation 'git+https://github.com/CPJKU/madmom' >> {work}/results/pip.log 2>&1")
sh(f"{pip} 'transformers<4.50' beat-this essentia demucs muq msaf ema_pytorch loguru einops omegaconf x_transformers soundfile >> {work}/results/pip.log 2>&1")
sh(f"{sys.executable} -c 'import madmom, beat_this, essentia, demucs, muq, transformers, torch; print(\"deps ok\", transformers.__version__, torch.__version__, torch.cuda.is_available())'")

# v4: re-run only songs whose 420s window OOM'd on T4 (16GB); use 180s segments
ONLY = {"markers_love-of-god", "anointing_rejoice"}
WINDOWS, SEG_WIN = ("180",), "180"
songs = sorted(glob.glob(f"{src}/audio/*.wav"))
for wav in songs:
    n = os.path.basename(wav)[:-4]
    if n == "synth" or n not in ONLY:
        continue
    for win in WINDOWS:
        sh(f"cd {work} && {sys.executable} scripts/songformer_run.py {wav} cuda {win} "
           f"> results/{n}.segments.w{win}.json 2> results/{n}.segments.w{win}.err; grep -E '^infer|Error' results/{n}.segments.w{win}.err")
    for stems in ("", "--stems"):
        tag = ".stems" if stems else ""
        sh(f"cd {work} && {sys.executable} scripts/analyze.py {wav} {stems} --device cuda --segments results/{n}.segments.w{SEG_WIN}.json "
           f"> /dev/null 2> results/{n}{tag}.err; tail -3 results/{n}{tag}.err")
sh(f"ls -la {work}/results")

# Kaggle T4 smoke test: which onnxruntime-gpu loads oemer's ONNX (negative ConvTranspose pads) and runs on CUDA?
# For each candidate version: fresh py3.11 venv, load both oemer models, run one page, report provider and seconds.
import glob, os, subprocess, sys, json

CANDIDATES = ["1.20.1", "1.19.2", "1.18.1", "1.18.0", "1.17.1"]
PAGE = sorted(glob.glob("/kaggle/input/**/markers_glorious-splendor_1.*", recursive=True))[0]
TEST = r'''
import os, sys, time, pickle, numpy as np, onnxruntime as rt, oemer, oemer.ete
from PIL import Image
mp = os.path.dirname(oemer.__file__)
if not os.path.exists(os.path.join(mp, "checkpoints/unet_big/model.onnx")):
    for title, url in oemer.ete.CHECKPOINTS_URL.items():
        if title.endswith(".onnx"):
            d = os.path.join(mp, "checkpoints", "unet_big" if title.startswith("1st") else "seg_net")
            oemer.ete.download_file(title, url, os.path.join(d, title.split("_")[1]))
out = {"ort": rt.__version__, "available": rt.get_available_providers()}
for name in ("unet_big", "seg_net"):
    d = os.path.join(mp, "checkpoints", name); meta = pickle.load(open(os.path.join(d, "metadata.pkl"), "rb"))
    try:
        sess = rt.InferenceSession(os.path.join(d, "model.onnx"), providers=["CUDAExecutionProvider", "CPUExecutionProvider"])
        win = meta["input_shape"][1]; x = np.full((16, win, win, 3), 255, np.uint8)
        t = time.time(); sess.run(meta["output_names"], {"input": x}); t1 = time.time() - t
        t = time.time(); [sess.run(meta["output_names"], {"input": x}) for _ in range(5)]; t5 = (time.time() - t) / 5
        out[name] = dict(ok=True, providers=sess.get_providers(), win=win, first_s=round(t1, 2), batch16_s=round(t5, 3))
    except Exception as e:
        out[name] = dict(ok=False, error=str(e)[:300])
print("RESULT", __import__("json").dumps(out))
'''
open("/tmp/test.py", "w").write(TEST)
subprocess.run([sys.executable, "-m", "pip", "install", "-q", "uv"], check=True)
print(subprocess.run(["nvidia-smi"], capture_output=True, text=True).stdout[:600], flush=True)
results = {}
for v in CANDIDATES:
    venv = f"/tmp/v{v}"
    r = subprocess.run(["uv", "venv", "-q", "-p", "3.11", venv], capture_output=True, text=True)
    r = subprocess.run(["uv", "pip", "install", "-q", "-p", f"{venv}/bin/python", "oemer==0.1.8", "--no-deps"], capture_output=True, text=True)
    extra = ["nvidia-cudnn-cu12==9.*", "nvidia-cublas-cu12", "nvidia-cufft-cu12", "nvidia-curand-cu12", "nvidia-cuda-runtime-cu12", "nvidia-cuda-nvrtc-cu12"] \
        if v >= "1.18.1" else ["nvidia-cudnn-cu12==8.*", "nvidia-cublas-cu12", "nvidia-cufft-cu12", "nvidia-curand-cu12", "nvidia-cuda-runtime-cu12"]
    r = subprocess.run(["uv", "pip", "install", "-q", "-p", f"{venv}/bin/python", f"onnxruntime-gpu=={v}", "numpy<2", "opencv-python-headless",
                        "pillow", "scipy", "scikit-learn", "matplotlib", "typing-extensions", *extra], capture_output=True, text=True)
    if r.returncode:
        results[v] = dict(install_error=r.stderr[-400:]); print(v, "install failed", r.stderr[-300:], flush=True); continue
    # make the pip-installed CUDA/cuDNN libraries visible
    site = subprocess.run([f"{venv}/bin/python", "-c", "import site;print(site.getsitepackages()[0])"], capture_output=True, text=True).stdout.strip()
    libs = ":".join(glob.glob(f"{site}/nvidia/*/lib"))
    env = dict(os.environ, LD_LIBRARY_PATH=libs + ":" + os.environ.get("LD_LIBRARY_PATH", ""))
    r = subprocess.run([f"{venv}/bin/python", "/tmp/test.py"], capture_output=True, text=True, env=env)
    line = [l for l in r.stdout.splitlines() if l.startswith("RESULT")]
    results[v] = json.loads(line[0][7:]) if line else dict(run_error=(r.stderr or r.stdout)[-600:])
    print(v, json.dumps(results[v])[:700], flush=True)
os.makedirs("/kaggle/working/out", exist_ok=True)
json.dump(results, open("/kaggle/working/out/gpu.json", "w"), indent=1)

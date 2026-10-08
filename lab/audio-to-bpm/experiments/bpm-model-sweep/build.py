"""kaggle-{a,b,c,s}/sweep.py = sweep_body.py + GROUP + bpm-pipeline/kaggle/bpm.py 사본(BPM_SRC)."""
import json
from pathlib import Path
here = Path(__file__).parent
src = (here / "../bpm-pipeline/kaggle/bpm.py").read_text()
body = (here / "sweep_body.py").read_text()
DATA = ["andradaolteanu/gtzan-dataset-music-genre-classification", "gunhe17/worship-audio-analysis-test", "gunhe17/worship-audio-500"]
for g in "abcs":
    d = here / f"kaggle-{g}"; d.mkdir(exist_ok=True)
    code = body.replace("GROUP = None    # build.py가 채움", f'GROUP = "{g.upper()}"', 1).replace("BPM_SRC = None  # build.py가 채움", "BPM_SRC = " + repr(src), 1)
    (d / "sweep.py").write_text(code)
    meta = {"id": f"gunhe17/worship-bpm-sweep-{g}", "title": f"worship-bpm-sweep-{g}", "code_file": "sweep.py", "language": "python",
            "kernel_type": "script", "is_private": True, "enable_gpu": g == "a", "enable_internet": True,
            "dataset_sources": [] if g == "s" else DATA, "competition_sources": [],
            "kernel_sources": [f"gunhe17/worship-bpm-sweep-{x}" for x in "abc"] if g == "s" else []}
    (d / "kernel-metadata.json").write_text(json.dumps(meta, indent=1))
print("built")

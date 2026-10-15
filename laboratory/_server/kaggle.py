"""실험 폴더 kernels.json에 적은 Kaggle 커널을 올린다. kernel-metadata.json은 올릴 때만 임시 폴더에 만든다.

  python3 _server/kaggle.py <실험 폴더> <커널 slug> [kaggle kernels push 옵션 …]   예: --accelerator NvidiaTeslaT4

kernels.json = {slug: {id, code(실험 폴더 기준 경로), gpu(기본 false), internet(기본 true), datasets, kernels}}
"""
import json, shutil, subprocess, sys, tempfile
from pathlib import Path


def metadata(slug, kernel):
    return {"id": kernel["id"], "title": slug, "code_file": Path(kernel["code"]).name, "language": "python", "kernel_type": "script",
            "is_private": True, "enable_gpu": kernel.get("gpu", False), "enable_internet": kernel.get("internet", True),
            "dataset_sources": kernel.get("datasets", []), "competition_sources": [], "kernel_sources": kernel.get("kernels", [])}


if __name__ == "__main__":
    exp, slug, extra = Path(sys.argv[1]), sys.argv[2], sys.argv[3:]
    kernel = json.loads((exp / "kernels.json").read_text())[slug]
    with tempfile.TemporaryDirectory() as d:
        shutil.copy(exp / kernel["code"], d)
        Path(d, "kernel-metadata.json").write_text(json.dumps(metadata(slug, kernel), indent=1))
        sys.exit(subprocess.run(["kaggle", "kernels", "push", "-p", d, *extra]).returncode)

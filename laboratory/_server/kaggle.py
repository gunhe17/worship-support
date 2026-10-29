"""실험 폴더 kernels.json에 적은 Kaggle 커널을 올린다. kernel-metadata.json은 올릴 때만 임시 폴더에 만든다.

  python3 _server/kaggle.py <실험 폴더> <커널 slug> [--watch] [kaggle kernels push 옵션 …]   예: --accelerator NvidiaTeslaT4

kernels.json = {slug: {id, code(실험 폴더 기준 경로), gpu(기본 false), internet(기본 true), datasets, kernels}}
--watch: 올린 뒤 실행 로그를 실시간으로 따라가며 진행을 보고하고, 실행이 끝나면 최종 상태를 찍고 끝난다.
  커널이 "progress <i>/<n> <경과초>s" 줄을 찍으면 1분마다 진행·남은 시간 추정, selftest·오류 줄은 그대로 찍는다.
"""
import json, re, shutil, subprocess, sys, tempfile, time
from pathlib import Path


def metadata(slug, kernel):
    return {"id": kernel["id"], "title": slug, "code_file": Path(kernel["code"]).name, "language": "python", "kernel_type": "script",
            "is_private": True, "enable_gpu": kernel.get("gpu", False), "enable_internet": kernel.get("internet", True),
            "dataset_sources": kernel.get("datasets", []), "competition_sources": [], "kernel_sources": kernel.get("kernels", [])}


def status(kid):
    return subprocess.run(["kaggle", "kernels", "status", kid], capture_output=True, text=True).stdout.strip().split("\n")[-1]


def watch(kid):
    last, seen = 0.0, set()                          # a reconnected log stream replays from the start
    while True:
        time.sleep(15)                                  # a just-pushed run is queued before its log exists
        logs = subprocess.Popen(["kaggle", "kernels", "logs", "-f", kid], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        for line in logs.stdout:
            if line in seen: continue
            seen.add(line); m = re.search(r"progress (\d+)/(\d+) (\d+)s", line)
            if m:
                i, n, t = map(int, m.groups())
                if time.time() - last >= 60 or i == n:
                    print(f"{i}/{n} {t}s eta {round(t * (n - i) / i)}s", flush=True); last = time.time()
            elif re.search(r"selftest|Error|Traceback", line):
                print(line.rstrip()[:300], flush=True)
        s = status(kid)
        if not re.search(r"RUNNING|QUEUED", s):
            print(s, flush=True); return s


if __name__ == "__main__":
    exp, slug, extra = Path(sys.argv[1]), sys.argv[2], sys.argv[3:]
    follow = "--watch" in extra; extra = [a for a in extra if a != "--watch"]
    kernel = json.loads((exp / "kernels.json").read_text())[slug]
    with tempfile.TemporaryDirectory() as d:
        shutil.copy(exp / kernel["code"], d)
        Path(d, "kernel-metadata.json").write_text(json.dumps(metadata(slug, kernel), indent=1))
        code = subprocess.run(["kaggle", "kernels", "push", "-p", d, *extra]).returncode
    if code or not follow: sys.exit(code)
    sys.exit(0 if "COMPLETE" in watch(kernel["id"]) else 1)

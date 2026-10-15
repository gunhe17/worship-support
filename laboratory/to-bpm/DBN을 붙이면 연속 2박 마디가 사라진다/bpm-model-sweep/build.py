"""kaggle/{a,b,c,s}.py = sweep_body.py + GROUP + bpm-pipeline/kaggle/bpm.py 사본(BPM_SRC)."""
from pathlib import Path
here = Path(__file__).parent
src = (here / "../../곡 중앙값으로 반·두 배를 통일하면 BPM이 맞는다/bpm-pipeline/kaggle/bpm.py").read_text()
body = (here / "sweep_body.py").read_text()
for g in "abcs":  # 커널 설정(데이터셋·GPU)은 kernels.json, 올리기는 lab/_server/kaggle.py
    code = body.replace("GROUP = None    # build.py가 채움", f'GROUP = "{g.upper()}"', 1).replace("BPM_SRC = None  # build.py가 채움", "BPM_SRC = " + repr(src), 1)
    (here / f"kaggle/{g}.py").write_text(code)
print("built")

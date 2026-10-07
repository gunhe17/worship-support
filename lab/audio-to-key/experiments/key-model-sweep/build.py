"""kaggle/sweep.py = sweep_body.py + key-pipeline/kaggle/key.py 사본(KEY_SRC). 다른 세션이 key.py를 바꿔도 이 시험은 빌드 시점 사본으로 고정."""
from pathlib import Path
here = Path(__file__).parent
src = (here / "../key-pipeline/kaggle/key.py").read_text()
body = (here / "sweep_body.py").read_text()
(here / "kaggle").mkdir(exist_ok=True)
(here / "kaggle/sweep.py").write_text(body.replace("KEY_SRC = None  # build.py가 채움", "KEY_SRC = " + repr(src), 1))
print("built", len(src), "chars of key.py")

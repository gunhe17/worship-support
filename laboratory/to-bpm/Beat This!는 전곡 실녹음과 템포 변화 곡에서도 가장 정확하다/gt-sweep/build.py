"""kaggle/{a,b,c}.py = bpm-model-sweep/sweep_body.py(방법·실행부, __main__ 앞까지) + gt_extra.py(정답 세트·채점·실행) + GROUP + bpm.py 사본.

계정이 둘이라 A·C는 gunhe17, B(madmom·BeatNet, 가장 느림)는 miinggu에서 돌린다.
  python build.py && python3 ../../../_server/kaggle.py . bpm-gt-sweep-a (KEY_1) / bpm-gt-sweep-c (KEY_1) / bpm-gt-sweep-b (KEY_3)
  채점에서 멈췄을 때: results/{a,b,c}/out을 비공개 데이터셋 <계정>/bpm-gt-sweep-out으로 올리고 bpm-gt-score-{a,b,c}를 돌린다 (빠진 곡만 다시 재고 채점)
"""
from pathlib import Path

here = Path(__file__).parent
sweep = next(here.parent.parent.glob("*/bpm-model-sweep"))
src = next(here.parent.parent.glob("*/bpm-pipeline")) / "kaggle/bpm.py"
body = (sweep / "sweep_body.py").read_text().split('\nif __name__ == "__main__":')[0]
extra = (here / "gt_extra.py").read_text()
for g in "abc":  # 커널 설정(계정·데이터셋·GPU)은 kernels.json. 채점 커널 bpm-gt-score-*는 같은 코드를 CPU로 돌린다
    code = (body.replace("GROUP = None    # build.py가 채움", f'GROUP = "{g.upper()}"', 1)
                .replace("BPM_SRC = None  # build.py가 채움", "BPM_SRC = " + repr(src.read_text()), 1) + extra)
    (here / f"kaggle/{g}.py").write_text(code)
print("built")

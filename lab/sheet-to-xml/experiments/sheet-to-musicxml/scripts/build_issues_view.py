# One-off page: the two open issues (hangul-piece false alarms, staves the page detector missed), images from Kaggle
# outputs embedded as data URIs. No computation here.
import base64
from pathlib import Path

R = Path(__file__).resolve().parent.parent
P = R / "results/regions-100/out/problems"
uri = lambda p: ("data:image/png;base64," if p.suffix == ".png" else "data:image/jpeg;base64,") + base64.b64encode(p.read_bytes()).decode()
IMG = {"ywam4": P / "ywam_first-and-last_1_b04_r01.png", "ywam6": P / "ywam_first-and-last_1_b06_r01.png",
       "mk_row": P / "markers_ju-ui-ireum-nopimyeo_1_b04_r03.png", "wl_row": P / "welove_loving-you-more_1_b03_r04.png",
       "wl_page": R / "results/regions/out/welove_loving-you-more_1_boxes.jpg", "mk_page": R / "refs/sheets/markers_ju-ui-ireum-nopimyeo_1.jpg"}
html = (R / "scripts/issues_view_template.html").read_text()
for k, p in IMG.items(): html = html.replace("{{" + k + "}}", uri(p))
(R / "results/issues-view.html").write_text(html)
print("wrote results/issues-view.html", len(html) // 1024, "KB")

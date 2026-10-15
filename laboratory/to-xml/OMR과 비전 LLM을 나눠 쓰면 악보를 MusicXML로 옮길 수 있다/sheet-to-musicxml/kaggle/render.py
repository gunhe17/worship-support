# Kaggle CPU kernel: visual examples for the report (public-domain OpenEWLD songs only).
# For each example: the input image Audiveris saw, the answer key rendered, and the Audiveris
# result rendered with musicdiff's note-level differences colored.
import glob, json, os, shutil, subprocess, sys

OUT = "/kaggle/working/out"; os.makedirs(OUT, exist_ok=True)
subprocess.run(f"{sys.executable} -m pip install -q musicdiff verovio cairosvg > {OUT}/pip.log 2>&1", shell=True)
subprocess.run("apt-get -qq install -y libcairo2 > /dev/null 2>&1", shell=True)
import musicdiff, verovio, cairosvg

V1 = glob.glob("/kaggle/input/**/out/setA.json", recursive=True)[0].rsplit("/", 1)[0]
V3 = glob.glob("/kaggle/input/**/out/scores_v3.json", recursive=True)[0].rsplit("/", 1)[0]
EXAMPLES = [("a04", "best"), ("a13", "median"), ("a08", "worst")]   # by notes OMR-NED, lowres x3

tk = verovio.toolkit()
tk.setOptions({"pageWidth": 2100, "pageHeight": 2970, "scale": 40, "footer": "none", "header": "none",
               "adjustPageHeight": True, "breaks": "auto"})
def render(xml, png):
    if not tk.loadFile(xml): print("  load fail", xml); return False
    cairosvg.svg2png(bytestring=tk.renderToSVG(1).encode(), write_to=png, output_width=1100, background_color="white")
    return True

manifest = []
for sid, tag in EXAMPLES:
    gt = f"{V1}/gt/{sid}.musicxml"
    pred = f"{V3}/pp/lowres_up3_keeppart/{sid}_lowres.musicxml"
    shutil.copy(f"{V1}/images/A/{sid}_lowres.jpg", f"{OUT}/{sid}_input.jpg")
    # annotated copies with differences colored (notes & rests only)
    ann_gt, ann_pred = f"/tmp/{sid}_gt_diff.musicxml", f"/tmp/{sid}_pred_diff.musicxml"
    # musicdiff.diff(visualize_diffs=True) renders PDFs through MuseScore, which Kaggle lacks.
    # Do the same steps by hand and write the color-marked scores as MusicXML instead.
    import music21 as m21
    from musicdiff.annotation import AnnScore
    from musicdiff.comparison import Comparison
    from musicdiff.visualization import Visualization
    sc1 = m21.converter.parse(gt, forceSource=True); sc2 = m21.converter.parse(pred, forceSource=True)
    det = musicdiff.DetailLevel.NotesAndRests
    ops, n = Comparison.annotated_scores_diff(AnnScore(sc1, det), AnnScore(sc2, det))
    if n: Visualization.mark_diffs(sc1, sc2, ops)
    sc1.write("musicxml", ann_gt); sc2.write("musicxml", ann_pred)
    ok_gt = render(ann_gt if os.path.exists(ann_gt) else gt, f"{OUT}/{sid}_gt.png")
    ok_pr = render(ann_pred if os.path.exists(ann_pred) else pred, f"{OUT}/{sid}_pred.png")
    manifest.append({"id": sid, "tag": tag, "num_diffs": n, "rendered": [ok_gt, ok_pr]})
    print(sid, tag, "diffs:", n, flush=True)
json.dump(manifest, open(f"{OUT}/manifest.json", "w"), indent=1)
subprocess.run(f"ls -la {OUT}", shell=True)

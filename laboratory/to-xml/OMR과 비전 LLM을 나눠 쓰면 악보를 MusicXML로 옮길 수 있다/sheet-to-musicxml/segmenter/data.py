from __future__ import annotations

import argparse
import ast
import json
from pathlib import Path

import numpy as np
from PIL import Image


# #
# build

def build(*, images: Path, staff: Path, out: Path) -> None:
    sheets = json.loads(staff.read_text())["sheets"]
    labels = json.loads(
        _root()
        .joinpath("gt", "sets-gt.json")
        .read_text()
    )
    out.mkdir(parents=True, exist_ok=True)
    for name, boxes in labels.items():
        if name not in sheets:
            print(name, "no staff", flush=True)
            continue
        gray = page(
            image=next(images.glob(f"{name}.*")),
        )
        target = paint(
            gray=gray,
            staff=sheets[name],
            boxes=boxes,
        )
        half = (1240, gray.shape[0] // 2)  # staff spacing about 7-17 px
        image = np.asarray(
            Image.fromarray(gray).resize(half, Image.BILINEAR)
        )
        small = np.asarray(
            Image.fromarray(target).resize(half, Image.NEAREST)
        )
        np.savez_compressed(
            out / f"{name}.npz",
            img=image,
            tgt=small,
        )
        print(name, np.bincount(small.ravel(), minlength=256)[[0, 1, 2, 255]], flush=True)


def split() -> dict[str, list[str]]:
    # the sheet lists live in the kernel (SSOT); read them without running it
    tree = ast.parse(
        _root()
        .joinpath("kaggle", "sets.py")
        .read_text()
    )
    return {
        node.targets[0].id: ast.literal_eval(node.value)
        for node in tree.body
        if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name) and node.targets[0].id in ("TEST", "TRAIN", "MORE")
    }


def _root() -> Path:
    return Path(__file__).resolve().parent.parent


# #
# page

def page(*, image: Path) -> np.ndarray:
    picture = Image.open(image)
    if picture.mode in ("RGBA", "LA", "P"):
        picture = picture.convert("RGBA")
        background = Image.new("RGBA", picture.size, "white")
        background.alpha_composite(picture)
        picture = background
    width = 2480  # the width sets.py and the GT boxes use
    height = round(picture.height * width / picture.width)
    gray = np.asarray(
        picture
        .convert("L")
        .resize((width, height), Image.BICUBIC)
    )
    return gray


# #
# paint

def paint(
    *,
    gray: np.ndarray,
    staff: dict,
    boxes: list,
) -> np.ndarray:
    ink = gray < staff["ink_T"]
    target = np.zeros(gray.shape, np.uint8)  # 0 paper, 1 text, 2 symbol, 255 unlabelled ink (no loss)
    target[ink] = 255
    # staff
    # the staff body (lines and everything on them) is notation
    for stave in staff["staves"]:
        x0, x1, y0, y1 = stave["box"]
        region = target[y0:y1 + 1, x0:x1 + 1]
        region[ink[y0:y1 + 1, x0:x1 + 1]] = 2
    # boxes
    # staff components first, so a word box drawn over one wins; an s-box with a glued letter stays unlabelled
    for kind, x0, y0, x1, y1, label in sorted(boxes, key=lambda box: box[0] == "w"):
        region = target[y0:y1, x0:x1]
        if kind == "s":
            region[ink[y0:y1, x0:x1]] = 2 if label == "N" else 255
        else:
            region[ink[y0:y1, x0:x1]] = 2 if label == "N" else 1
    return target


# #
# cli

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--images", type=Path, required=True)  # worship-sheet-images-500
    parser.add_argument("--staff", type=Path, required=True)  # sheet-staff-v3 out/staff.json
    parser.add_argument("--out", type=Path, required=True)
    arguments = parser.parse_args()
    build(
        images=arguments.images,
        staff=arguments.staff,
        out=arguments.out,
    )

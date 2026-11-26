from __future__ import annotations

import argparse
import json
import random
import time
from collections import Counter
from pathlib import Path

import numpy as np
import segmentation_models_pytorch as smp
import torch
import torch.nn.functional as F

from data import split


# #
# train

def train(*, round_path: Path, data: Path, out: Path) -> None:
    config = json.loads(round_path.read_text())
    seed = config.get("seed", 0)
    torch.set_num_threads(4)
    torch.manual_seed(seed)
    random.seed(seed)
    np.random.seed(seed)
    # load
    sources = [
        (mix, load(mix=mix, data=data, rounds=round_path.parent)) for mix in config["mix"]
    ]
    for mix, items in sources: print(mix, "items", len(items), flush=True)
    weights = class_weights(
        pages=[page for mix, items in sources if mix["src"] == "real" for page in items],
    )
    # model
    net = smp.Unet(
        encoder_name="resnet18",
        encoder_weights=(
            None if config.get("init") else "imagenet"
        ),
        in_channels=1,
        classes=3,
    )
    if config.get("init"): net.load_state_dict(torch.load(out / config["init"]))
    optimizer = torch.optim.AdamW(
        params=net.parameters(),
        lr=config["lr"],
        weight_decay=1e-4,
    )
    schedule = torch.optim.lr_scheduler.OneCycleLR(
        optimizer=optimizer,
        max_lr=config["lr"],
        total_steps=config["iters"],
        pct_start=config.get("warm", 0.1),
    )
    # loop
    drawn, started = Counter(), time.time()
    net.train()
    for step in range(config["iters"]):
        batch = [c for c in (crop(sources=sources, drawn=drawn) for _ in range(6)) if c is not None]
        images = torch.from_numpy(
            np.stack([c[0] for c in batch])
        )[:, None]
        targets = torch.from_numpy(
            np.stack([c[1] for c in batch])
        ).long()
        loss = F.cross_entropy(
            input=net(images),
            target=targets,
            weight=weights,
            ignore_index=255,
        )
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
        schedule.step()
        if step % 100 == 0: print(step, round(loss.item(), 4), round(time.time() - started), "s", flush=True)
    # save
    out.mkdir(parents=True, exist_ok=True)
    torch.save(net.state_dict(), out / f"seg_{config['name']}.pt")
    (out / f"{config['name']}.json").write_text(
        json.dumps(obj={"config": config, "drawn": drawn}, indent=1)
    )
    print("done", round(time.time() - started), "s", dict(drawn), flush=True)


# #
# load

def load(*, mix: dict, data: Path, rounds: Path) -> list:
    # real = GT sheets of a split; focus = the same pages with boxes to centre crops on; syn = synthetic pages
    if mix["src"] == "syn":
        return [
            _pair(np.load(path)) for path in sorted((data / mix["dir"]).glob("*.npz"))
        ]
    sheets = split()
    names = [name for part in mix["split"].split("+") for name in sheets[part]]
    pages = {name: _pair(np.load(data / "seg" / f"{name}.npz")) for name in names}
    if mix["src"] == "real":
        return list(pages.values())
    boxes = json.loads((rounds / mix["boxes"]).read_text())
    # GT boxes are at 2480 px, pages at half width
    return [
        (pages[name], [value // 2 for value in box]) for name in names for box in boxes.get(name, [])
    ]


def class_weights(*, pages: list) -> torch.Tensor:
    # square-root inverse frequency over the real pages, relative to paper
    counts = sum(np.bincount(target.ravel(), minlength=256)[:3] for _, target in pages).astype(float)
    weights = torch.from_numpy(
        (counts.sum() / counts) ** 0.5
    ).float()
    return weights / weights[0]


def _pair(archive) -> tuple[np.ndarray, np.ndarray]:
    return archive["img"], archive["tgt"]


# #
# crop

def crop(*, sources: list, drawn: Counter, size: int = 256) -> tuple[np.ndarray, np.ndarray] | None:
    # pick a source by weight
    left = random.uniform(0, sum(mix["w"] for mix, _ in sources))
    for mix, items in sources:
        left -= mix["w"]
        if left <= 0: break
    # window
    if mix["src"] == "focus":
        (image, target), (x0, y0, x1, y1) = random.choice(items)
        height, width = image.shape
        cx, cy = (x0 + x1) // 2 + random.randint(-80, 80), (y0 + y1) // 2 + random.randint(-80, 80)
        y, x = min(max(0, cy - size // 2), height - size), min(max(0, cx - size // 2), width - size)
        drawn["focus:" + mix["boxes"]] += 1
    else:
        image, target = random.choice(items)
        height, width = image.shape
        if height < size or width < size: return None
        # prefer windows with labelled ink
        for _ in range(10):
            y, x = random.randint(0, height - size), random.randint(0, width - size)
            window = target[y:y + size, x:x + size]
            if ((window == 1) | (window == 2)).mean() > 0.01: break
        drawn[mix["src"] + ":" + mix.get("dir", mix.get("split", ""))] += 1
    # contrast
    # faded prints
    pixels = image[y:y + size, x:x + size].astype(np.float32) / 255
    if random.random() < 0.5: pixels = 1 - (1 - pixels) * random.uniform(0.5, 1.0)
    return pixels, target[y:y + size, x:x + size]


# #
# cli

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("round", type=Path)  # rounds/<name>.json
    parser.add_argument("--data", type=Path, required=True)  # holds seg/ (data.py) and the synthetic dirs
    parser.add_argument("--out", type=Path, required=True)
    arguments = parser.parse_args()
    train(
        round_path=arguments.round,
        data=arguments.data,
        out=arguments.out,
    )

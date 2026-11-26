from __future__ import annotations

import argparse
from pathlib import Path

import segmentation_models_pytorch as smp
import torch


# #
# export

def export(*, weights: Path, out: Path) -> None:
    # sets.py runs it with onnxruntime: the paddle-gpu install there breaks torch
    net = smp.Unet(
        encoder_name="resnet18",
        encoder_weights=None,
        in_channels=1,
        classes=3,
    )
    net.load_state_dict(torch.load(weights))
    net.eval()
    torch.onnx.export(
        net,
        torch.ones(1, 1, 512, 512),
        out,
        input_names=["img"],
        output_names=["logit"],
        dynamic_axes={"img": {2: "h", 3: "w"}, "logit": {2: "h", 3: "w"}},
        opset_version=17,
        dynamo=False,
    )


# #
# cli

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--weights", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)  # seg.onnx -> dataset gunhe17/worship-sheet-seg-model
    arguments = parser.parse_args()
    export(
        weights=arguments.weights,
        out=arguments.out,
    )

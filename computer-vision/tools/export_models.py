"""Export the two detector models to ONNX. Export-time only; needs Ultralytics + torch.

Setup once (from computer-vision/):
    python -m venv tools/.venv-export
    tools/.venv-export/Scripts/python -m pip install torch --index-url https://download.pytorch.org/whl/cpu
    tools/.venv-export/Scripts/python -m pip install -r tools/requirements-export.txt

Run:
    tools/.venv-export/Scripts/python tools/export_models.py

Writes into detector/weights/:
    yolo26n.onnx            COCO, one-to-many head [1, 84, 8400]
    yoloe26n_walk.onnx      YOLOE-26n detection-only, Strider prompts baked in [1, 4+K, 8400]
    yoloe26n_walk.json      the prompt list, checked by the runtime against detector/vocab.py
Downloads (.pt, text encoder) are kept in tools/.export-cache/.
"""

from __future__ import annotations

import json
import os
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DETECTOR = ROOT / "detector"
WEIGHTS = DETECTOR / "weights"
CACHE = Path(__file__).resolve().parent / ".export-cache"
IMGSZ = 640

sys.path.insert(0, str(DETECTOR))
from vocab import WALK, walk_prompts  # noqa: E402


def _check_shape(path: Path, classes: int) -> None:
    import onnxruntime as ort

    session = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
    shape = session.get_outputs()[0].shape
    expected = [1, 4 + classes, 8400]
    if list(shape) != expected:
        raise SystemExit(f"{path.name}: output shape {shape}, expected {expected}")
    print(f"{path.name}: output {shape} ok")


def _export(model, name: str) -> Path:
    exported = Path(model.export(format="onnx", imgsz=IMGSZ, nms=False, end2end=False, simplify=True))
    target = WEIGHTS / name
    shutil.move(str(exported), target)
    return target


def main() -> None:
    from ultralytics import YOLO, YOLOE

    WEIGHTS.mkdir(parents=True, exist_ok=True)
    CACHE.mkdir(parents=True, exist_ok=True)
    os.chdir(CACHE)  # Ultralytics downloads .pt files and the text encoder into the cwd.

    coco = _export(YOLO("yolo26n.pt"), "yolo26n.onnx")
    _check_shape(coco, 80)

    prompts = walk_prompts()
    seg = YOLOE("yoloe-26n-seg.pt")
    seg.set_classes(prompts)
    seg.save_prompt_embeddings("walk.npz")
    det = YOLOE("yoloe-26n.yaml").load("yoloe-26n-seg.pt")
    det.load_prompt_embeddings("walk.npz")
    walk = _export(det, "yoloe26n_walk.onnx")
    _check_shape(walk, WALK.size)
    (WEIGHTS / "yoloe26n_walk.json").write_text(
        json.dumps({"prompts": prompts}, indent=2), encoding="utf-8"
    )
    print("done")


if __name__ == "__main__":
    main()

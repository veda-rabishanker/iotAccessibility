#!/usr/bin/env python3
"""Download Ultralytics YOLO11n ONNX and verify the pinned SHA256."""

from __future__ import annotations

import hashlib
import sys
import urllib.error
import urllib.request
from pathlib import Path

EXPECTED_SHA256 = "634279b40c07c6391472c51ad45b81ebc48706a9a1fe72dd3396322acd0c053b"

WEIGHTS_DIR = Path(__file__).resolve().parent / "weights"
WEIGHT_PATH = WEIGHTS_DIR / "yolo11n.onnx"
URL = "https://github.com/ultralytics/assets/releases/download/v8.3.0/yolo11n.onnx"
EXPECTED_OUTPUT_SHAPE = [1, 84, 8400]
USER_AGENT = "StriderVisionViewer/1.0"


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while True:
            chunk = handle.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def _download(url: str, dest: Path) -> int:
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(".onnx.part")
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            status = int(getattr(response, "status", 0) or response.getcode() or 0)
            if status != 200:
                return status
            with tmp.open("wb") as out:
                while True:
                    chunk = response.read(1024 * 1024)
                    if not chunk:
                        break
                    out.write(chunk)
        tmp.replace(dest)
        return 200
    except urllib.error.HTTPError as exc:
        return int(exc.code)
    except (OSError, urllib.error.URLError):
        return 0


def _looks_like_onnx(path: Path) -> bool:
    if not path.is_file() or path.stat().st_size < 1024:
        return False
    try:
        import onnxruntime as ort

        session = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
        return bool(session.get_inputs())
    except Exception:
        return False


def _output_shape(path: Path) -> list[int]:
    import numpy as np
    import onnxruntime as ort

    session = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
    inp = session.get_inputs()[0]
    dims = []
    for dim in inp.shape:
        if isinstance(dim, int) and dim > 0:
            dims.append(dim)
        else:
            dims.append(1 if not dims else 640)
    dummy = np.zeros(tuple(dims), dtype=np.float32)
    outputs = session.run(None, {inp.name: dummy})
    return [int(n) for n in outputs[0].shape]


def main() -> int:
    if not WEIGHT_PATH.is_file():
        print(f"Downloading {URL}", flush=True)
        status = _download(URL, WEIGHT_PATH)
        if status != 200 or not _looks_like_onnx(WEIGHT_PATH):
            print(f"Download failed (HTTP {status}) from {URL}", flush=True)
            if WEIGHT_PATH.is_file():
                WEIGHT_PATH.unlink()
            print(f"Failed to download YOLO11n ONNX (HTTP {status}).", file=sys.stderr)
            return 1

    digest = _sha256(WEIGHT_PATH)
    print(f"SHA256 {digest}", flush=True)
    if not EXPECTED_SHA256:
        print("EXPECTED_SHA256 is not pinned in this script yet.", file=sys.stderr)
        return 1
    if digest.lower() != EXPECTED_SHA256.lower():
        print(
            f"SHA256 mismatch: got {digest}, expected {EXPECTED_SHA256}.",
            file=sys.stderr,
        )
        return 1

    shape = _output_shape(WEIGHT_PATH)
    print(f"ONNX output shape {shape}", flush=True)
    if shape != EXPECTED_OUTPUT_SHAPE:
        print(
            f"ONNX output shape {shape} is not {EXPECTED_OUTPUT_SHAPE}.",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

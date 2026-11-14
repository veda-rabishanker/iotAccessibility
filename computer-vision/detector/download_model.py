#!/usr/bin/env python3
"""Download the Depth Anything V2 Small ONNX files and verify pinned SHA256s.

The two detector models (YOLO26n, YOLOE-26n with Strider's prompts) are not
published as ONNX; build them with ``tools/export_models.py``.
"""

from __future__ import annotations

import hashlib
import sys
import urllib.error
import urllib.request
from pathlib import Path

WEIGHTS_DIR = Path(__file__).resolve().parent / "weights"
DEPTH_DIR = WEIGHTS_DIR / "depth"
REPO = "https://huggingface.co/onnx-community/depth-anything-v2-small-ONNX/resolve"
REVISION = "c3b67641fd837b2368757101311e5d21e511441e"
USER_AGENT = "StriderVisionViewer/1.0"

# Depth Anything V2 Small, Apache-2.0. ``model.onnx`` loads ``model.onnx_data`` from the same folder.
FILES = {
    "model.onnx": "345f249eda90f33e0548890f2fe1e89662c1dbb5a8b7c10a50492558f65e85a3",
    "model.onnx_data": "c4fba31e921953367d8c5348b92296b2bf41f9cef9745ffaca01e2b1653e6d08",
}


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _download(url: str, dest: Path) -> int:
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_name(dest.name + ".part")
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=120) as response, tmp.open("wb") as out:
            for chunk in iter(lambda: response.read(1024 * 1024), b""):
                out.write(chunk)
        tmp.replace(dest)
        return 200
    except urllib.error.HTTPError as exc:
        return int(exc.code)
    except (OSError, urllib.error.URLError):
        return 0


def main() -> int:
    for name, expected in FILES.items():
        dest = DEPTH_DIR / name
        if not dest.is_file():
            url = f"{REPO}/{REVISION}/onnx/{name}"
            print(f"Downloading {url}", flush=True)
            status = _download(url, dest)
            if status != 200:
                print(f"Download failed (HTTP {status}): {url}", file=sys.stderr)
                return 1
        digest = _sha256(dest)
        if digest != expected:
            print(f"SHA256 mismatch for {name}: got {digest}", file=sys.stderr)
            dest.unlink()
            return 1
        print(f"{name} ok", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

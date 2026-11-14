"""Depth Anything V2 Small (ONNX) wrapper: frame in, closeness map out.

Output is relative inverse depth: higher means nearer. It is not metres.
Preprocessing follows the model's preprocessor_config.json: RGB, /255,
ImageNet mean/std, both sides a multiple of 14.
"""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

MODEL_PATH = Path(__file__).resolve().parent / "weights" / "depth" / "model.onnx"
SHORT_SIDE = 182  # ~115 ms on the bench laptop CPU; 266 is ~250 ms.
MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


def _multiple_of_14(value: float) -> int:
    return max(14, int(round(value / 14.0)) * 14)


class DepthModel:
    def __init__(self, path: Path = MODEL_PATH, short_side: int = SHORT_SIDE) -> None:
        self._path = path
        self._short_side = short_side
        self._session = None
        self._input_name: str | None = None
        self._failed = False

    def available(self) -> bool:
        return self._path.is_file() and not self._failed

    def _load(self):
        if self._session is None and not self._failed:
            try:
                import onnxruntime as ort

                self._session = ort.InferenceSession(
                    str(self._path), providers=["CPUExecutionProvider"]
                )
                self._input_name = self._session.get_inputs()[0].name
            except Exception:
                self._failed = True
                self._session = None
        return self._session

    def closeness(self, frame_bgr: np.ndarray) -> np.ndarray | None:
        """Return a float32 closeness map at model resolution, or None if unavailable."""
        session = self._load()
        if session is None:
            return None
        h, w = frame_bgr.shape[:2]
        scale = self._short_side / min(h, w)
        new_w = _multiple_of_14(w * scale)
        new_h = _multiple_of_14(h * scale)
        resized = cv2.resize(frame_bgr, (new_w, new_h), interpolation=cv2.INTER_AREA)
        rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
        tensor = ((rgb - MEAN) / STD).transpose(2, 0, 1)[None, ...]
        out = session.run(None, {self._input_name: tensor.astype(np.float32)})[0]
        return np.asarray(out[0], dtype=np.float32)


def colourise(closeness: np.ndarray, width: int, height: int) -> np.ndarray:
    """Bench view: near is bright/warm, far is dark."""
    lo, hi = np.percentile(closeness, [2, 98])
    norm = np.clip((closeness - lo) / max(hi - lo, 1e-6), 0, 1)
    img = (norm * 255).astype(np.uint8)
    img = cv2.resize(img, (width, height), interpolation=cv2.INTER_LINEAR)
    return cv2.applyColorMap(img, cv2.COLORMAP_INFERNO)

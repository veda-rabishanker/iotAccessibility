"""Webcam capture and walking-cue inference loop."""

from __future__ import annotations

import sys
import threading
import time
from pathlib import Path

import cv2
import numpy as np

_DETECTOR_DIR = Path(__file__).resolve().parent
if str(_DETECTOR_DIR) not in sys.path:
    sys.path.insert(0, str(_DETECTOR_DIR))

from failure_reason import quiet_failure_reason
from hold_memory import apply_hold_memory
from policy import Box, Cue, PolicyState, decide
from quality import frame_is_usable
from webcam import open_webcam
from yolo import letterbox, predictions_to_boxes

WEIGHT_PATH = _DETECTOR_DIR / "weights" / "yolo11n.onnx"
INFER_PERIOD = 0.125
STALL_FAILED_READS = 8
MODES = ("general", "crosswalk", "depth")
QUIET = Cue(kind="quiet", speech="", reason="camera-missing", side=None, class_name=None)


def _quiet(reason: str) -> Cue:
    return Cue(kind="quiet", speech="", reason=reason, side=None, class_name=None)


class Pipeline:
    """Newest-frame capture plus an 8 Hz detector. Never raises on missing camera or weights."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._frame: np.ndarray | None = None
        self._jpeg: bytes | None = None
        self._cue = QUIET
        self._inference_ms = 0
        self._mode = "general"
        self._source = "webcam"
        self._index = 0
        self._camera_opened = False
        self._capture: cv2.VideoCapture | None = None
        self._capture_thread: threading.Thread | None = None
        self._capture_stop = threading.Event()
        self._capture_gen = 0
        self._infer_thread: threading.Thread | None = None
        self._infer_stop = threading.Event()
        self._policy_state = PolicyState()
        self._last_obstacle: Cue | None = None
        self._session = None
        self._input_name: str | None = None
        self._started = False

    def start(self) -> None:
        """Start webcam index 0 and the inference loop. Safe with no camera and no weights."""
        try:
            if self._infer_thread is None or not self._infer_thread.is_alive():
                self._infer_stop.clear()
                self._infer_thread = threading.Thread(
                    target=self._inference_loop, name="detector-infer", daemon=True
                )
                self._infer_thread.start()
            self.set_source_webcam(0)
            self._started = True
        except Exception:
            self._started = True

    def set_mode(self, mode: str) -> None:
        if mode not in MODES:
            return
        with self._lock:
            self._mode = mode

    def set_source_webcam(self, index: int) -> None:
        self._index = int(index)
        with self._lock:
            self._source = "webcam"
        self._restart_capture()

    def set_source_esp32(self) -> None:
        self._stop_capture()
        with self._lock:
            self._source = "esp32"
            self._frame = None
            self._jpeg = None
            self._camera_opened = False
            self._store_cue(_quiet("esp32"))
            self._inference_ms = 0

    def snapshot(self) -> dict:
        with self._lock:
            cue = self._cue
            return {
                "kind": cue.kind,
                "speech": cue.speech,
                "reason": cue.reason,
                "side": cue.side,
                "class_name": cue.class_name,
                "inference_ms": self._inference_ms,
                "mode": self._mode,
                "jpeg": self._jpeg,
                "source": self._source,
            }

    def _restart_capture(self) -> None:
        self._stop_capture()
        self._capture_stop.clear()
        with self._lock:
            self._frame = None
            self._camera_opened = False
            self._capture_gen += 1
            gen = self._capture_gen
        self._capture_thread = threading.Thread(
            target=self._capture_loop, args=(gen,), name="detector-capture", daemon=True
        )
        self._capture_thread.start()

    def _stop_capture(self) -> None:
        self._capture_stop.set()
        thread = self._capture_thread
        if thread is not None and thread.is_alive() and thread is not threading.current_thread():
            thread.join(timeout=2.0)
        capture = None
        with self._lock:
            capture = self._capture
            self._capture = None
            self._capture_thread = None
            self._frame = None
            self._camera_opened = False
        if capture is not None:
            try:
                capture.release()
            except Exception:
                pass

    def _capture_loop(self, gen: int) -> None:
        try:
            capture = open_webcam(self._index)
        except Exception:
            capture = None
        opened = bool(capture is not None and capture.isOpened())
        with self._lock:
            if gen != self._capture_gen:
                stale = True
            else:
                stale = False
                self._capture = capture
                self._camera_opened = opened
                if not opened:
                    self._frame = None
        if stale:
            if capture is not None:
                try:
                    capture.release()
                except Exception:
                    pass
            return
        if not opened:
            while not self._capture_stop.is_set():
                self._capture_stop.wait(0.1)
            if capture is not None:
                try:
                    capture.release()
                except Exception:
                    pass
            return
        failed_reads = 0
        while not self._capture_stop.is_set():
            ok, frame = capture.read()
            if ok and frame is not None:
                failed_reads = 0
                with self._lock:
                    self._frame = frame
                    self._camera_opened = True
            else:
                failed_reads += 1
                if failed_reads >= STALL_FAILED_READS:
                    with self._lock:
                        self._frame = None
                        self._jpeg = None
                        self._camera_opened = False
                        self._store_cue(_quiet("camera-missing"))
                        self._inference_ms = 0
                self._capture_stop.wait(0.01)

    def _inference_loop(self) -> None:
        while not self._infer_stop.is_set():
            started = time.monotonic()
            try:
                self._infer_once()
            except Exception:
                with self._lock:
                    frame = self._frame
                    opened = self._camera_opened
                    source = self._source
                reason = quiet_failure_reason(
                    source=source,
                    has_frame=frame is not None,
                    camera_opened=opened,
                )
                with self._lock:
                    self._store_cue(_quiet(reason))
                    self._inference_ms = 0
            remaining = INFER_PERIOD - (time.monotonic() - started)
            if remaining > 0:
                self._infer_stop.wait(remaining)

    def _infer_once(self) -> None:
        with self._lock:
            frame = None if self._frame is None else self._frame.copy()
            opened = self._camera_opened
            source = self._source
        if source == "esp32":
            self._publish(_quiet("esp32"), 0, None, [])
            return
        if frame is None or not opened:
            self._publish(_quiet("camera-missing"), 0, None, [])
            return

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        if not frame_is_usable(gray):
            self._publish(_quiet("unsteady"), 0, frame, [])
            return

        if not WEIGHT_PATH.is_file():
            self._publish(_quiet("model-missing"), 0, frame, [])
            return

        session = self._load_session()
        if session is None or self._input_name is None:
            self._publish(_quiet("model-missing"), 0, frame, [])
            return

        infer_started = time.monotonic()
        boxed = letterbox(frame)
        rgb = cv2.cvtColor(boxed.image, cv2.COLOR_BGR2RGB)
        tensor = rgb.astype(np.float32) / 255.0
        nchw = np.transpose(tensor, (2, 0, 1))[None, ...]
        outputs = session.run(None, {self._input_name: nchw})
        boxes = predictions_to_boxes(outputs[0], boxed)
        inference_ms = int(round((time.monotonic() - infer_started) * 1000))
        cue, self._policy_state = decide(
            boxes,
            int(frame.shape[1]),
            int(frame.shape[0]),
            time.monotonic(),
            self._policy_state,
        )
        with self._lock:
            live = self._camera_opened and self._frame is not None
        if not live:
            self._publish(_quiet("camera-missing"), 0, None, [])
            return
        self._publish(cue, inference_ms, frame, boxes)

    def _load_session(self):
        if self._session is not None:
            return self._session
        try:
            import onnxruntime as ort

            session = ort.InferenceSession(
                str(WEIGHT_PATH), providers=["CPUExecutionProvider"]
            )
            self._session = session
            self._input_name = session.get_inputs()[0].name
            return session
        except Exception:
            self._session = None
            self._input_name = None
            return None

    def _store_cue(self, cue: Cue) -> None:
        """Apply hold memory and set the published cue. Caller holds ``_lock``."""
        published, self._last_obstacle = apply_hold_memory(cue, self._last_obstacle)
        self._cue = published

    def _publish(
        self,
        cue: Cue,
        inference_ms: int,
        frame: np.ndarray | None,
        boxes: list[Box],
    ) -> None:
        with self._lock:
            stalled = self._source != "esp32" and (
                not self._camera_opened or self._frame is None
            )
        jpeg = None
        if frame is not None and not stalled:
            annotated = _draw_boxes(frame, boxes)
            ok, encoded = cv2.imencode(".jpg", annotated)
            if ok:
                jpeg = encoded.tobytes()
        with self._lock:
            if self._source != "esp32" and (not self._camera_opened or self._frame is None):
                self._store_cue(_quiet("camera-missing"))
                self._inference_ms = 0
                self._jpeg = None
                return
            self._store_cue(cue)
            self._inference_ms = inference_ms
            if cue.reason == "camera-missing" or frame is None:
                self._jpeg = None
            elif jpeg is not None:
                self._jpeg = jpeg


def _draw_boxes(frame: np.ndarray, boxes: list[Box]) -> np.ndarray:
    out = frame.copy()
    for box in boxes:
        x0 = int(round(box.x0))
        y0 = int(round(box.y0))
        x1 = int(round(box.x1))
        y1 = int(round(box.y1))
        cv2.rectangle(out, (x0, y0), (x1, y1), (215, 235, 180), 2)
        label = box.class_name
        baseline = max(y0 - 8, 16)
        cv2.putText(
            out,
            label,
            (x0, baseline),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (215, 235, 180),
            2,
            cv2.LINE_AA,
        )
    return out


PIPELINE = Pipeline()

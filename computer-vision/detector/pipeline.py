"""Capture, two models, tracking, and the walking cue.

Threads:
- capture: keeps only the newest frame (laptop webcam or ESP32 MJPEG URL).
- detector (8 Hz): quality gate -> YOLO26n or YOLOE -> tracker -> policy -> cue.
- depth (~4 Hz): Depth Anything V2 Small -> corridor finding, read by the detector loop.

Nothing here raises on a missing camera or missing weights; the cue says why it is quiet.
"""

from __future__ import annotations

import sys
import threading
import time
import urllib.request
from dataclasses import dataclass, replace
from pathlib import Path

import cv2
import numpy as np

_DETECTOR_DIR = Path(__file__).resolve().parent
if str(_DETECTOR_DIR) not in sys.path:
    sys.path.insert(0, str(_DETECTOR_DIR))

from corridor import CORRIDOR_X, ConfirmState, DepthFinding, analyse, confirm
from depth import DepthModel, colourise
from eval_log import EvalLog
from failure_reason import quiet_failure_reason
from hold_memory import apply_hold_memory
from policy import Box, Cue, PolicyState, decide, quiet
from quality import frame_is_usable
from tracker import Tracker
from vocab import COCO, WALK, Vocabulary, prompts_match
from webcam import open_webcam
from yolo import letterbox, predictions_to_boxes

WEIGHTS = _DETECTOR_DIR / "weights"
INFER_PERIOD = 0.125
DEPTH_PERIOD = 0.25
DEPTH_STALE_SECONDS = 0.8
STALL_FAILED_READS = 8
MODES = ("general", "crosswalk", "depth")
OVERLAYS = ("boxes", "depth")
DEFAULT_DETECTOR = "yoloe"


@dataclass(frozen=True)
class DetectorSpec:
    name: str
    label: str
    path: Path
    vocab: Vocabulary
    prompt_file: Path | None = None

    def usable(self) -> bool:
        if not self.path.is_file():
            return False
        return self.prompt_file is None or prompts_match(self.prompt_file)


DETECTORS = {
    "yolo26n": DetectorSpec("yolo26n", "YOLO26n (COCO)", WEIGHTS / "yolo26n.onnx", COCO),
    "yoloe": DetectorSpec(
        "yoloe",
        "YOLOE-26n (Strider words)",
        WEIGHTS / "yoloe26n_walk.onnx",
        WALK,
        WEIGHTS / "yoloe26n_walk.json",
    ),
}


class MjpegReader:
    """Minimal ``VideoCapture``-like reader for an MJPEG HTTP stream (ESP32-CAM)."""

    def __init__(self, url: str) -> None:
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        self._response = None
        self._buffer = b""
        try:
            self._response = opener.open(url, timeout=5)
        except Exception:
            self._response = None

    def isOpened(self) -> bool:  # noqa: N802 - mirrors cv2.VideoCapture
        return self._response is not None

    def read(self) -> tuple[bool, np.ndarray | None]:
        if self._response is None:
            return False, None
        try:
            while True:
                start = self._buffer.find(b"\xff\xd8")
                end = self._buffer.find(b"\xff\xd9", start + 2) if start >= 0 else -1
                if start >= 0 and end >= 0:
                    jpeg = self._buffer[start : end + 2]
                    self._buffer = self._buffer[end + 2 :]
                    frame = cv2.imdecode(np.frombuffer(jpeg, np.uint8), cv2.IMREAD_COLOR)
                    return frame is not None, frame
                chunk = self._response.read(16384)
                if not chunk:
                    return False, None
                self._buffer = (self._buffer + chunk)[-2_000_000:]
        except Exception:
            return False, None

    def release(self) -> None:
        if self._response is not None:
            try:
                self._response.close()
            except Exception:
                pass
            self._response = None


class Pipeline:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._frame: np.ndarray | None = None
        self._jpeg: bytes | None = None
        self._cue: Cue = quiet("camera-missing")
        self._last_obstacle: Cue | None = None
        self._last_spoken: Cue | None = None
        self._inference_ms = 0
        self._depth_ms = 0
        self._mode = "general"
        self._overlay = "boxes"
        self._source = "webcam"
        self._index = 0
        self._esp32_url = ""
        self._camera_opened = False
        self._capture = None
        self._capture_thread: threading.Thread | None = None
        self._capture_stop = threading.Event()
        self._capture_gen = 0
        self._stop = threading.Event()
        self._threads: list[threading.Thread] = []
        self._policy_state = PolicyState()
        self._tracker = Tracker()
        self._boxes: list[Box] = []
        self._detector = DEFAULT_DETECTOR if DETECTORS[DEFAULT_DETECTOR].usable() else "yolo26n"
        self._sessions: dict[str, object] = {}
        self._depth = DepthModel()
        self._depth_map: np.ndarray | None = None
        self._depth_finding: DepthFinding | None = None
        self._depth_time = 0.0
        self._depth_confirm = ConfirmState()
        self._log = EvalLog()

    # ---- control -------------------------------------------------------

    def start(self) -> None:
        if not self._threads:
            for target, name in ((self._inference_loop, "detector"), (self._depth_loop, "depth")):
                thread = threading.Thread(target=target, name=name, daemon=True)
                thread.start()
                self._threads.append(thread)
        self.set_source_webcam(0)

    def set_mode(self, mode: str) -> None:
        if mode in MODES:
            with self._lock:
                self._mode = mode

    def set_overlay(self, overlay: str) -> bool:
        if overlay not in OVERLAYS:
            return False
        with self._lock:
            self._overlay = overlay
        return True

    def set_detector(self, name: str) -> bool:
        spec = DETECTORS.get(name)
        if spec is None or not spec.usable():
            return False
        with self._lock:
            self._detector = name
            self._tracker.reset()
            self._policy_state = PolicyState()
        return True

    def detectors(self) -> list[dict]:
        return [
            {"name": s.name, "label": s.label, "available": s.usable()} for s in DETECTORS.values()
        ]

    def set_source_webcam(self, index: int) -> None:
        self._index = int(index)
        with self._lock:
            self._source = "webcam"
        self._restart_capture()

    def set_source_esp32(self, stream_url: str) -> None:
        self._esp32_url = stream_url
        with self._lock:
            self._source = "esp32"
        self._restart_capture()

    def mark(self, kind: str) -> bool:
        with self._lock:
            last, detector, source = self._last_spoken, self._detector, self._source
        return self._log.mark(kind, last, detector, source)

    def snapshot(self) -> dict:
        with self._lock:
            cue = self._cue
            return {
                "kind": cue.kind,
                "speech": cue.speech,
                "reason": cue.reason,
                "side": cue.side,
                "class_name": cue.class_name,
                "confidence": cue.confidence,
                "distance": cue.distance,
                "source": cue.source,
                "timestamp": cue.timestamp,
                "inference_ms": self._inference_ms,
                "depth_ms": self._depth_ms,
                "depth_available": self._depth.available(),
                "detector": self._detector,
                "overlay": self._overlay,
                "mode": self._mode,
                "camera": self._source,
                "jpeg": self._jpeg,
            }

    # ---- capture -------------------------------------------------------

    def _restart_capture(self) -> None:
        self._stop_capture()
        self._capture_stop.clear()
        with self._lock:
            self._frame = None
            self._jpeg = None
            self._camera_opened = False
            self._capture_gen += 1
            gen = self._capture_gen
            self._tracker.reset()
            self._policy_state = PolicyState()
            self._depth_finding = None
            self._depth_map = None
        self._capture_thread = threading.Thread(
            target=self._capture_loop, args=(gen,), name="capture", daemon=True
        )
        self._capture_thread.start()

    def _stop_capture(self) -> None:
        self._capture_stop.set()
        thread = self._capture_thread
        with self._lock:
            capture = self._capture
            self._capture = None
        if capture is not None:
            try:
                capture.release()  # Unblocks a pending MJPEG read.
            except Exception:
                pass
        if thread is not None and thread.is_alive() and thread is not threading.current_thread():
            thread.join(timeout=2.0)
        self._capture_thread = None

    def _open_capture(self):
        if self._source == "esp32":
            return MjpegReader(self._esp32_url)
        return open_webcam(self._index)

    def _capture_loop(self, gen: int) -> None:
        try:
            capture = self._open_capture()
        except Exception:
            capture = None
        opened = bool(capture is not None and capture.isOpened())
        with self._lock:
            stale = gen != self._capture_gen
            if not stale:
                self._capture = capture
                self._camera_opened = opened
        if stale or not opened:
            if capture is not None:
                capture.release()
            if not stale:
                # Retry an ESP32 that is not up yet; a missing webcam just waits.
                while not self._capture_stop.wait(2.0):
                    if self._source == "esp32":
                        self._restart_capture_async()
                        return
            return
        failed = 0
        while not self._capture_stop.is_set():
            ok, frame = capture.read()
            if ok and frame is not None:
                failed = 0
                with self._lock:
                    self._frame = frame
                    self._camera_opened = True
                continue
            failed += 1
            if failed >= STALL_FAILED_READS:
                with self._lock:
                    self._frame = None
                    self._jpeg = None
                    self._camera_opened = False
                    self._store_cue(quiet("camera-missing"))
                if self._source == "esp32" and not self._capture_stop.is_set():
                    self._restart_capture_async()
                    return
            self._capture_stop.wait(0.01)

    def _restart_capture_async(self) -> None:
        threading.Thread(target=self._restart_capture, daemon=True).start()

    # ---- depth ---------------------------------------------------------

    def _depth_loop(self) -> None:
        while not self._stop.is_set():
            started = time.monotonic()
            try:
                self._depth_once()
            except Exception:
                with self._lock:
                    self._depth_finding = None
            remaining = DEPTH_PERIOD - (time.monotonic() - started)
            if remaining > 0:
                self._stop.wait(remaining)

    def _depth_once(self) -> None:
        with self._lock:
            frame = self._frame
            boxes = list(self._boxes)
        if frame is None or not self._depth.available():
            return
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        if not frame_is_usable(gray):
            with self._lock:
                self._depth_finding = None
                self._depth_confirm = ConfirmState()
            return
        t0 = time.monotonic()
        closeness = self._depth.closeness(frame)
        if closeness is None:
            return
        finding = analyse(closeness, boxes, frame.shape[1], frame.shape[0])
        ms = int(round((time.monotonic() - t0) * 1000))
        with self._lock:
            confirmed, self._depth_confirm = confirm(finding, self._depth_confirm)
            self._depth_finding = confirmed
            self._depth_map = closeness
            self._depth_time = time.monotonic()
            self._depth_ms = ms

    # ---- detector ------------------------------------------------------

    def _inference_loop(self) -> None:
        while not self._stop.is_set():
            started = time.monotonic()
            try:
                self._infer_once()
            except Exception:
                with self._lock:
                    reason = quiet_failure_reason(
                        has_frame=self._frame is not None, camera_opened=self._camera_opened
                    )
                    self._store_cue(quiet(reason))
                    self._inference_ms = 0
            remaining = INFER_PERIOD - (time.monotonic() - started)
            if remaining > 0:
                self._stop.wait(remaining)

    def _session(self, spec: DetectorSpec):
        if spec.name not in self._sessions:
            import onnxruntime as ort

            self._sessions[spec.name] = ort.InferenceSession(
                str(spec.path), providers=["CPUExecutionProvider"]
            )
        return self._sessions[spec.name]

    def _infer_once(self) -> None:
        with self._lock:
            frame = None if self._frame is None else self._frame.copy()
            spec = DETECTORS[self._detector]
        if frame is None:
            self._publish(quiet("camera-missing"), 0, None, [])
            return
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        if not frame_is_usable(gray):
            self._publish(quiet("unsteady"), 0, frame, [])
            return
        if not spec.usable():
            self._publish(quiet("model-missing"), 0, frame, [])
            return

        session = self._session(spec)
        t0 = time.monotonic()
        boxed = letterbox(frame)
        rgb = cv2.cvtColor(boxed.image, cv2.COLOR_BGR2RGB)
        tensor = (rgb.astype(np.float32) / 255.0).transpose(2, 0, 1)[None, ...]
        output = session.run(None, {session.get_inputs()[0].name: tensor})[0]
        boxes = predictions_to_boxes(output, boxed, spec.vocab)
        inference_ms = int(round((time.monotonic() - t0) * 1000))

        now = time.monotonic()
        with self._lock:
            tracks = self._tracker.update(boxes, now)
            depth = self._depth_finding if now - self._depth_time <= DEPTH_STALE_SECONDS else None
            cue, self._policy_state = decide(
                tracks, depth, frame.shape[1], frame.shape[0], now, self._policy_state
            )
            self._boxes = boxes
        self._publish(cue, inference_ms, frame, boxes)

    # ---- publish -------------------------------------------------------

    def _store_cue(self, cue: Cue) -> None:
        """Apply hold memory and set the published cue. Caller holds ``_lock``."""
        published, self._last_obstacle = apply_hold_memory(cue, self._last_obstacle)
        self._cue = published

    def _publish(self, cue: Cue, inference_ms: int, frame: np.ndarray | None, boxes: list[Box]) -> None:
        if cue.kind == "obstacle":
            cue = replace(cue, timestamp=time.time())
        jpeg = None
        if frame is not None:
            with self._lock:
                overlay = self._overlay
                depth_map = self._depth_map
            ok, encoded = cv2.imencode(".jpg", _annotate(frame, boxes, overlay, depth_map))
            if ok:
                jpeg = encoded.tobytes()
        with self._lock:
            if self._frame is None or not self._camera_opened:
                self._store_cue(quiet("camera-missing"))
                self._jpeg = None
                self._inference_ms = 0
                return
            self._store_cue(cue)
            self._inference_ms = inference_ms
            self._jpeg = jpeg
            detector, source = self._detector, self._source
            if cue.kind == "obstacle":
                self._last_spoken = cue
        if cue.kind == "obstacle":
            self._log.cue(cue, detector, source)


def _annotate(
    frame: np.ndarray, boxes: list[Box], overlay: str, depth_map: np.ndarray | None
) -> np.ndarray:
    h, w = frame.shape[:2]
    if overlay == "depth" and depth_map is not None:
        out = cv2.addWeighted(frame, 0.35, colourise(depth_map, w, h), 0.65, 0)
    else:
        out = frame.copy()
    # Walking corridor used by the depth check.
    for fx in CORRIDOR_X:
        x = int(fx * w)
        cv2.line(out, (x, 0), (x, h), (120, 120, 120), 1, cv2.LINE_AA)
    for box in boxes:
        x0, y0, x1, y1 = (int(round(v)) for v in (box.x0, box.y0, box.x1, box.y1))
        colour = (90, 200, 255) if box.mover else (215, 235, 180)
        cv2.rectangle(out, (x0, y0), (x1, y1), colour, 2)
        cv2.putText(
            out,
            f"{box.class_name} {box.confidence:.2f}",
            (x0, max(y0 - 8, 16)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            colour,
            2,
            cv2.LINE_AA,
        )
    return out


PIPELINE = Pipeline()

"""Append-only JSONL evaluation log: spoken cues and the tester's marks.

One file per day under ``computer-vision/logs/`` (gitignored). A mark records
what was last spoken, so false alerts and misses can be counted later.
"""

from __future__ import annotations

import json
import threading
import time
from dataclasses import asdict
from pathlib import Path

from policy import Cue

LOG_DIR = Path(__file__).resolve().parent.parent / "logs"
MARKS = ("false-alert", "missed")


class EvalLog:
    def __init__(self, directory: Path = LOG_DIR) -> None:
        self._dir = directory
        self._lock = threading.Lock()

    def _path(self, now: float) -> Path:
        return self._dir / time.strftime("eval-%Y-%m-%d.jsonl", time.localtime(now))

    def _write(self, record: dict) -> None:
        now = record["time"]
        with self._lock:
            try:
                self._dir.mkdir(parents=True, exist_ok=True)
                with self._path(now).open("a", encoding="utf-8") as handle:
                    handle.write(json.dumps(record) + "\n")
            except OSError:
                pass  # Logging must never stop guidance.

    def cue(self, cue: Cue, detector: str, source: str) -> None:
        if cue.kind != "obstacle":
            return
        self._write(
            {"time": cue.timestamp or time.time(), "event": "cue", "detector": detector,
             "camera": source, "cue": asdict(cue)}
        )

    def mark(self, kind: str, last_cue: Cue | None, detector: str, source: str) -> bool:
        if kind not in MARKS:
            return False
        self._write(
            {"time": time.time(), "event": kind, "detector": detector, "camera": source,
             "last_cue": asdict(last_cue) if last_cue is not None else None}
        )
        return True

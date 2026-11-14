"""Follow detector boxes across frames and tell whether each one is coming closer.

Pure Python. A track is confirmed after ``CONFIRM_HITS`` matches. A track is
approaching when its box height grew by ``APPROACH_GROWTH`` over roughly the
last second; seconds-to-contact comes from that growth rate.
"""

from __future__ import annotations

import statistics
from dataclasses import dataclass, field

from policy import Box

MATCH_IOU = 0.3
EXPIRE_SECONDS = 0.5
CONFIRM_HITS = 3
APPROACH_WINDOW = 1.0
APPROACH_MIN_SPAN = 0.4
APPROACH_GROWTH = 1.15
HISTORY_SECONDS = 2.0
SMOOTH_SAMPLES = 3


@dataclass(frozen=True)
class TrackView:
    track_id: int
    box: Box
    hits: int
    approaching: bool
    seconds_to_contact: float | None

    @property
    def confirmed(self) -> bool:
        return self.hits >= CONFIRM_HITS


@dataclass
class _Track:
    track_id: int
    box: Box
    hits: int
    last_seen: float
    history: list[tuple[float, float]] = field(default_factory=list)


class Tracker:
    def __init__(self) -> None:
        self._tracks: list[_Track] = []
        self._next_id = 1

    def reset(self) -> None:
        self._tracks = []

    def update(self, boxes: list[Box], now: float) -> list[TrackView]:
        self._tracks = [t for t in self._tracks if now - t.last_seen <= EXPIRE_SECONDS]

        pairs: list[tuple[float, int, int]] = []
        for ti, track in enumerate(self._tracks):
            for bi, box in enumerate(boxes):
                if box.class_name != track.box.class_name:
                    continue
                overlap = iou(track.box, box)
                if overlap >= MATCH_IOU:
                    pairs.append((overlap, ti, bi))
        pairs.sort(reverse=True)

        used_tracks: set[int] = set()
        used_boxes: set[int] = set()
        for _overlap, ti, bi in pairs:
            if ti in used_tracks or bi in used_boxes:
                continue
            used_tracks.add(ti)
            used_boxes.add(bi)
            track = self._tracks[ti]
            track.box = boxes[bi]
            track.hits += 1
            track.last_seen = now
            track.history.append((now, _height(boxes[bi])))

        for bi, box in enumerate(boxes):
            if bi in used_boxes:
                continue
            self._tracks.append(
                _Track(
                    track_id=self._next_id,
                    box=box,
                    hits=1,
                    last_seen=now,
                    history=[(now, _height(box))],
                )
            )
            self._next_id += 1

        views: list[TrackView] = []
        for track in self._tracks:
            track.history = [h for h in track.history if now - h[0] <= HISTORY_SECONDS]
            if track.last_seen != now:
                continue
            approaching, seconds = _approach(track.history, now)
            views.append(
                TrackView(
                    track_id=track.track_id,
                    box=track.box,
                    hits=track.hits,
                    approaching=approaching,
                    seconds_to_contact=seconds,
                )
            )
        return views


def _height(box: Box) -> float:
    return max(0.0, box.y1 - box.y0)


def _approach(history: list[tuple[float, float]], now: float) -> tuple[bool, float | None]:
    if len(history) < 2:
        return False, None
    window = [h for h in history if now - h[0] <= APPROACH_WINDOW + 0.2]
    if len(window) < 2 * SMOOTH_SAMPLES:
        return False, None
    # Median of a few samples at each end so one jittery box cannot fake an approach.
    current = statistics.median(h for _t, h in window[-SMOOTH_SAMPLES:])
    then_height = statistics.median(h for _t, h in window[:SMOOTH_SAMPLES])
    then_time = window[SMOOTH_SAMPLES // 2][0]
    span = now - then_time
    if span < APPROACH_MIN_SPAN or then_height <= 0:
        return False, None
    growth = current / then_height
    if growth < APPROACH_GROWTH:
        return False, None
    return True, span / (growth - 1.0)


def iou(a: Box, b: Box) -> float:
    ix0 = max(a.x0, b.x0)
    iy0 = max(a.y0, b.y0)
    ix1 = min(a.x1, b.x1)
    iy1 = min(a.y1, b.y1)
    inter = max(0.0, ix1 - ix0) * max(0.0, iy1 - iy0)
    area_a = max(0.0, a.x1 - a.x0) * max(0.0, a.y1 - a.y0)
    area_b = max(0.0, b.x1 - b.x0) * max(0.0, b.y1 - b.y0)
    union = area_a + area_b - inter
    if union <= 0:
        return 0.0
    return inter / union

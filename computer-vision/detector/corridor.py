"""Read a relative depth map for hazards a class list cannot name.

Input is a closeness map (higher = nearer), such as Depth Anything's output.
Values are relative, so each frame is normalised to 0..1 by percentiles and
compared with the ground just ahead of the walker (bottom of the corridor).

Findings, at most one per frame:
- ``head``: something close in the upper part of the walking corridor.
- ``drop``: the ground ahead suddenly falls away (step down, curb, hole).
- ``path``: something close in the middle of the corridor that no detector box explains.

All thresholds are starting guesses for a chest camera and need tuning on
real collar footage. Pure NumPy; no model, no OpenCV.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from policy import Box

CORRIDOR_X = (0.30, 0.70)
HEAD_Y = (0.0, 0.45)
PATH_Y = (0.45, 0.80)
GROUND_Y = (0.85, 1.0)
DROP_Y = (0.50, 1.0)
DROP_BANDS = 8
DROP_STRIPS = 5

HEAD_RATIO = 0.8
PATH_RATIO = 0.9
DROP_RATIO = 0.5
DROP_STRIP_SHARE = 0.6
MIN_REGION_SHARE = 0.25
GROUND_MIN = 0.15
GROUND_COVERED_MAX = 0.5
CONFIRM_PASSES = 2


@dataclass(frozen=True)
class DepthFinding:
    kind: str  # "head" | "drop" | "path"
    strength: float  # 0..1


@dataclass(frozen=True)
class ConfirmState:
    kind: str | None = None
    count: int = 0


def normalise(closeness: np.ndarray) -> np.ndarray:
    lo, hi = np.percentile(closeness, [2, 98])
    if hi - lo < 1e-6:
        return np.zeros_like(closeness, dtype=np.float32)
    return np.clip((closeness - lo) / (hi - lo), 0.0, 1.0).astype(np.float32)


def analyse(
    closeness: np.ndarray,
    boxes: list[Box],
    frame_width: int,
    frame_height: int,
) -> DepthFinding | None:
    """Return the most urgent depth finding for one frame, or None."""
    depth = normalise(np.asarray(closeness, dtype=np.float32))
    h, w = depth.shape
    explained = _box_mask(boxes, w / frame_width, h / frame_height, (h, w))

    if float(_region(explained, CORRIDOR_X, GROUND_Y).mean()) > GROUND_COVERED_MAX:
        # The "ground" just ahead is a detected object (a person standing close),
        # so there is no ground to compare against; the detector cue covers it.
        return None
    ground = float(np.median(_region(depth, CORRIDOR_X, GROUND_Y)))
    if ground < GROUND_MIN:
        # No near ground in view (camera pointed up or lens blocked): nothing to compare.
        return None

    head = _near_share(depth, explained, HEAD_Y, ground * HEAD_RATIO)
    if head >= MIN_REGION_SHARE:
        return DepthFinding("head", min(1.0, head))

    drop = _drop_strength(depth)
    if drop is not None:
        return DepthFinding("drop", drop)

    path = _near_share(depth, explained, PATH_Y, ground * PATH_RATIO)
    if path >= MIN_REGION_SHARE:
        return DepthFinding("path", min(1.0, path))
    return None


def confirm(
    finding: DepthFinding | None, state: ConfirmState
) -> tuple[DepthFinding | None, ConfirmState]:
    """Pass a finding on only after it repeats for ``CONFIRM_PASSES`` depth passes."""
    if finding is None:
        return None, ConfirmState()
    count = state.count + 1 if state.kind == finding.kind else 1
    new_state = ConfirmState(kind=finding.kind, count=count)
    if count >= CONFIRM_PASSES:
        return finding, new_state
    return None, new_state


def _slice(size: int, span: tuple[float, float]) -> slice:
    return slice(int(round(span[0] * size)), max(int(round(span[1] * size)), int(round(span[0] * size)) + 1))


def _region(depth: np.ndarray, xs: tuple[float, float], ys: tuple[float, float]) -> np.ndarray:
    h, w = depth.shape
    return depth[_slice(h, ys), _slice(w, xs)]


def _box_mask(boxes: list[Box], sx: float, sy: float, shape: tuple[int, int]) -> np.ndarray:
    mask = np.zeros(shape, dtype=bool)
    for box in boxes:
        x0 = max(0, int(box.x0 * sx))
        x1 = min(shape[1], int(np.ceil(box.x1 * sx)))
        y0 = max(0, int(box.y0 * sy))
        y1 = min(shape[0], int(np.ceil(box.y1 * sy)))
        mask[y0:y1, x0:x1] = True
    return mask


def _near_share(
    depth: np.ndarray, explained: np.ndarray, ys: tuple[float, float], threshold: float
) -> float:
    region = _region(depth, CORRIDOR_X, ys)
    covered = _region(explained, CORRIDOR_X, ys)
    near = (region >= threshold) & ~covered
    return float(near.mean()) if near.size else 0.0


def _drop_strength(depth: np.ndarray) -> float | None:
    region = _region(depth, CORRIDOR_X, DROP_Y)
    rows, cols = region.shape
    if rows < DROP_BANDS or cols < DROP_STRIPS:
        return None
    bands = np.array_split(np.arange(rows), DROP_BANDS)
    strips = np.array_split(np.arange(cols), DROP_STRIPS)
    hits = 0
    worst = 1.0
    for strip in strips:
        # Band medians from the bottom (nearest ground) upward.
        values = [float(np.median(region[np.ix_(band, strip)])) for band in reversed(bands)]
        # A fall only counts as a drop while the strip still looks like ground
        # receding from the walker. A fall after a rise is the top edge of an
        # object standing on the ground, which is the ``path`` check's job.
        ratios = []
        for i in range(len(values) - 1):
            if values[i] <= GROUND_MIN:
                break
            if max(values[: i + 1]) > values[0] * 1.1:
                break
            ratios.append(values[i + 1] / values[i])
        if not ratios:
            continue
        lowest = min(ratios)
        if lowest < 1.0 - DROP_RATIO:
            hits += 1
            worst = min(worst, lowest)
    if hits / DROP_STRIPS >= DROP_STRIP_SHARE:
        return float(min(1.0, 1.0 - worst))
    return None

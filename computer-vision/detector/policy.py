"""Turn tracked detections and a depth finding into one walking cue.

Priority, highest first (only the winner is cued):
1. approaching mover  2. head-height (depth)  3. drop (depth)
4. named obstacle in the path  5. unnamed obstacle in the path (depth)

The same cue is held for ``HOLD_SECONDS``. During a hold only a strictly
higher-priority cue may interrupt. The policy never says the path is clear.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from corridor import DepthFinding
    from tracker import TrackView

HOLD_SECONDS = 4.0
LEFT_FRACTION = 0.35
RIGHT_FRACTION = 0.65
NEAR_BOTTOM_FRACTION = 0.55
NEAR_HEIGHT_FRACTION = 0.12
VERY_NEAR_BOTTOM_FRACTION = 0.9
VERY_NEAR_HEIGHT_FRACTION = 0.5
CONTACT_SECONDS = 3.0
VERY_NEAR_CONTACT_SECONDS = 1.5
VERY_NEAR_DEPTH_STRENGTH = 0.6

PRIORITY = {
    "approaching": 50,
    "head": 40,
    "drop": 30,
    "pass": 20,
    "blocked": 20,
    "path": 10,
}


@dataclass(frozen=True)
class Box:
    class_name: str
    rank: int
    confidence: float
    x0: float
    y0: float
    x1: float
    y1: float
    mover: bool = False


@dataclass(frozen=True)
class Cue:
    kind: str
    speech: str
    reason: str
    side: str | None
    class_name: str | None
    confidence: float | None = None
    distance: str | None = None
    source: str | None = None
    timestamp: float = 0.0


@dataclass(frozen=True)
class PolicyState:
    key: tuple[str, str | None, str | None] | None = None
    priority: int = 0
    hold_until: float = 0.0


def quiet(reason: str, side: str | None = None, class_name: str | None = None) -> Cue:
    return Cue(kind="quiet", speech="", reason=reason, side=side, class_name=class_name)


def decide(
    tracks: list[TrackView],
    depth: DepthFinding | None,
    width: int,
    height: int,
    now: float,
    state: PolicyState,
) -> tuple[Cue, PolicyState]:
    candidate = _choose(tracks, depth, width, height)
    if candidate is None:
        pending = any(not t.confirmed and _is_near(t.box, height) for t in tracks)
        return quiet("pending" if pending else "clear"), state

    priority = PRIORITY[candidate.reason]
    key = (candidate.reason, candidate.class_name, candidate.side)
    holding = now < state.hold_until
    if holding and (key == state.key or priority <= state.priority):
        return quiet("holding", candidate.side, candidate.class_name), state
    return candidate, PolicyState(key=key, priority=priority, hold_until=now + HOLD_SECONDS)


def _choose(
    tracks: list[TrackView], depth: DepthFinding | None, width: int, height: int
) -> Cue | None:
    confirmed = [t for t in tracks if t.confirmed]

    movers = [
        t
        for t in confirmed
        if t.box.mover
        and t.approaching
        and t.seconds_to_contact is not None
        and t.seconds_to_contact < CONTACT_SECONDS
    ]
    if movers:
        track = min(movers, key=lambda t: t.seconds_to_contact)
        side = _box_side(track.box, width)
        name = _spoken(track.box.class_name)
        where = "ahead" if side == "center" else f"on the {side}"
        return Cue(
            kind="obstacle",
            speech=f"{name} approaching {where}.",
            reason="approaching",
            side=side,
            class_name=track.box.class_name,
            confidence=track.box.confidence,
            distance="very near" if track.seconds_to_contact < VERY_NEAR_CONTACT_SECONDS else "near",
            source="detector",
        )

    if depth is not None and depth.kind in ("head", "drop"):
        return _depth_cue(depth)

    boxes = [t.box for t in confirmed]
    subject = _select_subject(boxes, width, height)
    if subject is not None:
        side = _box_side(subject, width)
        speech, reason = _line_for(subject, side, _occupied_sides(boxes, width, height))
        return Cue(
            kind="obstacle",
            speech=speech,
            reason=reason,
            side=side,
            class_name=subject.class_name,
            confidence=subject.confidence,
            distance=_box_distance(subject, height),
            source="detector",
        )

    if depth is not None and depth.kind == "path":
        return _depth_cue(depth)
    return None


_DEPTH_SPEECH = {
    "head": "Obstacle at head height.",
    "drop": "Drop ahead. Stop.",
    "path": "Obstacle ahead.",
}


def _depth_cue(depth: DepthFinding) -> Cue:
    return Cue(
        kind="obstacle",
        speech=_DEPTH_SPEECH[depth.kind],
        reason=depth.kind,
        side="center",
        class_name=None,
        confidence=round(depth.strength, 2),
        distance="very near" if depth.strength >= VERY_NEAR_DEPTH_STRENGTH else "near",
        source="depth",
    )


def _spoken(class_name: str) -> str:
    from vocab import SPOKEN_BY_CLASS

    return SPOKEN_BY_CLASS.get(class_name, class_name.replace("_", " ").capitalize())


def _is_near(box: Box, height: int) -> bool:
    return box.y1 > NEAR_BOTTOM_FRACTION * height and (
        box.y1 - box.y0
    ) >= NEAR_HEIGHT_FRACTION * height


def _box_distance(box: Box, height: int) -> str:
    if box.y1 > VERY_NEAR_BOTTOM_FRACTION * height or (
        box.y1 - box.y0
    ) >= VERY_NEAR_HEIGHT_FRACTION * height:
        return "very near"
    return "near"


def _box_side(box: Box, width: int) -> str:
    center_x = (box.x0 + box.x1) / 2.0
    if center_x < LEFT_FRACTION * width:
        return "left"
    if center_x > RIGHT_FRACTION * width:
        return "right"
    return "center"


def _best(boxes: list[Box]) -> Box:
    return max(boxes, key=lambda box: (box.rank, box.confidence))


def _select_subject(boxes: list[Box], width: int, height: int) -> Box | None:
    near = [box for box in boxes if _is_near(box, height)]
    if not near:
        return None

    ranked = [box for box in near if box.rank >= 2]
    if ranked:
        candidates = ranked
    elif len(near) == 1:
        candidates = near
    else:
        return None

    center = [box for box in candidates if _box_side(box, width) == "center"]
    pool = center if center else candidates
    return _best(pool)


def _occupied_sides(boxes: list[Box], width: int, height: int) -> dict[str, bool]:
    occupied = {"left": False, "center": False, "right": False}
    for box in boxes:
        if box.rank < 2 or not _is_near(box, height):
            continue
        occupied[_box_side(box, width)] = True
    return occupied


def _line_for(subject: Box, side: str, occupied: dict[str, bool]) -> tuple[str, str]:
    name = _spoken(subject.class_name)
    if side == "left":
        if occupied["right"]:
            return "Path blocked.", "blocked"
        return f"{name} on the left. Pass on the right.", "pass"
    if side == "right":
        if occupied["left"]:
            return "Path blocked.", "blocked"
        return f"{name} on the right. Pass on the left.", "pass"
    if occupied["left"] and occupied["right"]:
        return "Path blocked.", "blocked"
    if occupied["left"]:
        return f"{name} ahead. Pass on the right.", "pass"
    if occupied["right"]:
        return f"{name} ahead. Pass on the left.", "pass"
    return f"{name} ahead. Pass on the right.", "pass"

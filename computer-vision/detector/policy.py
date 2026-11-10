from dataclasses import dataclass

HOLD_SECONDS = 4.0
LEFT_FRACTION = 0.35
RIGHT_FRACTION = 0.65
NEAR_BOTTOM_FRACTION = 0.55
NEAR_HEIGHT_FRACTION = 0.12

SPOKEN_NAMES = {
    "vehicle": "Vehicle",
    "person": "Person",
    "bike": "Bike",
    "dog": "Dog",
    "bag": "Bag",
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


@dataclass(frozen=True)
class Cue:
    kind: str
    speech: str
    reason: str
    side: str | None
    class_name: str | None


@dataclass(frozen=True)
class PolicyState:
    class_name: str | None = None
    side: str | None = None
    seen_count: int = 0
    hold_until: float = 0.0


def decide(
    boxes: list[Box],
    width: int,
    height: int,
    now: float,
    state: PolicyState,
) -> tuple[Cue, PolicyState]:
    subject = _select_subject(boxes, width, height)
    if subject is None:
        return (
            Cue(kind="quiet", speech="", reason="clear", side=None, class_name=None),
            PolicyState(),
        )

    side = _box_side(subject, width)
    occupied = _occupied_sides(boxes, width, height)
    speech, reason = _line_for(subject, side, occupied)
    same = state.class_name == subject.class_name and state.side == side

    if same and now < state.hold_until:
        return (
            Cue(
                kind="quiet",
                speech="",
                reason="holding",
                side=side,
                class_name=subject.class_name,
            ),
            state,
        )

    if same and state.seen_count >= 3:
        return (
            Cue(
                kind="obstacle",
                speech=speech,
                reason=reason,
                side=side,
                class_name=subject.class_name,
            ),
            PolicyState(
                class_name=subject.class_name,
                side=side,
                seen_count=state.seen_count,
                hold_until=now + HOLD_SECONDS,
            ),
        )

    seen_count = state.seen_count + 1 if same else 1
    pending_state = PolicyState(
        class_name=subject.class_name,
        side=side,
        seen_count=seen_count,
        hold_until=0.0,
    )
    if seen_count < 3:
        return (
            Cue(
                kind="quiet",
                speech="",
                reason="pending",
                side=side,
                class_name=subject.class_name,
            ),
            pending_state,
        )

    return (
        Cue(
            kind="obstacle",
            speech=speech,
            reason=reason,
            side=side,
            class_name=subject.class_name,
        ),
        PolicyState(
            class_name=subject.class_name,
            side=side,
            seen_count=seen_count,
            hold_until=now + HOLD_SECONDS,
        ),
    )


def _is_near(box: Box, height: int) -> bool:
    return box.y1 > NEAR_BOTTOM_FRACTION * height and (
        box.y1 - box.y0
    ) >= NEAR_HEIGHT_FRACTION * height


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
    name = SPOKEN_NAMES[subject.class_name]
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

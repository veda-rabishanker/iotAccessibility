from corridor import DepthFinding
from policy import Box, PolicyState, decide
from tracker import TrackView

WIDTH = 640
HEIGHT = 480


def _box(
    class_name: str,
    rank: int,
    x0: float,
    y0: float,
    x1: float,
    y1: float,
    confidence: float = 0.9,
) -> Box:
    return Box(
        class_name=class_name,
        rank=rank,
        confidence=confidence,
        x0=x0,
        y0=y0,
        x1=x1,
        y1=y1,
        mover=class_name in ("person", "vehicle", "bike"),
    )


def person(x0: float, y0: float, x1: float, y1: float, confidence: float = 0.9) -> Box:
    return _box("person", 2, x0, y0, x1, y1, confidence)


def vehicle(x0: float, y0: float, x1: float, y1: float, confidence: float = 0.9) -> Box:
    return _box("vehicle", 3, x0, y0, x1, y1, confidence)


def bag(x0: float, y0: float, x1: float, y1: float, confidence: float = 0.9) -> Box:
    return _box("bag", 1, x0, y0, x1, y1, confidence)


# Near boxes: y1 > 264 and height >= 57.6. Centers: left < 224, right > 416.
LEFT_PERSON = person(40, 280, 180, 450)
RIGHT_PERSON = person(460, 280, 600, 450)
CENTER_PERSON = person(250, 280, 390, 450)
TOP_PERSON = person(250, 20, 390, 200)
RIGHT_VEHICLE = vehicle(430, 200, 630, 470)
CENTER_VEHICLE = vehicle(250, 260, 390, 450)
CENTER_BAG = bag(280, 300, 360, 420)
LEFT_BAG = bag(40, 300, 160, 420)


def track(box: Box, hits: int = 3, approaching: bool = False, contact: float | None = None) -> TrackView:
    return TrackView(track_id=id(box), box=box, hits=hits, approaching=approaching, seconds_to_contact=contact)


def call(boxes, now: float, state: PolicyState | None = None, hits: int = 3, depth=None):
    if state is None:
        state = PolicyState()
    tracks = [b if isinstance(b, TrackView) else track(b, hits) for b in boxes]
    return decide(tracks, depth, WIDTH, HEIGHT, now, state)


def after_confirm(boxes, now: float = 0.0):
    return call(boxes, now)


def test_no_boxes_is_clear():
    cue, _ = call([], 0.0)
    assert cue.speech == ""
    assert cue.reason == "clear"
    assert cue.kind == "quiet"
    assert cue.side is None
    assert cue.class_name is None


def test_person_only_in_top_half_is_clear():
    cue, _ = call([TOP_PERSON], 0.0)
    assert cue.speech == ""
    assert cue.reason == "clear"
    assert cue.kind == "quiet"


def test_person_on_left_right_empty():
    cue, _ = after_confirm([LEFT_PERSON])
    assert cue.speech == "Person on the left. Pass on the right."
    assert cue.reason == "pass"
    assert cue.kind == "obstacle"
    assert cue.side == "left"
    assert cue.class_name == "person"


def test_person_on_right_left_empty():
    cue, _ = after_confirm([RIGHT_PERSON])
    assert cue.speech == "Person on the right. Pass on the left."
    assert cue.reason == "pass"
    assert cue.kind == "obstacle"
    assert cue.side == "right"
    assert cue.class_name == "person"


def test_center_person_vehicle_on_right():
    cue, _ = after_confirm([CENTER_PERSON, RIGHT_VEHICLE])
    assert cue.speech == "Person ahead. Pass on the left."
    assert cue.reason == "pass"
    assert cue.kind == "obstacle"
    assert cue.side == "center"
    assert cue.class_name == "person"


def test_center_vehicle_beats_person_on_left():
    cue, _ = after_confirm([CENTER_VEHICLE, LEFT_PERSON])
    assert cue.speech == "Vehicle ahead. Pass on the right."
    assert cue.reason == "pass"
    assert cue.kind == "obstacle"
    assert cue.side == "center"
    assert cue.class_name == "vehicle"


def test_all_three_thirds_blocked():
    cue, _ = after_confirm([LEFT_PERSON, CENTER_PERSON, RIGHT_PERSON])
    assert cue.speech == "Path blocked."
    assert cue.reason == "blocked"
    assert cue.kind == "obstacle"
    assert cue.side == "center"


def test_bag_alone_in_center():
    cue, _ = after_confirm([CENTER_BAG])
    assert cue.speech == "Bag ahead. Pass on the right."
    assert cue.reason == "pass"
    assert cue.kind == "obstacle"
    assert cue.side == "center"
    assert cue.class_name == "bag"


def test_bag_beside_person_person_wins():
    cue, _ = after_confirm([CENTER_BAG, LEFT_PERSON])
    assert cue.speech == "Person on the left. Pass on the right."
    assert cue.reason == "pass"
    assert cue.class_name == "person"


def test_unconfirmed_near_track_is_pending():
    cue, _ = call([LEFT_PERSON], 0.0, hits=2)
    assert cue.speech == ""
    assert cue.reason == "pending"
    assert cue.kind == "quiet"


def test_confirmed_track_speaks_with_extra_fields():
    cue, _ = after_confirm([LEFT_PERSON])
    assert cue.speech == "Person on the left. Pass on the right."
    assert cue.confidence == 0.9
    assert cue.distance == "very near"  # bottom of box in the last 10% of the frame
    assert cue.source == "detector"
    mid, _ = after_confirm([person(40, 280, 180, 400)])
    assert mid.distance == "near"


def test_one_second_after_spoken_cue_is_holding():
    boxes = [LEFT_PERSON]
    _, state = after_confirm(boxes, now=0.0)
    cue, _ = call(boxes, 1.0, state)
    assert cue.speech == ""
    assert cue.reason == "holding"
    assert cue.kind == "quiet"


def test_five_seconds_after_spoken_cue_speaks_again():
    boxes = [LEFT_PERSON]
    _, state = after_confirm(boxes, now=0.0)
    cue, _ = call(boxes, 5.0, state)
    assert cue.speech == "Person on the left. Pass on the right."
    assert cue.reason == "pass"
    assert cue.kind == "obstacle"


def test_approaching_mover_beats_static_obstacle():
    far_bike = _box("bike", 3, 60, 150, 140, 260)
    cue, _ = call([CENTER_PERSON, track(far_bike, approaching=True, contact=2.0)], 0.0)
    assert cue.speech == "Bike approaching on the left."
    assert cue.reason == "approaching"
    assert cue.distance == "near"


def test_approaching_too_slowly_is_not_cued_as_approaching():
    cue, _ = call([track(CENTER_PERSON, approaching=True, contact=6.0)], 0.0)
    assert cue.reason == "pass"


def test_head_height_depth_beats_named_obstacle():
    cue, _ = call([LEFT_PERSON], 0.0, depth=DepthFinding("head", 0.7))
    assert cue.speech == "Obstacle at head height."
    assert cue.source == "depth"
    assert cue.class_name is None
    assert cue.distance == "very near"


def test_drop_is_cued():
    cue, _ = call([], 0.0, depth=DepthFinding("drop", 0.4))
    assert cue.speech == "Drop ahead. Stop."
    assert cue.distance == "near"


def test_unnamed_path_obstacle_loses_to_named_one():
    cue, _ = call([CENTER_PERSON], 0.0, depth=DepthFinding("path", 0.5))
    assert cue.class_name == "person"
    cue, _ = call([], 0.0, depth=DepthFinding("path", 0.5))
    assert cue.speech == "Obstacle ahead."


def test_higher_priority_interrupts_a_hold():
    _, state = call([LEFT_PERSON], 0.0)
    cue, _ = call([LEFT_PERSON], 1.0, state, depth=DepthFinding("drop", 0.5))
    assert cue.reason == "drop"


def test_lower_priority_waits_for_the_hold():
    _, state = call([], 0.0, depth=DepthFinding("drop", 0.5))
    cue, _ = call([LEFT_PERSON], 1.0, state)
    assert cue.reason == "holding"
    cue, _ = call([LEFT_PERSON], 4.5, state)
    assert cue.reason == "pass"


def test_policy_never_speaks_the_word_clear():
    scenes = [[], [LEFT_PERSON], [LEFT_PERSON, CENTER_PERSON, RIGHT_PERSON], [CENTER_BAG]]
    for scene in scenes:
        cue, _ = call(scene, 0.0)
        assert "clear" not in cue.speech.lower()

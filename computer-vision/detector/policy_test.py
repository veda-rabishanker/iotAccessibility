from policy import Box, PolicyState, decide

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


def call(boxes: list[Box], now: float, state: PolicyState | None = None):
    if state is None:
        state = PolicyState()
    return decide(boxes, WIDTH, HEIGHT, now, state)


def after_confirm(boxes: list[Box], now: float = 0.0):
    state = PolicyState()
    cue = None
    for _ in range(3):
        cue, state = call(boxes, now, state)
    return cue, state


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


def test_calls_one_and_two_are_pending():
    boxes = [LEFT_PERSON]
    cue1, state = call(boxes, 0.0)
    assert cue1.speech == ""
    assert cue1.reason == "pending"
    assert cue1.kind == "quiet"

    cue2, _ = call(boxes, 0.0, state)
    assert cue2.speech == ""
    assert cue2.reason == "pending"
    assert cue2.kind == "quiet"


def test_call_three_speaks():
    cue, _ = after_confirm([LEFT_PERSON])
    assert cue.speech == "Person on the left. Pass on the right."
    assert cue.reason == "pass"
    assert cue.kind == "obstacle"


def test_different_class_on_call_three_resets_and_stays_quiet():
    state = PolicyState()
    _, state = call([LEFT_PERSON], 0.0, state)
    _, state = call([LEFT_PERSON], 0.0, state)
    cue, _ = call([vehicle(40, 280, 180, 450)], 0.0, state)
    assert cue.speech == ""
    assert cue.reason == "pending"
    assert cue.kind == "quiet"


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

from hold_memory import apply_hold_memory
from policy import Cue

PASS = Cue(
    kind="obstacle",
    speech="Person on the left. Pass on the right.",
    reason="pass",
    side="left",
    class_name="person",
)
BLOCKED = Cue(
    kind="obstacle",
    speech="Path blocked.",
    reason="blocked",
    side="center",
    class_name="person",
)
HOLD = Cue(
    kind="quiet",
    speech="",
    reason="holding",
    side="left",
    class_name="person",
)


def test_holding_replays_remembered_pass_sentence():
    published, remembered = apply_hold_memory(PASS, None)
    assert published is PASS
    published, remembered = apply_hold_memory(HOLD, remembered)
    assert published.reason == "holding"
    assert published.kind == "quiet"
    assert published.speech == PASS.speech
    assert published.class_name == "person"
    assert published.side == "left"


def test_holding_replays_remembered_blocked_sentence():
    _, remembered = apply_hold_memory(BLOCKED, None)
    published, _ = apply_hold_memory(HOLD, remembered)
    assert published.reason == "holding"
    assert published.speech == "Path blocked."
    assert published.class_name == "person"
    assert published.side == "center"


def test_holding_without_memory_stays_empty():
    published, remembered = apply_hold_memory(HOLD, None)
    assert published.speech == ""
    assert published.reason == "holding"
    assert remembered is None


def test_clear_reasons_drop_remembered_sentence():
    for reason in (
        "clear",
        "pending",
        "unsteady",
        "camera-missing",
        "model-missing",
    ):
        _, remembered = apply_hold_memory(PASS, None)
        cue = Cue(kind="quiet", speech="", reason=reason, side=None, class_name=None)
        published, remembered = apply_hold_memory(cue, remembered)
        assert remembered is None
        assert published.speech == ""
        assert published.reason == reason
        held, _ = apply_hold_memory(HOLD, remembered)
        assert held.speech == ""
        assert held.reason == "holding"


def test_depth_cue_is_remembered_with_its_fields():
    drop = Cue("obstacle", "Drop ahead. Stop.", "drop", "center", None,
               confidence=0.5, distance="near", source="depth", timestamp=5.0)
    _, remembered = apply_hold_memory(drop, None)
    published, _ = apply_hold_memory(HOLD, remembered)
    assert published.speech == "Drop ahead. Stop."
    assert published.reason == "holding"
    assert published.source == "depth"

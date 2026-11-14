import numpy as np

from corridor import ConfirmState, DepthFinding, analyse, confirm
from policy import Box

H, W = 120, 160


def _ground_ramp() -> np.ndarray:
    """Open walkway: nearest at the bottom, receding smoothly toward the horizon."""
    rows = np.linspace(0.0, 1.0, H)[:, None]
    ramp = np.where(rows > 0.4, (rows - 0.4) / 0.6, 0.0)
    return np.repeat(0.05 + 0.95 * ramp, W, axis=1)


def test_open_walkway_has_no_finding():
    assert analyse(_ground_ramp(), [], W, H) is None


def test_close_thing_at_head_height_in_corridor():
    depth = _ground_ramp()
    depth[5:45, 55:105] = 0.95
    finding = analyse(depth, [], W, H)
    assert finding is not None
    assert finding.kind == "head"


def test_head_height_thing_inside_a_detector_box_is_explained():
    depth = _ground_ramp()
    depth[5:45, 55:105] = 0.95
    box = Box("person", 2, 0.9, 50, 0, 110, 50)
    assert analyse(depth, [box], W, H) is None


def test_ground_falling_away_is_a_drop():
    depth = _ground_ramp()
    # Beyond a step down, the ground ahead is much farther than expected.
    depth[:84, :] = np.minimum(depth[:84, :], 0.12)
    finding = analyse(depth, [], W, H)
    assert finding is not None
    assert finding.kind == "drop"


def test_object_standing_on_ground_is_path_not_drop():
    depth = _ground_ramp()
    depth[55:95, 55:105] = 1.0
    finding = analyse(depth, [], W, H)
    assert finding is not None
    assert finding.kind == "path"


def test_object_in_path_explained_by_detector_box_is_quiet():
    depth = _ground_ramp()
    depth[55:95, 55:105] = 1.0
    box = Box("pole", 2, 0.8, 50, 50, 110, 100)
    assert analyse(depth, [box], W, H) is None


def test_flat_map_is_quiet():
    assert analyse(np.full((H, W), 0.5), [], W, H) is None


def test_boxes_are_scaled_from_frame_pixels_to_map():
    depth = _ground_ramp()
    depth[5:45, 55:105] = 0.95
    # Same box as above, expressed in a 640x480 frame.
    box = Box("person", 2, 0.9, 200, 0, 440, 200)
    assert analyse(depth, [box], 640, 480) is None


def test_confirm_needs_two_passes_of_the_same_kind():
    head = DepthFinding("head", 0.5)
    drop = DepthFinding("drop", 0.5)
    out, state = confirm(head, ConfirmState())
    assert out is None
    out, state = confirm(head, state)
    assert out == head
    out, state = confirm(drop, state)
    assert out is None
    out, state = confirm(None, state)
    assert out is None and state == ConfirmState()


def test_ground_hidden_by_a_detected_person_gives_no_depth_finding():
    """Bench case: the person at the webcam fills the bottom; their outline is not a drop."""
    depth = np.full((H, W), 0.1)
    depth[30:, 30:130] = 0.9  # person, near, from mid-frame to the bottom
    box = Box("person", 2, 0.9, 30, 30, 130, 120)
    assert analyse(depth, [box], W, H) is None

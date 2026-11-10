import numpy as np

from yolo import letterbox, predictions_to_boxes


def _empty_output() -> np.ndarray:
    return np.zeros((1, 84, 8400))


def _set_column(
    output: np.ndarray,
    col: int,
    cx: float,
    cy: float,
    width: float,
    height: float,
    class_id: int,
    score: float,
) -> None:
    output[0, 0, col] = cx
    output[0, 1, col] = cy
    output[0, 2, col] = width
    output[0, 3, col] = height
    output[0, 4 + class_id, col] = score


def _letter_640x480():
    image = np.zeros((480, 640, 3), dtype=np.uint8)
    return letterbox(image)


def test_person_kept_chair_discarded():
    letter = _letter_640x480()
    output = _empty_output()
    _set_column(output, 0, cx=90, cy=460, width=100, height=160, class_id=0, score=0.9)
    _set_column(output, 1, cx=500, cy=120, width=40, height=40, class_id=56, score=0.99)

    boxes = predictions_to_boxes(output, letter)

    assert len(boxes) == 1
    box = boxes[0]
    assert box.class_name == "person"
    assert box.rank == 2
    assert box.confidence == 0.9
    assert abs(box.x0 - 40) < 1
    assert abs(box.y0 - 300) < 1
    assert abs(box.x1 - 140) < 1
    assert abs(box.y1 - 460) < 1


def test_overlapping_persons_nms_keeps_higher_score():
    letter = _letter_640x480()
    output = _empty_output()
    _set_column(output, 0, cx=90, cy=460, width=100, height=160, class_id=0, score=0.9)
    _set_column(output, 1, cx=100, cy=460, width=100, height=160, class_id=0, score=0.6)

    boxes = predictions_to_boxes(output, letter)

    assert len(boxes) == 1
    assert boxes[0].confidence == 0.9
    assert boxes[0].class_name == "person"


def test_person_below_confidence_is_dropped():
    letter = _letter_640x480()
    output = _empty_output()
    _set_column(output, 0, cx=90, cy=460, width=100, height=160, class_id=0, score=0.2)

    boxes = predictions_to_boxes(output, letter)

    assert boxes == []


def test_letterbox_maps_network_center_to_original_center():
    image = np.zeros((480, 640, 3), dtype=np.uint8)
    letter = letterbox(image)

    assert letter.scale == 1
    assert letter.pad_x == 0
    assert letter.pad_y == 80
    assert letter.image.shape == (640, 640, 3)

    output = _empty_output()
    _set_column(output, 0, cx=320, cy=320, width=20, height=20, class_id=0, score=0.9)
    boxes = predictions_to_boxes(output, letter)

    assert len(boxes) == 1
    center_x = (boxes[0].x0 + boxes[0].x1) / 2
    center_y = (boxes[0].y0 + boxes[0].y1) / 2
    assert abs(center_x - 320) < 1
    assert abs(center_y - 240) < 1

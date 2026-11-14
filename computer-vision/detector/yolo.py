from dataclasses import dataclass

import numpy as np

from policy import Box
from vocab import COCO, ClassInfo, Vocabulary

CONFIDENCE_MIN = 0.45
NMS_IOU = 0.5
LETTERBOX_FILL = 114


@dataclass
class Letterbox:
    image: np.ndarray
    scale: float
    pad_x: float
    pad_y: float
    source_width: int
    source_height: int


def letterbox(image: np.ndarray, size: int = 640) -> Letterbox:
    height, width = image.shape[:2]
    scale = size / max(height, width)
    new_w = int(round(width * scale))
    new_h = int(round(height * scale))
    pad_x = (size - new_w) / 2
    pad_y = (size - new_h) / 2
    resized = _resize_nearest(image, new_h, new_w)
    canvas = np.full((size, size, 3), LETTERBOX_FILL, dtype=np.uint8)
    left = int(round(pad_x))
    top = int(round(pad_y))
    canvas[top : top + new_h, left : left + new_w] = resized
    return Letterbox(
        image=canvas,
        scale=scale,
        pad_x=pad_x,
        pad_y=pad_y,
        source_width=width,
        source_height=height,
    )


def predictions_to_boxes(
    output: np.ndarray, letter: Letterbox, vocab: Vocabulary = COCO
) -> list[Box]:
    """Turn a raw detector tensor into walker boxes in source-frame pixels.

    Accepts the one-to-many head ``[1, 4 + K, N]`` (cx, cy, w, h, K scores;
    NMS applied here) and the end-to-end head ``[1, M, 6]``
    (x0, y0, x1, y1, score, class), both in letterboxed network pixels.
    """
    pred = np.asarray(output, dtype=np.float32)
    if pred.ndim == 3:
        pred = pred[0]
    if pred.ndim != 2:
        return []
    if pred.shape[1] == 6 and pred.shape[0] != 4 + vocab.size:
        return _end_to_end_boxes(pred, letter, vocab)
    scores = pred[4:]
    if scores.shape[0] == 0:
        return []
    class_ids = scores.argmax(axis=0)
    confidences = scores[class_ids, np.arange(scores.shape[1])]
    candidates: list[Box] = []
    for index in np.nonzero(confidences >= CONFIDENCE_MIN)[0]:
        info = vocab.lookup(int(class_ids[index]))
        if info is None:
            continue
        cx, cy, w, h = (float(v) for v in pred[:4, index])
        x0, y0, x1, y1 = _map_corners(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2, letter)
        candidates.append(_make_box(info, float(confidences[index]), x0, y0, x1, y1))
    return _nms(candidates)


def _end_to_end_boxes(pred: np.ndarray, letter: Letterbox, vocab: Vocabulary) -> list[Box]:
    boxes: list[Box] = []
    for row in pred:
        confidence = float(row[4])
        if confidence < CONFIDENCE_MIN:
            continue
        info = vocab.lookup(int(row[5]))
        if info is None:
            continue
        x0, y0, x1, y1 = _map_corners(*(float(v) for v in row[:4]), letter)
        boxes.append(_make_box(info, confidence, x0, y0, x1, y1))
    return _nms(boxes)


def _make_box(info: ClassInfo, confidence: float, x0: float, y0: float, x1: float, y1: float) -> Box:
    return Box(
        class_name=info.class_name,
        rank=info.rank,
        confidence=round(confidence, 3),
        x0=x0,
        y0=y0,
        x1=x1,
        y1=y1,
        mover=info.mover,
    )


def _resize_nearest(image: np.ndarray, new_h: int, new_w: int) -> np.ndarray:
    src_h, src_w = image.shape[:2]
    if src_h == new_h and src_w == new_w:
        return image
    row_idx = np.minimum((np.arange(new_h) * src_h) // new_h, src_h - 1)
    col_idx = np.minimum((np.arange(new_w) * src_w) // new_w, src_w - 1)
    return image[row_idx[:, None], col_idx]


def _map_corners(
    x0: float, y0: float, x1: float, y1: float, letter: Letterbox
) -> tuple[float, float, float, float]:
    def unmap(x: float, y: float) -> tuple[float, float]:
        sx = (x - letter.pad_x) / letter.scale
        sy = (y - letter.pad_y) / letter.scale
        sx = min(max(sx, 0.0), float(letter.source_width))
        sy = min(max(sy, 0.0), float(letter.source_height))
        return sx, sy

    a = unmap(x0, y0)
    b = unmap(x1, y1)
    return a[0], a[1], b[0], b[1]


def _iou(a: Box, b: Box) -> float:
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


def _nms(boxes: list[Box]) -> list[Box]:
    ordered = sorted(boxes, key=lambda box: box.confidence, reverse=True)
    kept: list[Box] = []
    for box in ordered:
        if any(_iou(box, other) >= NMS_IOU for other in kept):
            continue
        kept.append(box)
    return kept

from dataclasses import dataclass

import numpy as np

from labels import walker_class
from policy import Box

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


def predictions_to_boxes(output: np.ndarray, letter: Letterbox) -> list[Box]:
    pred = np.asarray(output)
    if pred.ndim == 3:
        pred = pred[0]
    candidates: list[Box] = []
    for index in range(pred.shape[1]):
        scores = pred[4:, index]
        class_id = int(scores.argmax())
        confidence = float(scores[class_id])
        if confidence < CONFIDENCE_MIN:
            continue
        mapped = walker_class(class_id)
        if mapped is None:
            continue
        class_name, rank, _spoken = mapped
        x0, y0, x1, y1 = _map_box(
            float(pred[0, index]),
            float(pred[1, index]),
            float(pred[2, index]),
            float(pred[3, index]),
            letter,
        )
        candidates.append(
            Box(
                class_name=class_name,
                rank=rank,
                confidence=confidence,
                x0=x0,
                y0=y0,
                x1=x1,
                y1=y1,
            )
        )
    return _nms(candidates)


def _resize_nearest(image: np.ndarray, new_h: int, new_w: int) -> np.ndarray:
    src_h, src_w = image.shape[:2]
    if src_h == new_h and src_w == new_w:
        return image
    row_idx = np.minimum((np.arange(new_h) * src_h) // new_h, src_h - 1)
    col_idx = np.minimum((np.arange(new_w) * src_w) // new_w, src_w - 1)
    return image[row_idx[:, None], col_idx]


def _map_box(
    cx: float,
    cy: float,
    width: float,
    height: float,
    letter: Letterbox,
) -> tuple[float, float, float, float]:
    x_center = (cx - letter.pad_x) / letter.scale
    y_center = (cy - letter.pad_y) / letter.scale
    box_w = width / letter.scale
    box_h = height / letter.scale
    x0 = x_center - box_w / 2
    y0 = y_center - box_h / 2
    x1 = x_center + box_w / 2
    y1 = y_center + box_h / 2
    x0 = min(max(x0, 0.0), float(letter.source_width))
    x1 = min(max(x1, 0.0), float(letter.source_width))
    y0 = min(max(y0, 0.0), float(letter.source_height))
    y1 = min(max(y1, 0.0), float(letter.source_height))
    return x0, y0, x1, y1


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

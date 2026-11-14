"""Detector class vocabularies: what each output index means to a walker.

Two vocabularies exist. ``COCO`` is used by the stock YOLO26n / YOLO11n
weights. ``WALK`` is the list of text prompts baked into the exported YOLOE
model; its order is the model's class order, so the export script imports
this list and the runtime checks the exported prompt file against it.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class ClassInfo:
    class_name: str
    rank: int
    spoken: str
    mover: bool


@dataclass(frozen=True)
class Vocabulary:
    name: str
    by_index: dict[int, ClassInfo]
    size: int

    def lookup(self, index: int) -> ClassInfo | None:
        return self.by_index.get(index)


_VEHICLE = ClassInfo("vehicle", 3, "Vehicle", True)
_BIKE = ClassInfo("bike", 3, "Bike", True)
_SCOOTER = ClassInfo("scooter", 3, "Scooter", True)
_PERSON = ClassInfo("person", 2, "Person", True)
_DOG = ClassInfo("dog", 2, "Dog", True)
_POLE = ClassInfo("pole", 2, "Pole", False)
_BARRIER = ClassInfo("barrier", 2, "Barrier", False)
_HYDRANT = ClassInfo("hydrant", 2, "Hydrant", False)
_BIN = ClassInfo("bin", 2, "Bin", False)
_BENCH = ClassInfo("bench", 2, "Bench", False)
_BRANCH = ClassInfo("branch", 2, "Branch", False)
_CAR_DOOR = ClassInfo("car_door", 3, "Car door", False)
_BAG = ClassInfo("bag", 1, "Bag", False)

COCO = Vocabulary(
    name="coco",
    by_index={
        0: _PERSON,
        1: _BIKE,
        2: _VEHICLE,
        3: _BIKE,
        5: _VEHICLE,
        7: _VEHICLE,
        10: _HYDRANT,
        13: _BENCH,
        16: _DOG,
        24: _BAG,
        26: _BAG,
        28: _BAG,
    },
    size=80,
)

# (prompt, meaning). Order is the exported YOLOE class order.
WALK_PROMPTS: list[tuple[str, ClassInfo]] = [
    ("car", _VEHICLE),
    ("bus", _VEHICLE),
    ("truck", _VEHICLE),
    ("bicycle", _BIKE),
    ("motorcycle", _BIKE),
    ("electric scooter", _SCOOTER),
    ("person", _PERSON),
    ("dog", _DOG),
    ("pole", _POLE),
    ("bollard", _POLE),
    ("sign post", _POLE),
    ("traffic cone", _BARRIER),
    ("construction barrier", _BARRIER),
    ("fire hydrant", _HYDRANT),
    ("trash can", _BIN),
    ("bench", _BENCH),
    ("tree branch", _BRANCH),
    ("open car door", _CAR_DOOR),
]

WALK = Vocabulary(
    name="walk",
    by_index={index: info for index, (_prompt, info) in enumerate(WALK_PROMPTS)},
    size=len(WALK_PROMPTS),
)

SPOKEN_BY_CLASS: dict[str, str] = {
    info.class_name: info.spoken
    for info in [*COCO.by_index.values(), *WALK.by_index.values()]
}


def walk_prompts() -> list[str]:
    return [prompt for prompt, _info in WALK_PROMPTS]


def prompts_match(prompt_file: Path) -> bool:
    """True when an exported model's prompt file lists exactly ``WALK_PROMPTS``."""
    try:
        data = json.loads(prompt_file.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return False
    return isinstance(data, dict) and data.get("prompts") == walk_prompts()

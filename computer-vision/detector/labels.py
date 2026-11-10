_WALKER_BY_COCO_ID: dict[int, tuple[str, int, str]] = {
    0: ("person", 2, "Person"),
    1: ("bike", 2, "Bike"),
    2: ("vehicle", 3, "Vehicle"),
    3: ("bike", 2, "Bike"),
    5: ("vehicle", 3, "Vehicle"),
    7: ("vehicle", 3, "Vehicle"),
    16: ("dog", 2, "Dog"),
    24: ("bag", 1, "Bag"),
    26: ("bag", 1, "Bag"),
    28: ("bag", 1, "Bag"),
}


def walker_class(coco_id: int) -> tuple[str, int, str] | None:
    return _WALKER_BY_COCO_ID.get(coco_id)

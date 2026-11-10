import pytest

from labels import walker_class

VEHICLE = ("vehicle", 3, "Vehicle")
PERSON = ("person", 2, "Person")
BIKE = ("bike", 2, "Bike")
DOG = ("dog", 2, "Dog")
BAG = ("bag", 1, "Bag")


@pytest.mark.parametrize(
    "coco_id, expected",
    [
        (0, PERSON),
        (1, BIKE),
        (2, VEHICLE),
        (3, BIKE),
        (5, VEHICLE),
        (7, VEHICLE),
        (16, DOG),
        (24, BAG),
        (26, BAG),
        (28, BAG),
    ],
)
def test_walker_class_returns_table_entry(coco_id: int, expected: tuple[str, int, str]):
    assert walker_class(coco_id) == expected


@pytest.mark.parametrize("coco_id", [9, 56, 62])
def test_walker_class_returns_none_for_out_of_table_ids(coco_id: int):
    assert walker_class(coco_id) is None

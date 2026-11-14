from policy import Box
from tracker import Tracker


def _person(x0: float, y0: float, x1: float, y1: float) -> Box:
    return Box("person", 2, 0.9, x0, y0, x1, y1, mover=True)


def test_steady_box_is_confirmed_but_not_approaching():
    tracker = Tracker()
    views = []
    for step in range(8):
        views = tracker.update([_person(100, 200, 200, 400)], step * 0.125)
    assert len(views) == 1
    assert views[0].confirmed
    assert views[0].approaching is False
    assert views[0].seconds_to_contact is None


def test_growing_box_is_approaching_with_seconds_to_contact():
    tracker = Tracker()
    views = []
    # Height grows 100 -> 150 over 1.0 s: growth 1.5, contact about 2 s away.
    for step in range(9):
        t = step * 0.125
        h = 100 + 50 * (t / 1.0)
        views = tracker.update([_person(100, 400 - h, 200, 400)], t)
    view = views[0]
    assert view.approaching is True
    assert 1.5 < view.seconds_to_contact < 2.5


def test_two_people_keep_separate_ids():
    tracker = Tracker()
    left = _person(0, 200, 100, 400)
    right = _person(500, 200, 600, 400)
    first = tracker.update([left, right], 0.0)
    second = tracker.update([right, left], 0.125)
    ids_first = {round(v.box.x0): v.track_id for v in first}
    ids_second = {round(v.box.x0): v.track_id for v in second}
    assert ids_first == ids_second


def test_unseen_track_expires_and_restarts_count():
    tracker = Tracker()
    for step in range(4):
        tracker.update([_person(100, 200, 200, 400)], step * 0.125)
    tracker.update([], 0.5)
    views = tracker.update([_person(100, 200, 200, 400)], 1.2)
    assert views[0].hits == 1
    assert not views[0].confirmed


def test_different_class_does_not_match():
    tracker = Tracker()
    tracker.update([_person(100, 200, 200, 400)], 0.0)
    dog = Box("dog", 2, 0.9, 100, 200, 200, 400, mover=True)
    views = tracker.update([dog], 0.125)
    assert views[0].hits == 1


def test_jittery_box_of_a_still_person_is_not_approaching():
    tracker = Tracker()
    heights = [100, 118, 99, 101, 120, 100, 98, 119, 100]
    views = []
    for step, h in enumerate(heights):
        views = tracker.update([_person(100, 400 - h, 200, 400)], step * 0.125)
    assert views[0].approaching is False

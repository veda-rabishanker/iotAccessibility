import json

from vocab import COCO, SPOKEN_BY_CLASS, WALK, prompts_match, walk_prompts


def test_coco_keeps_walker_classes_and_drops_clutter():
    assert COCO.lookup(0).class_name == "person"
    assert COCO.lookup(2).class_name == "vehicle"
    assert COCO.lookup(10).class_name == "hydrant"
    assert COCO.lookup(56) is None  # chair
    assert COCO.lookup(9) is None  # traffic light


def test_walk_order_matches_prompts():
    prompts = walk_prompts()
    assert len(prompts) == WALK.size
    assert WALK.lookup(prompts.index("bollard")).class_name == "pole"
    assert WALK.lookup(prompts.index("electric scooter")).mover is True
    assert WALK.lookup(prompts.index("traffic cone")).mover is False
    assert WALK.lookup(WALK.size) is None


def test_every_class_has_a_spoken_name():
    for vocab in (COCO, WALK):
        for info in vocab.by_index.values():
            assert SPOKEN_BY_CLASS[info.class_name] == info.spoken


def test_prompt_file_must_match_exactly(tmp_path):
    good = tmp_path / "good.json"
    good.write_text(json.dumps({"prompts": walk_prompts()}), encoding="utf-8")
    bad = tmp_path / "bad.json"
    bad.write_text(json.dumps({"prompts": walk_prompts()[:-1]}), encoding="utf-8")
    assert prompts_match(good)
    assert not prompts_match(bad)
    assert not prompts_match(tmp_path / "missing.json")

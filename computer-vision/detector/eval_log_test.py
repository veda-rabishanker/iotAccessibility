import json
import time

from eval_log import EvalLog
from policy import Cue


def _lines(tmp_path):
    files = list(tmp_path.glob("eval-*.jsonl"))
    assert len(files) == 1
    return [json.loads(line) for line in files[0].read_text(encoding="utf-8").splitlines()]


def test_spoken_cue_and_marks_are_logged(tmp_path):
    log = EvalLog(tmp_path)
    cue = Cue("obstacle", "Pole ahead. Pass on the right.", "pass", "center", "pole",
              confidence=0.7, distance="near", source="detector", timestamp=time.time())
    log.cue(cue, "yoloe", "webcam")
    assert log.mark("false-alert", cue, "yoloe", "webcam")
    assert log.mark("missed", None, "yoloe", "webcam")

    lines = _lines(tmp_path)
    assert [line["event"] for line in lines] == ["cue", "false-alert", "missed"]
    assert lines[0]["cue"]["speech"] == "Pole ahead. Pass on the right."
    assert lines[1]["last_cue"]["class_name"] == "pole"
    assert lines[2]["last_cue"] is None


def test_quiet_cues_and_unknown_marks_are_not_logged(tmp_path):
    log = EvalLog(tmp_path)
    log.cue(Cue("quiet", "", "clear", None, None), "yolo26n", "webcam")
    assert not log.mark("bogus", None, "yolo26n", "webcam")
    assert list(tmp_path.glob("*.jsonl")) == []

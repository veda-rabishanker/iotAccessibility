import cv2
import numpy as np

from pipeline import MjpegReader


def _jpeg(value: int) -> bytes:
    image = np.full((8, 8, 3), value, dtype=np.uint8)
    return cv2.imencode(".jpg", image)[1].tobytes()


class _FakeResponse:
    def __init__(self, chunks: list[bytes]) -> None:
        self._chunks = chunks

    def read1(self, _size: int) -> bytes:
        return self._chunks.pop(0) if self._chunks else b""

    def close(self) -> None:
        pass


def _part(jpeg: bytes) -> bytes:
    return b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + jpeg + b"\r\n"


def _reader(chunks: list[bytes]) -> MjpegReader:
    reader = MjpegReader.__new__(MjpegReader)
    reader._response = _FakeResponse(chunks)
    reader._buffer = b""
    return reader


def test_backlog_of_frames_returns_only_the_newest():
    old, mid, new = _jpeg(10), _jpeg(120), _jpeg(240)
    reader = _reader([_part(old) + _part(mid) + _part(new)])
    ok, frame = reader.read()
    assert ok
    assert abs(int(frame.mean()) - 240) < 5
    # The stale frames are gone; nothing more to read.
    assert reader.read() == (False, None)


def test_partial_next_frame_is_kept_for_the_next_read():
    first, second = _jpeg(50), _jpeg(200)
    split = len(_part(second)) // 2
    reader = _reader([_part(first) + _part(second)[:split], _part(second)[split:]])
    ok, frame = reader.read()
    assert ok and abs(int(frame.mean()) - 50) < 5
    ok, frame = reader.read()
    assert ok and abs(int(frame.mean()) - 200) < 5

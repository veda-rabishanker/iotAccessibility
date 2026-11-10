import numpy as np

from quality import frame_is_usable


def test_black_frame_is_not_usable():
    gray = np.zeros((10, 10), dtype=np.uint8)
    assert frame_is_usable(gray) is False


def test_white_frame_is_not_usable():
    gray = np.full((10, 10), 255, dtype=np.uint8)
    assert frame_is_usable(gray) is False


def test_flat_mid_gray_is_not_usable():
    gray = np.full((10, 10), 128, dtype=np.uint8)
    assert frame_is_usable(gray) is False


def test_noisy_mid_gray_is_usable():
    gray = np.tile(np.array([[100, 156]], dtype=np.uint8), (10, 10))
    assert 25 <= float(gray.mean()) <= 235
    assert float(gray.std()) >= 8
    assert frame_is_usable(gray) is True

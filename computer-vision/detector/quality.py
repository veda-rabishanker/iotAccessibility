import numpy as np


def frame_is_usable(gray: np.ndarray) -> bool:
    mean = float(gray.mean())
    if mean < 25 or mean > 235:
        return False
    if float(gray.std()) < 8:
        return False
    return True

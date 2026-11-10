import sys

import cv2


def open_webcam(index: int = 0) -> cv2.VideoCapture:
    """Open a camera index. On Windows try DirectShow first, then the default."""
    if sys.platform == "win32":
        capture = cv2.VideoCapture(index, cv2.CAP_DSHOW)
        if capture.isOpened():
            return capture
        capture.release()
    return cv2.VideoCapture(index)

"""Map capture/inference state to quiet cue reasons."""


def quiet_failure_reason(*, has_frame: bool, camera_opened: bool) -> str:
    """Choose the reason for a failed or skipped inference tick (webcam or ESP32)."""
    if has_frame and camera_opened:
        return "model-missing"
    return "camera-missing"

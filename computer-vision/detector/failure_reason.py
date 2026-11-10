"""Map capture/inference state to quiet cue reasons (no policy changes)."""


def quiet_failure_reason(*, source: str, has_frame: bool, camera_opened: bool) -> str:
    """Choose reason for a failed or skipped inference tick."""
    if source == "esp32":
        return "esp32"
    if has_frame and camera_opened:
        return "model-missing"
    return "camera-missing"

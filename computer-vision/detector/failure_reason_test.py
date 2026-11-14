from failure_reason import quiet_failure_reason


def test_no_frame_is_camera_missing() -> None:
    assert quiet_failure_reason(has_frame=False, camera_opened=False) == "camera-missing"
    assert quiet_failure_reason(has_frame=False, camera_opened=True) == "camera-missing"


def test_frame_but_failed_inference_is_model_missing() -> None:
    assert quiet_failure_reason(has_frame=True, camera_opened=True) == "model-missing"

from failure_reason import quiet_failure_reason


def test_esp32_never_camera_missing() -> None:
    assert quiet_failure_reason(source="esp32", has_frame=False, camera_opened=False) == "esp32"
    assert quiet_failure_reason(source="esp32", has_frame=True, camera_opened=True) == "esp32"


def test_webcam_no_frame_is_camera_missing() -> None:
    assert (
        quiet_failure_reason(source="webcam", has_frame=False, camera_opened=False)
        == "camera-missing"
    )
    assert (
        quiet_failure_reason(source="webcam", has_frame=False, camera_opened=True)
        == "camera-missing"
    )


def test_webcam_with_frame_is_model_missing() -> None:
    assert (
        quiet_failure_reason(source="webcam", has_frame=True, camera_opened=True)
        == "model-missing"
    )


def test_webcam_frame_but_not_opened_is_camera_missing() -> None:
    assert (
        quiet_failure_reason(source="webcam", has_frame=True, camera_opened=False)
        == "camera-missing"
    )

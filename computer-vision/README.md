# Computer vision

Separate from the Strider Expo app. This folder is the collar camera pipeline on the bench: an AI-Thinker ESP32-CAM can stream MJPEG over Wi-Fi, and a local page on the computer can show that stream or the laptop webcam.

The webcam is a bench stand-in for the collar camera. It is the right way to watch the detector. It is the wrong way to claim the collar works on a street. The page shows one walking cue. It does not report distances, say a crosswalk is safe, or invent curb depth.

## Layout

- [`firmware/`](firmware/README.md) — Arduino sketch. First flash starts a hotspot named `Strider-CAM` (password `strider-cam`) and serves `http://192.168.4.1/stream`.
- [`viewer/`](viewer/README.md) — Python page that shows the laptop webcam cue or proxies the ESP32 stream into the browser.
- [`detector/`](detector/) — walking-cue policy, picture gate, YOLO parse, and the webcam loop. Weights live in `detector/weights/` and are gitignored.

## Install

From the repository root:

```bash
python -m pip install -r computer-vision/requirements.txt
python computer-vision/detector/download_model.py
```

`download_model.py` fetches Ultralytics YOLOv8n ONNX into `computer-vision/detector/weights/yolov8n.onnx` and checks a pinned SHA256. That folder is gitignored. Do not commit the `.onnx` file.

## Watch the webcam cue

From the repository root:

```bash
python computer-vision/viewer/server.py
```

Open http://127.0.0.1:8080. Webcam is selected on load. The page draws detector boxes and one cue line.

## Modes

The control uses the same three names as the app. The detector policy does not change with the mode.

- **General guidance** — one walking cue from the policy, or a quiet line when the picture is clear, unsteady, or the camera or weights are missing.
- **Crosswalk assistance** — always `Crosswalk lining-up is not estimated from this camera.` Obstacle speech may still appear under that sentence. The page does not say a crossing is safe and does not draw a crossing direction.
- **Depth perception** — always `Steps, curbs, and drop-offs are not estimated from this camera.` Obstacle speech may still appear under that sentence. The page does not show a number of feet or meters.

## Watch the ESP32 camera

1. Flash `firmware/esp32_cam_stream` (see the firmware README). GPIO0 must be grounded only while uploading.
2. Join the `Strider-CAM` Wi-Fi from this computer, or put your home Wi-Fi into `config.h` and flash again.
3. Start the viewer as above and choose ESP32. The video stage loads `http://192.168.4.1/stream` through the local proxy.

If the board is already running Espressif's CameraWebServer, skip the flash and type its stream address in the page, usually `http://<camera-ip>:81/stream`.

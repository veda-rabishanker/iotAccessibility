# Computer vision

Separate from the Strider Expo app. This folder is the collar camera: an AI-Thinker ESP32-CAM streams MJPEG over Wi-Fi, and a local page on the computer shows that stream.

Nothing here is wired into `src/` yet. Detection comes later. This pass is the live picture only.

## Layout

- [`firmware/`](firmware/README.md) — Arduino sketch. First flash starts a hotspot named `Strider-CAM` (password `strider-cam`) and serves `http://192.168.4.1/stream`.
- [`viewer/`](viewer/README.md) — Python page that proxies that stream into the browser. No extra packages.

## Watch the camera

1. Flash `firmware/esp32_cam_stream` (see the firmware README). GPIO0 must be grounded only while uploading.
2. Join the `Strider-CAM` Wi-Fi from this computer, or put your home Wi-Fi into `config.h` and flash again.
3. From the repository root:

```bash
python computer-vision/viewer/server.py
```

4. Open http://127.0.0.1:8080. The video stage loads `http://192.168.4.1/stream` through the local proxy.

If the board is already running Espressif's CameraWebServer, skip the flash and type its stream address in the page, usually `http://<camera-ip>:81/stream`.

# Strider vision viewer

Local page for watching the walking cue from the laptop webcam or the collar ESP32-CAM. The webcam is a bench stand-in for the collar camera. A small Python server runs the detector and depth models on either source and serves the annotated frames and the cue.

## Install

See [`../README.md`](../README.md#install): install `requirements.txt`, run `detector/download_model.py` for the depth model, and export the detectors with `tools/export_models.py`. The server still starts if any weight file is missing or no webcam opens; the cue line says what is missing.

## Run

From the viewer folder:

```bash
python server.py
```

From the repository root:

```bash
python computer-vision/viewer/server.py
```

The server prints `Viewer at http://127.0.0.1:8080`. Open that address in a browser.

The viewer listens on `127.0.0.1` only. Stop it with Ctrl+C. Webcam index 0 is the default source. General guidance is the default mode.

## What the page does

- **Video source** — Webcam or ESP32. Both run the detector and depth models, and the page loads the annotated frames from `/webcam`. The ESP32 allows one stream connection, so the raw `/stream` proxy is not opened while the detector reads it.
- **Detector** — YOLOE-26n with Strider's hazard words (default) or YOLO26n (COCO). Switch live to compare.
- **View** — Boxes, or Depth (near is bright/warm, far is dark). The two grey lines mark the walking corridor the depth check looks at.
- **Guidance mode** — General guidance, Crosswalk assistance, and Depth perception. It changes the page copy only.
- **Cue line** — one line from `GET /api/cue`, refreshed twice a second. Under it: distance bucket, confidence, whether the cue came from the detector or depth, and model timings.
- **Speak cues** — reads each new cue aloud with the browser's speech. The browser needs one click before it may speak.
- **False alert / Missed it** — writes a mark to the evaluation log with the last spoken cue.

When nothing is cued, General guidance shows `No obstacle detected. Keep using your cane.` The page never says the path is clear, never reports feet or metres, and never says a crosswalk is safe.

API: `GET /api/cue`, `GET /api/detectors`, `POST /api/source`, `POST /api/mode`, `POST /api/detector {"name"}`, `POST /api/view {"overlay": "boxes"|"depth"}`, `POST /api/mark {"kind": "false-alert"|"missed"}`.

## Camera address

The default ESP32 camera is `http://192.168.4.1:81/stream`. That is the Strider-CAM SoftAP: the camera is at `192.168.4.1` and the Wi-Fi name is `Strider-CAM`.

The computer has to be on the same network as the camera. For the default address, join the `Strider-CAM` Wi-Fi, then start the viewer and choose ESP32.

To point at another camera, type its address in the page and press Connect. Strider firmware and stock CameraWebServer both stream on port 81, so an address with no port or path gets `:81/stream` added:

- `http://172.20.10.3` becomes `http://172.20.10.3:81/stream`
- `http://strider-cam-3fa2.local` becomes `http://strider-cam-3fa2.local:81/stream`
- an address with a port or path is used as written, e.g. `http://192.168.1.20:8000` becomes `http://192.168.1.20:8000/stream`

You can also set the starting address before launch.

Windows PowerShell:

```powershell
$env:CAMERA_URL = "http://192.168.1.20:81/stream"
python server.py
```

Windows Command Prompt:

```bat
set CAMERA_URL=http://192.168.1.20:81/stream
python server.py
```

macOS or Linux:

```bash
CAMERA_URL=http://192.168.1.20:81/stream python server.py
```

## Port

The default port is 8080. Set `PORT` to use another one.

Windows PowerShell:

```powershell
$env:PORT = "8090"
python server.py
```

macOS or Linux:

```bash
PORT=8090 python server.py
```

## What the camera serves

Strider firmware:

- port 81 `GET /stream` — multipart MJPEG (`multipart/x-mixed-replace`, boundary `frame`)
- port 80 `GET /status` — JSON with `device`, `name`, `ip`, `mode`, `framesize`, `quality`, `stream_port`, `rssi`
- port 80 `GET /control?size=QVGA&quality=15` — change resolution and JPEG quality live

See [`../firmware/README.md`](../firmware/README.md#http-routes) for the full table.

The page loads `/webcam` for the laptop camera and `/stream` for the ESP32. The server reads the ESP32 camera and forwards the bytes. The page checks `/api/health` every few seconds on the ESP32 path and shows **Connecting**, **Live**, or **Camera unreachable**.

# Strider vision viewer

Local page for watching the laptop webcam detector and the collar ESP32-CAM. The webcam is a bench stand-in for the collar camera. A small Python server serves an annotated webcam MJPEG stream and still proxies the camera's MJPEG stream so the browser can show either on the same origin.

## Install

From the repository root:

```bash
python -m pip install -r computer-vision/requirements.txt
python computer-vision/detector/download_model.py
```

`download_model.py` writes `computer-vision/detector/weights/yolo11n.onnx` (Ultralytics YOLO11n ONNX; the YOLOv8n ONNX asset is not published). A 640 input yields `[1, 84, 8400]`, matching the parser tests. That directory is gitignored. The server still starts if the weight file is missing or no webcam opens.

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

- **Video source** — Webcam or ESP32. Webcam is selected on load and loads `/webcam`. ESP32 posts the camera address and loads `/stream`.
- **Guidance mode** — General guidance, Crosswalk assistance, and Depth perception. The mode label changes the page copy. It does not change the detector policy.
- **Cue line** — one text line from `GET /api/cue`, about once a second.

General guidance shows the policy speech, or `Nothing in your path.` when the way is clear. Crosswalk assistance always says lining-up is not estimated from this camera. Depth perception always says steps, curbs, and drop-offs are not estimated from this camera. The page does not report distances or say a crosswalk is safe.

## Camera address

The first-run ESP32 camera is `http://192.168.4.1/stream`. That is the Strider-CAM SoftAP: the camera is at `192.168.4.1` and the Wi-Fi name is `Strider-CAM`.

The computer has to be on the same network as the camera. For the default address, join the `Strider-CAM` Wi-Fi, then start the viewer and choose ESP32.

To point at another camera, type its address in the page and press Connect. A base URL and a full stream URL both work:

- `http://192.168.4.1` becomes `http://192.168.4.1/stream`
- `http://192.168.1.20:81/stream` is used as written (stock CameraWebServer often serves the stream on port 81)

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

- `GET /stream` — multipart MJPEG (`multipart/x-mixed-replace`, boundary `frame`)
- `GET /status` — JSON `{ok, ip, mode, framesize}`

The page loads `/webcam` for the laptop camera and `/stream` for the ESP32. The server reads the ESP32 camera and forwards the bytes. The page checks `/api/health` every few seconds on the ESP32 path and shows **Connecting**, **Live**, or **Camera unreachable**.

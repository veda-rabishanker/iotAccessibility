# Strider vision viewer

Local page for watching the collar ESP32-CAM while computer vision is coming up. A small Python server proxies the camera's MJPEG stream so the browser can show it on the same origin.

There are no dependencies and no `package.json`. Python 3 and its standard library are enough.

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

The viewer listens on `127.0.0.1` only. Stop it with Ctrl+C.

## Camera address

The first-run camera is `http://192.168.4.1/stream`. That is the Strider-CAM SoftAP: the camera is at `192.168.4.1` and the Wi-Fi name is `Strider-CAM`.

The computer has to be on the same network as the camera. For the default address, join the `Strider-CAM` Wi-Fi, then start the viewer.

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

The page loads `/stream` on this viewer. The server reads the camera and forwards the bytes. The page checks `/api/health` every few seconds and shows **Connecting**, **Live**, or **Camera unreachable**.

#!/usr/bin/env python3
"""Local web viewer that proxies an ESP32-CAM MJPEG stream.

Standard library only. Bind to 127.0.0.1 and forward the camera to the page
so the browser can show the stream without CORS.
"""

from __future__ import annotations

import json
import os
import sys
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit, urlunsplit

HOST = "127.0.0.1"
DEFAULT_CAMERA = "http://192.168.4.1"
STATIC_DIR = Path(__file__).resolve().parent / "static"
CHUNK_SIZE = 8192
STREAM_TIMEOUT = 10
PROBE_TIMEOUT = 2
FRAME_FRESH_SECONDS = 8

UNREACHABLE = (
    "Camera unreachable. Join the Strider-CAM Wi-Fi, or enter the camera address."
)

CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
}

# Direct connection. A machine-wide HTTP proxy must not swallow the camera.
OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))

CLIENT_GONE = (BrokenPipeError, ConnectionResetError, ConnectionAbortedError)


class CameraError(ValueError):
    """The user-supplied camera address cannot be used."""


def normalize_camera_url(raw: object) -> tuple[str, str]:
    """Return (stream_url, base_url) for a base URL or a full stream URL.

    An empty path or ``/`` means the stream is ``{origin}/stream``. Any other
    path is kept, so ``http://host:81/stream`` stays on port 81.
    """
    if not isinstance(raw, str):
        raise CameraError("Enter an http or https camera address.")
    text = raw.strip()
    if not text or any(char.isspace() for char in text):
        raise CameraError("Enter an http or https camera address.")

    parts = urlsplit(text)
    scheme = parts.scheme.lower()
    if scheme not in ("http", "https") or not parts.hostname:
        raise CameraError("Enter an http or https camera address.")

    path = parts.path or ""
    if len(path) > 1 and path.endswith("/"):
        path = path.rstrip("/")

    origin = urlunsplit((scheme, parts.netloc, "", "", ""))
    if path in ("", "/"):
        stream = origin + "/stream"
    else:
        stream = urlunsplit((scheme, parts.netloc, path, parts.query, ""))
    return stream, origin


class CameraTarget:
    """Thread-safe camera address and recent proxy activity."""

    def __init__(self, raw_url: str) -> None:
        stream, base = normalize_camera_url(raw_url)
        self._lock = threading.Lock()
        self._stream_url = stream
        self._base_url = base
        self._viewers = 0
        self._last_bytes = 0.0

    def get(self) -> tuple[str, str]:
        with self._lock:
            return self._stream_url, self._base_url

    def set_url(self, raw_url: object) -> tuple[str, str]:
        stream, base = normalize_camera_url(raw_url)
        with self._lock:
            self._stream_url = stream
            self._base_url = base
            self._last_bytes = 0.0
        return stream, base

    def begin_view(self) -> None:
        with self._lock:
            self._viewers += 1

    def end_view(self) -> None:
        with self._lock:
            if self._viewers:
                self._viewers -= 1

    def mark_bytes(self, stream_url: str) -> None:
        now = time.monotonic()
        with self._lock:
            if stream_url == self._stream_url:
                self._last_bytes = now

    def stream_is_fresh(self) -> bool:
        with self._lock:
            if self._last_bytes <= 0:
                return False
            return (time.monotonic() - self._last_bytes) <= FRAME_FRESH_SECONDS

    def viewing(self) -> bool:
        with self._lock:
            return self._viewers > 0


CAMERA = CameraTarget(DEFAULT_CAMERA)


def _request(url: str, close: bool) -> urllib.request.Request:
    headers = {
        "User-Agent": "StriderVisionViewer/1.0",
        "Accept": "*/*",
    }
    if close:
        headers["Connection"] = "close"
    return urllib.request.Request(url, headers=headers, method="GET")


def _set_socket_timeout(resp: object, seconds: float) -> None:
    """Keep a dead camera from blocking the proxy forever.

    ``urlopen(..., timeout=)`` already sets the timeout. Walk the response
    wrappers and set it again so a later read uses the same limit.
    """
    seen: set[int] = set()
    stack: list[object] = [resp]
    steps = 0
    while stack and steps < 16:
        current = stack.pop()
        steps += 1
        if current is None:
            continue
        marker = id(current)
        if marker in seen:
            continue
        seen.add(marker)
        setter = getattr(current, "settimeout", None)
        if callable(setter):
            try:
                setter(seconds)
            except OSError:
                pass
        for name in ("fp", "raw", "_sock", "sock", "_fp"):
            child = getattr(current, name, None)
            if child is not None and child is not current:
                stack.append(child)


def _json_dict(body: bytes) -> dict | None:
    try:
        parsed = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return None
    if isinstance(parsed, dict):
        return parsed
    return None


def _close_quietly(obj: object) -> None:
    closer = getattr(obj, "close", None)
    if not callable(closer):
        return
    try:
        closer()
    except OSError:
        pass


def _probe(url: str, limit: int) -> dict:
    request = _request(url, close=True)
    try:
        response = OPENER.open(request, timeout=PROBE_TIMEOUT)
    except Exception as exc:
        # HTTP errors are also responses and need their sockets closed.
        _close_quietly(exc)
        return {"ok": False, "body": b"", "error": exc}
    try:
        _set_socket_timeout(response, PROBE_TIMEOUT)
        code = int(getattr(response, "status", 0) or response.getcode() or 0)
        body = response.read(limit)
        return {"ok": 200 <= code < 300, "body": body, "error": None}
    except Exception as exc:
        return {"ok": False, "body": b"", "error": exc}
    finally:
        _close_quietly(response)


def _wait_for_frames(seconds: float) -> bool:
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        if CAMERA.stream_is_fresh():
            return True
        if not CAMERA.viewing():
            return False
        time.sleep(0.1)
    return CAMERA.stream_is_fresh()


def health_report() -> dict:
    """Probe the camera. Always return a JSON-ready dict."""
    try:
        stream_url, _base = CAMERA.get()
    except Exception:
        return {
            "ok": False,
            "streamUrl": "",
            "status": None,
            "detail": UNREACHABLE,
        }

    report = {
        "ok": False,
        "streamUrl": stream_url,
        "status": None,
        "detail": UNREACHABLE,
    }
    try:
        reached = CAMERA.stream_is_fresh()
        status_doc = None
        parts = urlsplit(stream_url)
        path = parts.path or ""
        if path.endswith("/stream"):
            origin = urlunsplit((parts.scheme, parts.netloc, "", "", ""))
            # Status is a short JSON body. Prefer it over opening a second
            # MJPEG connection, which ESP32-CAM firmwares often allow only once.
            probed = _probe(origin + "/status", 8192)
            if probed["ok"]:
                reached = True
                status_doc = _json_dict(probed["body"])
        if not reached and CAMERA.viewing():
            reached = _wait_for_frames(1.5)
        if not reached and not CAMERA.viewing():
            probed = _probe(stream_url, 1024)
            if probed["ok"]:
                reached = True
                if status_doc is None:
                    status_doc = _json_dict(probed["body"])
        report["ok"] = bool(reached)
        report["status"] = status_doc
        report["detail"] = "Camera is responding." if reached else UNREACHABLE
    except Exception:
        report["ok"] = False
        report["status"] = None
        report["detail"] = UNREACHABLE
    return report


def static_file(url_path: str) -> tuple[Path, str] | None:
    """Resolve a /static/... URL and refuse anything outside the static dir."""
    prefix = "/static/"
    if not url_path.startswith(prefix):
        return None
    relative = unquote(url_path[len(prefix) :])
    if not relative or relative.endswith("/") or "\x00" in relative:
        return None
    if relative.startswith(("/", "\\")):
        return None

    root = STATIC_DIR.resolve()
    try:
        candidate = (root / relative).resolve()
        candidate.relative_to(root)
    except (OSError, ValueError):
        return None
    if not candidate.is_file():
        return None
    media = CONTENT_TYPES.get(candidate.suffix.lower())
    if media is None:
        return None
    return candidate, media


class Handler(BaseHTTPRequestHandler):
    # HTTP/1.0 keeps the MJPEG body open without a Content-Length.
    protocol_version = "HTTP/1.0"
    server_version = "StriderVisionViewer/1.0"

    def do_GET(self) -> None:
        path = urlsplit(self.path).path
        try:
            if path == "/":
                self._serve_path(STATIC_DIR / "index.html", CONTENT_TYPES[".html"])
            elif path == "/stream":
                self._proxy_stream()
            elif path == "/api/health":
                self._send_json(200, health_report())
            elif path == "/api/camera":
                stream_url, base_url = CAMERA.get()
                self._send_json(200, {"streamUrl": stream_url, "baseUrl": base_url})
            elif path.startswith("/static/"):
                resolved = static_file(path)
                if resolved is None:
                    self._send_text(404, "Not found\n")
                else:
                    file_path, media = resolved
                    self._serve_path(file_path, media)
            else:
                self._send_text(404, "Not found\n")
        except CLIENT_GONE:
            return

    def do_POST(self) -> None:
        path = urlsplit(self.path).path
        try:
            if path != "/api/camera":
                self._send_text(404, "Not found\n")
                return
            self._set_camera()
        except CLIENT_GONE:
            return

    def _set_camera(self) -> None:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self._send_json(400, {"ok": False, "detail": "Expected a JSON body with a url."})
            return
        if length < 0 or length > 16384:
            self._send_json(400, {"ok": False, "detail": "Expected a JSON body with a url."})
            return
        raw = self.rfile.read(length) if length else b""
        try:
            data = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self._send_json(400, {"ok": False, "detail": "Expected a JSON body with a url."})
            return
        if not isinstance(data, dict) or not isinstance(data.get("url"), str):
            self._send_json(400, {"ok": False, "detail": "Expected a JSON body with a url."})
            return
        try:
            stream_url, base_url = CAMERA.set_url(data["url"])
        except CameraError as exc:
            self._send_json(400, {"ok": False, "detail": str(exc)})
            return
        self._send_json(200, {"streamUrl": stream_url, "baseUrl": base_url})

    def _proxy_stream(self) -> None:
        stream_url, _base = CAMERA.get()
        CAMERA.begin_view()
        upstream = None
        sent = False
        try:
            try:
                upstream = OPENER.open(_request(stream_url, close=False), timeout=STREAM_TIMEOUT)
            except Exception as exc:
                _close_quietly(exc)
                self._send_text(502, UNREACHABLE + "\n")
                return
            _set_socket_timeout(upstream, STREAM_TIMEOUT)
            content_type = _safe_content_type(upstream.headers.get("Content-Type", ""))
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Cache-Control", "no-store")
            self.send_header("Pragma", "no-cache")
            self.send_header("Connection", "close")
            self.end_headers()
            sent = True
            while True:
                chunk = upstream.read(CHUNK_SIZE)
                if not chunk:
                    break
                CAMERA.mark_bytes(stream_url)
                self.wfile.write(chunk)
                self.wfile.flush()
        except CLIENT_GONE:
            return
        except TimeoutError:
            if not sent:
                self._send_text(502, UNREACHABLE + "\n")
            return
        except OSError as exc:
            if sent or _client_disconnected(exc):
                return
            self._send_text(502, UNREACHABLE + "\n")
        except Exception:
            if sent:
                return
            try:
                self._send_text(502, UNREACHABLE + "\n")
            except CLIENT_GONE:
                return
        finally:
            CAMERA.end_view()
            _close_quietly(upstream)

    def _serve_path(self, file_path: Path, media: str) -> None:
        try:
            if not file_path.is_file():
                self._send_text(404, "Not found\n")
                return
            body = file_path.read_bytes()
        except OSError:
            self._send_text(404, "Not found\n")
            return
        self.send_response(200)
        self.send_header("Content-Type", media)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _send_json(self, code: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _send_text(self, code: int, message: str) -> None:
        body = message.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt: str, *args: object) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


def _safe_content_type(value: str) -> str:
    fallback = "multipart/x-mixed-replace; boundary=frame"
    if not value:
        return fallback
    cleaned = " ".join(value.replace("\r", " ").replace("\n", " ").split())
    if not cleaned or len(cleaned) > 240:
        return fallback
    return cleaned


def _client_disconnected(exc: BaseException) -> bool:
    if isinstance(exc, CLIENT_GONE):
        return True
    winerror = getattr(exc, "winerror", None)
    if winerror in (10053, 10054, 10038):
        return True
    number = getattr(exc, "errno", None)
    return number in (32, 54, 104, 10053, 10054)


class ViewerServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def handle_error(self, request: object, client_address: object) -> None:
        exc = sys.exc_info()[1]
        if isinstance(exc, CLIENT_GONE) or isinstance(exc, TimeoutError):
            return
        if isinstance(exc, OSError) and _client_disconnected(exc):
            return
        super().handle_error(request, client_address)


def _port_from_env() -> int:
    raw = os.environ.get("PORT", "").strip() or "8080"
    try:
        port = int(raw)
    except ValueError:
        raise SystemExit("PORT must be an integer.") from None
    if port < 1 or port > 65535:
        raise SystemExit("PORT must be between 1 and 65535.")
    return port


def main() -> None:
    raw_camera = os.environ.get("CAMERA_URL", "").strip() or DEFAULT_CAMERA
    try:
        stream_url, _base = CAMERA.set_url(raw_camera)
    except CameraError:
        raise SystemExit("CAMERA_URL must be an http or https address.") from None

    port = _port_from_env()
    try:
        server = ViewerServer((HOST, port), Handler)
    except OSError as exc:
        raise SystemExit(f"Could not bind http://{HOST}:{port}: {exc}") from exc

    print(f"Viewer at http://{HOST}:{port}", flush=True)
    print(f"Camera stream {stream_url}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("Stopping.", flush=True)
    finally:
        server.server_close()


if __name__ == "__main__":
    main()

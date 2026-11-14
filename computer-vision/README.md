# Computer vision

Separate from the Strider Expo app. This folder is the collar camera pipeline on the bench: an AI-Thinker ESP32-CAM streams MJPEG over Wi-Fi, and a local page on the computer turns either that stream or the laptop webcam into one walking cue.

The webcam is a bench stand-in for the collar camera. It is the right way to watch the pipeline. It is the wrong way to claim the collar works on a street. The page never reports distances in feet or metres, never says a crosswalk is safe, and never says the path is clear.

## How it works

Two pretrained models run side by side. Nothing is trained or labelled here.

```
frame -> picture check -+-> detector, 8 Hz -----> tracker --+
                        +-> depth, ~4 Hz -----> corridor ---+-> policy -> one cue -> page (text + speech)
                                                                               +-> eval log
```

- **Detector** says *what* is there. Choose on the page:
  - **YOLOE-26n (Strider words)** — default. Text prompts for walker hazards are baked in: vehicles, bikes, e-scooters, people, dogs, poles/bollards/sign posts, cones/barriers, hydrants, bins, benches, tree branches, open car doors. The list is `WALK_PROMPTS` in `detector/vocab.py`. Recall on rare words (bollard, branch, car door) is unmeasured.
  - **YOLO26n (COCO)** — vehicles, bikes, people, dogs, bags, hydrants, benches.
- **Depth Anything V2 Small** says *how close* everything is (relative, not metres). `detector/corridor.py` checks the middle 40% of the frame (the walking corridor, drawn as two grey lines) for:
  - **head** — something close in the upper part of the corridor.
  - **drop** — the ground ahead suddenly falls away (step, curb, hole).
  - **path** — something close in the corridor that no detector box explains.
- **Tracker** (`detector/tracker.py`) follows boxes across frames. A box counts after 3 matches. A mover whose box grows steadily is *approaching*, with a rough seconds-to-contact.
- **Policy** (`detector/policy.py`) cues one thing, highest priority first: approaching mover (< 3 s) → head height → drop → named obstacle in the path → unnamed obstacle. A cue is held 4 s; only a higher-priority cue may interrupt.

Each cue has `speech`, `reason`, `side`, `class_name`, `confidence`, `distance` (`near` / `very near`), `source` (`detector` / `depth`) and `timestamp`.

## Install

From `computer-vision/`:

```bash
python -m pip install -r requirements.txt
python detector/download_model.py          # Depth Anything V2 Small, ~99 MB, SHA256-pinned
```

The detectors are exported once with Ultralytics (export-time only; the viewer never imports it):

```bash
python -m venv tools/.venv-export
tools/.venv-export/Scripts/python -m pip install torch --index-url https://download.pytorch.org/whl/cpu
tools/.venv-export/Scripts/python -m pip install -r tools/requirements-export.txt
tools/.venv-export/Scripts/python tools/export_models.py
```

On macOS/Linux use `tools/.venv-export/bin/python`. This writes `detector/weights/yolo26n.onnx`, `yoloe26n_walk.onnx` and `yoloe26n_walk.json`. If you change `WALK_PROMPTS`, export again; the viewer refuses a YOLOE file whose prompts do not match.

`detector/weights/`, `logs/` and the export folders are gitignored.

Licences: Depth Anything V2 Small is Apache-2.0. YOLO26 and YOLOE are AGPL-3.0 (Ultralytics).

## Run

```bash
python viewer/server.py
```

Open http://127.0.0.1:8080. Webcam is selected on load. See [`viewer/README.md`](viewer/README.md) for the page controls.

## Bench timings (laptop CPU, Ryzen AI 9 HX 370)

| Model | Input | Time per frame |
|---|---|---|
| YOLOE-26n / YOLO26n | 640 | ~20–60 ms |
| Depth Anything V2 Small | 182 px short side | ~70–170 ms |
| Depth Anything V2 Small | 266 / 518 px | ~250 / ~920 ms (too slow) |

The page shows live timings under the cue.

## Known limits

- Laptop webcam ≠ chest camera. The head-height and drop thresholds in `corridor.py` are starting guesses and must be re-tuned on the collar.
- At a desk, the person in front of the webcam fills the bottom of the frame; depth checks are skipped when the "ground" area is inside a detector box.
- Monocular depth is weak on glass, mirrors, low light, and thin poles or branches.
- The picture check catches a covered lens, black frames and blown-out frames, not rain or motion blur.

## Evaluation log

Spoken cues and the **False alert** / **Missed it** buttons are appended to `logs/eval-YYYY-MM-DD.jsonl`, with the detector and camera that were in use.

## Layout

- [`firmware/`](firmware/README.md) — Arduino sketch. First flash starts a hotspot named `Strider-CAM` (password `strider-cam`) and serves `http://192.168.4.1/stream`.
- [`viewer/`](viewer/README.md) — the local page and server.
- [`detector/`](detector/) — capture, models, tracker, corridor check, policy, eval log. Tests: `python -m pytest detector -q` (no camera or weights needed).
- [`tools/`](tools/) — model export.

## Watch the ESP32 camera

1. Flash `firmware/esp32_cam_stream` (see the firmware README). GPIO0 must be grounded only while uploading.
2. Join the `Strider-CAM` Wi-Fi from this computer, or put your home Wi-Fi into `config.h` and flash again.
3. Start the viewer and choose ESP32. The detector reads `http://192.168.4.1/stream` and the page shows the annotated frames, the same as for the webcam.

If the board is already running Espressif's CameraWebServer, type its stream address in the page, usually `http://<camera-ip>:81/stream`.

# Depth + open-vocabulary obstacle detection — implementation plan

> Linear: ENG-24. Branch: `webcam-obstacle-detection`. Builds on `2026-11-10-webcam-obstacle-detection.md`.
> Do not start until approved. Each task lands as its own commit with tests.

**Goal:** Cover the hazards a cane misses (head-height objects, drop-offs, unnamed things in the path) and warn about approaching movers, with **no labelling and no training**. Two pretrained models run side by side: a detector for *what* is there and a depth model for *how close* everything is. Simple tracking cuts false alarms so a cue fires only for things in the path or coming closer.

**Why this shape:** the research report (`computer-vision/reports/Obstacle detection models for Strider.md`) found the top blind-walker hazards are head/chest-height protrusions, approaching vehicles/bikes/e-scooters, and drop-offs. A fixed COCO list covers only the second. Depth covers the first and third without any class label. The project is open source, so AGPL Ultralytics models are usable (see Decisions).

## Global constraints (unchanged from the first plan, plus new ones)

- Everything runs locally on `127.0.0.1`. No frames or cues leave the machine.
- Runtime stays `opencv-python`, `onnxruntime`, `numpy`. **Ultralytics/torch are export-time only**, in a separate requirements file. The server never imports them.
- Weights live in `computer-vision/detector/weights/` (gitignored). No `.onnx` committed.
- Never say the path is clear. Never give metres or feet. Distance is a bucket (`near`, `very near`) derived from image position/size or relative depth.
- One cue at a time, deduplicated, with a hold. Picture-quality gate still runs first.
- The Expo app is not modified in this pass.
- Every new decision module (`corridor.py`, `tracker.py`, `policy.py`) is pure Python/NumPy and tested without a camera or model.

## Architecture

```
frame ─► quality gate ─┬─► detector (8 Hz) ──► tracker ──┐
                       │                                  ├─► policy ─► one Cue ─► page (text + speech)
                       └─► depth (≈4 Hz) ──► corridor ────┘                    └─► eval log (JSONL)
```

- **Detector:** YOLO26n (COCO) or YOLOE-26n with Strider's hazard words baked in. Both export to the same `[1, 4+K, 8400]` tensor, so one parser handles both. Selectable at runtime so we can compare live, then pick a default.
- **Depth:** Depth Anything V2 Small (Apache-2.0), ONNX, run at a reduced input size. Output is relative closeness per pixel, not metres.
- **Corridor analysis:** turns the depth map into at most one finding: `head` (close thing in the upper path), `drop` (ground suddenly falls away), `path` (close unnamed thing in the path), or none.
- **Tracker:** IoU tracker over detector boxes. Gives each object an id, hit count, and whether it is growing (approaching) plus a rough seconds-to-contact.
- **Policy v2:** merges tracker + corridor into one cue with a fixed priority order.

## Hazard vocabulary (YOLOE prompts)

Baked into the exported YOLOE model. Rank decides who wins when several are near (higher wins).

| Prompt(s) | Said as | Rank | Mover? |
|---|---|---|---|
| car, bus, truck | Vehicle | 3 | yes |
| bicycle, motorcycle | Bike | 3 | yes |
| electric scooter | Scooter | 3 | yes |
| person | Person | 2 | yes |
| dog | Dog | 2 | yes |
| pole, bollard, sign post | Pole | 2 | no |
| traffic cone, construction barrier | Barrier | 2 | no |
| fire hydrant | Hydrant | 2 | no |
| trash can | Bin | 2 | no |
| bench | Bench | 2 | no |
| tree branch | Branch | 2 | no |
| open car door | Car door | 3 | no |

For YOLO26n (COCO), the existing COCO table stays, adding fire hydrant (10) and bench (13) as rank-2 statics. Stairs, curbs and holes are left to depth — prompts for them are unreliable and the drop check covers them better.

## Cue priority (policy v2)

Highest first. Only the winner is cued.

1. **Approaching mover** — tracked vehicle/bike/scooter/person/dog, ≥3 hits, box growing, seconds-to-contact < 3: `"Bike approaching on the left."`
2. **Head height** (depth): `"Obstacle at head height."` (+ `" Ahead."`/`" On the left."`)
3. **Drop** (depth): `"Drop ahead. Stop."`
4. **Named obstacle in path** — existing near/side rules, now from tracks with ≥3 hits: `"Pole ahead. Pass on the right."`, `"Path blocked."`
5. **Unnamed obstacle in path** (depth, no detector box overlapping it): `"Obstacle ahead."`
6. Otherwise quiet. Page text: `"No obstacle detected. Keep using your cane."` (replaces "Nothing in your path.")

Dedup and rate-limit: same (kind, class, side) is held 4 s as today. Items 1–3 may interrupt a lower-priority hold; nothing interrupts a cue of equal or higher priority inside its hold.

## Cue contract (extended)

```python
@dataclass(frozen=True)
class Cue:
    kind: str                 # "obstacle" | "quiet"
    speech: str
    reason: str               # existing + "approaching", "head", "drop", "path"
    side: str | None
    class_name: str | None    # None for depth-only cues
    confidence: float | None  # detector score, or corridor strength 0–1
    distance: str | None      # "near" | "very near" | None
    source: str | None        # "detector" | "depth"
    timestamp: float          # wall clock seconds
```

`/api/cue` returns these fields plus `inference_ms`, `depth_ms`, `detector`, `mode`.

## Files

Create
- `computer-vision/tools/requirements-export.txt` — `ultralytics>=8.4` (pulls torch). Export only.
- `computer-vision/tools/export_models.py` — exports `yolo26n.onnx` (default head, `[1,84,8400]`) and `yoloe26n_walk.onnx` (detection-only YOLOE-26n with the vocabulary above, `[1,4+K,8400]`). Writes `weights/manifest.json` with each model's class list, spoken names, ranks, mover flags. Verifies output shapes.
- `computer-vision/detector/vocab.py` (+ test) — loads the manifest; maps class index → `(class_name, rank, spoken, mover)`. Replaces the hard-coded COCO table in `labels.py`, which stays as the built-in fallback for YOLO26n.
- `computer-vision/detector/depth.py` — Depth Anything V2 Small ONNX wrapper: resize to a multiple of 14 (start at 266 px short side), ImageNet normalise, run, return a float map at frame size. Preprocessing to be confirmed from the model's `preprocessor_config.json` before coding.
- `computer-vision/detector/corridor.py` (+ test) — depth map → `DepthFinding(kind, side, strength)`. No ONNX/OpenCV imports.
- `computer-vision/detector/tracker.py` (+ test) — IoU tracker, approach and seconds-to-contact.
- `computer-vision/detector/eval_log.py` (+ test) — append-only JSONL of cues and user marks under `computer-vision/logs/` (gitignored).
- `computer-vision/tools/bench.py` — runs each detector and depth over N webcam frames, prints median/95th-percentile ms. Used to choose sizes and rates.

Modify
- `detector/download_model.py` — also fetch Depth Anything V2 Small ONNX from `onnx-community/depth-anything-v2-small-ONNX` at a pinned revision with SHA256 check (`model.onnx` + `model.onnx_data`, ~99 MB; try `model_quantized` if fp32 is too slow).
- `detector/yolo.py` — class count read from the tensor; mapping via `vocab`; same letterbox/NMS.
- `detector/policy.py` (+ tests) — policy v2 above, consuming tracks + depth finding.
- `detector/pipeline.py` — detector selection, depth every other pass, tracker, eval log; capture from ESP32 stream URL as well as the webcam.
- `viewer/server.py` — `POST /api/detector {"name": "yolo26n"|"yoloe"}`, `POST /api/view {"overlay": "boxes"|"depth"}`, `POST /api/mark {"kind": "false-alert"|"missed"}`; `/webcam` becomes the annotated stream for either source.
- `viewer/static/*` — detector picker, depth overlay toggle, "Speak cues" toggle (browser `speechSynthesis`, needs one click to enable), extended cue fields, "False alert" / "Missed it" buttons, new wording.
- `.gitignore` — `logs/`, export caches (`*.pt`, `mobileclip*.ts`).
- READMEs — export step, the two models, what depth can and cannot see.

## Tasks

### Task 1 — Export and download models
- [ ] `requirements-export.txt`; `export_models.py` writes both detector ONNX files + `manifest.json` and asserts shapes `[1,84,8400]` and `[1,4+K,8400]`.
- [ ] `download_model.py` gains the depth model with pinned revision + SHA256.
- [ ] Manual: run export once (needs network, ~1–2 GB for torch + ~250 MB text encoder), confirm files.

### Task 2 — Parser + vocabulary
- [ ] Tests: hand-built `[1, 4+K, 8400]` tensor with K = vocabulary size maps class 5 → the manifest's 6th entry; COCO fallback unchanged; existing yolo tests still pass.
- [ ] Implement `vocab.py`; generalise `predictions_to_boxes`. `Box` gains `mover: bool`.

### Task 3 — Depth wrapper + bench
- [ ] `depth.py` loads the model lazily; missing file → no depth findings, reason surfaced as `depth-missing` (detector still runs).
- [ ] `bench.py`; record laptop numbers for YOLO26n, YOLOE, depth at 266/364/518 in the README.
- [ ] Pick depth input size and rate so detector + depth stays under ~125 ms per pass on average.

### Task 4 — Corridor analysis (pure, tested on synthetic maps)
- [ ] Corridor = middle 40% of width. Ground reference = median closeness of the bottom 15% of the corridor.
- [ ] `head`: a blob in the top 45% of the corridor with closeness ≥ ground reference × `HEAD_RATIO` (start 0.8) covering ≥ 3% of the frame.
- [ ] `drop`: scanning up the lower half of the corridor, closeness falls by more than `DROP_RATIO` (start 0.5) between adjacent bands across ≥ 60% of corridor width.
- [ ] `path`: a blob in the middle band of the corridor with closeness ≥ ground reference × `PATH_RATIO`, not overlapped by a detector box.
- [ ] Tests: flat ramp → none; bright block top-centre → head; ramp with a step down → drop; block mid-centre → path; same block inside a supplied detector box → none.
- [ ] Every finding needs 2 consecutive depth passes before the policy sees it.

### Task 5 — Tracker (pure, tested)
- [ ] Greedy IoU match (≥ 0.3), same class; tracks expire after 0.5 s unseen.
- [ ] Approaching: box height grew ≥ 15% over the last ~1 s. Seconds-to-contact = Δt / (h_now/h_then − 1).
- [ ] Tests: steady box → not approaching; growing box → approaching with expected seconds; two people swapping sides keep ids; expired track drops.

### Task 6 — Policy v2
- [ ] Rewrite `decide` to take tracks + depth finding; keep all current tests that still apply (side bands, blocked, bag rule), add tests for each priority level, interruption rules, new fields, and that no output ever says "clear".
- [ ] Track hit count (≥3) replaces the old `seen_count`.

### Task 7 — Pipeline, server, page
- [ ] Detector switch, depth every other pass, tracker, eval log, ESP32 URL capture via OpenCV (the raw proxy is not opened at the same time; the camera allows one stream).
- [ ] Page: detector picker, depth overlay, speech toggle, mark buttons, new wording, extended fields.
- [ ] Existing tests + new ones pass: `python -m pytest computer-vision/detector -q`.

### Task 8 — Bench check and pick defaults
- [ ] Manual on the webcam: person walking toward camera → "approaching"; object held at top of frame close to lens → head-height; camera tilted over a desk/stair edge → drop; covering the lens → quiet. Compare YOLO26n vs YOLOE live on poles/bins/cones if available.
- [ ] Record results and known failures (glass, low light, thin poles, the webcam is not a chest mount) in the README evaluation section and the eval log.
- [ ] Set default detector. Update ENG-24 with results.

## Decisions needed before starting

1. **Licence.** YOLO26n and YOLOE are AGPL-3.0. Using them means the project should be released under AGPL-3.0 (or a compatible licence). The current `LICENSE` file is the Expo template's MIT notice with Expo's copyright, not yours — it should be replaced either way. If you'd rather stay MIT/Apache, swap the detector for D-FINE-N (Apache) and drop YOLOE; the rest of the plan is unchanged.
2. **Vocabulary** above — add/remove words.
3. **Thresholds** (`HEAD_RATIO`, `DROP_RATIO`, `PATH_RATIO`, 3 s contact, 4 s hold) are starting guesses, tuned in Task 8.

## Out of this plan

- Fine-tuning, labelling, recording datasets.
- Walkable-surface segmentation and VLM scene description.
- Running models on the phone / Expo app and the wristlet.
- Metric distance.

## Known limits to state plainly

- Laptop webcam ≠ chest camera; drop and head-height thresholds must be re-tuned on the collar.
- Monocular depth is weak on glass, mirrors, low light, and very thin poles/branches.
- YOLOE zero-shot recall on rare words (bollard, branch, car door) is unmeasured and may be poor.

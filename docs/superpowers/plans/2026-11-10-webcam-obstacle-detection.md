# Webcam obstacle detection — implementation plan

> **For agentic workers:** Do not start this plan until it is approved. After approval, REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Point the existing local vision page at the computer webcam and turn each frame into one walking cue: the obstacle's name and which side to pass, or silence when the picture is not trustworthy.

**Architecture:** The laptop webcam is only a frame source. A small COCO detector proposes boxes. A separate policy, tested without a camera or a model, decides the single cue a walker would hear. The page draws the boxes and the cue. Crosswalk lining-up and curb depth are not estimated in this pass. The Expo app is not modified.

**Tech Stack:** Python 3.13 already on this machine, OpenCV for capture and drawing, ONNX Runtime for YOLOv8n, pytest for the policy. The page stays on `127.0.0.1`. No GPU, no cloud upload, no new Expo packages.

## Global Constraints

- Detection stays on this computer. Frames and cues are not uploaded. The page binds to `127.0.0.1` only.
- The Expo app under `src/` is not part of this pass. Cue copy in the app is the contract for later, not a screen to edit now.
- The webcam is a bench stand-in for the collar camera. Code must not assume a steady desk, a known height, or indoor light.
- Never report a distance in feet or meters. Box position is image position, not range.
- Never say a crosswalk is safe to use, and never report a curb, step, or drop-off from this detector.
- One cue at a time. If the frame is dark, blown out, or the same object has not held still across several inferences, stay quiet.
- Weights are downloaded into `computer-vision/detector/weights/` and gitignored. Do not commit `.onnx` files.
- ESP32 flashing and the MJPEG proxy stay as they are. A later frame source can replace the webcam without changing the policy.

---

## What the app is actually asking for

Strider is a collar-camera aid for a blind or low-vision person walking outside. The phone is not the walking UI. The session screen says the wristlet vibrates and no phone is needed. The cue list in `src/app/cue-preferences.tsx` is the product contract:

| Cue | What the walker needs | This pass |
| --- | --- | --- |
| Obstacle | Name the thing and which side to pass | Yes. This is the algorithm. |
| Crosswalk | Find the crosswalk and line up | No. A COCO detector does not see stripes or a heading to hold. |
| Veer | A pulse if heading drifts | No. That is compass or heading, not vision. |
| Depth | Steps, curbs, drop-offs | No. One webcam frame has no trustworthy metric depth. |
| Device | Camera disconnected, bad signal | Yes, as "picture is not usable," not as battery. |

Route-ready obstacles (low branch, broken curb, sidewalk closed) are remembered places on a route. They are not something a live detector should invent.

The session screen already has the right failure behavior: when the signal is poor, guidance goes quiet instead of guessing. The detector must do the same.

## Real walking, and what a laptop webcam is

A collar camera sits near the chest, looks forward and slightly down, and bounces with each step. Sidewalks include glare, dusk, headlights, rain on the lens, and a cane or the walker's own body in the frame. People, bikes, and cars move. The useful warning is the thing in the walking corridor a few steps ahead, not every object in the scene. A walker at a normal pace covers roughly a step between cues, so a late or repeating cue is as bad as a wrong one. Speech or vibration has to be short, and a second cue must not talk over the first.

The laptop webcam is a different instrument: fixed, higher, usually indoors, a narrower view, and aimed at a room. It is the right way to build and watch the pipeline. It is the wrong way to claim the collar works on a street. The page must show the cue a walker would get, and it must be obvious this is a bench camera.

Consequences for the algorithm:

- Judge "near" by the box touching the lower part of the frame and being large. Do not convert that into a distance.
- Ignore boxes in the top of the frame. On a collar those are far away or above the path. Head-height branches will not be detected. Do not label them.
- Split the frame into left, center, and right. The center is the path. "Pass on the right" is allowed only when the right side is clear, and the reverse for left. If the path and both sides are occupied, the cue is that the path is blocked.
- Require the same class and side for 3 inferences before speaking, then hold that cue for 4 seconds. A single flicker must not become a vibration.
- Vehicles in the center of the path outrank a person or a dog at the side. A dog outranks a bench.
- Drop indoor COCO clutter (cups, books, laptops, chairs that are just the room). The allowlist is the walk vocabulary below.
- If the frame is too dark or washed out, publish no obstacle. That matches "guidance is quiet until the signal is steady."

## Walker vocabulary

YOLOv8n COCO ids mapped to a name the cue can say. Anything not in this table is discarded before the policy sees it.

| COCO ids | Said as | Rank (higher wins) |
| --- | --- | --- |
| 2 car, 5 bus, 7 truck | vehicle | 3 |
| 0 person | person | 2 |
| 1 bicycle, 3 motorcycle | bike | 2 |
| 16 dog | dog | 2 |
| 24 backpack, 26 handbag, 28 suitcase | bag | 1 |

Confidence below 0.45 is discarded. Traffic lights and stop signs are not in the list: seeing one is not a reason to cross.

## Cue contract

```python
@dataclass(frozen=True)
class Box:
    class_name: str          # vehicle, person, bike, dog, bag
    rank: int
    confidence: float
    x0: float                # pixels, origin top-left
    y0: float
    x1: float
    y1: float

@dataclass(frozen=True)
class Cue:
    kind: str                # "obstacle" or "quiet"
    speech: str              # "" when quiet
    reason: str              # "clear", "unsteady", "cooldown", "holding", "blocked", "pass"
    side: str | None         # "left", "center", "right", or None
    class_name: str | None
```

Speech lines, exact:

- Path clear or nothing near: quiet, reason `clear`, speech `""`.
- Picture rejected: quiet, reason `unsteady`, speech `""`.
- Same cue still inside the 4 second hold: quiet, reason `holding`, speech `""`. The page may keep showing the last line, but the policy does not emit a new one.
- Object on the left, right third empty: `"{Name} on the left. Pass on the right."`
- Object on the right, left third empty: `"{Name} on the right. Pass on the left."`
- Object in the center, only one side empty: `"{Name} ahead. Pass on the left."` or `right`.
- Center occupied and both sides occupied: `"Path blocked."`
- Names are `Vehicle`, `Person`, `Bike`, `Dog`, `Bag`.

Bands: left is `x` center `< 0.35 * width`, right is `> 0.65 * width`, otherwise center. A box is near enough to matter when its bottom is in the lower 45% of the frame (`y1 > 0.55 * height`) and its height is at least 12% of the frame. A side counts as occupied when any near box of rank 2 or more sits in that third. Bags do not block a side and never win over a rank 2 or 3 object. A bag cues only when it is the only near object.

Picture quality, before the model: grayscale mean below 25 or above 235, or standard deviation below 8, returns `unsteady` and does not run the model. That catches a covered lens, a black frame, and a blown-out frame. It does not catch rain or motion blur. Those stay as a known gap.

## Files

- Create: `computer-vision/detector/policy.py` — boxes and frame size to one `Cue`. No OpenCV, no model.
- Create: `computer-vision/detector/policy_test.py` — the cases below.
- Create: `computer-vision/detector/quality.py` — brightness and contrast gate.
- Create: `computer-vision/detector/labels.py` — COCO id to class name, rank, and spoken name.
- Create: `computer-vision/detector/yolo.py` — letterbox, parse `[1, 84, 8400]`, confidence cut, NMS, allowlist. No camera.
- Create: `computer-vision/detector/yolo_test.py` — parse and NMS on a hand-built tensor.
- Create: `computer-vision/detector/webcam.py` — `open_webcam(index) -> cv2.VideoCapture`, Windows `CAP_DSHOW` first, then the default backend.
- Create: `computer-vision/detector/pipeline.py` — grab the latest frame, skip the model when the picture is bad, run YOLO at 8 inferences per second, feed the policy.
- Create: `computer-vision/detector/download_model.py` — download YOLOv8n ONNX and check a pinned SHA256.
- Create: `computer-vision/requirements.txt` — `opencv-python`, `onnxruntime`, `pytest`.
- Modify: `computer-vision/viewer/server.py` — add webcam MJPEG and cue JSON. Keep the ESP32 proxy routes working.
- Modify: `computer-vision/viewer/static/index.html`, `app.js`, `styles.css` — source switch, mode control, cue line, boxes on the video.
- Modify: `computer-vision/.gitignore` — `detector/weights/`.
- Modify: `computer-vision/README.md` and `computer-vision/viewer/README.md` — how to run the webcam path, and what the three modes do and do not do.

The policy module must not import OpenCV or ONNX Runtime. Tests run with `python -m pytest computer-vision/detector/policy_test.py computer-vision/detector/yolo_test.py -q` and no weight file.

## Tasks

### Task 1: Cue policy

**Files:** `computer-vision/detector/policy.py`, `computer-vision/detector/policy_test.py`

**Interfaces:**
- Consumes: `Box` fields above.
- Produces: `decide(boxes: list[Box], width: int, height: int, now: float, state: PolicyState) -> tuple[Cue, PolicyState]`.

`PolicyState` holds the candidate that has matched so far (`class_name`, `side`, `seen_count`) and `hold_until` (monotonic seconds). `now` is passed in so tests do not sleep.

- [ ] Write tests that build boxes in a 640×480 frame and assert the exact `speech` and `reason`:
  - no boxes → `clear`
  - a person whose box is only in the top half → `clear`
  - a person in the left third, bottom of the box low, right third empty → `Person on the left. Pass on the right.`
  - the same scene mirrored → `Person on the right. Pass on the left.`
  - a person in the center, a vehicle filling the right third, left empty → `Person ahead. Pass on the left.`
  - a vehicle in the center and a person on the left, right empty → the vehicle wins: `Vehicle ahead. Pass on the right.`
  - near boxes in all three thirds → `Path blocked.`
  - a bag alone in the center, a side empty → `Bag ahead. Pass on the left.` or right, matching the empty side
  - a bag beside a person → the person wins
  - the winning scene on calls 1 and 2 → `quiet` / reason `holding` is wrong; reason is a pending state and speech is `""` (add reason `pending`)
  - the winning scene on call 3 → the speech line
  - a different class on call 3 resets the count and does not speak
  - a call 1 second after a spoken cue, same scene → speech `""`, reason `holding`
  - a call 5 seconds after a spoken cue, same scene → the line may be spoken again
- [ ] Implement `decide` until those tests pass.
- [ ] Run: `python -m pytest computer-vision/detector/policy_test.py -q`
- [ ] Expected: all passed.

### Task 2: Picture gate and label table

**Files:** `computer-vision/detector/quality.py`, `computer-vision/detector/labels.py`, tests beside them.

- [ ] `frame_is_usable(gray: numpy.ndarray) -> bool` returns false when mean `< 25` or `> 235` or standard deviation `< 8`. Test a black array, a white array, a flat gray array, and a noisy mid-gray array.
- [ ] `walker_class(coco_id: int) -> tuple[str, int, str] | None` returns `(class_name, rank, spoken)` for the table above and `None` for class 62 (chair) and class 9 (traffic light).
- [ ] Expected: `python -m pytest computer-vision/detector/quality_test.py computer-vision/detector/labels_test.py -q` passes.

### Task 3: YOLO parse, without the weight file

**Files:** `computer-vision/detector/yolo.py`, `computer-vision/detector/yolo_test.py`

YOLOv8n raw output is `[1, 84, 8400]`: 4 box values then 80 class scores, one column per candidate. Coordinates from the stock ONNX are pixels of the 640 input.

- [ ] Test a tensor with one person column (class 0 score 0.9, box inside the lower-left of 640×480) and one chair column (class 56 score 0.99). After parse, NMS, and the allowlist, the only `Box` is `person`.
- [ ] Test two overlapping person columns. NMS at IoU 0.5 keeps one.
- [ ] Test a person at score 0.2. It is dropped.
- [ ] `letterbox(image, 640)` records the scale and pad so boxes map back to the original frame. Test a 640×480 image: scale and pad are deterministic, and a box at the center of the network input maps back inside the original center.
- [ ] Do not download weights in this task.

### Task 4: Webcam source and the page

**Files:** `computer-vision/detector/webcam.py`, `computer-vision/detector/pipeline.py`, viewer server and static files, `computer-vision/requirements.txt`, `computer-vision/detector/download_model.py`.

- [ ] Add the three packages to `computer-vision/requirements.txt`. Install them with `python -m pip install -r computer-vision/requirements.txt`. Confirm `import cv2` and `import onnxruntime`.
- [ ] `download_model.py` fetches the Ultralytics YOLOv8n ONNX release asset, writes `computer-vision/detector/weights/yolov8n.onnx`, and exits non-zero if the SHA256 does not match the hash recorded in the script after the first successful download is checked by hand. Gitignore that directory.
- [ ] Pipeline: one capture thread keeps only the newest frame. The inference loop sleeps to stay at or under 8 passes per second. If `frame_is_usable` is false, the cue is `unsteady` and the model is not called. If the weight file is missing, the server still starts, the video still shows, and the cue reason is `model-missing`.
- [ ] Server routes, all on `127.0.0.1`:
  - `GET /webcam` multipart MJPEG of the annotated frame (boxes and the class name drawn).
  - `GET /api/cue` JSON of the latest `Cue` plus `inference_ms` and `mode`.
  - `POST /api/source` `{"kind": "webcam", "index": 0}` or `{"kind": "esp32", "url": "http://..."}`. ESP32 keeps using the proxy already in `server.py`.
  - `POST /api/mode` `{"mode": "general" | "crosswalk" | "depth"}`.
- [ ] Page: a control for Webcam versus ESP32 address, the live image, a mode control using the app's three names, and one text line for the cue.
  - General: show the cue speech, or "Nothing in your path." when reason is `clear`, or "Picture is not steady enough to guide." when reason is `unsteady`.
  - Crosswalk: show "Crosswalk lining-up is not estimated from this camera." Do not draw a crossing decision. Still show a vehicle or person cue if the policy emits one, under that sentence, because those hazards do not go away at a corner.
  - Depth: show "Steps, curbs, and drop-offs are not estimated from this camera." Do not invent a depth number. Obstacle cues may still show under that sentence.
- [ ] Boxes are drawn for the bench view. The spoken cue is still only the one line from the policy.
- [ ] Manual check, after approval and implementation: start `python computer-vision/viewer/server.py`, open `http://127.0.0.1:8080`, choose Webcam, and confirm a person in front of the camera produces a pass cue only after they have been in frame briefly, and that covering the lens goes quiet instead of naming an object.

## Out of this plan

- Flashing the ESP32, and treating its VGA stream as the source. The source switch is the seam for that.
- Wiring cues into the Expo session screen or the wristlet.
- Crosswalk stripe detection, heading hold, and any monocular depth model.
- Sharing detected obstacles to the community map.
- Remembered route obstacles on the route-ready screen.

## Approval

Implementation does not start until this plan is accepted or changed. The decisions most likely to change are the allowlist, the 0.35 / 0.65 side bands, the 3-frame confirm, and the 4-second hold.

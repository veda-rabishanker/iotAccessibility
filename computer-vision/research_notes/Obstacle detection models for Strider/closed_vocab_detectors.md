# Closed-Vocabulary Real-Time Object Detectors for Strider (as of Nov 2026)

Context: ESP32-CAM (OV2640, ~VGA MJPEG) frames go to a phone (Expo/React Native, iOS and Android) or a laptop CPU. Detection runs on-device at 8+ inferences/s or more, and the product is commercial. The current prototype runs YOLO11n through ONNX Runtime on a laptop CPU at about 40 ms per frame.

Source-type legend: **[V]** = vendor or author claim (the repo or paper owner benchmarking its own model). **[3P]** = third party, but often vendor-affiliated (for example, Roboflow comparing its own model with YOLO). **[I]** = independent measurement. Almost every number below is [V]. I found no rigorous independent mobile-NPU benchmark covering these models.

## Which models lead real-time detection as of late 2026, and what exists?

### Takeaway
Two families lead. The YOLO family's newest release is Ultralytics YOLO26 (January 2026, NMS-free, AGPL-3.0). The DINOv2/v3-backbone DETR family covers RF-DETR (ICLR 2026, Apache-2.0 for Nano through Large), D-FINE (Apache-2.0), DEIMv2 (now under a non-commercial license), RT-DETRv4, and EdgeCrafter/ECDet. For a commercial phone app, the license-clean, mobile-feasible shortlist is RF-DETR Nano or Small, D-FINE-N or S, and (with an Enterprise license) YOLO26n.

### Cited Findings
- **YOLO26** (Ultralytics) was released in January 2026. It has an optional native end-to-end (NMS-free) head, enabled with `nms=False`. It removes Distribution Focal Loss, and it adds ProgLoss, STAL (Small-Target-Aware Label Assignment) and the MuSGD optimizer (a hybrid of SGD and Muon). License: AGPL-3.0 or Enterprise. [V] — [Ultralytics YOLO26 docs](https://docs.ultralytics.com/models/yolo26/)
- YOLO26n: 40.9 COCO mAP50-95 (40.1 with the end-to-end head), 2.4M params, 5.5 GFLOPs, 38.9 ms CPU ONNX, 1.7 ms T4 TensorRT10. YOLO26s: 48.6 mAP (47.8 end-to-end), 9.5M params, 87.2 ms CPU ONNX, 2.5 ms T4. Ultralytics claims "up to 43% faster CPU ONNX inference" than YOLO11n on an Intel Xeon @ 2.00 GHz. [V] — [Ultralytics YOLO26 docs](https://docs.ultralytics.com/models/yolo26/)
- YOLO11n: 39.5 mAP, 2.6M params, 6.5 GFLOPs, 56.1 ms CPU ONNX, 1.5 ms T4. YOLO11s: 47.0 mAP, 9.4M params, 90.0 ms CPU ONNX. License: AGPL-3.0 or Enterprise. [V] — [Ultralytics YOLO11 docs](https://docs.ultralytics.com/models/yolo11/)
- YOLOv12-N: 40.6 mAP at 1.64 ms (T4 TRT FP16). YOLOv12-S: 48.0 mAP at 2.61 ms. Listed as AGPL-3.0. [3P, Roboflow] — [Roboflow RF-DETR vs YOLO](https://roboflow.com/blog/rf-detr-vs-yolo). A Roboflow playground page gives 40.5 mAP at 1.62 ms for YOLOv12-N. — [Roboflow playground](https://playground.roboflow.com/models/compare/rt-detr-vs-yolov12)
- **RF-DETR** (Roboflow) has a DINOv2 backbone, with PE-Core-T for Atto, Femto and Pico. It uses weight-sharing NAS. Paper: arXiv 2511.09554, accepted to ICLR 2026. The paper claims RF-DETR nano reaches 48.0 COCO AP, 5.3 AP above D-FINE nano at similar latency, and that 2XL is the first real-time detector above 60 AP. [V] — [arXiv 2511.09554](https://arxiv.org/abs/2511.09554)
- RF-DETR detection sizes from the current README (T4, TensorRT FP16, batch size 1):
  - Atto: 30.5 COCO / 48.3 RF100-VL, 1.0 ms, 7.4M params, 380 px, PML 1.0.
  - Femto: 37.8 / 53.8, 1.4 ms, 7.9M, 384 px, PML.
  - Pico: 41.6 / 56.0, 1.7 ms, 8.4M, 560 px, PML.
  - **Nano: 48.4 / 57.7, 2.3 ms, 30.5M, 384 px, Apache-2.0.**
  - **Small: 53.0 / 60.2, 3.5 ms, 32.1M, 512 px, Apache-2.0.**
  - Medium: 54.7 / 61.2, 4.4 ms, 33.7M, 576 px, Apache-2.0.
  - Large: 56.5 / 62.2, 6.8 ms, 33.9M, 704 px, Apache-2.0.
  - XL and 2XL: 58.6 and 60.1 COCO, PML.

  Segmentation (Nano 40.3 mask AP through 2XL) and a keypoint preview are also offered. [V] — [rf-detr GitHub](https://github.com/roboflow/rf-detr)
- **D-FINE** (COCO AP / params / GFLOPs / T4 TRT 10.4 FP16 latency):
  - N: 42.8 AP, 4M, 7 GFLOPs, 2.12 ms.
  - S: 48.5 AP, 10M, 25 GFLOPs, 3.49 ms.
  - M: 52.3 AP, 19M, 57 GFLOPs, 5.62 ms.
  - L: 54.0 AP, 31M, 91 GFLOPs, 8.07 ms.
  - X: 55.8 AP, 62M, 202 GFLOPs, 12.89 ms.

  Apache-2.0. [V] — [D-FINE GitHub](https://github.com/Peterande/D-FINE)
- **DEIMv2** (released 2025-09-26; DINOv3 backbones for L and X, distilled ViT-Tiny for S and M; Atto through N appear to use HGNetv2). COCO AP / params / GFLOPs / TRT latency (GPU not stated):
  - Atto: 23.8 AP, 0.5M, 0.8 GFLOPs, 1.10 ms.
  - Femto: 31.0 AP, 1.0M, 1.7 GFLOPs, 1.45 ms.
  - Pico: 38.5 AP, 1.5M, 5.2 GFLOPs, 2.13 ms.
  - N: 43.0 AP, 3.6M, 6.8 GFLOPs, 2.32 ms.
  - S: 50.9 AP, 9.7M, 49.5 GFLOPs, 5.78 ms.
  - M: 53.0 AP, 18.1M, 84.1 GFLOPs, 8.80 ms.
  - L: 56.0 AP, 32.2M.
  - X: 57.8 AP, 50.3M.

  [V] — [DEIMv2 GitHub](https://github.com/Intellindust-AI-Lab/DEIMv2)
- **EdgeCrafter / ECDet** (arXiv 2603.18739, March 2026, accepted to TMLR 2026 per the DEIMv2 repo) is from the same lab as DEIMv2. ECDet-S reaches 51.7 COCO AP with under 10M params, trained on COCO only, and is reported ahead of DEIMv2-S (50.9) and DEIMv2-M (53.0) at matching sizes. [V] — [arXiv 2603.18739](https://arxiv.org/abs/2603.18739); [EmergentMind summary](https://www.emergentmind.com/papers/2603.18739)
- **RT-DETRv4** (arXiv 2510.25257) reports S/M/L/X at 49.7/53.5/55.4/57.0 AP and 273/169/124/78 FPS. There is no nano variant. [V] — [arXiv 2510.25257](https://arxiv.org/html/2510.25257v1)
- **MediaPipe Object Detector** (Google) models measured on a Pixel 6:
  - EfficientDet-Lite0 (320 px): int8 29.31 ms CPU; fp32 61.30 ms CPU / 27.83 ms GPU.
  - EfficientDet-Lite2 (448 px): int8 70.91 ms CPU; fp32 41.15 ms GPU.
  - SSD MobileNetV2 (256 px): fp32 36.30 ms CPU / 24.01 ms GPU.

  The page gives no mAP. [V] — [MediaPipe Object Detector](https://developers.google.com/edge/mediapipe/solutions/vision/object_detector)
- RF-DETR Small (53.0 mAP, 3.52 ms) roughly matches YOLO26-M (53.1 mAP, 4.7 ms) on accuracy while running faster on a T4. At the smallest tier, YOLO26n (1.7 ms) is faster but about 7.5 mAP below RF-DETR Nano (2.3 ms). [3P, Roboflow-affiliated] — [Roboflow RF-DETR vs YOLO](https://roboflow.com/blog/rf-detr-vs-yolo); [Codersera comparison](https://codersera.com/blog/rf-detr-vs-yolo26-object-detection-comparison-2026/)

### Comparison table (small and nano variants; all [V] unless noted)

| Model | COCO AP | Params | Input | T4 TRT FP16 ms | CPU ONNX ms | Mobile measured | License (commercial?) |
|---|---|---|---|---|---|---|---|
| YOLO11n (current) | 39.5 | 2.6M | 640 | 1.5 | 56.1 | — | AGPL-3.0 / Enterprise |
| YOLO26n | 40.9 (40.1 E2E) | 2.4M | 640 | 1.7 | 38.9 | iPhone 17 Pro ANE ~3.7 ms, CPU ~8.8 ms (INT8 CoreML) | AGPL-3.0 / Enterprise |
| YOLO26s | 48.6 | 9.5M | 640 | 2.5 | 87.2 | — | AGPL-3.0 / Enterprise |
| YOLOv12-N | 40.6 [3P] | — | 640 | 1.64 | — | — | AGPL-3.0 [3P] |
| RF-DETR Pico | 41.6 | 8.4M | 560 | 1.7 | — | — | PML 1.0 (Roboflow-hosted or Enterprise) |
| RF-DETR Nano | 48.4 | 30.5M | 384 | 2.3 | — | — | Apache-2.0 |
| RF-DETR Small | 53.0 | 32.1M | 512 | 3.5 | — | — | Apache-2.0 |
| D-FINE-N | 42.8 | 4M | 640 | 2.12 | — | — | Apache-2.0 (Obj365 weights caveat) |
| D-FINE-S | 48.5 | 10M | 640 | 3.49 | — | — | Apache-2.0 (Obj365 caveat) |
| DEIMv2-Pico / N | 38.5 / 43.0 | 1.5M / 3.6M | 640 | 2.13 / 2.32 | — | — | Non-commercial (DEIMv2 License) |
| DEIMv2-S | 50.9 | 9.7M | 640 | 5.78 | — | — | Non-commercial |
| ECDet-S | 51.7 | <10M | — | — | — | — | Not verified |
| RT-DETRv4-S | 49.7 | — | 640 | ~3.7 (273 FPS) | — | — | Not verified (a third-party repack says Apache-2.0) |
| EfficientDet-Lite0 (MediaPipe) | not on page | — | 320 | — | — | Pixel 6 int8 CPU 29.3 ms; fp32 GPU 27.8 ms | — |

Input sizes for YOLO, D-FINE and DEIMv2 are the usual 640 defaults and were not re-verified for each model.

### Inferences
- YOLO26n is the most direct swap for the prototype: same tooling, roughly 30% lower CPU latency per vendor numbers, 1.4 mAP better than YOLO11n, and an NMS-free head that simplifies the custom parser. The license, though, blocks a closed-source commercial app without an Enterprise deal.
- RF-DETR Nano gives about 7.5 more COCO AP than YOLO26n at a native 384 px input, which is close to the OV2640's useful resolution. But it has about 12x the parameters (30.5M vs 2.4M), so phone CPU and NPU latency is likely much higher than its T4 number suggests. This must be measured.
- D-FINE-N and D-FINE-S are the "small and Apache-2.0" option. Their parameter counts are close to YOLO's, but DETR decoders and deformable attention often map poorly to mobile NPUs (an unverified general concern).

### Gaps
- I could not verify whether YOLOv13 exists, or any of its numbers or license. LW-DETR, PP-YOLOE+/PicoDet, DEIM (v1) and RT-DETRv2/v3 were not checked against their repos in this session. My recollection that DEIM v1, LW-DETR and PaddleDetection are Apache-2.0 is unverified.
- I found no newer Ultralytics model after YOLO26.
- I did not check Apple Vision built-ins. As far as I know, Apple does not ship a general COCO-style object detector through the Vision framework (it has rectangles, humans, animals, saliency, and text), but this was not verified.

## Speed on mobile NPU/GPU and CPU for the small variants

### Takeaway
The only vendor-published phone NPU numbers I found are for YOLO26n on CoreML (about 4 ms on the iPhone 17 Pro Neural Engine) and for MediaPipe EfficientDet-Lite on a Pixel 6. RF-DETR, D-FINE and DEIMv2 publish only T4 TensorRT numbers. Every mid-range Android figure would have to be measured in-house.

### Cited Findings
- YOLO26n INT8 CoreML on an iPhone 17 Pro (A19): the current English page gives ~3.7 ms on the Neural Engine and 8.8 ms CPU-only (iOS 27.0.1, v8.3.0 assets). Older localized pages give 3.8 ms / 9.1 ms (iOS 26.5.2) and 11.3 ms per frame for live camera. The Japanese page says ~16 ms per frame. The figures are inconsistent across versions of the same page. [V] — [Ultralytics CoreML integration](https://docs.ultralytics.com/integrations/coreml)
- On a Xeon @ 2.00 GHz with ONNX Runtime, YOLO26n runs in 38.9 ms and YOLO11n in 56.1 ms. [V] — [YOLO26 docs](https://docs.ultralytics.com/models/yolo26/); [YOLO11 docs](https://docs.ultralytics.com/models/yolo11/)
- EfficientDet-Lite0 int8 runs in 29.31 ms on a Pixel 6 CPU. EfficientDet-Lite2 int8 runs in 70.91 ms. [V] — [MediaPipe](https://developers.google.com/edge/mediapipe/solutions/vision/object_detector)
- Roboflow describes RF-DETR as optimized for GPU edge devices (Jetson Orin). It says the DINOv2 backbone "cannot be compressed to that same degree" as YOLO, and it positions YOLO26 for CPU, Raspberry Pi and microcontroller runtimes. [3P] — [Roboflow RF-DETR vs YOLO](https://roboflow.com/blog/rf-detr-vs-yolo)
- A secondary blog lists YOLO26n (2.4M params, native CPU ONNX path) as the pick for mobile and embedded use, and contrasts it with RF-DETR-Nano's ~30.5M params. [3P] — [Codersera](https://codersera.com/blog/rf-detr-vs-yolo26-object-detection-comparison-2026/)

### Inferences
- The 8 inferences/s target (125 ms budget) is easy for YOLO26n on any recent iPhone, and probably on mid-range Android with GPU or NNAPI delegates. The prototype's laptop CPU numbers (~40 ms for YOLO11n) already show 3x headroom.
- RF-DETR Nano at 384 px is plausible on a modern phone GPU or NPU, but there is no public evidence either way. A one-day benchmark spike (ONNX Runtime Mobile with the CoreML or NNAPI execution provider, plus a TFLite conversion attempt) would settle it.

### Gaps
- I found no published mobile latency for RF-DETR, D-FINE, DEIMv2 or ECDet on CoreML, LiteRT/NNAPI or Qualcomm QNN.
- I found no independent (non-vendor) phone benchmark comparing YOLO26 with the DETRs.

## Export paths and React Native/Expo integration

### Takeaway
Ultralytics has the broadest one-line export: ONNX, CoreML, LiteRT/TFLite, OpenVINO and TensorRT. The DETR repos officially export ONNX (and TensorRT) only, so CoreML or TFLite needs community conversion. In React Native the practical runtimes are react-native-fast-tflite (with VisionCamera, using the CoreML/GPU delegates), ONNX Runtime React Native, and React Native ExecuTorch (.pte models).

### Cited Findings
- YOLO26 export formats include TensorRT, ONNX, CoreML, LiteRT and OpenVINO. [V] — [YOLO26 docs](https://docs.ultralytics.com/models/yolo26/). Roboflow notes YOLO26 has "clean ONNX and TFLite exports." — [Roboflow](https://roboflow.com/blog/rf-detr-vs-yolo)
- D-FINE exports with `tools/deployment/export_onnx.py` (onnx + onnxsim), then TensorRT through `trtexec --fp16`. It ships inference scripts for ONNX Runtime, TensorRT and PyTorch. — [D-FINE GitHub](https://github.com/Peterande/D-FINE)
- DEIMv2 has the same ONNX and TensorRT path. It recommends TensorRT 10.6 or later, because 10.4 may produce incorrect FP16 outputs. Through its Intel Geti integration it can export to OpenVINO IR with INT8. — [DEIMv2 GitHub](https://github.com/Intellindust-AI-Lab/DEIMv2)
- The RF-DETR README and the Roboflow comparison blog list no TFLite or CoreML export. The RF-DETR export docs URL I tried returned a 404 or a redirect. — [rf-detr GitHub](https://github.com/roboflow/rf-detr); [Roboflow](https://roboflow.com/blog/rf-detr-vs-yolo)
- react-native-fast-tflite v3.0.1 is built on Nitro Modules and requires react-native-nitro-modules. It integrates with VisionCamera frame processors, using vision-camera-resize-plugin for resizing. It supports GPU delegates (CoreML/Metal/OpenGL), and CoreML is enabled through an Expo config plugin option. — [npm react-native-fast-tflite](https://www.npmjs.com/package/react-native-fast-tflite)
- React Native ExecuTorch (Software Mansion, part of Meta's PyTorch Edge ecosystem) needs models in .pte format. — [npm/search summary](https://www.npmjs.com/package/react-native-fast-tflite); [DEV article](https://dev.to/eira-wexford/how-to-integrate-on-device-ai-models-in-react-native-apps-337d). That DEV article also claims a "TensorFlow Lite 2.15 Turbo" release in October 2026, which I could not verify; treat it as unreliable.

### Inferences
- In Strider the frames come from the ESP32 over Wi-Fi, not from the phone camera. So VisionCamera frame processors are not needed. The app needs a runtime that accepts a decoded RGB tensor from JS or native code: fast-tflite's `model.run(typedArray)`, onnxruntime-react-native, or react-native-executorch. JPEG decoding and resizing in native code will probably cost more than the model on a fast NPU.
- Each of these is a native module, so the app needs an Expo development build (not Expo Go), consistent with the project AGENTS.md.
- The lowest-risk path is YOLO26n to TFLite (for fast-tflite on Android and iOS, with CoreML enabled on iOS). For RF-DETR or D-FINE, ONNX through onnxruntime-react-native with the CoreML/NNAPI execution providers avoids a fragile ONNX-to-TFLite conversion of deformable attention.

### Gaps
- The React Native ExecuTorch object-detection docs page returned a 404. I could not confirm which detectors it ships (it was SSDLite-MobileNet in earlier versions, from memory and unverified) or whether it supports VisionCamera.
- I could not verify the onnxruntime-react-native version or execution-provider support (CoreML/NNAPI/QNN) this session.
- I found no source confirming that RF-DETR or D-FINE converts cleanly to TFLite or CoreML.

## Licensing and commercial implications

### Takeaway
Ultralytics (YOLO11, YOLO26, and YOLOv12 as listed) is AGPL-3.0. A closed-source commercial app needs a quoted Enterprise license, and Ultralytics asserts that fine-tuned weights are covered too. RF-DETR Nano through Large and D-FINE are Apache-2.0. DEIMv2 is now explicitly non-commercial, and RF-DETR's tiniest and largest sizes use Roboflow's PML 1.0.

### Cited Findings
- Ultralytics states that using YOLO code, models or training pipelines, including "trained/fine-tuned models," requires either open-sourcing the entire project under AGPL-3.0 (the "larger application," scripts, configs and, where applicable, weights) or buying an Enterprise License. It says "All Ultralytics YOLO trained models fall under the AGPL-3.0 License by default." It lists closed-source software and "embedded deployments in hardware, edge devices" as Enterprise cases. Pricing is quoted per organization, with no public price. [V, legal position of the licensor] — [Ultralytics License](https://www.ultralytics.com/license)
- RF-DETR: the package plus Nano through Large detection, all segmentation sizes, and keypoint are Apache-2.0. Atto, Femto, Pico, XL, 2XL and the NAS models are PML 1.0, which allows commercial use when deployed on Roboflow; self-hosted commercial use needs an Enterprise add-on. — [rf-detr GitHub](https://github.com/roboflow/rf-detr)
- D-FINE is Apache-2.0. Its README warns that Objects365-pretrained checkpoints (`*_obj365`, `*_obj2coco`) may fall under Objects365 dataset terms and are not commercially cleared. — [D-FINE GitHub](https://github.com/Peterande/D-FINE)
- DEIMv2's LICENSE.md is a custom non-commercial license: "Commercial Use of the DEIMv2 Materials is not permitted," including commercial products, hardware or software. Weights carry the same limits. Commercial use needs a separate license from Intellindust (Shenzhen), and the license is governed by PRC law. — [DEIMv2 LICENSE.md](https://github.com/Intellindust-AI-Lab/DEIMv2/blob/main/LICENSE.md)

### Inferences
- For a commercial closed-source app, the zero-cost, low-risk options are RF-DETR Nano, Small or Medium (Apache-2.0, with COCO-pretrained weights from Roboflow) and D-FINE trained from COCO-only weights. YOLO26n is viable only with an Ultralytics Enterprise license, budgeted early. The current prototype's YOLO11n also falls under AGPL.
- The DEIMv2 license may have changed after release (I recall it was Apache-2.0 at launch, unverified). Do not build on DEIMv2 or ECDet without a commercial agreement.
- Converting AGPL weights to ONNX or TFLite does not remove the AGPL obligation, under Ultralytics' stated position.

### Gaps
- No legal review. Whether a COCO-trained model inherits COCO image license terms (CC-BY mixed) is not addressed here.
- The RT-DETRv4 license was not verified from its official repo.

## Fine-tuning on a small custom dataset (sidewalk obstacles)

### Takeaway
RF-DETR is explicitly designed and benchmarked for fine-tuning transfer (RF100-VL), with the strongest published domain-transfer numbers among the small models. Ultralytics has the most turnkey tooling. D-FINE needs more configuration and warns that Objects365 pretraining can overfit simple class sets.

### Cited Findings
- RF100-VL AP50:95 (from the RF-DETR README) is 57.7 for Nano, 60.2 for Small and 61.2 for Medium, compared with 56.0 for Pico and 48.3 for Atto. [V] — [rf-detr GitHub](https://github.com/roboflow/rf-detr)
- The RF-DETR paper frames it as a "specialist" detector that uses weight-sharing NAS to find accuracy-latency tradeoffs for a target dataset after fine-tuning, and it revisits the NAS knobs to improve DETR transfer to diverse domains. RF-DETR 2XL beats GroundingDINO-tiny by 1.2 AP on RF100-VL at about 20x the speed. [V] — [arXiv 2511.09554](https://arxiv.org/abs/2511.09554)
- Roboflow claims YOLO "underperforms on unfamiliar data" on RF100-VL and that larger YOLO variants show little gain, but its blog gives no numbers. [3P, vendor-affiliated] — [Roboflow](https://roboflow.com/blog/rf-detr-vs-yolo)
- RF-DETR training is supported through the pip package, Colab notebooks and the Roboflow platform. — [rf-detr GitHub](https://github.com/roboflow/rf-detr)
- D-FINE custom training uses COCO-format data, `remap_mscoco_category: False` and `num_classes`, then `train.py -t model.pth`. Objects365 pretraining is recommended for complex scenes, but "if your categories are very simple, it might lead to overfitting." — [D-FINE GitHub](https://github.com/Peterande/D-FINE)

### Inferences
- With a few thousand sidewalk images, RF-DETR Nano or Small fine-tuned from COCO is likely the best accuracy-per-effort choice. DINOv2 features are known for strong transfer. Expect to measure higher training cost (GPU hours) than YOLO26n.
- YOLO26n with Ultralytics' `model.train(data=...)` remains the fastest iteration loop, and its STAL and ProgLoss target small objects. These are vendor-described features, not independently validated.

### Gaps
- I found no published head-to-head on small datasets (convergence epochs, data efficiency) between YOLO26 and RF-DETR or D-FINE.
- I found no sidewalk or assistive-navigation benchmark results for any of these models.

## Robustness: low resolution, motion blur, low light, small and thin objects

### Takeaway
I found no source that benchmarks these models on motion blur, low light, or thin-object recall (poles, branches). The only relevant signals are vendor design claims (YOLO26 STAL for small targets) and native input resolutions.

### Cited Findings
- YOLO26 introduces STAL (Small-Target-Aware Label Assignment) and ProgLoss, which Ultralytics positions as improving small-object detection. [V] — [YOLO26 docs](https://docs.ultralytics.com/models/yolo26/)
- RF-DETR Nano runs natively at 384x384 and Small at 512x512. Pico runs at 560. [V] — [rf-detr GitHub](https://github.com/roboflow/rf-detr)

### Inferences
- The OV2640 at VGA (640x480), after MJPEG compression on a walking wearer, will produce blur and compression artifacts. Augmentation (motion blur, JPEG quality, gamma or low-light) during fine-tuning matters more than the choice of architecture. Thin vertical obstacles (poles, sign posts, branches) are a known weak spot for COCO-trained detectors, because COCO has few of those classes. Custom labels are required regardless of the model.
- Lower native input (RF-DETR Nano at 384 px) costs less upscaling from VGA but loses small, distant objects. For a navigation aid, the near-field (1–3 m) objects that matter are fairly large in frame, which reduces this concern.

### Gaps
- I found no robustness benchmarks (COCO-C, ExDark low-light, blur) for YOLO26, RF-DETR, D-FINE or DEIMv2 in this session.
- I found no thin-object or pole-specific detection results.

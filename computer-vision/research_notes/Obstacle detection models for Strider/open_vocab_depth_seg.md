# Vision models beyond fixed-class detection for Strider (open-vocab, depth, walkable-path segmentation, small VLMs)

Context: a chest-worn ESP32-CAM (OV2640, about VGA, monocular) streams to a phone (React Native/Expo) or a laptop CPU. Hazard inference must run locally at about 8 Hz. Research cutoff: November 2026. Numbers labelled "vendor/author" come from the people who built the model. Numbers labelled "independent" come from third parties.

## Open-vocabulary / promptable detectors: can they run on-device in real time, are they reliable for sidewalk classes, can prompts be baked in, and what are the licenses?

### Takeaway
YOLOE (ICCV 2025) is the strongest fit. With the text prompts re-parameterized into the head, it becomes an ordinary YOLOv8/YOLO11-shaped model and runs at 64–73 FPS on an iPhone 12 (S size, CoreML, author-reported). That is well above 8 Hz. Its license, however, is AGPL-3.0. Grounding DINO 1.5 Edge reaches only about 10 FPS on a Jetson Orin NX and is gated behind an API token, so it is not a phone option. No published work measures open-vocabulary detectors on sidewalk classes such as bollards and poles for blind users.

### Cited Findings
- YOLOE unifies detection and segmentation with text prompts, visual prompts and a prompt-free mode. Text prompts use RepRTA (re-parameterizable region-text alignment). A single SwiGLU FFN refines the text embeddings during training and is then folded into the classification head, so the deployed model is "identical to the original YOLO architecture" with "zero overhead for deployment and transferring" — [YOLOE paper, arXiv 2503.07465v2](https://arxiv.org/html/2503.07465v2)
- YOLOE zero-shot LVIS minival AP (text prompts), author-reported: v8-S 27.9, v8-M 32.6, v8-L 35.9; 11-S 27.5, 11-M 33.0, 11-L 35.2. YOLO-Worldv2 scores 24.4 / 32.4 / 35.5 for S/M/L — [arXiv 2503.07465v2](https://arxiv.org/html/2503.07465v2)
- YOLOE FPS on T4 TensorRT / iPhone 12 CoreML, author-reported: v8-S 305.8 / 64.3; v8-M 156.7 / 41.7; v8-L 102.5 / 27.2; 11-S 301.2 / 73.3; 11-M 168.3 / 39.2; 11-L 130.5 / 35.1. YOLO-Worldv2 S/M/L on the same setups: 216.4 / 48.9, 117.9 / 34.2, 80.0 / 22.1 — [arXiv 2503.07465v2](https://arxiv.org/html/2503.07465v2)
- YOLOE's prompt-free mode (LRPC) names objects from a built-in vocabulary of 4,585 tags and needs no language model. YOLOE-v8-L scores 27.2 AP in this mode — [arXiv 2503.07465v2](https://arxiv.org/html/2503.07465v2)
- YOLOE is trained on Objects365 v1 plus GoldG (GQA, Flickr30k), with COCO images excluded. Masks are pseudo-labels from SAM-2.1. Text-prompt training took 12–22.5 h on 8x RTX 4090, versus 41.7–80 h for YOLO-Worldv2 — [arXiv 2503.07465v2](https://arxiv.org/html/2503.07465v2)
- Grounding DINO-T reaches 27.4 LVIS AP with 172M parameters. YOLOE-v8-S reaches 27.9 AP with 12M — [arXiv 2503.07465v2](https://arxiv.org/html/2503.07465v2)
- The YOLOE repo is licensed AGPL-3.0. Checkpoints are on HF (jameslahm/yoloe) for v8/11 S/M/L at 640 input, roughly 10M–45M params, plus prompt-free "-seg-pf" variants. Export targets are ONNX and CoreML; the README does not mention TFLite. The model loads via `from ultralytics import YOLOE` — [THU-MIG/yoloe GitHub](https://github.com/THU-MIG/yoloe)
- The YOLOE paper was accepted at ICCV 2025 — [ICCV 2025 open access](https://openaccess.thecvf.com/content/ICCV2025/html/Wang_YOLOE_Real-Time_Seeing_Anything_ICCV_2025_paper.html)
- Grounding DINO 1.5 Edge runs at "over 10 FPS" at 640x640 on an NVIDIA Orin NX, per the authors. The often-quoted 75.2 FPS figure is TensorRT on an A100, not an edge device. One secondary table lists 5.5 FPS for the 800-px variant on Orin NX — [Grounding DINO 1.5 paper, arXiv 2405.10300](https://www.arxiv.org/abs/2405.10300); [The Batch summary](https://www.deeplearning.ai/the-batch/grounding-dino-1-5-an-edge-device-model-built-for-faster-smarter-object-detection)
- The Grounding DINO 1.5 API repo is Apache-2.0, but running the model needs an API token from DeepDataSpace — [IDEA-Research/Grounding-DINO-1.5-API](https://github.com/idea-research/grounding-dino-1.5-api)
- Assistive use of YOLO-World so far is prototypes only. These include an arXiv framework that pairs YOLO-World with an LLM for obstacle and safety notifications ([arXiv 2403.12415](https://arxiv.org/html/2403.12415v1)), a 2025 IJRPR webcam prototype with a custom obstacle vocabulary and ahead/left/right cues and no custom-dataset evaluation ([IJRPR](https://ijrpr.com/uploads/V7ISSUE10/IJRPR71222.pdf)), and a January 2026 wearable that uses YOLO-World for product finding, with BLV user studies still planned ([arXiv 2601.12486](https://arxiv.org/pdf/2601.12486))
- A comparison of seven closed-set YOLO variants for outdoor obstacle detection for visually impaired people found YOLO-NAS suboptimal despite being the newest. It did not cover open-vocabulary models — [arXiv 2312.07571](https://arxiv.org/pdf/2312.07571)

### Inferences
- The plan that works: prompt YOLOE-11-S (or v8-S) with Strider's hazard list ("pole", "bollard", "e-scooter", "construction barrier", "traffic cone", "tree branch", "stairs", ...), re-parameterize, and export a fixed ONNX/CoreML model. At runtime it behaves like the current YOLO pipeline, so the existing tensor parser, letterbox and NMS could probably be reused with a different class count.
- Better still: use the open-vocabulary model as a pseudo-labeller or starting point, then fine-tune on a small Strider-collected chest-height dataset. LVIS AP of about 28 for S models means zero-shot recall on rare classes like "bollard" will be inconsistent.
- AGPL-3.0 (YOLOE, and Ultralytics generally) is a real obstacle for a closed-source commercial app. It needs either an Ultralytics enterprise license or a permissively licensed alternative (see Gaps).
- Open-vocabulary boxes do not help with ground-plane hazards: curbs, drop-offs, potholes. Those need depth and segmentation (below).

### Gaps
- I did not verify current licenses or mobile latency for YOLO-World v2 (believed GPL-3.0, Tencent AILab), OWLv2 (believed Apache-2.0 via HF transformers), or OmDet-Turbo (believed Apache-2.0) in this session. Fetch their repos before relying on them. OWLv2 is ViT-based and widely regarded as too slow for 8 Hz on a phone, but I found no measured phone number.
- I found no benchmark of any open-vocabulary detector on sidewalk-specific classes (bollard, pole, e-scooter, low branch) from a chest-height view. Every reliability claim for those classes is unmeasured.
- I did not find any 2026 open-vocabulary detector newer than YOLOE with a verified mobile benchmark. I searched only lightly.
- The THU-MIG README does not say whether the iPhone 12 FPS includes NMS or pre- and post-processing.

## Monocular depth: mobile latency, metric vs relative, usefulness for drop-offs, curbs, stairs and time-to-collision, failure modes, licenses

### Takeaway
Depth Anything V2 Small (24.8M params, Apache-2.0) is the proven phone option. Apple's CoreML conversion runs in about 31–34 ms on the iPhone 12 Pro Max and 15 Pro Max Neural Engine (vendor-reported). That fits under the 125 ms budget for 8 Hz. Depth Anything 3 (November 2025) Small and Base are also Apache-2.0. The Base/Large/Giant variants of V2 and the Large/Giant variants of DA3 are CC-BY-NC. The Small models output relative depth, so metric distance needs a DA3METRIC model (Apache, but Large size, 0.35B) or a calibration step.

### Cited Findings
- Depth Anything V2 licenses: Small (24.8M) is Apache-2.0; Base (97.5M), Large (335.3M) and Giant (1.3B) are CC-BY-NC-4.0. Smaller metric-depth models based on V2-Small and V2-Base were released on 2024-06-22 in the `metric_depth` directory — [DepthAnything/Depth-Anything-V2 GitHub](https://github.com/DepthAnything/Depth-Anything-V2)
- Apple's CoreML Depth Anything V2 Small (Float16, 24.8M params, 49.8 MB): about 31.10 ms on iPhone 12 Pro Max (iOS 18.0) and about 33.90 ms on iPhone 15 Pro Max (iOS 17.4), mostly on the Neural Engine; M3 Max 24.58 ms. Evaluation images were stretched to 518x396 — [apple/coreml-depth-anything-v2-small model card](https://huggingface.co/apple/coreml-depth-anything-v2-small)
- Depth Anything V1 Small took about 116 ms on iPhone 15 Pro Max (Neural Engine), much slower than the V2 conversion — [apple/coreml-depth-anything-small card](https://huggingface.co/apple/coreml-depth-anything-small/blob/refs%2Fpr%2F5/README.md)
- Qualcomm AI Hub lists Depth Anything V2 Small (518x518, 24.7M, 94.3 MB float, MIT per that page) but shows no latency figures. The page says the model is "currently not supported" on the listed chipsets — [Qualcomm AI Hub depth_anything_v2](https://aihub.qualcomm.com/models/depth_anything_v2). Note: this license field (MIT) conflicts with the upstream Apache-2.0.
- Depth Anything 3 (ByteDance-Seed) released code and models on 2025-11-14, with new models and DA3-Streaming on 2025-12-11. Variants: DA3-SMALL 0.08B Apache-2.0, DA3-BASE 0.12B Apache-2.0, DA3METRIC-LARGE 0.35B Apache-2.0 (metric: `metric_depth = focal * net_output / 300`, focal in pixels), DA3MONO-LARGE 0.35B Apache-2.0. DA3-LARGE, DA3-GIANT and the NESTED variants are CC BY-NC 4.0. The "-1.1" checkpoints were retrained after a training bug and replace the originals. The repo gives no latency numbers — [ByteDance-Seed/Depth-Anything-3 GitHub](https://github.com/ByteDance-Seed/Depth-Anything-3)
- Qualcomm AI Hub lists DA3 small (24.7M, 518x518, 94.3 MB float, Apache-2.0) but gives no latency and says it is "not supported on any Mobile chipset", which contradicts the device list on the same page — [Qualcomm AI Hub DA3](https://aihub.qualcomm.com/mobile/models/depth_anything_v3)
- Community conversions of DA3-Small exist: CoreML 504x504 (about 44 MB, iOS 17+) and LiteRT FP16 for Android, both stating Apache-2.0 — [CoreML conversion](https://huggingface.co/mlboydaisuke/Depth-Anything-3-Small-CoreML); [litert-community/Depth-Anything-3-Small](https://huggingface.co/litert-community/Depth-Anything-3-Small)

### Inferences
- Relative (affine-invariant) depth from V2-Small or DA3-Small is enough for some cues. Examples: a sudden depth discontinuity in the lower-centre ground band (drop-off, stair-down, curb edge), and an object's depth falling over successive frames, a relative time-to-collision proxy. Metric distance ("2 m ahead") needs scale. Options: (a) a fixed camera height and tilt on the chest plus a ground-plane fit, which gives scale per frame; (b) a metric model (DA3METRIC-LARGE at 0.35B is likely too heavy for 8 Hz on a phone, unverified); (c) the V2-Small metric fine-tunes.
- Depth at about 30 ms on an iPhone NPU plus a detector at about 15 ms is plausible within an 8 Hz budget on recent iPhones. Android numbers remain unverified.
- Expected failure modes (not measured here, general knowledge): glass and reflections, low light and OV2640 noise, motion blur from walking, and thin structures (poles, branches) being smoothed into the background. Testing on real ESP32-CAM frames is essential.

### Gaps
- I did not verify Metric3D v2, Apple Depth Pro, UniDepth (v2) or MiDaS in this session: licenses, mobile latency, existence of small variants. Depth Pro is about 0.5B params and is not expected to reach 8 Hz on a phone, but that is unverified.
- No measured Android (NNAPI/QNN/LiteRT) latency for V2-Small or DA3-Small was found. Qualcomm pages show none.
- I found no published accuracy figures for monocular depth on curb or drop-off detection, or on time-to-collision, from a chest-mounted camera.

## Segmentation for walkable path / free space: models and mobile speed

### Takeaway
The most directly relevant evidence is a July 2026 paper (SENSATION-DS) that trained chest-height sidewalk/road segmenters for blind navigation and benchmarked them on Android. The fastest, DeepLabV3+-MobileNetV3, reached only about 7.4 FPS at 512x384 on a phone, which is borderline for 8 Hz. Unsafe "road labelled as sidewalk" errors were about 8% for that model. Walkable-path segmentation is feasible, but it has to run at reduced resolution or rate, and it needs domain-specific training data.

### Cited Findings
- SENSATION-DS: 2,752 chest-height pedestrian-view image-mask pairs with a nine-class navigation taxonomy, plus external urban and sidewalk datasets mapped to the same labels. Five architectures were tested, with mask-conditioned synthetic images and SAM2 pseudo-labels; the SAM2 pseudo-labels more consistently reduced road-as-sidewalk errors. UPerNet-MobileNetV3 had the best mIoU (0.715 ± 0.006). DeepLabV3Plus-MobileNetV3 had the lowest Road-as-Sidewalk Error Rate (0.079) and was fastest on Android via ONNX at 7.383 FPS for 512x384 input. The authors say real-world benefit still needs validation with BLV users. CC BY 4.0 — [arXiv 2607.21137](https://arxiv.org/abs/2607.21137)
- CSN (compact segmentation network for assistive navigation): 60.99% mIoU on the TrueSight dataset, about 8.41M params, about 52.6 FPS (hardware not stated in the snippet) — [CSN, HBKU](https://elmi.hbku.edu.qa/en/publications/csn-a-compact-semantic-segmentation-network-for-visual-scene-perc/)
- The TrueSight dataset and the LSS-Net lightweight pedestrian-lane segmentation model come from a University of Wollongong thesis — [UOW thesis](https://ro.uow.edu.au/articles/thesis/Deep_Learning_for_Assistive_Navigation_of_Vision-impaired_People/28693763)
- A 2025 Sensors paper describes joint obstacle detection and walkable-path segmentation on a Jetson Nano with an Intel D435i RGB-D camera. It reports 0.757 obstacle mAP and a 5.2 MB model — [MDPI Sensors 25(14):4518](https://www.mdpi.com/1424-8220/25/14/4518); [PMC copy](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12300176/)
- iOSPointMapper runs BiSeNetv2 on-device on an iPhone/iPad for sidewalk-feature segmentation, fused with LiDAR, GPS and IMU — [arXiv 2410.07926](https://www.arxiv.org/pdf/2410.07926)
- YOLOE also produces instance masks (the released models are "-seg"), with SAM-2.1 pseudo-labelled mask training — [YOLOE GitHub](https://github.com/THU-MIG/yoloe)

### Inferences
- A practical Strider design: run walkable-surface segmentation at a lower rate (for example 2–4 Hz, at 256–384 px) to keep a "safe corridor" mask, and run the hazard detector at 8 Hz. Raise an alert when a detection or a depth discontinuity intersects the corridor.
- SENSATION-DS is the closest public match to Strider's viewpoint (chest-height). Check its dataset and license as a fine-tuning source.
- SAM-family models (MobileSAM, EfficientViT-SAM, SAM 2 small) seem better suited to offline labelling, as SENSATION-DS used SAM2, than to the 8 Hz loop.

### Gaps
- I did not verify mobile latency for PIDNet, DDRNet, SegFormer-B0, TopFormer, MobileSAM, EfficientViT-SAM or SAM 2-tiny in this session. CSN's FPS hardware is also unknown.
- I did not check the licenses of SENSATION-DS, TrueSight or SideGuide.
- No paper found evaluates curb, pothole or stair segmentation specifically from a low-cost wearable camera like the OV2640.

## Small VLMs: phone latency, scene description vs urgent alerts, hallucination risk

### Takeaway
Small VLMs are suitable only for non-urgent, on-demand scene description. Even Apple's FastVLM 0.5B is described only as "near real-time" on an iPhone 16 Pro without published millisecond figures. Walking-assistance VLM benchmarks consistently report high latency and weak risk assessment. A 7B hazard-tuned model takes 1.6–2.7 s end-to-end on a desktop GPU.

### Cited Findings
- FastVLM (Apple): LLM sizes 0.5B/1.5B/7B with the FastViTHD encoder. Time-to-first-token claims (vendor): 85x faster than LLaVA-OneVision-0.5B, 5.2x faster than SmolVLM (~0.5B), 21x faster than Cambrian-1-7B. The iPhone 16 Pro demo is built on MLX and called "near real-time"; no absolute TTFT is given. Code and checkpoints (MLX and CoreML on HF, added 2025-09-22) are at github.com/apple/ml-fastvlm — [Apple ML Research](https://machinelearning.apple.com/research/fast-vision-language-models); [arXiv 2412.13303](https://arxiv.org/html/2412.13303v2)
- An unverified blog claims under 120 ms TTFT for FastVLM-0.5B on iPhone 16 Pro. I could not confirm this against Apple's material — [brightcoding blog](https://blog.brightcoding.dev/2025/09/17/fastvlm-the-breakthrough-in-on-device-vision-language-ai)
- WalkVLM (arXiv 2412.20903) built a blind-walking dataset of about 12k video-annotation pairs. The authors note that real-time streaming requires concise reminders, which is hard for VLMs with "redundant responses and low inference efficiency" — [arXiv 2412.20903](https://arxiv.org/abs/2412.20903v2)
- mmWalk / mmWalkVQA (more than 69k VQA triplets, 99 categories): open-source VLMs "struggle with risk assessment and navigational tasks" — [arXiv 2510.11520](https://arxiv.org/html/2510.11520v1)
- "Are LVLMs ready to guide BLV individuals?" cites high inference latency and compute as practical limits — [arXiv 2510.00766](https://arxiv.org/html/2510.00766v2)
- A hazard-tuned HAG-Qwen2.5-VL-7B averages 1.63 s end-to-end for "safe" outputs and 2.65 s for hazard outputs on an RTX A6000 (model-card figure) — [Friendli model page](https://friendli.ai/models/xcyuan/HAG-Qwen2.5-VL-7B-RU)
- A follow-up from the WalkVLM group (ICCV 2025 slides) says generative VLM assistants excel at free-form description but suffer from high reasoning latency for real-time outdoor navigation — [ICCV 2025 slides](https://iccv.thecvf.com/media/iccv-2025/Slides/934_hGfz4pB.pdf)

### Inferences
- Use a VLM only behind an explicit user request ("what's around me?") or for low-rate context such as reading a sign. Never put one in the hazard-alert path. Hallucinated "clear path" statements are a safety risk.
- On iOS, FastVLM-0.5B via CoreML/MLX is the most credible on-device candidate. On Android, no verified latency was found.

### Gaps
- I did not verify current phone latencies or licenses for Moondream (2/3), SmolVLM/SmolVLM2, Florence-2, Gemma 3n, Qwen2.5-VL-3B or Apple Foundation Models in this session.
- I found no quantitative hallucination-rate measurements for small VLMs on sidewalk scenes.
- The FastVLM license was not checked. Apple's page does not state it.

## Research systems combining detection + depth + segmentation for blind navigation

### Takeaway
Combined systems exist, but most use real depth sensors (RealSense) on Jetson-class hardware rather than monocular depth on a phone. Reported metrics are technical (mAP, mIoU, FPS); no blind-user outcome data was found for a monocular, phone-tethered design like Strider's.

### Cited Findings
- Jetson Nano + Intel D435i + servo haptics: joint obstacle detection (0.757 mAP) and walkable-path segmentation, 5.2 MB model — [MDPI Sensors 2025](https://www.mdpi.com/1424-8220/25/14/4518); [Preprints.org](https://www.preprints.org/manuscript/202505.0976)
- Sight Guide (Cybathlon 2024 Vision Assistance Race) is a wearable that fuses multiple RGB and depth sensors — [UZH RPG PDF](https://rpg.ifi.uzh.ch/docs/Cybathlon_arxiv25.pdf)
- SENSATION-DS is a smartphone (Android/ONNX) sidewalk segmentation system for BLV users. It is evaluated offline and on-device; user validation is pending — [arXiv 2607.21137](https://arxiv.org/abs/2607.21137)
- A YOLO-World + LLM framework provides hazard notifications and scene description for BLV users — [arXiv 2403.12415](https://arxiv.org/html/2403.12415v1)

### Inferences
- A Strider stack consistent with this evidence: (1) YOLOE-S with prompts baked into a fixed hazard vocabulary, or a fine-tuned YOLO, at 8 Hz; (2) Depth Anything V2-Small or DA3-Small (Apache) for drop-offs and approach cues at 4–8 Hz; (3) a MobileNetV3 walkable-surface segmenter at 2–4 Hz; (4) an optional VLM on demand. The phone, not the laptop CPU, is the deployment target. Laptop CPU speed for these models was not measured.

### Gaps
- No combined monocular detection + depth + segmentation system with measured end-to-end phone latency, or with BLV user-study results, was found.
- Sight Guide's results (race score, latency) were not extracted.

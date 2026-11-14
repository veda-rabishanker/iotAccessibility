# Datasets, Pretrained Checkpoints, and Fine-tuning Recipe for Sidewalk / Blind-Navigation Obstacle Detection (Strider)

Scope note: about 17 search/fetch calls (as of 2026-11-14). Several license facts could not be confirmed from primary sources and are flagged. Anything not backed by a citation is in Inferences or Gaps.

## Q1. Which public datasets cover sidewalk/pedestrian-view obstacles, and what are their license, size, classes, viewpoint, and geography?

### Takeaway
The datasets built for visually impaired (VI) users are small (5K–30K images), geographically narrow (Korea, Japan, China), and often research-only. SideGuide is explicitly non-commercial. The large datasets with permissive licenses (Open Images V7, Objects365, LVIS) cover only some of the hazard classes, mostly from non-egocentric viewpoints. Street-scene segmentation sets (Mapillary Vistas, and Cityscapes, which was not verified) cover poles and traffic cones well but appear to be non-commercial or paid for commercial products. For a commercial product, the realistic path is permissive large-vocabulary pretraining plus the team's own chest-cam footage.

### Cited Findings

**VI / sidewalk-specific datasets**
- **SideGuide (KAIST, IROS 2020):** 350K images with bounding boxes, 100K with polygon masks, and 180K stereo pairs with disparity. Target objects were chosen from interviews with impaired people, and the dataset is sidewalk-focused rather than road-focused. Geography is Korea. — [SideGuide project page](https://ytaek-oh.github.io/sideguide); [KAIST EE](https://ee.kaist.ac.kr/en/ai-in-signal/18498/)
- **SideGuide license:** Access is by request form only. The terms say the dataset "shall be used for non-commercial research purposes only" and forbid distributing, selling, or sublicensing "any portion … or any derived data", under Korean law. **Not usable for a commercial product, and arguably not even for derived weights.** — [SideGuide request form](https://docs.google.com/forms/d/e/1FAIpQLScBmoVoj0d-omBOVCHGjhRislXP0TYzRqaUJOmJcqN6ylQcxQ/viewform)
- **VIDVIP (Japan):** a sidewalk-travel obstacle dataset with 538,747 instances across 32,036 images in 39 classes (as of May 2021). The CC BY-ND 4.0 license is for the article; the dataset's own terms were not found. — [J. Robotics & Mechatronics](https://www.jstage.jst.go.jp/article/jrobomech/33/5/33_1135/_article/-char/en)
- **WOTR ("A dataset for the visually impaired walk on the road"):** about 13,928 images and about 190K annotated objects, with 15 obstacle categories and 5 road-judging categories. Geography is China. — [Academia.edu copy](https://www.academia.edu/115136569/A_dataset_for_the_visually_impaired_walk_on_the_road); [PMC article](https://pmc.ncbi.nlm.nih.gov/articles/10865199)
- **WOTR-derived Roboflow project "wotr_v3_phase2":** 25 classes, including crosswalk, tactile pavement, reflective cone, roadblock, pole, and vehicles. Listed license is **CC BY 4.0**. The original WOTR license is not confirmed, so the Roboflow relabel's provenance should be checked. — [Roboflow Universe](https://universe.roboflow.com/objectdetection-rfyr2/wotr_v3_phase2)
- **MDPI *Data* 2023 (8(2):42):** a dataset of street public objects for VI navigation, listed as CC BY 4.0. It was not confirmed whether this is the same as WOTR. — [MDPI Data](https://www.mdpi.com/2306-5729/8/2/42); [DOAJ](https://doaj.org/article/0a18ea590b41447ca964972e69a594c5)
- **TFP-YOLO custom sidewalk dataset (Sensors, 2025):** captured on Beijing sidewalks, 8,929 train and 1,078 val images, video frames at 640×640 in sunny, rainy, and snowy weather. Classes are pedestrians, cars, bicycles, crosswalks, traffic lights, poles, and traffic cones (the paper says "eight" but lists seven). Download is via github.com/zzw0709/TFP-YOLO. Viewpoint height and license are not stated. — [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC12473299/)
- **PESID (sidewalk dataset, Multimedia Tools & Applications 2024):** 8 obstacle classes, with explicit attention to edges, slopes, and holes, which the authors say other sidewalk datasets overlook. Described as publicly available. License not verified. — [Springer](https://link.springer.com/article/10.1007/s11042-024-20521-3)
- **PC-CS-YOLO (Sensors, Jan 2025):** uses a public road-obstacle dataset of about 8,120 images for VI walking obstacles. — [DOI 10.3390/s25020534](https://doi.org/10.3390/s25020534)
- **GuideTWSI (arXiv 2603.07060, March 2026):** tactile walking surface indicators (directional bars and truncated domes) from synthetic and real images. It targets robot-relevant egocentric and top-down viewpoints. The authors argue that models trained only on bars miss domes, causing missed detections and false stops. The paper is CC BY 4.0, but the dataset license is not stated on the abstract page. — [arXiv](https://arxiv.org/abs/2603.07060)
- **Smartphone safety-oriented sidewalk/road segmentation for assistive navigation (arXiv 2607.21137, 2026):** surfaced in search but not read in detail. — [arXiv](https://arxiv.org/pdf/2607.21137)

**Pedestrian traffic light / zebra crossing**
- **ImVisible / PTL dataset + LytNet (CAIP '19, ICCV-W '19):** 5,059 Shanghai intersection images (3,456 train, 864 val, 739 test), full resolution 4032×3024. Labels are light state (Red, Green, Countdown Green, Countdown Blank, None) plus zebra-crossing midline endpoints. The repository is listed as **MIT**. — [GitHub ImVisible](https://github.com/samuelyu2002/ImVisible)
- **Other pedestrian-traffic-light sets** (licenses not checked): the Mendeley "Dataset for Pedestrian Traffic Lights detection", the Ampel-Pilot dataset (Germany), and several Roboflow Universe pedestrian-light projects. — [Mendeley](https://data.mendeley.com/datasets/9tm59d3nsn); [Ampel-Pilot](https://github.com/patVlnta/Ampel-Pilot-Dataset); [Roboflow](https://universe.roboflow.com/projectscomputervison/pedestrian-light)

**Large general datasets**
- **Open Images V7:** about 9M images (9,011,219 train), 600 boxable classes, about 16M boxes. **Annotations are CC BY 4.0 (Google); images are listed as CC BY 2.0.** This is commercially friendly with attribution. — [Open Images V7 facts](https://storage.googleapis.com/openimages/web/factsfigures_v7.html)
- **Open Images V7 boxable classes checked against Strider's hazards:**
  - **Present:** Fire hydrant, Stairs, Bench, Street light, Traffic light, Traffic sign, Parking meter, Bicycle, Stop sign, Car, Person, Wheelchair, Dog, Door, Tree, Billboard, Motorcycle, Segway, Unicycle, Skateboard, Ladder.
  - **Absent:** Traffic cone, Scooter, Pole, Bollard, Stroller.
  - Source: [oidv7-class-descriptions-boxable.csv](https://storage.googleapis.com/openimages/v7/oidv7-class-descriptions-boxable.csv)
- **Objects365:** about 2M images, 365 categories, about 30M boxes (Megvii, ICCV 2019). The overview page states **no license or terms**, only a request to cite the paper. — [objects365.org overview](https://www.objects365.org/overview.html)
- **LVIS:** more than 1,200 categories on COCO images. Annotations are commonly listed as CC BY 4.0, but the Voxel51 card says "Custom License … freely available for research use". The conflict is unresolved. Whether cone or bollard categories exist was not confirmed. — [Purdue RCAC](https://docs.rcac.purdue.edu/datasets/ai/LVIS/); [Voxel51](https://docs.voxel51.com/dataset_zoo/datasets_hf/lvis.html)
- **Mapillary Vistas:**
  - v2.0 has 124 semantic categories (70 instance-annotated), up from 66 in v1.2. — [Mapillary blog 2021](https://blog.mapillary.com/update/2021/01/18/vistas-2-dataset.html)
  - Label names in mmseg's Vistas class list include 'Pole', 'Pole Group', 'Utility Pole', 'Street Light', 'Traffic Sign Frame', and 'Traffic Cone'. The version was not confirmed. — [mmseg mapillary.py](https://huggingface.co/codyshen/Human_parser/blob/main/head_extractor/src/mmseg/datasets/mapillary.py)
  - **Licensing:** In 2017, Mapillary said Vistas was free for research but "if anyone wants to build the results into commercial products, they must pay a commercial license". — [TechCrunch 2017](https://techcrunch.com/2017/05/03/mapillary-open-sources-25k-street-level-images-to-train-automotive-ai-systems)
  - A third-party catalog lists the license as Non-Commercial. — [hyper.ai](https://hyper.ai/en/datasets/17342)
  - In 2018 some new classes (barriers went from 6 to 12) were released to the commercial edition first. — [Mapillary blog 2018](https://blog.mapillary.com/update/2018/07/30/mapillary-vistas-dataset-extension.html)
  - **The current official v2 license text was not found.**

### Inferences
- **Viewpoint:**
  - Most VI datasets above were collected by walking with phones or body cameras, which matches Strider better than dashcam data. Mapillary Vistas mixes car, bike, and pedestrian captures. Cityscapes is dashcam only (from background knowledge, not verified here).
  - Chest-height VGA ESP32-CAM images (low dynamic range, motion blur, JPEG artifacts) are a domain shift from all of these datasets.
- **License buckets for commercial use:**
  - **Likely usable:** Open Images V7 (CC BY 4.0 / CC BY 2.0), ImVisible (MIT), wotr_v3_phase2 Roboflow (CC BY 4.0, provenance unchecked), and the MDPI Data dataset (CC BY 4.0).
  - **Unclear:** Objects365, LVIS, VIDVIP, TFP-YOLO, and PESID.
  - **Not usable without a deal:** SideGuide and Mapillary Vistas (research edition).
  - Cityscapes and ADE20K are widely understood to be non-commercial, but neither was verified in this session.
- **Gap-filling plan:** No permissive dataset has bollard, e-scooter, open car door, low branch, or drop-off/curb edge as detection classes. These will need Strider's own footage, possibly augmented with Roboflow Universe projects after a license check of each one.

### Gaps
- Not verified this session: Cityscapes, ADE20K, Ego4D (which needs a license agreement), and the RF100 licenses.
- No primary source was found for the Objects365 license.
- The LVIS class list and its license conflict were not resolved.
- Did not verify the Roboflow Universe sidewalk projects beyond wotr_v3_phase2.
- "VIN" and "PathFinder" datasets: no reliable source surfaced in the searches run.
- Viewpoint and camera height are not documented for most VI datasets.

## Q2. Are there pretrained models already fine-tuned for VI sidewalk obstacles? Architecture and reported accuracy?

### Takeaway
There are many academic YOLO variants with high in-domain mAP, but they are trained on small single-city datasets and typically released without clear licenses or ready-to-use weights. None is a drop-in, commercially licensed sidewalk-hazard detector. LytNet (MIT) is the one directly reusable model, for pedestrian lights and crosswalk direction.

### Cited Findings
- **TFP-YOLO (Sensors 2025):**
  - **Architecture:** YOLOv8n with Triplet Attention, a Triple Feature Encoding module, an extra P2 small-object head, and Wise-IoU v3. 2.49M params and 12.8 GFLOPs, against YOLOv8n's 3.01M / 18.0G.
  - **Results:** mAP@0.5 93.9% on its Beijing sidewalk set (YOLOv8n 89.8%), with precision 90.2% and recall 89.8%. On TSDD: mAP50 91.6% and mAP50:95 52.8%.
  - **Deployment:** 28.7 FPS on a Jetson Orin Nano Super at 8.7 W.
  - Source: [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC12473299/)
- **PC-CS-YOLO (Sensors 2025):** a YOLO11-based detector for VI walking obstacles, trained on an approximately 8,120-image road-obstacle dataset. Specific metrics were not extracted. — [DOI](https://doi.org/10.3390/s25020534)
- **YOLO-Extreme (Sensors 2025):** YOLOv12-based, for VI obstacle detection in fog, evaluated on RTTS and Foggy Cityscapes. — [PMC](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12300934/)
- **YOLOv5 outdoor VI navigation with transfer learning (MTAP 2024):** uses the PESID sidewalk dataset with 8 classes. — [Springer](https://link.springer.com/article/10.1007/s11042-024-20521-3)
- **LytNet V2 (ImVisible, MIT):**
  - **Light-state precision:** Red 0.98, Green 0.95, Countdown Green 0.99, Countdown Blank 0.93.
  - **Light-state recall:** 0.96 to 0.97.
  - **Zebra-crossing angle error:** 6.15°.
  - **Speed:** V1 runs at about 21 fps on an iPhone 7.
  - Source: [GitHub](https://github.com/samuelyu2002/ImVisible)

### Inferences
- Reported mAPs above 90% are in-distribution scores on small single-city test sets. They will likely not transfer to US/EU chest-cam VGA footage, so treat them as architecture hints (P2 small-object head, attention), not as deployable weights.
- Any model derived from Ultralytics YOLOv8/11/12 code inherits AGPL-3.0 unless Ultralytics is paid for a commercial license (see Q3).

### Gaps
- Did not find a public, commercially licensed checkpoint trained on VI sidewalk obstacles.
- Did not verify whether the TFP-YOLO or PC-CS-YOLO repos release weights or carry a license.

## Q3. Objects365 / LVIS-pretrained checkpoints as better starting weights than COCO

### Takeaway
The cleanest commercial option is the **D-FINE or RT-DETR Objects365-pretrained checkpoints (Apache-2.0 code and weights)**. They exist as Objects365-only and Objects365→COCO variants and fine-tune well. Ultralytics Objects365 YOLO checkpoints exist but are AGPL-3.0. A third-party "MIT" YOLO11n-Objects365 upload has a license that conflicts with its AGPL base.

### Cited Findings
- **D-FINE:**
  - The official repo publishes Objects365-pretrained S/M/L/X checkpoints and Objects365→COCO fine-tuned checkpoints. D-FINE-L and D-FINE-X reach 57.1% and 59.3% COCO AP with Objects365 pretraining. — [D-FINE paper](https://arxiv.org/pdf/2410.13842v1)
  - Keras Hub presets include `dfine_small_obj365`, `dfine_medium_obj365`, and `dfine_small_obj2coco`. The model card states the weights are Apache 2.0. — [Keras HF card](https://huggingface.co/keras/dfine_medium_obj365/blob/main/README.md)
  - HF Transformers also supports D-FINE. — [HF docs](https://huggingface.co/docs/transformers/model_doc/d_fine)
  - Roboflow lists D-FINE code and weights as Apache-2.0. — [Roboflow compare](https://playground.roboflow.com/models/compare/d-fine-vs-rt-detr)
- **RT-DETR:** all variants (R18/50/101) were pretrained 12 epochs on Objects365 and then fine-tuned on COCO. This added +2.7, +2.2, and +1.9 AP on COCO val2017. RT-DETR is listed as Apache-2.0 (Baidu). — [RT-DETR paper](https://arxiv.org/pdf/2304.08069); [Roboflow compare](https://playground.roboflow.com/models/compare/d-fine-vs-rt-detr)
- **Ultralytics:** the docs offer Objects365-pretrained YOLO26n checkpoints (e.g., `yolo26n-objv1-150.pt`) for prediction or fine-tuning. Ultralytics models and configs are AGPL-3.0, and commercial use needs a purchased license. — [Ultralytics Objects365 docs](https://docs.ultralytics.com/datasets/detect/objects365); [Roboflow forum](https://discuss.roboflow.com/t/what-is-a-commercial-model-license-and-do-i-need-one/10352)
- **Community upload `NRtred/yolo11n_object365`:** tagged MIT but based on Ultralytics YOLO11, so the license claim is unverified and conflicting. — [HF](https://huggingface.co/NRtred/yolo11n_object365)
- **CerberusDet:** a YOLOv8x trained on VOC plus full Objects365, found on a mirror. License not checked. — [mirror](https://good23hfaccelerating.pages.dev/iitolstykh/cerberusdet-yolov8x-voc-o365-full)

### Inferences
- Objects365 adds sidewalk-relevant vocabulary that COCO lacks. From background knowledge, not verified here, that includes traffic cone, barricade, street lights, scooter, and fire hydrant.
- Even if the deployed head is retrained on Strider's own classes, Objects365-pretrained backbones should give better small-object and street-furniture features than COCO-only weights.
- **Licensing risk:** Objects365 states no license on its overview page. Weights trained on it carry some legal ambiguity even when the weights themselves are labeled Apache-2.0. Legal review is recommended.
- **Runtime fit:** the D-FINE-S and RT-DETR-R18 class of models is roughly in the same compute range as YOLOv8s. That fits laptop or phone inference better than the X/L variants.

### Gaps
- Not checked here: the Objects365 category list, whether LVIS-pretrained real-time detectors exist (e.g., YOLO-World/YOLOE LVIS weights), and the official RF-DETR license and pretraining data.

## Q4. Best practice for building a custom dataset from own wearable footage (counts, auto-labeling, active learning, evaluation)

### Takeaway
Auto-labeling is practical. Grounding DINO (Apache-2.0) is the safest commercial choice; YOLOE is faster but AGPL-3.0. Pre-label sampled ESP32-CAM frames with text prompts for each hazard class, then have humans review, train a D-FINE or RT-DETR student, and iterate with uncertainty-based sampling. The evaluation that matters is per-class recall on hazards within the alert distance, not mAP.

### Cited Findings
- **Grounding DINO:** an open-vocabulary detector from IDEA Research (March 2023) under **Apache 2.0**. Grounded SAM, which pairs it with SAM, is also Apache 2.0. Both are listed by Roboflow; the official repo was not checked. — [Roboflow compare](https://playground.roboflow.com/models/compare/grounding-dino-vs-yoloe)
- **YOLOE:**
  - YOLOE (THU, March 2025) is a real-time open-vocabulary detector supporting text, visual, and prompt-free modes. — [YOLOE paper](https://arxiv.org/html/2503.07465v2)
  - Roboflow lists it as **AGPL-3.0**. — [Roboflow YOLOE](https://playground.roboflow.com/models/thu-mig/yoloe)
  - A YOLO26-based YOLOE-26 exists as of August 2026. — [PyImageSearch](https://pyimagesearch.com/2026/08/24/yolo26-open-vocabulary-object-detection-with-yoloe-26/)
  - The `autodistill-yoloe` wrapper is MIT, but the model underneath remains AGPL. — [PyPI](https://pypi.org/project/autodistill-yoloe/)
- **Coverage concern from GuideTWSI:** subtype coverage matters. Training on one visual subtype (bars) caused missed detections of another (domes) and false stops. — [arXiv 2603.07060](https://arxiv.org/abs/2603.07060)

### Inferences (recommended recipe; not directly sourced, based on findings above plus standard practice)
1. **Capture:** record 10–20 hours of ESP32-CAM chest-height walking across target cities, seasons, day/night, and rain. Sample 1–2 fps and de-duplicate near-identical frames.
2. **Auto-label:**
   - Run Grounding DINO with prompts such as "bollard", "pole", "traffic cone", "construction barrier", "e-scooter", "parked bicycle", "fire hydrant", "open car door", "low tree branch", "stairs", "curb", "pothole", "crosswalk", and "pedestrian signal".
   - Keep confidence thresholds low to favor recall.
   - Use CVAT or Label Studio for human review.
   - Drop-off, curb, and pothole may need segmentation or depth rather than boxes.
3. **Seed with permissive data:**
   - Open Images V7 classes: Fire hydrant, Stairs, Bench, Street light, Traffic light, Traffic sign, Bicycle, Motorcycle, Wheelchair, Door.
   - ImVisible for pedestrian lights.
   - CC BY Roboflow sidewalk sets, after a provenance check.
   - Avoid SideGuide and the Mapillary research edition.
4. **Volume target:** start with about 300–500 reviewed instances per class from Strider's own footage, aiming for 1,500 or more for rare, safety-critical classes. These are rule-of-thumb figures with no source found.
5. **Model:** fine-tune D-FINE-S or RT-DETR-R18 from Objects365 weights (Apache-2.0), at the native VGA resolution.
6. **Active learning:** each round, mine frames where the student and the Grounding DINO teacher disagree, low-confidence frames, and user-reported misses. Review those and retrain.
7. **Evaluation:**
   - Keep a held-out set from different routes and cities.
   - Report per-class recall (missed-detection rate) for objects within about 3 m of the walking corridor.
   - Report false alarms per minute of walking, and time-to-first-detection before reaching the object, rather than mAP alone.

### Gaps
- No primary-source guidance was found on images-per-class for this domain.
- No published false-alarm-per-minute benchmarks for VI wearables were found.
- Did not verify Grounding DINO 1.5/1.6 licensing; the newer versions are API-only, from background knowledge, unverified.
- Did not research active-learning tooling specifics.

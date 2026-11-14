(function () {
  "use strict";

  var video = document.getElementById("video");
  var form = document.getElementById("camera-form");
  var input = document.getElementById("camera-url");
  var pill = document.getElementById("status-pill");
  var streamUrl = document.getElementById("stream-url");
  var detail = document.getElementById("detail");
  var cueEl = document.getElementById("cue");
  var cueMeta = document.getElementById("cue-meta");
  var modeSelect = document.getElementById("mode");
  var detectorSelect = document.getElementById("detector");
  var sourceWebcam = document.getElementById("source-webcam");
  var sourceEsp32 = document.getElementById("source-esp32");
  var viewBoxes = document.getElementById("view-boxes");
  var viewDepth = document.getElementById("view-depth");
  var speakToggle = document.getElementById("speak");
  var markFalse = document.getElementById("mark-false");
  var markMissed = document.getElementById("mark-missed");
  var markStatus = document.getElementById("mark-status");
  var submitButton = form.querySelector("button[type='submit']");

  var sourceKind = "webcam";
  var lastSpeech = "";
  var lastSpokenStamp = 0;
  var retryTimer = 0;
  var editing = false;

  var OFFLINE_DETAIL =
    "Camera unreachable. Join the Strider-CAM Wi-Fi, or enter the camera address.";
  var CROSSWALK_LINE = "Crosswalk lining-up is not estimated from this camera.";
  var DEPTH_LINE = "Steps, curbs, and drop-offs are only roughly estimated from this camera.";
  var NOTHING_LINE = "No obstacle detected. Keep using your cane.";

  function setPill(state) {
    var labels = { live: "Live", offline: "Camera unreachable", connecting: "Connecting" };
    pill.dataset.state = state;
    pill.textContent = labels[state] || "Connecting";
  }

  function showDetail(text) {
    detail.hidden = !text;
    detail.textContent = text || "";
  }

  function connectVideo() {
    video.src = "/webcam?t=" + Date.now();
  }

  function scheduleRetry() {
    window.clearTimeout(retryTimer);
    retryTimer = window.setTimeout(connectVideo, 2000);
  }

  function guidanceLine(data) {
    var reason = data.reason || "";
    var speech = data.speech || "";
    if (speech) {
      lastSpeech = speech;
    }
    if (reason === "unsteady") {
      return "Picture is not steady enough to guide.";
    }
    if (reason === "model-missing") {
      return "Detector weights are not on this computer yet.";
    }
    if (reason === "camera-missing") {
      return sourceKind === "esp32" ? "Waiting for the ESP32 camera." : "No webcam is available.";
    }
    if (reason === "pending") {
      return "Watching.";
    }
    if (reason === "holding") {
      return speech || lastSpeech;
    }
    if (speech) {
      return speech;
    }
    return NOTHING_LINE;
  }

  function cueText(data) {
    var line = guidanceLine(data);
    var mode = data.mode || "general";
    if (mode === "crosswalk") {
      return CROSSWALK_LINE + "\n" + line;
    }
    if (mode === "depth") {
      return DEPTH_LINE + "\n" + line;
    }
    return line;
  }

  function metaText(data) {
    var parts = [];
    if (data.kind === "obstacle" || data.reason === "holding") {
      if (data.distance) {
        parts.push(data.distance);
      }
      if (typeof data.confidence === "number") {
        parts.push("confidence " + data.confidence.toFixed(2));
      }
      if (data.source) {
        parts.push("from " + data.source);
      }
    }
    parts.push("detector " + (data.inference_ms || 0) + " ms");
    parts.push(data.depth_available ? "depth " + (data.depth_ms || 0) + " ms" : "depth model missing");
    return parts.join(" · ");
  }

  function speak(data) {
    if (!speakToggle.checked || !("speechSynthesis" in window)) {
      return;
    }
    if (data.kind !== "obstacle" || !data.speech || data.timestamp === lastSpokenStamp) {
      return;
    }
    lastSpokenStamp = data.timestamp;
    window.speechSynthesis.cancel();
    var utterance = new SpeechSynthesisUtterance(data.speech);
    utterance.rate = 1.1;
    window.speechSynthesis.speak(utterance);
  }

  async function refreshCue() {
    try {
      var response = await fetch("/api/cue", { cache: "no-store" });
      var data = await response.json();
      cueEl.textContent = cueText(data);
      cueMeta.textContent = metaText(data);
      speak(data);
      if (data.reason === "camera-missing") {
        setPill("offline");
        showDetail(sourceKind === "esp32" ? OFFLINE_DETAIL : "");
      } else {
        setPill("live");
        showDetail("");
      }
      if (data.detector && detectorSelect.value !== data.detector) {
        detectorSelect.value = data.detector;
      }
    } catch (err) {
      setPill("offline");
    }
  }

  async function postJson(url, body) {
    var response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    var data = {};
    try {
      data = await response.json();
    } catch (ignore) {
      data = {};
    }
    return { response: response, data: data };
  }

  async function loadDetectors() {
    try {
      var response = await fetch("/api/detectors", { cache: "no-store" });
      var data = await response.json();
      detectorSelect.innerHTML = "";
      data.detectors.forEach(function (d) {
        var option = document.createElement("option");
        option.value = d.name;
        option.textContent = d.available ? d.label : d.label + " (not exported)";
        option.disabled = !d.available;
        detectorSelect.appendChild(option);
      });
    } catch (err) {
      return;
    }
  }

  async function selectWebcam() {
    sourceKind = "webcam";
    sourceWebcam.checked = true;
    setPill("connecting");
    showDetail("");
    streamUrl.textContent = "webcam";
    try {
      await postJson("/api/source", { kind: "webcam", index: 0 });
    } catch (err) {
      setPill("offline");
    }
    connectVideo();
  }

  async function selectEsp32(url) {
    sourceKind = "esp32";
    sourceEsp32.checked = true;
    setPill("connecting");
    showDetail("");
    try {
      var result = await postJson("/api/source", { kind: "esp32", url: url });
      if (!result.response.ok) {
        setPill("offline");
        showDetail(result.data.detail || OFFLINE_DETAIL);
        return;
      }
      streamUrl.textContent = result.data.streamUrl || url;
      if (!editing && result.data.streamUrl) {
        input.value = result.data.streamUrl;
      }
    } catch (err) {
      setPill("offline");
      showDetail(OFFLINE_DETAIL);
      return;
    }
    connectVideo();
  }

  async function mark(kind, label) {
    try {
      var result = await postJson("/api/mark", { kind: kind });
      markStatus.textContent = result.response.ok ? label + " logged." : "Could not log.";
    } catch (err) {
      markStatus.textContent = "Could not log.";
    }
  }

  sourceWebcam.addEventListener("change", function () {
    if (sourceWebcam.checked) {
      selectWebcam();
    }
  });

  sourceEsp32.addEventListener("change", function () {
    if (sourceEsp32.checked) {
      selectEsp32(input.value.trim());
    }
  });

  [viewBoxes, viewDepth].forEach(function (radio) {
    radio.addEventListener("change", function () {
      if (radio.checked) {
        postJson("/api/view", { overlay: radio.value }).catch(function () {});
      }
    });
  });

  detectorSelect.addEventListener("change", function () {
    postJson("/api/detector", { name: detectorSelect.value }).then(refreshCue).catch(function () {});
  });

  modeSelect.addEventListener("change", function () {
    postJson("/api/mode", { mode: modeSelect.value }).then(refreshCue).catch(function () {});
  });

  speakToggle.addEventListener("change", function () {
    if (speakToggle.checked && "speechSynthesis" in window) {
      // A click is needed before the browser allows speech; confirm it works.
      window.speechSynthesis.speak(new SpeechSynthesisUtterance("Speech on."));
    }
  });

  markFalse.addEventListener("click", function () {
    mark("false-alert", "False alert");
  });
  markMissed.addEventListener("click", function () {
    mark("missed", "Missed obstacle");
  });

  input.addEventListener("focus", function () {
    editing = true;
  });
  input.addEventListener("blur", function () {
    editing = false;
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    submitButton.disabled = true;
    try {
      await selectEsp32(input.value.trim());
    } finally {
      submitButton.disabled = false;
    }
  });

  video.addEventListener("error", function () {
    scheduleRetry();
  });

  async function boot() {
    setPill("connecting");
    try {
      var response = await fetch("/api/camera", { cache: "no-store" });
      var data = await response.json();
      input.value = data.streamUrl || data.baseUrl || "";
    } catch (err) {
      input.value = "";
    }
    await loadDetectors();
    await selectWebcam();
    await refreshCue();
    window.setInterval(refreshCue, 500);
  }

  boot();
})();

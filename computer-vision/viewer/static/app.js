(function () {
  "use strict";

  var video = document.getElementById("video");
  var form = document.getElementById("camera-form");
  var input = document.getElementById("camera-url");
  var pill = document.getElementById("status-pill");
  var streamUrl = document.getElementById("stream-url");
  var detail = document.getElementById("detail");
  var cueEl = document.getElementById("cue");
  var modeSelect = document.getElementById("mode");
  var sourceWebcam = document.getElementById("source-webcam");
  var sourceEsp32 = document.getElementById("source-esp32");
  var submitButton = form.querySelector("button[type='submit']");

  var editing = false;
  var stickyError = false;
  var retryTimer = 0;
  var healthGeneration = 0;
  var sourceKind = "webcam";
  var lastSpeech = "";

  var OFFLINE_DETAIL =
    "Camera unreachable. Join the Strider-CAM Wi-Fi, or enter the camera address.";
  var CROSSWALK_LINE =
    "Crosswalk lining-up is not estimated from this camera.";
  var DEPTH_LINE =
    "Steps, curbs, and drop-offs are not estimated from this camera.";

  function setPill(state) {
    var label = "Connecting";
    if (state === "live") {
      label = "Live";
    } else if (state === "offline") {
      label = "Camera unreachable";
    }
    pill.dataset.state = state;
    pill.textContent = label;
  }

  function showDetail(text) {
    if (!text) {
      detail.textContent = "";
      detail.hidden = true;
      return;
    }
    detail.hidden = false;
    detail.textContent = text;
  }

  function connectStream() {
    video.src = "/stream?t=" + Date.now();
  }

  function connectWebcam() {
    video.src = "/webcam?t=" + Date.now();
  }

  function connectCurrent() {
    if (sourceKind === "webcam") {
      connectWebcam();
    } else {
      connectStream();
    }
  }

  function scheduleRetry() {
    window.clearTimeout(retryTimer);
    retryTimer = window.setTimeout(function () {
      if (!editing) {
        connectCurrent();
      }
    }, 2000);
  }

  function showStream(url) {
    streamUrl.textContent = url || "";
  }

  function cueText(data) {
    var reason = data.reason || "";
    var speech = data.speech || "";
    var mode = data.mode || "general";
    if (speech) {
      lastSpeech = speech;
    }
    if (mode === "crosswalk") {
      return speech ? CROSSWALK_LINE + "\n" + speech : CROSSWALK_LINE;
    }
    if (mode === "depth") {
      return speech ? DEPTH_LINE + "\n" + speech : DEPTH_LINE;
    }
    if (reason === "clear") {
      return "Nothing in your path.";
    }
    if (reason === "unsteady") {
      return "Picture is not steady enough to guide.";
    }
    if (reason === "model-missing") {
      return "Detector weights are not on this computer yet.";
    }
    if (reason === "camera-missing") {
      return "No webcam is available.";
    }
    if (reason === "holding") {
      return lastSpeech || "Nothing in your path.";
    }
    if (reason === "pending") {
      return "Watching.";
    }
    if (reason === "pass" || reason === "blocked") {
      return speech;
    }
    return speech || "Nothing in your path.";
  }

  async function refreshCue() {
    try {
      var response = await fetch("/api/cue", { cache: "no-store" });
      var data = await response.json();
      cueEl.textContent = cueText(data);
      if (sourceKind === "webcam") {
        if (data.reason === "camera-missing") {
          setPill("offline");
        } else if (pill.dataset.state !== "live") {
          setPill("live");
        }
      }
    } catch (err) {
      if (sourceKind === "webcam") {
        setPill("offline");
      }
    }
  }

  async function refreshHealth() {
    if (sourceKind === "webcam") {
      return;
    }
    var generation = ++healthGeneration;
    try {
      var response = await fetch("/api/health", { cache: "no-store" });
      var data = await response.json();
      if (generation !== healthGeneration) {
        return;
      }
      if (data.streamUrl) {
        showStream(data.streamUrl);
      }
      if (data.ok) {
        setPill("live");
        if (!stickyError) {
          showDetail("");
        }
      } else {
        setPill("offline");
        if (!stickyError) {
          showDetail(data.detail || OFFLINE_DETAIL);
        }
      }
    } catch (err) {
      if (generation !== healthGeneration) {
        return;
      }
      setPill("offline");
      if (!stickyError) {
        showDetail(OFFLINE_DETAIL);
      }
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

  async function selectWebcam() {
    sourceKind = "webcam";
    sourceWebcam.checked = true;
    stickyError = false;
    setPill("connecting");
    showDetail("");
    showStream("webcam");
    try {
      await postJson("/api/source", { kind: "webcam", index: 0 });
    } catch (err) {
      setPill("offline");
    }
    connectWebcam();
  }

  async function selectEsp32(url) {
    sourceKind = "esp32";
    sourceEsp32.checked = true;
    stickyError = false;
    setPill("connecting");
    showDetail("");
    try {
      var result = await postJson("/api/source", { kind: "esp32", url: url });
      if (!result.response.ok) {
        stickyError = true;
        setPill("offline");
        showDetail(result.data.detail || OFFLINE_DETAIL);
        return;
      }
      if (result.data.streamUrl) {
        showStream(result.data.streamUrl);
        if (!editing) {
          input.value = result.data.streamUrl;
        }
      }
    } catch (err) {
      setPill("offline");
      showDetail(OFFLINE_DETAIL);
      return;
    }
    connectStream();
    await refreshHealth();
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

  modeSelect.addEventListener("change", async function () {
    try {
      await postJson("/api/mode", { mode: modeSelect.value });
      await refreshCue();
    } catch (err) {
      return;
    }
  });

  input.addEventListener("focus", function () {
    editing = true;
    window.clearTimeout(retryTimer);
  });

  input.addEventListener("input", function () {
    editing = true;
  });

  input.addEventListener("blur", function () {
    editing = false;
    if (pill.dataset.state === "offline") {
      scheduleRetry();
    }
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
    setPill("offline");
    if (sourceKind === "esp32" && !stickyError) {
      showDetail(OFFLINE_DETAIL);
    }
    if (!editing) {
      scheduleRetry();
    }
  });

  video.addEventListener("load", function () {
    window.clearTimeout(retryTimer);
    setPill("live");
    if (!stickyError) {
      showDetail("");
    }
  });

  async function boot() {
    setPill("connecting");
    try {
      var response = await fetch("/api/camera", { cache: "no-store" });
      var data = await response.json();
      var current = data.streamUrl || data.baseUrl || "";
      if (sourceKind !== "webcam") {
        showStream(current);
      }
      if (!editing) {
        input.value = current;
      }
    } catch (err) {
      showDetail(OFFLINE_DETAIL);
    }
    await selectWebcam();
    await refreshCue();
    window.setInterval(refreshHealth, 3000);
    window.setInterval(refreshCue, 1000);
  }

  boot();
})();

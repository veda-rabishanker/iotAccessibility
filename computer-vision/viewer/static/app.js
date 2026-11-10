(function () {
  "use strict";

  var video = document.getElementById("video");
  var form = document.getElementById("camera-form");
  var input = document.getElementById("camera-url");
  var pill = document.getElementById("status-pill");
  var streamUrl = document.getElementById("stream-url");
  var detail = document.getElementById("detail");
  var submitButton = form.querySelector("button[type='submit']");

  var editing = false;
  var stickyError = false;
  var retryTimer = 0;
  var healthGeneration = 0;

  var OFFLINE_DETAIL =
    "Camera unreachable. Join the Strider-CAM Wi-Fi, or enter the camera address.";

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

  function scheduleRetry() {
    window.clearTimeout(retryTimer);
    retryTimer = window.setTimeout(function () {
      if (!editing) {
        connectStream();
      }
    }, 2000);
  }

  function showStream(url) {
    streamUrl.textContent = url || "";
  }

  async function refreshHealth() {
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
    stickyError = false;
    setPill("connecting");
    showDetail("");
    submitButton.disabled = true;
    try {
      var response = await fetch("/api/camera", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: input.value.trim() })
      });
      var data = {};
      try {
        data = await response.json();
      } catch (ignore) {
        data = {};
      }
      if (!response.ok) {
        stickyError = true;
        setPill("offline");
        showDetail(data.detail || "Enter an http or https camera address.");
        return;
      }
      if (data.streamUrl) {
        showStream(data.streamUrl);
        input.value = data.streamUrl;
      }
      connectStream();
      await refreshHealth();
    } catch (err) {
      setPill("offline");
      showDetail(OFFLINE_DETAIL);
    } finally {
      submitButton.disabled = false;
    }
  });

  video.addEventListener("error", function () {
    setPill("offline");
    if (!stickyError) {
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
      showStream(current);
      if (!editing) {
        input.value = current;
      }
    } catch (err) {
      showDetail(OFFLINE_DETAIL);
    }
    connectStream();
    await refreshHealth();
    window.setInterval(refreshHealth, 3000);
  }

  boot();
})();

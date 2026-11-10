// Strider collar camera: Wi-Fi MJPEG only (AI-Thinker ESP32-CAM).
// GPIO 4 is the flash LED and is tied to the camera data/SD lines.
// Do not drive it; toggling it can crash the sensor.

#include <WiFi.h>
#include "esp_camera.h"
#include <esp_http_server.h>

#if __has_include("config.h")
#include "config.h"
#endif

#ifndef WIFI_SSID
#define WIFI_SSID ""
#endif

#ifndef WIFI_PASSWORD
#define WIFI_PASSWORD ""
#endif

#define PWDN_GPIO_NUM 32
#define RESET_GPIO_NUM -1
#define XCLK_GPIO_NUM 0
#define SIOD_GPIO_NUM 26
#define SIOC_GPIO_NUM 27
#define Y9_GPIO_NUM 35
#define Y8_GPIO_NUM 34
#define Y7_GPIO_NUM 39
#define Y6_GPIO_NUM 36
#define Y5_GPIO_NUM 21
#define Y4_GPIO_NUM 19
#define Y3_GPIO_NUM 18
#define Y2_GPIO_NUM 5
#define VSYNC_GPIO_NUM 25
#define HREF_GPIO_NUM 23
#define PCLK_GPIO_NUM 22

static const char *AP_SSID = "Strider-CAM";
static const char *AP_PASSWORD = "strider-cam";
static const unsigned long STA_TIMEOUT_MS = 20000;

#define PART_BOUNDARY "frame"
static const char *STREAM_CONTENT_TYPE = "multipart/x-mixed-replace;boundary=" PART_BOUNDARY;
static const char *STREAM_BOUNDARY = "\r\n--" PART_BOUNDARY "\r\n";
static const char *STREAM_PART = "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";

static char g_ip[16] = "0.0.0.0";
static const char *g_mode = "ap";
static const char *g_framesize = "VGA";
static httpd_handle_t g_httpd = NULL;

static void format_ip(const IPAddress &ip, char *out, size_t len) {
  snprintf(out, len, "%u.%u.%u.%u", (unsigned)ip[0], (unsigned)ip[1], (unsigned)ip[2], (unsigned)ip[3]);
}

static bool start_softap(const char *reason) {
  Serial.println(reason);
  WiFi.disconnect(true);
  WiFi.setAutoReconnect(false);
  WiFi.mode(WIFI_AP);
  WiFi.setSleep(false);
  IPAddress ap_ip(192, 168, 4, 1);
  WiFi.softAPConfig(ap_ip, ap_ip, IPAddress(255, 255, 255, 0));
  if (!WiFi.softAP(AP_SSID, AP_PASSWORD)) {
    Serial.println("SoftAP start failed");
    return false;
  }
  IPAddress ip = WiFi.softAPIP();
  for (int i = 0; i < 20 && ip == IPAddress(0, 0, 0, 0); ++i) {
    delay(100);
    ip = WiFi.softAPIP();
  }
  format_ip(ip, g_ip, sizeof(g_ip));
  g_mode = "ap";
  Serial.print("Hotspot ");
  Serial.print(AP_SSID);
  Serial.print(" password ");
  Serial.println(AP_PASSWORD);
  return true;
}

static bool start_wifi() {
  WiFi.persistent(false);
  const char *ssid = WIFI_SSID;
  if (ssid == nullptr || ssid[0] == '\0') {
    return start_softap("WIFI_SSID missing or empty; starting Strider-CAM hotspot");
  }

  Serial.print("Connecting to ");
  Serial.println(ssid);
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.setAutoReconnect(true);
  WiFi.begin(ssid, WIFI_PASSWORD);

  unsigned long started = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - started < STA_TIMEOUT_MS) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() != WL_CONNECTED) {
    return start_softap("Station join failed; falling back to Strider-CAM hotspot");
  }

  format_ip(WiFi.localIP(), g_ip, sizeof(g_ip));
  g_mode = "sta";
  return true;
}

static bool start_camera() {
  camera_config_t config = {};
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size = FRAMESIZE_VGA;
  config.jpeg_quality = 12;
  config.fb_count = 2;
  config.fb_location = CAMERA_FB_IN_PSRAM;
  config.grab_mode = CAMERA_GRAB_LATEST;

  if (!psramFound()) {
    // Two VGA buffers do not fit in DRAM, and grab-latest needs a spare buffer.
    Serial.println("PSRAM not found; using one SVGA buffer in DRAM");
    g_framesize = "SVGA";
    config.frame_size = FRAMESIZE_SVGA;
    config.fb_count = 1;
    config.fb_location = CAMERA_FB_IN_DRAM;
    config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed: 0x%x\n", err);
    return false;
  }
  return true;
}

static esp_err_t index_handler(httpd_req_t *req) {
  char page[384];
  int n = snprintf(
      page,
      sizeof(page),
      "<!DOCTYPE html><html><head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
      "<title>Strider CAM</title></head><body><p>Strider CAM %s</p><img src=\"/stream\"></body></html>",
      g_ip);
  if (n < 0 || (size_t)n >= sizeof(page)) {
    return httpd_resp_send_500(req);
  }
  httpd_resp_set_type(req, "text/html");
  httpd_resp_set_hdr(req, "Cache-Control", "no-cache");
  return httpd_resp_send(req, page, n);
}

static esp_err_t stream_handler(httpd_req_t *req) {
  esp_err_t res = httpd_resp_set_type(req, STREAM_CONTENT_TYPE);
  if (res != ESP_OK) {
    return res;
  }
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  httpd_resp_set_hdr(req, "Cache-Control", "no-cache");

  char part_buf[80];
  while (true) {
    camera_fb_t *fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("Camera capture failed");
      res = ESP_FAIL;
      break;
    }
    if (fb->format != PIXFORMAT_JPEG) {
      esp_camera_fb_return(fb);
      res = ESP_FAIL;
      break;
    }

    int hlen = snprintf(part_buf, sizeof(part_buf), STREAM_PART, (unsigned)fb->len);
    if (hlen > 0 && (size_t)hlen < sizeof(part_buf)) {
      res = httpd_resp_send_chunk(req, STREAM_BOUNDARY, strlen(STREAM_BOUNDARY));
      if (res == ESP_OK) {
        res = httpd_resp_send_chunk(req, part_buf, hlen);
      }
      if (res == ESP_OK) {
        res = httpd_resp_send_chunk(req, (const char *)fb->buf, fb->len);
      }
    } else {
      res = ESP_FAIL;
    }
    esp_camera_fb_return(fb);
    if (res != ESP_OK) {
      break;
    }
  }
  return res;
}

static esp_err_t status_handler(httpd_req_t *req) {
  char body[96];
  int n = snprintf(
      body,
      sizeof(body),
      "{\"ok\":true,\"ip\":\"%s\",\"mode\":\"%s\",\"framesize\":\"%s\"}",
      g_ip,
      g_mode,
      g_framesize);
  if (n < 0 || (size_t)n >= sizeof(body)) {
    return httpd_resp_send_500(req);
  }
  httpd_resp_set_type(req, "application/json");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  httpd_resp_set_hdr(req, "Cache-Control", "no-cache");
  return httpd_resp_send(req, body, n);
}

static esp_err_t capture_handler(httpd_req_t *req) {
  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("Camera capture failed");
    return httpd_resp_send_500(req);
  }
  if (fb->format != PIXFORMAT_JPEG) {
    esp_camera_fb_return(fb);
    return httpd_resp_send_500(req);
  }
  httpd_resp_set_type(req, "image/jpeg");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  httpd_resp_set_hdr(req, "Cache-Control", "no-cache");
  esp_err_t res = httpd_resp_send(req, (const char *)fb->buf, fb->len);
  esp_camera_fb_return(fb);
  return res;
}

static bool start_http() {
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.server_port = 80;
  config.stack_size = 8192;
  config.max_uri_handlers = 8;
  config.recv_wait_timeout = 10;
  config.send_wait_timeout = 10;
  config.lru_purge_enable = true;

  if (httpd_start(&g_httpd, &config) != ESP_OK) {
    Serial.println("HTTP server failed to start");
    return false;
  }

  httpd_uri_t index_uri = {
      .uri = "/",
      .method = HTTP_GET,
      .handler = index_handler,
      .user_ctx = NULL
#ifdef CONFIG_HTTPD_WS_SUPPORT
      ,
      .is_websocket = false,
      .handle_ws_control_frames = false,
      .supported_subprotocol = NULL
#endif
  };
  httpd_uri_t stream_uri = {
      .uri = "/stream",
      .method = HTTP_GET,
      .handler = stream_handler,
      .user_ctx = NULL
#ifdef CONFIG_HTTPD_WS_SUPPORT
      ,
      .is_websocket = false,
      .handle_ws_control_frames = false,
      .supported_subprotocol = NULL
#endif
  };
  httpd_uri_t status_uri = {
      .uri = "/status",
      .method = HTTP_GET,
      .handler = status_handler,
      .user_ctx = NULL
#ifdef CONFIG_HTTPD_WS_SUPPORT
      ,
      .is_websocket = false,
      .handle_ws_control_frames = false,
      .supported_subprotocol = NULL
#endif
  };
  httpd_uri_t capture_uri = {
      .uri = "/capture",
      .method = HTTP_GET,
      .handler = capture_handler,
      .user_ctx = NULL
#ifdef CONFIG_HTTPD_WS_SUPPORT
      ,
      .is_websocket = false,
      .handle_ws_control_frames = false,
      .supported_subprotocol = NULL
#endif
  };

  httpd_register_uri_handler(g_httpd, &index_uri);
  httpd_register_uri_handler(g_httpd, &stream_uri);
  httpd_register_uri_handler(g_httpd, &status_uri);
  httpd_register_uri_handler(g_httpd, &capture_uri);
  return true;
}

void setup() {
  Serial.begin(115200);
  Serial.println();
  Serial.println("Strider CAM");

  if (!start_camera()) {
    return;
  }
  if (!start_wifi()) {
    return;
  }

  Serial.print("Mode: ");
  Serial.println(g_mode);
  Serial.print("IP: ");
  Serial.println(g_ip);

  if (!start_http()) {
    return;
  }

  Serial.print("Stream: http://");
  Serial.print(g_ip);
  Serial.println("/stream");
}

void loop() {
  delay(1000);
}

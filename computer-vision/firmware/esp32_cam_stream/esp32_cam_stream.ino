// Strider collar camera: Wi-Fi MJPEG only (AI-Thinker ESP32-CAM).
// GPIO 4 is the flash LED and is tied to the camera data/SD lines.
// Do not drive it; toggling it can crash the sensor.
//
// Port 80: GET /status (JSON), GET /control?size=QVGA&quality=15
// Port 81: GET /stream (multipart MJPEG), on its own server so port 80 stays responsive.

#include <ESPmDNS.h>
#include <WiFi.h>
#include <esp_camera.h>
#include <esp_http_server.h>
#include <esp_wifi.h>
#include <lwip/sockets.h>

#if __has_include("config.h")
#include "config.h"
#endif
#ifndef WIFI_SSID
#define WIFI_SSID ""
#endif
#ifndef WIFI_PASSWORD
#define WIFI_PASSWORD ""
#endif

// AI-Thinker ESP32-CAM pins.
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

// Every Strider board announces itself as strider-<role>-<id>.local and as a
// _strider._tcp mDNS service, so the app can find it without a fixed IP.
static const char *DEVICE_ROLE = "cam";
static const char *AP_SSID = "Strider-CAM";
static const char *AP_PASSWORD = "strider-cam";
static const unsigned long STA_TIMEOUT_MS = 20000;
static const uint16_t STREAM_PORT = 81;

// Small frames stream fastest. QVGA is enough for the detector (it upsamples) and depth.
static const framesize_t DEFAULT_SIZE = FRAMESIZE_QVGA;
static const int DEFAULT_QUALITY = 15;  // 4..63, lower = sharper and bigger

struct SizeOption {
  const char *name;
  framesize_t size;
};
static const SizeOption SIZE_OPTIONS[] = {
    {"QQVGA", FRAMESIZE_QQVGA},  // 160x120
    {"QVGA", FRAMESIZE_QVGA},    // 320x240
    {"HVGA", FRAMESIZE_HVGA},    // 480x320
    {"VGA", FRAMESIZE_VGA},      // 640x480
};

static char g_ip[16] = "0.0.0.0";
static char g_id[5] = "0000";
static char g_hostname[32] = "strider-cam";
static const char *g_mode = "ap";
static const char *g_framesize = "QVGA";
static framesize_t g_max_size = FRAMESIZE_VGA;  // Largest size the frame buffers can hold.
static int g_quality = DEFAULT_QUALITY;

// ---- Wi-Fi ----------------------------------------------------------------

static void format_ip(const IPAddress &ip) {
  snprintf(g_ip, sizeof(g_ip), "%u.%u.%u.%u", ip[0], ip[1], ip[2], ip[3]);
}

static bool start_softap(const char *reason) {
  Serial.println(reason);
  WiFi.disconnect(true);
  WiFi.mode(WIFI_AP);
  WiFi.setSleep(false);
  IPAddress ap_ip(192, 168, 4, 1);
  WiFi.softAPConfig(ap_ip, ap_ip, IPAddress(255, 255, 255, 0));
  if (!WiFi.softAP(AP_SSID, AP_PASSWORD)) {
    Serial.println("SoftAP start failed");
    return false;
  }
  format_ip(WiFi.softAPIP());
  g_mode = "ap";
  Serial.printf("Hotspot %s password %s\n", AP_SSID, AP_PASSWORD);
  return true;
}

static bool start_wifi() {
  WiFi.persistent(false);
  if (WIFI_SSID[0] == '\0') {
    return start_softap("WIFI_SSID empty; starting Strider-CAM hotspot");
  }
  Serial.printf("Connecting to %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  esp_wifi_set_ps(WIFI_PS_NONE);                      // No modem sleep: it delays every packet.
  esp_wifi_set_bandwidth(WIFI_IF_STA, WIFI_BW_HT20);  // 20 MHz copes better with a busy 2.4 GHz band.
  WiFi.setTxPower(WIFI_POWER_19_5dBm);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long started = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - started < STA_TIMEOUT_MS) {
    delay(250);
  }
  if (WiFi.status() != WL_CONNECTED) {
    return start_softap("Join failed; falling back to Strider-CAM hotspot");
  }
  format_ip(WiFi.localIP());
  g_mode = "sta";
  Serial.printf("Signal: %d dBm, channel %d\n", WiFi.RSSI(), WiFi.channel());
  return true;
}

static void start_mdns() {
  // Last two bytes of the factory MAC: stable per board, unique enough per network.
  uint64_t mac = ESP.getEfuseMac();
  snprintf(g_id, sizeof(g_id), "%02x%02x", (unsigned)((mac >> 32) & 0xff), (unsigned)((mac >> 40) & 0xff));
  snprintf(g_hostname, sizeof(g_hostname), "strider-%s-%s", DEVICE_ROLE, g_id);
  if (!MDNS.begin(g_hostname)) {
    Serial.println("mDNS failed; use the IP address");
    return;
  }
  MDNS.addService("strider", "tcp", 80);
  MDNS.addServiceTxt("strider", "tcp", "role", DEVICE_ROLE);
  MDNS.addServiceTxt("strider", "tcp", "id", (const char *)g_id);
}

// ---- Camera ---------------------------------------------------------------

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
  // Buffers are sized for the frame size given here, so allocate for VGA and then drop
  // to the default size; /control can go back up to VGA without overflowing them.
  config.frame_size = FRAMESIZE_VGA;
  config.jpeg_quality = DEFAULT_QUALITY;
  config.fb_count = 2;
  config.fb_location = CAMERA_FB_IN_PSRAM;
  config.grab_mode = CAMERA_GRAB_LATEST;  // Always hand out the newest frame; drop stale ones.

  if (!psramFound()) {
    Serial.println("No PSRAM: one QVGA buffer in DRAM");
    g_max_size = FRAMESIZE_QVGA;
    config.frame_size = FRAMESIZE_QVGA;
    config.fb_count = 1;
    config.fb_location = CAMERA_FB_IN_DRAM;
    config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed: 0x%x\n", err);
    return false;
  }
  sensor_t *sensor = esp_camera_sensor_get();
  sensor->set_framesize(sensor, DEFAULT_SIZE);
  return true;
}

// ---- HTTP -----------------------------------------------------------------

static bool send_all(int fd, const void *data, size_t len) {
  const uint8_t *p = static_cast<const uint8_t *>(data);
  while (len > 0) {
    int sent = send(fd, p, len, 0);
    if (sent <= 0) {
      return false;
    }
    p += sent;
    len -= sent;
  }
  return true;
}

// Writes straight to the socket: one small part header, then the whole JPEG in one call.
// The http server's chunked writes split every frame into ~6 tiny packets, which stalls
// on delayed ACKs. TCP_NODELAY sends each write at once.
static esp_err_t stream_handler(httpd_req_t *req) {
  int fd = httpd_req_to_sockfd(req);
  int one = 1;
  setsockopt(fd, IPPROTO_TCP, TCP_NODELAY, &one, sizeof(one));

  static const char HEADER[] =
      "HTTP/1.1 200 OK\r\n"
      "Content-Type: multipart/x-mixed-replace;boundary=frame\r\n"
      "Access-Control-Allow-Origin: *\r\n"
      "Cache-Control: no-cache\r\n"
      "Connection: close\r\n\r\n";
  if (!send_all(fd, HEADER, sizeof(HEADER) - 1)) {
    return ESP_FAIL;
  }

  char part[96];
  unsigned long window_start = millis();
  unsigned frames = 0;
  size_t bytes = 0;
  while (true) {
    camera_fb_t *fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("Camera capture failed");
      break;
    }
    int n = snprintf(part, sizeof(part),
                     "\r\n--frame\r\nContent-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n",
                     (unsigned)fb->len);
    bool ok = send_all(fd, part, n) && send_all(fd, fb->buf, fb->len);
    frames++;
    bytes += fb->len;
    esp_camera_fb_return(fb);
    if (!ok) {
      break;  // Viewer went away.
    }
    unsigned long elapsed = millis() - window_start;
    if (elapsed >= 5000) {
      Serial.printf("Stream: %.1f fps, %u KB/s, %s q%d\n", frames * 1000.0f / elapsed,
                    (unsigned)(bytes / elapsed), g_framesize, g_quality);
      window_start = millis();
      frames = 0;
      bytes = 0;
    }
  }
  return ESP_FAIL;  // We wrote the response ourselves; tell the server to close the socket.
}

static esp_err_t status_handler(httpd_req_t *req) {
  // Signal strength in dBm (closer to 0 is stronger); 0 when the camera is the hotspot.
  int rssi = (g_mode[0] == 's' && WiFi.status() == WL_CONNECTED) ? WiFi.RSSI() : 0;
  char body[256];
  int n = snprintf(body, sizeof(body),
                   "{\"ok\":true,\"device\":\"strider\",\"role\":\"%s\",\"id\":\"%s\",\"name\":\"%s.local\","
                   "\"ip\":\"%s\",\"mode\":\"%s\",\"framesize\":\"%s\",\"quality\":%d,"
                   "\"stream_port\":%u,\"rssi\":%d}",
                   DEVICE_ROLE, g_id, g_hostname, g_ip, g_mode, g_framesize, g_quality,
                   (unsigned)STREAM_PORT, rssi);
  if (n < 0 || (size_t)n >= sizeof(body)) {
    return httpd_resp_send_500(req);
  }
  httpd_resp_set_type(req, "application/json");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  httpd_resp_set_hdr(req, "Cache-Control", "no-cache");
  return httpd_resp_send(req, body, n);
}

// GET /control?size=QVGA&quality=15 changes resolution / JPEG quality live (not saved).
static esp_err_t control_handler(httpd_req_t *req) {
  char query[64] = {0};
  char value[16] = {0};
  sensor_t *sensor = esp_camera_sensor_get();
  if (httpd_req_get_url_query_str(req, query, sizeof(query)) != ESP_OK) {
    return httpd_resp_send_err(req, HTTPD_400_BAD_REQUEST, "Use /control?size=QVGA&quality=15");
  }
  if (httpd_query_key_value(query, "size", value, sizeof(value)) == ESP_OK) {
    const SizeOption *match = nullptr;
    for (const SizeOption &option : SIZE_OPTIONS) {
      if (strcasecmp(value, option.name) == 0 && option.size <= g_max_size) {
        match = &option;
      }
    }
    if (match == nullptr || sensor->set_framesize(sensor, match->size) != 0) {
      return httpd_resp_send_err(req, HTTPD_400_BAD_REQUEST, "size must be QQVGA, QVGA, HVGA or VGA");
    }
    g_framesize = match->name;
  }
  if (httpd_query_key_value(query, "quality", value, sizeof(value)) == ESP_OK) {
    int quality = atoi(value);
    if (quality < 4 || quality > 63) {
      return httpd_resp_send_err(req, HTTPD_400_BAD_REQUEST, "quality must be 4..63");
    }
    sensor->set_quality(sensor, quality);
    g_quality = quality;
  }
  Serial.printf("Control: %s q%d\n", g_framesize, g_quality);
  return status_handler(req);
}

static void add_route(httpd_handle_t server, const char *path, esp_err_t (*handler)(httpd_req_t *)) {
  httpd_uri_t uri = {};
  uri.uri = path;
  uri.method = HTTP_GET;
  uri.handler = handler;
  httpd_register_uri_handler(server, &uri);
}

static bool start_http() {
  httpd_handle_t api = NULL;
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.server_port = 80;
  config.lru_purge_enable = true;
  if (httpd_start(&api, &config) != ESP_OK) {
    return false;
  }
  add_route(api, "/status", status_handler);
  add_route(api, "/control", control_handler);

  httpd_handle_t stream = NULL;
  httpd_config_t stream_config = HTTPD_DEFAULT_CONFIG();
  stream_config.server_port = STREAM_PORT;
  stream_config.ctrl_port = config.ctrl_port + 1;  // Each server needs its own control port.
  stream_config.max_open_sockets = 2;
  stream_config.lru_purge_enable = true;
  if (httpd_start(&stream, &stream_config) != ESP_OK) {
    return false;
  }
  add_route(stream, "/stream", stream_handler);
  return true;
}

void setup() {
  Serial.begin(115200);
  Serial.println("\nStrider CAM");
  if (!start_camera() || !start_wifi()) {
    return;
  }
  if (!start_http()) {
    Serial.println("HTTP server failed to start");
    return;
  }
  start_mdns();
  Serial.printf("Mode: %s\nIP: %s\n", g_mode, g_ip);
  Serial.printf("Stream: http://%s:%u/stream\n", g_ip, (unsigned)STREAM_PORT);
  Serial.printf("Name:   http://%s.local:%u/stream\n", g_hostname, (unsigned)STREAM_PORT);
}

void loop() {
  delay(1000);
}

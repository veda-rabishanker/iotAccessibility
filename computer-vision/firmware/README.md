# ESP32-CAM firmware

Wi-Fi MJPEG stream for the Strider collar camera. The sketch targets the AI-Thinker ESP32-CAM and serves video on port 81 and status/control on port 80. It does not run detection.

## Arduino IDE

1. **File → Preferences → Additional boards manager URLs**, add:
   `https://espressif.github.io/arduino-esp32/package_esp32_index.json`
2. **Tools → Board → Boards Manager**, install **esp32** by Espressif Systems.
3. **Tools → Board → AI Thinker ESP32-CAM**. That board option enables PSRAM, which this sketch uses for two VGA frame buffers.
4. **Tools → Partition Scheme → Huge APP (3MB No OTA/1MB SPIFFS)**.
5. **Tools → Port**: select the serial port that appears when the USB-serial adapter is plugged in.
6. Open `esp32_cam_stream/esp32_cam_stream.ino` and click **Upload**. If the upload fails, set **Tools → Upload Speed** to 115200 and try again.

## Flashing

The camera module has no USB connector. Use a USB-serial adapter (FTDI or similar):

- Adapter 5V → board 5V, GND → GND, adapter TX → board U0R, adapter RX → board U0T. Power the **5V** pin. The adapter's 3.3V pin often browns out when the sensor starts.
- To enter the flash bootloader, connect **GPIO0 to GND**, then press **RST**.
- After upload succeeds, disconnect GPIO0 from GND and press **RST**. GPIO0 is also the camera clock, so it must be free when the sketch runs.
- Open the Serial Monitor at **115200**. It prints the IP and the stream URL.

## Wi-Fi

**Hotspot.** Flash with no `config.h`, or with `WIFI_SSID` left empty. The board starts a SoftAP named `Strider-CAM`, password `strider-cam`, at **192.168.4.1**. Join that network from the PC.


- Stream: `http://192.168.4.1:81/stream`

**Home network.** Copy `config.h.example` to `config.h` in the same folder (that file is gitignored; do not commit it). Set `WIFI_SSID` and `WIFI_PASSWORD`, then flash again. The board joins that network (about 20 seconds). Serial prints `http://<lan-ip>:81/stream`. If the join fails, it starts the same `Strider-CAM` hotspot and says so on Serial.

- Stream on the LAN: `http://<lan-ip>:81/stream`

**iPhone hotspot (recommended with the app).** The phone keeps its mobile internet and the camera joins it.

1. On the iPhone: **Settings → Personal Hotspot → Allow Others to Join**, and turn on **Maximise Compatibility**. The ESP32 only sees 2.4 GHz networks.
2. In `config.h`, set `WIFI_SSID` to the hotspot name (usually the iPhone's name) and `WIFI_PASSWORD` to its password. Flash again.
3. Keep the Personal Hotspot screen open while the camera starts the first time; iOS only advertises the hotspot while that screen is open or a device is already joined.

The iPhone hands out addresses from `172.20.10.2` to `172.20.10.14`, so the camera's address can change between sessions. You do not need to know it: the app finds the camera (see below).

## How the app finds the camera

Every Strider board names itself `strider-<role>-<id>.local`, where `id` is the last two bytes of its MAC address (e.g. `strider-cam-3fa2.local`). Serial prints it as `Name: http://strider-cam-3fa2.local:81/stream`. It also announces a `_strider._tcp` mDNS service with `role` and `id` in its TXT record, so later boards with other roles can be listed without knowing their names.

The app's **Live camera view** probes, all at once: addresses that worked earlier in the session (IP and `.local` name), `192.168.4.1` (Strider-CAM hotspot), and `172.20.10.2`–`.14` (iPhone hotspot). A board counts when its `/status` says `"device":"strider"`. If nothing answers, type the address from Serial into the screen.

A new board role only needs a different `DEVICE_ROLE` and the same `/status` fields.

## HTTP routes

Two servers, so a running stream never blocks status or control:

| Port | Path | Response |
| --- | --- | --- |
| 81 | `/stream` | multipart MJPEG (`boundary=frame`), always the newest frame |
| 80 | `/status` | JSON `{"ok":true,"device":"strider","role":"cam","id":"3fa2","name":"strider-cam-3fa2.local","ip":"...","mode":"ap"\|"sta","framesize":"QVGA","quality":15,"stream_port":81,"rssi":-45}` |
| 80 | `/control?size=QVGA&quality=15` | Changes resolution (`QQVGA`, `QVGA`, `HVGA`, `VGA`) and JPEG quality (4–63, lower is sharper and bigger) live; not saved across reboots. Returns `/status`. |

Defaults: QVGA (320×240), quality 15. `rssi` is the Wi-Fi signal in dBm (−40 to −60 is normal; above about −20 the board is too close to the phone). Serial prints `Stream: X fps, Y KB/s` every 5 seconds while someone is watching.

Open `http://<camera-ip>:81/stream` in Safari or Chrome to watch the raw stream.

The onboard flash LED is GPIO 4, shared with the camera data lines. This sketch does not drive GPIO 4.

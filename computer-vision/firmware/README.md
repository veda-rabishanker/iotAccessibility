# ESP32-CAM firmware

Wi-Fi MJPEG stream for the Strider collar camera. The sketch targets the AI-Thinker ESP32-CAM and serves video on port 80. It does not run detection.

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

- Page: `http://192.168.4.1/`
- Stream: `http://192.168.4.1/stream`

**Home network.** Copy `config.h.example` to `config.h` in the same folder (that file is gitignored; do not commit it). Set `WIFI_SSID` and `WIFI_PASSWORD`, then flash again. The board joins that network (about 20 seconds). Serial prints `http://<lan-ip>/stream`. If the join fails, it starts the same `Strider-CAM` hotspot and says so on Serial.

- Stream on the LAN: `http://<lan-ip>/stream`

## HTTP routes

One server, port 80:

| Method | Path | Response |
| --- | --- | --- |
| GET | `/` | HTML page with `<img src="/stream">` and the IP |
| GET | `/stream` | multipart MJPEG (`boundary=frame`) |
| GET | `/status` | JSON `{"ok":true,"ip":"...","mode":"ap"\|"sta","framesize":"VGA"}` |
| GET | `/capture` | one JPEG |

The onboard flash LED is GPIO 4, shared with the camera data lines. This sketch does not drive GPIO 4.

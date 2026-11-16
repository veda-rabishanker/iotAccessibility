import { useMemo, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { ActionButton, BackButton, Body, Card, Heading, Screen } from '@/components/strider-ui';
import { colors, radii, spacing, type } from '@/constants/strider-theme';
import { hostFromInput, streamUrl, useStriderDevices, type StriderDevice } from '@/hooks/use-strider-devices';

type StreamState = 'loading' | 'live' | 'stopped';

/**
 * Full stream URL for a typed address: keep an explicit path, otherwise use /stream,
 * on port 81 (where current firmware streams) unless a port was typed.
 */
function manualStreamUrl(input: string): string | null {
  const host = hostFromInput(input);
  if (!host) return null;
  const withoutScheme = input.trim().replace(/^https?:\/\//i, '');
  const hasPath = withoutScheme.includes('/') && withoutScheme.split('/').slice(1).join('/').length > 0;
  if (hasPath) return `http://${withoutScheme}`;
  const hasPort = /:\d+$/.test(host);
  return hasPort ? `http://${host}/stream` : `http://${host}:81/stream`;
}

/** The ESP32 sends MJPEG; an <img> inside a WebView plays it on both iOS and Android. */
function streamHtml(url: string): string {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#000;display:flex;align-items:center;justify-content:center}
img{width:100%;height:100%;object-fit:contain}</style></head><body>
<img id="v" src="${url}" alt="" onerror="window.ReactNativeWebView.postMessage('stopped')">
<script>
// MJPEG "load" events differ between browsers, so check for a decoded frame instead.
var sent = false;
var timer = setInterval(function () {
  var img = document.getElementById('v');
  if (!sent && img && img.naturalWidth > 0) {
    sent = true;
    clearInterval(timer);
    window.ReactNativeWebView.postMessage('live');
  }
}, 500);
</script></body></html>`;
}

export default function LiveViewScreen() {
  const { state, devices, search } = useStriderDevices();
  const cameras = useMemo(() => devices.filter((d) => d.role === 'cam'), [devices]);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [manualUrl, setManualUrl] = useState<string | null>(null);
  const [streamState, setStreamState] = useState<StreamState>('loading');
  const [reloadKey, setReloadKey] = useState(0);

  const camera: StriderDevice | undefined = cameras.find((c) => c.id === chosenId) ?? cameras[0];
  const url = manualUrl ?? (camera ? streamUrl(camera) : null);

  const statusText = (() => {
    if (manualUrl) return streamState === 'stopped' ? `No video from ${manualUrl}` : `Showing ${manualUrl}`;
    if (state === 'searching') return 'Looking for the collar camera…';
    if (!camera) return 'Camera not found';
    if (streamState === 'stopped') return `Found ${camera.name}, but the video stopped`;
    return `Connected to ${camera.name === camera.host ? camera.host : `${camera.name} (${camera.host})`}`;
  })();

  const onMessage = (event: WebViewMessageEvent) => {
    const next = event.nativeEvent.data === 'live' ? 'live' : 'stopped';
    if (next !== streamState) {
      setStreamState(next);
      AccessibilityInfo.announceForAccessibility(next === 'live' ? 'Camera video is live' : 'Camera video stopped');
    }
  };

  const searchAgain = async () => {
    setManualUrl(null);
    setStreamState('loading');
    setReloadKey((k) => k + 1);
    const found = await search();
    AccessibilityInfo.announceForAccessibility(
      found.some((d) => d.role === 'cam') ? 'Camera found' : 'Camera not found',
    );
  };

  const connectManual = async () => {
    const next = manualStreamUrl(manualInput);
    if (!next) return;
    const host = hostFromInput(manualInput);
    setStreamState('loading');
    setReloadKey((k) => k + 1);
    // If the address is a Strider board, use its details; otherwise just try the stream.
    const found = host ? await search([host]) : [];
    const match = found.find((d) => d.host === host && d.role === 'cam');
    if (match) {
      setChosenId(match.id);
      setManualUrl(null);
    } else {
      setManualUrl(next);
    }
  };

  return (
    <Screen>
      <BackButton fallback="/home" />
      <Heading>Live camera view</Heading>
      <Body style={styles.note}>For setup and aim checks with a sighted helper. Guidance does not need this screen.</Body>

      <Text accessibilityRole="text" accessibilityLiveRegion="polite" allowFontScaling style={styles.status}>
        {statusText}
      </Text>

      <View
        accessible
        accessibilityLabel={streamState === 'live' ? 'Live video from the collar camera' : 'Camera video area'}
        style={styles.stage}>
        {url ? (
          <WebView
            key={`${url}-${reloadKey}`}
            originWhitelist={['*']}
            source={{ html: streamHtml(url) }}
            onMessage={onMessage}
            scrollEnabled={false}
            style={styles.webview}
          />
        ) : (
          <Text allowFontScaling style={styles.stageText}>
            {state === 'searching' ? 'Searching…' : 'No camera'}
          </Text>
        )}
      </View>

      {cameras.length > 1 && !manualUrl ? (
        <Card style={styles.pickerCard}>
          <Text allowFontScaling style={styles.pickerTitle}>
            More than one camera found
          </Text>
          {cameras.map((c) => {
            const selected = c.id === camera?.id;
            return (
              <Pressable
                key={c.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={`${c.name}${selected ? ', selected' : ''}`}
                onPress={() => {
                  setChosenId(c.id);
                  setStreamState('loading');
                }}
                style={({ pressed }) => [styles.pickerRow, selected && styles.pickerRowSelected, pressed && styles.pressed]}>
                <Text allowFontScaling style={styles.pickerText}>
                  {c.name}
                </Text>
              </Pressable>
            );
          })}
        </Card>
      ) : null}

      <ActionButton
        label={state === 'searching' ? 'Searching…' : 'Search again'}
        accessibilityHint="Looks for the collar camera on this Wi-Fi network"
        disabled={state === 'searching'}
        onPress={searchAgain}
        tone="outline"
        style={styles.button}
      />

      {state === 'done' && !camera && !manualUrl ? (
        <Card>
          <Body style={styles.help}>
            Join the Strider-CAM Wi-Fi, or put the camera on this phone&apos;s hotspot. On an iPhone, turn on
            Maximise Compatibility in Personal Hotspot so the camera can see it.
          </Body>
        </Card>
      ) : null}

      <Text nativeID="manual-label" allowFontScaling style={styles.label}>
        Camera address
      </Text>
      <TextInput
        accessibilityLabelledBy="manual-label"
        accessibilityLabel="Camera address"
        accessibilityHint="For example 172.20.10.3. Shown on the camera's serial monitor."
        value={manualInput}
        onChangeText={setManualInput}
        onSubmitEditing={connectManual}
        placeholder="172.20.10.3"
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        returnKeyType="go"
        allowFontScaling
        style={styles.input}
      />
      <ActionButton label="Connect" onPress={connectManual} disabled={!manualInput.trim()} style={styles.button} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { fontSize: type.caption, lineHeight: 22 },
  status: { color: colors.primary, fontSize: type.body, fontWeight: '800' },
  stage: {
    aspectRatio: 4 / 3,
    width: '100%',
    backgroundColor: colors.base,
    borderColor: colors.primary,
    borderWidth: 2,
    borderRadius: radii.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webview: { flex: 1, alignSelf: 'stretch', backgroundColor: colors.base },
  stageText: { color: colors.textSecondary, fontSize: type.body },
  pickerCard: { gap: spacing.xs },
  pickerTitle: { color: colors.text, fontSize: type.body, fontWeight: '800' },
  pickerRow: {
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: colors.divider,
  },
  pickerRowSelected: { borderColor: colors.primary },
  pickerText: { color: colors.text, fontSize: type.body },
  pressed: { opacity: 0.75 },
  help: { fontSize: type.caption, lineHeight: 22 },
  label: { color: colors.text, fontSize: type.body, fontWeight: '700', marginTop: spacing.sm },
  input: {
    minHeight: 56,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.primary,
    color: colors.text,
    fontSize: type.body,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
  },
  button: { minHeight: 56 },
});

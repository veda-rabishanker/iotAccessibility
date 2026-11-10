import { router } from 'expo-router';
import { useState } from 'react';
import { AccessibilityInfo, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton, BackButton, Card, Heading, LogoMark, Screen } from '@/components/strider-ui';
import { colors, radii, spacing, type } from '@/constants/strider-theme';

export default function CameraScreen() {
  const [status, setStatus] = useState('Connected');
  const [aimResult, setAimResult] = useState<string | null>(null);
  const [sharingEnabled, setSharingEnabled] = useState(false);

  const runAimCheck = () => {
    AccessibilityInfo.announceForAccessibility('Checking aim');
    setTimeout(() => {
      setAimResult('Aim looks good');
      AccessibilityInfo.announceForAccessibility('Aim looks good');
    }, 700);
  };

  const toggleSharing = () => {
    const next = !sharingEnabled;
    setSharingEnabled(next);
    AccessibilityInfo.announceForAccessibility(
      next ? 'Obstacle sharing is on.' : 'Obstacle sharing is off. Local detection stays on.',
    );
  };

  const pairCamera = () => {
    if (status === 'Pairing…') return;
    Alert.alert(
      'Pair a different camera?',
      'This uses a simulated camera in this prototype.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start pairing',
          onPress: () => {
            setStatus('Pairing…');
            AccessibilityInfo.announceForAccessibility('Pairing…');
            setTimeout(() => {
              setStatus('Connected');
              AccessibilityInfo.announceForAccessibility('Camera connected');
            }, 1000);
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <BackButton fallback="/home" />
      <Heading>Collar camera</Heading>

      <Card style={styles.cameraHero}>
        <LogoMark size={88} showSignal />
      </Card>

      <Card style={styles.statusCard}>
        <View style={styles.statusRow}>
          <Text allowFontScaling style={styles.rowLabel}>Status</Text>
          <Text allowFontScaling style={styles.statusValue}>{status}</Text>
        </View>
        <View style={styles.statusRow}>
          <Text allowFontScaling style={styles.rowLabel}>Battery</Text>
          <Text allowFontScaling style={styles.batteryValue}>82%</Text>
        </View>
        <View style={[styles.statusRow, styles.aimRow]}>
          <Text allowFontScaling style={styles.rowLabel}>Aim check</Text>
          <View style={styles.aimActions}>
            {aimResult ? (
              <Text allowFontScaling style={styles.aimResult}>{aimResult}</Text>
            ) : null}
            <ActionButton
              label="Test now"
              onPress={runAimCheck}
              tone="outline"
              style={styles.testButton}
            />
          </View>
        </View>
      </Card>

      <Card style={styles.sharingCard}>
        <View style={styles.sharingCopy}>
          <Text allowFontScaling style={styles.sharingTitle}>
            Share obstacles my{'\n'}camera finds
          </Text>
          <Text allowFontScaling style={styles.sharingCaption}>
            Adds them to your route alerts.
          </Text>
        </View>
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel="Share obstacles my camera finds"
          accessibilityState={{ checked: sharingEnabled }}
          onPress={toggleSharing}
          style={({ pressed }) => [
            styles.switchTrack,
            sharingEnabled && styles.switchTrackOn,
            pressed && styles.pressed,
          ]}>
          {sharingEnabled ? (
            <Text allowFontScaling style={styles.switchWordOn}>On</Text>
          ) : null}
          <View style={[styles.switchKnob, !sharingEnabled && styles.switchKnobOff]} />
          {sharingEnabled ? null : (
            <Text allowFontScaling style={styles.switchWordOff}>Off</Text>
          )}
        </Pressable>
      </Card>

      <ActionButton
        label="Cue preferences"
        accessibilityHint="Opens cue preferences."
        onPress={() => router.push('/cue-preferences' as never)}
        tone="outline"
        style={styles.footerButton}
      />
      <ActionButton
        label="Pair a different camera"
        onPress={pairCamera}
        tone="outline"
        style={styles.footerButton}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cameraHero: {
    minHeight: 112,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.primary,
    borderWidth: 3,
    paddingVertical: spacing.lg,
  },
  statusCard: {
    padding: 0,
    overflow: 'hidden',
  },
  statusRow: {
    minHeight: 56,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderBottomColor: '#1E4A45',
    borderBottomWidth: 1,
  },
  aimRow: {
    minHeight: 76,
    alignItems: 'center',
    borderBottomWidth: 0,
  },
  aimActions: {
    alignItems: 'flex-end',
    gap: spacing.xs,
    flexShrink: 0,
  },
  rowLabel: {
    color: colors.text,
    fontSize: type.body,
    flexShrink: 1,
  },
  statusValue: {
    color: colors.primary,
    fontSize: type.body,
    fontWeight: '800',
  },
  batteryValue: {
    color: colors.text,
    fontSize: type.body,
    fontWeight: '800',
  },
  aimResult: {
    color: colors.primary,
    fontSize: type.caption,
    fontWeight: '800',
  },
  testButton: {
    minHeight: 56,
    borderRadius: radii.md,
    paddingHorizontal: 18,
  },
  sharingCard: {
    minHeight: 120,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: 18,
    paddingVertical: spacing.md,
  },
  sharingCopy: {
    flex: 1,
  },
  sharingTitle: {
    color: colors.text,
    fontSize: type.cardTitle,
    lineHeight: 28,
    fontWeight: '800',
  },
  sharingCaption: {
    color: colors.textSecondary,
    fontSize: type.caption,
    lineHeight: 22,
    marginTop: 4,
  },
  switchTrack: {
    width: 96,
    height: 56,
    borderRadius: radii.pill,
    borderColor: colors.primary,
    borderWidth: 3,
    backgroundColor: colors.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
  },
  switchTrackOn: {
    backgroundColor: colors.primary,
  },
  switchWordOn: {
    color: colors.base,
    fontSize: 17,
    fontWeight: '800',
    marginLeft: 8,
  },
  switchWordOff: {
    color: colors.primary,
    fontSize: 17,
    fontWeight: '800',
    marginRight: 8,
  },
  switchKnob: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.base,
  },
  switchKnobOff: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  pressed: {
    opacity: 0.75,
  },
  footerButton: {
    minHeight: 56,
  },
});

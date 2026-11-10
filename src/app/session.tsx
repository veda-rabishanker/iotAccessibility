import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton, LogoMark } from '@/components/strider-ui';
import { colors, radii, spacing, type } from '@/constants/strider-theme';

type Phase = 'active' | 'paused' | 'completed';
type DeviceCondition = 'ready' | 'degraded' | 'disconnected';

const INITIAL_ELAPSED = 12 * 60 + 8;
const DEVICE_CYCLE: DeviceCondition[] = ['ready', 'degraded', 'disconnected'];
const MODE_TITLES: Record<string, string> = {
  general: 'General guidance',
  crosswalk: 'Crosswalk assistance',
  depth: 'Depth perception',
};

function firstParam(value: string | string[] | undefined, fallback: string) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw ? raw : fallback;
}

function formatClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function speakClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const minuteLabel = minutes === 1 ? '1 minute' : `${minutes} minutes`;
  const secondLabel = seconds === 1 ? '1 second' : `${seconds} seconds`;
  return `${minuteLabel} ${secondLabel}`;
}

function sessionCopy(
  phase: Phase,
  condition: DeviceCondition,
  destination: string,
  modeTitle: string,
) {
  if (phase === 'completed') {
    return {
      pill: 'Session complete',
      title: 'Walk complete',
      subtitle: destination,
      message: 'Session ended.',
    };
  }
  if (phase === 'paused') {
    return {
      pill: 'Session paused',
      title: modeTitle,
      subtitle: `${destination} · paused`,
      message: 'Guidance is paused.',
    };
  }
  if (condition === 'degraded') {
    return {
      pill: 'Limited signal',
      title: modeTitle,
      subtitle: `${destination} · limited signal`,
      message: 'Guidance is quiet until the signal is steady.',
    };
  }
  if (condition === 'disconnected') {
    return {
      pill: 'Camera disconnected',
      title: modeTitle,
      subtitle: `${destination} · camera disconnected`,
      message: 'Guidance stopped. Reconnect the collar camera to continue.',
    };
  }
  return {
    pill: 'Session active',
    title: modeTitle,
    subtitle: `${destination} · scanning ahead`,
    message: 'Your wristlet vibrates to guide you.\nNo phone needed.',
  };
}

export default function SessionScreen() {
  const params = useLocalSearchParams<{ mode?: string | string[]; destination?: string | string[] }>();
  const destination = firstParam(params.destination, 'Home to Class');
  const modeKey = firstParam(params.mode, 'general');
  const modeTitle = MODE_TITLES[modeKey] ?? MODE_TITLES.general;

  const [phase, setPhase] = useState<Phase>('active');
  const [condition, setCondition] = useState<DeviceCondition>('ready');
  const [elapsedSeconds, setElapsedSeconds] = useState(INITIAL_ELAPSED);

  const copy = sessionCopy(phase, condition, destination, modeTitle);
  const isPaused = phase === 'paused';
  const isCompleted = phase === 'completed';
  const showDisconnectedPill = phase === 'active' && condition === 'disconnected';
  const pauseDisabled = condition === 'disconnected';

  useEffect(() => {
    if (phase === 'paused' || phase === 'completed') return undefined;
    const timer = setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  const announceState = (label: string) => {
    AccessibilityInfo.announceForAccessibility(label);
  };

  const cycleDeviceCondition = () => {
    if (phase === 'completed') return;
    const next = DEVICE_CYCLE[(DEVICE_CYCLE.indexOf(condition) + 1) % DEVICE_CYCLE.length];
    setCondition(next);
    const nextCopy = sessionCopy(phase, next, destination, modeTitle);
    const conditionLabel = sessionCopy('active', next, destination, modeTitle).pill;
    announceState(
      `${phase === 'paused' ? conditionLabel : nextCopy.pill}. ${speakClock(elapsedSeconds)}.`,
    );
  };

  const togglePause = () => {
    if (condition === 'disconnected') return;
    if (isPaused) {
      setPhase('active');
      announceState('Session resumed');
      return;
    }
    setPhase('paused');
    announceState('Session paused');
  };

  const stopSession = () => {
    Alert.alert('Stop this walk?', 'This ends guidance for this route.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Stop session',
        style: 'destructive',
        onPress: () => {
          setPhase('completed');
          announceState('Session ended');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.screen}>
        <View style={styles.statusRow}>
          <Pressable
            accessibilityHint="Simulates the next device condition."
            accessibilityLabel={`${copy.pill}. ${speakClock(elapsedSeconds)}.`}
            accessibilityRole="button"
            onPress={cycleDeviceCondition}
            style={({ pressed }) => [
              styles.pill,
              showDisconnectedPill && styles.pillDisconnected,
              pressed && styles.pressed,
            ]}>
            <View style={[styles.dot, showDisconnectedPill && styles.dotDisconnected]} />
            <Text
              accessibilityElementsHidden
              allowFontScaling
              style={[styles.pillText, showDisconnectedPill && styles.pillTextDisconnected]}>
              {copy.pill}
            </Text>
          </Pressable>
          <Text accessibilityElementsHidden allowFontScaling style={styles.timer}>
            {formatClock(elapsedSeconds)}
          </Text>
        </View>

        <View
          accessible
          accessibilityLabel={`${copy.title}. ${copy.subtitle}.`}
          accessibilityRole="header"
          style={styles.titleBlock}>
          <Text accessibilityElementsHidden allowFontScaling style={styles.title}>
            {copy.title}
          </Text>
          <Text accessibilityElementsHidden allowFontScaling style={styles.subtitle}>
            {copy.subtitle}
          </Text>
        </View>

        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.pulseArea}>
          <View style={[styles.ring, styles.ringOuter]}>
            <View style={[styles.ring, styles.ringMiddle]}>
              <View style={[styles.ring, styles.ringInner]}>
                <LogoMark showSignal size={100} />
              </View>
            </View>
          </View>
        </View>

        <View
          accessible
          accessibilityLabel={copy.message.replace(/\n/g, ' ')}
          style={styles.messageCard}>
          <Text accessibilityElementsHidden allowFontScaling style={styles.message}>
            {copy.message}
          </Text>
        </View>

        {isCompleted ? (
          <ActionButton
            label="Give feedback"
            onPress={() => router.replace('/feedback' as never)}
            style={styles.action}
          />
        ) : (
          <>
            <ActionButton
              disabled={pauseDisabled}
              icon={
                isPaused ? (
                  <Text accessibilityElementsHidden allowFontScaling style={styles.resumeGlyph}>
                    ▶
                  </Text>
                ) : (
                  <View accessibilityElementsHidden style={styles.pauseGlyph}>
                    <View style={styles.pauseBar} />
                    <View style={styles.pauseBar} />
                  </View>
                )
              }
              label={isPaused ? 'Resume session' : 'Pause session'}
              onPress={togglePause}
              style={styles.action}
              tone={isPaused ? 'primary' : 'pause'}
            />
            <ActionButton
              icon={<View accessibilityElementsHidden style={styles.stopGlyph} />}
              label="Stop session"
              onPress={stopSession}
              style={styles.action}
              tone="stop"
            />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.base },
  screen: {
    flex: 1,
    backgroundColor: colors.base,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  statusRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  pill: {
    maxWidth: '72%',
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radii.pill,
    backgroundColor: colors.card,
  },
  pillDisconnected: { borderColor: colors.stop },
  pillText: { color: colors.primary, fontSize: 17, fontWeight: '700', flexShrink: 1 },
  pillTextDisconnected: { color: colors.stop },
  pressed: { opacity: 0.72 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary },
  dotDisconnected: { backgroundColor: colors.stop },
  timer: { color: colors.text, fontSize: 24, fontWeight: '700', flexShrink: 0 },
  titleBlock: { alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm },
  title: {
    color: colors.text,
    fontSize: type.display,
    lineHeight: 42,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: type.body,
    lineHeight: 24,
    textAlign: 'center',
  },
  pulseArea: { flex: 1, minHeight: 280, alignItems: 'center', justifyContent: 'center' },
  ring: { alignItems: 'center', justifyContent: 'center', borderColor: colors.primary, borderRadius: radii.pill },
  ringOuter: { width: 336, height: 336, borderWidth: 3 },
  ringMiddle: { width: 268, height: 268, borderWidth: 3 },
  ringInner: { width: 200, height: 200, borderWidth: 4 },
  messageCard: {
    minHeight: 88,
    backgroundColor: colors.card,
    borderColor: colors.divider,
    borderWidth: 2,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    color: colors.text,
    fontSize: type.body,
    lineHeight: 24,
    textAlign: 'center',
  },
  action: { minHeight: 66 },
  pauseGlyph: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  pauseBar: { width: 6, height: 20, borderRadius: 1, backgroundColor: colors.base },
  resumeGlyph: { color: colors.base, fontSize: 22, fontWeight: '800' },
  stopGlyph: { width: 16, height: 16, borderRadius: 3, backgroundColor: colors.base },
});

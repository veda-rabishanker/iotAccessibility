import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton, Body, Card, Heading, LogoMark, Screen } from '@/components/strider-ui';
import { colors, radii, spacing, type } from '@/constants/strider-theme';

type UnlockState = 'ready' | 'scanning' | 'failed' | 'passcode';

const FAILURE_MESSAGE = 'Face ID didn’t work. Try again or use your passcode.';

function FaceIdGlyph({ size = 92, color = colors.primary }: { size?: number; color?: string }) {
  const arm = Math.round(size * 0.26);
  const thickness = Math.max(2, Math.round(size * 0.045));
  const eye = Math.max(3, Math.round(size * 0.08));
  const radius = Math.max(3, Math.round(size * 0.06));
  const corner = {
    position: 'absolute' as const,
    width: arm,
    height: arm,
    borderColor: color,
  };

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.glyph, { width: size, height: size }]}>
      <View style={[corner, styles.cornerTL, { borderTopWidth: thickness, borderLeftWidth: thickness, borderTopLeftRadius: radius }]} />
      <View style={[corner, styles.cornerTR, { borderTopWidth: thickness, borderRightWidth: thickness, borderTopRightRadius: radius }]} />
      <View style={[corner, styles.cornerBL, { borderBottomWidth: thickness, borderLeftWidth: thickness, borderBottomLeftRadius: radius }]} />
      <View style={[corner, styles.cornerBR, { borderBottomWidth: thickness, borderRightWidth: thickness, borderBottomRightRadius: radius }]} />
      <View style={[styles.faceFeatures, { gap: Math.max(3, Math.round(size * 0.08)) }]}>
        <View style={[styles.eyes, { gap: Math.max(4, Math.round(size * 0.13)) }]}>
          <View style={[styles.eye, { width: eye, height: eye, borderRadius: eye / 2, backgroundColor: color }]} />
          <View style={[styles.eye, { width: eye, height: eye, borderRadius: eye / 2, backgroundColor: color }]} />
        </View>
        <View
          style={[
            styles.smile,
            {
              width: Math.round(size * 0.3),
              height: Math.round(size * 0.16),
              borderColor: color,
              borderBottomWidth: thickness,
              borderLeftWidth: thickness,
              borderRightWidth: thickness,
            },
          ]}
        />
      </View>
    </View>
  );
}

function FacePhoneGlyph() {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.buttonFace}>
      <View style={styles.buttonEyes}>
        <View style={styles.buttonEye} />
        <View style={styles.buttonEye} />
      </View>
      <View style={styles.buttonSmile} />
    </View>
  );
}

export default function LoginScreen() {
  const [state, setState] = useState<UnlockState>('ready');
  const [passcode, setPasscode] = useState('');
  const attempts = useRef(0);
  const scanGeneration = useRef(0);

  function unlock() {
    const generation = ++scanGeneration.current;
    const attempt = attempts.current;
    setState('scanning');
    AccessibilityInfo.announceForAccessibility('Face ID scanning');
    setTimeout(() => {
      if (generation !== scanGeneration.current) return;
      if (attempt === 0) {
        attempts.current = 1;
        setState('failed');
        AccessibilityInfo.announceForAccessibility(FAILURE_MESSAGE);
        return;
      }
      AccessibilityInfo.announceForAccessibility('Signed in. Ready to walk.');
      router.replace('/home' as never);
    }, 900);
  }

  function showPasscode() {
    scanGeneration.current += 1;
    setState('passcode');
  }

  function showFaceId() {
    setPasscode('');
    setState(attempts.current > 0 ? 'failed' : 'ready');
  }

  function submitPasscode() {
    AccessibilityInfo.announceForAccessibility('Passcode accepted. Ready to walk.');
    router.replace('/home' as never);
  }

  const faceCardLabel =
    state === 'scanning'
      ? 'Look at your phone. Face ID scanning.'
      : 'Look at your phone. Your phone will say when Face ID starts and finishes.';

  return (
    <Screen>
      <View style={styles.hero}>
        <LogoMark size={118} />
        <Heading style={styles.brand}>Strider</Heading>
        <Body style={styles.tagline}>Walk anywhere with confidence.</Body>
      </View>

      {state === 'passcode' ? (
        <>
          <Card style={styles.promptCard}>
            <Heading style={styles.cardTitle}>Enter passcode</Heading>
            <Body style={styles.cardBody}>Use any 4 digits for this prototype.</Body>
            <TextInput
              accessibilityLabel="Passcode"
              accessibilityHint="Enter four digits"
              allowFontScaling
              autoFocus
              keyboardType="number-pad"
              maxLength={4}
              onChangeText={(value) => setPasscode(value.replace(/\D/g, ''))}
              secureTextEntry
              style={styles.input}
              value={passcode}
            />
          </Card>
          <ActionButton disabled={passcode.length !== 4} label="Continue" onPress={submitPasscode} />
          <ActionButton label="Use Face ID instead" onPress={showFaceId} tone="outline" />
        </>
      ) : (
        <>
          <Card accessible accessibilityLabel={faceCardLabel} style={styles.promptCard}>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.cardInner}>
              <FaceIdGlyph />
              <Text allowFontScaling style={styles.cardTitle}>
                Look at your phone
              </Text>
              <Body style={styles.cardBody}>Your phone will say when Face ID starts and finishes.</Body>
            </View>
          </Card>

          {state === 'failed' && (
            <Text accessibilityRole="alert" allowFontScaling style={styles.error}>
              {FAILURE_MESSAGE}
            </Text>
          )}

          <ActionButton
            accessibilityHint="Signs you in with Face ID"
            disabled={state === 'scanning'}
            icon={<FacePhoneGlyph />}
            label={state === 'scanning' ? 'Scanning with Face ID' : state === 'failed' ? 'Try Face ID again' : 'Sign in with Face ID'}
            onPress={unlock}
          />
          <ActionButton label="Use passcode instead" onPress={showPasscode} tone="outline" />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  brand: {
    color: colors.text,
    fontSize: type.display,
    fontWeight: '800',
    lineHeight: 44,
    textAlign: 'center',
  },
  tagline: {
    color: colors.textSecondary,
    fontSize: type.body,
    textAlign: 'center',
  },
  promptCard: {
    minHeight: 230,
    borderColor: colors.primary,
    borderWidth: 3,
    borderRadius: radii.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    justifyContent: 'center',
  },
  cardInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  glyph: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cornerTL: { top: 0, left: 0 },
  cornerTR: { top: 0, right: 0 },
  cornerBL: { bottom: 0, left: 0 },
  cornerBR: { bottom: 0, right: 0 },
  buttonFace: { width: 26, height: 22, alignItems: 'center', justifyContent: 'center', gap: 3 },
  buttonEyes: { flexDirection: 'row', gap: 6 },
  buttonEye: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.base },
  buttonSmile: { width: 12, height: 6, borderBottomWidth: 2, borderLeftWidth: 2, borderRightWidth: 2, borderColor: colors.base, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 },
  faceFeatures: { alignItems: 'center' },
  eyes: { flexDirection: 'row' },
  eye: { backgroundColor: colors.primary },
  smile: {
    borderTopWidth: 0,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    backgroundColor: 'transparent',
  },
  cardTitle: {
    color: colors.text,
    fontSize: type.cardTitle,
    fontWeight: '800',
    lineHeight: 28,
    textAlign: 'center',
  },
  cardBody: {
    textAlign: 'center',
  },
  error: {
    color: colors.stop,
    fontSize: type.caption,
    fontWeight: '700',
    lineHeight: 23,
    textAlign: 'center',
  },
  input: {
    minHeight: 64,
    marginTop: spacing.sm,
    borderColor: colors.primary,
    borderWidth: 3,
    borderRadius: radii.sm,
    color: colors.text,
    fontSize: 28,
    letterSpacing: 14,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
});

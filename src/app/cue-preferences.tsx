import { useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';

import { ActionButton, BackButton, Body, Card, Heading, Screen } from '@/components/strider-ui';
import { colors, radii, spacing, type } from '@/constants/strider-theme';

type CueId = 'crosswalk' | 'veer' | 'obstacle' | 'device';
type Channel = 'Vibration' | 'Audio' | 'Both';
type Strength = 'Low' | 'Medium' | 'High';
type CueSetting = { enabled: boolean; channel: Channel };
type Preferences = Record<CueId, CueSetting> & { strength: Strength };

const CHANNELS: Channel[] = ['Vibration', 'Audio', 'Both'];
const STRENGTHS: Strength[] = ['Low', 'Medium', 'High'];

const CUES: { id: CueId; title: string; caption: string }[] = [
  { id: 'crosswalk', title: 'Crosswalk', caption: 'Find the crosswalk and line up.' },
  { id: 'veer', title: 'Veer', caption: 'A pulse if you drift off the locked heading.' },
  { id: 'obstacle', title: 'Obstacle', caption: 'Name obstacles and which side to pass.' },
  { id: 'device', title: 'Device status', caption: 'Disconnect and low battery.' },
];

const PREVIEW_PATTERNS: Record<CueId, number[]> = {
  crosswalk: [0, 40, 80, 40, 80, 40],
  veer: [0, 180],
  obstacle: [0, 70, 60, 70],
  device: [0, 300, 120, 300],
};

const PREVIEW_SPEECH: Record<CueId, string> = {
  crosswalk: 'Crosswalk cue.',
  veer: 'Veer cue.',
  obstacle: 'Obstacle cue.',
  device: 'Device status cue.',
};

const DEFAULTS: Preferences = {
  crosswalk: { enabled: true, channel: 'Both' },
  veer: { enabled: true, channel: 'Both' },
  obstacle: { enabled: true, channel: 'Both' },
  device: { enabled: true, channel: 'Both' },
  strength: 'Medium',
};

function copyPreferences(value: Preferences): Preferences {
  return {
    crosswalk: { ...value.crosswalk },
    veer: { ...value.veer },
    obstacle: { ...value.obstacle },
    device: { ...value.device },
    strength: value.strength,
  };
}

const sessionStore = new Map<string, Preferences>([['current', copyPreferences(DEFAULTS)]]);

function patternFor(id: CueId, strength: Strength): number[] {
  const pattern = PREVIEW_PATTERNS[id];
  if (strength === 'Low') {
    return [0, Math.max(40, Math.round(pattern[1] * 0.5))];
  }
  if (strength === 'High') {
    return [...pattern, 80, ...pattern.slice(1)];
  }
  return pattern;
}

export default function CuePreferencesScreen() {
  const [preferences, setPreferences] = useState<Preferences>(
    () => copyPreferences(sessionStore.get('current') ?? DEFAULTS),
  );

  const commit = (next: Preferences) => {
    sessionStore.set('current', copyPreferences(next));
    setPreferences(next);
  };

  const setCueEnabled = (id: CueId, title: string, enabled: boolean) => {
    commit({ ...preferences, [id]: { ...preferences[id], enabled } });
    AccessibilityInfo.announceForAccessibility(`${title} cue ${enabled ? 'on' : 'off'}.`);
  };

  const setCueChannel = (id: CueId, title: string, channel: Channel) => {
    if (preferences[id].channel === channel) return;
    commit({ ...preferences, [id]: { ...preferences[id], channel } });
    AccessibilityInfo.announceForAccessibility(`${title} channel ${channel.toLowerCase()}.`);
  };

  const setStrength = (strength: Strength) => {
    if (preferences.strength === strength) return;
    commit({ ...preferences, strength });
    AccessibilityInfo.announceForAccessibility(`Strength ${strength.toLowerCase()}.`);
  };

  const preview = (id: CueId, setting: CueSetting) => {
    Vibration.vibrate(patternFor(id, preferences.strength));
    AccessibilityInfo.announceForAccessibility(
      setting.channel === 'Vibration' ? 'Vibration preview' : PREVIEW_SPEECH[id],
    );
  };

  const reset = () => {
    commit(copyPreferences(DEFAULTS));
    AccessibilityInfo.announceForAccessibility('Cue preferences reset.');
  };

  return (
    <Screen bottomInset={32}>
      <BackButton fallback="/camera" />
      <Heading>Cue preferences</Heading>
      <Body>Choose what Strider tells you, and whether it vibrates, speaks, or both.</Body>

      {CUES.map((cue) => {
        const setting = preferences[cue.id];
        return (
          <Card key={cue.id} style={styles.cardStack}>
            <View accessible accessibilityLabel={`${cue.title}. ${cue.caption}`} style={styles.cueCopy}>
              <Text allowFontScaling style={styles.cardTitle}>{cue.title}</Text>
              <Text allowFontScaling style={styles.caption}>{cue.caption}</Text>
            </View>

            <Pressable
              accessibilityRole="switch"
              accessibilityLabel={`${cue.title} cue`}
              accessibilityState={{ checked: setting.enabled }}
              onPress={() => setCueEnabled(cue.id, cue.title, !setting.enabled)}
              style={({ pressed }) => [styles.switchRow, pressed && styles.pressed]}>
              <Text
                allowFontScaling
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={styles.switchLabel}>
                Cue
              </Text>
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={[styles.switchTrack, setting.enabled && styles.switchTrackOn]}>
                <Text allowFontScaling style={[styles.switchWord, !setting.enabled && styles.switchWordOff]}>
                  {setting.enabled ? 'On' : 'Off'}
                </Text>
                <View style={[styles.switchThumb, setting.enabled ? styles.thumbOn : styles.thumbOff]} />
              </View>
            </Pressable>

            {setting.enabled ? (
              <>
                <View
                  accessibilityRole="radiogroup"
                  accessibilityLabel={`${cue.title} channel`}
                  style={styles.choiceRow}>
                  {CHANNELS.map((channel) => {
                    const selected = setting.channel === channel;
                    return (
                      <Pressable
                        key={channel}
                        accessibilityRole="radio"
                        accessibilityLabel={channel}
                        accessibilityState={{ selected, checked: selected }}
                        onPress={() => setCueChannel(cue.id, cue.title, channel)}
                        style={({ pressed }) => [
                          styles.choice,
                          selected && styles.choiceSelected,
                          pressed && styles.pressed,
                        ]}>
                        <Text
                          allowFontScaling
                          style={[styles.choiceText, selected && styles.choiceTextSelected]}>
                          {channel}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <ActionButton
                  label="Preview"
                  accessibilityHint={`Plays a ${setting.channel.toLowerCase()} preview of the ${cue.title.toLowerCase()} cue`}
                  onPress={() => preview(cue.id, setting)}
                  tone="outline"
                  style={styles.outlineButton}
                />
              </>
            ) : null}
          </Card>
        );
      })}

      <Card style={styles.cardStack}>
        <Text allowFontScaling style={styles.cardTitle}>Vibration strength</Text>
        <View accessibilityRole="radiogroup" accessibilityLabel="Vibration strength" style={styles.choiceRow}>
          {STRENGTHS.map((strength) => {
            const selected = preferences.strength === strength;
            return (
              <Pressable
                key={strength}
                accessibilityRole="radio"
                accessibilityLabel={strength}
                accessibilityState={{ selected, checked: selected }}
                onPress={() => setStrength(strength)}
                style={({ pressed }) => [
                  styles.choice,
                  selected && styles.choiceSelected,
                  pressed && styles.pressed,
                ]}>
                <Text allowFontScaling style={[styles.choiceText, selected && styles.choiceTextSelected]}>
                  {strength}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <ActionButton
        label="Reset to defaults"
        accessibilityHint="Turns every cue on, sets each channel to both, and sets strength to medium"
        onPress={reset}
        tone="outline"
        style={styles.outlineButton}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardStack: { gap: spacing.md },
  cueCopy: { gap: 4 },
  cardTitle: { color: colors.text, fontSize: type.cardTitle, lineHeight: 28, fontWeight: '800' },
  caption: { color: colors.textSecondary, fontSize: type.caption, lineHeight: 22 },
  switchRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  switchLabel: { flex: 1, color: colors.text, fontSize: type.body, lineHeight: 24, fontWeight: '800' },
  switchTrack: {
    width: 96,
    height: 56,
    borderRadius: radii.pill,
    borderColor: colors.primary,
    borderWidth: 4,
    backgroundColor: colors.base,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  switchTrackOn: { backgroundColor: colors.primary },
  switchWord: { color: colors.base, fontSize: type.caption, fontWeight: '800' },
  switchWordOff: { color: colors.primary, marginLeft: 36 },
  switchThumb: { position: 'absolute', width: 44, height: 44, borderRadius: 22 },
  thumbOn: { right: 4, backgroundColor: colors.base },
  thumbOff: { left: 4, backgroundColor: colors.primary },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choice: {
    flexGrow: 1,
    flexBasis: 90,
    minHeight: 56,
    borderRadius: radii.sm,
    borderWidth: 4,
    borderColor: colors.primary,
    backgroundColor: colors.base,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  choiceSelected: { backgroundColor: colors.primary },
  choiceText: { color: colors.primary, fontSize: type.caption, lineHeight: 22, fontWeight: '800', textAlign: 'center' },
  choiceTextSelected: { color: colors.base },
  outlineButton: { minHeight: 56 },
  pressed: { opacity: 0.75 },
});

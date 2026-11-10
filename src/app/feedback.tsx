import { router } from 'expo-router';
import { useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton, Body, Heading, Screen } from '@/components/strider-ui';
import { colors, radii, spacing } from '@/constants/strider-theme';

type Rating = 'Easy' | 'Okay' | 'Hard';
type NoteId = 'hazard' | 'crosswalk' | 'matched';

const ratings: Rating[] = ['Easy', 'Okay', 'Hard'];

const notes: { id: NoteId; label: string }[] = [
  { id: 'hazard', label: 'A hazard wasn’t announced' },
  { id: 'crosswalk', label: 'A crosswalk was hard to find' },
  { id: 'matched', label: 'Everything matched the route' },
];

function Face({ mood, selected }: { mood: Rating; selected: boolean }) {
  const ink = selected ? colors.base : colors.primary;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.faceRing, { borderColor: ink }]}>
      <View style={styles.eyeRow}>
        <View style={[styles.eye, { backgroundColor: ink }]} />
        <View style={[styles.eye, { backgroundColor: ink }]} />
      </View>
      {mood === 'Okay' ? (
        <View style={[styles.flatMouth, { backgroundColor: ink }]} />
      ) : (
        <View
          style={[
            styles.curveMouth,
            mood === 'Easy' ? styles.smileMouth : styles.frownMouth,
            { borderColor: ink },
          ]}
        />
      )}
    </View>
  );
}

export default function FeedbackScreen() {
  const [rating, setRating] = useState<Rating>('Easy');
  const [checkedNotes, setCheckedNotes] = useState<Record<NoteId, boolean>>({
    hazard: false,
    crosswalk: false,
    matched: true,
  });

  const chooseRating = (next: Rating) => {
    setRating(next);
    AccessibilityInfo.announceForAccessibility(`${next}, Selected`);
  };

  const toggleNote = (id: NoteId, label: string) => {
    const next = !checkedNotes[id];
    setCheckedNotes((current) => ({ ...current, [id]: next }));
    AccessibilityInfo.announceForAccessibility(`${label}, ${next ? 'checked' : 'not checked'}`);
  };

  const finish = (saved: boolean) => {
    AccessibilityInfo.announceForAccessibility(saved ? 'Feedback saved.' : 'Feedback skipped.');
    router.replace('/home' as never);
  };

  return (
    <Screen bottomInset={24}>
      <View style={styles.introBlock}>
        <Heading style={styles.title}>How was your walk?</Heading>
        <Body style={styles.lede}>Home to Class. Your answers help other blind and low-vision walkers.</Body>
      </View>

      <Text allowFontScaling style={styles.sectionLabel}>
        How did it go?
      </Text>
      <View accessibilityRole="radiogroup" accessibilityLabel="How did it go?" style={styles.ratingRow}>
        {ratings.map((option) => {
          const selected = option === rating;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityLabel={`${option}, ${selected ? 'Selected' : 'Not selected'}`}
              accessibilityState={{ selected, checked: selected }}
              onPress={() => chooseRating(option)}
              style={({ pressed }) => [styles.ratingTile, selected && styles.ratingSelected, pressed && styles.pressed]}>
              <Face mood={option} selected={selected} />
              <View style={styles.ratingCaption}>
                {selected ? (
                  <Text allowFontScaling style={[styles.ratingCheck, styles.selectedInk]}>
                    ✓
                  </Text>
                ) : null}
                <Text allowFontScaling style={[styles.ratingLabel, selected && styles.selectedInk]}>
                  {option}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <Text allowFontScaling style={styles.sectionLabel}>
        Anything we should know?
      </Text>
      <View style={styles.noteList}>
        {notes.map((note) => {
          const checked = checkedNotes[note.id];
          return (
            <Pressable
              key={note.id}
              accessibilityRole="checkbox"
              accessibilityLabel={note.label}
              accessibilityState={{ checked }}
              onPress={() => toggleNote(note.id, note.label)}
              style={({ pressed }) => [styles.noteRow, pressed && styles.pressed]}>
              <View accessibilityElementsHidden style={[styles.checkbox, checked && styles.checkboxChecked]}>
                {checked ? <Text style={styles.checkboxCheck}>✓</Text> : null}
              </View>
              <Text allowFontScaling style={styles.noteLabel}>
                {note.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.actions}>
        <ActionButton label="Submit feedback" onPress={() => finish(true)} />
        <ActionButton label="Skip for now" onPress={() => finish(false)} tone="outline" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  introBlock: { gap: 8 },
  title: { fontSize: 34, lineHeight: 40, fontWeight: '800' },
  lede: { fontSize: 17, lineHeight: 24, color: colors.textSecondary },
  sectionLabel: { color: colors.primary, fontSize: 20, lineHeight: 26, fontWeight: '700' },
  ratingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  ratingTile: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 96,
    minHeight: 104,
    paddingHorizontal: spacing.sm,
    paddingVertical: 12,
    borderRadius: radii.md,
    borderWidth: 3,
    borderColor: colors.primary,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  ratingSelected: { backgroundColor: colors.primary },
  faceRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 2,
    gap: 4,
  },
  eyeRow: { flexDirection: 'row', gap: 8 },
  eye: { width: 5, height: 5, borderRadius: 2.5 },
  flatMouth: { width: 16, height: 3, borderRadius: 2, marginTop: 4 },
  curveMouth: {
    width: 18,
    height: 9,
    backgroundColor: 'transparent',
    borderLeftWidth: 3,
    borderRightWidth: 3,
  },
  smileMouth: {
    borderBottomWidth: 3,
    borderTopWidth: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    marginTop: 2,
  },
  frownMouth: {
    borderTopWidth: 3,
    borderBottomWidth: 0,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    marginTop: 6,
  },
  ratingCaption: { minHeight: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  ratingCheck: { fontSize: 18, lineHeight: 22, fontWeight: '800' },
  ratingLabel: { color: colors.text, fontSize: 18, lineHeight: 22, fontWeight: '800', textAlign: 'center' },
  selectedInk: { color: colors.base },
  noteList: { gap: spacing.sm },
  noteRow: {
    minHeight: 64,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 3,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.primary },
  checkboxCheck: { color: colors.base, fontSize: 18, lineHeight: 20, fontWeight: '900' },
  noteLabel: { flex: 1, color: colors.text, fontSize: 18, lineHeight: 24, fontWeight: '600' },
  actions: { marginTop: 'auto', paddingTop: spacing.xl, gap: spacing.sm },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
});

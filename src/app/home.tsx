import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton, Body, BottomTabs, Card, Heading, LogoMark, Screen } from '@/components/strider-ui';
import { colors, radii, spacing, type } from '@/constants/strider-theme';

type GuidanceMode = 'general' | 'crosswalk' | 'depth';

const guidanceOptions: { id: GuidanceMode; title: string; detail: string }[] = [
  { id: 'general', title: 'General guidance', detail: 'Everything, all at once' },
  { id: 'crosswalk', title: 'Crosswalk assistance', detail: 'Find it, line up, cross straight' },
  { id: 'depth', title: 'Depth perception', detail: 'Steps, curbs and drop-offs' },
];

export default function HomeScreen() {
  const [selected, setSelected] = useState<GuidanceMode>('general');
  const selectedOption = guidanceOptions.find((option) => option.id === selected) ?? guidanceOptions[0];

  return (
    <Screen scroll={false} bottomInset={20}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.brandRow}>
        <LogoMark size={46} />
        <Text allowFontScaling style={styles.brand}>
          Strider
        </Text>
      </View>

      <Heading style={styles.heading}>Ready to walk?</Heading>

      <Card style={styles.deviceCard}>
        <View accessible accessibilityLabel="Collar camera. Connected, battery 82 percent." style={styles.deviceCopy}>
          <Text allowFontScaling style={styles.cardTitle}>
            Collar camera
          </Text>
          <Body style={styles.deviceStatus}>
            Connected · battery{'\n'}82%
          </Body>
        </View>
        <ActionButton
          label="Manage"
          accessibilityHint="Opens camera settings"
          onPress={() => router.push('/camera' as never)}
          tone="outline"
          style={styles.manageButton}
        />
      </Card>

      <View accessibilityRole="radiogroup" accessibilityLabel="Guidance mode" style={styles.guidanceList}>
        {guidanceOptions.map((option, index) => {
          const isSelected = option.id === selected;
          const isFirst = index === 0;
          const isLast = index === guidanceOptions.length - 1;

          return (
            <View key={option.id}>
              {index > 0 ? (
                <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.railJoin}>
                  <View style={styles.railJoinLine} />
                </View>
              ) : null}
              <Pressable
                accessibilityRole="radio"
                accessibilityLabel={`${option.title}. ${option.detail}. ${isSelected ? 'Selected' : 'Not selected'}.`}
                accessibilityState={{ checked: isSelected }}
                onPress={() => setSelected(option.id)}
                style={({ pressed }) => [styles.guidanceRow, pressed && styles.pressed]}>
                <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.railColumn}>
                  <View style={[styles.railLine, isFirst && styles.railHidden]} />
                  <View style={[styles.railNode, isSelected ? styles.railNodeFilled : styles.railNodeRing]} />
                  <View style={[styles.railLine, isLast && styles.railHidden]} />
                </View>
                <View style={[styles.guidanceCard, isSelected && styles.guidanceSelected]}>
                  <View style={[styles.optionIcon, isSelected && styles.optionIconSelected]}>
                    <GuidanceIcon id={option.id} />
                  </View>
                  <View style={styles.optionCopy}>
                    <Text allowFontScaling style={[styles.optionTitle, isSelected && styles.optionTitleSelected]}>
                      {option.title}
                    </Text>
                    <Text allowFontScaling style={[styles.optionDetail, isSelected && styles.optionDetailSelected]}>
                      {option.detail}
                    </Text>
                  </View>
                  <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.selectionState}>
                    <View style={[styles.statusCircle, isSelected && styles.statusCircleSelected]}>
                      {isSelected ? <Text allowFontScaling style={styles.checkMark}>✓</Text> : null}
                    </View>
                    {isSelected ? (
                      <Text allowFontScaling style={styles.selectedLabel}>
                        Selected
                      </Text>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            </View>
          );
        })}
      </View>

      <ActionButton
        label="Choose destination"
        accessibilityHint={`Opens the destination picker for ${selectedOption.title}`}
        onPress={() => router.push({ pathname: '/navigate', params: { mode: selected } } as never)}
        icon={
          <Text accessibilityElementsHidden allowFontScaling style={styles.arrow}>
            →
          </Text>
        }
      />

      <View style={styles.flexSpacer} />
      <BottomTabs selected="home" />
    </Screen>
  );
}

function GuidanceIcon({ id }: { id: GuidanceMode }) {
  if (id === 'general') {
    return (
      <View style={styles.cane}>
        <View style={styles.caneHook} />
        <View style={styles.caneShaft} />
      </View>
    );
  }

  if (id === 'crosswalk') {
    return (
      <View style={styles.bars}>
        <View style={styles.bar} />
        <View style={styles.bar} />
        <View style={styles.bar} />
      </View>
    );
  }

  return (
    <View style={styles.stairs}>
      <View style={[styles.stairTread, styles.stairTreadLow]} />
      <View style={[styles.stairRiser, styles.stairRiserLow]} />
      <View style={[styles.stairTread, styles.stairTreadMid]} />
      <View style={[styles.stairRiser, styles.stairRiserHigh]} />
      <View style={[styles.stairTread, styles.stairTreadHigh]} />
    </View>
  );
}

const styles = StyleSheet.create({
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 54 },
  brand: { color: colors.text, fontSize: 30, fontWeight: '800' },
  heading: { fontSize: type.display, lineHeight: 42, fontWeight: '800' },
  deviceCard: {
    minHeight: 96,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderColor: colors.primary,
    borderWidth: 2,
  },
  deviceCopy: { flex: 1 },
  cardTitle: { color: colors.text, fontSize: type.cardTitle, fontWeight: '700' },
  deviceStatus: { fontSize: type.caption, lineHeight: 22, marginTop: 3 },
  manageButton: { minHeight: 56, flexShrink: 0, borderRadius: radii.md, paddingHorizontal: 20 },
  guidanceList: {},
  guidanceRow: { flexDirection: 'row', alignItems: 'stretch' },
  railJoin: { width: 16, height: 10, alignItems: 'center' },
  railJoinLine: { width: 3, flex: 1, backgroundColor: colors.primary, borderRadius: 2 },
  railColumn: { width: 16, marginRight: 8, alignItems: 'center' },
  railLine: { width: 3, flex: 1, backgroundColor: colors.primary, borderRadius: 2 },
  railHidden: { backgroundColor: 'transparent' },
  railNode: { width: 14, height: 14, borderRadius: 7, zIndex: 1, marginVertical: -1 },
  railNodeFilled: { backgroundColor: colors.primary },
  railNodeRing: { backgroundColor: colors.base, borderWidth: 3, borderColor: colors.primary },
  guidanceCard: {
    flex: 1,
    minHeight: 88,
    backgroundColor: colors.card,
    borderColor: colors.primary,
    borderWidth: 3,
    borderRadius: radii.md,
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  guidanceSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  pressed: { opacity: 0.78 },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.logoInner,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  optionIconSelected: { backgroundColor: colors.base },
  optionCopy: { flex: 1, gap: 4, minWidth: 0 },
  optionTitle: { color: colors.text, fontSize: 20, lineHeight: 24, fontWeight: '800' },
  optionTitleSelected: { color: colors.base },
  optionDetail: { color: colors.textSecondary, fontSize: 17, lineHeight: 21 },
  optionDetailSelected: { color: colors.base },
  selectionState: { alignItems: 'center', gap: 2, width: 68, flexShrink: 0 },
  statusCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCircleSelected: { backgroundColor: colors.base, borderColor: colors.base },
  checkMark: { color: colors.primary, fontSize: 18, fontWeight: '800', lineHeight: 20 },
  selectedLabel: { color: colors.base, fontSize: 17, fontWeight: '700' },
  arrow: { color: colors.base, fontSize: 28, lineHeight: 30, fontWeight: '700' },
  flexSpacer: { flexGrow: 1, minHeight: spacing.sm },
  cane: { width: 18, height: 24, alignItems: 'flex-end' },
  caneHook: {
    width: 15,
    height: 11,
    borderWidth: 3,
    borderColor: colors.primary,
    borderBottomWidth: 0,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
  },
  caneShaft: { width: 3, height: 15, marginTop: -2, backgroundColor: colors.primary, borderRadius: 2 },
  bars: { width: 18, height: 15, justifyContent: 'space-between' },
  bar: { height: 3, borderRadius: 1.5, backgroundColor: colors.primary },
  stairs: { width: 22, height: 18 },
  stairTread: { position: 'absolute', height: 3, backgroundColor: colors.primary, borderRadius: 1.5 },
  stairRiser: { position: 'absolute', width: 3, backgroundColor: colors.primary, borderRadius: 1.5 },
  stairTreadLow: { left: 0, bottom: 0, width: 10 },
  stairRiserLow: { left: 8, bottom: 0, height: 10 },
  stairTreadMid: { left: 8, bottom: 7, width: 10 },
  stairRiserHigh: { left: 16, bottom: 7, height: 10 },
  stairTreadHigh: { left: 16, bottom: 14, width: 6 },
});

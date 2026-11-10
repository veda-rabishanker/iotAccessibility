import { useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton, Body, BottomTabs, Heading, Screen } from '@/components/strider-ui';
import { colors, radii, spacing, type } from '@/constants/strider-theme';

type AlertList = 'nearby' | 'routes';

type Alert = {
  icon: string;
  title: string;
  detail: string;
  accessibilityLabel: string;
};

const nearbyAlerts: Alert[] = [
  {
    icon: '↓',
    title: 'Overhead: low branch',
    detail: 'Maple St · 12 min ago',
    accessibilityLabel: 'Overhead, low branch, Maple Street, 12 minutes ago.',
  },
  {
    icon: '↯',
    title: 'Ground: broken curb',
    detail: 'Guadalupe St · 1 h ago',
    accessibilityLabel: 'Ground, broken curb, Guadalupe Street, 1 hour ago.',
  },
  {
    icon: '△',
    title: 'Construction: sidewalk closed',
    detail: 'Rio Grande St · 3 h ago',
    accessibilityLabel: 'Construction, sidewalk closed, Rio Grande Street, 3 hours ago.',
  },
];

const routeAlerts: Alert[] = [
  {
    icon: '↓',
    title: 'Overhead: low branch',
    detail: 'Maple St · Home to Class · 12 min ago',
    accessibilityLabel: 'Overhead, low branch, Maple Street, Home to Class, 12 minutes ago.',
  },
  {
    icon: '↯',
    title: 'Ground: broken curb',
    detail: 'Guadalupe St · Home to Class · 1 h ago',
    accessibilityLabel: 'Ground, broken curb, Guadalupe Street, Home to Class, 1 hour ago.',
  },
  {
    icon: '△',
    title: 'Construction: sidewalk closed',
    detail: 'Rio Grande St · Home to Bus stop · 3 h ago',
    accessibilityLabel: 'Construction, sidewalk closed, Rio Grande Street, Home to Bus stop, 3 hours ago.',
  },
];

const lists: Record<
  AlertList,
  { name: string; heading: string; caption: string; announcement: string; alerts: Alert[] }
> = {
  nearby: {
    name: 'Near me',
    heading: '3 alerts on your route',
    caption: 'Found automatically by Strider cameras',
    announcement:
      '3 alerts. Overhead low branch on Maple Street, 12 minutes ago. Ground broken curb on Guadalupe Street, 1 hour ago. Construction, sidewalk closed on Rio Grande Street, 3 hours ago.',
    alerts: nearbyAlerts,
  },
  routes: {
    name: 'My routes',
    heading: '3 alerts on your routes',
    caption: 'On routes you have walked',
    announcement:
      '3 alerts. Overhead low branch on Maple Street, Home to Class, 12 minutes ago. Ground broken curb on Guadalupe Street, Home to Class, 1 hour ago. Construction, sidewalk closed on Rio Grande Street, Home to Bus stop, 3 hours ago.',
    alerts: routeAlerts,
  },
};

export default function CommunityScreen() {
  const [list, setList] = useState<AlertList>('nearby');
  const current = lists[list];

  const selectList = (next: AlertList) => {
    if (next === list) return;
    setList(next);
    AccessibilityInfo.announceForAccessibility(lists[next].name);
  };

  return (
    <Screen bottomInset={20}>
      <View style={styles.titleBlock}>
        <Heading style={styles.heading}>Community</Heading>
        <Body>Alerts from Strider cameras</Body>
      </View>

      <View accessibilityRole="tablist" accessibilityLabel="Alert list" style={styles.segmented}>
        <ListTab label="Near me" selected={list === 'nearby'} onPress={() => selectList('nearby')} />
        <ListTab label="My routes" selected={list === 'routes'} onPress={() => selectList('routes')} />
      </View>

      <View style={styles.summaryCard}>
        <Heading style={styles.summaryHeading}>{current.heading}</Heading>
        <Body style={styles.summaryCaption}>{current.caption}</Body>
        <ActionButton
          label="Read alerts aloud"
          accessibilityHint="Reads the alerts in this list."
          icon={<SpeakerIcon />}
          onPress={() => AccessibilityInfo.announceForAccessibility(current.announcement)}
          style={styles.readButton}
        />
      </View>

      {current.alerts.map((alert) => (
        <View
          key={`${list}-${alert.title}`}
          accessible
          accessibilityLabel={alert.accessibilityLabel}
          style={styles.alertRow}>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.iconBox}>
            <Text style={styles.alertIcon}>{alert.icon}</Text>
          </View>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.alertCopy}>
            <Text allowFontScaling style={styles.alertTitle}>
              {alert.title}
            </Text>
            <Text allowFontScaling style={styles.alertDetail}>
              {alert.detail}
            </Text>
          </View>
        </View>
      ))}

      <View style={styles.flexSpacer} />
      <BottomTabs selected="community" />
    </Screen>
  );
}

function SpeakerIcon() {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.speaker}>
      <View style={styles.speakerBody} />
      <View style={styles.speakerWave} />
    </View>
  );
}

function ListTab({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.segment, selected && styles.segmentSelected, pressed && styles.pressed]}>
      {selected ? (
        <Text accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.check}>
          ✓
        </Text>
      ) : null}
      <Text allowFontScaling style={[styles.segmentLabel, selected && styles.segmentLabelSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  titleBlock: { gap: 4, marginTop: spacing.sm },
  heading: { fontSize: type.display, lineHeight: 42, fontWeight: '800' },
  segmented: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radii.pill,
    backgroundColor: colors.base,
  },
  segment: {
    flex: 1,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
  },
  segmentSelected: { backgroundColor: colors.primary },
  check: { color: colors.base, fontSize: 20, lineHeight: 24, fontWeight: '800' },
  segmentLabel: { color: colors.text, fontSize: type.body, lineHeight: 24, fontWeight: '600' },
  segmentLabelSelected: { color: colors.base, fontWeight: '800' },
  pressed: { opacity: 0.78 },
  summaryCard: {
    gap: spacing.sm,
    padding: 18,
    backgroundColor: colors.card,
    borderColor: colors.primary,
    borderWidth: 2,
    borderRadius: radii.md,
  },
  summaryHeading: { fontSize: type.title, lineHeight: 34, fontWeight: '800' },
  summaryCaption: { fontSize: type.caption, lineHeight: 22 },
  readButton: { borderRadius: radii.pill, marginTop: 2 },
  speaker: { width: 26, height: 22, flexDirection: 'row', alignItems: 'center' },
  speakerBody: {
    width: 8,
    height: 10,
    backgroundColor: colors.base,
    borderTopLeftRadius: 2,
    borderBottomLeftRadius: 2,
  },
  speakerWave: {
    width: 10,
    height: 10,
    marginLeft: -2,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftWidth: 8,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: colors.base,
  },
  alertRow: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: colors.card,
    borderColor: colors.primary,
    borderWidth: 2,
    borderRadius: radii.md,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: radii.sm,
    backgroundColor: colors.logoInner,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertIcon: { color: colors.primary, fontSize: 28, lineHeight: 32, fontWeight: '700' },
  alertCopy: { flex: 1, gap: 2 },
  alertTitle: { color: colors.text, fontSize: 20, lineHeight: 25, fontWeight: '800' },
  alertDetail: { color: colors.textSecondary, fontSize: type.caption, lineHeight: 22 },
  flexSpacer: { flexGrow: 1, minHeight: spacing.xs },
});

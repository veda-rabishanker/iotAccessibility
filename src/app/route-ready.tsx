import { router, useLocalSearchParams } from 'expo-router';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton, BackButton } from '@/components/strider-ui';
import { colors, radii, spacing, type } from '@/constants/strider-theme';

const STREET = '#17675F';
const BLOCK = '#041E1C';

const obstacles = [
  { n: 1, title: 'Low branch, head height', detail: 'Maple St · after 0.1 mi' },
  { n: 2, title: 'Broken curb', detail: 'Guadalupe St · after 0.3 mi' },
  { n: 3, title: 'Sidewalk closed', detail: 'Rio Grande St · after 0.5 mi' },
];

function firstParam(value: string | string[] | undefined, fallback: string) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw ? raw : fallback;
}

export default function RouteReadyScreen() {
  const params = useLocalSearchParams<{ mode?: string | string[]; destination?: string | string[] }>();
  const mode = firstParam(params.mode, 'general');
  const destination = firstParam(params.destination, 'Home to Class');

  const announcement =
    `${destination}. 12 minutes, 0.6 miles, 4 crossings. 3 obstacles ahead. ` +
    'Low branch at head height on Maple Street after 0.1 miles. ' +
    'Broken curb on Guadalupe Street after 0.3 miles. ' +
    'Sidewalk closed on Rio Grande Street after 0.5 miles.';

  return (
    <View style={styles.root}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.map}>
        {[10, 32, 54, 76].map((left) => (
          <View key={`v-${left}`} style={[styles.streetV, { left: `${left}%` }]} />
        ))}
        {[14, 38, 62, 86].map((top) => (
          <View key={`h-${top}`} style={[styles.streetH, { top: `${top}%` }]} />
        ))}
        <View style={[styles.block, { left: '16%', top: '20%', width: '12%', height: '14%' }]} />
        <View style={[styles.block, { left: '38%', top: '44%', width: '12%', height: '14%' }]} />
        <View style={[styles.block, { left: '60%', top: '20%', width: '12%', height: '16%' }]} />
        <View style={[styles.block, { left: '16%', top: '68%', width: '14%', height: '12%' }]} />

        <View style={styles.routeBox}>
          <View style={styles.trackStub} />
          <View style={styles.trackH} />
          <View style={styles.trackV} />
          <View style={styles.joinStart} />
          <View style={styles.joinTurn} />

          <View style={styles.startPad} />
          <View style={styles.startRing}>
            <View style={styles.startCore} />
          </View>

          <RouteBadge n={1} left="18%" top="58%" />
          <RouteBadge n={2} left="50%" top="58%" />
          <RouteBadge n={3} left="86%" top="30%" />
          <View style={styles.endDot} />
        </View>
      </View>

      <SafeAreaView edges={['top']} pointerEvents="box-none" style={styles.backBar}>
        <BackButton fallback="/navigate" />
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        <View style={styles.titleBlock}>
          <Text accessibilityRole="header" allowFontScaling style={styles.heading}>
            {destination}
          </Text>
          <Text allowFontScaling style={styles.summary}>
            12 min · 0.6 mi · 4 crossings
          </Text>
        </View>

        <View style={styles.obstacleRow}>
          <Text allowFontScaling style={styles.obstacleHeading}>
            3 obstacles ahead
          </Text>
          <ActionButton
            label="Read aloud"
            tone="outline"
            accessibilityHint="Reads the route summary and obstacles."
            onPress={() => AccessibilityInfo.announceForAccessibility(announcement)}
            style={styles.readButton}
          />
        </View>

        <View style={styles.list}>
          {obstacles.map((item) => (
            <View
              key={item.n}
              accessible
              accessibilityLabel={`Obstacle ${item.n}. ${item.title}. ${item.detail}.`}
              style={styles.obstacleCard}>
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={styles.obstacleInner}>
                <View style={styles.cardBadge}>
                  <Text allowFontScaling style={styles.cardBadgeText}>
                    {item.n}
                  </Text>
                </View>
                <View style={styles.obstacleCopy}>
                  <Text allowFontScaling style={styles.obstacleTitle}>
                    {item.title}
                  </Text>
                  <Text allowFontScaling style={styles.obstacleDetail}>
                    {item.detail}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <ActionButton
            label="Start session"
            icon={
              <Text accessibilityElementsHidden allowFontScaling style={styles.playIcon}>
                ▶
              </Text>
            }
            onPress={() => router.push({ pathname: '/session', params: { mode, destination } } as never)}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

function RouteBadge({ n, left, top }: { n: number; left: `${number}%`; top: `${number}%` }) {
  return (
    <View style={[styles.mapBadge, { left, top }]}>
      <Text allowFontScaling style={styles.mapBadgeText}>
        {n}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.base },
  map: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '42%',
    backgroundColor: colors.logoInner,
    overflow: 'hidden',
  },
  streetV: { position: 'absolute', top: 0, bottom: 0, width: 14, backgroundColor: STREET },
  streetH: { position: 'absolute', left: 0, right: 0, height: 14, backgroundColor: STREET },
  block: { position: 'absolute', backgroundColor: BLOCK, borderRadius: 10 },
  routeBox: { position: 'absolute', left: '8%', right: '10%', top: '8%', bottom: '4%' },
  trackH: {
    position: 'absolute',
    left: '8%',
    width: '78%',
    top: '58%',
    height: 14,
    marginTop: -7,
    backgroundColor: colors.primary,
    borderColor: colors.text,
    borderWidth: 2.5,
    borderRadius: 8,
  },
  trackV: {
    position: 'absolute',
    left: '86%',
    width: 14,
    marginLeft: -7,
    top: '10%',
    height: '48%',
    backgroundColor: colors.primary,
    borderColor: colors.text,
    borderWidth: 2.5,
    borderRadius: 8,
  },
  trackStub: {
    position: 'absolute',
    left: '8%',
    width: 14,
    marginLeft: -7,
    top: '58%',
    height: '24%',
    backgroundColor: colors.primary,
    borderColor: colors.text,
    borderWidth: 2.5,
    borderRadius: 8,
  },
  joinStart: {
    position: 'absolute',
    left: '8%',
    top: '58%',
    width: 14,
    height: 14,
    marginLeft: -7,
    marginTop: -7,
    borderRadius: 7,
    backgroundColor: colors.primary,
  },
  joinTurn: {
    position: 'absolute',
    left: '86%',
    top: '58%',
    width: 14,
    height: 14,
    marginLeft: -7,
    marginTop: -7,
    borderRadius: 7,
    backgroundColor: colors.primary,
  },
  startPad: {
    position: 'absolute',
    left: '8%',
    top: '82%',
    width: 42,
    height: 42,
    marginLeft: -21,
    marginTop: -21,
    borderRadius: 21,
    backgroundColor: '#0A3F3A',
  },
  startRing: {
    position: 'absolute',
    left: '8%',
    top: '82%',
    width: 28,
    height: 28,
    marginLeft: -14,
    marginTop: -14,
    borderRadius: 14,
    borderWidth: 4,
    borderColor: colors.primary,
    backgroundColor: colors.logoInner,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  startCore: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.text },
  mapBadge: {
    position: 'absolute',
    width: 36,
    height: 36,
    marginLeft: -18,
    marginTop: -18,
    borderRadius: 18,
    backgroundColor: colors.pause,
    borderWidth: 3,
    borderColor: colors.base,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  mapBadgeText: { color: colors.base, fontSize: 17, fontWeight: '800' },
  endDot: {
    position: 'absolute',
    left: '86%',
    top: '10%',
    width: 28,
    height: 28,
    marginLeft: -14,
    marginTop: -14,
    borderRadius: 14,
    backgroundColor: colors.stop,
    zIndex: 3,
  },
  backBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 4,
    paddingHorizontal: spacing.md,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: '36%',
    backgroundColor: colors.base,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    zIndex: 2,
  },
  titleBlock: { gap: spacing.xs, marginBottom: spacing.md },
  heading: {
    color: colors.text,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
  },
  summary: {
    color: colors.primary,
    fontSize: type.body,
    lineHeight: 24,
    fontWeight: '700',
  },
  obstacleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    flexWrap: 'wrap',
    marginBottom: spacing.md,
  },
  obstacleHeading: {
    color: colors.text,
    fontSize: type.cardTitle,
    lineHeight: 28,
    fontWeight: '700',
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 140,
  },
  readButton: { minHeight: 56, paddingHorizontal: spacing.md, flexGrow: 0 },
  list: { gap: spacing.sm },
  obstacleCard: {
    backgroundColor: colors.card,
    borderColor: colors.divider,
    borderWidth: 2,
    borderRadius: radii.md,
    minHeight: 72,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  obstacleInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cardBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.pause,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardBadgeText: { color: colors.base, fontSize: 20, fontWeight: '800' },
  obstacleCopy: { flex: 1 },
  obstacleTitle: { color: colors.text, fontSize: type.body, lineHeight: 24, fontWeight: '700' },
  obstacleDetail: { color: colors.textSecondary, fontSize: type.caption, lineHeight: 22 },
  footer: { marginTop: 'auto', paddingTop: spacing.md, paddingBottom: spacing.sm },
  playIcon: { color: colors.base, fontSize: 22, fontWeight: '800' },
});

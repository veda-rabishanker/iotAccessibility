import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton, BackButton } from '@/components/strider-ui';
import { colors, radii, spacing, type } from '@/constants/strider-theme';

const STREET = '#17675F';
const STREET_DARK = '#0E3E3A';

const SAVED_ROUTES = [
  { title: 'Home to Class', detail: 'Walked 12 times · 0.6 mi' },
  { title: 'Home to Bus stop', detail: 'Walked 8 times · 0.3 mi' },
  { title: 'Class to Library', detail: 'Walked 3 times · 0.4 mi' },
];

export default function NavigateScreen() {
  const { mode: modeParam } = useLocalSearchParams<{ mode?: string | string[] }>();
  const mode = (Array.isArray(modeParam) ? modeParam[0] : modeParam) || 'general';
  const [query, setQuery] = useState('');
  const [listening, setListening] = useState(false);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return SAVED_ROUTES;
    const matches = SAVED_ROUTES.filter((item) => item.title.toLowerCase().includes(term));
    if (matches.length) return matches;
    return [{ title: query.trim(), detail: 'Preview this destination' }];
  }, [query]);

  const openRoute = (destination: string) => {
    router.push({ pathname: '/route-ready', params: { mode, destination } } as never);
  };

  const sayDestination = () => {
    if (listening) return;
    setListening(true);
    AccessibilityInfo.announceForAccessibility('Listening');
    setTimeout(() => {
      setQuery('Class');
      AccessibilityInfo.announceForAccessibility('Heard Class');
      setListening(false);
    }, 900);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.mapArea}>
        <DecorativeMap />
        <View pointerEvents="box-none" style={styles.controls}>
          <BackButton fallback="/home" />
          <View style={styles.search}>
            <Magnifier />
            <TextInput
              accessibilityLabel="Where do you want to go?"
              accessibilityHint="Type a destination. Double tap to type."
              allowFontScaling
              autoCapitalize="words"
              autoCorrect={false}
              onChangeText={setQuery}
              placeholder="Where do you want to go?"
              placeholderTextColor={colors.text}
              returnKeyType="search"
              style={styles.searchInput}
              underlineColorAndroid="transparent"
              value={query}
            />
          </View>
        </View>
      </View>

      <View style={styles.sheet}>
        <View accessibilityElementsHidden style={styles.handle} />
        <Text accessibilityRole="header" allowFontScaling style={styles.heading}>
          Saved routes
        </Text>

        <View style={styles.list}>
          {results.map((item) => (
            <Pressable
              accessibilityHint="Opens the route preview"
              accessibilityLabel={`${item.title}. ${item.detail}.`}
              accessibilityRole="button"
              key={item.title}
              onPress={() => openRoute(item.title)}
              style={({ pressed }) => [styles.routeCard, pressed && styles.pressed]}>
              <PinGlyph />
              <View style={styles.routeCopy}>
                <Text allowFontScaling style={styles.routeTitle}>{item.title}</Text>
                <Text allowFontScaling style={styles.routeDetail}>{item.detail}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        <ActionButton
          icon={<MicGlyph />}
          label="Say your destination"
          onPress={sayDestination}
          style={styles.voiceButton}
        />
      </View>
    </SafeAreaView>
  );
}

function DecorativeMap() {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.map}>
      <View style={[styles.streetV, { left: '6%' }]} />
      <View style={[styles.streetV, styles.streetDark, { left: '28%' }]} />
      <View style={[styles.streetV, { left: '49%' }]} />
      <View style={[styles.streetV, { left: '72%' }]} />
      <View style={[styles.streetV, styles.streetDark, { left: '91%' }]} />
      <View style={[styles.streetH, { top: '10%' }]} />
      <View style={[styles.streetH, styles.streetDark, { top: '32%' }]} />
      <View style={[styles.streetH, { top: '54%' }]} />
      <View style={[styles.streetH, { top: '76%' }]} />
      <View style={styles.block} />
      <Text allowFontScaling style={[styles.streetLabel, styles.guadalupe]}>Guadalupe St</Text>
      <Text allowFontScaling style={[styles.streetLabel, styles.rio]}>Rio Grande St</Text>
      <View style={styles.location}>
        <View style={styles.locationRing}>
          <View style={styles.locationDot} />
        </View>
      </View>
      <View style={styles.herePill}>
        <Text allowFontScaling style={styles.hereText}>You are here</Text>
      </View>
    </View>
  );
}

function Magnifier() {
  return (
    <View accessibilityElementsHidden style={styles.magnifier}>
      <View style={styles.magnifierLens} />
      <View style={styles.magnifierHandle} />
    </View>
  );
}

function PinGlyph() {
  return (
    <View accessibilityElementsHidden style={styles.pin}>
      <View style={styles.pinHead}>
        <View style={styles.pinHole} />
      </View>
      <View style={styles.pinTip} />
    </View>
  );
}

function MicGlyph() {
  return (
    <View accessibilityElementsHidden style={styles.mic}>
      <View style={styles.micBody} />
      <View style={styles.micBowl} />
      <View style={styles.micStem} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.base },
  mapArea: { flex: 1 },
  map: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.logoInner,
    overflow: 'hidden',
  },
  streetV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 22,
    backgroundColor: STREET,
  },
  streetH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 22,
    backgroundColor: STREET,
  },
  streetDark: { backgroundColor: STREET_DARK },
  block: {
    position: 'absolute',
    top: '34%',
    left: '54%',
    width: 92,
    height: 74,
    backgroundColor: STREET_DARK,
    borderRadius: 10,
  },
  streetLabel: {
    position: 'absolute',
    color: colors.textSecondary,
    fontSize: type.caption,
    fontWeight: '700',
  },
  guadalupe: { top: '28%', right: 18 },
  rio: { top: '53%', left: '58%' },
  location: {
    position: 'absolute',
    top: '48%',
    left: '38%',
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: STREET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationRing: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  herePill: {
    position: 'absolute',
    left: 14,
    bottom: 48,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.base,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  hereText: { color: colors.text, fontSize: type.caption, fontWeight: '800' },
  controls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.md,
    zIndex: 2,
  },
  search: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.base,
    borderColor: colors.primary,
    borderWidth: 3,
    borderRadius: 32,
    paddingHorizontal: spacing.md,
  },
  magnifier: { width: 26, height: 26, marginRight: 10 },
  magnifierLens: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2.5,
    borderColor: colors.primary,
  },
  magnifierHandle: {
    position: 'absolute',
    width: 9,
    height: 3,
    backgroundColor: colors.primary,
    borderRadius: 2,
    right: 1,
    bottom: 3,
    transform: [{ rotate: '45deg' }],
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: type.body,
    minHeight: 52,
    paddingVertical: spacing.sm,
  },
  sheet: {
    backgroundColor: colors.base,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    marginTop: -36,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 24,
    zIndex: 3,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#5A6B6A',
    marginBottom: spacing.sm,
  },
  heading: {
    color: colors.text,
    fontSize: type.title,
    fontWeight: '800',
    lineHeight: 34,
    marginBottom: spacing.md,
  },
  list: { gap: 12 },
  routeCard: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.card,
    borderColor: colors.primary,
    borderWidth: 2,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  routeCopy: { flex: 1, flexShrink: 1, gap: 2 },
  routeTitle: {
    color: colors.text,
    fontSize: type.cardTitle,
    lineHeight: 26,
    fontWeight: '800',
  },
  routeDetail: {
    color: colors.textSecondary,
    fontSize: type.caption,
    lineHeight: 22,
  },
  pressed: { opacity: 0.78 },
  voiceButton: { marginTop: spacing.md },
  pin: { width: 22, height: 30, alignItems: 'center' },
  pinHead: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinHole: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.card,
  },
  pinTip: {
    width: 0,
    height: 0,
    marginTop: -2,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 11,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.primary,
  },
  mic: { width: 20, height: 26, alignItems: 'center' },
  micBody: {
    width: 11,
    height: 15,
    borderRadius: 6,
    backgroundColor: colors.base,
  },
  micBowl: {
    width: 18,
    height: 10,
    marginTop: -6,
    borderWidth: 2.5,
    borderTopWidth: 0,
    borderColor: colors.base,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  micStem: {
    width: 2.5,
    height: 5,
    backgroundColor: colors.base,
    marginTop: 1,
  },
});

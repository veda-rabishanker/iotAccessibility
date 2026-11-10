import { Image } from 'expo-image';
import { router } from 'expo-router';
import type { PropsWithChildren, ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, type TextStyle, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing, type } from '@/constants/strider-theme';

export function Screen({ children, scroll = true, bottomInset = 20 }: PropsWithChildren<{ scroll?: boolean; bottomInset?: number }>) {
  const content = scroll ? (
    <ScrollView contentContainerStyle={[styles.screenContent, { paddingBottom: bottomInset }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>
  ) : <View style={[styles.screenContent, styles.flex, { paddingBottom: bottomInset }]}>{children}</View>;
  return <SafeAreaView style={styles.safe}>{content}</SafeAreaView>;
}

export function Heading({ children, style, accessibilityLabel }: PropsWithChildren<{ style?: TextStyle; accessibilityLabel?: string }>) {
  return <Text accessibilityRole="header" accessibilityLabel={accessibilityLabel} allowFontScaling style={[styles.heading, style]}>{children}</Text>;
}
export function Body({ children, style }: PropsWithChildren<{ style?: TextStyle }>) {
  return <Text allowFontScaling style={[styles.body, style]}>{children}</Text>;
}
export function Card({ children, style, accessible, accessibilityLabel }: PropsWithChildren<{ style?: ViewStyle; accessible?: boolean; accessibilityLabel?: string }>) {
  return <View accessible={accessible} accessibilityLabel={accessibilityLabel} style={[styles.card, style]}>{children}</View>;
}

type ButtonProps = { label: string; onPress: () => void; icon?: ReactNode; accessibilityHint?: string; disabled?: boolean; style?: ViewStyle; tone?: 'primary' | 'outline' | 'pause' | 'stop' };
export function ActionButton({ label, onPress, icon, accessibilityHint, disabled, style, tone = 'primary' }: ButtonProps) {
  const palette = { primary: styles.primaryButton, outline: styles.outlineButton, pause: styles.pauseButton, stop: styles.stopButton }[tone];
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={accessibilityHint} accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.action, palette, pressed && styles.pressed, disabled && styles.disabled, style]}>
      {icon}<Text allowFontScaling style={[styles.actionText, tone === 'outline' && styles.outlineText]}>{label}</Text>
    </Pressable>
  );
}

export function BackButton({ fallback = '/home' }: { fallback?: string }) {
  return <ActionButton label="Back" accessibilityHint="Returns to the previous screen" onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback as never))} icon={<Text style={styles.backIcon}>‹</Text>} tone="outline" style={styles.backButton} />;
}

const striderLogo = require('@/assets/images/strider-logo.png');

export function LogoMark({ size = 92 }: { size?: number; showSignal?: boolean; color?: string }) {
  return (
    <Image
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      contentFit="contain"
      source={striderLogo}
      style={{ width: size, height: size }}
    />
  );
}

export function BottomTabs({ selected }: { selected: 'home' | 'community' }) {
  return (
    <View accessibilityRole="tablist" style={styles.tabs}>
      <Tab label="Home" selected={selected === 'home'} onPress={() => router.replace('/home' as never)} icon={<LogoMark size={32} />} />
      <Tab label="Community" selected={selected === 'community'} onPress={() => router.replace('/community' as never)} icon={<CommunityMark />} />
    </View>
  );
}
function Tab({ label, selected, onPress, icon }: { label: string; selected: boolean; onPress: () => void; icon: ReactNode }) {
  return <Pressable accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress} style={[styles.tab, selected && styles.tabSelected]}>{icon}<Text allowFontScaling style={[styles.tabText, selected && styles.tabTextSelected]}>{label}</Text></Pressable>;
}
function CommunityMark() {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.communityMark}>
      <LogoMark size={20} />
      <View style={styles.communityMarkCenter}>
        <LogoMark size={24} />
      </View>
      <LogoMark size={20} />
    </View>
  );
}

export function Check({ selected }: { selected: boolean }) {
  return <View style={[styles.check, selected && styles.checkSelected]}>{selected && <Text style={styles.checkGlyph}>✓</Text>}</View>;
}
export function MapBackdrop({ children }: PropsWithChildren) {
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.map}>{[58, 180, 302].map((left) => <View key={`v-${left}`} style={[styles.mapVertical, { left }]} />)}{[58, 190, 310].map((top) => <View key={`h-${top}`} style={[styles.mapHorizontal, { top }]} />)}{children}</View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, safe: { flex: 1, backgroundColor: colors.base }, screenContent: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },
  heading: { color: colors.text, fontSize: type.title, fontWeight: '800', lineHeight: 34 }, body: { color: colors.textSecondary, fontSize: type.body, lineHeight: 25 },
  card: { backgroundColor: colors.card, borderColor: colors.divider, borderWidth: 2, borderRadius: radii.md, padding: spacing.md },
  action: { minHeight: 68, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  primaryButton: { backgroundColor: colors.primary }, outlineButton: { backgroundColor: colors.base, borderColor: colors.primary, borderWidth: 4 }, pauseButton: { backgroundColor: colors.pause }, stopButton: { backgroundColor: colors.stop },
  actionText: { color: colors.base, fontSize: 20, fontWeight: '800', textAlign: 'center' }, outlineText: { color: colors.primary }, pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] }, disabled: { opacity: 0.5 },
  backButton: { minHeight: 56, alignSelf: 'flex-start', paddingHorizontal: 18 }, backIcon: { color: colors.primary, fontSize: 40, lineHeight: 34 },
  tabs: { minHeight: 84, flexDirection: 'row', backgroundColor: colors.card, marginHorizontal: -spacing.lg, marginBottom: -20 }, tab: { flex: 1, minHeight: 84, alignItems: 'center', justifyContent: 'center', gap: 2, borderTopWidth: 6, borderTopColor: 'transparent' }, tabSelected: { borderTopColor: colors.primary, backgroundColor: colors.logoInner }, tabText: { color: colors.text, fontSize: 17, fontWeight: '700' }, tabTextSelected: { color: colors.primary },
  communityMark: { width: 54, height: 32, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center' },
  communityMarkCenter: { marginHorizontal: -7, marginBottom: 5, zIndex: 1 },
  check: { width: 30, height: 30, borderRadius: 15, borderWidth: 3, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' }, checkSelected: { backgroundColor: colors.logoInner, borderColor: colors.base }, checkGlyph: { color: colors.primary, fontSize: 22, fontWeight: '900', lineHeight: 24 },
  map: { height: 370, marginHorizontal: -spacing.lg, marginTop: -spacing.sm, backgroundColor: colors.logoInner, overflow: 'hidden' }, mapVertical: { position: 'absolute', top: 0, bottom: 0, width: 16, backgroundColor: '#17675F' }, mapHorizontal: { position: 'absolute', left: 0, right: 0, height: 16, backgroundColor: '#17675F' },
});

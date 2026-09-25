import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadows, spacing, type } from '../constants/theme';
import * as haptics from '../utils/haptics';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  // Secondary reads as a quieter action next to a primary one (e.g.
  // "Cancel" beside "Log price"). Same pill geometry, no fill.
  variant?: 'primary' | 'secondary';
  // Sits in the circular badge on the left. Omitted, the label centres
  // on its own.
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
}

export default function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  icon,
}: PrimaryButtonProps) {
  const isDisabled = Boolean(disabled || loading);
  const isSecondary = variant === 'secondary';
  const tint = isSecondary ? colors.text : colors.onPrimary;

  function handlePress() {
    // Fires on every press of a real action. Deliberately not fired when
    // disabled — a button that buzzes but does nothing reads as a bug.
    if (isSecondary) haptics.tap();
    else haptics.press();
    onPress();
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: Boolean(loading) }}
      style={({ pressed }) => [
        styles.button,
        isSecondary ? styles.secondary : styles.primary,
        // The accent glow is the one coloured shadow that reads against
        // a near-black background.
        !isSecondary && !isDisabled && shadows.accent,
        pressed && !isDisabled && (isSecondary ? styles.secondaryPressed : styles.primaryPressed),
        pressed && !isDisabled && styles.pressedScale,
        isDisabled && styles.disabled,
      ]}
    >
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={tint} />
        </View>
      ) : (
        <>
          {/* Badge + trailing chevrons are what make the pill read as a
              control rather than a coloured rectangle. Both are inert
              decoration, so they're hidden from screen readers — the
              Pressable already carries the label. */}
          {icon ? (
            <View
              style={[styles.badge, isSecondary ? styles.badgeSecondary : styles.badgePrimary]}
              importantForAccessibility="no"
            >
              <MaterialCommunityIcons name={icon} size={16} color={tint} />
            </View>
          ) : null}
          <Text style={[styles.label, { color: tint }]} numberOfLines={1}>
            {label}
          </Text>
          <MaterialCommunityIcons
            name="chevron-double-right"
            size={18}
            color={tint}
            style={styles.chevrons}
            importantForAccessibility="no"
          />
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    // Pill, not rounded-rectangle — the defining shape of the whole UI.
    borderRadius: radius.full,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm + 2,
    minHeight: 56,
  },
  // Height is held here so swapping in the spinner doesn't make the
  // button (and everything under it) jump.
  loadingRow: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: colors.primary },
  primaryPressed: { backgroundColor: colors.primaryDark },
  secondary: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  secondaryPressed: { backgroundColor: colors.surfaceRaised },
  pressedScale: { transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.4 },
  badge: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A translucent white knocks a hole in the orange rather than
  // introducing a third colour.
  badgePrimary: { backgroundColor: 'rgba(255, 255, 255, 0.22)' },
  badgeSecondary: { backgroundColor: colors.surfaceRaised },
  label: {
    ...type.bodyStrong,
    fontSize: 16,
    flex: 1,
    textAlign: 'center',
  },
  chevrons: { marginRight: spacing.md, opacity: 0.85 },
});

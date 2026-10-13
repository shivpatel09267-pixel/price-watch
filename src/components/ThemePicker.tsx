import { Pressable, Text, View } from 'react-native';
import { radius, spacing, type } from '../constants/theme';
import { makeStyles, useTheme, type ThemePreference } from '../context/ThemeContext';
import * as haptics from '../utils/haptics';

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export default function ThemePicker() {
  const styles = useStyles();
  const { preference, setPreference } = useTheme();

  return (
    <View style={styles.row}>
      <Text style={styles.label}>Appearance</Text>
      <View style={styles.segments}>
        {OPTIONS.map((option) => {
          const selected = option.value === preference;
          return (
            <Pressable
              key={option.value}
              onPress={() => {
                if (selected) return;
                haptics.selection();
                setPreference(option.value);
              }}
              style={[styles.segment, selected && styles.segmentSelected]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors, card }) => ({
  row: { ...card, padding: spacing.md },
  label: { ...type.bodyStrong, color: colors.text, marginBottom: spacing.sm },
  segments: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.full,
    padding: 3,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  segmentSelected: { backgroundColor: colors.primary },
  segmentText: { ...type.caption, fontWeight: '600', color: colors.textMuted },
  segmentTextSelected: { color: colors.onPrimary },
}));

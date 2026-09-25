import { StyleSheet, Switch, Text, View } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { colors, radius, spacing } from '../constants/theme';

// Shown both on the Settings screen and at the top of the Dashboard, per
// spec — both instances read/write the same shared SettingsContext state,
// so toggling it in either place updates both immediately.
export default function PriceContextToggle() {
  const { showPriceContext, setShowPriceContext, loaded } = useSettings();

  return (
    <View style={styles.row}>
      <Text style={styles.label}>Show price context</Text>
      <Switch value={showPriceContext} onValueChange={setShowPriceContext} disabled={!loaded} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
});

import { StyleSheet, Switch, Text, View } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { card, colors, spacing, type } from '../constants/theme';

// Shown both on the Settings screen and at the top of the Dashboard, per
// spec — both instances read/write the same shared SettingsContext state,
// so toggling it in either place updates both immediately.
export default function PriceContextToggle() {
  const { showPriceContext, setShowPriceContext, loaded } = useSettings();

  return (
    <View style={styles.row}>
      <Text style={styles.label}>Show price context</Text>
      {/* The stock Switch renders a near-white track on both platforms,
          which is the brightest thing on a dark screen and pulls the eye
          away from the price data. */}
      <Switch
        value={showPriceContext}
        onValueChange={setShowPriceContext}
        disabled={!loaded}
        trackColor={{ false: colors.surfaceRaised, true: colors.primary }}
        thumbColor={colors.text}
        ios_backgroundColor={colors.surfaceRaised}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    ...card,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  label: { ...type.bodyStrong, color: colors.text },
});

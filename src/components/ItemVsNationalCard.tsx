import { StyleSheet, Text, View } from 'react-native';
import { getUnit, priceForAmount } from '../constants/units';
import { colors, radius, spacing } from '../constants/theme';
import type { NationalReference } from '../services/blsService';
import type { PriceEntry } from '../types';

interface ItemVsNationalCardProps {
  entry: PriceEntry;
  national: NationalReference | undefined;
}

// "You paid $5.49 for that 28 oz jar; nationally that amount averages
// $4.20." Scaling the official per-pound figure back up to the exact
// package the user bought is what makes the comparison land — a bare
// "$2.40 per lb" doesn't tell you whether you overpaid at the register.
export default function ItemVsNationalCard({ entry, national }: ItemVsNationalCardProps) {
  const unit = getUnit(entry.unitId);
  const sizeLabel = unit ? `${entry.amount} ${unit.label}` : `${entry.amount}`;

  // Only scale a real dollar series, and only when it measures the same
  // kind of thing (weight vs volume vs count) as what was logged.
  const nationalForAmount =
    national?.kind === 'average_price' &&
    typeof national.pricePerBase === 'number' &&
    national.dimension &&
    national.dimension === entry.dimension
      ? priceForAmount(national.pricePerBase, entry.amount, entry.unitId)
      : null;

  const diffPercent =
    nationalForAmount !== null && nationalForAmount > 0
      ? ((entry.price - nationalForAmount) / nationalForAmount) * 100
      : null;

  return (
    <View style={styles.card}>
      <Text style={styles.product} numberOfLines={2}>
        {entry.productName}
      </Text>
      <Text style={styles.sub} numberOfLines={1}>
        {[entry.brand, sizeLabel].filter(Boolean).join(' · ')}
      </Text>

      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.colLabel}>You paid</Text>
          <Text style={styles.colValue}>${entry.price.toFixed(2)}</Text>
          <Text style={styles.colUnit}>for {sizeLabel}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.col}>
          <Text style={styles.colLabel}>National average</Text>
          {nationalForAmount !== null ? (
            <>
              <Text style={[styles.colValue, styles.nationalValue]}>
                ${nationalForAmount.toFixed(2)}
              </Text>
              <Text style={styles.colUnit}>for the same {sizeLabel}</Text>
            </>
          ) : (
            <Text style={styles.colUnavailable}>
              {national?.kind === 'index_trend'
                ? 'Not published as a dollar price — see the trend below'
                : 'No official figure for this item'}
            </Text>
          )}
        </View>
      </View>

      {diffPercent !== null ? (
        <Text style={[styles.verdict, { color: diffPercent > 0 ? colors.danger : colors.success }]}>
          {Math.abs(diffPercent) < 2
            ? 'About the same as the national average.'
            : diffPercent > 0
              ? `You paid about ${Math.abs(diffPercent).toFixed(0)}% more than the national average.`
              : `You paid about ${Math.abs(diffPercent).toFixed(0)}% less than the national average.`}
        </Text>
      ) : null}

      {national?.kind === 'average_price' && nationalForAmount !== null ? (
        // Named explicitly, because BLS prices a generic staple and the
        // user bought a specific brand — those aren't the same thing and
        // the difference partly reflects that.
        <Text style={styles.source}>
          Compared against BLS "{national.blsTitle}" ({national.periodLabel}), a generic equivalent
          — not this exact brand.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  product: { fontSize: 16, fontWeight: '700', color: colors.text },
  sub: { fontSize: 12, color: colors.textMuted, marginTop: 1, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  col: { flex: 1 },
  divider: { width: 1, backgroundColor: colors.border, marginHorizontal: spacing.md },
  colLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  colValue: { fontSize: 26, fontWeight: '700', color: colors.text, marginTop: 2 },
  nationalValue: { color: colors.primary },
  colUnit: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  colUnavailable: { fontSize: 12, color: colors.textMuted, marginTop: 4, lineHeight: 17 },
  verdict: { fontSize: 13, fontWeight: '600', marginTop: spacing.md },
  source: { fontSize: 11, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 15 },
});

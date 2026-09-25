import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useNationalAverages } from '../hooks/useNationalAverages';
import { baseUnitLabel, type UnitDimension } from '../constants/units';
import { colors, radius, spacing } from '../constants/theme';
import type { CategoryId } from '../constants/categories';

interface ComparisonSectionProps {
  category: CategoryId;
  // Already normalised (per lb / per gallon / per item) by useCategoryStats.
  localAverage: number | null;
  dimension: UnitDimension | null;
}

// Feature 7: side-by-side comparison of this app's local data against
// REAL national figures pulled live from the BLS Average Price Data API
// (see services/blsService.ts). No hardcoded or estimated numbers — if
// BLS doesn't publish a series for an item, this says so rather than
// showing an invented figure.
//
// Both sides are normalised to the same base unit before being drawn,
// which is what lets a 28 oz jar logged in a store sit honestly beside a
// BLS figure published per pound. The old version compared raw prices and
// could only draw a bar when the two unit STRINGS happened to match.
export default function ComparisonSection({
  category,
  localAverage,
  dimension,
}: ComparisonSectionProps) {
  const { averages, loading, stale, error } = useNationalAverages();
  const published = averages[category];
  const trend = published?.kind === 'index_trend' ? published : undefined;
  // A series whose unit doesn't convert (BLS publishes a few per "16 oz
  // package" and similar) can't be normalised, so there's nothing
  // honest to draw.
  //
  // Tested with `typeof`, not `!== null`: this data can come from a
  // cached payload written by an older build where the field didn't
  // exist at all, and `undefined !== null` would sail straight past the
  // guard and crash on `.toFixed()`.
  const national =
    published?.kind === 'average_price' &&
    typeof published.pricePerBase === 'number' &&
    published.dimension
      ? { ...published, pricePerBase: published.pricePerBase, dimension: published.dimension }
      : undefined;
  // Local data measured in a different dimension than the national series
  // — a per-pound average against a series published per gallon — isn't a
  // comparison, so it's withheld rather than drawn as two equal bars.
  const comparable =
    national !== undefined &&
    localAverage !== null &&
    dimension !== null &&
    dimension === national.dimension;
  const unitLabel = national ? baseUnitLabel(national.dimension) : '';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Local vs. National</Text>
      <View style={styles.card}>
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : error ? (
          <Text style={styles.noDataText}>{error}</Text>
        ) : trend ? (
          // No dollar figure exists for this item nationally, so this
          // shows the official price TREND instead. Deliberately not
          // drawn as a bar next to the local average — a percentage and
          // a price are different things and shouldn't look comparable.
          <>
            <Text style={styles.trendLabel}>National price trend</Text>
            <Text
              style={[
                styles.trendValue,
                { color: trend.yearOverYearPercent >= 0 ? colors.danger : colors.success },
              ]}
            >
              {trend.yearOverYearPercent >= 0 ? '▲' : '▼'}{' '}
              {Math.abs(trend.yearOverYearPercent).toFixed(1)}%
            </Text>
            <Text style={styles.trendCaption}>
              over the 12 months to {trend.periodLabel}
              {trend.broad
                ? ` — measured across "${trend.blsTitle}", a broader group than this item`
                : ''}
              .
            </Text>
            <Text style={styles.noDataText}>
              BLS doesn't publish a national dollar price for this item, so there's no average to
              compare your local price against — only how fast prices are moving.
            </Text>
          </>
        ) : !national ? (
          <Text style={styles.noDataText}>
            BLS doesn't publish a national average price for this item, so there's nothing official
            to compare against.
          </Text>
        ) : !comparable ? (
          <>
            <BarRow
              label={`BLS national average (${national.periodLabel})`}
              value={national.pricePerBase}
              maxValue={national.pricePerBase}
              unitLabel={unitLabel}
              color={colors.textMuted}
            />
            <Text style={styles.noDataText}>
              No verified local reports yet to compare against this.
            </Text>
          </>
        ) : (
          <>
            <BarRow
              label="Price Watch local data"
              value={localAverage}
              maxValue={Math.max(localAverage, national.pricePerBase, 0.01)}
              unitLabel={unitLabel}
              color={colors.primary}
            />
            <BarRow
              label={`BLS national average (${national.periodLabel})`}
              value={national.pricePerBase}
              maxValue={Math.max(localAverage, national.pricePerBase, 0.01)}
              unitLabel={unitLabel}
              color={colors.textMuted}
            />
            <Text style={styles.comparison}>
              {describeDifference(localAverage, national.pricePerBase)}
            </Text>
          </>
        )}

        {national ? (
          <Text style={styles.source}>
            Source: U.S. Bureau of Labor Statistics — {national.blsTitle}, {national.blsUnit}{' '}
            (series {national.seriesId}), converted to a {unitLabel} basis.
            {stale ? ' Showing a saved copy — could not refresh just now.' : ''}
          </Text>
        ) : trend ? (
          <Text style={styles.source}>
            Source: U.S. Bureau of Labor Statistics Consumer Price Index — {trend.blsTitle} (series{' '}
            {trend.seriesId}).
            {stale ? ' Showing a saved copy — could not refresh just now.' : ''}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function describeDifference(local: number, national: number): string {
  const diff = local - national;
  const pct = Math.abs(diff / national) * 100;
  if (pct < 1) return 'Local prices are right about at the national average.';
  return diff > 0
    ? `Local prices run about ${pct.toFixed(0)}% higher than the national average.`
    : `Local prices run about ${pct.toFixed(0)}% lower than the national average.`;
}

function BarRow({
  label,
  value,
  maxValue,
  unitLabel,
  color,
}: {
  label: string;
  value: number;
  maxValue: number;
  unitLabel: string;
  color: string;
}) {
  const widthPercent = Math.max(4, (value / maxValue) * 100);
  return (
    <View style={styles.barRow}>
      <View style={styles.barRowHeader}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={styles.barValue}>
          ${value.toFixed(2)} <Text style={styles.barUnit}>{unitLabel}</Text>
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${widthPercent}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: spacing.lg },
  title: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  noDataText: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  trendLabel: { fontSize: 13, fontWeight: '600', color: colors.text },
  trendValue: { fontSize: 30, fontWeight: '700', marginTop: 2 },
  trendCaption: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 19,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  barRow: { marginBottom: spacing.md },
  barRowHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  barLabel: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
    flexShrink: 1,
    marginRight: spacing.sm,
  },
  barValue: { fontSize: 13, color: colors.text, fontWeight: '700' },
  barUnit: { fontSize: 11, color: colors.textMuted, fontWeight: '400' },
  barTrack: {
    height: 10,
    borderRadius: radius.full,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: radius.full },
  comparison: { fontSize: 13, color: colors.text, fontWeight: '600', marginBottom: spacing.sm },
  source: { fontSize: 11, color: colors.textMuted, lineHeight: 15 },
});

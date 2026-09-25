import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';

interface StatCardProps {
  label: string;
  value: number | null;
  unit: string;
  emptyText: string;
  // Number of reports behind this average, shown so a thin dataset reads
  // as "only 1 report so far" rather than looking like a broken number.
  reportCount?: number;
}

export default function StatCard({ label, value, unit, emptyText, reportCount }: StatCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      {value !== null ? (
        <>
          <Text style={styles.value}>${value.toFixed(2)}</Text>
          <Text style={styles.unit}>{unit}</Text>
          {reportCount !== undefined ? (
            <Text style={styles.reportCount}>
              from {reportCount} {reportCount === 1 ? 'report' : 'reports'}
            </Text>
          ) : null}
        </>
      ) : (
        <Text style={styles.empty}>{emptyText}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  label: { fontSize: 12, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  value: { fontSize: 24, fontWeight: '700', color: colors.text, marginTop: spacing.xs },
  unit: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  reportCount: { fontSize: 11, color: colors.textMuted, marginTop: 4, fontStyle: 'italic' },
  empty: { fontSize: 13, color: colors.textMuted, marginTop: spacing.sm },
});

import { StyleSheet, Text, View } from 'react-native';
import { card, colors, radius, spacing, type } from '../constants/theme';

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
  const thin = reportCount !== undefined && reportCount < 3;

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      {value !== null ? (
        <>
          <Text style={styles.value}>${value.toFixed(2)}</Text>
          <Text style={styles.unit}>{unit}</Text>
          {reportCount !== undefined ? (
            // A one-report "average" is really just one person's receipt.
            // Flagging that in amber is more honest than a grey footnote
            // that reads the same as a well-supported number.
            <View style={[styles.countPill, thin && styles.countPillThin]}>
              <Text style={[styles.countText, thin && styles.countTextThin]}>
                {reportCount} {reportCount === 1 ? 'report' : 'reports'}
              </Text>
            </View>
          ) : null}
        </>
      ) : (
        <Text style={styles.empty}>{emptyText}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { ...card, flex: 1, padding: spacing.md },
  label: { ...type.overline, color: colors.textSubtle },
  value: { ...type.metric, color: colors.text, marginTop: spacing.sm },
  unit: { ...type.caption, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  countPill: {
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
  },
  countPillThin: { backgroundColor: colors.warningSoft },
  countText: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  countTextThin: { color: colors.warning },
  empty: { ...type.caption, color: colors.textSubtle, marginTop: spacing.sm },
});

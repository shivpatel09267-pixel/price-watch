import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getUnit } from '../constants/units';
import { colors, radius, spacing } from '../constants/theme';
import type { PriceEntry } from '../types';

interface RecentItemSwitcherProps {
  items: PriceEntry[];
  selectedId: string | null;
  onSelect: (entry: PriceEntry) => void;
}

// Horizontal strip of the things you've actually logged, most recent
// first. This replaced a 47-category picker on the dashboard: browsing
// every category the app knows about was mostly scrolling past items the
// user has no data for, whereas everything here is guaranteed to have at
// least one of their own entries behind it.
export default function RecentItemSwitcher({
  items,
  selectedId,
  onSelect,
}: RecentItemSwitcherProps) {
  if (items.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
    >
      {items.map((entry) => {
        const selected = entry.id === selectedId;
        const unit = getUnit(entry.unitId);
        return (
          <Pressable
            key={entry.id}
            onPress={() => onSelect(entry)}
            style={[styles.pill, selected && styles.pillActive]}
          >
            <Text style={[styles.name, selected && styles.nameActive]} numberOfLines={1}>
              {entry.productName}
            </Text>
            <Text style={[styles.meta, selected && styles.metaActive]} numberOfLines={1}>
              {[entry.brand, unit ? `${entry.amount} ${unit.label}` : null]
                .filter(Boolean)
                .join(' · ') || 'No brand listed'}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  strip: { gap: spacing.sm, paddingRight: spacing.lg, paddingBottom: spacing.xs },
  pill: {
    maxWidth: 190,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  name: { fontSize: 14, fontWeight: '700', color: colors.text },
  nameActive: { color: '#fff' },
  meta: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  metaActive: { color: '#DBEAFE' },
});

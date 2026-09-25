import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getCategory } from '../constants/categories';
import { baseUnitLabel, getUnit } from '../constants/units';
import { colors, radius, spacing } from '../constants/theme';
import { formatRelativeTime } from '../utils/time';
import type { PriceEntry } from '../types';

export default function RecentEntryRow({ entry }: { entry: PriceEntry }) {
  // Entries whose product had no recognisable category still have to
  // render — they just fall back to a neutral icon instead of a
  // category-coloured one.
  const category = entry.category ? getCategory(entry.category) : null;
  const icon = category?.icon ?? 'tag-outline';
  const color = category?.color ?? colors.textMuted;
  const unit = getUnit(entry.unitId);
  const size = unit ? `${entry.amount} ${unit.label}` : null;

  return (
    <View style={styles.row}>
      <View style={[styles.iconCircle, { backgroundColor: `${color}1A` }]}>
        <MaterialCommunityIcons name={icon} size={20} color={color} />
      </View>
      <View style={styles.details}>
        <Text style={styles.label} numberOfLines={1}>
          {entry.productName}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {[entry.brand, size].filter(Boolean).join(' · ')}
        </Text>
        {entry.storeName ? (
          <Text style={styles.store} numberOfLines={1}>
            {entry.storeName}
            {entry.storeBranch ? ` — ${entry.storeBranch}` : ''}
          </Text>
        ) : null}
        <Text style={styles.time}>{formatRelativeTime(entry.timestamp)}</Text>
      </View>
      <View style={styles.priceColumn}>
        <Text style={styles.price}>${entry.price.toFixed(2)}</Text>
        {/* The normalised figure is what actually makes two entries
            comparable, so it's shown next to the sticker price rather
            than hidden behind a tap. */}
        {entry.pricePerBase !== null && entry.dimension ? (
          <Text style={styles.perBase}>
            ${entry.pricePerBase.toFixed(2)} {baseUnitLabel(entry.dimension)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  details: { flex: 1 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  store: { fontSize: 12, color: colors.text, marginTop: 1 },
  time: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  priceColumn: { alignItems: 'flex-end', marginLeft: spacing.sm },
  price: { fontSize: 16, fontWeight: '700', color: colors.text },
  perBase: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
});

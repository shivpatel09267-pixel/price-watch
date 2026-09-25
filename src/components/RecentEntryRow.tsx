import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ConfirmModal from './ConfirmModal';
import { getCategory } from '../constants/categories';
import { baseUnitLabel, getUnit } from '../constants/units';
import { card, colors, radius, spacing, type } from '../constants/theme';
import { deletePriceEntry } from '../services/priceEntryService';
import { formatRelativeTime } from '../utils/time';
import * as haptics from '../utils/haptics';
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

  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete() {
    setDeleting(true);
    setError('');
    try {
      await deletePriceEntry(entry.id);
      haptics.success();
      // No local list surgery needed: useRecentEntries is an onSnapshot
      // subscription, so the row disappears when the server confirms.
      setConfirming(false);
    } catch {
      haptics.error();
      setError("Couldn't delete that entry. Check your connection and try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        <View style={[styles.iconCircle, { backgroundColor: `${color}26` }]}>
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
        <Pressable
          onPress={() => {
            haptics.tap();
            setConfirming(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${entry.productName} entry`}
          // The icon itself is small; hitSlop gives it a real 44pt target
          // without making the button look heavy next to the price.
          hitSlop={10}
          style={({ pressed }) => [styles.deleteButton, pressed && styles.deleteButtonPressed]}
        >
          <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.textSubtle} />
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <ConfirmModal
        visible={confirming}
        destructive
        title="Delete this entry?"
        message={`${entry.productName} at $${entry.price.toFixed(2)} will be removed for good. It also stops counting toward local averages.`}
        confirmLabel="Delete entry"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => {
          setConfirming(false);
          setError('');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.sm },
  row: {
    ...card,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm + 2,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm + 2,
  },
  details: { flex: 1 },
  label: { ...type.bodyStrong, fontSize: 14, color: colors.text },
  meta: { ...type.caption, fontSize: 12, color: colors.textMuted, marginTop: 1 },
  store: { ...type.caption, fontSize: 12, color: colors.textMuted, marginTop: 1 },
  time: { ...type.caption, fontSize: 12, color: colors.textSubtle, marginTop: 2 },
  priceColumn: { alignItems: 'flex-end', marginLeft: spacing.sm },
  price: { fontSize: 16, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  perBase: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  deleteButton: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
  },
  deleteButtonPressed: { backgroundColor: colors.dangerSoft },
  error: { ...type.caption, fontSize: 12, color: colors.danger, marginTop: spacing.xs },
});

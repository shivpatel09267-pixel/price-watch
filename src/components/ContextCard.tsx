import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getCategory } from '../constants/categories';
import type { ContextCardData } from '../constants/contextCards';
import { colors, radius, spacing } from '../constants/theme';

export default function ContextCard({ card }: { card: ContextCardData }) {
  const category = getCategory(card.category);

  return (
    <View style={[styles.card, { borderColor: category.color }]}>
      <View style={styles.header}>
        <MaterialCommunityIcons name={category.icon} size={20} color={category.color} />
        <Text style={styles.categoryLabel}>{category.label}</Text>
      </View>
      <Text style={styles.headline}>{card.headline}</Text>
      <Text style={styles.body}>{card.body}</Text>
      <Pressable onPress={() => Linking.openURL(card.sourceUrl)}>
        <Text style={styles.source}>Source: {card.sourceLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 260,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginRight: spacing.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  headline: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  body: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.sm },
  source: { fontSize: 12, color: colors.primary, fontWeight: '600' },
});

import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CATEGORIES, type CategoryDef, type CategoryId } from '../constants/categories';
import { getRecentCategories } from '../utils/recentCategories';
import { colors, radius, spacing } from '../constants/theme';

interface CategoryPickerProps {
  selected: CategoryId | null;
  onSelect: (id: CategoryId) => void;
}

// A fixed, curated list of items (not free text) so everyone's entries for
// "Eggs" can be compared against each other. With 45+ options that list is
// long, so two things keep it usable: a search box, and a "Recent" row of
// the items this person actually logs — which for most people is the same
// handful every time.
export default function CategoryPicker({ selected, onSelect }: CategoryPickerProps) {
  const [search, setSearch] = useState('');
  const [recent, setRecent] = useState<CategoryDef[]>([]);

  useEffect(() => {
    getRecentCategories().then((ids) => {
      // Drop any saved id that no longer exists, so a category removed
      // from the app can't leave a broken tile in the Recent row.
      const resolved = ids
        .map((id) => CATEGORIES.find((category) => category.id === id))
        .filter((category): category is CategoryDef => category !== undefined);
      setRecent(resolved);
    });
  }, []);

  const query = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!query) return CATEGORIES;
    return CATEGORIES.filter((category) => category.label.toLowerCase().includes(query));
  }, [query]);

  function renderTile(category: CategoryDef, keyPrefix = '') {
    const isSelected = selected === category.id;
    return (
      <Pressable
        key={`${keyPrefix}${category.id}`}
        onPress={() => onSelect(category.id)}
        style={[
          styles.tile,
          isSelected && {
            borderColor: category.color,
            backgroundColor: `${category.color}1A`,
          },
        ]}
      >
        <MaterialCommunityIcons
          name={category.icon}
          size={24}
          color={isSelected ? category.color : colors.textMuted}
        />
        <Text style={[styles.label, isSelected && { color: category.color }]} numberOfLines={2}>
          {category.label}
        </Text>
      </Pressable>
    );
  }

  return (
    <View>
      <View style={styles.searchRow}>
        <MaterialCommunityIcons name="magnify" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search items…"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* Recents only make sense when browsing — during a search the user
          has already told us what they're looking for. */}
      {!query && recent.length > 0 ? (
        <>
          <Text style={styles.sectionLabel}>Recent</Text>
          <View style={styles.grid}>
            {recent.map((category) => renderTile(category, 'recent-'))}
          </View>
          <Text style={styles.sectionLabel}>All items</Text>
        </>
      ) : null}

      {filtered.length === 0 ? (
        <Text style={styles.emptyText}>No items match "{search}".</Text>
      ) : (
        <View style={styles.grid}>{filtered.map((category) => renderTile(category))}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: '2%' },
  // Four per row rather than three: with 45+ items, the taller 3-column
  // grid meant a lot of scrolling to reach anything near the bottom.
  tile: {
    width: '23.5%',
    aspectRatio: 1,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: 2,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginVertical: spacing.md,
  },
});

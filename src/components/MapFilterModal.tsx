import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import PrimaryButton from './PrimaryButton';
import { CATEGORIES, type CategoryId } from '../constants/categories';
import { colors, radius, spacing } from '../constants/theme';

interface MapFilterModalProps {
  visible: boolean;
  onClose: () => void;
  selected: Set<CategoryId>;
  onChange: (selected: Set<CategoryId>) => void;
}

// Multi-select variant of the category list (CategoryPicker is
// single-select, used for logging/dashboard) — the map needs "show/hide
// pins by category", which is inherently a checklist, not a single pick.
export default function MapFilterModal({
  visible,
  onClose,
  selected,
  onChange,
}: MapFilterModalProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return CATEGORIES;
    return CATEGORIES.filter((category) => category.label.toLowerCase().includes(q));
  }, [search]);

  function toggle(id: CategoryId) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Filter by Item</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <MaterialCommunityIcons name="close" size={26} color={colors.textMuted} />
          </Pressable>
        </View>

        <View style={styles.content}>
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

          <View style={styles.quickActions}>
            <Pressable onPress={() => onChange(new Set(CATEGORIES.map((c) => c.id)))}>
              <Text style={styles.quickActionText}>Select All</Text>
            </Pressable>
            <Pressable onPress={() => onChange(new Set())}>
              <Text style={styles.quickActionText}>Clear All</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.list}>
            {filtered.map((category) => {
              const isSelected = selected.has(category.id);
              return (
                <Pressable key={category.id} style={styles.row} onPress={() => toggle(category.id)}>
                  <MaterialCommunityIcons name={category.icon} size={22} color={category.color} />
                  <Text style={styles.rowLabel}>{category.label}</Text>
                  <MaterialCommunityIcons
                    name={isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={22}
                    color={isSelected ? colors.primary : colors.textMuted}
                  />
                </Pressable>
              );
            })}
          </ScrollView>

          <PrimaryButton label="Done" onPress={onClose} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  content: { flex: 1, padding: spacing.lg },
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
  quickActions: { flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.sm },
  quickActionText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  list: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  rowLabel: { flex: 1, fontSize: 15, color: colors.text },
});

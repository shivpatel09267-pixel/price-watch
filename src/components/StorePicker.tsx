import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { findNearbyStores, type NearbyStore } from '../services/storeService';
import { colors, radius, spacing } from '../constants/theme';
import type { LatLng } from '../utils/geo';

// How close you must actually be to a store to log a price there. This is
// the app's main defence against made-up prices: you can't report what
// Publix charges from your couch, you have to be standing in it. It can't
// stop a determined faker (nothing client-side can), but it removes the
// effortless kind.
export const MAX_LOG_DISTANCE_MILES = 0.4;

interface StorePickerProps {
  origin: LatLng | null;
  selected: NearbyStore | null;
  onSelect: (store: NearbyStore) => void;
}

export default function StorePicker({ origin, selected, onSelect }: StorePickerProps) {
  const [stores, setStores] = useState<NearbyStore[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [manualName, setManualName] = useState('');
  const [addingManually, setAddingManually] = useState(false);

  useEffect(() => {
    if (!origin) return;
    let cancelled = false;
    setLoading(true);
    setError('');

    findNearbyStores(origin)
      .then((found) => {
        if (!cancelled) setStores(found);
      })
      .catch((lookupError) => {
        console.warn(`[StorePicker] store lookup failed:`, lookupError?.message ?? lookupError);
        if (!cancelled) setError("Couldn't load nearby stores. Check your connection.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [origin?.latitude, origin?.longitude]);

  // Is the user demonstrably standing at a shop the map already knows
  // about? This is what a hand-typed store name gets checked against.
  //
  // Without it, "enter it manually" is a hole straight through the
  // proximity rule: anyone could sit at home, type "Publix", and log an
  // invented price at their own coordinates. With it, a manual entry
  // still requires being at a real retail location — you're only naming
  // a shop OpenStreetMap is missing, not inventing your whereabouts.
  const atMappedStore = useMemo(
    () => stores.some((store) => store.distanceMiles <= MAX_LOG_DISTANCE_MILES),
    [stores]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return stores;
    return stores.filter(
      (store) =>
        store.name.toLowerCase().includes(query) ||
        (store.branch ?? '').toLowerCase().includes(query) ||
        (store.address ?? '').toLowerCase().includes(query)
    );
  }, [stores, search]);

  if (!origin) {
    return <Text style={styles.helper}>Getting your location…</Text>;
  }

  if (loading) {
    return <ActivityIndicator color={colors.primary} style={styles.spinner} />;
  }

  if (error) {
    return <Text style={styles.error}>{error}</Text>;
  }

  return (
    <View>
      {stores.length === 0 ? (
        <Text style={styles.helper}>
          No mapped stores found nearby. Store data comes from OpenStreetMap, which is
          community-maintained, so smaller shops are sometimes missing — you can enter yours below.
        </Text>
      ) : null}

      <View style={stores.length === 0 ? styles.hidden : styles.searchRow}>
        <MaterialCommunityIcons name="magnify" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search nearby stores…"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {filtered.slice(0, 15).map((store) => {
        const isSelected = selected?.id === store.id;
        const tooFar = store.distanceMiles > MAX_LOG_DISTANCE_MILES;
        return (
          <Pressable
            key={store.id}
            onPress={() => !tooFar && onSelect(store)}
            disabled={tooFar}
            style={[styles.row, isSelected && styles.rowSelected, tooFar && styles.rowDisabled]}
          >
            <MaterialCommunityIcons
              name={isSelected ? 'radiobox-marked' : 'radiobox-blank'}
              size={20}
              color={isSelected ? colors.primary : colors.textMuted}
            />
            <View style={styles.rowDetails}>
              <Text style={styles.rowName}>
                {store.name}
                {store.branch ? ` — ${store.branch}` : ''}
              </Text>
              {store.address ? <Text style={styles.rowAddress}>{store.address}</Text> : null}
              <Text style={tooFar ? styles.rowTooFar : styles.rowDistance}>
                {store.distanceMiles < 0.1
                  ? 'You are here'
                  : `${store.distanceMiles.toFixed(1)} mi away`}
                {tooFar ? ' · too far to log' : ''}
              </Text>
            </View>
          </Pressable>
        );
      })}

      {addingManually ? (
        <View style={styles.manualBox}>
          <Text style={styles.manualLabel}>Store name</Text>
          <TextInput
            style={styles.manualInput}
            value={manualName}
            onChangeText={setManualName}
            placeholder="e.g. Publix on Gunn Hwy"
            placeholderTextColor={colors.textMuted}
            autoFocus
          />
          {/* Said up front, not after the fact, so nobody is surprised
              that their entry didn't count. */}
          {!atMappedStore ? (
            <Text style={styles.manualWarning}>
              There's no shop mapped where you are, so this price will be saved but marked
              unverified — it won't count toward local averages until someone at a mapped store
              reports something similar.
            </Text>
          ) : null}
          <Pressable
            disabled={manualName.trim().length < 2}
            onPress={() => {
              if (!origin || manualName.trim().length < 2) return;
              // Pinned to the user's current coordinates.
              onSelect({
                id: `manual/${Date.now()}`,
                name: manualName.trim(),
                branch: null,
                address: null,
                latitude: origin.latitude,
                longitude: origin.longitude,
                distanceMiles: 0,
                locationCorroborated: atMappedStore,
              });
              setAddingManually(false);
            }}
            style={[
              styles.manualButton,
              manualName.trim().length < 2 && styles.manualButtonDisabled,
            ]}
          >
            <Text style={styles.manualButtonText}>Use this store</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={() => setAddingManually(true)}>
          <Text style={styles.manualLink}>My store isn't listed — enter it manually</Text>
        </Pressable>
      )}

      <Text style={styles.helper}>
        You can only log a price at a store you're currently at — that's what keeps reported prices
        trustworthy.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  spinner: { marginVertical: spacing.md },
  hidden: { display: 'none' },
  helper: { fontSize: 12, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 17 },
  error: { fontSize: 13, color: colors.danger, marginVertical: spacing.sm },
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  rowSelected: { borderColor: colors.primary, backgroundColor: '#EFF6FF' },
  rowDisabled: { opacity: 0.45 },
  rowDetails: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: '600', color: colors.text },
  rowAddress: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  rowDistance: { fontSize: 12, color: colors.success, marginTop: 1, fontWeight: '600' },
  rowTooFar: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  manualLink: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  manualBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  manualLabel: { fontSize: 12, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  manualWarning: { fontSize: 12, color: colors.danger, lineHeight: 17, marginBottom: spacing.sm },
  manualInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  manualButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  manualButtonDisabled: { opacity: 0.5 },
  manualButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

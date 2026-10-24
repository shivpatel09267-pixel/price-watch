import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { findNearbyStores, searchStores, type NearbyStore } from '../services/storeService';
import { radius, spacing } from '../constants/theme';
import { makeStyles, useTheme } from '../context/ThemeContext';
import * as haptics from '../utils/haptics';
import type { LatLng } from '../utils/geo';

// Any listed store can be picked, however far away it is — there's no
// "you must be standing in it" rule. Made-up prices are caught on the price
// itself instead: the national-average bounds in utils/priceSanity.ts and
// the outlier/corroboration check in services/dataQualityService.ts.

// Typing searches stores by name anywhere, not just nearby; this waits for
// a pause so the free search service isn't hit on every keystroke.
const SEARCH_DEBOUNCE_MS = 400;
const MAX_SHOWN = 15;

interface StorePickerProps {
  origin: LatLng | null;
  selected: NearbyStore | null;
  onSelect: (store: NearbyStore) => void;
}

export default function StorePicker({ origin, selected, onSelect }: StorePickerProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [stores, setStores] = useState<NearbyStore[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [manualName, setManualName] = useState('');
  const [addingManually, setAddingManually] = useState(false);
  // Bumped by "Try again" to re-run the lookup for the same location.
  const [attempt, setAttempt] = useState(0);
  // Stores found by name anywhere, and the query they answer.
  const [searchResults, setSearchResults] = useState<NearbyStore[]>([]);
  const [searchedFor, setSearchedFor] = useState('');
  const [searching, setSearching] = useState(false);
  const searchIdRef = useRef(0);
  const query = search.trim();

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
        if (!cancelled) {
          setError(
            "Couldn't load nearby stores — the store map service is busy. Try again, or enter your store below."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [origin?.latitude, origin?.longitude, attempt]);

  useEffect(() => {
    if (!origin || query.length < 2) {
      setSearchResults([]);
      setSearchedFor('');
      setSearching(false);
      return;
    }
    // Each search gets an id; slower earlier responses are discarded so
    // results can't arrive out of order and overwrite newer ones.
    const searchId = ++searchIdRef.current;
    setSearching(true);
    const timer = setTimeout(() => {
      searchStores(query, origin)
        .then((found) => {
          if (searchIdRef.current !== searchId) return;
          setSearchResults(found);
          setSearchedFor(query);
        })
        .catch((searchError) => {
          // Nearby matches still show, so a failed search isn't fatal.
          console.warn(`[StorePicker] store search failed:`, searchError?.message ?? searchError);
          if (searchIdRef.current === searchId) setSearchResults([]);
        })
        .finally(() => {
          if (searchIdRef.current === searchId) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, origin?.latitude, origin?.longitude]);

  // With a query: nearby stores that match it (shown instantly) merged
  // with stores found by name anywhere, nearest first.
  const filtered = useMemo(() => {
    if (!query) return stores;
    const lower = query.toLowerCase();
    const nearbyMatches = stores.filter(
      (store) =>
        store.name.toLowerCase().includes(lower) ||
        (store.branch ?? '').toLowerCase().includes(lower) ||
        (store.address ?? '').toLowerCase().includes(lower)
    );
    const seen = new Set(nearbyMatches.map((store) => store.id));
    return [...nearbyMatches, ...searchResults.filter((store) => !seen.has(store.id))].sort(
      (a, b) => a.distanceMiles - b.distanceMiles
    );
  }, [stores, query, searchResults]);

  if (!origin) {
    return <Text style={styles.helper}>Getting your location…</Text>;
  }

  return (
    <View>
      {/* A slow or failed lookup must never block logging: the spinner and
          the error sit above the manual-entry option instead of replacing
          the whole step. */}
      {loading ? (
        <View>
          <ActivityIndicator color={colors.primary} style={styles.spinner} />
          <Text style={[styles.helper, styles.centered]}>Finding nearby stores…</Text>
        </View>
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.error}>{error}</Text>
          <Pressable
            onPress={() => {
              haptics.tap();
              setAttempt((n) => n + 1);
            }}
            hitSlop={8}
          >
            <Text style={styles.retryLink}>Try again</Text>
          </Pressable>
        </View>
      ) : stores.length === 0 && !query ? (
        <Text style={styles.helper}>
          No mapped stores found nearby. Store data comes from OpenStreetMap, which is
          community-maintained, so smaller shops are sometimes missing — search for yours by name,
          or enter it below.
        </Text>
      ) : null}

      <View style={styles.searchRow}>
        <MaterialCommunityIcons name="magnify" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search any store…"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searching ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      </View>

      {query && !searching && searchedFor === query && filtered.length === 0 ? (
        <Text style={styles.helper}>
          No stores named “{query}” found. Try another spelling, or enter it manually below.
        </Text>
      ) : null}

      {(loading && !query ? [] : filtered.slice(0, MAX_SHOWN)).map((store) => {
        const isSelected = selected?.id === store.id;
        return (
          <Pressable
            key={store.id}
            onPress={() => {
              haptics.selection();
              onSelect(store);
            }}
            style={[styles.row, isSelected && styles.rowSelected]}
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
              <Text style={styles.rowDistance}>
                {store.distanceMiles < 0.1
                  ? 'You are here'
                  : `${store.distanceMiles.toFixed(store.distanceMiles < 10 ? 1 : 0)} mi away`}
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
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  spinner: { marginVertical: spacing.md },
  centered: { textAlign: 'center', marginTop: 0 },
  helper: { fontSize: 12, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 17 },
  error: { fontSize: 13, color: colors.danger, lineHeight: 18 },
  errorBox: { marginVertical: spacing.sm, gap: spacing.xs },
  retryLink: { fontSize: 13, color: colors.primary, fontWeight: '700' },
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
  rowSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  rowDetails: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: '600', color: colors.text },
  rowAddress: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  rowDistance: { fontSize: 12, color: colors.success, marginTop: 1, fontWeight: '600' },
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
  manualButtonText: { color: colors.onPrimary, fontWeight: '700', fontSize: 14 },
}));

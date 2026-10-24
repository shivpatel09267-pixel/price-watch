import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  fetchRecentNearbyReports,
  searchReports,
  type CheapestNearby,
} from '../services/priceEntryService';
import { getDeviceCoordinates } from '../services/locationService';
import { LOCAL_RADIUS_MILES, type LatLng } from '../utils/geo';
import { baseUnitLabel, getUnit } from '../constants/units';
import { radius, spacing } from '../constants/theme';
import { makeStyles, useTheme } from '../context/ThemeContext';
import { formatRelativeTime } from '../utils/time';

interface FindCheapestModalProps {
  visible: boolean;
  onClose: () => void;
}

function openInMaps(latitude: number, longitude: number, label?: string | null) {
  const query = label ? encodeURIComponent(label) : `${latitude},${longitude}`;
  const url =
    Platform.OS === 'ios'
      ? `maps:0,0?q=${query}&ll=${latitude},${longitude}`
      : Platform.OS === 'android'
        ? `geo:${latitude},${longitude}?q=${query}`
        : `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  Linking.openURL(url).catch(() => {
    // No maps app registered for the scheme — do nothing rather than
    // crash or show a confusing error.
  });
}

// Results never list more than this; the cheapest are what matter.
const MAX_SHOWN = 30;

// "Find cheapest near me": type what you're looking for and see every
// recent verified report in your area that matches those words, cheapest
// first, tappable through to Maps. No exact product has to be picked —
// "milk" finds every milk anyone nearby has logged.
export default function FindCheapestModal({ visible, onClose }: FindCheapestModalProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [search, setSearch] = useState('');
  const [reports, setReports] = useState<CheapestNearby[] | null>(null);
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [error, setError] = useState('');
  // Bumped by "Try again" to reload the reports.
  const [attempt, setAttempt] = useState(0);

  // Results are a 20-mile radius around where you actually are, so this
  // needs coordinates rather than the profile zip code.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    getDeviceCoordinates().then((coords) => {
      if (cancelled) return;
      if (coords) {
        setOrigin({ latitude: coords.latitude, longitude: coords.longitude });
      } else {
        setError("Couldn't get your location. Allow location access to find prices near you.");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [visible, attempt]);

  // Reset each time it opens so it never shows the previous search, and
  // reloads the reports so they're never stale.
  useEffect(() => {
    if (visible) {
      setSearch('');
      setReports(null);
      setError('');
    }
  }, [visible]);

  // Recent nearby reports are loaded once per open; typing then filters
  // them on the device, so results update instantly with each keystroke.
  useEffect(() => {
    if (!visible || !origin) return;
    let cancelled = false;

    fetchRecentNearbyReports(origin)
      .then((found) => {
        if (!cancelled) setReports(found);
      })
      .catch((lookupError) => {
        console.warn(`[FindCheapestModal] lookup failed:`, lookupError?.message ?? lookupError);
        if (!cancelled)
          setError("Couldn't load nearby prices. Check your connection and try again.");
      });

    return () => {
      cancelled = true;
    };
  }, [visible, origin?.latitude, origin?.longitude, attempt]);

  const query = search.trim();
  const results = useMemo(() => searchReports(reports ?? [], query), [reports, query]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.flex}>
        <View style={styles.header}>
          <Text style={styles.title}>Find Cheapest Near Me</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <MaterialCommunityIcons name="close" size={26} color={colors.textMuted} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.stepLabel}>Which item are you looking for?</Text>
          <View style={styles.searchRow}>
            <MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="e.g. milk, eggs, Publix bread"
              placeholderTextColor={colors.textMuted}
              autoCorrect={false}
              returnKeyType="search"
            />
            {search ? (
              <Pressable onPress={() => setSearch('')} hitSlop={10}>
                <MaterialCommunityIcons name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>

          {query ? (
            <View style={styles.results}>
              <Text style={styles.stepLabel}>Cheapest within {LOCAL_RADIUS_MILES} miles</Text>

              {error ? (
                <View>
                  <Text style={styles.error}>{error}</Text>
                  <Pressable
                    onPress={() => {
                      setError('');
                      setAttempt((n) => n + 1);
                    }}
                    hitSlop={8}
                  >
                    <Text style={styles.retryLink}>Try again</Text>
                  </Pressable>
                </View>
              ) : reports === null ? (
                <ActivityIndicator color={colors.primary} style={styles.spinner} />
              ) : results.length === 0 ? (
                <Text style={styles.empty}>
                  No verified reports matching “{query}” within {LOCAL_RADIUS_MILES} miles in the
                  last 7 days. Try fewer or different words, or log one and it&apos;ll show up here.
                </Text>
              ) : (
                results.slice(0, MAX_SHOWN).map((result, index) => (
                  <Pressable
                    key={result.id}
                    style={styles.row}
                    onPress={() =>
                      openInMaps(
                        result.latitude,
                        result.longitude,
                        result.storeName ?? result.address
                      )
                    }
                  >
                    <View style={[styles.rank, index === 0 && styles.rankBest]}>
                      <Text style={[styles.rankText, index === 0 && styles.rankTextBest]}>
                        {index + 1}
                      </Text>
                    </View>
                    <View style={styles.rowDetails}>
                      <Text style={styles.rowPrice}>
                        ${result.price.toFixed(2)}{' '}
                        <Text style={styles.rowUnit}>
                          for {result.amount} {getUnit(result.unitId)?.label ?? result.unitId}
                        </Text>
                      </Text>
                      <Text style={styles.rowProduct} numberOfLines={1}>
                        {result.productName}
                        {result.brand ? ` · ${result.brand}` : ''}
                      </Text>
                      {result.pricePerBase !== null && result.dimension ? (
                        <Text style={styles.rowPerBase}>
                          ${result.pricePerBase.toFixed(2)} {baseUnitLabel(result.dimension)}
                        </Text>
                      ) : null}
                      <Text style={styles.rowStore} numberOfLines={1}>
                        {result.storeName
                          ? `${result.storeName}${result.storeBranch ? ` — ${result.storeBranch}` : ''}`
                          : 'Store not recorded'}
                      </Text>
                      {result.address ? (
                        <Text style={styles.rowAddress} numberOfLines={2}>
                          {result.address}
                        </Text>
                      ) : null}
                      <Text style={styles.rowTime}>
                        {result.distanceMiles.toFixed(1)} mi away · reported{' '}
                        {formatRelativeTime(result.timestamp)}
                      </Text>
                    </View>
                    <MaterialCommunityIcons name="map-marker" size={20} color={colors.primary} />
                  </Pressable>
                ))
              )}
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  flex: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  content: { padding: spacing.lg },
  stepLabel: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: spacing.sm },
  results: { marginTop: spacing.lg },
  spinner: { marginTop: spacing.md },
  error: { color: colors.danger, fontSize: 13 },
  retryLink: { fontSize: 13, color: colors.primary, fontWeight: '700', marginTop: spacing.xs },
  empty: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  rank: {
    width: 26,
    height: 26,
    borderRadius: radius.full,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBest: { backgroundColor: colors.success },
  rankText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  rankTextBest: { color: colors.onPrimary },
  rowDetails: { flex: 1 },
  rowPrice: { fontSize: 16, fontWeight: '700', color: colors.text },
  rowUnit: { fontSize: 12, fontWeight: '400', color: colors.textMuted },
  rowProduct: { fontSize: 13, color: colors.text, marginTop: 1 },
  rowPerBase: { fontSize: 12, fontWeight: '600', color: colors.primary, marginTop: 1 },
  rowStore: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 2 },
  rowAddress: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  rowTime: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
}));

import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Callout, Marker, type Region } from 'react-native-maps';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import MapFilterModal from '../components/MapFilterModal';
import { useAuth } from '../context/AuthContext';
import { useMapEntries } from '../hooks/useMapEntries';
import { getDeviceCoordinates } from '../services/locationService';
import * as Location from 'expo-location';
import { CATEGORIES, getCategory, type CategoryId } from '../constants/categories';
import { baseUnitLabel, getUnit } from '../constants/units';
import { colors, radius, spacing } from '../constants/theme';
import { formatRelativeTime } from '../utils/time';

// Ultimate fallback if we can't get device location OR geocode the
// user's profile zip (e.g. fully offline on first launch) — centers on
// the Tampa Bay area, the heart of FL-15, fitting for this app's origin
// even though the app itself isn't restricted to Florida.
const FALLBACK_REGION: Region = {
  latitude: 27.9506,
  longitude: -82.4572,
  latitudeDelta: 0.5,
  longitudeDelta: 0.5,
};

export default function MapScreen() {
  const { userProfile } = useAuth();
  const { entries, loading: entriesLoading } = useMapEntries();
  // The map itself stays edge-to-edge (no header, no SafeAreaView) since
  // maps commonly render under the status bar — but the floating filter
  // pill is a real interactive control, so it still needs to clear the
  // notch/status bar rather than sit right under it.
  const insets = useSafeAreaInsets();
  const [region, setRegion] = useState<Region | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<Set<CategoryId>>(
    () => new Set(CATEGORIES.map((c) => c.id))
  );
  const [filterVisible, setFilterVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function resolveInitialRegion() {
      const coords = await getDeviceCoordinates();
      if (coords) {
        if (!cancelled) setRegion({ ...coords, latitudeDelta: 0.1, longitudeDelta: 0.1 });
        return;
      }

      if (userProfile?.zipCode) {
        try {
          const results = await Location.geocodeAsync(userProfile.zipCode);
          if (results[0] && !cancelled) {
            setRegion({ ...results[0], latitudeDelta: 0.1, longitudeDelta: 0.1 });
            return;
          }
        } catch {
          // Fall through to the fixed fallback below.
        }
      }

      if (!cancelled) setRegion(FALLBACK_REGION);
    }

    resolveInitialRegion();
    return () => {
      cancelled = true;
    };
  }, [userProfile?.zipCode]);

  // Entries with no category (manually-typed items like gas or paper
  // towels) have no filter chip to be excluded by, so they stay visible
  // rather than silently disappearing from the map.
  const visibleEntries = entries.filter(
    (entry) => entry.category === null || selectedCategories.has(entry.category)
  );

  // The single cheapest VERIFIED pin for each item currently shown. Only
  // verified entries qualify — highlighting an unvetted price as "the
  // cheapest place to go" is exactly the kind of bad data Feature 5 exists
  // to keep out of the numbers people act on.
  //
  // Grouped by exact product where there is one, falling back to the
  // category, and compared on the normalised price so a bigger package
  // isn't penalised for costing more in total.
  const cheapestEntryIds = useMemo(() => {
    const cheapestByItem = new Map<string, { id: string; price: number }>();
    for (const entry of visibleEntries) {
      if (!entry.verified) continue;
      const key = entry.barcode ?? entry.category;
      if (!key) continue;
      const price = entry.pricePerBase ?? entry.price;
      const current = cheapestByItem.get(key);
      if (!current || price < current.price) {
        cheapestByItem.set(key, { id: entry.id, price });
      }
    }
    return new Set([...cheapestByItem.values()].map((e) => e.id));
  }, [visibleEntries]);

  if (!region) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView style={styles.map} initialRegion={region} showsUserLocation showsMyLocationButton>
        {visibleEntries.map((entry) => {
          const category = entry.category ? getCategory(entry.category) : null;
          const icon = category?.icon ?? 'tag-outline';
          const color = category?.color ?? colors.textMuted;
          // Cheapest-per-item pins get a price label right on the map and
          // a green pin, so "where's it cheapest" is answerable at a glance
          // without tapping every marker.
          const isCheapest = cheapestEntryIds.has(entry.id);
          return (
            <Marker
              key={entry.id}
              coordinate={{ latitude: entry.latitude, longitude: entry.longitude }}
              pinColor={!entry.verified ? colors.textMuted : isCheapest ? colors.success : color}
              title={
                isCheapest
                  ? `$${entry.price.toFixed(2)} — cheapest ${entry.productName}`
                  : undefined
              }
            >
              <Callout>
                <View style={styles.callout}>
                  <View style={styles.calloutHeader}>
                    <MaterialCommunityIcons name={icon} size={18} color={color} />
                    <Text style={styles.calloutLabel} numberOfLines={1}>
                      {entry.productName}
                    </Text>
                    {isCheapest ? <Text style={styles.calloutBadge}>CHEAPEST</Text> : null}
                  </View>
                  <Text style={styles.calloutPrice}>
                    ${entry.price.toFixed(2)}{' '}
                    <Text style={styles.calloutUnit}>
                      for {entry.amount} {getUnit(entry.unitId)?.label ?? entry.unitId}
                    </Text>
                  </Text>
                  {entry.pricePerBase !== null && entry.dimension ? (
                    <Text style={styles.calloutPerBase}>
                      ${entry.pricePerBase.toFixed(2)} {baseUnitLabel(entry.dimension)}
                    </Text>
                  ) : null}
                  {entry.storeName ? (
                    <Text style={styles.calloutStore}>
                      {entry.storeName}
                      {entry.storeBranch ? ` — ${entry.storeBranch}` : ''}
                    </Text>
                  ) : null}
                  {entry.address ? (
                    <Text style={styles.calloutAddress}>{entry.address}</Text>
                  ) : null}
                  <Text style={styles.calloutTime}>
                    Reported {formatRelativeTime(entry.timestamp)}
                  </Text>
                  {!entry.verified ? (
                    <Text style={styles.calloutUnverified}>Not yet verified</Text>
                  ) : null}
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>

      <View style={[styles.filterBar, { top: insets.top + spacing.md }]}>
        <Pressable style={styles.filterPill} onPress={() => setFilterVisible(true)}>
          <MaterialCommunityIcons name="filter-variant" size={18} color={colors.text} />
          <Text style={styles.filterText}>
            {selectedCategories.size === CATEGORIES.length
              ? 'All Items'
              : `${selectedCategories.size} of ${CATEGORIES.length} selected`}
          </Text>
        </Pressable>
      </View>

      {entriesLoading ? (
        <View style={[styles.loadingBadge, { top: insets.top + spacing.md }]}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : null}

      <MapFilterModal
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        selected={selectedCategories}
        onChange={setSelectedCategories}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  filterBar: { position: 'absolute', left: spacing.md },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  filterText: { fontSize: 13, fontWeight: '600', color: colors.text },
  loadingBadge: { position: 'absolute', right: spacing.md },
  callout: { minWidth: 160, padding: spacing.xs },
  calloutHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 2 },
  calloutLabel: { fontWeight: '700', color: colors.text, fontSize: 14 },
  calloutPrice: { fontSize: 16, fontWeight: '700', color: colors.text },
  calloutUnit: { fontSize: 12, fontWeight: '400', color: colors.textMuted },
  calloutPerBase: { fontSize: 12, fontWeight: '600', color: colors.primary, marginTop: 1 },
  calloutStore: { fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 2 },
  calloutAddress: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  calloutBadge: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
    backgroundColor: colors.success,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    overflow: 'hidden',
  },
  calloutTime: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  calloutUnverified: { fontSize: 11, color: colors.warning, marginTop: 2, fontWeight: '600' },
});

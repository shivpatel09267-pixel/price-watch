import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ProductPicker from './ProductPicker';
import {
  findCheapestNearbyList,
  type CheapestNearby,
  type CheapestNearbyResult,
} from '../services/priceEntryService';
import { getDeviceCoordinates } from '../services/locationService';
import type { Product } from '../services/productService';
import { LOCAL_RADIUS_MILES, type LatLng } from '../utils/geo';
import { baseUnitLabel, getUnit } from '../constants/units';
import { colors, radius, spacing } from '../constants/theme';
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

// "Find cheapest near me": pick an item, see every recent verified report
// for it in your area, cheapest first, tappable through to Maps.
export default function FindCheapestModal({ visible, onClose }: FindCheapestModalProps) {
  const [product, setProduct] = useState<Product | null>(null);
  const [results, setResults] = useState<CheapestNearby[]>([]);
  const [matchedBy, setMatchedBy] = useState<CheapestNearbyResult['matchedBy']>('none');
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Results are a 20-mile radius around where you actually are, so this
  // needs coordinates rather than the profile zip code.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    getDeviceCoordinates().then((coords) => {
      if (!cancelled && coords) {
        setOrigin({ latitude: coords.latitude, longitude: coords.longitude });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  // Reset each time it opens so it never shows the previous search.
  useEffect(() => {
    if (visible) {
      setProduct(null);
      setResults([]);
      setMatchedBy('none');
      setError('');
      setLoading(false);
    }
  }, [visible]);

  const barcode = product && !product.barcode.startsWith('manual/') ? product.barcode : null;
  const category = product?.category ?? null;

  useEffect(() => {
    if (!product || !origin) return;
    // A manually-typed item with no category has nothing to match on —
    // there's no shared key linking it to anyone else's entry.
    if (!barcode && !category) {
      setResults([]);
      setMatchedBy('none');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    findCheapestNearbyList({ barcode, category, productName: product.name }, origin)
      .then((found) => {
        if (cancelled) return;
        setResults(found.results);
        setMatchedBy(found.matchedBy);
      })
      .catch((lookupError) => {
        console.warn(`[FindCheapestModal] lookup failed:`, lookupError?.message ?? lookupError);
        if (!cancelled)
          setError("Couldn't load nearby prices. Check your connection and try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [barcode, category, origin?.latitude, origin?.longitude]);

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
          <ProductPicker
            selected={product}
            onSelect={(selected) => setProduct(selected.name ? selected : null)}
          />

          {product ? (
            <View style={styles.results}>
              <Text style={styles.stepLabel}>Cheapest within {LOCAL_RADIUS_MILES} miles</Text>
              {/* Says plainly whether these are prices for the exact
                  product or for comparable items of the same kind —
                  the fallback is useful, but it isn't the same claim. */}
              {matchedBy === 'category' ? (
                <Text style={styles.matchNote}>
                  Nobody nearby has logged this exact product yet — showing comparable items
                  instead.
                </Text>
              ) : null}

              {loading ? (
                <ActivityIndicator color={colors.primary} style={styles.spinner} />
              ) : error ? (
                <Text style={styles.error}>{error}</Text>
              ) : results.length === 0 ? (
                <Text style={styles.empty}>
                  No verified reports for this item within {LOCAL_RADIUS_MILES} miles in the last 7
                  days. Log one and it'll show up here.
                </Text>
              ) : (
                results.map((result, index) => (
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

const styles = StyleSheet.create({
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
  results: { marginTop: spacing.lg },
  spinner: { marginTop: spacing.md },
  error: { color: colors.danger, fontSize: 13 },
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
  matchNote: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm, lineHeight: 17 },
  rowStore: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 2 },
  rowAddress: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  rowTime: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});

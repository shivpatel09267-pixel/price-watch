import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { lookupBarcode, searchProducts, type Product } from '../services/productService';
import { colors, radius, spacing } from '../constants/theme';

interface ProductPickerProps {
  selected: Product | null;
  onSelect: (product: Product) => void;
}

// Open Food Facts asks clients not to hammer the search endpoint, and
// searching on every keystroke would do exactly that — so queries wait
// until typing pauses.
const SEARCH_DEBOUNCE_MS = 500;

export default function ProductPicker({ selected, onSelect }: ProductPickerProps) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [manualName, setManualName] = useState('');
  const [addingManually, setAddingManually] = useState(false);
  const searchIdRef = useRef(0);

  useEffect(() => {
    const query = search.trim();
    if (query.length < 2) {
      setResults([]);
      setError('');
      return;
    }

    // Each search gets an id; slower earlier responses are discarded so
    // results can't arrive out of order and overwrite newer ones.
    const searchId = ++searchIdRef.current;
    const timer = setTimeout(() => {
      setLoading(true);
      setError('');
      searchProducts(query)
        .then((found) => {
          if (searchIdRef.current === searchId) setResults(found);
        })
        .catch((searchError) => {
          console.warn(`[ProductPicker] search failed:`, searchError?.message ?? searchError);
          if (searchIdRef.current === searchId) {
            setError(
              "Couldn't search products just now. Check your connection, or enter it manually."
            );
          }
        })
        .finally(() => {
          if (searchIdRef.current === searchId) setLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [search]);

  async function handleScanPress() {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        setError('Camera access is needed to scan a barcode. You can search by name instead.');
        return;
      }
    }
    setScanning(true);
  }

  async function handleBarcodeScanned(barcode: string) {
    setScanning(false);
    setLoading(true);
    setError('');
    try {
      const product = await lookupBarcode(barcode);
      if (product) {
        onSelect(product);
      } else {
        setError(
          `Barcode ${barcode} isn't in the product database. Search by name or enter it manually.`
        );
      }
    } catch {
      setError("Couldn't look up that barcode. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  if (scanning) {
    return (
      <View style={styles.scannerBox}>
        <CameraView
          style={styles.scanner}
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
          onBarcodeScanned={({ data }) => handleBarcodeScanned(data)}
        />
        <Pressable style={styles.scannerCancel} onPress={() => setScanning(false)}>
          <Text style={styles.scannerCancelText}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  if (selected) {
    return (
      <View style={styles.selectedBox}>
        <View style={styles.selectedDetails}>
          <Text style={styles.selectedName}>{selected.name}</Text>
          <Text style={styles.selectedMeta}>
            {[selected.brand, selected.quantity].filter(Boolean).join(' · ') || 'No brand listed'}
          </Text>
        </View>
        <Pressable
          onPress={() => {
            setSearch('');
            setResults([]);
            onSelect({ ...selected, barcode: '', name: '' });
          }}
          hitSlop={10}
        >
          <MaterialCommunityIcons name="close-circle" size={22} color={colors.textMuted} />
        </Pressable>
      </View>
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
          placeholder="Search any item or brand…"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable onPress={handleScanPress} hitSlop={8}>
          <MaterialCommunityIcons name="barcode-scan" size={22} color={colors.primary} />
        </Pressable>
      </View>

      {loading ? <ActivityIndicator color={colors.primary} style={styles.spinner} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {results.map((product) => (
        <Pressable key={product.barcode} style={styles.row} onPress={() => onSelect(product)}>
          <View style={styles.rowDetails}>
            <Text style={styles.rowName} numberOfLines={2}>
              {product.name}
            </Text>
            <Text style={styles.rowMeta} numberOfLines={1}>
              {[product.brand, product.quantity].filter(Boolean).join(' · ') || 'No brand listed'}
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
        </Pressable>
      ))}

      {addingManually ? (
        <View style={styles.manualBox}>
          <Text style={styles.manualLabel}>Item name</Text>
          <TextInput
            style={styles.manualInput}
            value={manualName}
            onChangeText={setManualName}
            placeholder="e.g. Regular unleaded gas, Bounty paper towels"
            placeholderTextColor={colors.textMuted}
            autoFocus
          />
          <Pressable
            disabled={manualName.trim().length < 2}
            onPress={() =>
              onSelect({
                barcode: `manual/${Date.now()}`,
                name: manualName.trim(),
                brand: null,
                quantity: null,
                imageUrl: null,
                // Nothing to derive a category from — the log flow asks
                // for one so the entry can still be compared nationally.
                category: null,
              })
            }
            style={[styles.manualButton, manualName.trim().length < 2 && styles.manualDisabled]}
          >
            <Text style={styles.manualButtonText}>Use this item</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={() => setAddingManually(true)}>
          <Text style={styles.manualLink}>
            Can't find it? Enter it manually — needed for gas and household items, which aren't in
            the product database.
          </Text>
        </Pressable>
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
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
  spinner: { marginVertical: spacing.sm },
  error: { fontSize: 13, color: colors.danger, marginBottom: spacing.sm, lineHeight: 18 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  rowDetails: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: '600', color: colors.text },
  rowMeta: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  selectedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  selectedDetails: { flex: 1 },
  selectedName: { fontSize: 15, fontWeight: '700', color: colors.text },
  selectedMeta: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  scannerBox: { height: 280, borderRadius: radius.md, overflow: 'hidden' },
  scanner: { flex: 1 },
  scannerCancel: {
    position: 'absolute',
    bottom: spacing.md,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  scannerCancelText: { fontWeight: '700', color: colors.text },
  manualLink: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
    marginTop: spacing.xs,
    lineHeight: 17,
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
  manualDisabled: { opacity: 0.5 },
  manualButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

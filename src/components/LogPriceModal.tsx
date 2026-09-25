import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import CategoryPicker from './CategoryPicker';
import ProductPicker from './ProductPicker';
import StorePicker from './StorePicker';
import PrimaryButton from './PrimaryButton';
import { getDeviceCoordinates } from '../services/locationService';
import type { NearbyStore } from '../services/storeService';
import type { LatLng } from '../utils/geo';
import { useAuth } from '../context/AuthContext';
import {
  findCheapestNearby,
  logPriceEntry,
  type CheapestNearbyResult,
  type CheapestTarget,
} from '../services/priceEntryService';
import {
  LocationPermissionDeniedError,
  LocationUnavailableError,
} from '../services/locationService';
import type { Product } from '../services/productService';
import { getCategory, type CategoryId } from '../constants/categories';
import { baseUnitLabel, parseQuantity, pricePerBaseUnit, UNITS } from '../constants/units';
import { useNationalAverages } from '../hooks/useNationalAverages';
import { checkPriceAgainstNational } from '../utils/priceSanity';
import { rememberCategory } from '../utils/recentCategories';
import { colors, radius, spacing } from '../constants/theme';
import * as haptics from '../utils/haptics';

export interface LogPriceResult {
  productName: string;
  target: CheapestTarget;
  cheapest: CheapestNearbyResult;
}

interface LogPriceModalProps {
  visible: boolean;
  onClose: () => void;
  // Called right before onClose, once the Firestore write succeeds — the
  // Home screen uses this to trigger its own success banner, which also
  // shows the cheapest nearby verified price for the same item.
  onSubmitted: (result: LogPriceResult) => void;
}

function getSubmitErrorMessage(error: unknown): string {
  if (error instanceof LocationPermissionDeniedError) {
    return error.canAskAgain
      ? 'Price Watch needs location access to log a price. Tap Submit again to allow it.'
      : 'Location access is turned off for Price Watch. Open your phone Settings > Price Watch > Location and allow it, then try again.';
  }
  if (error instanceof LocationUnavailableError) {
    return "Couldn't determine your location. Check that GPS/location services are turned on for your phone and that you have a network connection, then try again.";
  }
  // Deliberately hedged: on a slow connection, the write can still land a
  // few seconds after we gave up waiting for it (we can't cancel it), so
  // this isn't always a true failure — check Recent Entries before
  // assuming it needs to be re-submitted.
  return "This is taking longer than expected. Check Home > Recent Entries in a moment — it may have gone through anyway. If it's not there, try again.";
}

// The whole entry flow in one sheet: find the item, confirm the store,
// enter what you paid and for how much. Each step collapses to a single
// compact row once it's answered, so the form never grows into a long
// scroll no matter how many results a search returned.
export default function LogPriceModal({ visible, onClose, onSubmitted }: LogPriceModalProps) {
  const { user, userProfile } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  // Only used when the product carries no category of its own (manual
  // entries like gas or paper towels) — it's what connects the entry to a
  // national figure, so it's offered but never required.
  const [categoryOverride, setCategoryOverride] = useState<CategoryId | null>(null);
  const [pickingCategory, setPickingCategory] = useState(false);
  const [store, setStore] = useState<NearbyStore | null>(null);
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [priceText, setPriceText] = useState('');
  const [amountText, setAmountText] = useState('1');
  const [unitId, setUnitId] = useState('each');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  // Official national figures, used to reject implausible prices before
  // they ever reach the database.
  const { averages: nationalAverages } = useNationalAverages();

  const category = product?.category ?? categoryOverride;

  // Needed up front so the store list can load while the user is still
  // searching for the product.
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

  // Reset the form every time the modal opens, so a previous session's
  // product/price never lingers into the next entry.
  useEffect(() => {
    if (visible) {
      setProduct(null);
      setCategoryOverride(null);
      setPickingCategory(false);
      setStore(null);
      setPriceText('');
      setAmountText('1');
      setUnitId('each');
      setError('');
      setSubmitting(false);
    }
  }, [visible]);

  // The package size the product database already knows about is a good
  // starting guess, so most people only have to type the price. It stays
  // fully editable — the database's quantity strings are inconsistent,
  // and the shelf is the source of truth, not the database.
  function handleSelectProduct(selected: Product) {
    // ProductPicker signals "clear this" by blanking the name.
    if (!selected.name) {
      setProduct(null);
      setCategoryOverride(null);
      return;
    }
    setProduct(selected);
    const parsed = parseQuantity(selected.quantity);
    if (parsed) {
      setAmountText(String(parsed.amount));
      setUnitId(parsed.unitId);
    }
  }

  const normalised = useMemo(() => {
    const price = parseFloat(priceText);
    const amount = parseFloat(amountText);
    return pricePerBaseUnit(price, amount, unitId);
  }, [priceText, amountText, unitId]);

  // Every rejected submit buzzes the same way, so the feel of "that
  // didn't go through" is identical whichever field was wrong — and the
  // haptic can't drift out of sync with the message it belongs to.
  function reject(message: string) {
    haptics.warning();
    setError(message);
  }

  async function handleSubmit() {
    setError('');
    if (!product) {
      return reject('Find the item you bought.');
    }
    if (!store) {
      return reject("Pick the store you're at.");
    }
    const price = parseFloat(priceText);
    if (!Number.isFinite(price) || price <= 0 || price >= 1000) {
      return reject('Enter a valid price.');
    }
    const amount = parseFloat(amountText);
    if (!Number.isFinite(amount) || amount <= 0) {
      return reject('Enter how much you got for that price.');
    }

    // Refuse prices that can't plausibly be real for this item, measured
    // against the official BLS national average. Both sides are compared
    // per pound / per gallon / per item — see utils/priceSanity.ts.
    if (category) {
      const sanity = checkPriceAgainstNational(
        normalised,
        nationalAverages[category],
        getCategory(category).label.toLowerCase()
      );
      if (!sanity.ok) {
        return reject(sanity.message ?? 'That price does not look right.');
      }
    }

    if (!user) return;

    setSubmitting(true);
    try {
      const { origin: entryOrigin } = await logPriceEntry({
        userId: user.uid,
        productName: product.name,
        brand: product.brand,
        // Manual entries carry a synthetic barcode that isn't a real
        // product code, so it's not worth storing or matching on.
        barcode: product.barcode.startsWith('manual/') ? null : product.barcode,
        category,
        price,
        amount,
        unitId,
        fallbackZip: userProfile?.zipCode ?? '',
        store,
      });
      if (category) rememberCategory(category);

      const target: CheapestTarget = {
        barcode: product.barcode.startsWith('manual/') ? null : product.barcode,
        category,
        productName: product.name,
      };
      // A failure here (e.g. that one extra query needs its own index the
      // first time) shouldn't undo an already-successful submission — the
      // price is logged either way, "cheapest nearby" is just a bonus.
      const cheapest = await findCheapestNearby(target, entryOrigin).catch(
        (): CheapestNearbyResult => ({ results: [], matchedBy: 'none' })
      );
      // The one moment worth a real notification buzz: the write landed.
      haptics.success();
      onSubmitted({ productName: product.name, target, cheapest });
      onClose();
    } catch (submitError) {
      // The user only sees a hedged, friendly message (the write may
      // still land), so the real error has to go somewhere.
      console.warn('[LogPriceModal] submit failed:', submitError);
      // Distinct from reject(): this one actually failed rather than
      // being refused for something the user can retype.
      haptics.error();
      setError(getSubmitErrorMessage(submitError));
      setSubmitting(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.flex}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Log a Price</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <MaterialCommunityIcons name="close" size={26} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.stepLabel}>1. What did you buy?</Text>
            <ProductPicker selected={product} onSelect={handleSelectProduct} />

            {product ? (
              <>
                <Text style={styles.stepLabel}>2. Which store are you at?</Text>
                <StorePicker origin={origin} selected={store} onSelect={setStore} />
              </>
            ) : null}

            {product && store ? (
              <>
                <Text style={styles.stepLabel}>3. What did you pay?</Text>
                <View style={styles.priceRow}>
                  <Text style={styles.dollarSign}>$</Text>
                  <TextInput
                    style={styles.priceInput}
                    value={priceText}
                    onChangeText={(text) => setPriceText(text.replace(/[^0-9.]/g, ''))}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={colors.textMuted}
                    autoFocus
                  />
                </View>

                <Text style={styles.stepLabel}>…for how much?</Text>
                <View style={styles.amountRow}>
                  <TextInput
                    style={styles.amountInput}
                    value={amountText}
                    onChangeText={(text) => setAmountText(text.replace(/[^0-9.]/g, ''))}
                    keyboardType="decimal-pad"
                    placeholder="1"
                    placeholderTextColor={colors.textMuted}
                  />
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={styles.unitStrip}
                  >
                    {UNITS.map((unit) => (
                      <Pressable
                        key={unit.id}
                        onPress={() => setUnitId(unit.id)}
                        style={[styles.unitChip, unitId === unit.id && styles.unitChipActive]}
                      >
                        <Text
                          style={[
                            styles.unitChipText,
                            unitId === unit.id && styles.unitChipTextActive,
                          ]}
                        >
                          {unit.label}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                {/* Showing the normalised figure as it's typed makes the
                    unit math visible, so a wrong unit is obvious before
                    submitting rather than after. */}
                {normalised ? (
                  <Text style={styles.normalised}>
                    = ${normalised.pricePerBase.toFixed(2)} {baseUnitLabel(normalised.dimension)}
                  </Text>
                ) : null}

                {!product.category ? (
                  pickingCategory ? (
                    <View style={styles.categoryBox}>
                      <Text style={styles.categoryHint}>
                        Pick the closest match so this can be compared to national data.
                      </Text>
                      <CategoryPicker
                        selected={categoryOverride}
                        onSelect={(picked) => {
                          setCategoryOverride(picked);
                          setPickingCategory(false);
                        }}
                      />
                    </View>
                  ) : (
                    <Pressable onPress={() => setPickingCategory(true)}>
                      <Text style={styles.categoryLink}>
                        {categoryOverride
                          ? `Compared as: ${getCategory(categoryOverride).label} — change`
                          : 'Match this to a national price category (optional)'}
                      </Text>
                    </Pressable>
                  )
                ) : null}
              </>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <View style={styles.footer}>
            {submitting ? (
              <View style={styles.submittingRow}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.submittingText}>Saving your price…</Text>
              </View>
            ) : (
              <PrimaryButton
                label="Submit"
                onPress={handleSubmit}
                disabled={!product || !store || !priceText || !amountText}
              />
            )}
          </View>
        </KeyboardAvoidingView>
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
  scrollView: { flex: 1 },
  content: { flexGrow: 1, padding: spacing.lg },
  stepLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  dollarSign: { fontSize: 24, fontWeight: '700', color: colors.text, marginRight: spacing.xs },
  priceInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    paddingVertical: spacing.md,
  },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  amountInput: {
    width: 74,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  unitStrip: { gap: spacing.xs, paddingRight: spacing.sm },
  unitChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  unitChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  unitChipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  unitChipTextActive: { color: colors.onPrimary },
  normalised: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    marginTop: spacing.sm,
  },
  categoryBox: { marginTop: spacing.md },
  categoryHint: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm },
  categoryLink: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginTop: spacing.md,
  },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.md, lineHeight: 18 },
  footer: { padding: spacing.lg },
  submittingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  submittingText: { color: colors.textMuted, fontSize: 14 },
});

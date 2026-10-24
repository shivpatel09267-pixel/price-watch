import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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
import StorePicker from './StorePicker';
import PrimaryButton from './PrimaryButton';
import { getDeviceCoordinates } from '../services/locationService';
import { updatePriceEntry } from '../services/priceEntryService';
import type { NearbyStore } from '../services/storeService';
import { getCategory } from '../constants/categories';
import { baseUnitLabel, pricePerBaseUnit, UNITS } from '../constants/units';
import { useNationalAverages } from '../hooks/useNationalAverages';
import { checkPriceAgainstNational } from '../utils/priceSanity';
import type { LatLng } from '../utils/geo';
import { radius, spacing } from '../constants/theme';
import { makeStyles, useTheme } from '../context/ThemeContext';
import * as haptics from '../utils/haptics';
import type { PriceEntry } from '../types';

interface EditEntryModalProps {
  entry: PriceEntry;
  visible: boolean;
  onClose: () => void;
}

// The entry's current store, in the shape StorePicker hands back, so an
// edit that doesn't touch the store saves it unchanged.
function storeOf(entry: PriceEntry): NearbyStore {
  return {
    id: entry.storeId ?? `manual/${entry.id}`,
    name: entry.storeName ?? 'Unknown store',
    branch: entry.storeBranch ?? null,
    address: entry.address ?? null,
    latitude: entry.latitude,
    longitude: entry.longitude,
    distanceMiles: 0,
  };
}

// Fixes a logged price without deleting it and logging it again: what was
// paid, for how much, and at which store. The item itself stays as logged.
// Validation matches LogPriceModal, so an edit can't save anything a new
// entry couldn't.
export default function EditEntryModal({ entry, visible, onClose }: EditEntryModalProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { averages: nationalAverages } = useNationalAverages();
  const [priceText, setPriceText] = useState('');
  const [amountText, setAmountText] = useState('');
  const [unitId, setUnitId] = useState(entry.unitId);
  const [store, setStore] = useState<NearbyStore>(() => storeOf(entry));
  const [changingStore, setChangingStore] = useState(false);
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Starts from the entry as it is now every time it opens.
  useEffect(() => {
    if (!visible) return;
    setPriceText(entry.price.toFixed(2));
    setAmountText(String(entry.amount));
    setUnitId(entry.unitId);
    setStore(storeOf(entry));
    setChangingStore(false);
    setSaving(false);
    setError('');
  }, [visible, entry]);

  // Only needed to list stores near the user if they change the store.
  useEffect(() => {
    if (!changingStore || origin) return;
    let cancelled = false;
    getDeviceCoordinates().then((coords) => {
      if (!cancelled && coords) {
        setOrigin({ latitude: coords.latitude, longitude: coords.longitude });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [changingStore, origin]);

  const normalised = useMemo(
    () => pricePerBaseUnit(parseFloat(priceText), parseFloat(amountText), unitId),
    [priceText, amountText, unitId]
  );

  function reject(message: string) {
    haptics.warning();
    setError(message);
  }

  async function handleSave() {
    setError('');
    const price = parseFloat(priceText);
    if (!Number.isFinite(price) || price <= 0 || price >= 1000) {
      return reject('Enter a valid price.');
    }
    const amount = parseFloat(amountText);
    if (!Number.isFinite(amount) || amount <= 0) {
      return reject('Enter how much you got for that price.');
    }
    if (entry.category) {
      const sanity = checkPriceAgainstNational(
        normalised,
        nationalAverages[entry.category],
        getCategory(entry.category).label.toLowerCase()
      );
      if (!sanity.ok) {
        return reject(sanity.message ?? 'That price does not look right.');
      }
    }

    setSaving(true);
    try {
      await updatePriceEntry(entry, { price, amount, unitId, store });
      // The list is a live subscription, so the row updates by itself.
      haptics.success();
      onClose();
    } catch (saveError) {
      console.warn('[EditEntryModal] save failed:', saveError);
      haptics.error();
      setError("Couldn't save your changes. Check your connection and try again.");
      setSaving(false);
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
            <Text style={styles.title}>Edit Entry</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <MaterialCommunityIcons name="close" size={26} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.productName}>{entry.productName}</Text>
            {entry.brand ? <Text style={styles.productMeta}>{entry.brand}</Text> : null}

            <Text style={styles.stepLabel}>What did you pay?</Text>
            <View style={styles.priceRow}>
              <Text style={styles.dollarSign}>$</Text>
              <TextInput
                style={styles.priceInput}
                value={priceText}
                onChangeText={(text) => setPriceText(text.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                selectTextOnFocus
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
                selectTextOnFocus
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
                      style={[styles.unitChipText, unitId === unit.id && styles.unitChipTextActive]}
                    >
                      {unit.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
            {normalised ? (
              <Text style={styles.normalised}>
                = ${normalised.pricePerBase.toFixed(2)} {baseUnitLabel(normalised.dimension)}
              </Text>
            ) : null}

            <Text style={styles.stepLabel}>Store</Text>
            {changingStore ? (
              <StorePicker
                origin={origin}
                selected={store}
                onSelect={(picked) => {
                  setStore(picked);
                  setChangingStore(false);
                }}
              />
            ) : (
              <View style={styles.storeBox}>
                <View style={styles.storeDetails}>
                  <Text style={styles.storeName}>
                    {store.name}
                    {store.branch ? ` — ${store.branch}` : ''}
                  </Text>
                  {store.address ? <Text style={styles.storeAddress}>{store.address}</Text> : null}
                </View>
                <Pressable onPress={() => setChangingStore(true)} hitSlop={8}>
                  <Text style={styles.changeLink}>Change</Text>
                </Pressable>
              </View>
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <View style={styles.footer}>
            {saving ? (
              <View style={styles.savingRow}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.savingText}>Saving changes…</Text>
              </View>
            ) : (
              <PrimaryButton
                label="Save Changes"
                onPress={handleSave}
                disabled={!priceText || !amountText}
              />
            )}
          </View>
        </KeyboardAvoidingView>
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
  content: { flexGrow: 1, padding: spacing.lg },
  productName: { fontSize: 17, fontWeight: '700', color: colors.text },
  productMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  stepLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
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
  normalised: { fontSize: 13, fontWeight: '600', color: colors.primary, marginTop: spacing.sm },
  storeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  storeDetails: { flex: 1 },
  storeName: { fontSize: 14, fontWeight: '600', color: colors.text },
  storeAddress: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  changeLink: { fontSize: 13, fontWeight: '700', color: colors.primary },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.md, lineHeight: 18 },
  footer: { padding: spacing.lg },
  savingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  savingText: { color: colors.textMuted, fontSize: 14 },
}));

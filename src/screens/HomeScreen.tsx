import { useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import LogPriceModal, { type LogPriceResult } from '../components/LogPriceModal';
import FindCheapestModal from '../components/FindCheapestModal';
import RecentEntryRow from '../components/RecentEntryRow';
import PrimaryButton from '../components/PrimaryButton';
import { useAuth } from '../context/AuthContext';
import { useRecentEntries } from '../hooks/useRecentEntries';
import { card, colors, radius, shadows, spacing, type } from '../constants/theme';
import * as haptics from '../utils/haptics';

// Opens the device's own Maps app pinned at a point — used for "view the
// cheapest nearby report on a map" below. No place/business name exists
// in the data model (just coordinates), so this is the most useful thing
// we can do with what's actually logged.
function openInMaps(latitude: number, longitude: number, label?: string | null) {
  const query = label ? encodeURIComponent(label) : `${latitude},${longitude}`;
  const url =
    Platform.OS === 'ios'
      ? `maps:0,0?q=${query}&ll=${latitude},${longitude}`
      : Platform.OS === 'android'
        ? `geo:${latitude},${longitude}?q=${query}`
        : `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  Linking.openURL(url).catch(() => {
    // If the platform has no maps app registered for that URL scheme,
    // just do nothing rather than crash or show a confusing error.
  });
}

export default function HomeScreen() {
  const { user } = useAuth();
  const { entries, loading } = useRecentEntries(user?.uid);
  const [modalVisible, setModalVisible] = useState(false);
  const [findCheapestVisible, setFindCheapestVisible] = useState(false);
  const [successInfo, setSuccessInfo] = useState<LogPriceResult | null>(null);

  function handleSubmitted(result: LogPriceResult) {
    setSuccessInfo(result);
    setTimeout(() => setSuccessInfo(null), 5000);
  }

  const cheapest = successInfo?.cheapest.results[0] ?? null;

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Price Watch</Text>
            <Text style={styles.title}>
              {entries.length === 0
                ? 'Log your first price'
                : `${entries.length} ${entries.length === 1 ? 'price' : 'prices'} logged`}
            </Text>
          </View>
        </View>

        {successInfo ? (
          <View style={styles.successBanner}>
            <MaterialCommunityIcons name="check-circle" size={18} color={colors.success} />
            <View style={styles.successTextGroup}>
              <Text style={styles.successText}>Price logged!</Text>
              {cheapest ? (
                <Pressable
                  onPress={() => {
                    haptics.tap();
                    openInMaps(cheapest.latitude, cheapest.longitude, cheapest.storeName);
                  }}
                >
                  <Text style={styles.cheapestText}>
                    {/* "Similar item" rather than the product name when the
                        match fell back to the category — overstating it
                        would be the one thing that makes this misleading. */}
                    Cheapest nearby{' '}
                    {successInfo.cheapest.matchedBy === 'product'
                      ? successInfo.productName
                      : `similar item (${cheapest.productName})`}
                    : ${cheapest.price.toFixed(2)}
                    {cheapest.storeName ? ` at ${cheapest.storeName}` : ''} — tap to view on map
                  </Text>
                </Pressable>
              ) : (
                <Text style={styles.cheapestTextMuted}>
                  No other nearby verified prices yet to compare against.
                </Text>
              )}
            </View>
          </View>
        ) : null}

        {/* The hero carries the app's one job in plain language, then the
            two things you can actually do about it. Keeping both pills
            inside one panel stops the screen reading as a stack of
            unrelated buttons. */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <MaterialCommunityIcons name="tag-multiple" size={22} color={colors.primary} />
          </View>
          <Text style={styles.heroTitle}>What did you pay?</Text>
          <Text style={styles.heroBody}>
            Log what an item actually cost you and see how it compares to nearby stores and the
            national average.
          </Text>
          <View style={styles.heroActions}>
            <PrimaryButton
              label="Log a Price"
              icon="plus"
              onPress={() => setModalVisible(true)}
            />
            <PrimaryButton
              label="Find Cheapest Near Me"
              icon="tag-search"
              variant="secondary"
              onPress={() => setFindCheapestVisible(true)}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Your Recent Entries</Text>
        {loading ? null : entries.length === 0 ? (
          <Text style={styles.emptyText}>
            You haven't logged any prices yet — tap the button above to start.
          </Text>
        ) : (
          entries.map((entry) => <RecentEntryRow key={entry.id} entry={entry} />)
        )}

        <LogPriceModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          onSubmitted={handleSubmitted}
        />

        <FindCheapestModal
          visible={findCheapestVisible}
          onClose={() => setFindCheapestVisible(false)}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, backgroundColor: colors.background, padding: spacing.lg },
  header: { marginBottom: spacing.lg },
  eyebrow: { ...type.overline, color: colors.primary, marginBottom: spacing.xs },
  title: { ...type.display, color: colors.text },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.successSoft,
    // A colour-matched left rule reads as "status" at a glance, which a
    // plain tinted rectangle doesn't.
    borderLeftWidth: 3,
    borderLeftColor: colors.success,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  successTextGroup: { flex: 1 },
  successText: { ...type.bodyStrong, color: colors.success },
  cheapestText: { color: colors.primary, fontSize: 13, fontWeight: '600', marginTop: 2 },
  cheapestTextMuted: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  hero: {
    ...card,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    ...shadows.sm,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heroTitle: { ...type.title, color: colors.text, marginBottom: spacing.sm },
  heroBody: { ...type.body, color: colors.textMuted, lineHeight: 21, marginBottom: spacing.lg },
  heroActions: { gap: spacing.sm },
  sectionTitle: { ...type.heading, color: colors.text, marginBottom: spacing.md },
  emptyText: { ...type.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
});

import { useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import LogPriceModal, { type LogPriceResult } from '../components/LogPriceModal';
import FindCheapestModal from '../components/FindCheapestModal';
import RecentEntryRow from '../components/RecentEntryRow';
import { useAuth } from '../context/AuthContext';
import { useRecentEntries } from '../hooks/useRecentEntries';
import { colors, radius, spacing } from '../constants/theme';

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
        <Text style={styles.title}>Price Watch</Text>

        {successInfo ? (
          <View style={styles.successBanner}>
            <MaterialCommunityIcons name="check-circle" size={18} color={colors.success} />
            <View style={styles.successTextGroup}>
              <Text style={styles.successText}>Price logged!</Text>
              {cheapest ? (
                <Pressable
                  onPress={() =>
                    openInMaps(cheapest.latitude, cheapest.longitude, cheapest.storeName)
                  }
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

        <Pressable style={styles.addButton} onPress={() => setModalVisible(true)}>
          <MaterialCommunityIcons name="plus" size={36} color="#fff" />
        </Pressable>
        <Text style={styles.addLabel}>Log a Price</Text>

        <Pressable style={styles.findCheapestButton} onPress={() => setFindCheapestVisible(true)}>
          <MaterialCommunityIcons name="tag-search" size={20} color={colors.primary} />
          <Text style={styles.findCheapestText}>Find Cheapest Near Me</Text>
        </Pressable>

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
  title: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#DCFCE7',
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  successTextGroup: { flex: 1 },
  successText: { color: colors.success, fontWeight: '600' },
  cheapestText: { color: colors.primary, fontSize: 13, fontWeight: '600', marginTop: 2 },
  cheapestTextMuted: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  addButton: {
    alignSelf: 'center',
    width: 88,
    height: 88,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  addLabel: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  findCheapestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  findCheapestText: { color: colors.primary, fontSize: 15, fontWeight: '700' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  emptyText: { color: colors.textMuted, fontSize: 14, textAlign: 'center', marginTop: spacing.lg },
});

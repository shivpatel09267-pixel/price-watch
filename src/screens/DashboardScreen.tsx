import { useEffect, useMemo, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LineChart } from 'react-native-chart-kit';
import RecentItemSwitcher from '../components/RecentItemSwitcher';
import ItemVsNationalCard from '../components/ItemVsNationalCard';
import StatCard from '../components/StatCard';
import PriceContextToggle from '../components/PriceContextToggle';
import ContextCardsSection from '../components/ContextCardsSection';
import ComparisonSection from '../components/ComparisonSection';
import { useAuth } from '../context/AuthContext';
import { useRecentEntries } from '../hooks/useRecentEntries';
import { useNationalAverages } from '../hooks/useNationalAverages';
import { useCategoryStats, type PricePoint } from '../hooks/useCategoryStats';
import { getDeviceCoordinates } from '../services/locationService';
import { LOCAL_RADIUS_MILES, type LatLng } from '../utils/geo';
import { baseUnitLabel } from '../constants/units';
import { colors, radius, spacing } from '../constants/theme';
import type { PriceEntry } from '../types';

// How far back the item strip looks. Deliberately more than the handful
// shown on Home: this is the "what have I been buying" view.
const RECENT_ENTRY_LIMIT = 30;

const screenWidth = Dimensions.get('window').width;

// Turns a possibly-long list of dated entries into chart labels without
// every single one overlapping — chart-kit renders whatever labels array
// it's given with no built-in thinning of its own.
function buildChartLabels(entries: PricePoint[]): string[] {
  if (entries.length <= 6) {
    return entries.map((entry) => {
      const date = new Date(entry.timestamp);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    });
  }
  const step = Math.ceil(entries.length / 6);
  return entries.map((entry, index) => {
    if (index % step !== 0) return '';
    const date = new Date(entry.timestamp);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  });
}

export default function DashboardScreen() {
  const { user, userProfile } = useAuth();
  const { entries: recentEntries, loading: entriesLoading } = useRecentEntries(
    user?.uid,
    RECENT_ENTRY_LIMIT
  );
  const { averages } = useNationalAverages();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // One pill per distinct product, keeping only the newest entry for
  // each. Logging milk four times should give one "Milk" pill showing
  // the latest price, not four identical-looking pills.
  const items = useMemo(() => {
    const seen = new Map<string, PriceEntry>();
    for (const entry of recentEntries) {
      const key = entry.barcode ?? `${entry.productName}|${entry.brand ?? ''}`;
      if (!seen.has(key)) seen.set(key, entry);
    }
    return [...seen.values()];
  }, [recentEntries]);

  // Follow the newest entry until the user picks something themselves,
  // then leave their choice alone — but fall back if that item scrolls
  // out of the window or is deleted.
  const selected = items.find((entry) => entry.id === selectedId) ?? items[0] ?? null;
  const category = selected?.category ?? null;

  // "Local" is a 20-mile radius around where you actually are, so the
  // dashboard needs coordinates rather than the profile zip code.
  const [origin, setOrigin] = useState<LatLng | null>(null);
  useEffect(() => {
    let cancelled = false;
    getDeviceCoordinates().then((coords) => {
      if (!cancelled && coords) {
        setOrigin({ latitude: coords.latitude, longitude: coords.longitude });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useCategoryStats(user?.uid, origin, category);
  // Every figure on this screen is normalised, so the unit label comes
  // from the data's own dimension rather than the category's nominal
  // unit — the two can disagree once people log arbitrary package sizes.
  const unitLabel = stats.dimension ? baseUnitLabel(stats.dimension) : '';

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Dashboard</Text>

        <View style={styles.toggleSpacing}>
          <PriceContextToggle />
        </View>

        {entriesLoading ? null : items.length === 0 ? (
          <View style={styles.emptyChart}>
            <Text style={styles.emptyChartText}>
              Nothing to show yet — log a price on the Home tab and this fills in with your own
              items and how they compare nationally.
            </Text>
          </View>
        ) : null}

        {selected ? (
          <>
            <Text style={styles.sectionTitle}>Your Recent Items</Text>
            <RecentItemSwitcher
              items={items}
              selectedId={selected.id}
              onSelect={(entry) => setSelectedId(entry.id)}
            />

            <ItemVsNationalCard
              entry={selected}
              national={category ? averages[category] : undefined}
            />
          </>
        ) : null}

        <View style={styles.statsRow}>
          <StatCard
            label="Your Average"
            value={stats.yourAverage}
            unit={unitLabel}
            emptyText="No entries in the last 30 days"
            reportCount={stats.yourReportCount}
          />
          <StatCard
            label={`Within ${LOCAL_RADIUS_MILES} Miles`}
            value={stats.localAverage}
            unit={unitLabel}
            emptyText={`No verified reports within ${LOCAL_RADIUS_MILES} miles yet`}
            reportCount={stats.localReportCount}
          />
        </View>

        <Text style={styles.sectionTitle}>Your Price History</Text>
        {stats.loading || !selected ? null : stats.personalEntries.length === 0 ? (
          <View style={styles.emptyChart}>
            <Text style={styles.emptyChartText}>
              {category
                ? `No comparable ${selected.productName} prices in the last 30 days. Log it again and the trend appears here.`
                : `${selected.productName} isn't matched to a national price category, so there's no comparable history to chart.`}
            </Text>
          </View>
        ) : (
          <LineChart
            data={{
              labels: buildChartLabels(stats.personalEntries),
              datasets: [{ data: stats.personalEntries.map((entry) => entry.price) }],
            }}
            width={screenWidth - spacing.lg * 2}
            height={200}
            yAxisLabel="$"
            chartConfig={{
              backgroundColor: colors.surface,
              backgroundGradientFrom: colors.surface,
              backgroundGradientTo: colors.surface,
              decimalPlaces: 2,
              color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
              labelColor: () => colors.textMuted,
              propsForDots: { r: '4', strokeWidth: '2', stroke: colors.primary },
            }}
            bezier
            style={styles.chart}
          />
        )}

        {category ? (
          <ComparisonSection
            category={category}
            localAverage={stats.localAverage}
            dimension={stats.dimension}
          />
        ) : null}

        <ContextCardsSection highlight={category} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, backgroundColor: colors.background, padding: spacing.lg },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  toggleSpacing: { marginBottom: spacing.md },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  chart: { borderRadius: radius.md },
  emptyChart: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyChartText: { color: colors.textMuted, fontSize: 14, textAlign: 'center' },
});

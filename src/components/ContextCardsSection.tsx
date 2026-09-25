import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import ContextCard from './ContextCard';
import { CONTEXT_CARDS } from '../constants/contextCards';
import { useSettings } from '../context/SettingsContext';
import { colors, spacing } from '../constants/theme';
import type { CategoryId } from '../constants/categories';

interface ContextCardsSectionProps {
  // The item currently being viewed. Its card is moved to the front so
  // the explanation matches what's on screen instead of making the user
  // scroll sideways hunting for it.
  highlight?: CategoryId | null;
}

// Central gate for Feature 6B: every screen that wants to show "why is
// this happening" content renders THIS component rather than rolling its
// own visibility check — the toggle logic lives here once, so it's not
// possible to add the cards to a new screen later and forget to check
// the setting.
export default function ContextCardsSection({ highlight }: ContextCardsSectionProps) {
  const { showPriceContext, loaded } = useSettings();

  const cards = useMemo(() => {
    if (!highlight) return CONTEXT_CARDS;
    const match = CONTEXT_CARDS.filter((card) => card.category === highlight);
    if (match.length === 0) return CONTEXT_CARDS;
    return [...match, ...CONTEXT_CARDS.filter((card) => card.category !== highlight)];
  }, [highlight]);

  if (!loaded || !showPriceContext) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Why Are Prices Changing?</Text>
      {/* Background explanations, not live news — said plainly so the
          cards aren't mistaken for current reporting. */}
      <Text style={styles.subtitle}>
        Background on what drives each of these staples. The figures above are live; these
        explanations are written to stay true over time.
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {cards.map((card) => (
          <ContextCard key={card.category} card={card} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: spacing.lg },
  title: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  subtitle: { fontSize: 12, color: colors.textMuted, lineHeight: 17, marginBottom: spacing.sm },
});

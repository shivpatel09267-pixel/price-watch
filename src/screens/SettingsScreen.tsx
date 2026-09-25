import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PrimaryButton from '../components/PrimaryButton';
import PriceContextToggle from '../components/PriceContextToggle';
import ConfirmModal from '../components/ConfirmModal';
import { signOutUser } from '../services/authService';
import { deleteAllPriceEntriesForUser } from '../services/priceEntryService';
import { useAuth } from '../context/AuthContext';
import { card, colors, spacing, type } from '../constants/theme';
import * as haptics from '../utils/haptics';

export default function SettingsScreen() {
  const { user, userProfile } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [confirmingWipe, setConfirmingWipe] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOutUser();
      // No manual navigation — RootNavigator swaps back to the Auth
      // screens automatically once AuthContext sees the signed-out state.
    } catch {
      haptics.error();
      setError('Sign out failed. Check your connection and try again.');
      setSigningOut(false);
    }
  }

  async function handleDeleteAll() {
    if (!user) return;
    setWiping(true);
    setError('');
    setNotice('');
    try {
      const removed = await deleteAllPriceEntriesForUser(user.uid);
      haptics.success();
      setNotice(
        removed === 0
          ? 'You had no logged prices to delete.'
          : `Deleted ${removed} logged ${removed === 1 ? 'price' : 'prices'}.`
      );
      setConfirmingWipe(false);
    } catch {
      haptics.error();
      setError("Couldn't delete your data. Check your connection and try again.");
    } finally {
      setWiping(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Settings</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Signed in as</Text>
          <Text style={styles.value}>{user?.email}</Text>
          <Text style={[styles.label, styles.labelSpaced]}>Zip code</Text>
          <Text style={styles.value}>{userProfile?.zipCode}</Text>
        </View>

        <View style={styles.toggleSpacing}>
          <PriceContextToggle />
        </View>

        <PrimaryButton label="Sign Out" icon="logout" onPress={handleSignOut} loading={signingOut} />

        {/* Kept visually apart from the everyday controls above, so
            "delete everything" is never the button you hit by reflex. */}
        <View style={styles.dangerZone}>
          <Text style={styles.dangerHeading}>Danger zone</Text>
          <Text style={styles.dangerBody}>
            Permanently deletes every price you've logged. This can't be undone, and those entries
            stop counting toward local averages for everyone.
          </Text>
          <PrimaryButton
            label="Delete All My Data"
            icon="trash-can-outline"
            variant="secondary"
            onPress={() => setConfirmingWipe(true)}
          />
        </View>

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <ConfirmModal
        visible={confirmingWipe}
        destructive
        title="Delete all your data?"
        // Deliberately specific about the limits: the Firestore rules
        // forbid deleting the user profile document, and this doesn't
        // touch the Firebase Auth account either. Saying "all your data"
        // without that caveat would overpromise.
        message="Every price you've logged will be permanently deleted. Your account and email stay — sign out instead if that's what you wanted."
        confirmLabel="Delete everything"
        loading={wiping}
        onConfirm={handleDeleteAll}
        onCancel={() => setConfirmingWipe(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  title: { ...type.display, color: colors.text, marginBottom: spacing.lg },
  card: { ...card, padding: spacing.md, marginBottom: spacing.lg },
  label: { ...type.overline, color: colors.textSubtle },
  labelSpaced: { marginTop: spacing.md },
  value: { ...type.body, fontSize: 16, color: colors.text, marginTop: 4 },
  toggleSpacing: { marginBottom: spacing.lg },
  dangerZone: {
    ...card,
    borderColor: colors.dangerSoft,
    padding: spacing.md,
    marginTop: spacing.xl,
  },
  dangerHeading: { ...type.overline, color: colors.danger, marginBottom: spacing.sm },
  dangerBody: { ...type.caption, color: colors.textMuted, lineHeight: 19, marginBottom: spacing.md },
  notice: { ...type.caption, color: colors.success, textAlign: 'center', marginTop: spacing.md },
  error: { ...type.caption, color: colors.danger, textAlign: 'center', marginTop: spacing.md },
});

import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PrimaryButton from '../components/PrimaryButton';
import PriceContextToggle from '../components/PriceContextToggle';
import { signOutUser } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { colors, radius, spacing } from '../constants/theme';

export default function SettingsScreen() {
  const { user, userProfile } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOutUser();
      // No manual navigation — RootNavigator swaps back to the Auth
      // screens automatically once AuthContext sees the signed-out state.
    } catch {
      Alert.alert('Sign out failed', 'Check your connection and try again.');
      setSigningOut(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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

      <PrimaryButton label="Sign Out" onPress={handleSignOut} loading={signingOut} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: { fontSize: 12, color: colors.textMuted, textTransform: 'uppercase', fontWeight: '600' },
  labelSpaced: { marginTop: spacing.md },
  value: { fontSize: 16, color: colors.text, marginTop: 2 },
  toggleSpacing: { marginBottom: spacing.lg },
});

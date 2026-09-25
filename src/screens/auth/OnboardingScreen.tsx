import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AuthTextInput from '../../components/AuthTextInput';
import PrimaryButton from '../../components/PrimaryButton';
import { setUserZipCode } from '../../services/authService';
import { isValidZipCode } from '../../utils/validation';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing } from '../../constants/theme';

// Shown exactly once, right after sign-up, to any signed-in user whose
// Firestore profile doesn't have a zip code yet. Rendered directly by
// RootNavigator (not part of AuthNavigator or the main tabs) since it's
// neither "logged out" nor "fully set up".
export default function OnboardingScreen() {
  const { user } = useAuth();
  const [zipCode, setZipCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleContinue() {
    setError('');
    if (!isValidZipCode(zipCode)) {
      setError('Enter a valid 5-digit zip code.');
      return;
    }
    if (!user) return;
    setSubmitting(true);
    try {
      await setUserZipCode(user.uid, zipCode.trim());
      // No manual navigation — AuthContext's live profile listener sees
      // the new zipCode and RootNavigator swaps to the main app on its own.
    } catch (saveError) {
      // Logged as well as shown: a rules rejection and a network failure
      // look identical to the user otherwise, and guessing between them
      // wastes a lot of time.
      console.warn('[OnboardingScreen] zip save failed:', saveError);
      const code = (saveError as { code?: string } | null)?.code;
      setError(
        code === 'permission-denied'
          ? "Your account isn't allowed to save this yet. This is a setup issue, not something you did wrong."
          : 'Could not save your zip code. Check your connection and try again.'
      );
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.flex}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <Text style={styles.title}>Where are you located?</Text>
          <Text style={styles.subtitle}>
            Your zip code tags your price reports and helps us compute local averages for your area.
          </Text>
          <AuthTextInput
            label="Zip Code"
            value={zipCode}
            onChangeText={setZipCode}
            keyboardType="number-pad"
            maxLength={5}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton label="Continue" onPress={handleContinue} loading={submitting} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center', marginBottom: spacing.md },
});

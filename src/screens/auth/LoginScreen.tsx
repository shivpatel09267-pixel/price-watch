import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import AuthTextInput from '../../components/AuthTextInput';
import PrimaryButton from '../../components/PrimaryButton';
import { signIn } from '../../services/authService';
import { getAuthErrorMessage, isValidEmail } from '../../utils/validation';
import { colors, spacing, type } from '../../constants/theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  async function handleLogin() {
    setFormError('');
    if (!isValidEmail(email)) {
      setFormError('Enter a valid email address.');
      return;
    }
    if (password.length === 0) {
      setFormError('Enter your password.');
      return;
    }
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      // No manual navigation on success — AuthContext picks up the signed
      // in user and RootNavigator swaps to the main app on its own.
    } catch (error) {
      setFormError(getAuthErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.flex}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Price Watch</Text>
          <Text style={styles.subtitle}>Log in to keep tracking prices in your area.</Text>

          <AuthTextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <AuthTextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
          />

          {/* Sits directly under the password field, where someone who
              just failed a login is already looking. */}
          <Text
            style={styles.forgot}
            onPress={() => navigation.navigate('ForgotPassword')}
            accessibilityRole="button"
          >
            Forgot password?
          </Text>

          {formError ? <Text style={styles.formError}>{formError}</Text> : null}

          <PrimaryButton label="Log In" icon="login" onPress={handleLogin} loading={submitting} />

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <Text style={styles.link} onPress={() => navigation.navigate('SignUp')}>
              Sign Up
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  title: { ...type.display, color: colors.text, textAlign: 'center', marginBottom: spacing.xs },
  subtitle: {
    ...type.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  forgot: {
    ...type.caption,
    fontWeight: '600',
    color: colors.primary,
    textAlign: 'right',
    marginBottom: spacing.lg,
  },
  formError: {
    ...type.caption,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg },
  footerText: { ...type.body, color: colors.textMuted },
  link: { ...type.bodyStrong, color: colors.primary },
});

import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import AuthTextInput from '../../components/AuthTextInput';
import PrimaryButton from '../../components/PrimaryButton';
import { sendPasswordReset } from '../../services/authService';
import { getAuthErrorMessage, isValidEmail } from '../../utils/validation';
import { card, colors, radius, spacing, type } from '../../constants/theme';
import * as haptics from '../../utils/haptics';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [sent, setSent] = useState(false);

  async function handleSend() {
    setFormError('');
    if (!isValidEmail(email)) {
      haptics.warning();
      setFormError('Enter a valid email address.');
      return;
    }
    setSubmitting(true);
    try {
      await sendPasswordReset(email.trim());
      haptics.success();
      setSent(true);
    } catch (error) {
      haptics.error();
      setFormError(getAuthErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <SafeAreaView style={styles.flex}>
        <View style={styles.container}>
          <View style={styles.doneIcon}>
            <MaterialCommunityIcons name="email-fast-outline" size={26} color={colors.success} />
          </View>
          <Text style={styles.title}>Check your email</Text>
          {/* Deliberately hedged: with email-enumeration protection on,
              the API succeeds whether or not that address has an account,
              so promising "we sent it" would be a lie half the time. */}
          <Text style={styles.subtitle}>
            If an account exists for {email.trim()}, a password reset link is on its way. It can
            take a minute — check your spam folder too.
          </Text>
          <View style={styles.actions}>
            <PrimaryButton
              label="Back to Log In"
              icon="arrow-left"
              onPress={() => navigation.navigate('Login')}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.flex}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.icon}>
            <MaterialCommunityIcons name="lock-reset" size={26} color={colors.primary} />
          </View>
          <Text style={styles.title}>Reset your password</Text>
          <Text style={styles.subtitle}>
            Enter the email you signed up with and we'll send you a link to set a new password.
          </Text>

          <AuthTextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoFocus
          />

          {formError ? <Text style={styles.formError}>{formError}</Text> : null}

          <View style={styles.actions}>
            <PrimaryButton
              label="Send Reset Link"
              icon="email-outline"
              onPress={handleSend}
              loading={submitting}
            />
            <PrimaryButton
              label="Back to Log In"
              variant="secondary"
              onPress={() => navigation.goBack()}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  icon: {
    ...card,
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  doneIcon: {
    ...card,
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  title: { ...type.title, color: colors.text, textAlign: 'center', marginBottom: spacing.sm },
  subtitle: {
    ...type.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: spacing.xl,
  },
  formError: {
    ...type.caption,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
});

import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import PrimaryButton from './PrimaryButton';
import { card, colors, radius, spacing, type } from '../constants/theme';
import * as haptics from '../utils/haptics';

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  // Destructive swaps the accent for danger red. Anything that removes
  // data should set it — the colour is the last warning before the tap.
  destructive?: boolean;
}

// Used instead of RN's Alert.alert for anything destructive.
//
// Alert is not implemented by react-native-web, so on the web build an
// Alert-based confirmation silently never appears — and the "are you
// sure?" step for a delete is the one thing that must not quietly vanish
// on a platform. This renders the same on every platform, and matches the
// rest of the UI instead of an OS dialog.
export default function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  loading,
  destructive,
}: ConfirmModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      // Android's hardware back button has to dismiss this, or it's a
      // dead-end screen.
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        {/* Tapping the scrim cancels — standard for a dialog, and it
            means a mis-tap never commits the destructive action. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityRole="button" />
        <View style={styles.sheet}>
          <View style={[styles.icon, destructive && styles.iconDestructive]}>
            <MaterialCommunityIcons
              name={destructive ? 'trash-can-outline' : 'help-circle-outline'}
              size={24}
              color={destructive ? colors.danger : colors.primary}
            />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <Pressable
              onPress={() => {
                haptics.warning();
                onConfirm();
              }}
              disabled={loading}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.confirm,
                destructive && styles.confirmDestructive,
                pressed && styles.confirmPressed,
                loading && styles.confirmDisabled,
              ]}
            >
              <Text style={styles.confirmText}>{loading ? 'Working…' : confirmLabel}</Text>
            </Pressable>
            <PrimaryButton label="Cancel" variant="secondary" onPress={onCancel} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: { ...card, width: '100%', maxWidth: 400, padding: spacing.lg },
  icon: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  iconDestructive: { backgroundColor: colors.dangerSoft },
  title: { ...type.title, color: colors.text, marginBottom: spacing.sm },
  message: { ...type.body, color: colors.textMuted, lineHeight: 21, marginBottom: spacing.lg },
  actions: { gap: spacing.sm },
  confirm: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDestructive: { backgroundColor: colors.danger },
  confirmPressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  confirmDisabled: { opacity: 0.5 },
  confirmText: { ...type.bodyStrong, fontSize: 16, color: colors.onPrimary },
});

// Thin wrapper over expo-haptics so call sites stay one word long and
// never have to think about platform or failure.
//
// Two rules this enforces for everyone:
//   1. Web (and anywhere without a vibrator) silently does nothing —
//      expo-haptics is a no-op there, but the promise it hands back can
//      still reject, and an unhandled rejection over a *button press* is
//      not a crash worth having.
//   2. Nothing here is awaited. Haptics are decoration; making a submit
//      handler wait on the taptic engine would add latency to the thing
//      the user actually asked for.
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const supported = Platform.OS === 'ios' || Platform.OS === 'android';

function fire(run: () => Promise<void>) {
  if (!supported) return;
  run().catch(() => {
    // Device has no haptic hardware, or the OS refused (low power mode,
    // system haptics switched off). Not worth surfacing.
  });
}

/** A value changed: category chip, store row, unit, tab. The lightest tick. */
export function selection() {
  fire(() => Haptics.selectionAsync());
}

/** A button was pressed and something will happen as a result. */
export function tap() {
  fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/** A heavier press for a primary, committing action. */
export function press() {
  fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

/** The write went through — a price was logged. */
export function success() {
  fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** Refused for a reason the user can fix, e.g. a price that fails the sanity check. */
export function warning() {
  fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}

/** Something actually failed — a rejected write, a network error. */
export function error() {
  fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}

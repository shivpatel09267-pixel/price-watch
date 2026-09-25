import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, radius, spacing, type } from '../constants/theme';

interface AuthTextInputProps extends TextInputProps {
  label: string;
  errorText?: string;
}

export default function AuthTextInput({
  label,
  errorText,
  style,
  onFocus,
  onBlur,
  ...rest
}: AuthTextInputProps) {
  // Focus is tracked locally so the field can show where the keyboard is
  // pointing. Without it, a form of identical dark boxes gives no
  // feedback at all on a phone, where there's no caret to spot.
  const [focused, setFocused] = useState(false);
  const hasError = Boolean(errorText);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.field, focused && styles.fieldFocused, hasError && styles.fieldError]}>
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={colors.textSubtle}
          // The caret is invisible against a dark field at the default
          // colour on some Android builds.
          cursorColor={colors.primary}
          selectionColor={colors.primary}
          autoCapitalize="none"
          autoCorrect={false}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
      </View>
      {hasError ? <Text style={styles.errorText}>{errorText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  label: { ...type.caption, fontWeight: '600', color: colors.textMuted, marginBottom: spacing.sm },
  // The ring lives on a wrapper rather than the TextInput itself: growing
  // a border on the input would reflow its content by a pixel on focus.
  field: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  fieldFocused: { borderColor: colors.primary, backgroundColor: colors.surfaceAlt },
  fieldError: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  input: {
    paddingVertical: spacing.md - 2,
    fontSize: 16,
    color: colors.text,
  },
  errorText: { ...type.caption, fontSize: 12, color: colors.danger, marginTop: spacing.xs },
});

// Single source of truth for colors/spacing so screens don't drift apart
// visually as we build them one at a time. Not a full design system —
// just enough consistency to avoid a mismatched-looking app by Feature 7.
import { Platform, type TextStyle, type ViewStyle } from 'react-native';

// Dark charcoal shell with a single hot accent. On a near-black ground a
// saturated orange carries the whole interface, so it's spent only on
// things the user should actually press — never on decoration.
//
// The accent is NOT green or red on purpose. Those two are load-bearing
// data colours here ("cheaper than average" vs "pricier"), and on a dark
// background they're the only strong signal the eye has; spending green
// on buttons too would blunt the one thing the app exists to say.
export const colors = {
  primary: '#FF6A1A',
  primaryDark: '#E4550B',
  // Low-alpha accent wash for selected rows and chips. White-on-dark
  // tints wash out, so selection uses the accent at low opacity instead.
  primarySoft: 'rgba(255, 106, 26, 0.14)',
  primaryBorder: 'rgba(255, 106, 26, 0.45)',

  // Three greys, deliberately close together — depth on dark comes from
  // small steps plus a hairline, not from drop shadows (which are close
  // to invisible against near-black).
  background: '#121214',
  surface: '#1D1E21',
  surfaceAlt: '#26272B',
  // Raised: the selected segment of a control, a pressed row.
  surfaceRaised: '#313238',

  text: '#FFFFFF',
  textMuted: '#9C9CA4',
  textSubtle: '#6B6B73',

  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.16)',

  // Brightened from their light-theme values: mid-tone green and red go
  // muddy against #121214 and fail contrast for small text.
  success: '#3DDC91',
  successSoft: 'rgba(61, 220, 145, 0.14)',
  danger: '#FF5D5D',
  dangerSoft: 'rgba(255, 93, 93, 0.14)',
  warning: '#FFB020',
  warningSoft: 'rgba(255, 176, 32, 0.14)',

  overlay: 'rgba(0, 0, 0, 0.6)',
  // Pure white on the orange fill clears 4.5:1; near-black does not.
  onPrimary: '#FFFFFF',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// Rounder than before across the board — the reference leans on generous
// radii, and a 12px card next to a 999px pill looks like two design
// systems sharing a screen.
export const radius = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 30,
  full: 999,
};

// A named type scale beats scattering `fontSize: 13` across 25 files:
// it keeps headings on one screen the same size as headings on another.
export const type = {
  display: { fontSize: 32, fontWeight: '700', letterSpacing: -0.8 },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  heading: { fontSize: 17, fontWeight: '600', letterSpacing: -0.2 },
  body: { fontSize: 15, fontWeight: '400' },
  bodyStrong: { fontSize: 15, fontWeight: '600' },
  // Money readouts — tabular figures stop the digits jittering when a
  // value re-renders (e.g. a live average updating under a new report).
  metric: { fontSize: 30, fontWeight: '700', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  caption: { fontSize: 13, fontWeight: '400' },
  overline: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
} satisfies Record<string, TextStyle>;

// react-native-web warns that the `shadow*` props are deprecated and
// wants boxShadow, while native still needs shadow*/elevation — so each
// level is declared per platform rather than picking one and living with
// console noise on the other.
function shadow(
  ios: { color: string; opacity: number; radius: number; height: number },
  elevation: number,
  css: string,
): ViewStyle {
  return Platform.select<ViewStyle>({
    ios: {
      shadowColor: ios.color,
      shadowOpacity: ios.opacity,
      shadowRadius: ios.radius,
      shadowOffset: { width: 0, height: ios.height },
    },
    android: { elevation },
    default: { boxShadow: css } as ViewStyle,
  }) as ViewStyle;
}

export const shadows = {
  // Black shadows do nothing on a near-black ground, so cards get depth
  // from surface steps and borders instead — see card() below.
  sm: shadow({ color: '#000000', opacity: 0.3, radius: 8, height: 3 }, 2, '0 3px 8px rgba(0,0,0,0.3)'),
  lg: shadow({ color: '#000000', opacity: 0.5, radius: 28, height: 14 }, 12, '0 14px 28px rgba(0,0,0,0.5)'),
  // The accent glow under a primary pill — the one place a coloured
  // shadow reads clearly on dark.
  accent: shadow(
    { color: '#FF6A1A', opacity: 0.45, radius: 16, height: 8 },
    8,
    '0 8px 16px rgba(255,106,26,0.45)',
  ),
};

// Every card in the app is this: raised surface + hairline + big radius.
// Spelled once so screens stop re-deriving it slightly differently.
export const card: ViewStyle = {
  backgroundColor: colors.surface,
  borderRadius: radius.lg,
  borderWidth: 1,
  borderColor: colors.border,
};

import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

const PIECE_COUNT = 48;
const DURATION_MS = 2200;

interface Piece {
  id: number;
  x: number;
  drift: number;
  size: number;
  color: string;
  spin: number;
  delay: number;
  round: boolean;
  progress: Animated.Value;
}

interface ConfettiProps {
  // Bump this to fire a burst. 0 means "nothing yet".
  burstKey: number;
}

// A one-shot confetti shower over the whole screen. Built on the core
// Animated API (native driver) rather than a library, so it needs no
// native module and works in Expo Go. Never intercepts touches, and is
// skipped entirely when the user has Reduce Motion turned on.
export default function Confetti({ burstKey }: ConfettiProps) {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    if (burstKey === 0) return;
    let cancelled = false;
    let animation: Animated.CompositeAnimation | null = null;

    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduceMotion) => {
        if (cancelled || reduceMotion) return;
        const palette = [colors.primary, colors.success, colors.warning, '#4C6EF5', '#E64980'];
        const next: Piece[] = Array.from({ length: PIECE_COUNT }, (_, i) => ({
          id: burstKey * 1000 + i,
          x: Math.random() * width,
          drift: (Math.random() - 0.5) * 160,
          size: 6 + Math.random() * 6,
          color: palette[i % palette.length],
          spin: (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 540),
          delay: Math.random() * 250,
          round: Math.random() < 0.3,
          progress: new Animated.Value(0),
        }));
        setPieces(next);
        animation = Animated.parallel(
          next.map((piece) =>
            Animated.timing(piece.progress, {
              toValue: 1,
              duration: DURATION_MS - piece.delay,
              delay: piece.delay,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            })
          )
        );
        animation.start(({ finished }) => {
          if (finished && !cancelled) setPieces([]);
        });
      });

    return () => {
      cancelled = true;
      animation?.stop();
    };
    // Only a new burst should restart the shower — not a theme change or
    // rotation mid-flight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [burstKey]);

  if (pieces.length === 0) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((piece) => (
        <Animated.View
          key={piece.id}
          style={{
            position: 'absolute',
            left: piece.x,
            top: -20,
            width: piece.size,
            height: piece.round ? piece.size : piece.size * 0.45,
            borderRadius: piece.round ? piece.size / 2 : 1,
            backgroundColor: piece.color,
            opacity: piece.progress.interpolate({
              inputRange: [0, 0.75, 1],
              outputRange: [1, 1, 0],
            }),
            transform: [
              {
                translateY: piece.progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, height * 0.85],
                }),
              },
              {
                translateX: piece.progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, piece.drift],
                }),
              },
              {
                rotate: piece.progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', `${piece.spin}deg`],
                }),
              },
            ],
          }}
        />
      ))}
    </View>
  );
}

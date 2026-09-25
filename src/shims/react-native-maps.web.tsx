// Web-only stand-in for `react-native-maps`, wired up in metro.config.js.
//
// react-native-maps is native-only: its components are built with React
// Native's codegen APIs, which react-native-web doesn't implement. Because
// MapScreen imports it at module scope, loading it on web threw during
// bundle evaluation and took down the whole app, not just the map. This
// stub keeps the rest of the app usable in a browser.
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

type StubProps = Record<string, unknown> & { children?: ReactNode; style?: unknown };

// Markers/callouts are children of the map, so on web they simply render
// nothing rather than reporting an error of their own.
export function Marker(_props: StubProps) {
  return null;
}

export function Callout(_props: StubProps) {
  return null;
}

export default function MapView({ style }: StubProps) {
  return (
    <View style={[styles.container, style as object]}>
      <Text style={styles.text}>The map is only available in the mobile app.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#eef1f4',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  text: {
    color: '#5b6672',
    fontSize: 15,
    textAlign: 'center',
  },
});

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HomeScreen from '../screens/HomeScreen';
import DashboardScreen from '../screens/DashboardScreen';
import MapScreen from '../screens/MapScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { colors, spacing } from '../constants/theme';
import * as haptics from '../utils/haptics';

export type MainTabParamList = {
  Home: undefined;
  Dashboard: undefined;
  Map: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

// Bottom tab navigator = the app's main shell once a user is signed in
// and has completed onboarding. Each tab owns its own stack navigator
// only if it later needs multi-screen flows (none do yet).
export default function MainTabNavigator() {
  // The tab bar was sitting flush against the bottom edge, so on phones
  // with a home indicator or gesture bar the labels were half swallowed
  // by it. The navigator doesn't apply the safe-area inset to a custom
  // tabBarStyle height, so it has to be added by hand — and a floor of
  // spacing.md keeps it off the edge on older hardware that reports an
  // inset of 0.
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, spacing.md);

  return (
    <Tab.Navigator
      // One tick per tab change, registered once for the whole navigator
      // rather than repeated on all four screens. tabPress fires even when
      // the tab is already focused, which is the behaviour we want: the
      // press was real, so it should feel real.
      screenListeners={{ tabPress: () => haptics.selection() }}
      screenOptions={{
        // Each screen renders its own in-content title (see HomeScreen,
        // DashboardScreen, etc.) — a native header on top of that would
        // just be a duplicate title, so it's hidden here for the whole
        // tab navigator rather than per-screen.
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: 62 + bottomInset,
          paddingTop: spacing.sm + 2,
          paddingBottom: bottomInset,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarItemStyle: { paddingVertical: 2 },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="home" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="chart-line" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="map-marker" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cog" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

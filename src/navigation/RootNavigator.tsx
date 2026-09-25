import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import AuthNavigator from './AuthNavigator';
import OnboardingScreen from '../screens/auth/OnboardingScreen';
import MainTabNavigator from './MainTabNavigator';
import { colors } from '../constants/theme';

// The top-level branch for the whole app, based purely on auth state:
//   loading        -> spinner (covers both "checking persisted session"
//                      and "user known, profile still loading")
//   no user        -> AuthNavigator (Login / Sign Up)
//   no zip code    -> OnboardingScreen
//   fully set up   -> MainTabNavigator
export default function RootNavigator() {
  const { user, userProfile, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user) {
    return <AuthNavigator />;
  }

  if (!userProfile?.zipCode) {
    return <OnboardingScreen />;
  }

  return <MainTabNavigator />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});

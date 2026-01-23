import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const { session, loading, profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log('Index: Auth state', { loading, hasSession: !!session, hasProfile: !!profile });
    if (!loading) {
      const redirect = setTimeout(() => {
        if (session && profile) {
          console.log('Index: Redirecting based on role:', profile.role);

          if (profile.role === 'admin') {
            router.replace('/(tabs)/admin-dashboard');
          } else if (profile.role === 'rider') {
            router.replace('/(tabs)/rider-home');
          } else {
            router.replace('/(tabs)/customer-home');
          }
        } else {
          console.log('Index: Redirecting to auth');
          router.replace('/auth');
        }
      }, 100);

      return () => clearTimeout(redirect);
    }
  }, [session, loading, profile]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#f97316" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
});

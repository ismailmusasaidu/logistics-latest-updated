import { View, ActivityIndicator, StyleSheet } from 'react-native';

type LoadingScreenProps = {
  color?: string;
};

export function LoadingScreen({ color = '#f97316' }: LoadingScreenProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={color} />
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

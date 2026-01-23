import { View, Text, StyleSheet } from 'react-native';

type StatusBadgeProps = {
  status: string;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: '#f59e0b',
      confirmed: '#3b82f6',
      assigned: '#8b5cf6',
      picked_up: '#6366f1',
      in_transit: '#06b6d4',
      delivered: '#f97316',
      cancelled: '#ef4444',
    };
    return colors[status] || '#6b7280';
  };

  const getStatusLabel = (status: string) => {
    return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <View style={[styles.badge, { backgroundColor: getStatusColor(status) }]}>
      <Text style={styles.text}>{getStatusLabel(status)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  text: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
});

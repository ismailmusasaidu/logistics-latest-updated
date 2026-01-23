import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Package, Users, Bike, TrendingUp, DollarSign, Activity } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

type Stats = {
  totalOrders: number;
  totalCustomers: number;
  totalRiders: number;
  activeDeliveries: number;
  totalRevenue: number;
  deliveredOrders: number;
};

export default function AdminDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalOrders: 0,
    totalCustomers: 0,
    totalRiders: 0,
    activeDeliveries: 0,
    totalRevenue: 0,
    deliveredOrders: 0,
  });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [ordersRes, customersRes, ridersRes] = await Promise.all([
        supabase.from('orders').select('*'),
        supabase.from('profiles').select('id').eq('role', 'customer'),
        supabase.from('riders').select('*'),
      ]);

      const orders = ordersRes.data || [];
      const activeDeliveries = orders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length;
      const deliveredOrders = orders.filter(o => o.status === 'delivered').length;
      const totalRevenue = orders
        .filter(o => o.status === 'delivered')
        .reduce((sum, order) => sum + parseFloat(order.delivery_fee), 0);

      setStats({
        totalOrders: orders.length,
        totalCustomers: customersRes.data?.length || 0,
        totalRiders: ridersRes.data?.length || 0,
        activeDeliveries,
        totalRevenue,
        deliveredOrders,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Admin Dashboard</Text>
          <Text style={styles.subGreeting}>Overview of all operations</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadStats(); }} />}>

        <View style={styles.statsGrid}>
          <View  style={[styles.statCard, styles.statCardPrimary]}>
            <View style={styles.statIconContainer}>
              <Package size={28} color="#f97316" />
            </View>
            <Text style={styles.statNumber}>{stats.totalOrders}</Text>
            <Text style={styles.statLabel}>Total Orders</Text>
          </View>

          <View  style={[styles.statCard, styles.statCardSuccess]}>
            <View style={styles.statIconContainer}>
              <TrendingUp size={28} color="#fb923c" />
            </View>
            <Text style={styles.statNumber}>{stats.activeDeliveries}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>

          <View  style={[styles.statCard, styles.statCardWarning]}>
            <View style={styles.statIconContainer}>
              <DollarSign size={28} color="#f59e0b" />
            </View>
            <Text style={styles.statNumber}>₦{stats.totalRevenue.toFixed(0)}</Text>
            <Text style={styles.statLabel}>Revenue</Text>
          </View>

          <View  style={[styles.statCard, styles.statCardInfo]}>
            <View style={styles.statIconContainer}>
              <Activity size={28} color="#ea580c" />
            </View>
            <Text style={styles.statNumber}>{stats.deliveredOrders}</Text>
            <Text style={styles.statLabel}>Delivered</Text>
          </View>
        </View>

        <View  style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Stats</Text>

          <View style={styles.quickStatsCard}>
            <View style={styles.quickStatRow}>
              <View style={styles.quickStatIcon}>
                <Users size={24} color="#f97316" />
              </View>
              <View style={styles.quickStatContent}>
                <Text style={styles.quickStatLabel}>Total Customers</Text>
                <Text style={styles.quickStatValue}>{stats.totalCustomers}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.quickStatRow}>
              <View style={styles.quickStatIcon}>
                <Bike size={24} color="#fb923c" />
              </View>
              <View style={styles.quickStatContent}>
                <Text style={styles.quickStatLabel}>Total Riders</Text>
                <Text style={styles.quickStatValue}>{stats.totalRiders}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.quickStatRow}>
              <View style={styles.quickStatIcon}>
                <TrendingUp size={24} color="#ea580c" />
              </View>
              <View style={styles.quickStatContent}>
                <Text style={styles.quickStatLabel}>Completion Rate</Text>
                <Text style={styles.quickStatValue}>
                  {stats.totalOrders > 0 ? ((stats.deliveredOrders / stats.totalOrders) * 100).toFixed(1) : 0}%
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View  style={styles.section}>
          <Text style={styles.sectionTitle}>Performance Metrics</Text>

          <View style={styles.metricsCard}>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Average Delivery Fee</Text>
              <Text style={styles.metricValue}>
                ₦{stats.deliveredOrders > 0 ? (stats.totalRevenue / stats.deliveredOrders).toFixed(2) : '0.00'}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Orders Per Rider</Text>
              <Text style={styles.metricValue}>
                {stats.totalRiders > 0 ? (stats.totalOrders / stats.totalRiders).toFixed(1) : '0'}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Active Orders Ratio</Text>
              <Text style={styles.metricValue}>
                {stats.totalOrders > 0 ? ((stats.activeDeliveries / stats.totalOrders) * 100).toFixed(1) : 0}%
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingTop: 60,
    backgroundColor: '#ffffff',
    borderBottomWidth: 3,
    borderBottomColor: '#f97316',
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f97316',
  },
  subGreeting: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statCardPrimary: {
    borderLeftWidth: 4,
    borderLeftColor: '#f97316',
  },
  statCardSuccess: {
    borderLeftWidth: 4,
    borderLeftColor: '#fb923c',
  },
  statCardWarning: {
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  statCardInfo: {
    borderLeftWidth: 4,
    borderLeftColor: '#ea580c',
  },
  statIconContainer: {
    marginBottom: 12,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: '800',
    color: '#f97316',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f97316',
    marginBottom: 16,
  },
  quickStatsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  quickStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  quickStatIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  quickStatContent: {
    flex: 1,
  },
  quickStatLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600',
    marginBottom: 4,
  },
  quickStatValue: {
    fontSize: 20,
    color: '#f97316',
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
  },
  metricsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  metricLabel: {
    fontSize: 15,
    color: '#6b7280',
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 18,
    color: '#f97316',
    fontWeight: '700',
  },
});

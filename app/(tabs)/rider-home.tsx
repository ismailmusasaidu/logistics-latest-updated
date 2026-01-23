import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Platform, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bike, MapPin, Package, CheckCircle, Navigation, AlertCircle, X, MessageSquare, Clock, ChevronDown, ChevronUp, User, Layers, Phone, Search, Tag } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, Order, Rider, OrderTracking } from '@/lib/supabase';
import { getUserFriendlyError } from '@/lib/errorHandler';
import { Fonts } from '@/constants/fonts';

// Utility function to format relative time
const formatRelativeTime = (timestamp: string | null): string => {
  if (!timestamp) return 'Not yet';

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
};

// Utility function to format timestamp
const formatTimestamp = (timestamp: string | null): string => {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

export default function RiderHome() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [riderData, setRiderData] = useState<Rider | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [complaintModalVisible, setComplaintModalVisible] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [complaintType, setComplaintType] = useState<string>('customer_issue');
  const [complaintDescription, setComplaintDescription] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [orderTracking, setOrderTracking] = useState<Record<string, OrderTracking[]>>({});
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [updateAllBulk, setUpdateAllBulk] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (profile?.id) {
      loadRiderData();
    }
  }, [profile?.id]);

  useEffect(() => {
    if (riderData?.id) {
      loadOrders();

      const ordersSubscription = supabase
        .channel('rider-orders')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `rider_id=eq.${riderData.id}`,
          },
          () => {
            loadOrders();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `assigned_rider_id=eq.${riderData.id}`,
          },
          () => {
            loadOrders();
          }
        )
        .subscribe();

      const trackingSubscription = supabase
        .channel('order-tracking-updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'order_tracking',
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              const newTracking = payload.new as OrderTracking;
              setOrderTracking(prev => ({
                ...prev,
                [newTracking.order_id]: [
                  ...(prev[newTracking.order_id] || []),
                  newTracking
                ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              }));
            }
          }
        )
        .subscribe();

      return () => {
        ordersSubscription.unsubscribe();
        trackingSubscription.unsubscribe();
      };
    }
  }, [riderData?.id]);

  const loadRiderData = async () => {
    try {
      setError(null);
      const { data, error } = await supabase
        .from('riders')
        .select('*')
        .eq('user_id', profile?.id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setError('Rider profile not found. Please contact admin.');
      } else {
        setRiderData(data);

        if (data.approval_status === 'rejected') {
          setError(`Your rider application was rejected. Reason: ${data.rejection_reason || 'No reason provided.'}`);
        }
      }
    } catch (error: any) {
      console.error('Error loading rider data:', error);
      setError(getUserFriendlyError(error));
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async () => {
    try {
      let riderId = riderData?.id;

      if (!riderId) {
        const { data: rData } = await supabase
          .from('riders')
          .select('id')
          .eq('user_id', profile?.id)
          .maybeSingle();

        if (rData) {
          riderId = rData.id;
        }
      }

      if (riderId) {
        const { data, error } = await supabase
          .from('orders')
          .select(`
            *,
            customer:profiles!orders_customer_id_fkey(id, full_name, email, phone),
            bulk_order:bulk_orders(
              id,
              bulk_order_number,
              total_orders,
              discount_percentage,
              status
            ),
            order_complaints(
              id,
              complaint_type,
              description,
              status,
              created_at
            )
          `)
          .or(`rider_id.eq.${riderId},assigned_rider_id.eq.${riderId}`)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setOrders(data || []);

        if (data && data.length > 0) {
          const orderIds = data.map(o => o.id);
          const { data: trackingData } = await supabase
            .from('order_tracking')
            .select('*')
            .in('order_id', orderIds)
            .order('created_at', { ascending: false });

          if (trackingData) {
            const trackingByOrder: Record<string, OrderTracking[]> = {};
            trackingData.forEach((tracking) => {
              if (!trackingByOrder[tracking.order_id]) {
                trackingByOrder[tracking.order_id] = [];
              }
              trackingByOrder[tracking.order_id].push(tracking);
            });
            setOrderTracking(trackingByOrder);
          }
        }
      }
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAcceptOrder = async (orderId: string) => {
    try {
      setError(null);

      const { error } = await supabase
        .from('orders')
        .update({
          assignment_status: 'accepted',
          status: 'assigned',
          rider_id: riderData?.id,
        })
        .eq('id', orderId);

      if (error) throw error;

      const { error: trackingError } = await supabase.from('order_tracking').insert({
        order_id: orderId,
        status: 'assigned',
        notes: 'Order accepted by rider',
      });

      if (trackingError) {
        console.error('Tracking insert error:', trackingError);
      }

      loadOrders();
    } catch (error: any) {
      console.error('Error accepting order:', error);
      setError(getUserFriendlyError(error));
    }
  };

  const handleRejectOrder = async (orderId: string) => {
    try {
      setError(null);

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

      const response = await fetch(`${supabaseUrl}/functions/v1/reassign-rider`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ order_id: orderId, reason: 'Rider rejected' }),
      });

      const result = await response.json();

      if (!result.success) {
        console.log('Reassignment result:', result.message);
      }

      loadOrders();
    } catch (error: any) {
      console.error('Error rejecting order:', error);
      setError(getUserFriendlyError(error));
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string, note?: string) => {
    try {
      setError(null);

      const order = orders.find(o => o.id === orderId);
      const bulkOrderId = (order as any)?.bulk_order_id;

      if (updateAllBulk && bulkOrderId) {
        const bulkOrders = orders.filter(o => (o as any).bulk_order_id === bulkOrderId);

        for (const bulkOrder of bulkOrders) {
          const { error: orderError } = await supabase
            .from('orders')
            .update({
              status: newStatus,
              ...(newStatus === 'delivered' ? { delivered_at: new Date().toISOString() } : {})
            })
            .eq('id', bulkOrder.id);

          if (orderError) throw orderError;

          const { error: trackingError } = await supabase.from('order_tracking').insert({
            order_id: bulkOrder.id,
            status: newStatus,
            notes: note || `Order ${newStatus.replace('_', ' ')}`,
          });

          if (trackingError) {
            console.error('Tracking insert error:', trackingError);
            throw trackingError;
          }
        }
      } else {
        const { error: orderError } = await supabase
          .from('orders')
          .update({
            status: newStatus,
            ...(newStatus === 'delivered' ? { delivered_at: new Date().toISOString() } : {})
          })
          .eq('id', orderId);

        if (orderError) throw orderError;

        const { error: trackingError } = await supabase.from('order_tracking').insert({
          order_id: orderId,
          status: newStatus,
          notes: note || `Order ${newStatus.replace('_', ' ')}`,
        });

        if (trackingError) {
          console.error('Tracking insert error:', trackingError);
          throw trackingError;
        }
      }

      loadOrders();
      setStatusModalVisible(false);
      setStatusNote('');
      setUpdateAllBulk(false);
    } catch (error: any) {
      console.error('Error updating order:', error);
      setError(getUserFriendlyError(error));
    }
  };

  const openStatusModal = (order: Order) => {
    setSelectedOrder(order);
    setStatusNote('');
    setStatusModalVisible(true);
  };

  const openComplaintModal = (order: Order) => {
    setSelectedOrder(order);
    setComplaintType('customer_issue');
    setComplaintDescription('');
    setComplaintModalVisible(true);
  };

  const submitComplaint = async () => {
    if (!selectedOrder || !riderData || !complaintDescription.trim()) {
      setError('Please provide a complaint description');
      return;
    }

    try {
      setError(null);
      const { error } = await supabase.from('order_complaints').insert({
        order_id: selectedOrder.id,
        rider_id: riderData.id,
        complaint_type: complaintType,
        description: complaintDescription.trim(),
      });

      if (error) throw error;

      setComplaintModalVisible(false);
      setComplaintDescription('');
      if (Platform.OS === 'web') {
        alert('Complaint submitted successfully');
      }
    } catch (error: any) {
      console.error('Error submitting complaint:', error);
      setError(getUserFriendlyError(error));
    }
  };

  const toggleStatus = async () => {
    if (!riderData) {
      setError('Rider data not loaded. Please refresh the page.');
      return;
    }

    const newStatus = riderData.status === 'online' ? 'offline' : 'online';
    try {
      setError(null);
      const { error } = await supabase
        .from('riders')
        .update({ status: newStatus })
        .eq('id', riderData.id);

      if (error) throw error;
      setRiderData({ ...riderData, status: newStatus });
    } catch (error: any) {
      console.error('Error toggling status:', error);
      setError(getUserFriendlyError(error));
    }
  };

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

  const getNextAction = (status: string) => {
    const actions: Record<string, string> = {
      confirmed: 'assigned',
      assigned: 'picked_up',
      picked_up: 'in_transit',
      in_transit: 'delivered',
    };
    return actions[status];
  };

  const toggleOrderExpanded = (orderId: string) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const formatTrackingTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  const activeOrders = orders.filter(o => !['delivered', 'cancelled'].includes(o.status));
  const completedOrders = orders.filter(o => ['delivered', 'cancelled'].includes(o.status));

  const filteredCompletedOrders = completedOrders.filter(order => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    const customerName = (order as any).customer?.full_name?.toLowerCase() || '';
    const orderNumber = order.order_number.toLowerCase();
    const pickupAddress = order.pickup_address.toLowerCase();
    const deliveryAddress = order.delivery_address.toLowerCase();
    const packageDesc = order.package_description.toLowerCase();

    return (
      orderNumber.includes(query) ||
      customerName.includes(query) ||
      pickupAddress.includes(query) ||
      deliveryAddress.includes(query) ||
      packageDesc.includes(query)
    );
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {profile?.full_name}</Text>
          <Text style={styles.subGreeting}>Manage your deliveries</Text>
        </View>
        <TouchableOpacity
          style={[styles.statusButton, riderData?.status === 'online' && styles.statusButtonActive]}
          onPress={toggleStatus}>
          <Text style={[styles.statusText, riderData?.status === 'online' && styles.statusTextActive]}>
            {riderData?.status === 'online' ? 'Online' : 'Offline'}
          </Text>
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => setError(null)}>
            <Text style={styles.errorDismiss}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}

      {riderData?.approval_status === 'pending' ? (
        <View style={styles.pendingContainer}>
          <Clock size={64} color="#f59e0b" />
          <Text style={styles.pendingTitle}>Application Under Review</Text>
          <Text style={styles.pendingText}>
            Your rider application is currently being reviewed by our admin team. You will be notified once your application is approved.
          </Text>
          <View style={styles.pendingInfo}>
            <Text style={styles.pendingInfoLabel}>What happens next?</Text>
            <Text style={styles.pendingInfoText}>• Admin will review your documents</Text>
            <Text style={styles.pendingInfoText}>• Verification typically takes 24-48 hours</Text>
            <Text style={styles.pendingInfoText}>• You'll receive an email notification</Text>
          </View>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadRiderData(); loadOrders(); }} />}>

          <View style={styles.statsContainer}>
          <View  style={styles.statCard}>
            <Bike size={28} color="#3b82f6" />
            <Text style={styles.statNumber}>{riderData?.total_deliveries || 0}</Text>
            <Text style={styles.statLabel}>Total Deliveries</Text>
          </View>
          <View  style={styles.statCard}>
            <Package size={28} color="#f59e0b" />
            <Text style={styles.statNumber}>{activeOrders.length}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View  style={styles.statCard}>
            <CheckCircle size={28} color="#f97316" />
            <Text style={styles.statNumber}>{riderData?.rating?.toFixed(1) || '5.0'}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'active' && styles.tabActive]}
            onPress={() => setActiveTab('active')}>
            <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>
              Active ({activeOrders.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'history' && styles.tabActive]}
            onPress={() => setActiveTab('history')}>
            <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
              History ({completedOrders.length})
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'active' && (
          <>
            <Text style={styles.sectionTitle}>Active Deliveries</Text>

            {activeOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <Bike size={64} color="#d1d5db" />
            <Text style={styles.emptyText}>No active deliveries</Text>
            <Text style={styles.emptySubtext}>You'll see assigned deliveries here</Text>
          </View>
        ) : (
          activeOrders.map((order, index) => (
            <View key={order.id} >
              <View style={styles.orderCard}>
                <View style={styles.orderHeader}>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
                    <Text style={styles.statusText}>{getStatusLabel(order.status)}</Text>
                  </View>
                  <Text style={styles.orderNumber}>{order.order_number}</Text>
                </View>

                {(order as any).bulk_order && (
                  <View style={styles.bulkBadge}>
                    <Layers size={14} color="#8b5cf6" />
                    <Text style={styles.bulkBadgeText}>
                      BULK ORDER ({(order as any).bulk_order.total_orders} items)
                    </Text>
                  </View>
                )}

                {(order as any).customer && (
                  <View style={styles.customerInfo}>
                    <User size={16} color="#6b7280" />
                    <View style={styles.customerDetails}>
                      <Text style={styles.customerName}>{(order as any).customer.full_name || 'Unknown'}</Text>
                      <Text style={styles.customerContact}>
                        {(order as any).customer.phone || (order as any).customer.email || 'No contact'}
                      </Text>
                    </View>
                  </View>
                )}

                <View style={styles.orderDetails}>
                  <View style={styles.addressRow}>
                    <MapPin size={20} color="#f97316" />
                    <View style={styles.addressInfo}>
                      <Text style={styles.addressLabel}>Pickup</Text>
                      <Text style={styles.addressText}>{order.pickup_address}</Text>
                    </View>
                  </View>

                  <View style={styles.addressRow}>
                    <MapPin size={20} color="#ef4444" />
                    <View style={styles.addressInfo}>
                      <Text style={styles.addressLabel}>Delivery Address</Text>
                      <Text style={styles.addressText}>{order.delivery_address}</Text>
                      {order.recipient_name && (
                        <View style={styles.recipientInfo}>
                          <User size={14} color="#f97316" />
                          <Text style={styles.recipientName}>Recipient: {order.recipient_name}</Text>
                        </View>
                      )}
                      {order.recipient_phone && (
                        <View style={styles.recipientInfo}>
                          <Phone size={14} color="#f97316" />
                          <Text style={styles.phoneText}>Phone: {order.recipient_phone}</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {order.order_size && (
                    <View style={styles.addressRow}>
                      <Package size={20} color="#3b82f6" />
                      <View style={styles.addressInfo}>
                        <Text style={styles.addressLabel}>Order Size</Text>
                        <Text style={styles.addressText}>{order.order_size.charAt(0).toUpperCase() + order.order_size.slice(1)}</Text>
                      </View>
                    </View>
                  )}

                  {order.order_types && order.order_types.length > 0 && (
                    <View style={styles.addressRow}>
                      <Tag size={20} color="#10b981" />
                      <View style={styles.addressInfo}>
                        <Text style={styles.addressLabel}>Order Types</Text>
                        <Text style={styles.addressText}>{order.order_types.join(', ')}</Text>
                      </View>
                    </View>
                  )}

                  <View style={styles.packageInfo}>
                    <Package size={16} color="#6b7280" />
                    <Text style={styles.packageText}>{order.package_description}</Text>
                  </View>

                  {order.pickup_instructions && (
                    <View style={styles.notesSection}>
                      <MessageSquare size={16} color="#f97316" />
                      <View style={styles.notesContent}>
                        <Text style={[styles.notesLabel, { color: '#f97316' }]}>Pickup Instructions:</Text>
                        <Text style={styles.notesText}>{order.pickup_instructions}</Text>
                      </View>
                    </View>
                  )}

                  {order.delivery_instructions && (
                    <View style={styles.notesSection}>
                      <MessageSquare size={16} color="#8b5cf6" />
                      <View style={styles.notesContent}>
                        <Text style={styles.notesLabel}>Delivery Instructions:</Text>
                        <Text style={styles.notesText}>{order.delivery_instructions}</Text>
                      </View>
                    </View>
                  )}

                  <View style={styles.timelineContainer}>
                    <Text style={styles.timelineTitle}>Order Timeline</Text>
                    {order.scheduled_delivery_time && (
                      <View style={styles.scheduledDeliveryBanner}>
                        <Clock size={16} color="#8b5cf6" />
                        <View style={styles.scheduledDeliveryInfo}>
                          <Text style={styles.scheduledDeliveryLabel}>Scheduled Delivery</Text>
                          <Text style={styles.scheduledDeliveryTime}>
                            {new Date(order.scheduled_delivery_time).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true
                            })}
                          </Text>
                        </View>
                      </View>
                    )}
                    <View style={styles.timelineItem}>
                      <View style={[styles.timelineDot, { backgroundColor: '#10b981' }]} />
                      <View style={styles.timelineContent}>
                        <Text style={styles.timelineLabel}>Created</Text>
                        <Text style={styles.timelineTime}>{formatRelativeTime(order.created_at)}</Text>
                      </View>
                    </View>
                    {order.confirmed_at && (
                      <View style={styles.timelineItem}>
                        <View style={[styles.timelineDot, { backgroundColor: '#3b82f6' }]} />
                        <View style={styles.timelineContent}>
                          <Text style={styles.timelineLabel}>Confirmed</Text>
                          <Text style={styles.timelineTime}>{formatRelativeTime(order.confirmed_at)}</Text>
                        </View>
                      </View>
                    )}
                    {order.assigned_at && (
                      <View style={styles.timelineItem}>
                        <View style={[styles.timelineDot, { backgroundColor: '#8b5cf6' }]} />
                        <View style={styles.timelineContent}>
                          <Text style={styles.timelineLabel}>Assigned to You</Text>
                          <Text style={styles.timelineTime}>{formatRelativeTime(order.assigned_at)}</Text>
                        </View>
                      </View>
                    )}
                    {order.picked_up_at && (
                      <View style={styles.timelineItem}>
                        <View style={[styles.timelineDot, { backgroundColor: '#f59e0b' }]} />
                        <View style={styles.timelineContent}>
                          <Text style={styles.timelineLabel}>Picked Up</Text>
                          <Text style={styles.timelineTime}>{formatRelativeTime(order.picked_up_at)}</Text>
                        </View>
                      </View>
                    )}
                    {order.in_transit_at && (
                      <View style={styles.timelineItem}>
                        <View style={[styles.timelineDot, { backgroundColor: '#f97316' }]} />
                        <View style={styles.timelineContent}>
                          <Text style={styles.timelineLabel}>In Transit</Text>
                          <Text style={styles.timelineTime}>{formatRelativeTime(order.in_transit_at)}</Text>
                        </View>
                      </View>
                    )}
                    {order.delivered_at && (
                      <View style={styles.timelineItem}>
                        <View style={[styles.timelineDot, { backgroundColor: '#22c55e' }]} />
                        <View style={styles.timelineContent}>
                          <Text style={styles.timelineLabel}>Delivered</Text>
                          <Text style={styles.timelineTime}>{formatRelativeTime(order.delivered_at)}</Text>
                        </View>
                      </View>
                    )}
                    {order.cancelled_at && (
                      <View style={styles.timelineItem}>
                        <View style={[styles.timelineDot, { backgroundColor: '#ef4444' }]} />
                        <View style={styles.timelineContent}>
                          <Text style={styles.timelineLabel}>Cancelled</Text>
                          <Text style={styles.timelineTime}>{formatRelativeTime(order.cancelled_at)}</Text>
                        </View>
                      </View>
                    )}
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.trackingToggle}
                  onPress={() => toggleOrderExpanded(order.id)}>
                  <Clock size={16} color="#6b7280" />
                  <Text style={styles.trackingToggleText}>
                    Tracking History ({orderTracking[order.id]?.length || 0})
                  </Text>
                  {expandedOrders.has(order.id) ? (
                    <ChevronUp size={16} color="#6b7280" />
                  ) : (
                    <ChevronDown size={16} color="#6b7280" />
                  )}
                </TouchableOpacity>

                {expandedOrders.has(order.id) && orderTracking[order.id] && (
                  <View style={styles.trackingTimeline}>
                    {orderTracking[order.id].map((tracking, idx) => (
                      <View key={tracking.id} style={styles.trackingItem}>
                        <View style={styles.trackingDot} />
                        {idx < orderTracking[order.id].length - 1 && (
                          <View style={styles.trackingLine} />
                        )}
                        <View style={styles.trackingContent}>
                          <View style={styles.trackingHeader}>
                            <Text style={styles.trackingStatus}>
                              {getStatusLabel(tracking.status)}
                            </Text>
                            <Text style={styles.trackingTime}>
                              {formatTrackingTime(tracking.created_at)}
                            </Text>
                          </View>
                          {tracking.notes && (
                            <Text style={styles.trackingNotes}>{tracking.notes}</Text>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {(order as any).order_complaints && (order as any).order_complaints.length > 0 && (
                  <View style={styles.complaintsSection}>
                    <Text style={styles.complaintsSectionTitle}>Your Reports</Text>
                    {(order as any).order_complaints.map((complaint: any) => (
                      <View key={complaint.id} style={styles.complaintCard}>
                        <View style={styles.complaintHeader}>
                          <View style={[
                            styles.complaintStatusBadge,
                            { backgroundColor: complaint.status === 'open' ? '#fef3c7' : complaint.status === 'resolved' ? '#d1fae5' : '#fee2e2' }
                          ]}>
                            <Text style={[
                              styles.complaintStatusText,
                              { color: complaint.status === 'open' ? '#f59e0b' : complaint.status === 'resolved' ? '#10b981' : '#ef4444' }
                            ]}>
                              {complaint.status.toUpperCase()}
                            </Text>
                          </View>
                          <Text style={styles.complaintTime}>
                            {formatRelativeTime(complaint.created_at)}
                          </Text>
                        </View>
                        <Text style={styles.complaintType}>
                          {complaint.complaint_type.replace(/_/g, ' ').toUpperCase()}
                        </Text>
                        <Text style={styles.complaintDescription}>{complaint.description}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.orderActions}>
                  {(order as any).assignment_status === 'assigned' && (order as any).assigned_rider_id === riderData?.id ? (
                    <>
                      <View style={styles.assignmentBanner}>
                        <AlertCircle size={20} color="#f97316" />
                        <Text style={styles.assignmentBannerText}>
                          New order assigned! Accept or reject within 30 seconds.
                        </Text>
                      </View>
                      <View style={styles.assignmentActions}>
                        <TouchableOpacity
                          style={styles.acceptButton}
                          onPress={() => handleAcceptOrder(order.id)}>
                          <CheckCircle size={20} color="#ffffff" />
                          <Text style={styles.acceptButtonText}>Accept Order</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.rejectButton}
                          onPress={() => handleRejectOrder(order.id)}>
                          <X size={20} color="#ef4444" />
                          <Text style={styles.rejectButtonText}>Reject</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (
                    <>
                      {getNextAction(order.status) && (
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => openStatusModal(order)}>
                          <Navigation size={20} color="#ffffff" />
                          <Text style={styles.actionButtonText}>
                            Mark as {getStatusLabel(getNextAction(order.status))}
                          </Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles.complaintButton}
                        onPress={() => openComplaintModal(order)}>
                        <AlertCircle size={18} color="#ef4444" />
                        <Text style={styles.complaintButtonText}>Report Issue</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            </View>
          ))
        )}
          </>
        )}

        {activeTab === 'history' && (
          <>
            <Text style={styles.sectionTitle}>Order History</Text>

            <View style={styles.searchContainer}>
              <Search size={20} color="#6b7280" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by order number, customer, address..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor="#9ca3af"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <X size={20} color="#6b7280" />
                </TouchableOpacity>
              )}
            </View>

            {searchQuery.trim() && (
              <Text style={styles.searchResults}>
                {filteredCompletedOrders.length} {filteredCompletedOrders.length === 1 ? 'order' : 'orders'} found
              </Text>
            )}

            {completedOrders.length === 0 ? (
              <View style={styles.emptyState}>
                <CheckCircle size={64} color="#d1d5db" />
                <Text style={styles.emptyText}>No completed deliveries</Text>
                <Text style={styles.emptySubtext}>Your delivery history will appear here</Text>
              </View>
            ) : (
              <>
                <View style={styles.earningsSummary}>
                  <View style={styles.earningsCard}>
                    <Text style={styles.earningsLabel}>Total Earnings</Text>
                    <Text style={styles.earningsAmount}>
                      ₦{filteredCompletedOrders
                        .filter(o => o.status === 'delivered')
                        .reduce((sum, o) => sum + o.delivery_fee, 0)
                        .toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.earningsCard}>
                    <Text style={styles.earningsLabel}>Delivered Orders</Text>
                    <Text style={styles.earningsAmount}>
                      {filteredCompletedOrders.filter(o => o.status === 'delivered').length}
                    </Text>
                  </View>
                </View>

                {filteredCompletedOrders.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Search size={64} color="#d1d5db" />
                    <Text style={styles.emptyText}>No orders found</Text>
                    <Text style={styles.emptySubtext}>Try adjusting your search query</Text>
                  </View>
                ) : (
                  filteredCompletedOrders.map((order) => (
                  <View key={order.id} style={styles.historyCard}>
                    <View style={styles.historyHeader}>
                      <View>
                        <Text style={styles.historyOrderNumber}>{order.order_number}</Text>
                        <Text style={styles.historyDate}>
                          {order.delivered_at
                            ? new Date(order.delivered_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit'
                              })
                            : new Date(order.updated_at).toLocaleDateString()
                          }
                        </Text>
                      </View>
                      <View style={styles.historyFeeContainer}>
                        <Text style={styles.historyFeeLabel}>Earned</Text>
                        <Text style={styles.historyFee}>₦{order.delivery_fee.toFixed(2)}</Text>
                      </View>
                    </View>

                    {(order as any).customer && (
                      <View style={styles.historyCustomer}>
                        <User size={14} color="#6b7280" />
                        <Text style={styles.historyCustomerName}>
                          {(order as any).customer.full_name || 'Unknown Customer'}
                        </Text>
                      </View>
                    )}

                    <View style={styles.historyAddresses}>
                      <View style={styles.historyAddressRow}>
                        <MapPin size={14} color="#f97316" />
                        <Text style={styles.historyAddressText} numberOfLines={1}>
                          {order.pickup_address}
                        </Text>
                      </View>
                      <View style={styles.historyAddressRow}>
                        <MapPin size={14} color="#ef4444" />
                        <Text style={styles.historyAddressText} numberOfLines={1}>
                          {order.delivery_address}
                        </Text>
                      </View>
                      {order.scheduled_delivery_time && (
                        <View style={styles.historyAddressRow}>
                          <Clock size={14} color="#8b5cf6" />
                          <Text style={styles.historyAddressText} numberOfLines={1}>
                            Scheduled: {new Date(order.scheduled_delivery_time).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit'
                            })}
                          </Text>
                        </View>
                      )}
                      {order.order_size && (
                        <View style={styles.historyAddressRow}>
                          <Package size={14} color="#3b82f6" />
                          <Text style={styles.historyAddressText} numberOfLines={1}>
                            Size: {order.order_size.charAt(0).toUpperCase() + order.order_size.slice(1)}
                          </Text>
                        </View>
                      )}
                      {order.order_types && order.order_types.length > 0 && (
                        <View style={styles.historyAddressRow}>
                          <Tag size={14} color="#10b981" />
                          <Text style={styles.historyAddressText} numberOfLines={1}>
                            Types: {order.order_types.join(', ')}
                          </Text>
                        </View>
                      )}
                    </View>

                    {(order as any).order_complaints && (order as any).order_complaints.length > 0 && (
                      <View style={[styles.complaintsSection, { marginTop: 12 }]}>
                        <Text style={styles.complaintsSectionTitle}>Your Reports</Text>
                        {(order as any).order_complaints.map((complaint: any) => (
                          <View key={complaint.id} style={styles.complaintCard}>
                            <View style={styles.complaintHeader}>
                              <View style={[
                                styles.complaintStatusBadge,
                                { backgroundColor: complaint.status === 'open' ? '#fef3c7' : complaint.status === 'resolved' ? '#d1fae5' : '#fee2e2' }
                              ]}>
                                <Text style={[
                                  styles.complaintStatusText,
                                  { color: complaint.status === 'open' ? '#f59e0b' : complaint.status === 'resolved' ? '#10b981' : '#ef4444' }
                                ]}>
                                  {complaint.status.toUpperCase()}
                                </Text>
                              </View>
                              <Text style={styles.complaintTime}>
                                {formatRelativeTime(complaint.created_at)}
                              </Text>
                            </View>
                            <Text style={styles.complaintType}>
                              {complaint.complaint_type.replace(/_/g, ' ').toUpperCase()}
                            </Text>
                            <Text style={styles.complaintDescription}>{complaint.description}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    <View style={styles.historyFooter}>
                      <View style={styles.historyPackageInfo}>
                        <Package size={14} color="#6b7280" />
                        <Text style={styles.historyPackageText} numberOfLines={1}>
                          {order.package_description}
                        </Text>
                      </View>
                      <View style={[styles.historyStatusBadge, {
                        backgroundColor: order.status === 'delivered' ? '#d1fae5' : '#fee2e2'
                      }]}>
                        <Text style={[styles.historyStatusText, {
                          color: order.status === 'delivered' ? '#065f46' : '#991b1b'
                        }]}>
                          {order.status === 'delivered' ? 'Delivered' : 'Cancelled'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  ))
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
      )}

      <Modal
        visible={statusModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setStatusModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Order Status</Text>
              <TouchableOpacity onPress={() => setStatusModalVisible(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalSubtitle}>
                Order: {selectedOrder?.order_number}
              </Text>
              <Text style={styles.modalInfo}>
                Status will be updated to: {selectedOrder && getStatusLabel(getNextAction(selectedOrder.status))}
              </Text>

              {(selectedOrder as any)?.bulk_order && (
                <TouchableOpacity
                  style={styles.bulkUpdateOption}
                  onPress={() => setUpdateAllBulk(!updateAllBulk)}>
                  <View style={[styles.checkbox, updateAllBulk && styles.checkboxChecked]}>
                    {updateAllBulk && <CheckCircle size={18} color="#f97316" />}
                  </View>
                  <View style={styles.bulkUpdateText}>
                    <Text style={styles.bulkUpdateLabel}>
                      Update all orders in this bulk delivery
                    </Text>
                    <Text style={styles.bulkUpdateSubtext}>
                      {orders.filter(o => (o as any).bulk_order_id === (selectedOrder as any)?.bulk_order_id).length} orders will be updated
                    </Text>
                  </View>
                </TouchableOpacity>
              )}

              <Text style={styles.label}>Add Note (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={statusNote}
                onChangeText={setStatusNote}
                placeholder="Add any notes about this status update"
                multiline
                numberOfLines={4}
              />
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setStatusModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={() => selectedOrder && updateOrderStatus(selectedOrder.id, getNextAction(selectedOrder.status), statusNote)}>
                <Text style={styles.confirmButtonText}>Update Status</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={complaintModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setComplaintModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report Issue</Text>
              <TouchableOpacity onPress={() => setComplaintModalVisible(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalSubtitle}>
                Order: {selectedOrder?.order_number}
              </Text>

              <Text style={styles.label}>Issue Type</Text>
              <View style={styles.complaintTypes}>
                {[
                  { value: 'customer_issue', label: 'Customer Issue' },
                  { value: 'address_problem', label: 'Address Problem' },
                  { value: 'package_issue', label: 'Package Issue' },
                  { value: 'payment_issue', label: 'Payment Issue' },
                  { value: 'other', label: 'Other' },
                ].map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.complaintTypeButton,
                      complaintType === type.value && styles.complaintTypeButtonActive
                    ]}
                    onPress={() => setComplaintType(type.value)}>
                    <Text style={[
                      styles.complaintTypeText,
                      complaintType === type.value && styles.complaintTypeTextActive
                    ]}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={complaintDescription}
                onChangeText={setComplaintDescription}
                placeholder="Describe the issue in detail"
                multiline
                numberOfLines={6}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setComplaintModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitButton}
                onPress={submitComplaint}>
                <Text style={styles.submitButtonText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  errorContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#991b1b',
    fontFamily: Fonts.semiBold,
  },
  errorDismiss: {
    fontSize: 14,
    color: '#ef4444',
    fontFamily: Fonts.bold,
    marginLeft: 12,
  },
  greeting: {
    fontSize: 24,
    fontFamily: Fonts.bold,
    color: '#111827',
  },
  subGreeting: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#6b7280',
    marginTop: 4,
  },
  statusButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  statusButtonActive: {
    backgroundColor: '#dbeafe',
    borderColor: '#3b82f6',
  },
  statusText: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: '#6b7280',
  },
  statusTextActive: {
    color: '#3b82f6',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
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
  statNumber: {
    fontSize: 24,
    fontFamily: Fonts.extraBold,
    color: '#111827',
    marginVertical: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontFamily: Fonts.semiBold,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: '#111827',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontFamily: Fonts.semiBold,
    color: '#6b7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#9ca3af',
    marginTop: 4,
  },
  orderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  orderNumber: {
    fontSize: 12,
    color: '#6b7280',
    fontFamily: Fonts.semiBold,
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginTop: 12,
  },
  customerDetails: {
    flex: 1,
  },
  customerName: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#111827',
  },
  customerContact: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#6b7280',
    marginTop: 2,
  },
  orderDetails: {
    gap: 12,
  },
  addressRow: {
    flexDirection: 'row',
    gap: 12,
  },
  addressInfo: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontFamily: Fonts.semiBold,
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#111827',
    marginBottom: 2,
  },
  recipientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  recipientName: {
    fontSize: 13,
    color: '#111827',
    fontFamily: Fonts.semiBold,
  },
  phoneText: {
    fontSize: 13,
    color: '#111827',
    fontFamily: Fonts.semiBold,
  },
  packageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  packageText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#6b7280',
    flex: 1,
  },
  notesSection: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    backgroundColor: '#faf5ff',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  notesContent: {
    flex: 1,
  },
  notesLabel: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: '#8b5cf6',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#6b7280',
    lineHeight: 20,
  },
  orderActions: {
    gap: 8,
    marginTop: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: Fonts.bold,
  },
  complaintButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 12,
    gap: 8,
    borderWidth: 2,
    borderColor: '#ef4444',
  },
  complaintButtonText: {
    color: '#ef4444',
    fontSize: 14,
    fontFamily: Fonts.bold,
  },
  trackingToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: -16,
    marginTop: 12,
    backgroundColor: '#f9fafb',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },
  trackingToggleText: {
    flex: 1,
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#6b7280',
  },
  trackingTimeline: {
    marginTop: 16,
    paddingLeft: 8,
  },
  trackingItem: {
    flexDirection: 'row',
    position: 'relative',
    marginBottom: 16,
  },
  trackingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3b82f6',
    marginTop: 4,
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  trackingLine: {
    position: 'absolute',
    left: 5.5,
    top: 16,
    width: 1,
    height: '100%',
    backgroundColor: '#e5e7eb',
  },
  trackingContent: {
    flex: 1,
    marginLeft: 12,
  },
  trackingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  trackingStatus: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#111827',
  },
  trackingTime: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#9ca3af',
  },
  trackingNotes: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#6b7280',
    lineHeight: 18,
  },
  completedCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f97316',
  },
  completedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  completedNumber: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: '#111827',
  },
  completedFee: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: '#f97316',
  },
  completedAddress: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#6b7280',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    color: '#111827',
  },
  modalSubtitle: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#6b7280',
    marginBottom: 16,
  },
  modalInfo: {
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: '#111827',
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  modalBody: {
    padding: 24,
  },
  label: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    fontFamily: Fonts.regular,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#ffffff',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  complaintTypes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  complaintTypeButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
  },
  complaintTypeButtonActive: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  complaintTypeText: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#6b7280',
  },
  complaintTypeTextActive: {
    color: '#ffffff',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 24,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    color: '#374151',
  },
  confirmButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    color: '#ffffff',
  },
  submitButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#ef4444',
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    color: '#ffffff',
  },
  pendingContainer: {
    flex: 1,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
  },
  pendingTitle: {
    fontSize: 24,
    fontFamily: Fonts.bold,
    color: '#111827',
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  pendingText: {
    fontSize: 16,
    fontFamily: Fonts.regular,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  pendingInfo: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  pendingInfoLabel: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: '#111827',
    marginBottom: 12,
  },
  pendingInfoText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#6b7280',
    marginBottom: 8,
    lineHeight: 20,
  },
  bulkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f3e8ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#8b5cf6',
  },
  bulkBadgeText: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: '#8b5cf6',
  },
  bulkUpdateOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    backgroundColor: '#fff7ed',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fed7aa',
    marginBottom: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  checkboxChecked: {
    borderColor: '#f97316',
    backgroundColor: '#fff7ed',
  },
  bulkUpdateText: {
    flex: 1,
  },
  bulkUpdateLabel: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#111827',
    marginBottom: 4,
  },
  bulkUpdateSubtext: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#6b7280',
  },
  timelineContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  timelineTitle: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: '#111827',
    marginBottom: 12,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  timelineContent: {
    flex: 1,
    marginLeft: 12,
  },
  timelineLabel: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#111827',
    marginBottom: 2,
  },
  timelineTime: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#6b7280',
  },
  tabContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#f97316',
  },
  tabText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#6b7280',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  earningsSummary: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  earningsCard: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  earningsLabel: {
    fontSize: 12,
    color: '#92400e',
    marginBottom: 8,
    fontFamily: Fonts.semiBold,
  },
  earningsAmount: {
    fontSize: 22,
    fontFamily: Fonts.bold,
    color: '#78350f',
  },
  historyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  historyOrderNumber: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: '#111827',
    marginBottom: 4,
  },
  historyDate: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#6b7280',
  },
  historyFeeContainer: {
    alignItems: 'flex-end',
  },
  historyFeeLabel: {
    fontSize: 11,
    fontFamily: Fonts.regular,
    color: '#6b7280',
    marginBottom: 4,
  },
  historyFee: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: '#f97316',
  },
  historyCustomer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  historyCustomerName: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#111827',
  },
  historyAddresses: {
    gap: 8,
    marginBottom: 12,
  },
  historyAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyAddressText: {
    flex: 1,
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#374151',
  },
  historyFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  historyPackageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  historyPackageText: {
    flex: 1,
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#6b7280',
  },
  historyStatusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  historyStatusText: {
    fontSize: 11,
    fontFamily: Fonts.bold,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: '#111827',
  },
  searchResults: {
    fontSize: 13,
    color: '#6b7280',
    fontFamily: Fonts.semiBold,
    marginBottom: 12,
  },
  scheduledDeliveryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f5f3ff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#8b5cf6',
  },
  scheduledDeliveryInfo: {
    flex: 1,
  },
  scheduledDeliveryLabel: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: '#8b5cf6',
    marginBottom: 4,
  },
  scheduledDeliveryTime: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: '#6b21a8',
  },
  complaintsSection: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  complaintsSectionTitle: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: '#92400e',
    marginBottom: 8,
  },
  complaintCard: {
    backgroundColor: '#ffffff',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  complaintHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  complaintStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  complaintStatusText: {
    fontSize: 10,
    fontFamily: Fonts.bold,
  },
  complaintTime: {
    fontSize: 11,
    fontFamily: Fonts.regular,
    color: '#6b7280',
  },
  complaintType: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: '#b45309',
    marginBottom: 4,
  },
  complaintDescription: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#374151',
    lineHeight: 18,
  },
  assignmentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff7ed',
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#f97316',
    marginBottom: 12,
  },
  assignmentBannerText: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#c2410c',
    lineHeight: 20,
  },
  assignmentActions: {
    flexDirection: 'row',
    gap: 12,
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  acceptButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: Fonts.bold,
  },
  rejectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 12,
    gap: 8,
    borderWidth: 2,
    borderColor: '#ef4444',
  },
  rejectButtonText: {
    color: '#ef4444',
    fontSize: 15,
    fontFamily: Fonts.bold,
  },
});

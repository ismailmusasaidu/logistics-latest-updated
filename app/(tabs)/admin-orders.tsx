import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Modal, TextInput, Platform } from 'react-native';
import { Package, MapPin, Clock, Filter, Edit2, Trash2, X, Plus, User, Phone, Bike, Layers, Search, MessageSquare, Tag, Receipt } from 'lucide-react-native';
import { supabase, Order, Rider, Profile } from '@/lib/supabase';
import { StatusBadge } from '@/components/StatusBadge';
import { Toast } from '@/components/Toast';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { OrderReceiptModal } from '@/components/OrderReceiptModal';
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

type RiderWithProfile = Rider & { profile: Profile };

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [riders, setRiders] = useState<RiderWithProfile[]>([]);
  const [riderAssignMode, setRiderAssignMode] = useState<'registered' | 'manual'>('registered');
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  }>({
    visible: false,
    message: '',
    type: 'success',
  });

  const [confirmDialog, setConfirmDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState<string | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    setToast({ visible: true, message, type });
  };

  const handleViewReceipt = (orderId: string) => {
    setSelectedOrderForReceipt(orderId);
    setReceiptModalVisible(true);
  };

  const handleCloseReceipt = () => {
    setReceiptModalVisible(false);
    setSelectedOrderForReceipt(null);
  };

  useEffect(() => {
    loadOrders();
    loadRiders();
  }, []);

  useEffect(() => {
    let filtered = orders;

    if (filter === 'unverified_transfers') {
      filtered = filtered.filter(o => o.payment_method === 'transfer' && !o.payment_verified);
    } else if (filter !== 'all') {
      filtered = filtered.filter(o => o.status === filter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(order => {
        const customer = (order as any).customer;
        return (
          order.order_number.toLowerCase().includes(query) ||
          order.recipient_name.toLowerCase().includes(query) ||
          order.recipient_phone?.toLowerCase().includes(query) ||
          order.pickup_address.toLowerCase().includes(query) ||
          order.delivery_address.toLowerCase().includes(query) ||
          order.package_description?.toLowerCase().includes(query) ||
          order.transfer_reference?.toLowerCase().includes(query) ||
          customer?.full_name?.toLowerCase().includes(query) ||
          customer?.email?.toLowerCase().includes(query) ||
          customer?.phone?.toLowerCase().includes(query)
        );
      });
    }

    setFilteredOrders(filtered);
  }, [filter, orders, searchQuery]);

  const loadOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          customer:profiles!orders_customer_id_fkey(id, full_name, email, phone),
          rider:riders!orders_rider_id_fkey(
            id,
            status,
            profile:profiles!riders_user_id_fkey(id, full_name, phone)
          ),
          bulk_order:bulk_orders(
            id,
            bulk_order_number,
            total_orders,
            discount_percentage,
            final_fee,
            status
          ),
          order_complaints(
            id,
            complaint_type,
            description,
            status,
            created_at,
            rider:riders!order_complaints_rider_id_fkey(
              id,
              profile:profiles!riders_user_id_fkey(id, full_name, phone)
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const loadRiders = async () => {
    try {
      const { data, error } = await supabase
        .from('riders')
        .select(`
          *,
          profile:profiles!riders_user_id_fkey(*)
        `)
        .in('status', ['online', 'offline']);

      if (error) throw error;
      setRiders(data as any || []);
    } catch (error) {
      console.error('Error loading riders:', error);
    }
  };

  const handleEdit = (order: Order) => {
    setSelectedOrder(order);
    setRiderAssignMode(order.rider_id ? 'registered' : 'manual');
    setEditModalVisible(true);
  };

  const handleUpdate = async () => {
    if (!selectedOrder) return;

    try {
      const updateData: any = {
        status: selectedOrder.status,
        pickup_address: selectedOrder.pickup_address,
        delivery_address: selectedOrder.delivery_address,
        recipient_name: selectedOrder.recipient_name,
        recipient_phone: selectedOrder.recipient_phone,
        package_description: selectedOrder.package_description,
        delivery_fee: selectedOrder.delivery_fee,
        notes: selectedOrder.notes,
      };

      if (riderAssignMode === 'registered') {
        updateData.assigned_rider_id = selectedOrder.rider_id;
        updateData.assignment_status = 'assigned';
        updateData.rider_name = null;
        updateData.rider_phone = null;
      } else {
        updateData.rider_id = null;
        updateData.rider_name = selectedOrder.rider_name;
        updateData.rider_phone = selectedOrder.rider_phone;
      }

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', selectedOrder.id);

      if (error) throw error;

      setEditModalVisible(false);
      setSelectedOrder(null);
      showToast('Order updated successfully!', 'success');
      loadOrders();
    } catch (error) {
      console.error('Error updating order:', error);
      showToast('Failed to update order', 'error');
    }
  };

  const handleDelete = (orderId: string) => {
    setConfirmDialog({
      visible: true,
      title: 'Delete Order',
      message: 'Are you sure you want to delete this order? This action cannot be undone.',
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('orders')
            .delete()
            .eq('id', orderId);

          if (error) throw error;
          showToast('Order deleted successfully', 'success');
          loadOrders();
        } catch (error) {
          console.error('Error deleting order:', error);
          showToast('Failed to delete order', 'error');
        }
      },
    });
  };

  const handleVerifyPayment = (orderId: string) => {
    setConfirmDialog({
      visible: true,
      title: 'Verify Payment',
      message: 'Are you sure you want to mark this payment as verified?',
      onConfirm: async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();

          const { error } = await supabase
            .from('orders')
            .update({
              payment_verified: true,
              payment_verified_at: new Date().toISOString(),
              payment_verified_by: user?.id,
            })
            .eq('id', orderId);

          if (error) throw error;

          showToast('Payment verified successfully!', 'success');
          loadOrders();
        } catch (error) {
          console.error('Error verifying payment:', error);
          showToast('Failed to verify payment', 'error');
        }
      },
    });
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

  const filters = [
    { label: 'All', value: 'all' },
    { label: 'Pending', value: 'pending' },
    { label: 'Active', value: 'in_transit' },
    { label: 'Delivered', value: 'delivered' },
    { label: 'Unverified Transfers', value: 'unverified_transfers' },
  ];

  const statusOptions: Array<'pending' | 'confirmed' | 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled'> = ['pending', 'confirmed', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled'];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>All Orders</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {searchQuery || filter !== 'all' ? `${filteredOrders.length} / ${orders.length}` : orders.length}
          </Text>
        </View>
      </View>

      <View style={styles.filterContainer}>
        <Filter size={18} color="#6b7280" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {filters.map((item) => (
            <TouchableOpacity
              key={item.value}
              style={[styles.filterButton, filter === item.value && styles.filterButtonActive]}
              onPress={() => setFilter(item.value)}>
              <Text style={[styles.filterText, filter === item.value && styles.filterTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Search size={20} color="#6b7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by order number, customer, recipient, address..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9ca3af"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <X size={20} color="#6b7280" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadOrders(); }} />}>

        {filteredOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <Package size={64} color="#d1d5db" />
            <Text style={styles.emptyText}>No orders found</Text>
            <Text style={styles.emptySubtext}>
              {searchQuery ? 'Try adjusting your search' : 'Orders will appear here'}
            </Text>
          </View>
        ) : (
          filteredOrders.map((order) => (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
                  <Text style={styles.statusText}>{getStatusLabel(order.status)}</Text>
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.actionButton} onPress={() => handleEdit(order)}>
                    <Edit2 size={18} color="#3b82f6" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(order.id)}>
                    <Trash2 size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.orderNumberRow}>
                <Text style={styles.orderNumber}>{order.order_number}</Text>
                {(order as any).bulk_order && (
                  <View style={styles.bulkBadge}>
                    <Layers size={14} color="#8b5cf6" />
                    <Text style={styles.bulkBadgeText}>
                      BULK {(order as any).bulk_order.bulk_order_number}
                    </Text>
                  </View>
                )}
              </View>

              {(order as any).bulk_order && (
                <View style={styles.bulkInfo}>
                  <Text style={styles.bulkInfoText}>
                    Part of {(order as any).bulk_order.total_orders} orders • {(order as any).bulk_order.discount_percentage}% discount
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
                  <MapPin size={18} color="#f97316" />
                  <View style={styles.addressInfo}>
                    <Text style={styles.addressLabel}>Pickup</Text>
                    <Text style={styles.addressText}>{order.pickup_address}</Text>
                  </View>
                </View>

                <View style={styles.addressRow}>
                  <MapPin size={18} color="#ef4444" />
                  <View style={styles.addressInfo}>
                    <Text style={styles.addressLabel}>Delivery to {order.recipient_name}</Text>
                    <Text style={styles.addressText}>{order.delivery_address}</Text>
                  </View>
                </View>

                {order.scheduled_delivery_time && (
                  <View style={styles.addressRow}>
                    <Clock size={18} color="#8b5cf6" />
                    <View style={styles.addressInfo}>
                      <Text style={styles.addressLabel}>Scheduled Delivery</Text>
                      <Text style={styles.addressText}>
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

                {order.order_size && (
                  <View style={styles.addressRow}>
                    <Package size={18} color="#3b82f6" />
                    <View style={styles.addressInfo}>
                      <Text style={styles.addressLabel}>Order Size</Text>
                      <Text style={styles.addressText}>{order.order_size.charAt(0).toUpperCase() + order.order_size.slice(1)}</Text>
                    </View>
                  </View>
                )}

                {order.order_types && order.order_types.length > 0 && (
                  <View style={styles.addressRow}>
                    <Tag size={18} color="#10b981" />
                    <View style={styles.addressInfo}>
                      <Text style={styles.addressLabel}>Order Types</Text>
                      <Text style={styles.addressText}>{order.order_types.join(', ')}</Text>
                    </View>
                  </View>
                )}

                <View style={styles.packageRow}>
                  <Package size={18} color="#6b7280" />
                  <View style={styles.packageInfo}>
                    <Text style={styles.packageLabel}>Package</Text>
                    <Text style={styles.packageText}>{order.package_description}</Text>
                  </View>
                </View>

                {order.pickup_instructions && (
                  <View style={styles.notesSection}>
                    <MessageSquare size={18} color="#f97316" />
                    <View style={styles.notesContent}>
                      <Text style={[styles.notesLabel, { color: '#f97316' }]}>Pickup Instructions:</Text>
                      <Text style={styles.notesText}>{order.pickup_instructions}</Text>
                    </View>
                  </View>
                )}

                {order.delivery_instructions && (
                  <View style={styles.notesSection}>
                    <MessageSquare size={18} color="#8b5cf6" />
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
                        <Text style={styles.timelineLabel}>Assigned to Rider</Text>
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

                {(order as any).order_complaints && (order as any).order_complaints.length > 0 && (
                  <View style={styles.complaintsSection}>
                    <Text style={styles.complaintsSectionTitle}>📋 Rider Reports</Text>
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
                        {complaint.rider?.profile && (
                          <Text style={styles.complaintReporter}>
                            Reported by: {complaint.rider.profile.full_name || 'Unknown Rider'}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}

                {order.payment_method === 'transfer' && (
                  <View style={styles.paymentSection}>
                    <View style={styles.paymentHeader}>
                      <Text style={styles.paymentTitle}>Bank Transfer Payment</Text>
                      {order.payment_verified ? (
                        <View style={styles.verifiedBadge}>
                          <Text style={styles.verifiedBadgeText}>✓ Verified</Text>
                        </View>
                      ) : (
                        <View style={styles.pendingBadge}>
                          <Text style={styles.pendingBadgeText}>Pending Verification</Text>
                        </View>
                      )}
                    </View>
                    {order.transfer_reference && (
                      <View style={styles.transferRefRow}>
                        <Text style={styles.transferRefLabel}>Transfer Reference:</Text>
                        <Text style={styles.transferRefValue}>{order.transfer_reference}</Text>
                      </View>
                    )}
                    {!order.payment_verified && (
                      <TouchableOpacity
                        style={styles.verifyButton}
                        onPress={() => handleVerifyPayment(order.id)}>
                        <Text style={styles.verifyButtonText}>Mark as Paid</Text>
                      </TouchableOpacity>
                    )}
                    {order.payment_verified_at && (
                      <Text style={styles.verifiedAtText}>
                        Verified on {new Date(order.payment_verified_at).toLocaleString()}
                      </Text>
                    )}
                  </View>
                )}

                <View style={styles.orderFooter}>
                  <View style={styles.footerLeft}>
                    <View style={styles.timeInfo}>
                      <Clock size={16} color="#6b7280" />
                      <Text style={styles.timeText}>
                        {new Date(order.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                    <View style={styles.paymentMethodBadge}>
                      <Text style={styles.paymentMethodText}>
                        {order.payment_method === 'wallet' ? 'Wallet' :
                         order.payment_method === 'transfer' ? 'Transfer' :
                         order.payment_method === 'online' ? 'Online' : 'Cash'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.feeText}>₦{order.delivery_fee.toFixed(2)}</Text>
                </View>

                <TouchableOpacity
                  style={styles.receiptButton}
                  onPress={() => handleViewReceipt(order.id)}>
                  <Receipt size={16} color="#f97316" />
                  <Text style={styles.receiptButtonText}>View Receipt</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Order</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Status</Text>
              <View style={styles.statusSelector}>
                {statusOptions.map((status) => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.statusOption,
                      selectedOrder?.status === status && styles.statusOptionActive
                    ]}
                    onPress={() => setSelectedOrder(prev => prev ? { ...prev, status } : null)}>
                    <Text style={[
                      styles.statusOptionText,
                      selectedOrder?.status === status && styles.statusOptionTextActive
                    ]}>
                      {getStatusLabel(status)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Pickup Address</Text>
              <TextInput
                style={styles.input}
                value={selectedOrder?.pickup_address}
                onChangeText={(text) => setSelectedOrder(prev => prev ? { ...prev, pickup_address: text } : null)}
                placeholder="Enter pickup address"
              />

              <Text style={styles.label}>Delivery Address</Text>
              <TextInput
                style={styles.input}
                value={selectedOrder?.delivery_address}
                onChangeText={(text) => setSelectedOrder(prev => prev ? { ...prev, delivery_address: text } : null)}
                placeholder="Enter delivery address"
              />

              <Text style={styles.label}>Recipient Name</Text>
              <TextInput
                style={styles.input}
                value={selectedOrder?.recipient_name}
                onChangeText={(text) => setSelectedOrder(prev => prev ? { ...prev, recipient_name: text } : null)}
                placeholder="Enter recipient name"
              />

              <Text style={styles.label}>Recipient Phone</Text>
              <TextInput
                style={styles.input}
                value={selectedOrder?.recipient_phone}
                onChangeText={(text) => setSelectedOrder(prev => prev ? { ...prev, recipient_phone: text } : null)}
                placeholder="Enter recipient phone"
                keyboardType="phone-pad"
              />

              <Text style={styles.label}>Package Description</Text>
              <TextInput
                style={styles.input}
                value={selectedOrder?.package_description}
                onChangeText={(text) => setSelectedOrder(prev => prev ? { ...prev, package_description: text } : null)}
                placeholder="Enter package description"
              />

              <Text style={styles.label}>Delivery Fee</Text>
              <TextInput
                style={styles.input}
                value={selectedOrder?.delivery_fee.toString()}
                onChangeText={(text) => setSelectedOrder(prev => prev ? { ...prev, delivery_fee: parseFloat(text) || 0 } : null)}
                placeholder="Enter delivery fee"
                keyboardType="decimal-pad"
              />

              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={selectedOrder?.notes || ''}
                onChangeText={(text) => setSelectedOrder(prev => prev ? { ...prev, notes: text } : null)}
                placeholder="Enter notes"
                multiline
                numberOfLines={3}
              />

              <View style={styles.riderSection}>
                <View style={styles.riderHeader}>
                  <Bike size={20} color="#8b5cf6" />
                  <Text style={styles.riderSectionTitle}>Assign Rider</Text>
                </View>

                <View style={styles.modeSelector}>
                  <TouchableOpacity
                    style={[styles.modeButton, riderAssignMode === 'registered' && styles.modeButtonActive]}
                    onPress={() => setRiderAssignMode('registered')}>
                    <Text style={[styles.modeButtonText, riderAssignMode === 'registered' && styles.modeButtonTextActive]}>
                      Registered Rider
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modeButton, riderAssignMode === 'manual' && styles.modeButtonActive]}
                    onPress={() => setRiderAssignMode('manual')}>
                    <Text style={[styles.modeButtonText, riderAssignMode === 'manual' && styles.modeButtonTextActive]}>
                      Manual Entry
                    </Text>
                  </TouchableOpacity>
                </View>

                {riderAssignMode === 'registered' ? (
                  <>
                    <Text style={styles.label}>Select Rider</Text>
                    {riders.length === 0 ? (
                      <Text style={styles.noRidersText}>No registered riders available</Text>
                    ) : (
                      <ScrollView style={styles.ridersList} nestedScrollEnabled>
                        {riders.map((rider) => (
                          <TouchableOpacity
                            key={rider.id}
                            style={[
                              styles.riderCard,
                              selectedOrder?.rider_id === rider.id && styles.riderCardActive
                            ]}
                            onPress={() => setSelectedOrder(prev => prev ? { ...prev, rider_id: rider.id } : null)}>
                            <View style={styles.riderInfo}>
                              <Text style={styles.riderName}>{rider.profile.full_name}</Text>
                              <Text style={styles.riderDetails}>
                                {rider.vehicle_type.charAt(0).toUpperCase() + rider.vehicle_type.slice(1)} • {rider.vehicle_number}
                              </Text>
                              <View style={styles.riderStats}>
                                <Text style={styles.riderStat}>⭐ {rider.rating.toFixed(1)}</Text>
                                <Text style={styles.riderStat}>📦 {rider.total_deliveries} deliveries</Text>
                                <View style={[styles.statusDot, { backgroundColor: rider.status === 'online' ? '#f97316' : '#6b7280' }]} />
                                <Text style={[styles.riderStat, { color: rider.status === 'online' ? '#f97316' : '#6b7280' }]}>
                                  {rider.status}
                                </Text>
                              </View>
                            </View>
                            {selectedOrder?.rider_id === rider.id && (
                              <View style={styles.selectedBadge}>
                                <Text style={styles.selectedBadgeText}>✓</Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    )}
                  </>
                ) : (
                  <>
                    <Text style={styles.riderSectionSubtitle}>Enter rider contact information manually</Text>

                    <Text style={styles.label}>Rider Name</Text>
                    <TextInput
                      style={styles.input}
                      value={selectedOrder?.rider_name || ''}
                      onChangeText={(text) => setSelectedOrder(prev => prev ? { ...prev, rider_name: text } : null)}
                      placeholder="Enter rider name"
                    />

                    <Text style={styles.label}>Rider Phone</Text>
                    <TextInput
                      style={styles.input}
                      value={selectedOrder?.rider_phone || ''}
                      onChangeText={(text) => setSelectedOrder(prev => prev ? { ...prev, rider_phone: text } : null)}
                      placeholder="Enter rider phone number"
                      keyboardType="phone-pad"
                    />
                  </>
                )}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setEditModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleUpdate}>
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        duration={5000}
        onDismiss={() => setToast({ ...toast, visible: false })}
      />

      <ConfirmDialog
        visible={confirmDialog.visible}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ ...confirmDialog, visible: false })}
      />

      <OrderReceiptModal
        visible={receiptModalVisible}
        onClose={handleCloseReceipt}
        orderId={selectedOrderForReceipt || ''}
      />
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
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
  },
  badge: {
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    gap: 12,
  },
  filterScroll: {
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  filterButtonActive: {
    backgroundColor: '#8b5cf6',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  filterTextActive: {
    color: '#ffffff',
  },
  searchContainer: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    padding: 0,
  },
  clearButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
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
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
  orderNumber: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
    marginBottom: 12,
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 12,
  },
  customerDetails: {
    flex: 1,
  },
  customerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  customerContact: {
    fontSize: 12,
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
    fontWeight: '600',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    color: '#111827',
  },
  packageRow: {
    flexDirection: 'row',
    gap: 12,
  },
  packageInfo: {
    flex: 1,
  },
  packageLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
    marginBottom: 4,
  },
  packageText: {
    fontSize: 14,
    color: '#111827',
  },
  notesSection: {
    flexDirection: 'row',
    gap: 12,
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
    fontWeight: '600',
    color: '#8b5cf6',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeText: {
    fontSize: 12,
    color: '#6b7280',
  },
  feeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#8b5cf6',
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
    maxHeight: '90%',
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
    fontWeight: '700',
    color: '#111827',
  },
  modalBody: {
    padding: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    marginBottom: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  statusSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  statusOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
  },
  statusOptionActive: {
    backgroundColor: '#8b5cf6',
    borderColor: '#8b5cf6',
  },
  statusOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  statusOptionTextActive: {
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
    fontWeight: '600',
    color: '#374151',
  },
  saveButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  riderSection: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  riderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  riderSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#8b5cf6',
  },
  riderSectionSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 16,
  },
  modeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    marginTop: 8,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#8b5cf6',
    borderColor: '#8b5cf6',
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  modeButtonTextActive: {
    color: '#ffffff',
  },
  ridersList: {
    maxHeight: 250,
    marginBottom: 16,
  },
  riderCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    marginBottom: 8,
  },
  riderCardActive: {
    borderColor: '#8b5cf6',
    backgroundColor: '#f5f3ff',
  },
  riderInfo: {
    flex: 1,
  },
  riderName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  riderDetails: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 6,
  },
  riderStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  riderStat: {
    fontSize: 12,
    color: '#6b7280',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 4,
  },
  selectedBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedBadgeText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  noRidersText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    paddingVertical: 24,
  },
  orderNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  bulkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f3e8ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#8b5cf6',
  },
  bulkBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8b5cf6',
  },
  bulkInfo: {
    backgroundColor: '#faf5ff',
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  bulkInfoText: {
    fontSize: 12,
    color: '#7c3aed',
    fontWeight: '500',
  },
  timelineContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: '700',
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
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  timelineTime: {
    fontSize: 12,
    color: '#6b7280',
  },
  paymentSection: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  verifiedBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  verifiedBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16a34a',
  },
  pendingBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pendingBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
  },
  transferRefRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  transferRefLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  transferRefValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '700',
  },
  verifyButton: {
    backgroundColor: '#f97316',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  verifyButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  verifiedAtText: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 8,
    fontStyle: 'italic',
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paymentMethodBadge: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  paymentMethodText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0369a1',
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
    fontWeight: '600',
    color: '#8b5cf6',
    marginBottom: 4,
  },
  scheduledDeliveryTime: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6b21a8',
  },
  complaintsSection: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  complaintsSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#92400e',
    marginBottom: 12,
  },
  complaintCard: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  complaintHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  complaintStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  complaintStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  complaintTime: {
    fontSize: 12,
    color: '#6b7280',
  },
  complaintType: {
    fontSize: 13,
    fontWeight: '700',
    color: '#b45309',
    marginBottom: 6,
  },
  complaintDescription: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 8,
  },
  complaintReporter: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  receiptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff7ed',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fed7aa',
    marginTop: 12,
  },
  receiptButtonText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: Fonts.semiBold,
    color: '#f97316',
  },
});

import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Modal, TextInput, Platform, Linking, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Package, MapPin, Clock, Plus, X, User, Phone, ChevronDown, ChevronUp, Layers, Navigation, Search, Tag, Receipt } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, Order, OrderTracking } from '@/lib/supabase';
import BulkOrderModal from '@/components/BulkOrderModal';
import { CheckoutModal } from '@/components/CheckoutModal';
import { PricingBreakdown } from '@/components/PricingBreakdown';
import { Toast } from '@/components/Toast';
import { OrderReceiptModal } from '@/components/OrderReceiptModal';
import { pricingCalculator, PricingBreakdown as PricingBreakdownType, Promotion } from '@/lib/pricingCalculator';
import { calculateDistanceBetweenAddresses } from '@/lib/geocoding';
import { PaymentMethod, walletService } from '@/lib/wallet';
import { getUserFriendlyError } from '@/lib/errorHandler';
import { matchAddressToZone } from '@/lib/zoneMatching';
import { Fonts } from '@/constants/fonts';

export default function CustomerHome() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [checkoutModalVisible, setCheckoutModalVisible] = useState(false);
  const [bulkModalVisible, setBulkModalVisible] = useState(false);
  const [orderTracking, setOrderTracking] = useState<Record<string, OrderTracking[]>>({});
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [newOrder, setNewOrder] = useState({
    pickupAddress: '',
    pickupInstructions: '',
    deliveryAddress: '',
    deliveryInstructions: '',
    recipientName: '',
    recipientPhone: '',
    packageDescription: '',
    orderTypes: [] as string[],
    orderSize: '' as 'small' | 'medium' | 'large' | '',
    promoCode: '',
  });
  const [calculatedDistance, setCalculatedDistance] = useState<number | null>(null);
  const [pricingBreakdown, setPricingBreakdown] = useState<PricingBreakdownType | null>(null);
  const [validatedPromo, setValidatedPromo] = useState<Promotion | null>(null);
  const [calculatingDistance, setCalculatingDistance] = useState(false);
  const [geocodingError, setGeocodingError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  }>({
    visible: false,
    message: '',
    type: 'success',
  });
  const [pendingPaymentData, setPendingPaymentData] = useState<{
    reference: string;
    orderDetails: any;
  } | null>(null);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState<string | null>(null);

  const orderTypeOptions = ['Groceries', 'Medicine', 'Bulk / Heavy Items', 'Express Delivery'];

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    setToast({ visible: true, message, type });
  };

  useEffect(() => {
    pricingCalculator.initialize();
    loadOrders();

    const ordersChannel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `customer_id=eq.${profile?.id}`,
        },
        (payload) => {
          console.log('Order change detected:', payload);
          loadOrders();
        }
      )
      .subscribe();

    const trackingChannel = supabase
      .channel('customer-tracking-updates')
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

    const complaintsChannel = supabase
      .channel('customer-complaints-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_complaints',
        },
        (payload) => {
          console.log('Complaint change detected:', payload);
          loadOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(trackingChannel);
      supabase.removeChannel(complaintsChannel);
    };
  }, [profile?.id]);

  const loadOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_complaints(
            id,
            complaint_type,
            description,
            status,
            created_at
          )
        `)
        .eq('customer_id', profile?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      console.log('Loaded orders:', data);
      console.log('Orders with complaints:', data?.filter((o: any) => o.order_complaints && o.order_complaints.length > 0));
      console.log('First order with complaints:', data?.find((o: any) => o.order_complaints && o.order_complaints.length > 0));
      console.log('Orders with rider info:', data?.filter(o => o.rider_name || o.rider_phone));
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
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCall = (phoneNumber: string) => {
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const calculateDistanceAndPricing = useCallback(async () => {
    if (!newOrder.pickupAddress || !newOrder.deliveryAddress) {
      setCalculatedDistance(null);
      setPricingBreakdown(null);
      setGeocodingError(null);
      return;
    }

    if (newOrder.pickupAddress.length < 5 || newOrder.deliveryAddress.length < 5) {
      return;
    }

    setCalculatingDistance(true);
    setGeocodingError(null);

    try {
      const result = await calculateDistanceBetweenAddresses(
        newOrder.pickupAddress,
        newOrder.deliveryAddress
      );

      if (!result) {
        setGeocodingError('Unable to find addresses. Please use detailed addresses with landmarks (e.g., "10 Admiralty Way, Lekki Phase 1" or "Plot 1234, Victoria Island, Lagos")');
        setCalculatedDistance(null);
        setPricingBreakdown(null);
        return;
      }

      setCalculatedDistance(result.distance);

      await pricingCalculator.initialize();

      let promo: Promotion | null = null;
      if (newOrder.promoCode.trim()) {
        promo = await pricingCalculator.validatePromoCode(
          newOrder.promoCode.trim(),
          profile?.id || '',
          0
        );
        setValidatedPromo(promo);
      } else {
        setValidatedPromo(null);
      }

      const breakdown = pricingCalculator.calculateDeliveryPrice(
        result.distance,
        newOrder.orderTypes,
        0,
        promo,
        newOrder.orderSize
      );

      setPricingBreakdown(breakdown);
      setGeocodingError(null);
    } catch (error: any) {
      console.error('Error calculating distance and pricing:', error);
      setGeocodingError(getUserFriendlyError(error));
      setPricingBreakdown(null);
      setCalculatedDistance(null);
    } finally {
      setCalculatingDistance(false);
    }
  }, [newOrder.pickupAddress, newOrder.deliveryAddress, newOrder.orderTypes, newOrder.orderSize, newOrder.promoCode, profile?.id]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      calculateDistanceAndPricing();
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [calculateDistanceAndPricing]);

  const toggleOrderType = (type: string) => {
    setNewOrder(prev => {
      const types = prev.orderTypes.includes(type)
        ? prev.orderTypes.filter(t => t !== type)
        : [...prev.orderTypes, type];
      return { ...prev, orderTypes: types };
    });
  };

  const proceedToCheckout = () => {
    if (!newOrder.pickupAddress || !newOrder.deliveryAddress || !newOrder.recipientName || !newOrder.recipientPhone || !newOrder.packageDescription) {
      showToast('Please fill in all fields', 'warning');
      return;
    }

    if (!pricingBreakdown) {
      showToast('Please wait for pricing to be calculated', 'info');
      return;
    }

    setCheckoutModalVisible(true);
  };

  const assignRiderToOrder = async (orderId: string) => {
    try {
      const apiUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/assign-rider`;
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ order_id: orderId }),
      });

      const result = await response.json();

      if (result.success) {
        console.log('Rider assigned successfully:', result);
      } else {
        console.log('No rider available for assignment:', result.message);
      }
    } catch (error) {
      console.error('Error assigning rider:', error);
    }
  };

  const verifyAndCreateOrder = async (reference: string, orderDetails: any) => {
    console.log('=== Starting verification ===');
    console.log('Reference:', reference);
    setVerifyingPayment(true);
    console.log('Verifying payment state set to TRUE');
    try {
      const apiUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/verify-payment`;
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reference }),
      });

      const verificationResult = await response.json();

      if (!verificationResult.success || !verificationResult.verified) {
        let errorMessage = 'Payment verification failed. Order not created.';

        if (verificationResult.message) {
          const msg = verificationResult.message.toLowerCase();

          if (msg.includes('declined') || msg.includes('card declined')) {
            errorMessage = 'Your card was declined. Please check your card details or try a different card.';
          } else if (msg.includes('insufficient') || msg.includes('funds')) {
            errorMessage = 'Insufficient funds. Please check your account balance and try again.';
          } else if (msg.includes('expired')) {
            errorMessage = 'Your card has expired. Please use a different card.';
          } else if (msg.includes('invalid')) {
            errorMessage = 'Invalid card details. Please check and try again.';
          } else if (msg.includes('cancelled')) {
            errorMessage = 'Payment was cancelled. No order was created.';
          } else if (msg.includes('abandoned')) {
            errorMessage = 'Payment was not completed. No order was created.';
          } else if (msg.includes('timeout') || msg.includes('timed out')) {
            errorMessage = 'Payment timed out. Please try again.';
          } else if (msg.includes('network') || msg.includes('connection')) {
            errorMessage = 'Network error. Please check your connection and try again.';
          } else if (verificationResult.gatewayResponse) {
            errorMessage = `Payment failed: ${verificationResult.gatewayResponse}`;
          } else {
            errorMessage = `Payment failed: ${verificationResult.message}`;
          }
        }

        setVerifyingPayment(false);
        setPendingPaymentData(null);
        throw new Error(errorMessage);
      }

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: orderDetails.customer_id,
          order_number: orderDetails.order_number,
          pickup_address: orderDetails.pickup_address,
          pickup_lat: orderDetails.pickup_lat,
          pickup_lng: orderDetails.pickup_lng,
          pickup_instructions: orderDetails.pickup_instructions,
          delivery_address: orderDetails.delivery_address,
          delivery_lat: orderDetails.delivery_lat,
          delivery_lng: orderDetails.delivery_lng,
          delivery_instructions: orderDetails.delivery_instructions,
          recipient_name: orderDetails.recipient_name,
          recipient_phone: orderDetails.recipient_phone,
          package_description: orderDetails.package_description,
          delivery_fee: orderDetails.delivery_fee,
          payment_method: 'online',
          payment_status: 'completed',
          status: 'pending',
          scheduled_delivery_time: orderDetails.scheduled_delivery_time,
          order_size: orderDetails.order_size || null,
          order_types: orderDetails.order_types || null,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      if (orderDetails.validatedPromo) {
        await pricingCalculator.incrementPromoUsage(orderDetails.validatedPromo.promo_code);
      }

      setVerifyingPayment(false);
      setModalVisible(false);
      setNewOrder({
        pickupAddress: '',
        pickupInstructions: '',
        deliveryAddress: '',
        deliveryInstructions: '',
        recipientName: '',
        recipientPhone: '',
        packageDescription: '',
        orderTypes: [],
        orderSize: '',
        promoCode: '',
      });
      setCalculatedDistance(null);
      setPricingBreakdown(null);
      setValidatedPromo(null);
      setGeocodingError(null);

      showToast('Payment successful! Order created.', 'success');
      loadOrders();
      setPendingPaymentData(null);

      if (insertedOrder?.id) {
        assignRiderToOrder(insertedOrder.id);
      }

      return true;
    } catch (error: any) {
      console.error('Payment verification error:', error);
      setVerifyingPayment(false);
      setPendingPaymentData(null);

      throw new Error(getUserFriendlyError(error));
    }
  };

  useEffect(() => {
    console.log('useEffect triggered. pendingPaymentData:', pendingPaymentData);
    if (pendingPaymentData) {
      console.log('Scheduling verification in 100ms');
      setTimeout(() => {
        console.log('Now calling verifyAndCreateOrder');
        verifyAndCreateOrder(pendingPaymentData.reference, pendingPaymentData.orderDetails);
      }, 100);
    }
  }, [pendingPaymentData]);

  useEffect(() => {
    console.log('verifyingPayment state changed to:', verifyingPayment);
  }, [verifyingPayment]);

  const createOrderWithPayment = async (paymentMethod: PaymentMethod, paystackReference?: string, scheduledTime?: Date) => {
    if (!pricingBreakdown || !profile?.id) {
      throw new Error('Missing required information');
    }

    try {
      const orderNumber = `ORD-${Date.now()}`;

      if (paymentMethod === 'online') {
        if (!paystackReference) {
          throw new Error('Payment reference is required for online payment');
        }

        const pickupZoneId = await matchAddressToZone(newOrder.pickupAddress);

        const orderDetails = {
          customer_id: profile.id,
          order_number: orderNumber,
          pickup_address: newOrder.pickupAddress,
          pickup_lat: 0,
          pickup_lng: 0,
          pickup_instructions: newOrder.pickupInstructions || null,
          pickup_zone_id: pickupZoneId,
          delivery_address: newOrder.deliveryAddress,
          delivery_lat: 0,
          delivery_lng: 0,
          delivery_instructions: newOrder.deliveryInstructions || null,
          recipient_name: newOrder.recipientName,
          recipient_phone: newOrder.recipientPhone,
          package_description: newOrder.packageDescription,
          delivery_fee: pricingBreakdown.finalPrice,
          validatedPromo: validatedPromo,
          scheduled_delivery_time: scheduledTime ? scheduledTime.toISOString() : null,
          order_size: newOrder.orderSize || null,
          order_types: newOrder.orderTypes.length > 0 ? newOrder.orderTypes : null,
        };

        console.log('Payment completed with reference:', paystackReference);

        const verified = await verifyAndCreateOrder(paystackReference, orderDetails);

        if (!verified) {
          throw new Error('Payment verification failed');
        }

        setCheckoutModalVisible(false);
        return;
      }

      const pickupZoneId = await matchAddressToZone(newOrder.pickupAddress);

      const insertData: any = {
        customer_id: profile.id,
        order_number: orderNumber,
        pickup_address: newOrder.pickupAddress,
        pickup_lat: 0,
        pickup_lng: 0,
        pickup_instructions: newOrder.pickupInstructions || null,
        pickup_zone_id: pickupZoneId,
        delivery_address: newOrder.deliveryAddress,
        delivery_lat: 0,
        delivery_lng: 0,
        delivery_instructions: newOrder.deliveryInstructions || null,
        recipient_name: newOrder.recipientName,
        recipient_phone: newOrder.recipientPhone,
        package_description: newOrder.packageDescription,
        delivery_fee: pricingBreakdown.finalPrice,
        payment_method: paymentMethod,
        payment_status: 'pending',
        status: 'pending',
        scheduled_delivery_time: scheduledTime ? scheduledTime.toISOString() : null,
        order_size: newOrder.orderSize || null,
        order_types: newOrder.orderTypes.length > 0 ? newOrder.orderTypes : null,
      };

      if (paymentMethod === 'transfer' && paystackReference) {
        insertData.transfer_customer_reference = paystackReference;
      }

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert(insertData)
        .select('*, transfer_reference')
        .single();

      if (orderError) throw orderError;

      if (paymentMethod === 'wallet') {
        const success = await walletService.processWalletPayment(
          profile.id,
          pricingBreakdown.finalPrice,
          orderData.id,
          orderNumber
        );

        if (!success) {
          await supabase.from('orders').delete().eq('id', orderData.id);
          throw new Error('Insufficient wallet balance');
        }
      }

      if (validatedPromo) {
        await pricingCalculator.incrementPromoUsage(validatedPromo.promo_code);
      }

      let paymentMsg = '';
      let toastType: 'success' | 'info' = 'success';

      if (paymentMethod === 'wallet') {
        paymentMsg = 'Order placed and paid via wallet!';
      } else if (paymentMethod === 'transfer') {
        paymentMsg = `Order placed! Transfer Reference: ${orderData.transfer_reference} - Please include this reference in your bank transfer notes for faster processing.`;
        toastType = 'info';
      } else {
        paymentMsg = 'Order placed! Pay cash on delivery.';
      }

      showToast(paymentMsg, toastType);

      setModalVisible(false);
      setCheckoutModalVisible(false);
      setNewOrder({
        pickupAddress: '',
        pickupInstructions: '',
        deliveryAddress: '',
        deliveryInstructions: '',
        recipientName: '',
        recipientPhone: '',
        packageDescription: '',
        orderTypes: [],
        orderSize: '',
        promoCode: '',
      });
      setCalculatedDistance(null);
      setPricingBreakdown(null);
      setValidatedPromo(null);
      setGeocodingError(null);
      loadOrders();

      if (orderData?.id) {
        assignRiderToOrder(orderData.id);
      }
    } catch (error: any) {
      console.error('Order creation error:', error);
      throw error;
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

  const handleViewReceipt = (orderId: string) => {
    setSelectedOrderForReceipt(orderId);
    setReceiptModalVisible(true);
  };

  const handleCloseReceipt = () => {
    setReceiptModalVisible(false);
    setSelectedOrderForReceipt(null);
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
    return (
      order.order_number.toLowerCase().includes(query) ||
      order.pickup_address.toLowerCase().includes(query) ||
      order.delivery_address.toLowerCase().includes(query) ||
      order.package_description.toLowerCase().includes(query) ||
      (order.recipient_name && order.recipient_name.toLowerCase().includes(query)) ||
      (order.rider_name && order.rider_name.toLowerCase().includes(query))
    );
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}> {profile?.full_name}</Text>
          <Text style={styles.subGreeting}>Track your deliveries</Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.bulkButton} onPress={() => setBulkModalVisible(true)}>
            <Layers size={20} color="#f97316" />
            <Text style={styles.bulkButtonText}>Bulk</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
            <Plus size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadOrders(); }} />}>

        <View style={styles.statsContainer}>
          <View  style={styles.statCard}>
            <Text style={styles.statNumber}>{orders.filter(o => o.status === 'in_transit').length}</Text>
            <Text style={styles.statLabel}>In Transit</Text>
          </View>
          <View  style={styles.statCard}>
            <Text style={styles.statNumber}>{orders.filter(o => o.status === 'delivered').length}</Text>
            <Text style={styles.statLabel}>Delivered</Text>
          </View>
          <View  style={styles.statCard}>
            <Text style={styles.statNumber}>{orders.filter(o => o.status === 'pending').length}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'active' && styles.tabActive]}
            onPress={() => {
              setActiveTab('active');
              setSearchQuery('');
            }}>
            <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>
              Active ({activeOrders.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'history' && styles.tabActive]}
            onPress={() => {
              setActiveTab('history');
              setSearchQuery('');
            }}>
            <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
              History ({completedOrders.length})
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'active' && (
          <>
            <Text style={styles.sectionTitle}>Active Orders</Text>

            {activeOrders.length === 0 ? (
              <View style={styles.emptyState}>
                <Package size={64} color="#d1d5db" />
                <Text style={styles.emptyText}>No active orders</Text>
                <Text style={styles.emptySubtext}>Your active orders will appear here</Text>
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
                      <Text style={styles.addressLabel}>Delivery</Text>
                      <Text style={styles.addressText}>{order.delivery_address}</Text>
                    </View>
                  </View>

                  {order.scheduled_delivery_time && (
                    <View style={styles.addressRow}>
                      <Clock size={20} color="#8b5cf6" />
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

                  {(order.rider_name && order.rider_phone) ? (
                    <View style={styles.riderInfo}>
                      <View style={styles.riderHeader}>
                        <User size={16} color="#f97316" />
                        <Text style={styles.riderLabel}>Assigned Rider</Text>
                      </View>
                      <View style={styles.riderDetails}>
                        <View style={styles.riderDetail}>
                          <Text style={styles.riderName}>{order.rider_name}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.callButton}
                          onPress={() => handleCall(order.rider_phone!)}>
                          <Phone size={16} color="#f97316" />
                          <Text style={styles.callButtonText}>{order.rider_phone}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    console.log('No rider info for order:', order.order_number, 'rider_name:', order.rider_name, 'rider_phone:', order.rider_phone),
                    null
                  )}
                </View>

                {orderTracking[order.id] && orderTracking[order.id].length > 0 && (
                  <>
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

                    {expandedOrders.has(order.id) && (
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
                  </>
                )}

                {(order as any).order_complaints && (order as any).order_complaints.length > 0 && (
                  <View style={styles.complaintsSection}>
                    <Text style={styles.complaintsSectionTitle}>Rider Reports</Text>
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
                            {new Date(complaint.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit'
                            })}
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

                <View style={styles.orderDetails}>
                  <View style={styles.orderFooter}>
                    <View style={styles.timeInfo}>
                      <Clock size={16} color="#6b7280" />
                      <Text style={styles.timeText}>{new Date(order.created_at).toLocaleDateString()}</Text>
                    </View>
                    <Text style={styles.feeText}>₦{order.delivery_fee.toFixed(2)}</Text>
                  </View>
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
          </>
        )}

        {activeTab === 'history' && (
          <>
            <Text style={styles.sectionTitle}>Order History</Text>

            <View style={styles.searchContainer}>
              <Search size={20} color="#6b7280" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by order number, address, package..."
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

            {completedOrders.length === 0 ? (
              <View style={styles.emptyState}>
                <Package size={64} color="#d1d5db" />
                <Text style={styles.emptyText}>No completed orders</Text>
                <Text style={styles.emptySubtext}>Your order history will appear here</Text>
              </View>
            ) : (
              <>
                {!searchQuery && (
                  <View style={styles.historySummary}>
                    <View style={styles.summaryCard}>
                      <Text style={styles.summaryLabel}>Total Spent</Text>
                      <Text style={styles.summaryAmount}>
                        ₦{completedOrders
                          .filter(o => o.status === 'delivered')
                          .reduce((sum, o) => sum + o.delivery_fee, 0)
                          .toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.summaryCard}>
                      <Text style={styles.summaryLabel}>Completed</Text>
                      <Text style={styles.summaryAmount}>
                        {completedOrders.filter(o => o.status === 'delivered').length}
                      </Text>
                    </View>
                  </View>
                )}

                {filteredCompletedOrders.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Package size={64} color="#d1d5db" />
                    <Text style={styles.emptyText}>No orders found</Text>
                    <Text style={styles.emptySubtext}>Try adjusting your search</Text>
                  </View>
                ) : (
                  <>
                    {searchQuery && (
                      <Text style={styles.searchResults}>
                        Found {filteredCompletedOrders.length} {filteredCompletedOrders.length === 1 ? 'order' : 'orders'}
                      </Text>
                    )}
                    {filteredCompletedOrders.map((order) => (
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
                            : new Date(order.updated_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })
                          }
                        </Text>
                      </View>
                      <View style={styles.historyFeeContainer}>
                        <Text style={styles.historyFeeLabel}>Amount</Text>
                        <Text style={styles.historyFee}>₦{order.delivery_fee.toFixed(2)}</Text>
                      </View>
                    </View>

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
                        <Text style={styles.complaintsSectionTitle}>Rider Reports</Text>
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
                                {new Date(complaint.created_at).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit'
                                })}
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

                    {order.rider_name && (
                      <View style={styles.historyRiderInfo}>
                        <User size={12} color="#6b7280" />
                        <Text style={styles.historyRiderName}>
                          Delivered by {order.rider_name}
                        </Text>
                      </View>
                    )}

                    <TouchableOpacity
                      style={styles.receiptButton}
                      onPress={() => handleViewReceipt(order.id)}>
                      <Receipt size={16} color="#f97316" />
                      <Text style={styles.receiptButtonText}>View Receipt</Text>
                    </TouchableOpacity>
                  </View>
                    ))}
                  </>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New Order</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Pickup Address</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 10 Admiralty Way, near Mega Chicken, Lekki Phase 1, Lagos"
                  value={newOrder.pickupAddress}
                  onChangeText={(text) => setNewOrder({ ...newOrder, pickupAddress: text })}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Pickup Instructions (Optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="e.g. Gate code, Parking info, Contact person..."
                  value={newOrder.pickupInstructions}
                  onChangeText={(text) => setNewOrder({ ...newOrder, pickupInstructions: text })}
                  multiline
                  numberOfLines={2}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Delivery Address</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Plot 1234, opposite Eko Hotel, Victoria Island, Lagos"
                  value={newOrder.deliveryAddress}
                  onChangeText={(text) => setNewOrder({ ...newOrder, deliveryAddress: text })}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Delivery Instructions (Optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="e.g. Call on arrival, Floor/Unit info, Security procedures..."
                  value={newOrder.deliveryInstructions}
                  onChangeText={(text) => setNewOrder({ ...newOrder, deliveryInstructions: text })}
                  multiline
                  numberOfLines={2}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Recipient Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="John Doe"
                  value={newOrder.recipientName}
                  onChangeText={(text) => setNewOrder({ ...newOrder, recipientName: text })}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Recipient Phone</Text>
                <TextInput
                  style={styles.input}
                  placeholder="+1 234 567 8900"
                  value={newOrder.recipientPhone}
                  onChangeText={(text) => setNewOrder({ ...newOrder, recipientPhone: text })}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Package Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Describe your package"
                  value={newOrder.packageDescription}
                  onChangeText={(text) => setNewOrder({ ...newOrder, packageDescription: text })}
                  multiline
                  numberOfLines={3}
                />
              </View>

              {(newOrder.pickupAddress && newOrder.deliveryAddress) && (
                <View style={styles.distanceDisplayContainer}>
                  <View style={styles.distanceHeader}>
                    <Navigation size={20} color="#f97316" />
                    <Text style={styles.distanceTitle}>Delivery Distance</Text>
                  </View>
                  {calculatingDistance ? (
                    <View style={styles.calculatingContainer}>
                      <ActivityIndicator size="small" color="#f97316" />
                      <Text style={styles.calculatingText}>Calculating distance...</Text>
                    </View>
                  ) : geocodingError ? (
                    <View style={styles.errorContainer}>
                      <Text style={styles.errorText}>{geocodingError}</Text>
                    </View>
                  ) : calculatedDistance !== null ? (
                    <View style={styles.distanceValueContainer}>
                      <Text style={styles.distanceValue}>{calculatedDistance} km</Text>
                      <Text style={styles.distanceHint}>Distance calculated automatically</Text>
                    </View>
                  ) : null}
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Order Size (Optional)</Text>
                <View style={styles.orderTypesContainer}>
                  {['small', 'medium', 'large'].map((size) => (
                    <TouchableOpacity
                      key={size}
                      style={[
                        styles.orderTypeChip,
                        newOrder.orderSize === size && styles.orderTypeChipActive,
                      ]}
                      onPress={() => setNewOrder({ ...newOrder, orderSize: size as 'small' | 'medium' | 'large' })}>
                      <Text
                        style={[
                          styles.orderTypeChipText,
                          newOrder.orderSize === size && styles.orderTypeChipTextActive,
                        ]}>
                        {size.charAt(0).toUpperCase() + size.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Order Type (Optional)</Text>
                <View style={styles.orderTypesContainer}>
                  {orderTypeOptions.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.orderTypeChip,
                        newOrder.orderTypes.includes(type) && styles.orderTypeChipActive,
                      ]}
                      onPress={() => toggleOrderType(type)}>
                      <Text
                        style={[
                          styles.orderTypeChipText,
                          newOrder.orderTypes.includes(type) && styles.orderTypeChipTextActive,
                        ]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Promo Code (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter promo code"
                  value={newOrder.promoCode}
                  onChangeText={(text) => setNewOrder({ ...newOrder, promoCode: text.toUpperCase() })}
                  autoCapitalize="characters"
                />
                {validatedPromo && (
                  <Text style={styles.promoSuccess}>✓ {validatedPromo.promo_name} applied!</Text>
                )}
                {newOrder.promoCode && !validatedPromo && pricingBreakdown && !calculatingDistance && (
                  <Text style={styles.promoError}>Invalid or expired promo code</Text>
                )}
              </View>

              {pricingBreakdown && (
                <View style={styles.breakdownContainer}>
                  <PricingBreakdown breakdown={pricingBreakdown} />
                </View>
              )}

              <TouchableOpacity
                style={[styles.createButton, !pricingBreakdown && styles.createButtonDisabled]}
                onPress={proceedToCheckout}
                disabled={!pricingBreakdown}>
                <Text style={styles.createButtonText}>
                  {pricingBreakdown ? `Proceed to Checkout - ₦${pricingBreakdown.finalPrice.toFixed(2)}` : 'Calculate Price First'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {pricingBreakdown && (
        <CheckoutModal
          visible={checkoutModalVisible}
          onClose={() => setCheckoutModalVisible(false)}
          onConfirm={createOrderWithPayment}
          pricing={pricingBreakdown}
          userId={profile?.id || ''}
          userEmail={profile?.email || ''}
        />
      )}

      <BulkOrderModal
        visible={bulkModalVisible}
        onClose={() => setBulkModalVisible(false)}
        onSuccess={() => {
          loadOrders();
          setBulkModalVisible(false);
        }}
        customerId={profile?.id || ''}
        showToast={showToast}
      />

      {verifyingPayment ? (
        <>
          {console.log('RENDERING VERIFICATION MODAL')}
          <Modal visible={true} transparent animationType="fade">
            <View style={styles.verifyingOverlay}>
              <View style={styles.verifyingContainer}>
                <ActivityIndicator size="large" color="#f97316" />
                <Text style={styles.verifyingTitle}>Verifying Payment</Text>
                <Text style={styles.verifyingText}>
                  Please wait while we confirm your payment...
                </Text>
              </View>
            </View>
          </Modal>
        </>
      ) : null}

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        duration={8000}
        onDismiss={() => setToast({ ...toast, visible: false })}
      />

      <OrderReceiptModal
        visible={receiptModalVisible}
        onClose={handleCloseReceipt}
        orderId={selectedOrderForReceipt || ''}
      />
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
  greeting: {
    fontSize: 24,
    fontFamily: Fonts.poppinsBold,
    color: '#111827',
    letterSpacing: 0.3,
  },
  subGreeting: {
    fontSize: 14,
    fontFamily: Fonts.poppinsRegular,
    color: '#6b7280',
    marginTop: 4,
  },
  addButton: {
    backgroundColor: '#f97316',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
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
    fontSize: 28,
    fontFamily: Fonts.poppinsBold,
    color: '#f97316',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: Fonts.poppinsSemiBold,
    color: '#6b7280',
    letterSpacing: 0.5,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: Fonts.poppinsBold,
    color: '#111827',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontFamily: Fonts.poppinsSemiBold,
    color: '#6b7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: Fonts.poppinsRegular,
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
  statusText: {
    color: '#ffffff',
    fontSize: 12,
    fontFamily: Fonts.poppinsBold,
  },
  orderNumber: {
    fontSize: 12,
    color: '#6b7280',
    fontFamily: Fonts.poppinsSemiBold,
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
    fontFamily: Fonts.poppinsSemiBold,
    marginBottom: 4,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  addressText: {
    fontSize: 14,
    color: '#111827',
    fontFamily: Fonts.poppinsMedium,
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
    fontFamily: Fonts.poppinsRegular,
  },
  feeText: {
    fontSize: 16,
    fontFamily: Fonts.poppinsBold,
    color: '#f97316',
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
    padding: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: Fonts.poppinsBold,
    color: '#111827',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontFamily: Fonts.poppinsSemiBold,
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontFamily: Fonts.poppinsRegular,
    color: '#111827',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  createButton: {
    backgroundColor: '#f97316',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: Fonts.poppinsBold,
  },
  riderInfo: {
    backgroundColor: '#ffedd5',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  riderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  riderLabel: {
    fontSize: 12,
    fontFamily: Fonts.poppinsSemiBold,
    color: '#f97316',
  },
  riderDetails: {
    gap: 8,
  },
  riderDetail: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  riderName: {
    fontSize: 14,
    fontFamily: Fonts.poppinsBold,
    color: '#111827',
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  callButtonText: {
    fontSize: 13,
    fontFamily: Fonts.poppinsSemiBold,
    color: '#f97316',
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
    fontFamily: Fonts.poppinsSemiBold,
    color: '#6b7280',
  },
  trackingTimeline: {
    marginTop: 16,
    paddingLeft: 8,
    paddingBottom: 8,
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
    backgroundColor: '#f97316',
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
    fontFamily: Fonts.poppinsSemiBold,
    color: '#111827',
  },
  trackingTime: {
    fontSize: 12,
    fontFamily: Fonts.poppinsRegular,
    color: '#9ca3af',
  },
  trackingNotes: {
    fontSize: 13,
    fontFamily: Fonts.poppinsRegular,
    color: '#6b7280',
    lineHeight: 18,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  bulkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffedd5',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f97316',
  },
  bulkButtonText: {
    fontSize: 14,
    fontFamily: Fonts.poppinsSemiBold,
    color: '#f97316',
  },
  distanceDisplayContainer: {
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  distanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  distanceTitle: {
    fontSize: 14,
    fontFamily: Fonts.poppinsSemiBold,
    color: '#f97316',
  },
  calculatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  calculatingText: {
    fontSize: 14,
    fontFamily: Fonts.poppinsRegular,
    color: '#6b7280',
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    fontSize: 13,
    fontFamily: Fonts.poppinsMedium,
    color: '#dc2626',
  },
  distanceValueContainer: {
    gap: 4,
  },
  distanceValue: {
    fontSize: 24,
    fontFamily: Fonts.poppinsBold,
    color: '#f97316',
  },
  distanceHint: {
    fontSize: 12,
    fontFamily: Fonts.poppinsRegular,
    color: '#6b7280',
  },
  hint: {
    fontSize: 12,
    fontFamily: Fonts.poppinsRegular,
    color: '#9ca3af',
    marginTop: 4,
  },
  orderTypesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  orderTypeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  orderTypeChipActive: {
    backgroundColor: '#d1fae5',
    borderColor: '#f97316',
  },
  orderTypeChipText: {
    fontSize: 13,
    fontFamily: Fonts.poppinsSemiBold,
    color: '#6b7280',
  },
  orderTypeChipTextActive: {
    color: '#f97316',
  },
  promoSuccess: {
    fontSize: 13,
    color: '#f97316',
    fontFamily: Fonts.poppinsSemiBold,
    marginTop: 4,
  },
  promoError: {
    fontSize: 13,
    color: '#ef4444',
    fontFamily: Fonts.poppinsSemiBold,
    marginTop: 4,
  },
  breakdownContainer: {
    marginBottom: 20,
  },
  createButtonDisabled: {
    backgroundColor: '#9ca3af',
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
    fontFamily: Fonts.poppinsSemiBold,
    color: '#6b7280',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  historySummary: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#92400e',
    marginBottom: 8,
    fontFamily: Fonts.poppinsSemiBold,
  },
  summaryAmount: {
    fontSize: 22,
    fontFamily: Fonts.poppinsBold,
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
    fontFamily: Fonts.poppinsBold,
    color: '#111827',
    marginBottom: 4,
  },
  historyDate: {
    fontSize: 12,
    fontFamily: Fonts.poppinsRegular,
    color: '#6b7280',
  },
  historyFeeContainer: {
    alignItems: 'flex-end',
  },
  historyFeeLabel: {
    fontSize: 11,
    fontFamily: Fonts.poppinsRegular,
    color: '#6b7280',
    marginBottom: 4,
  },
  historyFee: {
    fontSize: 18,
    fontFamily: Fonts.poppinsBold,
    color: '#f97316',
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
    fontFamily: Fonts.poppinsMedium,
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
    fontFamily: Fonts.poppinsRegular,
    color: '#6b7280',
  },
  historyStatusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  historyStatusText: {
    fontSize: 11,
    fontFamily: Fonts.poppinsBold,
  },
  historyRiderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  historyRiderName: {
    fontSize: 12,
    fontFamily: Fonts.poppinsRegular,
    color: '#6b7280',
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
    fontFamily: Fonts.poppinsRegular,
    color: '#111827',
  },
  searchResults: {
    fontSize: 13,
    color: '#6b7280',
    fontFamily: Fonts.poppinsSemiBold,
    marginBottom: 12,
  },
  verifyingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
    elevation: 99999,
  },
  verifyingContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    gap: 16,
    minWidth: 280,
    elevation: 100000,
    zIndex: 100000,
  },
  verifyingTitle: {
    fontSize: 18,
    fontFamily: Fonts.poppinsBold,
    color: '#111827',
  },
  verifyingText: {
    fontSize: 14,
    fontFamily: Fonts.poppinsRegular,
    color: '#6b7280',
    textAlign: 'center',
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
    fontFamily: Fonts.poppinsBold,
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
    fontFamily: Fonts.poppinsBold,
  },
  complaintTime: {
    fontSize: 11,
    fontFamily: Fonts.poppinsRegular,
    color: '#6b7280',
  },
  complaintType: {
    fontSize: 12,
    fontFamily: Fonts.poppinsBold,
    color: '#b45309',
    marginBottom: 4,
  },
  complaintDescription: {
    fontSize: 13,
    fontFamily: Fonts.poppinsRegular,
    color: '#374151',
    lineHeight: 18,
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
    fontFamily: Fonts.poppinsSemiBold,
    color: '#f97316',
  },
});

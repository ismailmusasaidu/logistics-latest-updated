import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert, Platform, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { DollarSign, Plus, Edit2, Trash2, X, CheckCircle, XCircle, Calendar, Activity } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';

type DeliveryZone = {
  id: string;
  zone_name: string;
  min_distance: number;
  max_distance: number;
  base_price: number;
  is_active: boolean;
  updated_at: string;
};

type OrderTypeAdjustment = {
  id: string;
  adjustment_name: string;
  adjustment_type: 'flat' | 'percentage';
  adjustment_value: number;
  is_active: boolean;
};

type Promotion = {
  id: string;
  promo_code: string;
  promo_name: string;
  discount_type: 'flat' | 'percentage' | 'free_delivery';
  discount_value: number;
  min_order_value: number;
  is_active: boolean;
  start_date: string;
  end_date: string | null;
  usage_limit: number | null;
  usage_count: number;
};

type PricingLog = {
  id: string;
  table_name: string;
  field_name: string;
  old_value: string;
  new_value: string;
  changed_at: string;
  changed_by: string;
};

type OrderSizePricing = {
  id: string;
  size: 'medium' | 'large';
  additional_fee: number;
  is_active: boolean;
  updated_at: string;
};

export default function AdminPricing() {
  const { profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<'zones' | 'adjustments' | 'sizes' | 'promotions' | 'logs'>('zones');
  const [refreshing, setRefreshing] = useState(false);

  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [adjustments, setAdjustments] = useState<OrderTypeAdjustment[]>([]);
  const [orderSizes, setOrderSizes] = useState<OrderSizePricing[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [logs, setLogs] = useState<PricingLog[]>([]);

  const [showZoneModal, setShowZoneModal] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [showSizeModal, setShowSizeModal] = useState(false);
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const [zoneName, setZoneName] = useState('');
  const [minDistance, setMinDistance] = useState('');
  const [maxDistance, setMaxDistance] = useState('');
  const [basePrice, setBasePrice] = useState('');

  const [adjustmentName, setAdjustmentName] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<'flat' | 'percentage'>('flat');
  const [adjustmentValue, setAdjustmentValue] = useState('');

  const [sizeType, setSizeType] = useState<'medium' | 'large'>('medium');
  const [sizeFee, setSizeFee] = useState('');

  const [promoCode, setPromoCode] = useState('');
  const [promoName, setPromoName] = useState('');
  const [discountType, setDiscountType] = useState<'flat' | 'percentage' | 'free_delivery'>('flat');
  const [discountValue, setDiscountValue] = useState('');
  const [minOrderValue, setMinOrderValue] = useState('');
  const [usageLimit, setUsageLimit] = useState('');

  useEffect(() => {
    if (profile?.role === 'admin') {
      loadAllData();
    }
  }, [profile]);

  const loadAllData = async () => {
    await Promise.all([
      loadZones(),
      loadAdjustments(),
      loadOrderSizes(),
      loadPromotions(),
      loadLogs(),
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  };

  const loadZones = async () => {
    const { data, error } = await supabase
      .from('delivery_zones')
      .select('*')
      .order('min_distance');

    if (!error && data) {
      setZones(data);
    }
  };

  const loadAdjustments = async () => {
    const { data, error } = await supabase
      .from('order_type_adjustments')
      .select('*')
      .order('adjustment_name');

    if (!error && data) {
      setAdjustments(data);
    }
  };

  const loadOrderSizes = async () => {
    const { data, error } = await supabase
      .from('order_size_pricing')
      .select('*')
      .order('size');

    if (!error && data) {
      setOrderSizes(data);
    }
  };

  const loadPromotions = async () => {
    const { data, error } = await supabase
      .from('promotions')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setPromotions(data);
    }
  };

  const loadLogs = async () => {
    const { data, error } = await supabase
      .from('pricing_change_logs')
      .select('*')
      .order('changed_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      setLogs(data);
    }
  };

  const handleSaveZone = async () => {
    if (!zoneName || !minDistance || !maxDistance || !basePrice) {
      if (Platform.OS === 'web') {
        alert('Please fill in all fields');
      }
      return;
    }

    const zoneData = {
      zone_name: zoneName,
      min_distance: parseFloat(minDistance),
      max_distance: parseFloat(maxDistance),
      base_price: parseFloat(basePrice),
      is_active: true,
      created_by: profile?.id,
    };

    if (editingItem) {
      const { error } = await supabase
        .from('delivery_zones')
        .update(zoneData)
        .eq('id', editingItem.id);

      if (error) {
        console.error('Error updating zone:', error);
        return;
      }
    } else {
      const { error } = await supabase
        .from('delivery_zones')
        .insert(zoneData);

      if (error) {
        console.error('Error creating zone:', error);
        return;
      }
    }

    setShowZoneModal(false);
    resetZoneForm();
    loadZones();
  };

  const handleSaveAdjustment = async () => {
    if (!adjustmentName || !adjustmentValue) {
      if (Platform.OS === 'web') {
        alert('Please fill in all fields');
      }
      return;
    }

    const adjustmentData = {
      adjustment_name: adjustmentName,
      adjustment_type: adjustmentType,
      adjustment_value: parseFloat(adjustmentValue),
      is_active: true,
      created_by: profile?.id,
    };

    if (editingItem) {
      const { error } = await supabase
        .from('order_type_adjustments')
        .update(adjustmentData)
        .eq('id', editingItem.id);

      if (error) {
        console.error('Error updating adjustment:', error);
        return;
      }
    } else {
      const { error } = await supabase
        .from('order_type_adjustments')
        .insert(adjustmentData);

      if (error) {
        console.error('Error creating adjustment:', error);
        return;
      }
    }

    setShowAdjustmentModal(false);
    resetAdjustmentForm();
    loadAdjustments();
  };

  const handleSaveOrderSize = async () => {
    if (!sizeFee) {
      if (Platform.OS === 'web') {
        alert('Please fill in all fields');
      }
      return;
    }

    const sizeData = {
      size: sizeType,
      additional_fee: parseFloat(sizeFee),
      is_active: true,
    };

    if (editingItem) {
      const { error } = await supabase
        .from('order_size_pricing')
        .update(sizeData)
        .eq('id', editingItem.id);

      if (error) {
        console.error('Error updating size pricing:', error);
        return;
      }
    }

    setShowSizeModal(false);
    resetSizeForm();
    loadOrderSizes();
  };

  const handleSavePromotion = async () => {
    if (!promoCode || !promoName || !discountValue) {
      if (Platform.OS === 'web') {
        alert('Please fill in required fields');
      }
      return;
    }

    const promoData = {
      promo_code: promoCode.toUpperCase(),
      promo_name: promoName,
      discount_type: discountType,
      discount_value: parseFloat(discountValue),
      min_order_value: minOrderValue ? parseFloat(minOrderValue) : 0,
      usage_limit: usageLimit ? parseInt(usageLimit) : null,
      is_active: true,
      created_by: profile?.id,
    };

    if (editingItem) {
      const { error } = await supabase
        .from('promotions')
        .update(promoData)
        .eq('id', editingItem.id);

      if (error) {
        console.error('Error updating promotion:', error);
        return;
      }
    } else {
      const { error } = await supabase
        .from('promotions')
        .insert(promoData);

      if (error) {
        console.error('Error creating promotion:', error);
        return;
      }
    }

    setShowPromotionModal(false);
    resetPromotionForm();
    loadPromotions();
  };

  const handleToggleZone = async (zone: DeliveryZone) => {
    const { error } = await supabase
      .from('delivery_zones')
      .update({ is_active: !zone.is_active })
      .eq('id', zone.id);

    if (!error) {
      loadZones();
    }
  };

  const handleToggleAdjustment = async (adjustment: OrderTypeAdjustment) => {
    const { error } = await supabase
      .from('order_type_adjustments')
      .update({ is_active: !adjustment.is_active })
      .eq('id', adjustment.id);

    if (!error) {
      loadAdjustments();
    }
  };

  const handleToggleOrderSize = async (size: OrderSizePricing) => {
    const { error } = await supabase
      .from('order_size_pricing')
      .update({ is_active: !size.is_active })
      .eq('id', size.id);

    if (!error) {
      loadOrderSizes();
    }
  };

  const handleTogglePromotion = async (promotion: Promotion) => {
    const { error } = await supabase
      .from('promotions')
      .update({ is_active: !promotion.is_active })
      .eq('id', promotion.id);

    if (!error) {
      loadPromotions();
    }
  };

  const handleDeleteZone = async (zoneId: string) => {
    const { error } = await supabase
      .from('delivery_zones')
      .delete()
      .eq('id', zoneId);

    if (!error) {
      loadZones();
    }
  };

  const handleDeleteAdjustment = async (adjustmentId: string) => {
    const { error } = await supabase
      .from('order_type_adjustments')
      .delete()
      .eq('id', adjustmentId);

    if (!error) {
      loadAdjustments();
    }
  };

  const handleDeletePromotion = async (promotionId: string) => {
    const { error } = await supabase
      .from('promotions')
      .delete()
      .eq('id', promotionId);

    if (!error) {
      loadPromotions();
    }
  };

  const openEditZone = (zone: DeliveryZone) => {
    setEditingItem(zone);
    setZoneName(zone.zone_name);
    setMinDistance(zone.min_distance.toString());
    setMaxDistance(zone.max_distance.toString());
    setBasePrice(zone.base_price.toString());
    setShowZoneModal(true);
  };

  const openEditAdjustment = (adjustment: OrderTypeAdjustment) => {
    setEditingItem(adjustment);
    setAdjustmentName(adjustment.adjustment_name);
    setAdjustmentType(adjustment.adjustment_type);
    setAdjustmentValue(adjustment.adjustment_value.toString());
    setShowAdjustmentModal(true);
  };

  const openEditOrderSize = (size: OrderSizePricing) => {
    setEditingItem(size);
    setSizeType(size.size);
    setSizeFee(size.additional_fee.toString());
    setShowSizeModal(true);
  };

  const openEditPromotion = (promotion: Promotion) => {
    setEditingItem(promotion);
    setPromoCode(promotion.promo_code);
    setPromoName(promotion.promo_name);
    setDiscountType(promotion.discount_type);
    setDiscountValue(promotion.discount_value.toString());
    setMinOrderValue(promotion.min_order_value.toString());
    setUsageLimit(promotion.usage_limit?.toString() || '');
    setShowPromotionModal(true);
  };

  const resetZoneForm = () => {
    setEditingItem(null);
    setZoneName('');
    setMinDistance('');
    setMaxDistance('');
    setBasePrice('');
  };

  const resetAdjustmentForm = () => {
    setEditingItem(null);
    setAdjustmentName('');
    setAdjustmentType('flat');
    setAdjustmentValue('');
  };

  const resetSizeForm = () => {
    setEditingItem(null);
    setSizeType('medium');
    setSizeFee('');
  };

  const resetPromotionForm = () => {
    setEditingItem(null);
    setPromoCode('');
    setPromoName('');
    setDiscountType('flat');
    setDiscountValue('');
    setMinOrderValue('');
    setUsageLimit('');
  };

  const renderZones = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Delivery Zones</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            resetZoneForm();
            setShowZoneModal(true);
          }}>
          <Plus size={20} color="#ffffff" />
          <Text style={styles.addButtonText}>Add Zone</Text>
        </TouchableOpacity>
      </View>

      {zones.map((zone) => (
        <View key={zone.id} style={[styles.card, !zone.is_active && styles.cardInactive]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{zone.zone_name}</Text>
            <View style={styles.cardActions}>
              <TouchableOpacity onPress={() => handleToggleZone(zone)} style={styles.iconButton}>
                {zone.is_active ? (
                  <CheckCircle size={20} color="#f97316" />
                ) : (
                  <XCircle size={20} color="#ef4444" />
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openEditZone(zone)} style={styles.iconButton}>
                <Edit2 size={20} color="#3b82f6" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDeleteZone(zone.id)} style={styles.iconButton}>
                <Trash2 size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardText}>Distance: {zone.min_distance} - {zone.max_distance} km</Text>
            <Text style={styles.cardPrice}>₦{zone.base_price.toLocaleString()}</Text>
            <Text style={styles.cardDate}>Updated: {new Date(zone.updated_at).toLocaleDateString()}</Text>
          </View>
        </View>
      ))}
    </View>
  );

  const renderAdjustments = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Order Type Adjustments</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            resetAdjustmentForm();
            setShowAdjustmentModal(true);
          }}>
          <Plus size={20} color="#ffffff" />
          <Text style={styles.addButtonText}>Add Adjustment</Text>
        </TouchableOpacity>
      </View>

      {adjustments.map((adjustment) => (
        <View key={adjustment.id} style={[styles.card, !adjustment.is_active && styles.cardInactive]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{adjustment.adjustment_name}</Text>
            <View style={styles.cardActions}>
              <TouchableOpacity onPress={() => handleToggleAdjustment(adjustment)} style={styles.iconButton}>
                {adjustment.is_active ? (
                  <CheckCircle size={20} color="#f97316" />
                ) : (
                  <XCircle size={20} color="#ef4444" />
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openEditAdjustment(adjustment)} style={styles.iconButton}>
                <Edit2 size={20} color="#3b82f6" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDeleteAdjustment(adjustment.id)} style={styles.iconButton}>
                <Trash2 size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardText}>
              {adjustment.adjustment_type === 'flat'
                ? `+₦${adjustment.adjustment_value.toLocaleString()}`
                : `+${adjustment.adjustment_value}%`
              }
            </Text>
          </View>
        </View>
      ))}
    </View>
  );

  const renderOrderSizes = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Order Size Pricing</Text>
        <Text style={styles.sectionDescription}>Additional charges for medium and large orders</Text>
      </View>

      {orderSizes.map((size) => (
        <View key={size.id} style={[styles.card, !size.is_active && styles.cardInactive]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{size.size.charAt(0).toUpperCase() + size.size.slice(1)} Size</Text>
            <View style={styles.cardActions}>
              <TouchableOpacity onPress={() => handleToggleOrderSize(size)} style={styles.iconButton}>
                {size.is_active ? (
                  <CheckCircle size={20} color="#f97316" />
                ) : (
                  <XCircle size={20} color="#ef4444" />
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openEditOrderSize(size)} style={styles.iconButton}>
                <Edit2 size={20} color="#3b82f6" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardText}>Additional Fee: ₦{size.additional_fee.toLocaleString()}</Text>
            <Text style={styles.cardDate}>Updated: {new Date(size.updated_at).toLocaleDateString()}</Text>
          </View>
        </View>
      ))}
    </View>
  );

  const renderPromotions = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Promotions & Discounts</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            resetPromotionForm();
            setShowPromotionModal(true);
          }}>
          <Plus size={20} color="#ffffff" />
          <Text style={styles.addButtonText}>Add Promotion</Text>
        </TouchableOpacity>
      </View>

      {promotions.map((promotion) => (
        <View key={promotion.id} style={[styles.card, !promotion.is_active && styles.cardInactive]}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardTitle}>{promotion.promo_name}</Text>
              <Text style={styles.promoCode}>{promotion.promo_code}</Text>
            </View>
            <View style={styles.cardActions}>
              <TouchableOpacity onPress={() => handleTogglePromotion(promotion)} style={styles.iconButton}>
                {promotion.is_active ? (
                  <CheckCircle size={20} color="#f97316" />
                ) : (
                  <XCircle size={20} color="#ef4444" />
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openEditPromotion(promotion)} style={styles.iconButton}>
                <Edit2 size={20} color="#3b82f6" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDeletePromotion(promotion.id)} style={styles.iconButton}>
                <Trash2 size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardText}>
              {promotion.discount_type === 'free_delivery'
                ? 'Free Delivery'
                : promotion.discount_type === 'flat'
                  ? `₦${promotion.discount_value.toLocaleString()} off`
                  : `${promotion.discount_value}% off`
              }
            </Text>
            <Text style={styles.cardText}>Min Order: ₦{promotion.min_order_value.toLocaleString()}</Text>
            <Text style={styles.cardText}>
              Usage: {promotion.usage_count} / {promotion.usage_limit || '∞'}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );

  const renderLogs = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Pricing Change Logs</Text>
      </View>

      {logs.map((log) => (
        <View key={log.id} style={styles.logCard}>
          <View style={styles.logHeader}>
            <Activity size={16} color="#8b5cf6" />
            <Text style={styles.logTable}>{log.table_name}</Text>
          </View>
          <Text style={styles.logField}>{log.field_name}</Text>
          <View style={styles.logChanges}>
            <Text style={styles.logOld}>{log.old_value || 'null'}</Text>
            <Text style={styles.logArrow}>→</Text>
            <Text style={styles.logNew}>{log.new_value}</Text>
          </View>
          <Text style={styles.logDate}>{new Date(log.changed_at).toLocaleString()}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <DollarSign size={32} color="#8b5cf6" />
          <Text style={styles.headerTitle}>Pricing Dashboard</Text>
        </View>
        <Text style={styles.headerSubtitle}>Manage delivery charges and promotions</Text>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'zones' && styles.tabActive]}
          onPress={() => setActiveTab('zones')}>
          <Text style={[styles.tabText, activeTab === 'zones' && styles.tabTextActive]}>Zones</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'adjustments' && styles.tabActive]}
          onPress={() => setActiveTab('adjustments')}>
          <Text style={[styles.tabText, activeTab === 'adjustments' && styles.tabTextActive]}>Adjustments</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'sizes' && styles.tabActive]}
          onPress={() => setActiveTab('sizes')}>
          <Text style={[styles.tabText, activeTab === 'sizes' && styles.tabTextActive]}>Sizes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'promotions' && styles.tabActive]}
          onPress={() => setActiveTab('promotions')}>
          <Text style={[styles.tabText, activeTab === 'promotions' && styles.tabTextActive]}>Promotions</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'logs' && styles.tabActive]}
          onPress={() => setActiveTab('logs')}>
          <Text style={[styles.tabText, activeTab === 'logs' && styles.tabTextActive]}>Logs</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8b5cf6" />
        }>
        {activeTab === 'zones' && renderZones()}
        {activeTab === 'adjustments' && renderAdjustments()}
        {activeTab === 'sizes' && renderOrderSizes()}
        {activeTab === 'promotions' && renderPromotions()}
        {activeTab === 'logs' && renderLogs()}
      </ScrollView>

      <Modal visible={showZoneModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingItem ? 'Edit Zone' : 'Add Zone'}</Text>
              <TouchableOpacity onPress={() => setShowZoneModal(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Zone Name (e.g., Zone A - 0-3km)"
              value={zoneName}
              onChangeText={setZoneName}
            />
            <TextInput
              style={styles.input}
              placeholder="Min Distance (km)"
              value={minDistance}
              onChangeText={setMinDistance}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={styles.input}
              placeholder="Max Distance (km)"
              value={maxDistance}
              onChangeText={setMaxDistance}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={styles.input}
              placeholder="Base Price (₦)"
              value={basePrice}
              onChangeText={setBasePrice}
              keyboardType="decimal-pad"
            />

            <TouchableOpacity style={styles.modalButton} onPress={handleSaveZone}>
              <Text style={styles.modalButtonText}>Save Zone</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showAdjustmentModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingItem ? 'Edit Adjustment' : 'Add Adjustment'}</Text>
              <TouchableOpacity onPress={() => setShowAdjustmentModal(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Adjustment Name"
              value={adjustmentName}
              onChangeText={setAdjustmentName}
            />

            <View style={styles.typeContainer}>
              <TouchableOpacity
                style={[styles.typeButton, adjustmentType === 'flat' && styles.typeButtonActive]}
                onPress={() => setAdjustmentType('flat')}>
                <Text style={[styles.typeText, adjustmentType === 'flat' && styles.typeTextActive]}>Flat Amount</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeButton, adjustmentType === 'percentage' && styles.typeButtonActive]}
                onPress={() => setAdjustmentType('percentage')}>
                <Text style={[styles.typeText, adjustmentType === 'percentage' && styles.typeTextActive]}>Percentage</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder={adjustmentType === 'flat' ? 'Amount (₦)' : 'Percentage (%)'}
              value={adjustmentValue}
              onChangeText={setAdjustmentValue}
              keyboardType="decimal-pad"
            />

            <TouchableOpacity style={styles.modalButton} onPress={handleSaveAdjustment}>
              <Text style={styles.modalButtonText}>Save Adjustment</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showSizeModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Order Size Pricing</Text>
              <TouchableOpacity onPress={() => setShowSizeModal(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.typeContainer}>
              <TouchableOpacity
                style={[styles.typeButton, sizeType === 'medium' && styles.typeButtonActive]}
                onPress={() => setSizeType('medium')}
                disabled>
                <Text style={[styles.typeText, sizeType === 'medium' && styles.typeTextActive]}>Medium</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeButton, sizeType === 'large' && styles.typeButtonActive]}
                onPress={() => setSizeType('large')}
                disabled>
                <Text style={[styles.typeText, sizeType === 'large' && styles.typeTextActive]}>Large</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Additional Fee (₦)"
              value={sizeFee}
              onChangeText={setSizeFee}
              keyboardType="decimal-pad"
            />

            <TouchableOpacity style={styles.modalButton} onPress={handleSaveOrderSize}>
              <Text style={styles.modalButtonText}>Save Pricing</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showPromotionModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingItem ? 'Edit Promotion' : 'Add Promotion'}</Text>
              <TouchableOpacity onPress={() => setShowPromotionModal(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Promo Code"
              value={promoCode}
              onChangeText={setPromoCode}
              autoCapitalize="characters"
            />
            <TextInput
              style={styles.input}
              placeholder="Promotion Name"
              value={promoName}
              onChangeText={setPromoName}
            />

            <View style={styles.typeContainer}>
              <TouchableOpacity
                style={[styles.typeButton, discountType === 'flat' && styles.typeButtonActive]}
                onPress={() => setDiscountType('flat')}>
                <Text style={[styles.typeText, discountType === 'flat' && styles.typeTextActive]}>Flat</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeButton, discountType === 'percentage' && styles.typeButtonActive]}
                onPress={() => setDiscountType('percentage')}>
                <Text style={[styles.typeText, discountType === 'percentage' && styles.typeTextActive]}>%</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeButton, discountType === 'free_delivery' && styles.typeButtonActive]}
                onPress={() => setDiscountType('free_delivery')}>
                <Text style={[styles.typeText, discountType === 'free_delivery' && styles.typeTextActive]}>Free</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Discount Value"
              value={discountValue}
              onChangeText={setDiscountValue}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={styles.input}
              placeholder="Min Order Value (₦)"
              value={minOrderValue}
              onChangeText={setMinOrderValue}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={styles.input}
              placeholder="Usage Limit (optional)"
              value={usageLimit}
              onChangeText={setUsageLimit}
              keyboardType="number-pad"
            />

            <TouchableOpacity style={styles.modalButton} onPress={handleSavePromotion}>
              <Text style={styles.modalButtonText}>Save Promotion</Text>
            </TouchableOpacity>
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
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#8b5cf6',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  tabTextActive: {
    color: '#8b5cf6',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardInactive: {
    opacity: 0.6,
    backgroundColor: '#f9fafb',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    padding: 4,
  },
  cardContent: {
    gap: 4,
  },
  cardText: {
    fontSize: 14,
    color: '#6b7280',
  },
  cardPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f97316',
    marginTop: 4,
  },
  cardDate: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  promoCode: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8b5cf6',
    marginTop: 2,
  },
  logCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#8b5cf6',
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  logTable: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8b5cf6',
    textTransform: 'capitalize',
  },
  logField: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  logChanges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  logOld: {
    fontSize: 14,
    color: '#ef4444',
    textDecorationLine: 'line-through',
  },
  logArrow: {
    fontSize: 14,
    color: '#6b7280',
  },
  logNew: {
    fontSize: 14,
    color: '#f97316',
    fontWeight: '600',
  },
  logDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 500,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  typeContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  typeButtonActive: {
    borderColor: '#8b5cf6',
    backgroundColor: '#f3e8ff',
  },
  typeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  typeTextActive: {
    color: '#8b5cf6',
  },
  modalButton: {
    backgroundColor: '#8b5cf6',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  modalButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});

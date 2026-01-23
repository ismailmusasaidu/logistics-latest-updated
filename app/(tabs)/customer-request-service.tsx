import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Package, Truck, X, CheckCircle, Clock } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Toast } from '@/components/Toast';
import { Fonts } from '@/constants/fonts';

interface ServiceRequest {
  id: string;
  full_name: string;
  phone: string;
  pickup_area: string;
  dropoff_area: string;
  service_type: 'gadget_delivery' | 'relocation';
  status: 'pending' | 'contacted' | 'confirmed' | 'completed' | 'cancelled';
  created_at: string;
}

export default function CustomerRequestService() {
  const { profile } = useAuth();
  const [modalVisible, setModalVisible] = useState(false);
  const [serviceType, setServiceType] = useState<'gadget_delivery' | 'relocation'>('gadget_delivery');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [pickupArea, setPickupArea] = useState('');
  const [dropoffArea, setDropoffArea] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [myRequests, setMyRequests] = useState<ServiceRequest[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  }>({
    visible: false,
    message: '',
    type: 'success',
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    setToast({ visible: true, message, type });
  };

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
      loadMyRequests();
    }
  }, [profile]);

  const loadMyRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('service_requests')
        .select('*')
        .eq('customer_id', profile?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMyRequests(data || []);
    } catch (error) {
      console.error('Error loading requests:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleOpenModal = (type: 'gadget_delivery' | 'relocation') => {
    setServiceType(type);
    setPickupArea('');
    setDropoffArea('');
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    if (!fullName.trim() || !phone.trim() || !pickupArea.trim() || !dropoffArea.trim()) {
      showToast('Please fill in all fields', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const { error } = await supabase
        .from('service_requests')
        .insert({
          customer_id: profile?.id,
          full_name: fullName.trim(),
          phone: phone.trim(),
          pickup_area: pickupArea.trim(),
          dropoff_area: dropoffArea.trim(),
          service_type: serviceType,
        });

      if (error) throw error;

      setModalVisible(false);
      showToast('Your request has been received. Danhausa team will contact you shortly.', 'success');
      loadMyRequests();
      setPickupArea('');
      setDropoffArea('');
    } catch (error: any) {
      console.error('Error submitting request:', error);
      showToast(error.message || 'Failed to submit request', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getServiceTypeLabel = (type: string) => {
    return type === 'gadget_delivery' ? 'Gadget Delivery' : 'Relocation Service';
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: '#f59e0b',
      contacted: '#3b82f6',
      confirmed: '#8b5cf6',
      completed: '#10b981',
      cancelled: '#ef4444',
    };
    return colors[status] || '#6b7280';
  };

  const getStatusLabel = (status: string) => {
    return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Request Service</Text>
          <Text style={styles.subtitle}>Simple logistics and relocation</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadMyRequests(); }} />}>

        <View style={styles.servicesSection}>
          <Text style={styles.sectionTitle}>Choose a Service</Text>

          <TouchableOpacity
            style={styles.serviceCard}
            onPress={() => handleOpenModal('gadget_delivery')}>
            <View style={styles.serviceIconContainer}>
              <Package size={32} color="#f97316" />
            </View>
            <View style={styles.serviceInfo}>
              <Text style={styles.serviceTitle}>Gadget Delivery</Text>
              <Text style={styles.serviceDescription}>
                Fast and safe delivery of phones, laptops, electronics, and fragile items.
              </Text>
            </View>
            <View style={styles.serviceButton}>
              <Text style={styles.serviceButtonText}>Request</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.serviceCard}
            onPress={() => handleOpenModal('relocation')}>
            <View style={styles.serviceIconContainer}>
              <Truck size={32} color="#8b5cf6" />
            </View>
            <View style={styles.serviceInfo}>
              <Text style={styles.serviceTitle}>Relocation Service</Text>
              <Text style={styles.serviceDescription}>
                Move your home or shop easily with Danhausa relocation service.
              </Text>
            </View>
            <View style={styles.serviceButton}>
              <Text style={styles.serviceButtonText}>Request</Text>
            </View>
          </TouchableOpacity>
        </View>

        {myRequests.length > 0 && (
          <View style={styles.requestsSection}>
            <Text style={styles.sectionTitle}>My Requests</Text>

            {myRequests.map((request) => (
              <View key={request.id} style={styles.requestCard}>
                <View style={styles.requestHeader}>
                  <Text style={styles.requestType}>{getServiceTypeLabel(request.service_type)}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(request.status) }]}>
                    <Text style={styles.statusText}>{getStatusLabel(request.status)}</Text>
                  </View>
                </View>

                <View style={styles.requestDetails}>
                  <View style={styles.requestRow}>
                    <Text style={styles.requestLabel}>Pickup:</Text>
                    <Text style={styles.requestValue}>{request.pickup_area}</Text>
                  </View>
                  <View style={styles.requestRow}>
                    <Text style={styles.requestLabel}>Drop-off:</Text>
                    <Text style={styles.requestValue}>{request.dropoff_area}</Text>
                  </View>
                  <View style={styles.requestRow}>
                    <Text style={styles.requestLabel}>Phone:</Text>
                    <Text style={styles.requestValue}>{request.phone}</Text>
                  </View>
                </View>

                <View style={styles.requestFooter}>
                  <Clock size={14} color="#6b7280" />
                  <Text style={styles.requestDate}>
                    {new Date(request.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Request {serviceType === 'gadget_delivery' ? 'Gadget Delivery' : 'Relocation Service'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalDescription}>
                Fill in your details and our team will contact you shortly to discuss full requirements.
              </Text>

              <Text style={styles.label}>Full Name *</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Enter your full name"
                placeholderTextColor="#9ca3af"
              />

              <Text style={styles.label}>Phone Number *</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="Enter your phone number"
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
              />

              <Text style={styles.label}>Pickup Area *</Text>
              <TextInput
                style={styles.input}
                value={pickupArea}
                onChangeText={setPickupArea}
                placeholder="e.g. 10 Admiralty Way, near Mega Chicken, Lekki Phase 1, Lagos"
                placeholderTextColor="#9ca3af"
              />

              <Text style={styles.label}>Drop-off Area *</Text>
              <TextInput
                style={styles.input}
                value={dropoffArea}
                onChangeText={setDropoffArea}
                placeholder="e.g. Plot 1234, opposite Eko Hotel, Victoria Island, Lagos"
                placeholderTextColor="#9ca3af"
              />

              <View style={styles.infoBox}>
                <CheckCircle size={20} color="#10b981" />
                <Text style={styles.infoText}>
                  Our team will call you to collect full details and provide a quote.
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={submitting}>
                <Text style={styles.submitButtonText}>
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </Text>
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
  title: {
    fontSize: 28,
    fontFamily: Fonts.poppinsBold,
    color: '#111827',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: Fonts.poppinsRegular,
    color: '#6b7280',
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  servicesSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: Fonts.poppinsBold,
    color: '#111827',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  serviceCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  serviceIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  serviceInfo: {
    marginBottom: 16,
  },
  serviceTitle: {
    fontSize: 20,
    fontFamily: Fonts.poppinsBold,
    color: '#111827',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  serviceDescription: {
    fontSize: 14,
    fontFamily: Fonts.poppinsRegular,
    color: '#6b7280',
    lineHeight: 20,
  },
  serviceButton: {
    backgroundColor: '#f97316',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  serviceButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: Fonts.poppinsBold,
  },
  requestsSection: {
    marginBottom: 24,
  },
  requestCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  requestType: {
    fontSize: 16,
    fontFamily: Fonts.poppinsBold,
    color: '#111827',
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
  requestDetails: {
    gap: 8,
    marginBottom: 12,
  },
  requestRow: {
    flexDirection: 'row',
    gap: 8,
  },
  requestLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontFamily: Fonts.poppinsSemiBold,
    width: 70,
  },
  requestValue: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.poppinsMedium,
    color: '#111827',
  },
  requestFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  requestDate: {
    fontSize: 12,
    fontFamily: Fonts.poppinsRegular,
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
    maxHeight: '85%',
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
    fontFamily: Fonts.poppinsBold,
    color: '#111827',
    flex: 1,
  },
  modalBody: {
    padding: 24,
  },
  modalDescription: {
    fontSize: 14,
    fontFamily: Fonts.poppinsRegular,
    color: '#6b7280',
    marginBottom: 20,
    lineHeight: 20,
  },
  label: {
    fontSize: 14,
    fontFamily: Fonts.poppinsSemiBold,
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    fontFamily: Fonts.poppinsRegular,
    color: '#111827',
    marginBottom: 16,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#dcfce7',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.poppinsRegular,
    color: '#166534',
    lineHeight: 20,
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
    fontFamily: Fonts.poppinsSemiBold,
    color: '#374151',
  },
  submitButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f97316',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontFamily: Fonts.poppinsBold,
    color: '#ffffff',
  },
});

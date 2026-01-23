import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Modal, TextInput } from 'react-native';
import { Package, Truck, Filter, X, Phone, MapPin, User, Clock, Edit2 } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { Toast } from '@/components/Toast';

interface ServiceRequest {
  id: string;
  customer_id: string;
  full_name: string;
  phone: string;
  pickup_area: string;
  dropoff_area: string;
  service_type: 'gadget_delivery' | 'relocation';
  status: 'pending' | 'contacted' | 'confirmed' | 'completed' | 'cancelled';
  notes: string | null;
  created_at: string;
  customer?: {
    full_name: string;
    email: string;
    phone: string;
  };
}

export default function AdminServiceRequests() {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<ServiceRequest[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>('all');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [editStatus, setEditStatus] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
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
    loadRequests();
  }, []);

  useEffect(() => {
    let filtered = requests;

    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }

    if (serviceTypeFilter !== 'all') {
      filtered = filtered.filter(r => r.service_type === serviceTypeFilter);
    }

    setFilteredRequests(filtered);
  }, [requests, statusFilter, serviceTypeFilter]);

  const loadRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('service_requests')
        .select(`
          *,
          customer:profiles!service_requests_customer_id_fkey(full_name, email, phone)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error('Error loading requests:', error);
      showToast('Failed to load requests', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const handleEdit = (request: ServiceRequest) => {
    setSelectedRequest(request);
    setEditStatus(request.status);
    setEditNotes(request.notes || '');
    setEditModalVisible(true);
  };

  const handleUpdate = async () => {
    if (!selectedRequest) return;

    try {
      const { error } = await supabase
        .from('service_requests')
        .update({
          status: editStatus,
          notes: editNotes.trim() || null,
        })
        .eq('id', selectedRequest.id);

      if (error) throw error;

      showToast('Request updated successfully', 'success');
      setEditModalVisible(false);
      loadRequests();
    } catch (error: any) {
      console.error('Error updating request:', error);
      showToast(error.message || 'Failed to update request', 'error');
    }
  };

  const getServiceTypeLabel = (type: string) => {
    return type === 'gadget_delivery' ? 'Gadget Delivery' : 'Relocation Service';
  };

  const getServiceIcon = (type: string) => {
    return type === 'gadget_delivery' ? Package : Truck;
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

  const statusOptions = [
    { label: 'All Status', value: 'all' },
    { label: 'Pending', value: 'pending' },
    { label: 'Contacted', value: 'contacted' },
    { label: 'Confirmed', value: 'confirmed' },
    { label: 'Completed', value: 'completed' },
    { label: 'Cancelled', value: 'cancelled' },
  ];

  const serviceTypeOptions = [
    { label: 'All Services', value: 'all' },
    { label: 'Gadget Delivery', value: 'gadget_delivery' },
    { label: 'Relocation', value: 'relocation' },
  ];

  const statusUpdateOptions: Array<'pending' | 'contacted' | 'confirmed' | 'completed' | 'cancelled'> = [
    'pending',
    'contacted',
    'confirmed',
    'completed',
    'cancelled',
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Service Requests</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{filteredRequests.length}</Text>
        </View>
      </View>

      <View style={styles.filtersContainer}>
        <View style={styles.filterRow}>
          <Filter size={18} color="#6b7280" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {statusOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[styles.filterButton, statusFilter === option.value && styles.filterButtonActive]}
                onPress={() => setStatusFilter(option.value)}>
                <Text style={[styles.filterText, statusFilter === option.value && styles.filterTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.filterRow}>
          <View style={styles.filterSpacer} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {serviceTypeOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[styles.filterButton, serviceTypeFilter === option.value && styles.filterButtonActive]}
                onPress={() => setServiceTypeFilter(option.value)}>
                <Text style={[styles.filterText, serviceTypeFilter === option.value && styles.filterTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadRequests(); }} />}>

        {filteredRequests.length === 0 ? (
          <View style={styles.emptyState}>
            <Package size={64} color="#d1d5db" />
            <Text style={styles.emptyText}>No service requests found</Text>
            <Text style={styles.emptySubtext}>
              {statusFilter !== 'all' || serviceTypeFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Requests will appear here'}
            </Text>
          </View>
        ) : (
          filteredRequests.map((request) => {
            const ServiceIcon = getServiceIcon(request.service_type);
            return (
              <View key={request.id} style={styles.requestCard}>
                <View style={styles.requestHeader}>
                  <View style={styles.serviceTypeContainer}>
                    <ServiceIcon size={20} color={request.service_type === 'gadget_delivery' ? '#f97316' : '#8b5cf6'} />
                    <Text style={styles.serviceTypeText}>{getServiceTypeLabel(request.service_type)}</Text>
                  </View>
                  <View style={styles.headerActions}>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(request.status) }]}>
                      <Text style={styles.statusText}>{getStatusLabel(request.status)}</Text>
                    </View>
                    <TouchableOpacity style={styles.editButton} onPress={() => handleEdit(request)}>
                      <Edit2 size={18} color="#3b82f6" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.requestDetails}>
                  <View style={styles.detailRow}>
                    <User size={16} color="#6b7280" />
                    <Text style={styles.detailLabel}>Customer:</Text>
                    <Text style={styles.detailValue}>{request.full_name}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Phone size={16} color="#6b7280" />
                    <Text style={styles.detailLabel}>Phone:</Text>
                    <Text style={styles.detailValue}>{request.phone}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <MapPin size={16} color="#f97316" />
                    <Text style={styles.detailLabel}>Pickup:</Text>
                    <Text style={styles.detailValue}>{request.pickup_area}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <MapPin size={16} color="#ef4444" />
                    <Text style={styles.detailLabel}>Drop-off:</Text>
                    <Text style={styles.detailValue}>{request.dropoff_area}</Text>
                  </View>

                  {request.notes && (
                    <View style={styles.notesContainer}>
                      <Text style={styles.notesLabel}>Notes:</Text>
                      <Text style={styles.notesText}>{request.notes}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.requestFooter}>
                  <Clock size={14} color="#6b7280" />
                  <Text style={styles.footerText}>
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
            );
          })
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
              <Text style={styles.modalTitle}>Update Request Status</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalInfo}>
                Request from: {selectedRequest?.full_name}
              </Text>

              <Text style={styles.label}>Status *</Text>
              <View style={styles.statusSelector}>
                {statusUpdateOptions.map((status) => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.statusOption,
                      editStatus === status && styles.statusOptionActive
                    ]}
                    onPress={() => setEditStatus(status)}>
                    <Text style={[
                      styles.statusOptionText,
                      editStatus === status && styles.statusOptionTextActive
                    ]}>
                      {getStatusLabel(status)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Admin Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={editNotes}
                onChangeText={setEditNotes}
                placeholder="Add notes about this request (optional)"
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={4}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setEditModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleUpdate}>
                <Text style={styles.saveButtonText}>Update</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        duration={3000}
        onDismiss={() => setToast({ ...toast, visible: false })}
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
  filtersContainer: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  filterSpacer: {
    width: 18,
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
  requestCard: {
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
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  serviceTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  serviceTypeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  editButton: {
    padding: 4,
  },
  requestDetails: {
    gap: 12,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600',
    width: 70,
  },
  detailValue: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
  },
  notesContainer: {
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400e',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: '#78350f',
    lineHeight: 20,
  },
  requestFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  footerText: {
    fontSize: 12,
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
    maxHeight: '75%',
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
  modalInfo: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  statusSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  statusOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
  },
  statusOptionActive: {
    backgroundColor: '#8b5cf6',
    borderColor: '#8b5cf6',
  },
  statusOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  statusOptionTextActive: {
    color: '#ffffff',
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
    height: 100,
    textAlignVertical: 'top',
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
});

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Modal, TextInput, Platform } from 'react-native';
import { Bike, Star, TrendingUp, MapPin, Edit2, Trash2, X, UserPlus, CheckCircle, XCircle, Phone, MapPinIcon, AlertTriangle } from 'lucide-react-native';
import { supabase, Rider } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Toast } from '@/components/Toast';
import { ConfirmDialog } from '@/components/ConfirmDialog';

type RiderWithProfile = Rider & {
  profiles?: {
    full_name: string;
    email: string;
  };
  phone_number?: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  approval_status?: string;
  rejection_reason?: string;
  zone?: {
    id: string;
    name: string;
  };
};

interface Zone {
  id: string;
  name: string;
  is_active: boolean;
}

export default function AdminRiders() {
  const { profile } = useAuth();
  const [riders, setRiders] = useState<RiderWithProfile[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [rejectionModalVisible, setRejectionModalVisible] = useState(false);
  const [selectedRider, setSelectedRider] = useState<RiderWithProfile | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
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

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    setToast({ visible: true, message, type });
  };

  useEffect(() => {
    loadRiders();
    loadZones();
  }, []);

  const loadRiders = async () => {
    try {
      const { data, error } = await supabase
        .from('riders')
        .select('*, profiles(full_name, email), zone:zones(id, name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRiders(data || []);
    } catch (error) {
      console.error('Error loading riders:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const loadZones = async () => {
    try {
      const { data, error } = await supabase
        .from('zones')
        .select('id, name, is_active')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setZones(data || []);
    } catch (error) {
      console.error('Error loading zones:', error);
    }
  };

  const handleEdit = (rider: RiderWithProfile) => {
    setSelectedRider(rider);
    setEditModalVisible(true);
  };

  const handleUpdate = async () => {
    if (!selectedRider) return;

    try {
      const { error } = await supabase
        .from('riders')
        .update({
          status: selectedRider.status,
          vehicle_type: selectedRider.vehicle_type,
          vehicle_number: selectedRider.vehicle_number,
          license_number: selectedRider.license_number,
          rating: selectedRider.rating,
          zone_id: selectedRider.zone_id,
        })
        .eq('id', selectedRider.id);

      if (error) throw error;

      setEditModalVisible(false);
      setSelectedRider(null);
      showToast('Rider updated successfully!', 'success');
      loadRiders();
    } catch (error) {
      console.error('Error updating rider:', error);
      showToast('Failed to update rider', 'error');
    }
  };

  const handleDelete = (riderId: string) => {
    setConfirmDialog({
      visible: true,
      title: 'Delete Rider',
      message: 'Are you sure you want to delete this rider? This action cannot be undone.',
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('riders')
            .delete()
            .eq('id', riderId);

          if (error) throw error;
          showToast('Rider deleted successfully', 'success');
          loadRiders();
        } catch (error) {
          console.error('Error deleting rider:', error);
          showToast('Failed to delete rider', 'error');
        }
      },
    });
  };

  const handleToggleStatus = async (rider: RiderWithProfile) => {
    const newStatus = rider.status === 'online' ? 'offline' : 'online';

    try {
      const { error } = await supabase
        .from('riders')
        .update({ status: newStatus })
        .eq('id', rider.id);

      if (error) throw error;
      showToast('Rider status updated', 'success');
      loadRiders();
    } catch (error) {
      console.error('Error updating status:', error);
      showToast('Failed to update rider status', 'error');
    }
  };

  const handleApprove = async (riderId: string) => {
    try {
      const { error } = await supabase
        .from('riders')
        .update({
          approval_status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: profile?.id,
          rejection_reason: null,
        })
        .eq('id', riderId);

      if (error) throw error;

      showToast('Rider approved successfully!', 'success');
      loadRiders();
      setDetailModalVisible(false);
    } catch (error) {
      console.error('Error approving rider:', error);
      showToast('Failed to approve rider', 'error');
    }
  };

  const handleReject = async () => {
    if (!selectedRider || !rejectionReason.trim()) {
      setRejectionReason('');
      showToast('Please provide a reason for rejection', 'warning');
      return;
    }

    try {
      const { error } = await supabase
        .from('riders')
        .update({
          approval_status: 'rejected',
          rejection_reason: rejectionReason,
          status: 'offline',
        })
        .eq('id', selectedRider.id);

      if (error) throw error;

      showToast('Rider application rejected', 'info');
      setRejectionModalVisible(false);
      setDetailModalVisible(false);
      setRejectionReason('');
      loadRiders();
    } catch (error) {
      console.error('Error rejecting rider:', error);
      showToast('Failed to reject rider', 'error');
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      offline: '#6b7280',
      available: '#f97316',
      busy: '#f59e0b',
    };
    return colors[status] || '#6b7280';
  };

  const getStatusLabel = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const getApprovalColor = (approval: string) => {
    const colors: Record<string, string> = {
      pending: '#f59e0b',
      approved: '#f97316',
      rejected: '#ef4444',
    };
    return colors[approval] || '#6b7280';
  };

  const filteredRiders = filter === 'all'
    ? riders
    : filter === 'pending'
      ? riders.filter(r => r.approval_status === 'pending')
      : riders.filter(r => r.status === filter && r.approval_status === 'approved');

  const statusOptions = ['offline', 'online'];
  const vehicleTypes = ['bike', 'motorcycle', 'car', 'van'];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Riders</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{riders.length}</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScrollContainer}>
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
            onPress={() => setFilter('all')}>
            <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'pending' && styles.filterButtonPending]}
            onPress={() => setFilter('pending')}>
            <Text style={[styles.filterText, filter === 'pending' && styles.filterTextPending]}>Pending</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'available' && styles.filterButtonActive]}
            onPress={() => setFilter('available')}>
            <Text style={[styles.filterText, filter === 'available' && styles.filterTextActive]}>Online</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'busy' && styles.filterButtonActive]}
            onPress={() => setFilter('busy')}>
            <Text style={[styles.filterText, filter === 'busy' && styles.filterTextActive]}>Busy</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'offline' && styles.filterButtonActive]}
            onPress={() => setFilter('offline')}>
            <Text style={[styles.filterText, filter === 'offline' && styles.filterTextActive]}>Offline</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadRiders(); }} />}>

        {filteredRiders.length === 0 ? (
          <View style={styles.emptyState}>
            <Bike size={64} color="#d1d5db" />
            <Text style={styles.emptyText}>No riders found</Text>
            <Text style={styles.emptySubtext}>Riders will appear here</Text>
          </View>
        ) : (
          filteredRiders.map((rider) => (
            <View key={rider.id} style={styles.riderCard}>
              <View style={styles.riderHeader}>
                <View style={styles.riderInfo}>
                  <View style={styles.avatar}>
                    <Bike size={24} color="#ffffff" />
                  </View>
                  <View style={styles.riderDetails}>
                    <Text style={styles.riderName}>{rider.profiles?.full_name || 'Unknown'}</Text>
                    <Text style={styles.riderEmail}>{rider.profiles?.email}</Text>
                  </View>
                </View>
                <View style={styles.headerActions}>
                  {rider.approval_status && (
                    <View style={[styles.approvalBadge, { backgroundColor: getApprovalColor(rider.approval_status) }]}>
                      <Text style={styles.approvalBadgeText}>
                        {rider.approval_status.charAt(0).toUpperCase() + rider.approval_status.slice(1)}
                      </Text>
                    </View>
                  )}
                  {rider.approval_status === 'approved' && (
                    <TouchableOpacity onPress={() => handleToggleStatus(rider)}>
                      <View style={[styles.statusDot, { backgroundColor: getStatusColor(rider.status) }]} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Star size={18} color="#fbbf24" fill="#fbbf24" />
                  <Text style={styles.statValue}>{rider.rating.toFixed(1)}</Text>
                </View>
                <View style={styles.statItem}>
                  <TrendingUp size={18} color="#f97316" />
                  <Text style={styles.statValue}>{rider.total_deliveries} deliveries</Text>
                </View>
              </View>

              <View style={styles.vehicleInfo}>
                {rider.phone_number && rider.phone_number.trim() && (
                  <View style={styles.vehicleRow}>
                    <View style={styles.vehicleLabelWithIcon}>
                      <Phone size={14} color="#6b7280" />
                      <Text style={styles.vehicleLabel}>Phone</Text>
                    </View>
                    <Text style={styles.vehicleValue}>{rider.phone_number}</Text>
                  </View>
                )}
                {rider.address && rider.address.trim() && (
                  <View style={styles.vehicleRow}>
                    <View style={styles.vehicleLabelWithIcon}>
                      <MapPinIcon size={14} color="#6b7280" />
                      <Text style={styles.vehicleLabel}>Address</Text>
                    </View>
                    <Text style={styles.vehicleValue} numberOfLines={1}>{rider.address}</Text>
                  </View>
                )}
                <View style={styles.vehicleRow}>
                  <Text style={styles.vehicleLabel}>Vehicle</Text>
                  <Text style={styles.vehicleValue}>{rider.vehicle_type.toUpperCase()}</Text>
                </View>
                <View style={styles.vehicleRow}>
                  <Text style={styles.vehicleLabel}>Vehicle #</Text>
                  <Text style={styles.vehicleValue}>
                    {(rider.vehicle_number && rider.vehicle_number.trim()) || 'Not provided'}
                  </Text>
                </View>
                <View style={styles.vehicleRow}>
                  <Text style={styles.vehicleLabel}>License #</Text>
                  <Text style={styles.vehicleValue}>
                    {(rider.license_number && rider.license_number.trim()) || 'Not provided'}
                  </Text>
                </View>
                {rider.emergency_contact_name && rider.emergency_contact_name.trim() && (
                  <View style={styles.vehicleRow}>
                    <Text style={styles.vehicleLabel}>Emergency Contact</Text>
                    <Text style={styles.vehicleValue}>{rider.emergency_contact_name}</Text>
                  </View>
                )}
                {rider.emergency_contact_phone && rider.emergency_contact_phone.trim() && (
                  <View style={styles.vehicleRow}>
                    <Text style={styles.vehicleLabel}>Emergency Phone</Text>
                    <Text style={styles.vehicleValue}>{rider.emergency_contact_phone}</Text>
                  </View>
                )}
                {rider.zone && (
                  <View style={styles.vehicleRow}>
                    <Text style={styles.vehicleLabel}>Assigned Zone</Text>
                    <View style={styles.zoneBadge}>
                      <MapPin size={12} color="#f97316" />
                      <Text style={styles.zoneValue}>{rider.zone.name}</Text>
                    </View>
                  </View>
                )}
              </View>

              <View style={styles.actions}>
                {rider.approval_status === 'pending' ? (
                  <>
                    <TouchableOpacity
                      style={styles.viewDetailsButton}
                      onPress={() => {
                        setSelectedRider(rider);
                        setDetailModalVisible(true);
                      }}>
                      <AlertTriangle size={18} color="#f59e0b" />
                      <Text style={styles.viewDetailsButtonText}>Review Application</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity style={styles.editButton} onPress={() => handleEdit(rider)}>
                      <Edit2 size={18} color="#3b82f6" />
                      <Text style={styles.editButtonText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(rider.id)}>
                      <Trash2 size={18} color="#ef4444" />
                      <Text style={styles.deleteButtonText}>Delete</Text>
                    </TouchableOpacity>
                  </>
                )}
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
              <Text style={styles.modalTitle}>Edit Rider</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Rider Name</Text>
              <Text style={styles.readonlyValue}>{selectedRider?.profiles?.full_name}</Text>

              <Text style={styles.label}>Email</Text>
              <Text style={styles.readonlyValue}>{selectedRider?.profiles?.email}</Text>

              <Text style={styles.label}>Status</Text>
              <View style={styles.statusSelector}>
                {statusOptions.map((status) => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.statusOption,
                      selectedRider?.status === status && styles.statusOptionActive
                    ]}
                    onPress={() => setSelectedRider(prev => prev ? { ...prev, status: status as 'offline' | 'online' } : null)}>
                    <Text style={[
                      styles.statusOptionText,
                      selectedRider?.status === status && styles.statusOptionTextActive
                    ]}>
                      {getStatusLabel(status)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Vehicle Type</Text>
              <View style={styles.statusSelector}>
                {vehicleTypes.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.statusOption,
                      selectedRider?.vehicle_type === type && styles.statusOptionActive
                    ]}
                    onPress={() => setSelectedRider(prev => prev ? { ...prev, vehicle_type: type as 'bike' | 'motorcycle' | 'car' | 'van' } : null)}>
                    <Text style={[
                      styles.statusOptionText,
                      selectedRider?.vehicle_type === type && styles.statusOptionTextActive
                    ]}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Vehicle Number</Text>
              <TextInput
                style={styles.input}
                value={selectedRider?.vehicle_number}
                onChangeText={(text) => setSelectedRider(prev => prev ? { ...prev, vehicle_number: text } : null)}
                placeholder="Enter vehicle number"
              />

              <Text style={styles.label}>License Number</Text>
              <TextInput
                style={styles.input}
                value={selectedRider?.license_number}
                onChangeText={(text) => setSelectedRider(prev => prev ? { ...prev, license_number: text } : null)}
                placeholder="Enter license number"
              />

              <Text style={styles.label}>Rating</Text>
              <TextInput
                style={styles.input}
                value={selectedRider?.rating.toString()}
                onChangeText={(text) => setSelectedRider(prev => prev ? { ...prev, rating: parseFloat(text) || 0 } : null)}
                placeholder="Enter rating"
                keyboardType="decimal-pad"
              />

              <Text style={styles.label}>Assigned Zone</Text>
              <View style={styles.statusSelector}>
                <TouchableOpacity
                  style={[
                    styles.statusOption,
                    !selectedRider?.zone_id && styles.statusOptionActive
                  ]}
                  onPress={() => setSelectedRider(prev => prev ? { ...prev, zone_id: null } : null)}>
                  <Text style={[
                    styles.statusOptionText,
                    !selectedRider?.zone_id && styles.statusOptionTextActive
                  ]}>
                    No Zone
                  </Text>
                </TouchableOpacity>
                {zones.map((zone) => (
                  <TouchableOpacity
                    key={zone.id}
                    style={[
                      styles.statusOption,
                      selectedRider?.zone_id === zone.id && styles.statusOptionActive
                    ]}
                    onPress={() => setSelectedRider(prev => prev ? { ...prev, zone_id: zone.id } : null)}>
                    <Text style={[
                      styles.statusOptionText,
                      selectedRider?.zone_id === zone.id && styles.statusOptionTextActive
                    ]}>
                      {zone.name}
                    </Text>
                  </TouchableOpacity>
                ))}
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

      <Modal
        visible={detailModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setDetailModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Rider Application</Text>
              <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.detailSection}>
                <Text style={styles.sectionTitle}>Personal Information</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Name</Text>
                  <Text style={styles.detailValue}>{selectedRider?.profiles?.full_name || 'N/A'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Email</Text>
                  <Text style={styles.detailValue}>{selectedRider?.profiles?.email || 'N/A'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Phone</Text>
                  <Text style={styles.detailValue}>
                    {(selectedRider?.phone_number && selectedRider.phone_number.trim()) || 'Not provided'}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Address</Text>
                  <Text style={styles.detailValue}>
                    {(selectedRider?.address && selectedRider.address.trim()) || 'Not provided'}
                  </Text>
                </View>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.sectionTitle}>Vehicle Information</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Vehicle Type</Text>
                  <Text style={styles.detailValue}>
                    {selectedRider?.vehicle_type ? selectedRider.vehicle_type.toUpperCase() : 'N/A'}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Vehicle Number</Text>
                  <Text style={styles.detailValue}>
                    {(selectedRider?.vehicle_number && selectedRider.vehicle_number.trim()) || 'Not provided'}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>License Number</Text>
                  <Text style={styles.detailValue}>
                    {(selectedRider?.license_number && selectedRider.license_number.trim()) || 'Not provided'}
                  </Text>
                </View>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.sectionTitle}>Emergency Contact</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Contact Name</Text>
                  <Text style={styles.detailValue}>
                    {(selectedRider?.emergency_contact_name && selectedRider.emergency_contact_name.trim()) || 'Not provided'}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Contact Phone</Text>
                  <Text style={styles.detailValue}>
                    {(selectedRider?.emergency_contact_phone && selectedRider.emergency_contact_phone.trim()) || 'Not provided'}
                  </Text>
                </View>
              </View>

              {selectedRider?.rejection_reason && selectedRider.rejection_reason.trim() && (
                <View style={[styles.detailSection, { backgroundColor: '#fef2f2' }]}>
                  <Text style={styles.sectionTitle}>Rejection Reason</Text>
                  <Text style={styles.detailValue}>{selectedRider.rejection_reason}</Text>
                </View>
              )}
            </ScrollView>

            {selectedRider?.approval_status === 'pending' && (
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.rejectButton}
                  onPress={() => {
                    setRejectionModalVisible(true);
                  }}>
                  <XCircle size={20} color="#ffffff" />
                  <Text style={styles.rejectButtonText}>Reject</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.approveButton}
                  onPress={() => handleApprove(selectedRider.id)}>
                  <CheckCircle size={20} color="#ffffff" />
                  <Text style={styles.approveButtonText}>Approve</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={rejectionModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setRejectionModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.rejectionModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reject Application</Text>
              <TouchableOpacity onPress={() => setRejectionModalVisible(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.label}>Reason for Rejection</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Please provide a reason for rejection..."
                value={rejectionReason}
                onChangeText={setRejectionReason}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setRejectionModalVisible(false);
                  setRejectionReason('');
                }}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmRejectButton} onPress={handleReject}>
                <Text style={styles.confirmRejectButtonText}>Confirm Rejection</Text>
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
    backgroundColor: '#3b82f6',
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
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  filterScrollContainer: {
    backgroundColor: '#ffffff',
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  filterTextActive: {
    color: '#ffffff',
  },
  filterButtonPending: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  filterTextPending: {
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
  riderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  riderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  riderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  riderDetails: {
    flex: 1,
  },
  riderName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  riderEmail: {
    fontSize: 13,
    color: '#6b7280',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  statusDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  vehicleInfo: {
    gap: 8,
    marginBottom: 16,
  },
  vehicleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vehicleLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '600',
  },
  vehicleLabelWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  vehicleValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  zoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff7ed',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  zoneValue: {
    fontSize: 12,
    color: '#9a3412',
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3b82f6',
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fef2f2',
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
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
    marginTop: 8,
  },
  readonlyValue: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    marginBottom: 8,
  },
  statusSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
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
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
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
    backgroundColor: '#3b82f6',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  approvalBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 8,
  },
  approvalBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  viewDetailsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  viewDetailsButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f59e0b',
  },
  detailSection: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  detailRow: {
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '600',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f97316',
  },
  approveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#ef4444',
  },
  rejectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  rejectionModalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '60%',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    minHeight: 100,
  },
  confirmRejectButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#ef4444',
    alignItems: 'center',
  },
  confirmRejectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});

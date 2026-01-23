import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Modal, TextInput } from 'react-native';
import { MapPin, Plus, Edit2, Trash2, X, Users } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { Toast } from '@/components/Toast';
import { ConfirmDialog } from '@/components/ConfirmDialog';

interface Zone {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Rider {
  id: string;
  zone_id: string | null;
  profile: {
    full_name: string;
  };
}

export default function AdminZones() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [riderAssignModalVisible, setRiderAssignModalVisible] = useState(false);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [zoneName, setZoneName] = useState('');
  const [zoneDescription, setZoneDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [assigningRiders, setAssigningRiders] = useState<Set<string>>(new Set());
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
    loadZones();
    loadRiders();
  }, []);

  const loadZones = async () => {
    try {
      const { data, error } = await supabase
        .from('zones')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setZones(data || []);
    } catch (error) {
      console.error('Error loading zones:', error);
      showToast('Failed to load zones', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const loadRiders = async () => {
    try {
      const { data, error } = await supabase
        .from('riders')
        .select(`
          id,
          zone_id,
          profile:profiles!riders_user_id_fkey(full_name)
        `);

      if (error) throw error;
      setRiders(data as any || []);
    } catch (error) {
      console.error('Error loading riders:', error);
    }
  };

  const handleCreate = () => {
    setSelectedZone(null);
    setZoneName('');
    setZoneDescription('');
    setIsActive(true);
    setModalVisible(true);
  };

  const handleEdit = (zone: Zone) => {
    setSelectedZone(zone);
    setZoneName(zone.name);
    setZoneDescription(zone.description || '');
    setIsActive(zone.is_active);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!zoneName.trim()) {
      showToast('Zone name is required', 'error');
      return;
    }

    try {
      if (selectedZone) {
        const { error } = await supabase
          .from('zones')
          .update({
            name: zoneName.trim(),
            description: zoneDescription.trim() || null,
            is_active: isActive,
          })
          .eq('id', selectedZone.id);

        if (error) throw error;
        showToast('Zone updated successfully', 'success');
      } else {
        const { error } = await supabase
          .from('zones')
          .insert({
            name: zoneName.trim(),
            description: zoneDescription.trim() || null,
            is_active: isActive,
          });

        if (error) throw error;
        showToast('Zone created successfully', 'success');
      }

      setModalVisible(false);
      loadZones();
    } catch (error: any) {
      console.error('Error saving zone:', error);
      showToast(error.message || 'Failed to save zone', 'error');
    }
  };

  const handleDelete = (zone: Zone) => {
    const ridersInZone = riders.filter(r => r.zone_id === zone.id);

    setConfirmDialog({
      visible: true,
      title: 'Delete Zone',
      message: ridersInZone.length > 0
        ? `This zone has ${ridersInZone.length} rider(s) assigned. They will be unassigned. Are you sure you want to delete this zone?`
        : 'Are you sure you want to delete this zone? This action cannot be undone.',
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('zones')
            .delete()
            .eq('id', zone.id);

          if (error) throw error;
          showToast('Zone deleted successfully', 'success');
          loadZones();
          loadRiders();
        } catch (error: any) {
          console.error('Error deleting zone:', error);
          showToast(error.message || 'Failed to delete zone', 'error');
        }
      },
    });
  };

  const handleAssignRiders = (zone: Zone) => {
    setSelectedZone(zone);
    const ridersInZone = riders.filter(r => r.zone_id === zone.id);
    setAssigningRiders(new Set(ridersInZone.map(r => r.id)));
    setRiderAssignModalVisible(true);
  };

  const toggleRiderAssignment = (riderId: string) => {
    setAssigningRiders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(riderId)) {
        newSet.delete(riderId);
      } else {
        newSet.add(riderId);
      }
      return newSet;
    });
  };

  const handleSaveRiderAssignments = async () => {
    if (!selectedZone) return;

    try {
      const updates = riders.map(rider => {
        const shouldBeInZone = assigningRiders.has(rider.id);
        const isCurrentlyInZone = rider.zone_id === selectedZone.id;

        if (shouldBeInZone && !isCurrentlyInZone) {
          return supabase
            .from('riders')
            .update({ zone_id: selectedZone.id })
            .eq('id', rider.id);
        } else if (!shouldBeInZone && isCurrentlyInZone) {
          return supabase
            .from('riders')
            .update({ zone_id: null })
            .eq('id', rider.id);
        }
        return null;
      }).filter(Boolean);

      await Promise.all(updates);

      showToast('Rider assignments updated successfully', 'success');
      setRiderAssignModalVisible(false);
      loadRiders();
    } catch (error: any) {
      console.error('Error updating rider assignments:', error);
      showToast(error.message || 'Failed to update assignments', 'error');
    }
  };

  const getRidersCount = (zoneId: string) => {
    return riders.filter(r => r.zone_id === zoneId).length;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Delivery Zones</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleCreate}>
          <Plus size={20} color="#ffffff" />
          <Text style={styles.addButtonText}>Add Zone</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadZones(); loadRiders(); }} />}>

        {zones.length === 0 ? (
          <View style={styles.emptyState}>
            <MapPin size={64} color="#d1d5db" />
            <Text style={styles.emptyText}>No zones created yet</Text>
            <Text style={styles.emptySubtext}>Create zones to organize riders by delivery areas</Text>
          </View>
        ) : (
          zones.map((zone) => (
            <View key={zone.id} style={styles.zoneCard}>
              <View style={styles.zoneHeader}>
                <View style={styles.zoneInfo}>
                  <View style={styles.zoneTitleRow}>
                    <Text style={styles.zoneName}>{zone.name}</Text>
                    {!zone.is_active && (
                      <View style={styles.inactiveBadge}>
                        <Text style={styles.inactiveBadgeText}>Inactive</Text>
                      </View>
                    )}
                  </View>
                  {zone.description && (
                    <Text style={styles.zoneDescription}>{zone.description}</Text>
                  )}
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.actionButton} onPress={() => handleEdit(zone)}>
                    <Edit2 size={18} color="#3b82f6" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(zone)}>
                    <Trash2 size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.zoneStats}>
                <View style={styles.statItem}>
                  <Users size={18} color="#8b5cf6" />
                  <Text style={styles.statText}>{getRidersCount(zone.id)} Rider{getRidersCount(zone.id) !== 1 ? 's' : ''}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.assignButton}
                onPress={() => handleAssignRiders(zone)}>
                <Users size={18} color="#8b5cf6" />
                <Text style={styles.assignButtonText}>Manage Riders</Text>
              </TouchableOpacity>
            </View>
          ))
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
                {selectedZone ? 'Edit Zone' : 'Create Zone'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Zone Name *</Text>
              <TextInput
                style={styles.input}
                value={zoneName}
                onChangeText={setZoneName}
                placeholder="e.g., Downtown, North Side, East District"
                placeholderTextColor="#9ca3af"
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={zoneDescription}
                onChangeText={setZoneDescription}
                placeholder="Optional description of the zone coverage area"
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={3}
              />

              <View style={styles.switchRow}>
                <Text style={styles.label}>Active</Text>
                <TouchableOpacity
                  style={[styles.switch, isActive && styles.switchActive]}
                  onPress={() => setIsActive(!isActive)}>
                  <View style={[styles.switchThumb, isActive && styles.switchThumbActive]} />
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>
                  {selectedZone ? 'Update' : 'Create'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={riderAssignModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setRiderAssignModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Assign Riders to {selectedZone?.name}
              </Text>
              <TouchableOpacity onPress={() => setRiderAssignModalVisible(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.helperText}>
                Select riders to assign to this zone. Riders can only be in one zone at a time.
              </Text>

              {riders.length === 0 ? (
                <View style={styles.emptyRiders}>
                  <Users size={48} color="#d1d5db" />
                  <Text style={styles.emptyRidersText}>No riders available</Text>
                </View>
              ) : (
                riders.map((rider) => (
                  <TouchableOpacity
                    key={rider.id}
                    style={[
                      styles.riderItem,
                      assigningRiders.has(rider.id) && styles.riderItemSelected
                    ]}
                    onPress={() => toggleRiderAssignment(rider.id)}>
                    <View style={styles.riderInfo}>
                      <Text style={styles.riderName}>{rider.profile.full_name}</Text>
                      {rider.zone_id && rider.zone_id !== selectedZone?.id && (
                        <Text style={styles.riderCurrentZone}>
                          Currently in: {zones.find(z => z.id === rider.zone_id)?.name || 'Unknown Zone'}
                        </Text>
                      )}
                    </View>
                    <View style={[
                      styles.checkbox,
                      assigningRiders.has(rider.id) && styles.checkboxChecked
                    ]}>
                      {assigningRiders.has(rider.id) && (
                        <Text style={styles.checkmark}>✓</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setRiderAssignModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveRiderAssignments}>
                <Text style={styles.saveButtonText}>Save Assignments</Text>
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
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
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
    textAlign: 'center',
  },
  zoneCard: {
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
  zoneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  zoneInfo: {
    flex: 1,
  },
  zoneTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  zoneName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  inactiveBadge: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  inactiveBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#991b1b',
  },
  zoneDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
  zoneStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600',
  },
  assignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f5f3ff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#8b5cf6',
  },
  assignButtonText: {
    fontSize: 14,
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
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switch: {
    width: 52,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
    padding: 2,
  },
  switchActive: {
    backgroundColor: '#8b5cf6',
  },
  switchThumb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ffffff',
  },
  switchThumbActive: {
    transform: [{ translateX: 20 }],
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
  helperText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  emptyRiders: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyRidersText: {
    fontSize: 16,
    color: '#9ca3af',
    marginTop: 12,
  },
  riderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    marginBottom: 12,
  },
  riderItemSelected: {
    borderColor: '#8b5cf6',
    backgroundColor: '#f5f3ff',
  },
  riderInfo: {
    flex: 1,
  },
  riderName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  riderCurrentZone: {
    fontSize: 12,
    color: '#6b7280',
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    borderColor: '#8b5cf6',
    backgroundColor: '#8b5cf6',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});

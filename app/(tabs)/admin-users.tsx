import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Modal, TextInput, Platform } from 'react-native';
import { Users, Mail, Phone, Shield, Edit2, Trash2, X, Plus } from 'lucide-react-native';
import { supabase, Profile } from '@/lib/supabase';
import { Toast } from '@/components/Toast';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export default function AdminUsers() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
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
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleEdit = (user: Profile) => {
    setSelectedUser(user);
    setEditModalVisible(true);
  };

  const handleUpdate = async () => {
    if (!selectedUser) return;

    try {
      const oldRole = users.find(u => u.id === selectedUser.id)?.role;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: selectedUser.full_name,
          phone: selectedUser.phone,
          role: selectedUser.role,
        })
        .eq('id', selectedUser.id);

      if (profileError) throw profileError;

      if (oldRole !== 'rider' && selectedUser.role === 'rider') {
        const { data: existingRider } = await supabase
          .from('riders')
          .select('id')
          .eq('user_id', selectedUser.id)
          .maybeSingle();

        if (!existingRider) {
          const { error: riderError } = await supabase
            .from('riders')
            .insert({
              user_id: selectedUser.id,
              vehicle_type: 'bike',
              vehicle_number: 'N/A',
              license_number: 'N/A',
              status: 'offline',
              rating: 5.0,
              total_deliveries: 0,
            });

          if (riderError) throw riderError;
        }
      }

      if (oldRole === 'rider' && selectedUser.role !== 'rider') {
        const { error: deleteRiderError } = await supabase
          .from('riders')
          .delete()
          .eq('user_id', selectedUser.id);

        if (deleteRiderError) throw deleteRiderError;
      }

      setEditModalVisible(false);
      setSelectedUser(null);
      showToast('User updated successfully!', 'success');
      loadUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      showToast('Failed to update user', 'error');
    }
  };

  const handleDelete = (userId: string) => {
    setConfirmDialog({
      visible: true,
      title: 'Delete User',
      message: 'Are you sure you want to delete this user? This action cannot be undone.',
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('profiles')
            .delete()
            .eq('id', userId);

          if (error) throw error;
          showToast('User deleted successfully', 'success');
          loadUsers();
        } catch (error) {
          console.error('Error deleting user:', error);
          showToast('Failed to delete user', 'error');
        }
      },
    });
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      admin: '#8b5cf6',
      rider: '#3b82f6',
      customer: '#f97316',
    };
    return colors[role] || '#6b7280';
  };

  const roleOptions: Array<'customer' | 'rider' | 'admin'> = ['customer', 'rider', 'admin'];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Users</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{users.length}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadUsers(); }} />}>

        {users.length === 0 ? (
          <View style={styles.emptyState}>
            <Users size={64} color="#d1d5db" />
            <Text style={styles.emptyText}>No users found</Text>
            <Text style={styles.emptySubtext}>Users will appear here</Text>
          </View>
        ) : (
          users.map((user) => (
            <View key={user.id} style={styles.userCard}>
              <View style={styles.userHeader}>
                <View style={[styles.roleBadge, { backgroundColor: getRoleBadgeColor(user.role) }]}>
                  <Shield size={14} color="#ffffff" />
                  <Text style={styles.roleText}>{user.role.toUpperCase()}</Text>
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.actionButton} onPress={() => handleEdit(user)}>
                    <Edit2 size={18} color="#3b82f6" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(user.id)}>
                    <Trash2 size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.userName}>{user.full_name}</Text>

              <View style={styles.userDetails}>
                <View style={styles.detailRow}>
                  <Mail size={16} color="#6b7280" />
                  <Text style={styles.detailText}>{user.email}</Text>
                </View>

                {user.phone && (
                  <View style={styles.detailRow}>
                    <Phone size={16} color="#6b7280" />
                    <Text style={styles.detailText}>{user.phone}</Text>
                  </View>
                )}

                <View style={styles.userFooter}>
                  <Text style={styles.dateText}>
                    Joined {new Date(user.created_at).toLocaleDateString()}
                  </Text>
                </View>
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
              <Text style={styles.modalTitle}>Edit User</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                value={selectedUser?.full_name}
                onChangeText={(text) => setSelectedUser(prev => prev ? { ...prev, full_name: text } : null)}
                placeholder="Enter full name"
              />

              <Text style={styles.label}>Email (Read-only)</Text>
              <TextInput
                style={[styles.input, styles.inputDisabled]}
                value={selectedUser?.email}
                editable={false}
              />

              <Text style={styles.label}>Phone</Text>
              <TextInput
                style={styles.input}
                value={selectedUser?.phone || ''}
                onChangeText={(text) => setSelectedUser(prev => prev ? { ...prev, phone: text } : null)}
                placeholder="Enter phone number"
                keyboardType="phone-pad"
              />

              <Text style={styles.label}>Role</Text>
              <View style={styles.roleSelector}>
                {roleOptions.map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[
                      styles.roleOption,
                      selectedUser?.role === role && styles.roleOptionActive,
                      { borderColor: getRoleBadgeColor(role) }
                    ]}
                    onPress={() => setSelectedUser(prev => prev ? { ...prev, role } : null)}>
                    <Text style={[
                      styles.roleOptionText,
                      selectedUser?.role === role && styles.roleOptionTextActive
                    ]}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
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
  userCard: {
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
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  roleText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  userDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#6b7280',
  },
  userFooter: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  dateText: {
    fontSize: 12,
    color: '#9ca3af',
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
  inputDisabled: {
    backgroundColor: '#f3f4f6',
    color: '#6b7280',
  },
  roleSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  roleOption: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  roleOptionActive: {
    backgroundColor: '#f3f4f6',
  },
  roleOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  roleOptionTextActive: {
    color: '#111827',
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

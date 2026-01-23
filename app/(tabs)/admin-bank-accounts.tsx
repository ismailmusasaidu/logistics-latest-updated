import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert, Platform, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Building2, Plus, Edit2, Trash2, X, CheckCircle, XCircle } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { getUserFriendlyError } from '@/lib/errorHandler';

type BankAccount = {
  id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  account_type: string;
  swift_code: string | null;
  branch: string | null;
  is_active: boolean;
  display_order: number;
  guidelines: string | null;
  created_at: string;
  updated_at: string;
};

export default function AdminBankAccounts() {
  const { profile, signOut } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);

  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountType, setAccountType] = useState('Checking');
  const [swiftCode, setSwiftCode] = useState('');
  const [branch, setBranch] = useState('');
  const [guidelines, setGuidelines] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [displayOrder, setDisplayOrder] = useState('1');

  useEffect(() => {
    if (profile?.role === 'admin') {
      loadBankAccounts();
    }
  }, [profile]);

  const loadBankAccounts = async () => {
    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*')
      .order('display_order');

    if (!error && data) {
      setBankAccounts(data);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBankAccounts();
    setRefreshing(false);
  };

  const openAddModal = () => {
    setEditingAccount(null);
    setBankName('');
    setAccountName('');
    setAccountNumber('');
    setAccountType('Checking');
    setSwiftCode('');
    setBranch('');
    setGuidelines('');
    setIsActive(true);
    setDisplayOrder('1');
    setShowModal(true);
  };

  const openEditModal = (account: BankAccount) => {
    setEditingAccount(account);
    setBankName(account.bank_name);
    setAccountName(account.account_name);
    setAccountNumber(account.account_number);
    setAccountType(account.account_type);
    setSwiftCode(account.swift_code || '');
    setBranch(account.branch || '');
    setGuidelines(account.guidelines || '');
    setIsActive(account.is_active);
    setDisplayOrder(account.display_order.toString());
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!bankName || !accountName || !accountNumber) {
      if (Platform.OS === 'web') {
        alert('Please fill in all required fields');
      } else {
        Alert.alert('Error', 'Please fill in all required fields');
      }
      return;
    }

    try {
      const accountData = {
        bank_name: bankName,
        account_name: accountName,
        account_number: accountNumber,
        account_type: accountType,
        swift_code: swiftCode || null,
        branch: branch || null,
        guidelines: guidelines || null,
        is_active: isActive,
        display_order: parseInt(displayOrder) || 1,
      };

      if (editingAccount) {
        const { error } = await supabase
          .from('bank_accounts')
          .update(accountData)
          .eq('id', editingAccount.id);

        if (error) throw error;

        if (Platform.OS === 'web') {
          alert('Bank account updated successfully');
        } else {
          Alert.alert('Success', 'Bank account updated successfully');
        }
      } else {
        const { error } = await supabase
          .from('bank_accounts')
          .insert([accountData]);

        if (error) throw error;

        if (Platform.OS === 'web') {
          alert('Bank account added successfully');
        } else {
          Alert.alert('Success', 'Bank account added successfully');
        }
      }

      setShowModal(false);
      loadBankAccounts();
    } catch (error: any) {
      console.error('Error saving bank account:', error);
      const friendlyError = getUserFriendlyError(error);
      if (Platform.OS === 'web') {
        alert(friendlyError);
      } else {
        Alert.alert('Error', friendlyError);
      }
    }
  };

  const handleDelete = async (accountId: string) => {
    const confirmDelete = Platform.OS === 'web'
      ? confirm('Are you sure you want to delete this bank account?')
      : await new Promise(resolve => {
          Alert.alert(
            'Confirm Delete',
            'Are you sure you want to delete this bank account?',
            [
              { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
              { text: 'Delete', onPress: () => resolve(true), style: 'destructive' }
            ]
          );
        });

    if (!confirmDelete) return;

    try {
      const { error } = await supabase
        .from('bank_accounts')
        .delete()
        .eq('id', accountId);

      if (error) throw error;

      if (Platform.OS === 'web') {
        alert('Bank account deleted successfully');
      } else {
        Alert.alert('Success', 'Bank account deleted successfully');
      }

      loadBankAccounts();
    } catch (error: any) {
      console.error('Error deleting bank account:', error);
      const friendlyError = getUserFriendlyError(error);
      if (Platform.OS === 'web') {
        alert(friendlyError);
      } else {
        Alert.alert('Error', friendlyError);
      }
    }
  };

  const toggleStatus = async (account: BankAccount) => {
    try {
      const { error } = await supabase
        .from('bank_accounts')
        .update({ is_active: !account.is_active })
        .eq('id', account.id);

      if (error) throw error;
      loadBankAccounts();
    } catch (error: any) {
      console.error('Error updating status:', error);
    }
  };

  if (profile?.role !== 'admin') {
    return null;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Building2 size={28} color="#8b5cf6" />
          <View>
            <Text style={styles.headerTitle}>Bank Accounts</Text>
            <Text style={styles.headerSubtitle}>Manage transfer payment accounts</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
          <Plus size={20} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={styles.accountsList}>
          {bankAccounts.map((account) => (
            <View key={account.id} style={styles.accountCard}>
              <View style={styles.accountHeader}>
                <View style={styles.accountHeaderLeft}>
                  <Building2 size={20} color="#8b5cf6" />
                  <Text style={styles.accountBankName}>{account.bank_name}</Text>
                  <TouchableOpacity
                    style={[styles.statusBadge, account.is_active ? styles.statusActive : styles.statusInactive]}
                    onPress={() => toggleStatus(account)}>
                    <Text style={[styles.statusText, account.is_active ? styles.statusTextActive : styles.statusTextInactive]}>
                      {account.is_active ? 'Active' : 'Inactive'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.accountActions}>
                  <TouchableOpacity onPress={() => openEditModal(account)} style={styles.actionButton}>
                    <Edit2 size={18} color="#6b7280" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(account.id)} style={styles.actionButton}>
                    <Trash2 size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.accountDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Account Name:</Text>
                  <Text style={styles.detailValue}>{account.account_name}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Account Number:</Text>
                  <Text style={styles.detailValue}>{account.account_number}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Account Type:</Text>
                  <Text style={styles.detailValue}>{account.account_type}</Text>
                </View>
                {account.branch && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Branch:</Text>
                    <Text style={styles.detailValue}>{account.branch}</Text>
                  </View>
                )}
                {account.swift_code && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>SWIFT Code:</Text>
                    <Text style={styles.detailValue}>{account.swift_code}</Text>
                  </View>
                )}
                {account.guidelines && (
                  <View style={styles.guidelinesContainer}>
                    <Text style={styles.guidelinesLabel}>Guidelines:</Text>
                    <Text style={styles.guidelinesText}>{account.guidelines}</Text>
                  </View>
                )}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Display Order:</Text>
                  <Text style={styles.detailValue}>{account.display_order}</Text>
                </View>
              </View>
            </View>
          ))}

          {bankAccounts.length === 0 && (
            <View style={styles.emptyState}>
              <Building2 size={48} color="#d1d5db" />
              <Text style={styles.emptyText}>No bank accounts yet</Text>
              <Text style={styles.emptySubtext}>Add a bank account to start accepting transfers</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingAccount ? 'Edit Bank Account' : 'Add Bank Account'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Bank Name *</Text>
                <TextInput
                  style={styles.input}
                  value={bankName}
                  onChangeText={setBankName}
                  placeholder="e.g., First National Bank"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Account Name *</Text>
                <TextInput
                  style={styles.input}
                  value={accountName}
                  onChangeText={setAccountName}
                  placeholder="e.g., QuickDeliver Inc."
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Account Number *</Text>
                <TextInput
                  style={styles.input}
                  value={accountNumber}
                  onChangeText={setAccountNumber}
                  placeholder="e.g., 1234567890"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Account Type</Text>
                <View style={styles.accountTypeButtons}>
                  {['Checking', 'Savings', 'Business Checking', 'Business Savings'].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.typeButton, accountType === type && styles.typeButtonActive]}
                      onPress={() => setAccountType(type)}>
                      <Text style={[styles.typeButtonText, accountType === type && styles.typeButtonTextActive]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Branch (Optional)</Text>
                <TextInput
                  style={styles.input}
                  value={branch}
                  onChangeText={setBranch}
                  placeholder="e.g., Main Branch"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>SWIFT Code (Optional)</Text>
                <TextInput
                  style={styles.input}
                  value={swiftCode}
                  onChangeText={setSwiftCode}
                  placeholder="e.g., AAAA-BB-CC-123"
                  autoCapitalize="characters"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Guidelines (Optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={guidelines}
                  onChangeText={setGuidelines}
                  placeholder="e.g., Please include your order ID in transfer notes"
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Display Order</Text>
                <TextInput
                  style={styles.input}
                  value={displayOrder}
                  onChangeText={setDisplayOrder}
                  placeholder="1"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.formGroup}>
                <TouchableOpacity
                  style={styles.toggleButton}
                  onPress={() => setIsActive(!isActive)}>
                  <View style={styles.toggleLeft}>
                    {isActive ? (
                      <CheckCircle size={20} color="#10b981" />
                    ) : (
                      <XCircle size={20} color="#ef4444" />
                    )}
                    <Text style={styles.toggleLabel}>
                      {isActive ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                  <Text style={styles.toggleHint}>
                    {isActive ? 'Customers can see this account' : 'Hidden from customers'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowModal(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>Save</Text>
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
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  addButton: {
    backgroundColor: '#8b5cf6',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  accountsList: {
    padding: 20,
    gap: 16,
  },
  accountCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
  },
  accountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  accountHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  accountBankName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusActive: {
    backgroundColor: '#d1fae5',
  },
  statusInactive: {
    backgroundColor: '#fee2e2',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusTextActive: {
    color: '#065f46',
  },
  statusTextInactive: {
    color: '#991b1b',
  },
  accountActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  guidelinesContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
  },
  guidelinesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 4,
  },
  guidelinesText: {
    fontSize: 12,
    color: '#92400e',
    lineHeight: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  modalContent: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  accountTypeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  typeButtonActive: {
    borderColor: '#8b5cf6',
    backgroundColor: '#f3e8ff',
  },
  typeButtonText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  typeButtonTextActive: {
    color: '#8b5cf6',
    fontWeight: '600',
  },
  toggleButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  toggleHint: {
    fontSize: 13,
    color: '#6b7280',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6b7280',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
});

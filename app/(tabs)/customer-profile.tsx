import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, TextInput, ActivityIndicator } from 'react-native';
import { User, Mail, Phone, LogOut, Edit, Save, X, Wallet, Plus, TrendingUp, TrendingDown, ArrowDown, Building2, Trash2 } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { walletService, WalletTransaction, BankAccount } from '@/lib/wallet';
import { Toast } from '@/components/Toast';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { WalletFundingModal } from '@/components/WalletFundingModal';
import { BankAccountModal } from '@/components/BankAccountModal';
import { WithdrawalModal } from '@/components/WithdrawalModal';
import { Fonts } from '@/constants/fonts';

export default function CustomerProfile() {
  const { profile, signOut, refreshProfile } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [walletBalance, setWalletBalance] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [fundingModalVisible, setFundingModalVisible] = useState(false);
  const [bankAccountModalVisible, setBankAccountModalVisible] = useState(false);
  const [withdrawalModalVisible, setWithdrawalModalVisible] = useState(false);
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
    loadWalletData();
  }, [profile?.id]);

  const loadWalletData = async () => {
    if (!profile?.id) return;

    try {
      const [balance, txns, accounts] = await Promise.all([
        walletService.getBalance(profile.id),
        walletService.getTransactions(profile.id, 10),
        walletService.getBankAccounts(profile.id),
      ]);

      setWalletBalance(balance);
      setTransactions(txns);
      setBankAccounts(accounts);
    } catch (err) {
      console.error('Error loading wallet data:', err);
    }
  };

  const handleDeleteBankAccount = (accountId: string) => {
    setConfirmDialog({
      visible: true,
      title: 'Delete Bank Account',
      message: 'Are you sure you want to remove this bank account?',
      onConfirm: async () => {
        try {
          await walletService.deleteBankAccount(accountId);
          await loadWalletData();
          showToast('Bank account removed successfully', 'success');
        } catch (err: any) {
          showToast(err.message || 'Failed to remove bank account', 'error');
        }
      },
    });
  };

  const handleEdit = () => {
    setFullName(profile?.full_name || '');
    setPhone(profile?.phone || '');
    setError(null);
    setSuccess(null);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setFullName(profile?.full_name || '');
    setPhone(profile?.phone || '');
    setError(null);
    setSuccess(null);
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!profile?.id) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim() || null,
          phone: phone.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      await refreshProfile();
      setSuccess('Profile updated successfully');
      setIsEditing(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error updating profile:', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleFundingSuccess = async () => {
    await loadWalletData();
    await refreshProfile();
    showToast('Wallet funded successfully!', 'success');
  };

  const handleSignOut = () => {
    setConfirmDialog({
      visible: true,
      title: 'Sign Out',
      message: 'Are you sure you want to sign out?',
      onConfirm: async () => {
        try {
          console.log('Customer profile: Starting sign out...');
          await signOut();
          console.log('Customer profile: Sign out complete, redirecting...');
          router.replace('/auth');
        } catch (error) {
          console.error('Customer profile: Error signing out:', error);
          showToast('Failed to sign out: ' + (error as Error).message, 'error');
        }
      },
    });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
        {!isEditing && (
          <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
            <Edit size={24} color="#f97316" strokeWidth={2.5} />
          </TouchableOpacity>
        )}
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {success && (
        <View style={styles.successBanner}>
          <Text style={styles.successText}>{success}</Text>
        </View>
      )}

      <View  style={styles.profileCard}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <User size={48} color="#ffffff" />
          </View>
        </View>

        {isEditing ? (
          <View style={styles.editSection}>
            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter your full name"
              editable={!loading}
            />
          </View>
        ) : (
          <>
            <Text style={styles.name}>{profile?.full_name || 'No name set'}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>Customer</Text>
            </View>
            <TouchableOpacity style={styles.editProfileButton} onPress={handleEdit}>
              <Edit size={18} color="#f97316" />
              <Text style={styles.editProfileButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Wallet</Text>
        <View style={styles.walletCard}>
          <View style={styles.walletHeader}>
            <View style={styles.walletIconContainer}>
              <Wallet size={28} color="#f97316" />
            </View>
            <View style={styles.walletBalanceSection}>
              <Text style={styles.walletLabel}>Available Balance</Text>
              <Text style={styles.walletBalance}>{walletService.formatCurrency(walletBalance)}</Text>
            </View>
          </View>
          <View style={styles.walletActions}>
            <TouchableOpacity
              style={styles.walletActionButton}
              onPress={() => setFundingModalVisible(true)}>
              <Plus size={20} color="#ffffff" />
              <Text style={styles.walletActionButtonText}>Add Money</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.walletActionButtonSecondary}
              onPress={() => setWithdrawalModalVisible(true)}>
              <ArrowDown size={20} color="#f97316" />
              <Text style={styles.walletActionButtonSecondaryText}>Withdraw</Text>
            </TouchableOpacity>
          </View>
        </View>

        {transactions.length > 0 && (
          <View style={styles.transactionsSection}>
            <Text style={styles.transactionsTitle}>Recent Transactions</Text>
            {transactions.slice(0, 5).map((txn) => (
              <View key={txn.id} style={styles.transactionItem}>
                <View style={[
                  styles.transactionIcon,
                  { backgroundColor: txn.transaction_type === 'credit' ? '#d1fae5' : '#fee2e2' }
                ]}>
                  {txn.transaction_type === 'credit' ? (
                    <TrendingUp size={16} color="#f97316" />
                  ) : (
                    <TrendingDown size={16} color="#ef4444" />
                  )}
                </View>
                <View style={styles.transactionDetails}>
                  <Text style={styles.transactionDescription}>{txn.description}</Text>
                  <Text style={styles.transactionDate}>
                    {new Date(txn.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={[
                  styles.transactionAmount,
                  { color: walletService.getTransactionColor(txn.transaction_type) }
                ]}>
                  {walletService.getTransactionIcon(txn.transaction_type)}
                  {walletService.formatCurrency(txn.amount)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Bank Accounts</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setBankAccountModalVisible(true)}>
            <Plus size={16} color="#f97316" />
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>

        {bankAccounts.length > 0 ? (
          <View style={styles.bankAccountsList}>
            {bankAccounts.map((account) => (
              <View key={account.id} style={styles.bankAccountCard}>
                <View style={styles.bankAccountIcon}>
                  <Building2 size={20} color="#f97316" />
                </View>
                <View style={styles.bankAccountDetails}>
                  <Text style={styles.bankAccountName}>{account.account_name}</Text>
                  <Text style={styles.bankAccountBank}>{account.bank_name}</Text>
                  <Text style={styles.bankAccountNumber}>{account.account_number}</Text>
                </View>
                {account.is_default && (
                  <View style={styles.defaultBadge}>
                    <Text style={styles.defaultBadgeText}>Default</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeleteBankAccount(account.id)}>
                  <Trash2 size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyBankAccounts}>
            <Building2 size={32} color="#9ca3af" />
            <Text style={styles.emptyBankAccountsText}>No bank accounts added yet</Text>
            <Text style={styles.emptyBankAccountsSubtext}>Add a bank account to withdraw funds</Text>
          </View>
        )}
      </View>

      <View  style={styles.section}>
        <Text style={styles.sectionTitle}>Account Information</Text>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.iconContainer}>
              <Mail size={20} color="#f97316" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{profile?.email}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.iconContainer}>
              <Phone size={20} color="#f97316" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Phone</Text>
              {isEditing ? (
                <TextInput
                  style={styles.inputInline}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Enter your phone number"
                  editable={!loading}
                  keyboardType="phone-pad"
                />
              ) : (
                <Text style={styles.infoValue}>{profile?.phone || 'Not provided'}</Text>
              )}
            </View>
          </View>
        </View>
      </View>

      {isEditing && (
        <View style={styles.section}>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={handleCancel}
              disabled={loading}
            >
              <X size={20} color="#ef4444" />
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.saveButton]}
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Save size={20} color="#ffffff" />
                  <Text style={styles.saveButtonText}>Save</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View  style={styles.section}>
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <LogOut size={20} color="#ef4444" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <WalletFundingModal
        visible={fundingModalVisible}
        onClose={() => setFundingModalVisible(false)}
        onSuccess={handleFundingSuccess}
      />

      <BankAccountModal
        visible={bankAccountModalVisible}
        onClose={() => setBankAccountModalVisible(false)}
        onSuccess={async () => {
          await loadWalletData();
          showToast('Bank account added successfully!', 'success');
        }}
        userId={profile?.id || ''}
      />

      <WithdrawalModal
        visible={withdrawalModalVisible}
        onClose={() => setWithdrawalModalVisible(false)}
        onSuccess={async () => {
          await loadWalletData();
          await refreshProfile();
          showToast('Withdrawal request submitted successfully!', 'success');
        }}
        userId={profile?.id || ''}
        walletBalance={walletBalance}
        bankAccounts={bankAccounts}
      />

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    padding: 24,
    paddingTop: 60,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontFamily: Fonts.poppinsBold,
    color: '#111827',
    letterSpacing: 0.5,
  },
  editButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ffedd5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  errorBanner: {
    backgroundColor: '#fee2e2',
    padding: 16,
    marginHorizontal: 24,
    marginTop: 16,
    borderRadius: 12,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    fontFamily: Fonts.poppinsSemiBold,
    textAlign: 'center',
  },
  successBanner: {
    backgroundColor: '#d1fae5',
    padding: 16,
    marginHorizontal: 24,
    marginTop: 16,
    borderRadius: 12,
  },
  successText: {
    color: '#f97316',
    fontSize: 14,
    fontFamily: Fonts.poppinsSemiBold,
    textAlign: 'center',
  },
  profileCard: {
    backgroundColor: '#ffffff',
    margin: 24,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#f97316',
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    fontSize: 24,
    fontFamily: Fonts.poppinsBold,
    color: '#111827',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  roleBadge: {
    backgroundColor: '#ffedd5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
  },
  roleText: {
    color: '#f97316',
    fontSize: 14,
    fontFamily: Fonts.poppinsBold,
    letterSpacing: 0.5,
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffedd5',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f97316',
  },
  editProfileButtonText: {
    color: '#f97316',
    fontSize: 15,
    fontFamily: Fonts.poppinsBold,
  },
  section: {
    marginHorizontal: 24,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: Fonts.poppinsBold,
    color: '#111827',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffedd5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontFamily: Fonts.poppinsSemiBold,
    marginBottom: 4,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 16,
    color: '#111827',
    fontFamily: Fonts.poppinsMedium,
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    padding: 18,
    borderRadius: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  signOutText: {
    fontSize: 16,
    fontFamily: Fonts.poppinsBold,
    color: '#ef4444',
  },
  editSection: {
    width: '100%',
    marginTop: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: Fonts.poppinsSemiBold,
    color: '#6b7280',
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
  inputInline: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontFamily: Fonts.poppinsRegular,
    color: '#111827',
    marginTop: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 16,
    gap: 8,
  },
  cancelButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  cancelButtonText: {
    fontSize: 16,
    fontFamily: Fonts.poppinsBold,
    color: '#ef4444',
  },
  saveButton: {
    backgroundColor: '#f97316',
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: Fonts.poppinsBold,
    color: '#ffffff',
  },
  walletCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 16,
  },
  walletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  walletIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ffedd5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  walletBalanceSection: {
    flex: 1,
  },
  walletLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontFamily: Fonts.poppinsSemiBold,
    marginBottom: 4,
  },
  walletBalance: {
    fontSize: 28,
    fontFamily: Fonts.poppinsBold,
    color: '#f97316',
  },
  walletActions: {
    flexDirection: 'row',
    gap: 12,
  },
  walletActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f97316',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  walletActionButtonText: {
    fontSize: 16,
    fontFamily: Fonts.poppinsBold,
    color: '#ffffff',
  },
  walletActionButtonSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    borderWidth: 2,
    borderColor: '#f97316',
  },
  walletActionButtonSecondaryText: {
    fontSize: 16,
    fontFamily: Fonts.poppinsBold,
    color: '#f97316',
  },
  transactionsSection: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  transactionsTitle: {
    fontSize: 14,
    fontFamily: Fonts.poppinsBold,
    color: '#111827',
    marginBottom: 12,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  transactionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 14,
    fontFamily: Fonts.poppinsSemiBold,
    color: '#111827',
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 12,
    fontFamily: Fonts.poppinsRegular,
    color: '#9ca3af',
  },
  transactionAmount: {
    fontSize: 15,
    fontFamily: Fonts.poppinsBold,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#ffedd5',
    borderRadius: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontFamily: Fonts.poppinsSemiBold,
    color: '#f97316',
  },
  bankAccountsList: {
    gap: 12,
  },
  bankAccountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  bankAccountIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffedd5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  bankAccountDetails: {
    flex: 1,
  },
  bankAccountName: {
    fontSize: 16,
    fontFamily: Fonts.poppinsSemiBold,
    color: '#111827',
    marginBottom: 2,
  },
  bankAccountBank: {
    fontSize: 14,
    fontFamily: Fonts.poppinsMedium,
    color: '#6b7280',
    marginBottom: 2,
  },
  bankAccountNumber: {
    fontSize: 13,
    fontFamily: Fonts.poppinsRegular,
    color: '#9ca3af',
  },
  defaultBadge: {
    backgroundColor: '#f97316',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  defaultBadgeText: {
    fontSize: 12,
    fontFamily: Fonts.poppinsSemiBold,
    color: '#ffffff',
  },
  deleteButton: {
    padding: 8,
  },
  emptyBankAccounts: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  emptyBankAccountsText: {
    fontSize: 16,
    fontFamily: Fonts.poppinsSemiBold,
    color: '#111827',
    marginTop: 12,
  },
  emptyBankAccountsSubtext: {
    fontSize: 14,
    fontFamily: Fonts.poppinsRegular,
    color: '#6b7280',
    marginTop: 4,
  },
});

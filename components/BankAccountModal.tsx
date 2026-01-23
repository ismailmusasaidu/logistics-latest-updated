import { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { X, Building2, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { walletService } from '@/lib/wallet';
import { NIGERIAN_BANKS } from '@/lib/nigerianBanks';

type BankAccountModalProps = {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
};

export function BankAccountModal({ visible, onClose, onSuccess, userId }: BankAccountModalProps) {
  const [step, setStep] = useState<'select-bank' | 'enter-details' | 'verify'>('select-bank');
  const [selectedBank, setSelectedBank] = useState<{ name: string; code: string } | null>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (visible) {
      setStep('select-bank');
      setSelectedBank(null);
      setAccountNumber('');
      setAccountName('');
      setError('');
      setSearchQuery('');
    }
  }, [visible]);

  const filteredBanks = NIGERIAN_BANKS.filter(bank =>
    bank.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectBank = (bank: { name: string; code: string }) => {
    setSelectedBank(bank);
    setStep('enter-details');
  };

  const handleVerifyAccount = async () => {
    setError('');

    if (!selectedBank) {
      setError('Please select a bank');
      return;
    }

    if (accountNumber.length !== 10) {
      setError('Account number must be 10 digits');
      return;
    }

    if (!/^\d+$/.test(accountNumber)) {
      setError('Account number must contain only digits');
      return;
    }

    setVerifying(true);

    try {
      const result = await walletService.resolveBankAccount(accountNumber, selectedBank.code);

      if (!result.success || !result.accountName) {
        throw new Error(result.error || 'Could not verify account');
      }

      setAccountName(result.accountName);
      setStep('verify');
    } catch (err: any) {
      setError(err.message || 'Failed to verify account');
    } finally {
      setVerifying(false);
    }
  };

  const handleSaveAccount = async () => {
    if (!selectedBank || !accountName) return;

    setLoading(true);
    setError('');

    try {
      await walletService.addBankAccount(
        userId,
        accountNumber,
        accountName,
        selectedBank.name,
        selectedBank.code
      );

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save bank account');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'enter-details') {
      setStep('select-bank');
      setAccountNumber('');
      setAccountName('');
      setError('');
    } else if (step === 'verify') {
      setStep('enter-details');
      setAccountName('');
      setError('');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Building2 size={24} color="#2563eb" />
              <Text style={styles.title}>
                {step === 'select-bank' && 'Select Bank'}
                {step === 'enter-details' && 'Enter Account Details'}
                {step === 'verify' && 'Confirm Details'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} disabled={loading || verifying}>
              <X size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {step === 'select-bank' && (
            <View style={styles.content}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search for your bank..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
              />

              <ScrollView style={styles.bankList} showsVerticalScrollIndicator={false}>
                {filteredBanks.map((bank) => (
                  <TouchableOpacity
                    key={bank.code}
                    style={styles.bankItem}
                    onPress={() => handleSelectBank(bank)}
                  >
                    <View style={styles.bankIcon}>
                      <Building2 size={20} color="#2563eb" />
                    </View>
                    <Text style={styles.bankName}>{bank.name}</Text>
                  </TouchableOpacity>
                ))}
                {filteredBanks.length === 0 && (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>No banks found</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          )}

          {step === 'enter-details' && (
            <View style={styles.content}>
              <View style={styles.selectedBankCard}>
                <Building2 size={20} color="#2563eb" />
                <Text style={styles.selectedBankName}>{selectedBank?.name}</Text>
              </View>

              <Text style={styles.label}>Account Number</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter 10-digit account number"
                value={accountNumber}
                onChangeText={(text) => {
                  setAccountNumber(text.replace(/[^0-9]/g, ''));
                  setError('');
                }}
                keyboardType="number-pad"
                maxLength={10}
                editable={!verifying}
              />

              {error && (
                <View style={styles.errorContainer}>
                  <AlertCircle size={16} color="#dc2626" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <View style={styles.infoBox}>
                <AlertCircle size={16} color="#3b82f6" />
                <Text style={styles.infoText}>
                  We'll verify your account details with your bank to ensure accuracy.
                </Text>
              </View>
            </View>
          )}

          {step === 'verify' && (
            <View style={styles.content}>
              <View style={styles.successIcon}>
                <CheckCircle2 size={48} color="#10b981" />
              </View>

              <Text style={styles.verifiedTitle}>Account Verified!</Text>

              <View style={styles.detailsCard}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Bank Name</Text>
                  <Text style={styles.detailValue}>{selectedBank?.name}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Account Number</Text>
                  <Text style={styles.detailValue}>{accountNumber}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Account Name</Text>
                  <Text style={styles.detailValue}>{accountName}</Text>
                </View>
              </View>

              {error && (
                <View style={styles.errorContainer}>
                  <AlertCircle size={16} color="#dc2626" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <View style={styles.infoBox}>
                <AlertCircle size={16} color="#3b82f6" />
                <Text style={styles.infoText}>
                  Please confirm these details are correct before saving.
                </Text>
              </View>
            </View>
          )}

          <View style={styles.footer}>
            {step !== 'select-bank' && (
              <TouchableOpacity
                style={styles.backButton}
                onPress={handleBack}
                disabled={loading || verifying}
              >
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>
            )}

            {step === 'enter-details' && (
              <TouchableOpacity
                style={[
                  styles.continueButton,
                  (verifying || accountNumber.length !== 10) && styles.continueButtonDisabled,
                ]}
                onPress={handleVerifyAccount}
                disabled={verifying || accountNumber.length !== 10}
              >
                {verifying ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.continueButtonText}>Verify Account</Text>
                )}
              </TouchableOpacity>
            )}

            {step === 'verify' && (
              <TouchableOpacity
                style={[styles.continueButton, loading && styles.continueButtonDisabled]}
                onPress={handleSaveAccount}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.continueButtonText}>Save Account</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  content: {
    padding: 20,
    maxHeight: 500,
  },
  searchInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#111827',
    marginBottom: 16,
  },
  bankList: {
    maxHeight: 400,
  },
  bankItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  bankIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  bankName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    flex: 1,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
  },
  selectedBankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    marginBottom: 20,
  },
  selectedBankName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e40af',
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    color: '#111827',
    marginBottom: 16,
    fontWeight: '600',
  },
  successIcon: {
    alignSelf: 'center',
    marginBottom: 16,
  },
  verifiedTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#10b981',
    textAlign: 'center',
    marginBottom: 24,
  },
  detailsCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  detailRow: {
    paddingVertical: 12,
  },
  detailLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#dc2626',
  },
  infoBox: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1e40af',
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  backButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  continueButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    alignItems: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});

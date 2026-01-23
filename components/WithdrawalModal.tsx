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
import { X, ArrowDown, AlertCircle, CheckCircle2, Building2 } from 'lucide-react-native';
import { walletService, BankAccount } from '@/lib/wallet';

type WithdrawalModalProps = {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
  walletBalance: number;
  bankAccounts: BankAccount[];
};

export function WithdrawalModal({
  visible,
  onClose,
  onSuccess,
  userId,
  walletBalance,
  bankAccounts,
}: WithdrawalModalProps) {
  const [step, setStep] = useState<'select-account' | 'enter-amount' | 'confirm'>('select-account');
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fee, setFee] = useState(0);
  const [netAmount, setNetAmount] = useState(0);

  useEffect(() => {
    if (visible) {
      setStep(bankAccounts.length > 0 ? 'select-account' : 'select-account');
      setSelectedAccount(bankAccounts.find(acc => acc.is_default) || bankAccounts[0] || null);
      setAmount('');
      setError('');
      setFee(0);
      setNetAmount(0);
    }
  }, [visible, bankAccounts]);

  useEffect(() => {
    if (amount) {
      const numAmount = parseFloat(amount);
      if (!isNaN(numAmount)) {
        const calculatedFee = walletService.calculateWithdrawalFee(numAmount);
        setFee(calculatedFee);
        setNetAmount(numAmount - calculatedFee);
      }
    } else {
      setFee(0);
      setNetAmount(0);
    }
  }, [amount]);

  const validateAmount = (value: string): boolean => {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) {
      setError('Please enter a valid amount');
      return false;
    }
    if (num < 1000) {
      setError('Minimum withdrawal amount is ₦1,000');
      return false;
    }
    if (num > walletBalance) {
      setError('Insufficient wallet balance');
      return false;
    }
    return true;
  };

  const handleSelectAccount = (account: BankAccount) => {
    setSelectedAccount(account);
    setStep('enter-amount');
  };

  const handleContinue = () => {
    setError('');
    if (!validateAmount(amount)) {
      return;
    }
    setStep('confirm');
  };

  const handleWithdraw = async () => {
    if (!selectedAccount) return;

    setLoading(true);
    setError('');

    try {
      const result = await walletService.requestWithdrawal(
        userId,
        selectedAccount.id,
        parseFloat(amount)
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to process withdrawal');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to process withdrawal');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'enter-amount') {
      setStep('select-account');
      setAmount('');
      setError('');
    } else if (step === 'confirm') {
      setStep('enter-amount');
      setError('');
    }
  };

  if (bankAccounts.length === 0) {
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
                <ArrowDown size={24} color="#2563eb" />
                <Text style={styles.title}>Withdraw</Text>
              </View>
              <TouchableOpacity onPress={onClose}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.content}>
              <View style={styles.emptyStateContainer}>
                <Building2 size={48} color="#9ca3af" />
                <Text style={styles.emptyStateTitle}>No Bank Account</Text>
                <Text style={styles.emptyStateText}>
                  Add a bank account to withdraw money from your wallet.
                </Text>
              </View>
            </View>

            <View style={styles.footer}>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

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
              <ArrowDown size={24} color="#2563eb" />
              <Text style={styles.title}>
                {step === 'select-account' && 'Select Account'}
                {step === 'enter-amount' && 'Enter Amount'}
                {step === 'confirm' && 'Confirm Withdrawal'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} disabled={loading}>
              <X size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {step === 'select-account' && (
            <View style={styles.content}>
              <Text style={styles.sectionTitle}>Select bank account for withdrawal</Text>

              <ScrollView showsVerticalScrollIndicator={false}>
                {bankAccounts.map((account) => (
                  <TouchableOpacity
                    key={account.id}
                    style={[
                      styles.accountItem,
                      account.is_default && styles.accountItemDefault,
                    ]}
                    onPress={() => handleSelectAccount(account)}
                  >
                    <View style={styles.accountIcon}>
                      <Building2 size={20} color="#2563eb" />
                    </View>
                    <View style={styles.accountDetails}>
                      <Text style={styles.accountName}>{account.account_name}</Text>
                      <Text style={styles.accountBank}>{account.bank_name}</Text>
                      <Text style={styles.accountNumber}>{account.account_number}</Text>
                    </View>
                    {account.is_default && (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultText}>Default</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {step === 'enter-amount' && (
            <View style={styles.content}>
              <View style={styles.balanceCard}>
                <Text style={styles.balanceLabel}>Available Balance</Text>
                <Text style={styles.balanceAmount}>
                  {walletService.formatCurrency(walletBalance)}
                </Text>
              </View>

              <Text style={styles.label}>Withdrawal Amount</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.currency}>₦</Text>
                <TextInput
                  style={styles.input}
                  value={amount}
                  onChangeText={(text) => {
                    setAmount(text.replace(/[^0-9.]/g, ''));
                    setError('');
                  }}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  editable={!loading}
                />
              </View>

              {amount && !error && (
                <View style={styles.feeCard}>
                  <View style={styles.feeRow}>
                    <Text style={styles.feeLabel}>Withdrawal Amount</Text>
                    <Text style={styles.feeValue}>{walletService.formatCurrency(parseFloat(amount))}</Text>
                  </View>
                  <View style={styles.feeRow}>
                    <Text style={styles.feeLabel}>Processing Fee</Text>
                    <Text style={styles.feeValue}>-{walletService.formatCurrency(fee)}</Text>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.feeRow}>
                    <Text style={styles.feeLabelBold}>You'll Receive</Text>
                    <Text style={styles.feeValueBold}>{walletService.formatCurrency(netAmount)}</Text>
                  </View>
                </View>
              )}

              {error && (
                <View style={styles.errorContainer}>
                  <AlertCircle size={16} color="#dc2626" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <View style={styles.infoBox}>
                <AlertCircle size={16} color="#3b82f6" />
                <Text style={styles.infoText}>
                  Minimum withdrawal: ₦1,000. Processing usually takes a few minutes.
                </Text>
              </View>
            </View>
          )}

          {step === 'confirm' && (
            <View style={styles.content}>
              <View style={styles.successIcon}>
                <ArrowDown size={48} color="#2563eb" />
              </View>

              <Text style={styles.confirmTitle}>Confirm Withdrawal</Text>

              <View style={styles.detailsCard}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Bank Account</Text>
                  <Text style={styles.detailValue}>{selectedAccount?.account_name}</Text>
                  <Text style={styles.detailSubValue}>
                    {selectedAccount?.bank_name} - {selectedAccount?.account_number}
                  </Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Withdrawal Amount</Text>
                  <Text style={styles.detailValue}>{walletService.formatCurrency(parseFloat(amount))}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Processing Fee</Text>
                  <Text style={styles.detailValue}>{walletService.formatCurrency(fee)}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabelBold}>Amount to Receive</Text>
                  <Text style={styles.detailValueBold}>{walletService.formatCurrency(netAmount)}</Text>
                </View>
              </View>

              {error && (
                <View style={styles.errorContainer}>
                  <AlertCircle size={16} color="#dc2626" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <View style={styles.infoBox}>
                <AlertCircle size={16} color="#f59e0b" />
                <Text style={styles.infoText}>
                  Money will be deducted from your wallet immediately and sent to your bank account.
                </Text>
              </View>
            </View>
          )}

          <View style={styles.footer}>
            {step !== 'select-account' && (
              <TouchableOpacity
                style={styles.backButton}
                onPress={handleBack}
                disabled={loading}
              >
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>
            )}

            {step === 'enter-amount' && (
              <TouchableOpacity
                style={[
                  styles.continueButton,
                  (!amount || loading) && styles.continueButtonDisabled,
                ]}
                onPress={handleContinue}
                disabled={!amount || loading}
              >
                <Text style={styles.continueButtonText}>Continue</Text>
              </TouchableOpacity>
            )}

            {step === 'confirm' && (
              <TouchableOpacity
                style={[styles.continueButton, loading && styles.continueButtonDisabled]}
                onPress={handleWithdraw}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.continueButtonText}>Confirm Withdrawal</Text>
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  accountItemDefault: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  accountIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  accountDetails: {
    flex: 1,
  },
  accountName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  accountBank: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  accountNumber: {
    fontSize: 13,
    color: '#9ca3af',
  },
  defaultBadge: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  defaultText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  balanceCard: {
    backgroundColor: '#eff6ff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#1e40af',
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1e3a8a',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f9fafb',
    marginBottom: 16,
  },
  currency: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 24,
    fontWeight: '600',
    color: '#111827',
    paddingVertical: 16,
  },
  feeCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  feeLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  feeValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  feeLabelBold: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  feeValueBold: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2563eb',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 8,
  },
  successIcon: {
    alignSelf: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
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
  detailSubValue: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  detailLabelBold: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  detailValueBold: {
    fontSize: 20,
    fontWeight: '800',
    color: '#2563eb',
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
  emptyStateContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
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
  closeButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
});

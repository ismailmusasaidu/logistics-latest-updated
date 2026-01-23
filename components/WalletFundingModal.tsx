import { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  Linking,
  Clipboard,
  ScrollView,
} from 'react-native';
import { X, Wallet, AlertCircle, CheckCircle2, Copy, Building2, CreditCard } from 'lucide-react-native';
import { walletService } from '@/lib/wallet';
import { supabase } from '@/lib/supabase';

type WalletFundingModalProps = {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000];

type VirtualAccount = {
  account_number: string;
  account_name: string;
  bank_name: string;
  bank_code: string;
};

export function WalletFundingModal({ visible, onClose, onSuccess }: WalletFundingModalProps) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [pendingReference, setPendingReference] = useState<string | null>(null);
  const [virtualAccount, setVirtualAccount] = useState<VirtualAccount | null>(null);
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [fundingMethod, setFundingMethod] = useState<'transfer' | 'card'>('transfer');
  const verificationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const verificationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      setAmount('');
      setError('');
      setPendingReference(null);
      setVerifying(false);
      setLoading(false);
      fetchOrCreateVirtualAccount();
    } else {
      clearVerificationPolling();
    }
  }, [visible]);

  const fetchOrCreateVirtualAccount = async () => {
    setLoadingAccount(true);
    setError('');
    try {
      const { data: existingAccount, error: fetchError } = await supabase
        .from('virtual_accounts')
        .select('account_number, account_name, bank_name, bank_code')
        .eq('is_active', true)
        .maybeSingle();

      if (existingAccount) {
        setVirtualAccount(existingAccount);
        return;
      }

      const apiUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-virtual-account`;
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      console.log('Creating virtual account...');
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      console.log('Virtual account response:', result);

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create virtual account');
      }

      if (result.success && result.data) {
        setVirtualAccount({
          account_number: result.data.account_number,
          account_name: result.data.account_name,
          bank_name: result.data.bank_name,
          bank_code: result.data.bank_code,
        });
      } else if (result.error) {
        throw new Error(result.error);
      }
    } catch (err: any) {
      console.error('Error fetching virtual account:', err);
      setError(err.message || 'Failed to load virtual account. Please try again.');
    } finally {
      setLoadingAccount(false);
    }
  };

  useEffect(() => {
    return () => {
      clearVerificationPolling();
    };
  }, []);

  const clearVerificationPolling = () => {
    if (verificationIntervalRef.current) {
      clearInterval(verificationIntervalRef.current);
      verificationIntervalRef.current = null;
    }
    if (verificationTimeoutRef.current) {
      clearTimeout(verificationTimeoutRef.current);
      verificationTimeoutRef.current = null;
    }
  };

  const validateAmount = (value: string): boolean => {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) {
      setError('Please enter a valid amount');
      return false;
    }
    if (num < 100) {
      setError('Minimum funding amount is ₦100');
      return false;
    }
    if (num > 1000000) {
      setError('Maximum funding amount is ₦1,000,000');
      return false;
    }
    return true;
  };

  const handleQuickAmount = (quickAmount: number) => {
    setAmount(quickAmount.toString());
    setError('');
  };

  const handleFundWallet = async () => {
    setError('');

    if (!validateAmount(amount)) {
      return;
    }

    setLoading(true);

    try {
      const result = await walletService.initializeWalletFunding(parseFloat(amount));

      if (!result.success || !result.authorizationUrl || !result.reference) {
        throw new Error(result.error || 'Failed to initialize payment');
      }

      setPendingReference(result.reference);

      const supported = await Linking.canOpenURL(result.authorizationUrl);

      if (!supported) {
        throw new Error('Cannot open payment page');
      }

      await Linking.openURL(result.authorizationUrl);

      setLoading(false);
      setVerifying(true);

      clearVerificationPolling();

      verificationIntervalRef.current = setInterval(async () => {
        try {
          const verifyResult = await walletService.verifyWalletFunding(result.reference!);

          if (verifyResult.success && verifyResult.verified) {
            clearVerificationPolling();
            setVerifying(false);
            onSuccess();
            onClose();
          }
        } catch (err) {
          console.error('Verification check error:', err);
        }
      }, 3000);

      verificationTimeoutRef.current = setTimeout(() => {
        clearVerificationPolling();
        setVerifying(false);
      }, 300000);

    } catch (err: any) {
      setError(err.message || 'Failed to initiate payment');
      setLoading(false);
      setVerifying(false);
    }
  };

  const handleManualVerify = async () => {
    if (!pendingReference) return;

    setVerifying(true);
    setError('');

    try {
      const result = await walletService.verifyWalletFunding(pendingReference);

      if (result.success && result.verified) {
        onSuccess();
        onClose();
      } else {
        setError(result.message || 'Payment not yet confirmed. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleCopy = async (text: string, field: string) => {
    if (Platform.OS === 'web') {
      await navigator.clipboard.writeText(text);
    } else {
      Clipboard.setString(text);
    }
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
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
              <Wallet size={24} color="#2563eb" />
              <Text style={styles.title}>Fund Wallet</Text>
            </View>
            <TouchableOpacity onPress={() => {
              clearVerificationPolling();
              setVerifying(false);
              onClose();
            }} disabled={loading}>
              <X size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, fundingMethod === 'transfer' && styles.tabActive]}
              onPress={() => setFundingMethod('transfer')}
            >
              <Building2 size={18} color={fundingMethod === 'transfer' ? '#2563eb' : '#6b7280'} />
              <Text style={[styles.tabText, fundingMethod === 'transfer' && styles.tabTextActive]}>
                Bank Transfer
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, fundingMethod === 'card' && styles.tabActive]}
              onPress={() => setFundingMethod('card')}
            >
              <CreditCard size={18} color={fundingMethod === 'card' ? '#2563eb' : '#6b7280'} />
              <Text style={[styles.tabText, fundingMethod === 'card' && styles.tabTextActive]}>
                Card Payment
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent}>
            <View style={styles.content}>

            {fundingMethod === 'transfer' && virtualAccount && (
              <View style={styles.virtualAccountSection}>
                <View style={styles.sectionHeader}>
                  <Building2 size={20} color="#2563eb" />
                  <Text style={styles.sectionTitle}>Your Dedicated Account</Text>
                </View>

                <View style={styles.accountDetailsCard}>
                  <View style={styles.accountDetailRow}>
                    <Text style={styles.accountDetailLabel}>Bank Name</Text>
                    <View style={styles.accountDetailValueContainer}>
                      <Text style={styles.accountDetailValue}>{virtualAccount.bank_name}</Text>
                    </View>
                  </View>

                  <View style={styles.accountDetailRow}>
                    <Text style={styles.accountDetailLabel}>Account Number</Text>
                    <View style={styles.accountDetailValueContainer}>
                      <Text style={styles.accountDetailValueBold}>{virtualAccount.account_number}</Text>
                      <TouchableOpacity
                        style={styles.copyButton}
                        onPress={() => handleCopy(virtualAccount.account_number, 'account_number')}
                      >
                        {copiedField === 'account_number' ? (
                          <CheckCircle2 size={16} color="#10b981" />
                        ) : (
                          <Copy size={16} color="#2563eb" />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.accountDetailRow}>
                    <Text style={styles.accountDetailLabel}>Account Name</Text>
                    <View style={styles.accountDetailValueContainer}>
                      <Text style={styles.accountDetailValue}>{virtualAccount.account_name}</Text>
                      <TouchableOpacity
                        style={styles.copyButton}
                        onPress={() => handleCopy(virtualAccount.account_name, 'account_name')}
                      >
                        {copiedField === 'account_name' ? (
                          <CheckCircle2 size={16} color="#10b981" />
                        ) : (
                          <Copy size={16} color="#2563eb" />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                <View style={styles.transferInstructions}>
                  <AlertCircle size={16} color="#3b82f6" />
                  <Text style={styles.instructionsText}>
                    Transfer any amount to this account from your bank app. Your wallet will be credited automatically within seconds.
                  </Text>
                </View>
              </View>
            )}

            {fundingMethod === 'transfer' && loadingAccount && (
              <View style={styles.loadingAccountContainer}>
                <ActivityIndicator size="large" color="#2563eb" />
                <Text style={styles.loadingAccountText}>Creating your dedicated account...</Text>
              </View>
            )}

            {fundingMethod === 'transfer' && !virtualAccount && !loadingAccount && error && (
              <View style={styles.errorContainer}>
                <AlertCircle size={16} color="#dc2626" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {fundingMethod === 'card' && (
              <>
            <Text style={styles.label}>Enter Amount</Text>
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
                editable={!loading && !verifying}
              />
            </View>

            <View style={styles.quickAmounts}>
              <Text style={styles.quickAmountsLabel}>Quick amounts:</Text>
              <View style={styles.quickAmountsButtons}>
                {QUICK_AMOUNTS.map((quickAmount) => (
                  <TouchableOpacity
                    key={quickAmount}
                    style={[
                      styles.quickAmountButton,
                      amount === quickAmount.toString() && styles.quickAmountButtonActive,
                    ]}
                    onPress={() => handleQuickAmount(quickAmount)}
                    disabled={loading || verifying}
                  >
                    <Text
                      style={[
                        styles.quickAmountText,
                        amount === quickAmount.toString() && styles.quickAmountTextActive,
                      ]}
                    >
                      ₦{quickAmount.toLocaleString()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {error && (
              <View style={styles.errorContainer}>
                <AlertCircle size={16} color="#dc2626" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {verifying && (
              <View style={styles.verifyingContainer}>
                <ActivityIndicator size="small" color="#2563eb" />
                <Text style={styles.verifyingText}>
                  Waiting for payment confirmation...
                </Text>
              </View>
            )}

            {pendingReference && !verifying && (
              <TouchableOpacity
                style={styles.manualVerifyButton}
                onPress={handleManualVerify}
              >
                <CheckCircle2 size={16} color="#2563eb" />
                <Text style={styles.manualVerifyText}>
                  Already paid? Verify now
                </Text>
              </TouchableOpacity>
            )}

            <View style={styles.infoBox}>
              <AlertCircle size={16} color="#3b82f6" />
              <Text style={styles.infoText}>
                You will be redirected to Paystack to complete the payment securely.
                Your wallet will be credited automatically once payment is confirmed.
              </Text>
            </View>
            </>
            )}
          </View>
          </ScrollView>

          {fundingMethod === 'card' && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                clearVerificationPolling();
                setVerifying(false);
                onClose();
              }}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.fundButton,
                (loading || verifying || !amount) && styles.fundButtonDisabled,
              ]}
              onPress={handleFundWallet}
              disabled={loading || verifying || !amount}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.fundButtonText}>Continue to Payment</Text>
              )}
            </TouchableOpacity>
          </View>
          )}

          {fundingMethod === 'transfer' && virtualAccount && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
          )}
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
  quickAmounts: {
    marginTop: 20,
  },
  quickAmountsLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 12,
  },
  quickAmountsButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickAmountButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  quickAmountButtonActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  quickAmountText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  quickAmountTextActive: {
    color: '#2563eb',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    padding: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#dc2626',
  },
  verifyingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    padding: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
  },
  verifyingText: {
    flex: 1,
    fontSize: 14,
    color: '#2563eb',
  },
  manualVerifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 8,
  },
  manualVerifyText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2563eb',
  },
  infoBox: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
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
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  fundButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    alignItems: 'center',
  },
  fundButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  fundButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 20,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#2563eb',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  tabTextActive: {
    color: '#2563eb',
    fontWeight: '600',
  },
  scrollContent: {
    maxHeight: '70%',
  },
  virtualAccountSection: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  accountDetailsCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 16,
  },
  accountDetailRow: {
    gap: 8,
  },
  accountDetailLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
  },
  accountDetailValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accountDetailValue: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
    flex: 1,
  },
  accountDetailValueBold: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    letterSpacing: 0.5,
  },
  copyButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  transferInstructions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    padding: 14,
    backgroundColor: '#eff6ff',
    borderRadius: 10,
  },
  instructionsText: {
    flex: 1,
    fontSize: 13,
    color: '#1e40af',
    lineHeight: 18,
  },
  loadingAccountContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 16,
  },
  loadingAccountText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  closeButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});

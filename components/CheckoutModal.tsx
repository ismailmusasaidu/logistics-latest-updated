import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, ScrollView, Alert, Linking, TextInput } from 'react-native';
import { X, Wallet, CreditCard, Banknote, CircleCheck as CheckCircle2, Building2, Info, Calendar, Clock } from 'lucide-react-native';
import { PricingBreakdown as PricingBreakdownType } from '@/lib/pricingCalculator';
import { PaymentMethod, walletService } from '@/lib/wallet';
import { PricingBreakdown } from './PricingBreakdown';
import { PaymentVerificationModal } from './PaymentVerificationModal';
import { supabase } from '@/lib/supabase';

type BankAccount = {
  id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  account_type: string;
  swift_code: string | null;
  branch: string | null;
  guidelines: string | null;
};

type CheckoutModalProps = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (paymentMethod: PaymentMethod, paystackReference?: string, scheduledTime?: Date) => Promise<void>;
  pricing: PricingBreakdownType;
  userId: string;
  userEmail: string;
  orderId?: string;
};

export function CheckoutModal({ visible, onClose, onConfirm, pricing, userId, userEmail, orderId }: CheckoutModalProps) {
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>('cash');
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationPaymentMethod, setVerificationPaymentMethod] = useState<'online' | 'transfer'>('online');
  const [paystackRef, setPaystackRef] = useState<string | undefined>();
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

  useEffect(() => {
    if (visible) {
      loadWalletBalance();
      loadBankAccounts();
      setIsScheduled(false);
      setScheduledDate('');
      setScheduledTime('');
    }
  }, [visible]);

  const loadWalletBalance = async () => {
    setLoadingBalance(true);
    try {
      const balance = await walletService.getBalance(userId);
      setWalletBalance(balance);
    } catch (err: any) {
      console.error('Error loading wallet balance:', err);
    } finally {
      setLoadingBalance(false);
    }
  };

  const loadBankAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setBankAccounts(data || []);
    } catch (err: any) {
      console.error('Error loading bank accounts:', err);
    }
  };

  const initializePaystackPayment = async () => {
    setProcessingPayment(true);
    setError(null);

    try {
      const tempOrderId = orderId || `order_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      const apiUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/initialize-payment`;
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userEmail,
          amount: pricing.finalPrice,
          orderId: tempOrderId,
          metadata: {
            userId,
            deliveryFee: pricing.finalPrice,
            promoCode: pricing.promoApplied,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to initialize payment');
      }

      const supported = await Linking.canOpenURL(data.authorizationUrl);
      if (supported) {
        await Linking.openURL(data.authorizationUrl);

        setProcessingPayment(false);
        setPaystackRef(data.reference);
        setVerificationPaymentMethod('online');
        setShowVerificationModal(true);
      } else {
        throw new Error('Cannot open payment page');
      }
    } catch (err: any) {
      console.error('Payment initialization error:', err);
      setError(err.message || 'Failed to initialize payment. Please try again.');
      setProcessingPayment(false);
    }
  };

  const handleConfirmPayment = async () => {
    setError(null);

    if (isScheduled && (!scheduledDate || !scheduledTime)) {
      setError('Please provide both date and time for scheduled delivery.');
      return;
    }

    if (selectedPayment === 'wallet' && walletBalance < pricing.finalPrice) {
      setError('Insufficient wallet balance. Please recharge your wallet or choose another payment method.');
      return;
    }

    const scheduledDateTime = isScheduled && scheduledDate && scheduledTime
      ? new Date(`${scheduledDate}T${scheduledTime}`)
      : undefined;

    if (scheduledDateTime && scheduledDateTime <= new Date()) {
      setError('Scheduled time must be in the future.');
      return;
    }

    if (selectedPayment === 'online') {
      await initializePaystackPayment();
      return;
    }

    if (selectedPayment === 'transfer') {
      setVerificationPaymentMethod('transfer');
      setShowVerificationModal(true);
      return;
    }

    setLoading(true);
    try {
      await onConfirm(selectedPayment, undefined, scheduledDateTime);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPayment = async (reference?: string) => {
    const scheduledDateTime = isScheduled && scheduledDate && scheduledTime
      ? new Date(`${scheduledDate}T${scheduledTime}`)
      : undefined;

    if (verificationPaymentMethod === 'online') {
      await onConfirm('online', paystackRef, scheduledDateTime);
    } else {
      await onConfirm('transfer', reference, scheduledDateTime);
    }
    setShowVerificationModal(false);
    onClose();
  };

  const paymentOptions = [
    {
      id: 'wallet' as PaymentMethod,
      title: 'Wallet',
      description: `Balance: ${walletService.formatCurrency(walletBalance)}`,
      icon: Wallet,
      available: walletBalance >= pricing.finalPrice,
      badge: walletBalance >= pricing.finalPrice ? null : 'Insufficient Balance',
    },
    {
      id: 'transfer' as PaymentMethod,
      title: 'Bank Transfer',
      description: 'Transfer to our bank account',
      icon: Building2,
      available: true,
      badge: null,
    },
    {
      id: 'online' as PaymentMethod,
      title: 'Online Payment',
      description: 'Pay securely via Paystack',
      icon: CreditCard,
      available: true,
      badge: null,
    },
    {
      id: 'cash' as PaymentMethod,
      title: 'Cash on Delivery',
      description: 'Pay when you receive',
      icon: Banknote,
      available: true,
      badge: null,
    },
  ];

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Checkout</Text>
            <TouchableOpacity onPress={onClose} disabled={loading}>
              <X size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Delivery Time</Text>
              <View style={styles.deliveryTimeOptions}>
                <TouchableOpacity
                  style={[
                    styles.deliveryTimeOption,
                    !isScheduled && styles.deliveryTimeOptionSelected,
                  ]}
                  onPress={() => setIsScheduled(false)}>
                  <View style={styles.deliveryTimeOptionContent}>
                    <Clock size={20} color={!isScheduled ? '#f97316' : '#6b7280'} />
                    <View style={styles.deliveryTimeText}>
                      <Text style={[styles.deliveryTimeTitle, !isScheduled && styles.deliveryTimeTitleSelected]}>
                        Immediate Delivery
                      </Text>
                      <Text style={styles.deliveryTimeDescription}>
                        Deliver as soon as possible
                      </Text>
                    </View>
                  </View>
                  {!isScheduled && <CheckCircle2 size={20} color="#f97316" />}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.deliveryTimeOption,
                    isScheduled && styles.deliveryTimeOptionSelected,
                  ]}
                  onPress={() => setIsScheduled(true)}>
                  <View style={styles.deliveryTimeOptionContent}>
                    <Calendar size={20} color={isScheduled ? '#f97316' : '#6b7280'} />
                    <View style={styles.deliveryTimeText}>
                      <Text style={[styles.deliveryTimeTitle, isScheduled && styles.deliveryTimeTitleSelected]}>
                        Schedule Delivery
                      </Text>
                      <Text style={styles.deliveryTimeDescription}>
                        Choose a specific date and time
                      </Text>
                    </View>
                  </View>
                  {isScheduled && <CheckCircle2 size={20} color="#f97316" />}
                </TouchableOpacity>
              </View>

              {isScheduled && (
                <View style={styles.schedulingInputs}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Date</Text>
                    <View style={styles.inputWithIcon}>
                      <Calendar size={18} color="#6b7280" />
                      <TextInput
                        style={styles.input}
                        placeholder="YYYY-MM-DD (e.g., 2025-12-28)"
                        value={scheduledDate}
                        onChangeText={setScheduledDate}
                      />
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Time</Text>
                    <View style={styles.inputWithIcon}>
                      <Clock size={18} color="#6b7280" />
                      <TextInput
                        style={styles.input}
                        placeholder="HH:MM (e.g., 14:30)"
                        value={scheduledTime}
                        onChangeText={setScheduledTime}
                      />
                    </View>
                  </View>
                </View>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Order Summary</Text>
              <PricingBreakdown breakdown={pricing} />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Payment Method</Text>

              {loadingBalance ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#f97316" />
                  <Text style={styles.loadingText}>Loading payment options...</Text>
                </View>
              ) : (
                <View style={styles.paymentOptions}>
                  {paymentOptions.map((option) => (
                    <TouchableOpacity
                      key={option.id}
                      style={[
                        styles.paymentOption,
                        selectedPayment === option.id && styles.paymentOptionSelected,
                        !option.available && styles.paymentOptionDisabled,
                      ]}
                      onPress={() => option.available && setSelectedPayment(option.id)}
                      disabled={!option.available || loading}>
                      <View style={styles.paymentOptionLeft}>
                        <View
                          style={[
                            styles.iconContainer,
                            selectedPayment === option.id && styles.iconContainerSelected,
                          ]}>
                          <option.icon
                            size={24}
                            color={selectedPayment === option.id ? '#f97316' : '#6b7280'}
                          />
                        </View>
                        <View style={styles.paymentOptionText}>
                          <View style={styles.paymentTitleRow}>
                            <Text
                              style={[
                                styles.paymentTitle,
                                !option.available && styles.paymentTitleDisabled,
                              ]}>
                              {option.title}
                            </Text>
                            {option.badge && (
                              <View
                                style={[
                                  styles.badge,
                                  !option.available && styles.badgeWarning,
                                ]}>
                                <Text
                                  style={[
                                    styles.badgeText,
                                    !option.available && styles.badgeTextWarning,
                                  ]}>
                                  {option.badge}
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text
                            style={[
                              styles.paymentDescription,
                              !option.available && styles.paymentDescriptionDisabled,
                            ]}>
                            {option.description}
                          </Text>
                        </View>
                      </View>
                      {selectedPayment === option.id && option.available && (
                        <CheckCircle2 size={24} color="#f97316" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {selectedPayment === 'transfer' && bankAccounts.length > 0 && (
                <View style={styles.bankAccountsSection}>
                  <View style={styles.guidelinesHeader}>
                    <Info size={16} color="#f97316" />
                    <Text style={styles.guidelinesTitle}>Transfer Instructions</Text>
                  </View>
                  <Text style={styles.guidelinesText}>
                    Please transfer the exact amount to any of the following bank accounts. After placing your order, you will receive a unique Transfer Reference ID. Include this reference in your bank transfer notes for faster processing.
                  </Text>

                  {bankAccounts.map((account, index) => (
                    <View key={account.id} style={styles.bankAccountCard}>
                      <View style={styles.bankAccountHeader}>
                        <Building2 size={20} color="#f97316" />
                        <Text style={styles.bankName}>{account.bank_name}</Text>
                      </View>

                      <View style={styles.accountDetails}>
                        <View style={styles.accountRow}>
                          <Text style={styles.accountLabel}>Account Name:</Text>
                          <Text style={styles.accountValue}>{account.account_name}</Text>
                        </View>
                        <View style={styles.accountRow}>
                          <Text style={styles.accountLabel}>Account Number:</Text>
                          <Text style={styles.accountValue}>{account.account_number}</Text>
                        </View>
                        <View style={styles.accountRow}>
                          <Text style={styles.accountLabel}>Account Type:</Text>
                          <Text style={styles.accountValue}>{account.account_type}</Text>
                        </View>
                        {account.branch && (
                          <View style={styles.accountRow}>
                            <Text style={styles.accountLabel}>Branch:</Text>
                            <Text style={styles.accountValue}>{account.branch}</Text>
                          </View>
                        )}
                        {account.swift_code && (
                          <View style={styles.accountRow}>
                            <Text style={styles.accountLabel}>SWIFT Code:</Text>
                            <Text style={styles.accountValue}>{account.swift_code}</Text>
                          </View>
                        )}
                      </View>

                      {account.guidelines && (
                        <View style={styles.accountGuidelines}>
                          <Text style={styles.accountGuidelinesText}>{account.guidelines}</Text>
                        </View>
                      )}
                    </View>
                  ))}

                  <View style={styles.transferNotice}>
                    <Text style={styles.transferNoticeText}>
                      After making the transfer, your order will be processed once payment is verified by our team (usually within 1-2 business days).
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text style={styles.totalAmount}>
                {walletService.formatCurrency(pricing.finalPrice)}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.confirmButton, (loading || processingPayment) && styles.confirmButtonDisabled]}
              onPress={handleConfirmPayment}
              disabled={loading || loadingBalance || processingPayment}>
              {loading || processingPayment ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.confirmButtonText}>
                  {selectedPayment === 'online' ? 'Pay Now' : 'Confirm & Place Order'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>

    <PaymentVerificationModal
      visible={showVerificationModal}
      onClose={() => setShowVerificationModal(false)}
      onVerify={handleVerifyPayment}
      paymentMethod={verificationPaymentMethod}
      paystackReference={paystackRef}
      orderId={orderId}
    />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 20,
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
  },
  paymentOptions: {
    gap: 12,
  },
  paymentOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  paymentOptionSelected: {
    borderColor: '#f97316',
    backgroundColor: '#f0fdf4',
  },
  paymentOptionDisabled: {
    opacity: 0.5,
    backgroundColor: '#f9fafb',
  },
  paymentOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainerSelected: {
    backgroundColor: '#d1fae5',
  },
  paymentOptionText: {
    flex: 1,
    gap: 4,
  },
  paymentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paymentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  paymentTitleDisabled: {
    color: '#9ca3af',
  },
  paymentDescription: {
    fontSize: 13,
    color: '#6b7280',
  },
  paymentDescriptionDisabled: {
    color: '#9ca3af',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#dbeafe',
  },
  badgeWarning: {
    backgroundColor: '#fef3c7',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1e40af',
  },
  badgeTextWarning: {
    color: '#92400e',
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    fontSize: 13,
    color: '#dc2626',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    gap: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: '#f97316',
  },
  confirmButton: {
    backgroundColor: '#f97316',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  bankAccountsSection: {
    marginTop: 16,
    gap: 12,
  },
  guidelinesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  guidelinesTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f97316',
  },
  guidelinesText: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
    marginBottom: 8,
  },
  bankAccountCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 12,
  },
  bankAccountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  bankName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  accountDetails: {
    gap: 8,
  },
  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accountLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  accountValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  accountGuidelines: {
    backgroundColor: '#fef3c7',
    padding: 8,
    borderRadius: 8,
    marginTop: 4,
  },
  accountGuidelinesText: {
    fontSize: 12,
    color: '#92400e',
    lineHeight: 16,
  },
  transferNotice: {
    backgroundColor: '#dbeafe',
    padding: 12,
    borderRadius: 8,
    marginTop: 4,
  },
  transferNoticeText: {
    fontSize: 12,
    color: '#1e40af',
    lineHeight: 16,
  },
  deliveryTimeOptions: {
    gap: 12,
  },
  deliveryTimeOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  deliveryTimeOptionSelected: {
    borderColor: '#f97316',
    backgroundColor: '#f0fdf4',
  },
  deliveryTimeOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  deliveryTimeText: {
    flex: 1,
    gap: 2,
  },
  deliveryTimeTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  deliveryTimeTitleSelected: {
    color: '#f97316',
  },
  deliveryTimeDescription: {
    fontSize: 13,
    color: '#6b7280',
  },
  schedulingInputs: {
    marginTop: 16,
    gap: 12,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
  },
});

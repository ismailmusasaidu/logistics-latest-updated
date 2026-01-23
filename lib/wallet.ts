import { supabase } from './supabase';

export type WalletTransaction = {
  id: string;
  user_id: string;
  amount: number;
  transaction_type: 'credit' | 'debit';
  description: string;
  reference_type: 'recharge' | 'order_payment' | 'refund' | 'admin_adjustment';
  reference_id: string | null;
  balance_after: number;
  created_at: string;
};

export type WalletRecharge = {
  id: string;
  user_id: string;
  amount: number;
  reference: string;
  status: 'pending' | 'completed' | 'failed';
  paystack_reference: string | null;
  created_at: string;
  completed_at: string | null;
  failed_at: string | null;
};

export type BankAccount = {
  id: string;
  user_id: string;
  account_number: string;
  account_name: string;
  bank_name: string;
  bank_code: string;
  recipient_code: string | null;
  is_verified: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type Withdrawal = {
  id: string;
  user_id: string;
  bank_account_id: string;
  amount: number;
  fee: number;
  net_amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  reference: string;
  paystack_reference: string | null;
  failure_reason: string | null;
  requested_at: string;
  processed_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
};

export type PaymentMethod = 'wallet' | 'online' | 'cash' | 'transfer';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export const walletService = {
  async getBalance(userId: string): Promise<number> {
    const { data, error } = await supabase
      .from('profiles')
      .select('wallet_balance')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    return data?.wallet_balance || 0;
  },

  async getTransactions(userId: string, limit = 50): Promise<WalletTransaction[]> {
    const { data, error } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  async processWalletPayment(
    userId: string,
    amount: number,
    orderId: string,
    orderNumber: string
  ): Promise<boolean> {
    const { data, error } = await supabase.rpc('process_wallet_payment', {
      p_user_id: userId,
      p_amount: amount,
      p_order_id: orderId,
      p_order_number: orderNumber,
    });

    if (error) {
      console.error('Wallet payment error:', error);
      throw new Error('Failed to process wallet payment');
    }

    return data === true;
  },

  async addBalance(
    userId: string,
    amount: number,
    description: string,
    referenceType: 'recharge' | 'admin_adjustment' = 'recharge'
  ): Promise<boolean> {
    const { data, error } = await supabase.rpc('add_wallet_balance', {
      p_user_id: userId,
      p_amount: amount,
      p_description: description,
      p_reference_type: referenceType,
    });

    if (error) {
      console.error('Add balance error:', error);
      throw new Error('Failed to add wallet balance');
    }

    return data === true;
  },

  async refundToWallet(
    userId: string,
    amount: number,
    orderId: string,
    orderNumber: string
  ): Promise<boolean> {
    const { data, error } = await supabase.rpc('refund_to_wallet', {
      p_user_id: userId,
      p_amount: amount,
      p_order_id: orderId,
      p_order_number: orderNumber,
    });

    if (error) {
      console.error('Refund error:', error);
      throw new Error('Failed to process refund');
    }

    return data === true;
  },

  formatCurrency(amount: number): string {
    return `₦${amount.toFixed(2)}`;
  },

  getTransactionIcon(type: 'credit' | 'debit'): string {
    return type === 'credit' ? '+' : '-';
  },

  getTransactionColor(type: 'credit' | 'debit'): string {
    return type === 'credit' ? '#10b981' : '#ef4444';
  },

  async initializeWalletFunding(amount: number): Promise<{
    success: boolean;
    authorizationUrl?: string;
    reference?: string;
    error?: string;
  }> {
    try {
      const apiUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/initialize-wallet-funding`;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to initialize wallet funding');
      }

      return {
        success: true,
        authorizationUrl: data.authorizationUrl,
        reference: data.reference,
      };
    } catch (error: any) {
      console.error('Initialize wallet funding error:', error);
      return {
        success: false,
        error: error.message || 'Failed to initialize wallet funding',
      };
    }
  },

  async verifyWalletFunding(reference: string): Promise<{
    success: boolean;
    verified?: boolean;
    amount?: number;
    message?: string;
    error?: string;
  }> {
    try {
      const apiUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/verify-wallet-funding`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reference }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify wallet funding');
      }

      return {
        success: data.success,
        verified: data.verified,
        amount: data.amount,
        message: data.message,
      };
    } catch (error: any) {
      console.error('Verify wallet funding error:', error);
      return {
        success: false,
        error: error.message || 'Failed to verify wallet funding',
      };
    }
  },

  async getRechargeHistory(userId: string, limit = 20): Promise<WalletRecharge[]> {
    const { data, error } = await supabase
      .from('wallet_recharges')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  getRechargeStatusColor(status: 'pending' | 'completed' | 'failed'): string {
    switch (status) {
      case 'completed':
        return '#10b981';
      case 'pending':
        return '#f59e0b';
      case 'failed':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  },

  getRechargeStatusText(status: 'pending' | 'completed' | 'failed'): string {
    switch (status) {
      case 'completed':
        return 'Success';
      case 'pending':
        return 'Pending';
      case 'failed':
        return 'Failed';
      default:
        return 'Unknown';
    }
  },

  async resolveBankAccount(accountNumber: string, bankCode: string): Promise<{
    success: boolean;
    accountName?: string;
    accountNumber?: string;
    error?: string;
  }> {
    try {
      const apiUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/resolve-bank-account`;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accountNumber, bankCode }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to resolve bank account');
      }

      return {
        success: true,
        accountName: data.accountName,
        accountNumber: data.accountNumber,
      };
    } catch (error: any) {
      console.error('Resolve bank account error:', error);
      return {
        success: false,
        error: error.message || 'Failed to resolve bank account',
      };
    }
  },

  async addBankAccount(
    userId: string,
    accountNumber: string,
    accountName: string,
    bankName: string,
    bankCode: string
  ): Promise<boolean> {
    const { error } = await supabase.from('user_bank_accounts').insert({
      user_id: userId,
      account_number: accountNumber,
      account_name: accountName,
      bank_name: bankName,
      bank_code: bankCode,
      is_verified: true,
    });

    if (error) {
      console.error('Add bank account error:', error);
      throw new Error('Failed to add bank account');
    }

    return true;
  },

  async getBankAccounts(userId: string): Promise<BankAccount[]> {
    const { data, error } = await supabase
      .from('user_bank_accounts')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async setDefaultBankAccount(userId: string, accountId: string): Promise<boolean> {
    await supabase
      .from('user_bank_accounts')
      .update({ is_default: false })
      .eq('user_id', userId);

    const { error } = await supabase
      .from('user_bank_accounts')
      .update({ is_default: true })
      .eq('id', accountId)
      .eq('user_id', userId);

    if (error) {
      console.error('Set default bank account error:', error);
      throw new Error('Failed to set default bank account');
    }

    return true;
  },

  async deleteBankAccount(accountId: string): Promise<boolean> {
    const { error } = await supabase
      .from('user_bank_accounts')
      .delete()
      .eq('id', accountId);

    if (error) {
      console.error('Delete bank account error:', error);
      throw new Error('Failed to delete bank account');
    }

    return true;
  },

  async requestWithdrawal(
    userId: string,
    bankAccountId: string,
    amount: number
  ): Promise<{
    success: boolean;
    withdrawalId?: string;
    reference?: string;
    fee?: number;
    netAmount?: number;
    error?: string;
  }> {
    try {
      const { data, error } = await supabase.rpc('request_wallet_withdrawal', {
        p_user_id: userId,
        p_bank_account_id: bankAccountId,
        p_amount: amount,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.success) {
        throw new Error(data.error);
      }

      return {
        success: true,
        withdrawalId: data.withdrawal_id,
        reference: data.reference,
        fee: data.fee,
        netAmount: data.net_amount,
      };
    } catch (error: any) {
      console.error('Request withdrawal error:', error);
      return {
        success: false,
        error: error.message || 'Failed to request withdrawal',
      };
    }
  },

  async getWithdrawals(userId: string, limit = 20): Promise<Withdrawal[]> {
    const { data, error } = await supabase
      .from('wallet_withdrawals')
      .select('*')
      .eq('user_id', userId)
      .order('requested_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  getWithdrawalStatusColor(status: Withdrawal['status']): string {
    switch (status) {
      case 'completed':
        return '#10b981';
      case 'processing':
        return '#3b82f6';
      case 'pending':
        return '#f59e0b';
      case 'failed':
      case 'cancelled':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  },

  getWithdrawalStatusText(status: Withdrawal['status']): string {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'processing':
        return 'Processing';
      case 'pending':
        return 'Pending';
      case 'failed':
        return 'Failed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return 'Unknown';
    }
  },

  calculateWithdrawalFee(amount: number): number {
    if (amount <= 5000) {
      return 50;
    } else if (amount <= 50000) {
      return 100;
    } else {
      return 200;
    }
  },
};

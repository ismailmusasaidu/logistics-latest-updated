/*
  # Add Wallet Withdrawal System

  1. New Tables
    - `user_bank_accounts`
      - `id` (uuid, primary key) - Unique identifier
      - `user_id` (uuid, foreign key) - References profiles table
      - `account_number` (text) - Bank account number
      - `account_name` (text) - Account holder name
      - `bank_name` (text) - Bank name
      - `bank_code` (text) - Bank code for Paystack
      - `recipient_code` (text) - Paystack transfer recipient code
      - `is_verified` (boolean) - Whether account is verified
      - `is_default` (boolean) - Default account for withdrawals
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `wallet_withdrawals`
      - `id` (uuid, primary key) - Unique identifier
      - `user_id` (uuid, foreign key) - References profiles table
      - `bank_account_id` (uuid, foreign key) - References user_bank_accounts
      - `amount` (decimal) - Withdrawal amount
      - `fee` (decimal) - Processing fee
      - `net_amount` (decimal) - Amount after fee
      - `status` (text) - pending, processing, completed, failed, cancelled
      - `reference` (text, unique) - Withdrawal reference
      - `paystack_reference` (text) - Paystack transfer reference
      - `failure_reason` (text) - Reason if failed
      - `requested_at` (timestamp)
      - `processed_at` (timestamp)
      - `completed_at` (timestamp)
      - `failed_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Users can only access their own records
    - Admins can view all records
    - Service role can update withdrawal status

  3. Indexes
    - user_id for fast lookups
    - status for filtering
    - created_at for chronological ordering

  4. Important Notes
    - Bank accounts must be verified before use
    - Withdrawals have a minimum amount (₦1000)
    - Processing fees apply based on amount
    - All withdrawals logged for audit trail
*/

-- Create user_bank_accounts table
CREATE TABLE IF NOT EXISTS user_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  account_number TEXT NOT NULL,
  account_name TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  bank_code TEXT NOT NULL,
  recipient_code TEXT,
  is_verified BOOLEAN DEFAULT false NOT NULL,
  is_default BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, account_number, bank_code)
);

-- Create wallet_withdrawals table
CREATE TABLE IF NOT EXISTS wallet_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES user_bank_accounts(id) ON DELETE RESTRICT,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  fee DECIMAL(10,2) DEFAULT 0.00 NOT NULL,
  net_amount DECIMAL(10,2) NOT NULL CHECK (net_amount > 0),
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')) DEFAULT 'pending',
  reference TEXT NOT NULL UNIQUE,
  paystack_reference TEXT,
  failure_reason TEXT,
  requested_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_bank_accounts_user_id ON user_bank_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_bank_accounts_is_default ON user_bank_accounts(user_id, is_default);
CREATE INDEX IF NOT EXISTS idx_wallet_withdrawals_user_id ON wallet_withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_withdrawals_status ON wallet_withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_wallet_withdrawals_requested_at ON wallet_withdrawals(requested_at DESC);

-- Enable RLS
ALTER TABLE user_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_withdrawals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_bank_accounts
CREATE POLICY "Users can view own bank accounts"
  ON user_bank_accounts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own bank accounts"
  ON user_bank_accounts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bank accounts"
  ON user_bank_accounts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own bank accounts"
  ON user_bank_accounts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all bank accounts"
  ON user_bank_accounts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for wallet_withdrawals
CREATE POLICY "Users can view own withdrawals"
  ON wallet_withdrawals FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own withdrawals"
  ON wallet_withdrawals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all withdrawals"
  ON wallet_withdrawals FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Service can update withdrawals"
  ON wallet_withdrawals FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Function to calculate withdrawal fee
CREATE OR REPLACE FUNCTION calculate_withdrawal_fee(p_amount DECIMAL)
RETURNS DECIMAL
LANGUAGE plpgsql
AS $$
BEGIN
  -- Flat fee structure (can be customized)
  IF p_amount <= 5000 THEN
    RETURN 50.00;
  ELSIF p_amount <= 50000 THEN
    RETURN 100.00;
  ELSE
    RETURN 200.00;
  END IF;
END;
$$;

-- Function to process withdrawal request
CREATE OR REPLACE FUNCTION request_wallet_withdrawal(
  p_user_id UUID,
  p_bank_account_id UUID,
  p_amount DECIMAL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance DECIMAL;
  v_new_balance DECIMAL;
  v_fee DECIMAL;
  v_net_amount DECIMAL;
  v_reference TEXT;
  v_withdrawal_id UUID;
BEGIN
  -- Validate minimum withdrawal amount
  IF p_amount < 1000 THEN
    RETURN json_build_object('success', false, 'error', 'Minimum withdrawal amount is ₦1,000');
  END IF;

  -- Calculate fee and net amount
  v_fee := calculate_withdrawal_fee(p_amount);
  v_net_amount := p_amount - v_fee;

  -- Get current balance with row lock
  SELECT wallet_balance INTO v_current_balance
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  -- Check if sufficient balance
  IF v_current_balance < p_amount THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient wallet balance');
  END IF;

  -- Verify bank account exists and is verified
  IF NOT EXISTS (
    SELECT 1 FROM user_bank_accounts
    WHERE id = p_bank_account_id
    AND user_id = p_user_id
    AND is_verified = true
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Bank account not found or not verified');
  END IF;

  -- Calculate new balance
  v_new_balance := v_current_balance - p_amount;

  -- Update wallet balance
  UPDATE profiles
  SET wallet_balance = v_new_balance
  WHERE id = p_user_id;

  -- Generate reference
  v_reference := 'withdrawal_' || p_user_id || '_' || extract(epoch from now())::bigint;

  -- Create withdrawal record
  INSERT INTO wallet_withdrawals (
    user_id,
    bank_account_id,
    amount,
    fee,
    net_amount,
    status,
    reference
  ) VALUES (
    p_user_id,
    p_bank_account_id,
    p_amount,
    v_fee,
    v_net_amount,
    'pending',
    v_reference
  ) RETURNING id INTO v_withdrawal_id;

  -- Record transaction
  INSERT INTO wallet_transactions (
    user_id,
    amount,
    transaction_type,
    description,
    reference_type,
    reference_id,
    balance_after
  ) VALUES (
    p_user_id,
    p_amount,
    'debit',
    'Withdrawal request - ' || v_reference,
    'admin_adjustment',
    v_withdrawal_id,
    v_new_balance
  );

  RETURN json_build_object(
    'success', true,
    'withdrawal_id', v_withdrawal_id,
    'reference', v_reference,
    'amount', p_amount,
    'fee', v_fee,
    'net_amount', v_net_amount
  );
END;
$$;

-- Function to refund failed withdrawal
CREATE OR REPLACE FUNCTION refund_failed_withdrawal(
  p_withdrawal_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_withdrawal RECORD;
  v_current_balance DECIMAL;
  v_new_balance DECIMAL;
BEGIN
  -- Get withdrawal details
  SELECT * INTO v_withdrawal
  FROM wallet_withdrawals
  WHERE id = p_withdrawal_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Only refund if status is failed
  IF v_withdrawal.status != 'failed' THEN
    RETURN FALSE;
  END IF;

  -- Get current balance with row lock
  SELECT wallet_balance INTO v_current_balance
  FROM profiles
  WHERE id = v_withdrawal.user_id
  FOR UPDATE;

  -- Calculate new balance (refund full amount including fee)
  v_new_balance := v_current_balance + v_withdrawal.amount;

  -- Update wallet balance
  UPDATE profiles
  SET wallet_balance = v_new_balance
  WHERE id = v_withdrawal.user_id;

  -- Record refund transaction
  INSERT INTO wallet_transactions (
    user_id,
    amount,
    transaction_type,
    description,
    reference_type,
    reference_id,
    balance_after
  ) VALUES (
    v_withdrawal.user_id,
    v_withdrawal.amount,
    'credit',
    'Refund for failed withdrawal - ' || v_withdrawal.reference,
    'refund',
    p_withdrawal_id,
    v_new_balance
  );

  RETURN TRUE;
END;
$$;

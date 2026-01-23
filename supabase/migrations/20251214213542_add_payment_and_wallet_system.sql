/*
  # Add Payment and Wallet System

  1. Profile Updates
    - Add `wallet_balance` column to profiles (default 0)
  
  2. Order Updates
    - Add `payment_method` column (wallet, online, cash)
    - Add `payment_status` column (pending, completed, failed)
  
  3. New Tables
    - `wallet_transactions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `amount` (decimal)
      - `transaction_type` (credit, debit)
      - `description` (text)
      - `reference_type` (recharge, order_payment, refund)
      - `reference_id` (uuid, optional reference to order)
      - `created_at` (timestamp)
  
  4. Security
    - Enable RLS on wallet_transactions
    - Add policies for users to view their own transactions
    - Add policies for admins to manage all transactions
    - Update profiles policies for wallet balance updates
*/

-- Add wallet_balance to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'wallet_balance'
  ) THEN
    ALTER TABLE profiles ADD COLUMN wallet_balance DECIMAL(10,2) DEFAULT 0.00 NOT NULL;
  END IF;
END $$;

-- Add payment fields to orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_method TEXT CHECK (payment_method IN ('wallet', 'online', 'cash')) DEFAULT 'cash';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_status TEXT CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')) DEFAULT 'pending';
  END IF;
END $$;

-- Create wallet_transactions table
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('credit', 'debit')),
  description TEXT NOT NULL,
  reference_type TEXT NOT NULL CHECK (reference_type IN ('recharge', 'order_payment', 'refund', 'admin_adjustment')),
  reference_id UUID,
  balance_after DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at DESC);

-- RLS Policies for wallet_transactions
CREATE POLICY "Users can view own wallet transactions"
  ON wallet_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all wallet transactions"
  ON wallet_transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "System can insert wallet transactions"
  ON wallet_transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Function to process wallet payment
CREATE OR REPLACE FUNCTION process_wallet_payment(
  p_user_id UUID,
  p_amount DECIMAL,
  p_order_id UUID,
  p_order_number TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance DECIMAL;
  v_new_balance DECIMAL;
BEGIN
  -- Get current balance with row lock
  SELECT wallet_balance INTO v_current_balance
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;
  
  -- Check if sufficient balance
  IF v_current_balance < p_amount THEN
    RETURN FALSE;
  END IF;
  
  -- Calculate new balance
  v_new_balance := v_current_balance - p_amount;
  
  -- Update wallet balance
  UPDATE profiles
  SET wallet_balance = v_new_balance
  WHERE id = p_user_id;
  
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
    'Payment for order ' || p_order_number,
    'order_payment',
    p_order_id,
    v_new_balance
  );
  
  -- Update order payment status
  UPDATE orders
  SET payment_status = 'completed'
  WHERE id = p_order_id;
  
  RETURN TRUE;
END;
$$;

-- Function to add wallet balance
CREATE OR REPLACE FUNCTION add_wallet_balance(
  p_user_id UUID,
  p_amount DECIMAL,
  p_description TEXT,
  p_reference_type TEXT DEFAULT 'recharge'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance DECIMAL;
  v_new_balance DECIMAL;
BEGIN
  -- Get current balance with row lock
  SELECT wallet_balance INTO v_current_balance
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;
  
  -- Calculate new balance
  v_new_balance := v_current_balance + p_amount;
  
  -- Update wallet balance
  UPDATE profiles
  SET wallet_balance = v_new_balance
  WHERE id = p_user_id;
  
  -- Record transaction
  INSERT INTO wallet_transactions (
    user_id,
    amount,
    transaction_type,
    description,
    reference_type,
    balance_after
  ) VALUES (
    p_user_id,
    p_amount,
    'credit',
    p_description,
    p_reference_type,
    v_new_balance
  );
  
  RETURN TRUE;
END;
$$;

-- Function to refund to wallet
CREATE OR REPLACE FUNCTION refund_to_wallet(
  p_user_id UUID,
  p_amount DECIMAL,
  p_order_id UUID,
  p_order_number TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance DECIMAL;
  v_new_balance DECIMAL;
BEGIN
  -- Get current balance with row lock
  SELECT wallet_balance INTO v_current_balance
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;
  
  -- Calculate new balance
  v_new_balance := v_current_balance + p_amount;
  
  -- Update wallet balance
  UPDATE profiles
  SET wallet_balance = v_new_balance
  WHERE id = p_user_id;
  
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
    'credit',
    'Refund for order ' || p_order_number,
    'refund',
    p_order_id,
    v_new_balance
  );
  
  -- Update order payment status
  UPDATE orders
  SET payment_status = 'refunded'
  WHERE id = p_order_id;
  
  RETURN TRUE;
END;
$$;

/*
  # Add Wallet Recharges Tracking Table

  1. New Table
    - `wallet_recharges`
      - `id` (uuid, primary key) - Unique identifier for recharge record
      - `user_id` (uuid, foreign key) - References profiles table
      - `amount` (decimal) - Amount to be recharged
      - `reference` (text, unique) - Paystack payment reference
      - `status` (text) - Status: pending, completed, failed
      - `paystack_reference` (text, nullable) - Actual Paystack transaction reference
      - `created_at` (timestamp) - When recharge was initiated
      - `completed_at` (timestamp, nullable) - When payment was successful
      - `failed_at` (timestamp, nullable) - When payment failed

  2. Security
    - Enable RLS on wallet_recharges table
    - Users can view their own recharge records
    - Users can create their own recharge records
    - Admins can view all recharge records

  3. Indexes
    - Index on user_id for fast lookups
    - Index on reference for payment verification
    - Index on status for filtering
    - Index on created_at for chronological ordering

  4. Important Notes
    - This table tracks all wallet funding attempts via Paystack
    - Provides audit trail for all recharge transactions
    - Helps prevent duplicate payments
    - Enables better customer support and troubleshooting
*/

-- Create wallet_recharges table
CREATE TABLE IF NOT EXISTS wallet_recharges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  reference TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')) DEFAULT 'pending',
  paystack_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_wallet_recharges_user_id ON wallet_recharges(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_recharges_reference ON wallet_recharges(reference);
CREATE INDEX IF NOT EXISTS idx_wallet_recharges_status ON wallet_recharges(status);
CREATE INDEX IF NOT EXISTS idx_wallet_recharges_created_at ON wallet_recharges(created_at DESC);

-- Enable RLS
ALTER TABLE wallet_recharges ENABLE ROW LEVEL SECURITY;

-- Users can view their own recharge records
CREATE POLICY "Users can view own wallet recharges"
  ON wallet_recharges FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can create their own recharge records
CREATE POLICY "Users can create own wallet recharges"
  ON wallet_recharges FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all recharge records
CREATE POLICY "Admins can view all wallet recharges"
  ON wallet_recharges FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Service role can update recharge status (for edge functions)
CREATE POLICY "Service can update wallet recharges"
  ON wallet_recharges FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

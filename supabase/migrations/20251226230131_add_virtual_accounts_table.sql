/*
  # Add Virtual Accounts Table

  1. New Tables
    - `virtual_accounts`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `account_number` (text, unique) - The virtual account number
      - `account_name` (text) - Customer name on the account
      - `bank_name` (text) - Bank providing the virtual account (e.g., Wema Bank)
      - `bank_code` (text) - Bank code
      - `provider` (text) - Payment provider (paystack)
      - `provider_reference` (text) - Paystack customer code
      - `is_active` (boolean) - Whether account is active
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `virtual_accounts` table
    - Add policy for users to view their own virtual account
    - Add policy for authenticated users to insert their own virtual account
    - Add policy for users to update their own virtual account

  3. Indexes
    - Index on user_id for fast lookups
    - Unique index on account_number
*/

CREATE TABLE IF NOT EXISTS virtual_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  account_number text UNIQUE NOT NULL,
  account_name text NOT NULL,
  bank_name text NOT NULL,
  bank_code text NOT NULL,
  provider text DEFAULT 'paystack' NOT NULL,
  provider_reference text UNIQUE NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_virtual_accounts_user_id ON virtual_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_virtual_accounts_provider_reference ON virtual_accounts(provider_reference);

-- Enable RLS
ALTER TABLE virtual_accounts ENABLE ROW LEVEL SECURITY;

-- Users can view their own virtual account
CREATE POLICY "Users can view own virtual account"
  ON virtual_accounts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own virtual account
CREATE POLICY "Users can create own virtual account"
  ON virtual_accounts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own virtual account
CREATE POLICY "Users can update own virtual account"
  ON virtual_accounts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all virtual accounts
CREATE POLICY "Admins can view all virtual accounts"
  ON virtual_accounts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

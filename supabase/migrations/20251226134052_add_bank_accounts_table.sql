/*
  # Add Bank Accounts Table for Transfer Payments

  1. New Tables
    - `bank_accounts`
      - `id` (uuid, primary key) - Unique identifier for each bank account
      - `bank_name` (text) - Name of the bank
      - `account_name` (text) - Account holder name
      - `account_number` (text) - Bank account number
      - `account_type` (text) - Type of account (e.g., Checking, Savings)
      - `swift_code` (text, nullable) - SWIFT/BIC code for international transfers
      - `branch` (text, nullable) - Bank branch information
      - `is_active` (boolean) - Whether this account is currently active
      - `display_order` (integer) - Order in which to display the account
      - `created_at` (timestamptz) - Timestamp of account creation
      - `updated_at` (timestamptz) - Timestamp of last update

  2. Security
    - Enable RLS on `bank_accounts` table
    - Add policy for all authenticated users to read active bank accounts
    - Add policy for admin users to manage bank accounts
*/

-- Create bank_accounts table
CREATE TABLE IF NOT EXISTS bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name text NOT NULL,
  account_name text NOT NULL,
  account_number text NOT NULL,
  account_type text DEFAULT 'Checking',
  swift_code text,
  branch text,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  guidelines text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can view active bank accounts
CREATE POLICY "Authenticated users can view active bank accounts"
  ON bank_accounts
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Policy: Admins can view all bank accounts
CREATE POLICY "Admins can view all bank accounts"
  ON bank_accounts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: Admins can insert bank accounts
CREATE POLICY "Admins can insert bank accounts"
  ON bank_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: Admins can update bank accounts
CREATE POLICY "Admins can update bank accounts"
  ON bank_accounts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: Admins can delete bank accounts
CREATE POLICY "Admins can delete bank accounts"
  ON bank_accounts
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Insert default bank accounts
INSERT INTO bank_accounts (bank_name, account_name, account_number, account_type, branch, display_order, guidelines)
VALUES 
  ('First National Bank', 'QuickDeliver Inc.', '1234567890', 'Business Checking', 'Main Branch', 1, 'Please include your order ID in the transfer notes'),
  ('City Bank', 'QuickDeliver Inc.', '0987654321', 'Business Savings', 'Downtown Branch', 2, 'Transfer usually takes 1-2 business days to process')
ON CONFLICT DO NOTHING;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_bank_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bank_accounts_updated_at
  BEFORE UPDATE ON bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_bank_accounts_updated_at();
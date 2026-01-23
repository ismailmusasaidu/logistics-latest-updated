/*
  # Add Transfer Payment Verification System

  1. New Columns
    - `transfer_reference` (text, unique) - Unique reference ID for customers to include in bank transfer notes
    - `payment_verified` (boolean) - Whether the payment has been verified by admin
    - `payment_verified_at` (timestamptz) - When the payment was verified
    - `payment_verified_by` (uuid) - Admin user who verified the payment
    
  2. Changes
    - Add function to auto-generate transfer reference when order is created with 'transfer' payment method
    - Transfer reference format: "TRF-{ORDER_NUMBER}" for easy matching
    
  3. Security
    - Only admins can update payment verification fields
    
  4. Notes
    - When customer selects bank transfer, they get a unique reference to include in transfer notes
    - Admins can then easily match incoming bank transfers with orders
    - Payment verification helps track which orders have been paid
*/

-- Add transfer verification columns to orders table
DO $$
BEGIN
  -- Add transfer_reference column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'transfer_reference'
  ) THEN
    ALTER TABLE orders ADD COLUMN transfer_reference text UNIQUE;
  END IF;

  -- Add payment_verified column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'payment_verified'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_verified boolean DEFAULT false;
  END IF;

  -- Add payment_verified_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'payment_verified_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_verified_at timestamptz;
  END IF;

  -- Add payment_verified_by column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'payment_verified_by'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_verified_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create function to generate transfer reference
CREATE OR REPLACE FUNCTION generate_transfer_reference()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate transfer reference if payment method is 'transfer' and reference is not already set
  IF NEW.payment_method = 'transfer' AND NEW.transfer_reference IS NULL THEN
    NEW.transfer_reference := 'TRF-' || NEW.order_number;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate transfer reference
DROP TRIGGER IF EXISTS generate_transfer_reference_trigger ON orders;
CREATE TRIGGER generate_transfer_reference_trigger
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION generate_transfer_reference();

-- Add RLS policy for admins to verify payments
CREATE POLICY "Admins can verify payments"
  ON orders
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

-- Create index for faster transfer reference lookups
CREATE INDEX IF NOT EXISTS idx_orders_transfer_reference ON orders(transfer_reference) WHERE transfer_reference IS NOT NULL;
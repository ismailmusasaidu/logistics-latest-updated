/*
  # Add Transfer Payment Method to Orders

  1. Changes
    - Drop existing check constraint on payment_method
    - Add new check constraint that includes 'transfer' as a valid payment method
    
  2. Notes
    - This allows customers to select bank transfer as a payment option
    - Existing orders are not affected
*/

-- Drop the existing check constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;

-- Add new check constraint with 'transfer' included
ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check 
  CHECK (payment_method IN ('wallet', 'online', 'cash', 'transfer'));
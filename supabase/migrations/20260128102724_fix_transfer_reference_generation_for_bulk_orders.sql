/*
  # Fix transfer reference generation for bulk orders
  
  1. Changes
    - Update `generate_transfer_reference` function to use order ID instead of order_number
    - This fixes duplicate key violation when creating bulk orders with transfer payment
    - Transfer references will be unique even when order_number is initially empty
*/

-- Drop and recreate the function with better logic
CREATE OR REPLACE FUNCTION generate_transfer_reference()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate transfer reference if payment method is 'transfer' and reference is not already set
  IF NEW.payment_method = 'transfer' AND NEW.transfer_reference IS NULL THEN
    -- Use order ID to ensure uniqueness (ID is guaranteed to be set on INSERT)
    -- If order_number exists and is not empty, use it; otherwise use the ID
    IF NEW.order_number IS NOT NULL AND NEW.order_number != '' THEN
      NEW.transfer_reference := 'TRF-' || NEW.order_number;
    ELSE
      -- For new records, ID will be set by default, so we can use it
      NEW.transfer_reference := 'TRF-' || NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

/*
  # Add Order Size Field

  1. Changes
    - Add `order_size` column to `orders` table
    - Add check constraint to ensure only valid values (small, medium, large)
  
  2. Details
    - Column is optional (nullable) to maintain backward compatibility
    - Valid values: 'small', 'medium', 'large'
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'order_size'
  ) THEN
    ALTER TABLE orders ADD COLUMN order_size text;
    
    ALTER TABLE orders ADD CONSTRAINT order_size_check 
    CHECK (order_size IS NULL OR order_size IN ('small', 'medium', 'large'));
  END IF;
END $$;

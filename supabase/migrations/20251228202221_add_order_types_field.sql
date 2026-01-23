/*
  # Add Order Types Field

  1. Changes
    - Add `order_types` column to `orders` table as text array
    - This allows multiple order types to be associated with a single order

  2. Details
    - Column is optional (nullable) to maintain backward compatibility
    - Stores an array of order type strings (e.g., ['Fragile', 'Express'])
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'order_types'
  ) THEN
    ALTER TABLE orders ADD COLUMN order_types text[];
  END IF;
END $$;

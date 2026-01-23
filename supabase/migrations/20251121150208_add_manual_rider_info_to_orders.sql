/*
  # Add Manual Rider Information to Orders

  1. Changes
    - Add `rider_name` column to store manually entered rider name
    - Add `rider_phone` column to store manually entered rider phone
    - These fields allow admins to assign rider info manually when a rider is not in the system
    
  2. Notes
    - These fields are optional and only used when rider_id is null
    - When rider_id is set, the rider info comes from the riders table
    - This provides flexibility for manual assignments
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'rider_name'
  ) THEN
    ALTER TABLE orders ADD COLUMN rider_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'rider_phone'
  ) THEN
    ALTER TABLE orders ADD COLUMN rider_phone text;
  END IF;
END $$;
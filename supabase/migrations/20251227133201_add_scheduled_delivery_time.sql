/*
  # Add Scheduled Delivery Time to Orders

  1. Changes
    - Add `scheduled_delivery_time` column to `orders` table
      - Type: timestamptz (timestamp with timezone)
      - Nullable: true (null means immediate delivery)
      - Description: Optional scheduled time for future delivery
    
  2. Notes
    - If null, delivery is treated as immediate (ASAP)
    - If set, delivery should be scheduled for the specified time
    - Riders can see scheduled deliveries and plan accordingly
*/

-- Add scheduled_delivery_time column to orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'scheduled_delivery_time'
  ) THEN
    ALTER TABLE orders ADD COLUMN scheduled_delivery_time timestamptz;
  END IF;
END $$;
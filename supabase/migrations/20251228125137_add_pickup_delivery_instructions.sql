/*
  # Add Pickup and Delivery Instructions to Orders

  1. Changes
    - Add `pickup_instructions` column to `orders` table
      - Optional text field for special instructions at pickup location
      - Examples: gate codes, parking info, contact person
    - Add `delivery_instructions` column to `orders` table
      - Optional text field for special instructions at delivery location
      - Examples: call on arrival, security procedures, floor/unit info

  2. Notes
    - Both fields are optional (nullable)
    - No default values
    - Existing orders will have NULL values for these fields
*/

-- Add pickup instructions column
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS pickup_instructions text;

-- Add delivery instructions column
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS delivery_instructions text;
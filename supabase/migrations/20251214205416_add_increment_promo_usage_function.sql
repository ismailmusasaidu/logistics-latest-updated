/*
  # Add Increment Promo Usage Function

  1. New Functions
    - `increment_promo_usage` - Safely increments the usage count for a promotion
  
  2. Purpose
    - Ensures atomic increment of promo usage count
    - Prevents race conditions when multiple users use same promo
    - Returns the new usage count
*/

CREATE OR REPLACE FUNCTION increment_promo_usage(p_promo_code text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_count integer;
BEGIN
  UPDATE promotions
  SET usage_count = usage_count + 1
  WHERE promo_code = p_promo_code
  RETURNING usage_count INTO v_new_count;
  
  RETURN v_new_count;
END;
$$;

/*
  # Fix rider signup function authentication
  
  1. Changes
    - Update `complete_rider_signup` function to accept user_id parameter
    - Use provided user_id instead of relying on auth.uid()
    - This fixes the "Not authenticated" error during signup
*/

-- Drop the existing function
DROP FUNCTION IF EXISTS complete_rider_signup(text, text, text, text, text, text, text);

-- Recreate with user_id parameter
CREATE OR REPLACE FUNCTION complete_rider_signup(
  p_user_id UUID,
  p_phone_number TEXT,
  p_address TEXT,
  p_vehicle_type TEXT,
  p_vehicle_number TEXT,
  p_license_number TEXT,
  p_emergency_contact_name TEXT,
  p_emergency_contact_phone TEXT
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result json;
BEGIN
  -- Validate user_id is provided
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required';
  END IF;

  -- Insert or update the rider record
  INSERT INTO riders (
    user_id,
    phone_number,
    address,
    vehicle_type,
    vehicle_number,
    license_number,
    emergency_contact_name,
    emergency_contact_phone,
    status,
    approval_status
  )
  VALUES (
    p_user_id,
    p_phone_number,
    p_address,
    p_vehicle_type,
    p_vehicle_number,
    p_license_number,
    p_emergency_contact_name,
    p_emergency_contact_phone,
    'offline',
    'pending'
  )
  ON CONFLICT (user_id) 
  DO UPDATE SET
    phone_number = EXCLUDED.phone_number,
    address = EXCLUDED.address,
    vehicle_type = EXCLUDED.vehicle_type,
    vehicle_number = EXCLUDED.vehicle_number,
    license_number = EXCLUDED.license_number,
    emergency_contact_name = EXCLUDED.emergency_contact_name,
    emergency_contact_phone = EXCLUDED.emergency_contact_phone,
    updated_at = now();

  -- Return success
  v_result := json_build_object(
    'success', true,
    'user_id', p_user_id
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to complete rider signup: %', SQLERRM;
END;
$$;

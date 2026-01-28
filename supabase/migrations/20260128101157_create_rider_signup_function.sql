/*
  # Create rider signup function
  
  Creates a secure function that allows users to complete their rider signup
  by providing all necessary details. This function runs with SECURITY DEFINER
  to bypass RLS policies during the initial rider creation.
  
  1. Function
    - `complete_rider_signup` - Creates/updates rider entry with all details
      - Takes rider details as parameters
      - Runs with elevated privileges to bypass RLS
      - Only allows users to create/update their own rider profile
  
  2. Security
    - Function validates that user is creating their own rider profile
    - Uses SECURITY DEFINER to bypass RLS during creation
    - Sets secure search_path to prevent SQL injection
*/

CREATE OR REPLACE FUNCTION complete_rider_signup(
  p_phone_number TEXT,
  p_address TEXT,
  p_vehicle_type TEXT,
  p_vehicle_number TEXT,
  p_license_number TEXT,
  p_emergency_contact_name TEXT DEFAULT '',
  p_emergency_contact_phone TEXT DEFAULT ''
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_result json;
BEGIN
  -- Get the authenticated user's ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
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
    v_user_id,
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
    'user_id', v_user_id
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to complete rider signup: %', SQLERRM;
END;
$$;
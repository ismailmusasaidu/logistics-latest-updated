/*
  # Update Profile Creation Trigger to Include Phone

  1. Changes
    - Update handle_new_user() function to extract phone from user metadata
    - Add phone field to profile insertion
    - Maintains existing role and full_name handling

  2. Security
    - Function remains SECURITY DEFINER to access auth schema
    - Maintains proper error handling
*/

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_role text;
  user_full_name text;
  user_phone text;
BEGIN
  -- Extract role, full_name, and phone from metadata, with defaults
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'customer');
  user_full_name := NEW.raw_user_meta_data->>'full_name';
  user_phone := NEW.raw_user_meta_data->>'phone';

  INSERT INTO public.profiles (id, email, role, full_name, phone)
  VALUES (NEW.id, NEW.email, user_role, user_full_name, user_phone)
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Could not create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

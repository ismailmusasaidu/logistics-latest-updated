/*
  # Fix Duplicate Profile Creation on Signup

  1. Changes
    - Update handle_new_user() function to read user metadata (full_name and role)
    - Use metadata from auth.users.raw_user_meta_data for profile creation
    - Set default role to 'customer' if not provided
    - Prevent duplicate profile inserts by using ON CONFLICT

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
BEGIN
  -- Extract role and full_name from metadata, with defaults
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'customer');
  user_full_name := NEW.raw_user_meta_data->>'full_name';

  INSERT INTO public.profiles (id, email, role, full_name)
  VALUES (NEW.id, NEW.email, user_role, user_full_name)
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Could not create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;
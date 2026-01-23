/*
  # Auto-confirm User Emails

  1. Changes
    - Create trigger to automatically confirm user emails on signup
    - Sets email_confirmed_at to current timestamp
    - Updates email_verified in user metadata

  2. Purpose
    - Disable email confirmation requirement for all users
    - Allow immediate login after signup without email verification
*/

CREATE OR REPLACE FUNCTION auto_confirm_user_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'auth'
AS $$
BEGIN
  -- Auto-confirm email on user creation
  NEW.email_confirmed_at := NOW();
  NEW.raw_user_meta_data := jsonb_set(
    COALESCE(NEW.raw_user_meta_data, '{}'::jsonb),
    '{email_verified}',
    'true'
  );
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created_confirm_email ON auth.users;

-- Create trigger that runs before insert
CREATE TRIGGER on_auth_user_created_confirm_email
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auto_confirm_user_email();
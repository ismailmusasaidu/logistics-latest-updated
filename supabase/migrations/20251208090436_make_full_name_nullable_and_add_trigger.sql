/*
  # Make full_name nullable and add auto profile creation

  1. Changes
    - Make full_name column nullable (users can add it later)
    - Create function to auto-create profiles for new users
    - Create trigger on auth.users table
    - Create profile for existing user
    
  2. Security
    - Function uses SECURITY DEFINER to bypass RLS during profile creation
*/

-- Make full_name nullable
ALTER TABLE public.profiles 
ALTER COLUMN full_name DROP NOT NULL;

-- Create function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'customer');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create profile for existing user
INSERT INTO public.profiles (id, email, role)
SELECT id, email, 'customer'
FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles WHERE profiles.id = auth.users.id
);
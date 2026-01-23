/*
  # Create Missing Rider Entries

  1. Changes
    - Create rider entries for any profiles with role 'rider' that don't have a corresponding rider entry
    
  2. Notes
    - This fixes existing data where users have role 'rider' but no entry in riders table
    - Sets default values for vehicle info which can be updated later
*/

INSERT INTO riders (user_id, vehicle_type, vehicle_number, license_number, status, rating, total_deliveries)
SELECT 
  p.id,
  'bike',
  'N/A',
  'N/A',
  'offline',
  5.0,
  0
FROM profiles p
WHERE p.role = 'rider'
  AND NOT EXISTS (
    SELECT 1 FROM riders r WHERE r.user_id = p.id
  );
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: 'customer' | 'rider' | 'admin';
  avatar_url: string | null;
  wallet_balance: number;
  created_at: string;
  updated_at: string;
};

export type Rider = {
  id: string;
  user_id: string;
  vehicle_type: 'bike' | 'motorcycle' | 'car' | 'van';
  vehicle_number: string;
  license_number: string;
  status: 'offline' | 'online';
  rating: number;
  total_deliveries: number;
  current_lat: number | null;
  current_lng: number | null;
  phone_number: string;
  address: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  approval_status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
};

export type BulkOrder = {
  id: string;
  customer_id: string;
  bulk_order_number: string;
  total_orders: number;
  total_fee: number;
  discount_percentage: number;
  final_fee: number;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Order = {
  id: string;
  customer_id: string;
  rider_id: string | null;
  rider_name: string | null;
  rider_phone: string | null;
  order_number: string;
  status: 'pending' | 'confirmed' | 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled';
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  pickup_instructions: string | null;
  delivery_address: string;
  delivery_lat: number;
  delivery_lng: number;
  delivery_instructions: string | null;
  recipient_name: string;
  recipient_phone: string;
  package_description: string;
  package_weight: number | null;
  delivery_fee: number;
  payment_method: 'wallet' | 'online' | 'cash' | 'transfer';
  payment_status: 'pending' | 'completed' | 'failed' | 'refunded';
  transfer_reference: string | null;
  payment_verified: boolean;
  payment_verified_at: string | null;
  payment_verified_by: string | null;
  notes: string | null;
  bulk_order_id: string | null;
  scheduled_delivery_time: string | null;
  order_types: string[] | null;
  order_size: 'small' | 'medium' | 'large' | null;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
  assigned_at: string | null;
  picked_up_at: string | null;
  in_transit_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
};

export type OrderTracking = {
  id: string;
  order_id: string;
  status: string;
  location_lat: number | null;
  location_lng: number | null;
  notes: string | null;
  created_at: string;
};

export type Rating = {
  id: string;
  order_id: string;
  rider_id: string;
  customer_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

export type OrderComplaint = {
  id: string;
  order_id: string;
  rider_id: string;
  complaint_type: 'customer_issue' | 'address_problem' | 'package_issue' | 'payment_issue' | 'other';
  description: string;
  status: 'open' | 'resolved' | 'dismissed';
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

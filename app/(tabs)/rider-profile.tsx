import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, TextInput, ActivityIndicator } from 'react-native';
import { User, Mail, Bike, Star, LogOut, TrendingUp, Edit, Save, X, Phone } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, Rider } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { Fonts } from '@/constants/fonts';

export default function RiderProfile() {
  const { profile, signOut, refreshProfile } = useAuth();
  const [riderData, setRiderData] = useState<Rider | null>(null);
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadRiderData();
  }, []);

  const loadRiderData = async () => {
    try {
      const { data, error } = await supabase
        .from('riders')
        .select('*')
        .eq('user_id', profile?.id)
        .maybeSingle();

      if (error) throw error;
      setRiderData(data);
    } catch (error) {
      console.error('Error loading rider data:', error);
    }
  };

  const handleEdit = () => {
    setFullName(profile?.full_name || '');
    setPhone(profile?.phone || '');
    setError(null);
    setSuccess(null);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setFullName(profile?.full_name || '');
    setPhone(profile?.phone || '');
    setError(null);
    setSuccess(null);
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!profile?.id) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim() || null,
          phone: phone.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      await refreshProfile();
      setSuccess('Profile updated successfully');
      setIsEditing(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error updating profile:', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    const confirmed = Platform.OS === 'web'
      ? window.confirm('Are you sure you want to sign out?')
      : true;

    if (confirmed) {
      try {
        console.log('Rider profile: Starting sign out...');
        await signOut();
        console.log('Rider profile: Sign out complete, redirecting...');
        router.replace('/auth');
      } catch (error) {
        console.error('Rider profile: Error signing out:', error);
        if (Platform.OS === 'web') {
          alert('Failed to sign out: ' + (error as Error).message);
        }
      }
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
        {!isEditing && (
          <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
            <Edit size={24} color="#f97316" strokeWidth={2.5} />
          </TouchableOpacity>
        )}
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {success && (
        <View style={styles.successBanner}>
          <Text style={styles.successText}>{success}</Text>
        </View>
      )}

      <View  style={styles.profileCard}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <User size={48} color="#ffffff" />
          </View>
        </View>

        {isEditing ? (
          <View style={styles.editSection}>
            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter your full name"
              editable={!loading}
            />
          </View>
        ) : (
          <>
            <Text style={styles.name}>{profile?.full_name || 'No name set'}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>Rider</Text>
            </View>

            {riderData && (
              <View style={styles.ratingContainer}>
                <Star size={20} color="#fbbf24" fill="#fbbf24" />
                <Text style={styles.ratingText}>{riderData.rating.toFixed(1)} Rating</Text>
              </View>
            )}

            <TouchableOpacity style={styles.editProfileButton} onPress={handleEdit}>
              <Edit size={18} color="#f97316" />
              <Text style={styles.editProfileButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {riderData && (
        <View  style={styles.section}>
          <Text style={styles.sectionTitle}>Vehicle Information</Text>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.iconContainer}>
                <Bike size={20} color="#f97316" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Vehicle Type</Text>
                <Text style={styles.infoValue}>{riderData.vehicle_type.toUpperCase()}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View style={styles.iconContainer}>
                <TrendingUp size={20} color="#f97316" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Total Deliveries</Text>
                <Text style={styles.infoValue}>{riderData.total_deliveries}</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      <View  style={styles.section}>
        <Text style={styles.sectionTitle}>Account Information</Text>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.iconContainer}>
              <Mail size={20} color="#f97316" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{profile?.email}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.iconContainer}>
              <Phone size={20} color="#f97316" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Phone</Text>
              {isEditing ? (
                <TextInput
                  style={styles.inputInline}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Enter your phone number"
                  editable={!loading}
                  keyboardType="phone-pad"
                />
              ) : (
                <Text style={styles.infoValue}>{profile?.phone || 'Not provided'}</Text>
              )}
            </View>
          </View>
        </View>
      </View>

      {isEditing && (
        <View style={styles.section}>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={handleCancel}
              disabled={loading}
            >
              <X size={20} color="#ef4444" />
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.saveButton]}
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Save size={20} color="#ffffff" />
                  <Text style={styles.saveButtonText}>Save</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View  style={styles.section}>
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <LogOut size={20} color="#ef4444" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    padding: 24,
    paddingTop: 60,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontFamily: Fonts.poppinsBold,
    color: '#111827',
    letterSpacing: 0.5,
  },
  editButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fed7aa',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  errorBanner: {
    backgroundColor: '#fee2e2',
    padding: 16,
    marginHorizontal: 24,
    marginTop: 16,
    borderRadius: 12,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    fontFamily: Fonts.poppinsSemiBold,
    textAlign: 'center',
  },
  successBanner: {
    backgroundColor: '#d1fae5',
    padding: 16,
    marginHorizontal: 24,
    marginTop: 16,
    borderRadius: 12,
  },
  successText: {
    color: '#f97316',
    fontSize: 14,
    fontFamily: Fonts.poppinsSemiBold,
    textAlign: 'center',
  },
  profileCard: {
    backgroundColor: '#ffffff',
    margin: 24,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#f97316',
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    fontSize: 24,
    fontFamily: Fonts.poppinsBold,
    color: '#111827',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  roleBadge: {
    backgroundColor: '#fed7aa',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 12,
  },
  roleText: {
    color: '#f97316',
    fontSize: 14,
    fontFamily: Fonts.poppinsBold,
    letterSpacing: 0.5,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 16,
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fed7aa',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f97316',
  },
  editProfileButtonText: {
    color: '#f97316',
    fontSize: 15,
    fontFamily: Fonts.poppinsBold,
  },
  ratingText: {
    fontSize: 16,
    fontFamily: Fonts.poppinsSemiBold,
    color: '#111827',
  },
  section: {
    marginHorizontal: 24,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: Fonts.poppinsBold,
    color: '#111827',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fed7aa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontFamily: Fonts.poppinsSemiBold,
    marginBottom: 4,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 16,
    color: '#111827',
    fontFamily: Fonts.poppinsMedium,
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    padding: 18,
    borderRadius: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  signOutText: {
    fontSize: 16,
    fontFamily: Fonts.poppinsBold,
    color: '#ef4444',
  },
  editSection: {
    width: '100%',
    marginTop: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: Fonts.poppinsSemiBold,
    color: '#6b7280',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontFamily: Fonts.poppinsRegular,
    color: '#111827',
  },
  inputInline: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontFamily: Fonts.poppinsRegular,
    color: '#111827',
    marginTop: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 16,
    gap: 8,
  },
  cancelButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  cancelButtonText: {
    fontSize: 16,
    fontFamily: Fonts.poppinsBold,
    color: '#ef4444',
  },
  saveButton: {
    backgroundColor: '#f97316',
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: Fonts.poppinsBold,
    color: '#ffffff',
  },
});

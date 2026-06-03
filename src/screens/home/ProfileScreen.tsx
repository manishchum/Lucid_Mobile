import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../contex/AuthContext';
import { getUserByPhone } from '../../api/users/Request';
import { User } from '../../api/users/Dto';

export default function ProfileScreen() {
  const { logout, phoneNumber } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        if (phoneNumber) {
          const response = await getUserByPhone(phoneNumber);
          if (response?.user) {
            setUser(response.user);
          }
        }
      } catch (error) {
        console.error('[ProfileScreen] Error fetching user:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchUserData();
  }, [phoneNumber]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getInitials = (name: string) => {
    return name ? name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) : '??';
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* PROFILE HEADER */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{getInitials(user?.name || '')}</Text>
          </View>
          <Text style={styles.userName}>{user?.name || 'User Name'}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{user?.position || 'Team Member'}</Text>
          </View>
        </View>

        {/* ACCOUNT DETAILS SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Details</Text>
          <View style={styles.infoCard}>
            <InfoRow icon="email-outline" label="Email Address" value={user?.email} />
            <Divider />
            <InfoRow icon="phone-outline" label="Phone Number" value={user?.phone} />
            <Divider />
            <InfoRow icon="office-building-outline" label="Company" value={user?.company_id?.toString()} />
          </View>
        </View>

        {/* EMPLOYMENT SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Employment</Text>
          <View style={styles.infoCard}>
            <InfoRow icon="briefcase-variant-outline" label="Current Position" value={user?.position} />
            <Divider />
            <InfoRow icon="calendar-check-outline" label="Member Since" value={formatDate(user?.hire_date || user?.created_at || '')} />
            <Divider />
            <InfoRow icon="shield-check-outline" label="Status" value={user?.employment_status || 'Active'} isStatus />
          </View>
        </View>

        {/* ADMIN NOTICE */}
        <View style={styles.adminNotice}>
          <MaterialCommunityIcons name="information-outline" size={20} color="#64748B" />
          <Text style={styles.adminNoticeText}>
            Profile details are managed by your administrator. Contact HR to update information.
          </Text>
        </View>

        {/* LOGOUT BUTTON */}
        <TouchableOpacity style={styles.logoutButton} onPress={() => logout()} activeOpacity={0.8}>
          <MaterialCommunityIcons name="logout" size={20} color="#EF4444" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

/** HELPER COMPONENTS **/
const InfoRow = ({ icon, label, value, isStatus }: any) => (
  <View style={styles.infoRow}>
    <View style={styles.infoIconWrapper}>
      <MaterialCommunityIcons name={icon} size={22} color="#64748B" />
    </View>
    <View style={styles.infoContent}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, isStatus && styles.statusText]}>
        {value || '—'}
      </Text>
    </View>
  </View>
);

const Divider = () => <View style={styles.divider} />;

/** STYLES **/
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  scrollContent: { paddingBottom: 40 },

  // Header
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  avatarCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#4F46E5',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#4F46E5',
  },
  userName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 8,
  },
  roleBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  roleBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
  },

  // Sections
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
    marginLeft: 4,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    elevation: 2,
    shadowColor: '#64748B',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },

  // Info Rows
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  infoIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  statusText: {
    color: '#10B981',
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 4,
  },

  // Admin Notice
  adminNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    marginHorizontal: 20,
    marginTop: 30,
    padding: 16,
    borderRadius: 16,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  adminNoticeText: {
    flex: 1,
    fontSize: 13,
    color: '#64748B',
    marginLeft: 10,
    lineHeight: 18,
  },

  // Logout
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginTop: 24,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#EF4444',
    marginLeft: 8,
  },
});
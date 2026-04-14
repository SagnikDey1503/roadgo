import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/auth-context';
import { UserGender } from '@/lib/api-client';
import { Fonts } from '@/constants/theme';

const genderOptions: UserGender[] = ['male', 'female', 'other'];

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, setSubscription, changeGender, authLoading } = useAuth();

  const onGenderChange = async (gender: UserGender) => {
    if (!user) {
      return;
    }
    if (!user.canChangeGender) {
      Alert.alert('Limit reached', 'Gender can only be changed once after signup.');
      return;
    }
    try {
      await changeGender(gender);
      Alert.alert('Updated', 'Gender updated successfully.');
    } catch (error) {
      Alert.alert('Failed', error instanceof Error ? error.message : 'Could not update gender');
    }
  };

  const onToggleSubscription = async () => {
    if (!user) {
      return;
    }
    try {
      await setSubscription(!user.hasSubscription);
      Alert.alert('Updated', `Subscription ${!user.hasSubscription ? 'enabled' : 'disabled'}.`);
    } catch (error) {
      Alert.alert('Failed', error instanceof Error ? error.message : 'Could not update subscription');
    }
  };

  const onLogout = async () => {
    await logout();
    router.replace('/login' as never);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <Text style={styles.name}>{user?.name || 'RoadGo User'}</Text>
          <Text style={styles.info}>Phone: {user?.phone || '-'}</Text>
          <Text style={styles.info}>Gender: {user?.gender?.toUpperCase() || '-'}</Text>
          <Text style={styles.info}>Plan: {user?.hasSubscription ? 'Subscriber' : 'Non Subscriber'}</Text>
          <Text style={styles.info}>In-app Credits: {user?.creditBalance ?? 0}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Subscription</Text>
          <Text style={styles.cardText}>- Free cancellation charges for subscribers</Text>
          <Text style={styles.cardText}>- Free rescheduling fee for subscribers</Text>
          <Text style={styles.cardText}>- Higher ride preference during high-demand hours</Text>
          <Text style={styles.cardText}>- Priority window-seat preference for subscribers</Text>
          <Text style={styles.cardText}>- Free window seats for subscribers</Text>
          <Text style={styles.cardText}>- Non-subscribers pay Rs 20 per window seat</Text>
          <Pressable style={styles.primaryButton} onPress={onToggleSubscription} disabled={authLoading}>
            <Text style={styles.primaryText}>
              {authLoading
                ? 'Updating...'
                : user?.hasSubscription
                  ? 'Disable Subscription'
                  : 'Enable Subscription'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Gender Preference</Text>
          <Text style={styles.cardText}>Gender is locked after signup due to privacy policy.</Text>
          <Text style={styles.cardText}>Current: {user?.gender?.toUpperCase() || '-'}</Text>
          <View style={styles.genderRow}>
            {genderOptions.map((option) => {
              const active = user?.gender === option;
              return (
                <Pressable
                  key={option}
                  style={[styles.genderChip, active && styles.genderChipActive]}
                  disabled={!user?.canChangeGender}
                  onPress={() => onGenderChange(option)}>
                  <Text style={[styles.genderChipText, active && styles.genderChipTextActive]}>
                    {option.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.cardText}>Changes disabled permanently for safety.</Text>
        </View>

        <Pressable style={styles.logoutButton} onPress={onLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F2F5F7',
  },
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  headerCard: {
    backgroundColor: '#0F2530',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  name: {
    color: '#F4B400',
    fontFamily: Fonts.rounded,
    fontSize: 25,
  },
  info: {
    color: '#D6E3E9',
    marginTop: 3,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E3EBF0',
    padding: 12,
    marginBottom: 10,
  },
  cardTitle: {
    color: '#1E3948',
    fontWeight: '800',
    marginBottom: 4,
  },
  cardText: {
    color: '#4E6674',
    marginBottom: 8,
    fontSize: 12,
  },
  primaryButton: {
    borderRadius: 9,
    backgroundColor: '#0F2530',
    paddingVertical: 10,
    alignItems: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  genderRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  genderChip: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CAD9E1',
    backgroundColor: '#F8FBFD',
  },
  genderChipActive: {
    borderColor: '#0F2530',
    backgroundColor: '#E4EEF4',
  },
  genderChipText: {
    color: '#445C69',
    fontSize: 12,
    fontWeight: '700',
  },
  genderChipTextActive: {
    color: '#0F2530',
  },
  logoutButton: {
    marginTop: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D4574B',
    paddingVertical: 12,
    alignItems: 'center',
  },
  logoutText: {
    color: '#B33A2F',
    fontWeight: '800',
  },
});

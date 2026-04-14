import { useState } from 'react';
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/auth-context';
import { UserGender } from '@/lib/api-client';

const genderOptions: UserGender[] = ['male', 'female', 'other'];

function getSignupErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return 'Unable to create account. Please try again.';
  }
  const message = error.message.toLowerCase();
  if (message.includes('already registered') || message.includes('already exists')) {
    return 'Account already exists for this phone number. Please login.';
  }
  if (message.includes('password must be at least')) {
    return 'Password must be at least 6 characters.';
  }
  if (message.includes('valid name')) {
    return 'Enter valid name, phone number and gender.';
  }
  return error.message;
}

export default function SignupScreen() {
  const router = useRouter();
  const { signup, authLoading } = useAuth();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<UserGender>('male');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const onSignup = async () => {
    if (!name.trim()) {
      Alert.alert('Missing name', 'Enter your full name.');
      return;
    }
    if (phone.replace(/\D/g, '').length !== 10) {
      Alert.alert('Invalid phone', 'Enter a valid 10-digit phone number.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Mismatch', 'Password and confirm password do not match.');
      return;
    }
    try {
      await signup({ name, phone, gender, password });
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Signup failed', getSignupErrorMessage(error));
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>RoadGo Signup</Text>
        <Text style={styles.subtitle}>Create account using phone number and password.</Text>

        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Full name"
          placeholderTextColor="#6F7E88"
        />
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="Phone number"
          placeholderTextColor="#6F7E88"
          keyboardType="number-pad"
          maxLength={10}
        />
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Password (min 6 chars)"
          placeholderTextColor="#6F7E88"
          secureTextEntry
        />
        <TextInput
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Confirm password"
          placeholderTextColor="#6F7E88"
          secureTextEntry
        />

        <View style={styles.genderRow}>
          {genderOptions.map((option) => {
            const active = option === gender;
            return (
              <Pressable
                key={option}
                onPress={() => setGender(option)}
                style={[styles.genderButton, active && styles.genderButtonActive]}>
                <Text style={[styles.genderText, active && styles.genderTextActive]}>{option.toUpperCase()}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable style={styles.primaryButton} onPress={onSignup} disabled={authLoading}>
          <Text style={styles.primaryText}>{authLoading ? 'Creating account...' : 'Signup'}</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={() => router.push('/login' as never)}>
          <Text style={styles.secondaryText}>Go to Login</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F2530',
  },
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    color: '#F4B400',
    fontSize: 32,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 6,
    color: '#CEDCE3',
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    color: '#122733',
  },
  genderRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  genderButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#3A5563',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#173542',
  },
  genderButtonActive: {
    borderColor: '#F4B400',
    backgroundColor: '#264B5B',
  },
  genderText: {
    color: '#B8C8D0',
    fontWeight: '700',
    fontSize: 12,
  },
  genderTextActive: {
    color: '#F4B400',
  },
  primaryButton: {
    backgroundColor: '#F4B400',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryText: {
    color: '#122733',
    fontWeight: '800',
  },
  secondaryButton: {
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D6E1E8',
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryText: {
    color: '#E9F0F4',
    fontWeight: '700',
  },
});

import { useState } from 'react';
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/auth-context';

function getLoginErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return 'Unable to login. Please try again.';
  }
  const message = error.message.toLowerCase();
  if (message.includes('user not found') || message.includes('no account exists')) {
    return 'No account exists for this phone number. Please signup first.';
  }
  if (message.includes('incorrect password')) {
    return 'Incorrect password. Please try again.';
  }
  if (message.includes('valid phone')) {
    return 'Phone number must be 10 digits.';
  }
  return error.message;
}

export default function LoginScreen() {
  const router = useRouter();
  const { login, authLoading } = useAuth();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const onLogin = async () => {
    if (phone.replace(/\D/g, '').length !== 10) {
      Alert.alert('Invalid phone', 'Enter a valid 10-digit phone number.');
      return;
    }
    if (!password) {
      Alert.alert('Missing password', 'Enter your password.');
      return;
    }
    try {
      await login(phone, password);
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Login failed', getLoginErrorMessage(error));
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>RoadGo Login</Text>
        <Text style={styles.subtitle}>Login using phone number and password.</Text>

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
          placeholder="Password"
          placeholderTextColor="#6F7E88"
          secureTextEntry
        />

        <Pressable style={styles.primaryButton} onPress={onLogin} disabled={authLoading}>
          <Text style={styles.primaryText}>{authLoading ? 'Signing in...' : 'Login'}</Text>
        </Pressable>

        <Pressable style={styles.linkButton} onPress={() => router.push('/signup' as never)}>
          <Text style={styles.linkText}>New user? Signup</Text>
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
  linkButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  linkText: {
    color: '#EAF2F5',
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
});

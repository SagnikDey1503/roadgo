import { Platform } from 'react-native';

const fallbackBaseUrl = Platform.select({
  android: 'http://10.0.2.2:4000',
  default: 'http://localhost:4000',
});

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || fallbackBaseUrl || 'http://localhost:4000';

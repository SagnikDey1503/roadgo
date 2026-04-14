import { Redirect } from 'expo-router';

import { useAuth } from '@/context/auth-context';

export default function IndexScreen() {
  const { user, authLoading } = useAuth();

  if (authLoading) {
    return null;
  }

  if (user) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href={'/login' as never} />;
}

import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/context/auth-context';
import { BookingRecord, CancellationPolicy, cancelBooking, fetchBookings, fetchCancellationPolicy } from '@/lib/api-client';
import { Fonts } from '@/constants/theme';

export default function CancellationScreen() {
  const { token, user, refreshProfile } = useAuth();

  const [policy, setPolicy] = useState<CancellationPolicy | null>(null);
  const [upcoming, setUpcoming] = useState<BookingRecord[]>([]);

  const loadData = useCallback(async () => {
    if (!token) {
      return;
    }
    try {
      const [policyResponse, bookingResponse] = await Promise.all([
        fetchCancellationPolicy(token),
        fetchBookings(token, 'upcoming'),
      ]);
      setPolicy(policyResponse.policy);
      setUpcoming(bookingResponse.bookings.filter((booking) => booking.status === 'CONFIRMED'));
    } catch (error) {
      Alert.alert('Load failed', error instanceof Error ? error.message : 'Could not load cancellation data');
    }
  }, [token]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const onCancel = async (bookingId: string) => {
    if (!token) {
      return;
    }
    try {
      const response = await cancelBooking(token, bookingId);
      Alert.alert(
        'Cancellation processed',
        `Paid: Rs ${response.amountPaid}\nCancellation fee: Rs ${response.cancellationCharge}\nRefund: Rs ${response.refundAmount}\nCredits left: ${response.creditBalance}`
      );
      await refreshProfile();
      await loadData();
    } catch (error) {
      Alert.alert('Cancellation failed', error instanceof Error ? error.message : 'Could not cancel');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Cancellation</Text>
        <Text style={styles.subtitle}>Cancellation policy and charges based on your current plan.</Text>

        <View style={styles.policyCard}>
          <Text style={styles.policyHeading}>Your current plan</Text>
          <Text style={styles.planValue}>{user?.hasSubscription ? 'RoadGo Subscriber' : 'Non Subscriber'}</Text>
          <Text style={styles.planValue}>In-app credits: {user?.creditBalance ?? 0}</Text>
        </View>

        {policy ? (
          <>
            <View style={styles.policyCard}>
              <Text style={styles.policyHeading}>Subscriber Policy</Text>
              <Text style={styles.policyText}>{policy.subscriber.summary}</Text>
              <Text style={styles.policyText}>Late fee: Rs {policy.subscriber.lateFee}</Text>
            </View>

            <View style={styles.policyCard}>
              <Text style={styles.policyHeading}>Non Subscriber Policy</Text>
              <Text style={styles.policyText}>{policy.nonSubscriber.summary}</Text>
              <Text style={styles.policyText}>Standard fee: Rs {policy.nonSubscriber.standardFee}</Text>
              <Text style={styles.policyText}>Late fee: Rs {policy.nonSubscriber.lateFee}</Text>
            </View>

            <Text style={styles.note}>{policy.note}</Text>
            <Text style={styles.note}>Refund formula: Total paid - cancellation fee (59/99/0).</Text>
          </>
        ) : null}

        <Text style={styles.sectionTitle}>Cancelable Upcoming Trips</Text>

        {upcoming.length === 0 ? <Text style={styles.empty}>No upcoming confirmed bookings.</Text> : null}

        {upcoming.map((booking) => (
          <View key={booking.bookingId} style={styles.bookingCard}>
            <Text style={styles.bookingId}>{booking.bookingId}</Text>
            <Text style={styles.bookingText}>
              {booking.pickupName} to {booking.dropName}
            </Text>
            <Text style={styles.bookingText}>
              {booking.travelDate} {booking.travelTime}
            </Text>
            <Pressable style={styles.cancelButton} onPress={() => onCancel(booking.bookingId)}>
              <Text style={styles.cancelText}>Cancel Booking</Text>
            </Pressable>
          </View>
        ))}
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
  title: {
    fontSize: 30,
    color: '#0F2530',
    fontFamily: Fonts.rounded,
  },
  subtitle: {
    marginTop: 4,
    color: '#607380',
    marginBottom: 12,
  },
  policyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E3EBF0',
    padding: 12,
    marginBottom: 10,
  },
  policyHeading: {
    color: '#1E3948',
    fontWeight: '800',
    marginBottom: 4,
  },
  planValue: {
    color: '#0E607D',
    fontWeight: '700',
  },
  policyText: {
    color: '#4E6674',
    marginBottom: 3,
  },
  note: {
    color: '#6A7F8C',
    marginBottom: 12,
  },
  sectionTitle: {
    marginTop: 6,
    marginBottom: 8,
    color: '#324651',
    fontWeight: '700',
  },
  empty: {
    color: '#5A7380',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3EBF0',
    borderRadius: 12,
    padding: 12,
  },
  bookingCard: {
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3EBF0',
    borderRadius: 12,
    padding: 12,
  },
  bookingId: {
    color: '#1F3A49',
    fontWeight: '700',
    marginBottom: 4,
  },
  bookingText: {
    color: '#5A7380',
    marginBottom: 2,
  },
  cancelButton: {
    marginTop: 9,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#D4574B',
    paddingVertical: 9,
    alignItems: 'center',
  },
  cancelText: {
    color: '#B33A2F',
    fontWeight: '700',
  },
});

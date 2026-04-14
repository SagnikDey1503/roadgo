import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/context/auth-context';
import { BookingRecord, cancelBooking, fetchBookings } from '@/lib/api-client';
import { Fonts } from '@/constants/theme';

export default function TripsScreen() {
  const { token, refreshProfile } = useAuth();

  const [segment, setSegment] = useState<'upcoming' | 'history'>('upcoming');
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const loadBookings = useCallback(async (activeSegment: 'upcoming' | 'history') => {
    if (!token) {
      return;
    }
    setLoading(true);
    try {
      const response = await fetchBookings(token, activeSegment);
      setBookings(response.bookings);
    } catch (error) {
      Alert.alert('Load failed', error instanceof Error ? error.message : 'Could not fetch trips');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadBookings(segment);
  }, [loadBookings, segment]);

  const onCancel = async (bookingId: string) => {
    if (!token) {
      return;
    }
    try {
      const response = await cancelBooking(token, bookingId);
      Alert.alert(
        'Cancelled',
        `Paid: Rs ${response.amountPaid}\nCancellation fee: Rs ${response.cancellationCharge}\nRefund: Rs ${response.refundAmount}\nCredits left: ${response.creditBalance}`
      );
      await refreshProfile();
      await loadBookings(segment);
    } catch (error) {
      Alert.alert('Cancellation failed', error instanceof Error ? error.message : 'Could not cancel booking');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Trips</Text>
        <Text style={styles.subtitle}>Upcoming and completed travel history.</Text>

        <View style={styles.segmentWrap}>
          {(['upcoming', 'history'] as const).map((option) => {
            const active = segment === option;
            return (
              <Pressable
                key={option}
                style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                onPress={() => setSegment(option)}>
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{option.toUpperCase()}</Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? <Text style={styles.loadingText}>Loading trips...</Text> : null}

        {!loading && bookings.length === 0 ? <Text style={styles.emptyText}>No {segment} trips yet.</Text> : null}

        {bookings.map((booking) => (
          <View key={booking.bookingId} style={styles.tripCard}>
            <View style={styles.tripTop}>
              <Text style={styles.bookingId}>{booking.bookingId}</Text>
              <Text style={styles.status}>{booking.status}</Text>
            </View>
            <Text style={styles.route}>
              {booking.pickupName} to {booking.dropName}
            </Text>
            <Text style={styles.meta}>
              {booking.travelDate} at {booking.travelTime}
            </Text>
            <Text style={styles.meta}>Car: {booking.carType.toUpperCase()}</Text>
            {booking.selectedSeatId ? <Text style={styles.meta}>Seat: {booking.selectedSeatId}</Text> : null}
            <Text style={styles.amount}>Paid: Rs {booking.amountPaid}</Text>

            {segment === 'upcoming' && booking.status === 'CONFIRMED' ? (
              <Pressable style={styles.cancelButton} onPress={() => onCancel(booking.bookingId)}>
                <Text style={styles.cancelText}>Cancel Booking</Text>
              </Pressable>
            ) : null}
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
    marginBottom: 14,
  },
  segmentWrap: {
    flexDirection: 'row',
    backgroundColor: '#DEE8EE',
    borderRadius: 10,
    padding: 4,
    marginBottom: 14,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: '#0F2530',
  },
  segmentText: {
    color: '#375260',
    fontWeight: '700',
    fontSize: 12,
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  loadingText: {
    color: '#4E6774',
  },
  emptyText: {
    color: '#5A7380',
    backgroundColor: '#FFFFFF',
    borderColor: '#E3EBF0',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  tripCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E3EBF0',
    padding: 12,
    marginBottom: 10,
  },
  tripTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  bookingId: {
    color: '#284352',
    fontWeight: '700',
    fontSize: 12,
  },
  status: {
    color: '#145A43',
    fontWeight: '700',
    fontSize: 11,
  },
  route: {
    color: '#0F2530',
    fontWeight: '700',
    marginBottom: 4,
  },
  meta: {
    color: '#5F7683',
    fontSize: 12,
    marginBottom: 2,
  },
  amount: {
    color: '#173645',
    fontWeight: '700',
    marginTop: 4,
  },
  cancelButton: {
    marginTop: 10,
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

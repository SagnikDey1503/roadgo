import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { QrCodeGrid } from '@/components/qr-code-grid';
import { useAuth } from '@/context/auth-context';
import {
  BookingRecord,
  LocationSuggestion,
  RideSeat,
  RideOption,
  SharingCarType,
  SoloCarType,
  TravelMode,
  confirmDummyPayment,
  searchRides,
  suggestLocations,
} from '@/lib/api-client';
import { Fonts } from '@/constants/theme';

const sharingTypes: SharingCarType[] = ['4-seater', '6-seater', 'auto'];
const soloTypes: SoloCarType[] = ['auto', 'mini', 'sedan', 'suv'];
const clockMinuteOptions = [0, 15, 30, 45] as const;
const weekDayLabels = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

function defaultDate() {
  return formatDateValue(new Date());
}

function formatDateValue(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function defaultTime() {
  const date = new Date(Date.now() + 45 * 60 * 1000);
  const rounded = Math.round(date.getMinutes() / 15) * 15;
  if (rounded === 60) {
    date.setHours(date.getHours() + 1);
    date.setMinutes(0, 0, 0);
  } else {
    date.setMinutes(rounded, 0, 0);
  }
  return formatTimeValue(date);
}

function formatTimeValue(date: Date) {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function startOfDay(input: Date) {
  const date = new Date(input);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(input: Date, days: number) {
  const date = new Date(input);
  date.setDate(date.getDate() + days);
  return date;
}

function monthStart(input: Date) {
  return new Date(input.getFullYear(), input.getMonth(), 1);
}

function parseDateValue(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? startOfDay(new Date()) : startOfDay(parsed);
}

function monthTitle(input: Date) {
  return input.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function buildCalendarCells(viewMonth: Date) {
  const start = monthStart(viewMonth);
  const gridStart = addDays(start, -start.getDay());
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

function nearestClockMinute(minute: number) {
  return clockMinuteOptions.reduce((best, value) => {
    if (Math.abs(value - minute) < Math.abs(best - minute)) {
      return value;
    }
    return best;
  }, 0 as (typeof clockMinuteOptions)[number]);
}

function toClockParts(timeValue: string) {
  const [hourRaw, minuteRaw] = timeValue.split(':');
  const hour24 = Number(hourRaw);
  const minute = Number(minuteRaw);
  const safeHour = Number.isFinite(hour24) ? Math.max(0, Math.min(23, hour24)) : 0;
  const safeMinute = Number.isFinite(minute) ? Math.max(0, Math.min(59, minute)) : 0;
  const period: 'AM' | 'PM' = safeHour >= 12 ? 'PM' : 'AM';
  const hour12 = safeHour % 12 === 0 ? 12 : safeHour % 12;
  return {
    hour12,
    minute: nearestClockMinute(safeMinute),
    period,
  };
}

function to24Hour(hour12: number, period: 'AM' | 'PM') {
  if (period === 'AM') {
    return hour12 === 12 ? 0 : hour12;
  }
  return hour12 === 12 ? 12 : hour12 + 12;
}

function readableDate(dateValue: string) {
  const parsed = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return dateValue;
  }
  return parsed.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
}

function sortRidesByPreference(rides: RideOption[], mode: TravelMode, sharingGender: string) {
  if (mode !== 'sharing') {
    return rides;
  }

  const ranked = [...rides];
  if (sharingGender === 'female') {
    ranked.sort((a, b) => {
      const femaleDelta = (b.femaleOnboard ?? 0) - (a.femaleOnboard ?? 0);
      if (femaleDelta !== 0) {
        return femaleDelta;
      }
      const maleDelta = (a.maleOnboard ?? 0) - (b.maleOnboard ?? 0);
      if (maleDelta !== 0) {
        return maleDelta;
      }
      return a.departureTime.localeCompare(b.departureTime);
    });
    return ranked;
  }

  if (sharingGender === 'male') {
    ranked.sort((a, b) => {
      const maleDelta = (b.maleOnboard ?? 0) - (a.maleOnboard ?? 0);
      if (maleDelta !== 0) {
        return maleDelta;
      }
      const femaleDelta = (a.femaleOnboard ?? 0) - (b.femaleOnboard ?? 0);
      if (femaleDelta !== 0) {
        return femaleDelta;
      }
      return a.departureTime.localeCompare(b.departureTime);
    });
    return ranked;
  }

  ranked.sort((a, b) => {
    const aBalance = Math.abs((a.maleOnboard ?? 0) - (a.femaleOnboard ?? 0));
    const bBalance = Math.abs((b.maleOnboard ?? 0) - (b.femaleOnboard ?? 0));
    if (aBalance !== bBalance) {
      return aBalance - bBalance;
    }
    if (a.seatsAvailable !== b.seatsAvailable) {
      return b.seatsAvailable - a.seatsAvailable;
    }
    return a.departureTime.localeCompare(b.departureTime);
  });
  return ranked;
}

function seatRowsForCar(carType: string, seatMap: RideSeat[]) {
  const byId = Object.fromEntries(seatMap.map((seat) => [seat.seatId, seat]));
  if (carType === '4-seater') {
    return [
      [byId.F1 || null, null, null],
      [byId.B1 || null, byId.B2 || null, byId.B3 || null],
    ];
  }
  if (carType === '6-seater') {
    return [
      [byId.F1 || null, null, null],
      [byId.M1 || null, byId.M2 || null, byId.M3 || null],
      [byId.B1 || null, byId.B2 || null, null],
    ];
  }
  return [
    [byId.F1 || null, null, null],
    [byId.R1 || null, byId.R2 || null, null],
  ];
}

export default function BookScreen() {
  const router = useRouter();
  const { user, token } = useAuth();

  const [pickupQuery, setPickupQuery] = useState('');
  const [dropQuery, setDropQuery] = useState('');
  const [pickupOptions, setPickupOptions] = useState<LocationSuggestion[]>([]);
  const [dropOptions, setDropOptions] = useState<LocationSuggestion[]>([]);
  const [pickup, setPickup] = useState<LocationSuggestion | null>(null);
  const [drop, setDrop] = useState<LocationSuggestion | null>(null);
  const [travelDate, setTravelDate] = useState(defaultDate());
  const [travelTime, setTravelTime] = useState(defaultTime());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => monthStart(new Date()));
  const initialClock = useMemo(() => toClockParts(defaultTime()), []);
  const [clockHour, setClockHour] = useState(initialClock.hour12);
  const [clockMinute, setClockMinute] = useState<(typeof clockMinuteOptions)[number]>(initialClock.minute);
  const [clockPeriod, setClockPeriod] = useState<'AM' | 'PM'>(initialClock.period);
  const [mode, setMode] = useState<TravelMode>('sharing');
  const [sharingCarType, setSharingCarType] = useState<SharingCarType>('4-seater');
  const [soloCarType, setSoloCarType] = useState<SoloCarType>('mini');
  const [rides, setRides] = useState<RideOption[]>([]);
  const [selectedRide, setSelectedRide] = useState<RideOption | null>(null);
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<BookingRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [routeSource, setRouteSource] = useState('fallback-haversine');
  const today = useMemo(() => startOfDay(new Date()), []);
  const maxTravelDay = useMemo(() => addDays(today, 20), [today]);

  const sharingGender = user?.gender || 'other';

  useEffect(() => {
    if (showDatePicker) {
      setCalendarMonth(monthStart(parseDateValue(travelDate)));
    }
  }, [showDatePicker, travelDate]);

  useEffect(() => {
    if (!showTimePicker) {
      return;
    }
    const parsed = toClockParts(travelTime);
    setClockHour(parsed.hour12);
    setClockMinute(parsed.minute);
    setClockPeriod(parsed.period);
  }, [showTimePicker, travelTime]);

  useEffect(() => {
    const query = pickupQuery.trim();
    if (!query) {
      setPickupOptions([]);
      return;
    }
    if (pickup && query === pickup.name) {
      setPickupOptions([]);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const response = await suggestLocations(query);
        setPickupOptions(response.locations);
      } catch {
        setPickupOptions([]);
      }
    }, 250);
    return () => clearTimeout(timeout);
  }, [pickup, pickupQuery]);

  useEffect(() => {
    const query = dropQuery.trim();
    if (!query) {
      setDropOptions([]);
      return;
    }
    if (drop && query === drop.name) {
      setDropOptions([]);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const response = await suggestLocations(query);
        setDropOptions(response.locations);
      } catch {
        setDropOptions([]);
      }
    }, 250);
    return () => clearTimeout(timeout);
  }, [drop, dropQuery]);

  const selectedSeat = useMemo(() => {
    if (!selectedRide?.seatMap || !selectedSeatId) {
      return null;
    }
    return selectedRide.seatMap.find((seat) => seat.seatId === selectedSeatId) || null;
  }, [selectedRide, selectedSeatId]);
  const showSeatGender = user?.gender === 'female';

  const windowSeatCharge = selectedSeat?.isWindow && !user?.hasSubscription ? 20 : 0;

  const clearRideSelection = useCallback(() => {
    setSelectedRide(null);
    setSelectedSeatId(null);
  }, []);

  const calendarCells = useMemo(() => buildCalendarCells(calendarMonth), [calendarMonth]);
  const canGoPrevMonth = useMemo(() => {
    const previousMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1);
    return monthStart(previousMonth).getTime() >= monthStart(today).getTime();
  }, [calendarMonth, today]);
  const canGoNextMonth = useMemo(() => {
    const nextMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
    return monthStart(nextMonth).getTime() <= monthStart(maxTravelDay).getTime();
  }, [calendarMonth, maxTravelDay]);
  const clockPreview = useMemo(() => {
    const hour24 = to24Hour(clockHour, clockPeriod);
    return `${String(hour24).padStart(2, '0')}:${String(clockMinute).padStart(2, '0')}`;
  }, [clockHour, clockMinute, clockPeriod]);

  const applyClockSelection = useCallback(() => {
    setTravelTime(clockPreview);
    clearRideSelection();
    setShowTimePicker(false);
  }, [clearRideSelection, clockPreview]);

  const runSearch = useCallback(async (silent = false) => {
    if (!token) {
      return;
    }
    if (!pickup || !drop) {
      if (!silent) {
        Alert.alert('Missing route', 'Select both pickup and drop points.');
      }
      return;
    }

    const requestDate = new Date(`${travelDate}T${travelTime}:00`);
    const maxAllowed = new Date();
    maxAllowed.setDate(maxAllowed.getDate() + 20);
    if (Number.isNaN(requestDate.getTime()) || requestDate > maxAllowed) {
      if (!silent) {
        Alert.alert('Invalid time', 'Booking is allowed only for the next 20 days.');
      }
      return;
    }

    setLoading(true);
    try {
      const response = await searchRides(token, {
        pickupId: pickup.id,
        dropId: drop.id,
        travelDate,
        travelTime,
        mode,
        carType: mode === 'sharing' ? sharingCarType : soloCarType,
        sharingGender,
      });
      setRides(sortRidesByPreference(response.rides, mode, sharingGender));
      setRouteSource(response.constraints.routeSource || 'fallback-haversine');
      clearRideSelection();
      setReceipt(null);
    } catch (error) {
      if (!silent) {
        Alert.alert('Search failed', error instanceof Error ? error.message : 'Could not search rides.');
      }
    } finally {
      setLoading(false);
    }
  }, [clearRideSelection, drop, mode, pickup, sharingCarType, sharingGender, soloCarType, token, travelDate, travelTime]);

  const onSearch = async () => {
    await runSearch(false);
  };

  useEffect(() => {
    if (!pickup || !drop) {
      return;
    }
    const timeout = setTimeout(() => {
      void runSearch(true);
    }, 180);
    return () => clearTimeout(timeout);
  }, [drop, mode, pickup, runSearch, sharingCarType, sharingGender, soloCarType, travelDate, travelTime]);

  const onPay = async () => {
    if (!token || !pickup || !drop || !selectedRide) {
      return;
    }
    if (selectedRide.mode === 'sharing' && !selectedSeatId) {
      Alert.alert('Seat required', 'Select a seat for shared booking.');
      return;
    }

    setLoading(true);
    try {
      const response = await confirmDummyPayment(token, {
        pickupId: pickup.id,
        dropId: drop.id,
        travelDate,
        travelTime,
        mode: selectedRide.mode,
        carType: selectedRide.carType,
        selectedSeatId,
        rideId: selectedRide.rideId,
        quotedFare: selectedRide.baseFare,
      });
      setReceipt(response.booking);
      Alert.alert('Payment confirmed', 'Payment was successful.');
    } catch (error) {
      Alert.alert('Payment failed', error instanceof Error ? error.message : 'Could not confirm payment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.brand}>ROADGO</Text>
          <Text style={styles.tagline}>Your Journey. Our Guarantee.</Text>
          <Text style={styles.heroHint}>Plan your ride with live routing, availability, and pricing.</Text>
        </View>

        <View style={styles.searchCard}>
          <Text style={styles.cardTitle}>Plan Route</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={pickupQuery}
              onChangeText={(value) => {
                setPickupQuery(value);
                if (!pickup || value.trim() !== pickup.name) {
                  setPickup(null);
                  clearRideSelection();
                }
              }}
              placeholder="Pickup point (API powered)"
              placeholderTextColor="#738A96"
            />
            {pickupOptions.slice(0, 4).map((option) => (
              <Pressable
                key={option.id}
                onPressIn={() => {
                  setPickup(option);
                  setPickupQuery(option.name);
                  setPickupOptions([]);
                  clearRideSelection();
                }}
                style={styles.suggestion}>
                <Text style={styles.suggestionText}>{option.name}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={dropQuery}
              onChangeText={(value) => {
                setDropQuery(value);
                if (!drop || value.trim() !== drop.name) {
                  setDrop(null);
                  clearRideSelection();
                }
              }}
              placeholder="Drop point (API powered)"
              placeholderTextColor="#738A96"
            />
            {dropOptions.slice(0, 4).map((option) => (
              <Pressable
                key={option.id}
                onPressIn={() => {
                  setDrop(option);
                  setDropQuery(option.name);
                  setDropOptions([]);
                  clearRideSelection();
                }}
                style={styles.suggestion}>
                <Text style={styles.suggestionText}>{option.name}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.metaRow}>
            <Pressable style={styles.metaInputGroup} onPress={() => setShowDatePicker(true)}>
              <Ionicons name="calendar-outline" size={14} color="#0F2530" />
              <Text style={styles.metaValue}>{readableDate(travelDate)}</Text>
            </Pressable>
            <Pressable style={styles.metaInputGroup} onPress={() => setShowTimePicker(true)}>
              <Ionicons name="time-outline" size={14} color="#0F2530" />
              <Text style={styles.metaValue}>{travelTime}</Text>
            </Pressable>
            <View style={[styles.metaPill, styles.guaranteedPill]}>
              <Ionicons name="shield-checkmark" size={14} color="#124D3A" />
              <Text style={styles.guaranteedText}>Live Pricing</Text>
            </View>
          </View>
        </View>

        <View style={styles.modeSection}>
          <Text style={styles.modeTitle}>Travel Mode</Text>
          <View style={styles.modeToggle}>
            {(['sharing', 'solo'] as TravelMode[]).map((modeOption) => {
              const active = modeOption === mode;
              return (
                <Pressable
                  key={modeOption}
                  style={[styles.modeButton, active && styles.modeButtonActive]}
                  onPress={() => {
                    setMode(modeOption);
                    clearRideSelection();
                  }}>
                  <Text style={[styles.modeButtonText, active && styles.modeButtonTextActive]}>
                    {modeOption === 'sharing' ? 'Sharing' : 'Solo'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {mode === 'sharing' ? (
          <View style={styles.extraPanel}>
            <Text style={styles.extraTitle}>Sharing Vehicle Type</Text>
            <View style={styles.chipsRow}>
              {sharingTypes.map((type) => (
                <Pressable
                  key={type}
                  style={[styles.chip, sharingCarType === type && styles.chipActive]}
                  onPress={() => {
                    setSharingCarType(type);
                    clearRideSelection();
                  }}>
                  <Text style={[styles.chipText, sharingCarType === type && styles.chipTextActive]}>{type}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.hintText}>Cars shown are filtered within 3km radius of pickup.</Text>
            <Text style={styles.hintText}>Gender preference is auto-applied from your profile.</Text>
          </View>
        ) : (
          <View style={styles.extraPanel}>
            <Text style={styles.extraTitle}>Solo Vehicle Type</Text>
            <View style={styles.chipsRow}>
              {soloTypes.map((type) => (
                <Pressable
                  key={type}
                  style={[styles.chip, soloCarType === type && styles.chipActive]}
                  onPress={() => {
                    setSoloCarType(type);
                    clearRideSelection();
                  }}>
                  <Text style={[styles.chipText, soloCarType === type && styles.chipTextActive]}>
                    {type.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <Pressable style={styles.searchButton} onPress={onSearch} disabled={loading}>
          <Text style={styles.searchButtonText}>{loading ? 'Searching...' : 'Search Rides'}</Text>
        </Pressable>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>Available Rides</Text>
          <Text style={styles.sectionCount}>
            {loading
              ? 'Refreshing...'
              : `${rides.length} options • ${routeSource === 'google-directions' ? 'Google traffic' : 'Fallback routing'}`}
          </Text>
        </View>
        {!loading && rides.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="car-sport-outline" size={20} color="#4F6977" />
            <Text style={styles.emptyTitle}>No rides right now</Text>
            <Text style={styles.emptyHint}>Try another time, car type, or location to refresh options.</Text>
          </View>
        ) : null}
        {rides.map((option) => {
          const active = selectedRide?.rideId === option.rideId;
          return (
            <Pressable
              key={option.rideId}
              style={[styles.rideCard, active && styles.rideCardActive]}
              onPress={() => {
                setSelectedRide(option);
                setSelectedSeatId(null);
              }}>
              <View style={styles.rideTop}>
                <View style={styles.rideTopLeft}>
                  <Text style={styles.rideProvider}>{option.provider}</Text>
                  <View style={styles.rideMetaRow}>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{option.carType}</Text>
                    </View>
                    <Text style={styles.rideRoute}>
                      {option.mode === 'sharing'
                        ? `${option.seatsAvailable} of ${option.seatsTotal} seats left`
                        : 'Private ride'}
                    </Text>
                  </View>
                </View>
                {active ? <Ionicons name="checkmark-circle" size={22} color="#11804B" /> : null}
              </View>
              <View style={styles.rideInfoRow}>
                <Text style={styles.rideTime}>Departure {option.departureTime}</Text>
                <Text style={styles.rideEta}>Reach in {option.totalTravelMinutes ?? option.etaMinutes} min</Text>
              </View>
              <Text style={styles.rideRoute}>Includes pickup + trip time</Text>
              {option.driverName ? (
                <View style={styles.rideInfoRow}>
                  <Text style={styles.rideRoute}>Driver: {option.driverName}</Text>
                  <Text style={styles.rideRoute}>Rating: {option.driverRating ?? '-'}</Text>
                </View>
              ) : null}
              {option.vehicleNumber ? (
                <View style={styles.rideInfoRow}>
                  <Text style={styles.rideRoute}>Vehicle: {option.vehicleNumber}</Text>
                  <Text style={styles.rideRoute}>{option.vehicleColor || 'Color N/A'}</Text>
                </View>
              ) : null}
              <View style={styles.rideInfoRow}>
                <Text style={styles.rideRoute}>Within {option.distanceFromPickupKm} km</Text>
                <Text style={styles.rideRoute}>{option.pricingTag || 'Standard fare'}</Text>
              </View>
              {option.mode === 'sharing' ? (
                <Text style={styles.rideRoute}>
                  Onboard: M {option.maleOnboard ?? 0} | F {option.femaleOnboard ?? 0}
                </Text>
              ) : null}
              {option.mode === 'sharing' && typeof option.poolingMatchPercent === 'number' ? (
                <Text style={styles.rideRoute}>Pooling match chance: {option.poolingMatchPercent}%</Text>
              ) : null}
              {option.estimatedDropTime ? (
                <Text style={styles.rideRoute}>Estimated drop: {option.estimatedDropTime}</Text>
              ) : null}
              <View style={styles.rideBottom}>
                <Text style={styles.fare}>Rs {option.baseFare}</Text>
                <Text style={styles.seats}>{active ? 'Selected' : 'Tap to select'}</Text>
              </View>
            </Pressable>
          );
        })}

        {selectedRide?.mode === 'sharing' && selectedRide.seatMap ? (
          <View style={styles.seatPanel}>
            <Text style={styles.extraTitle}>Select Seat</Text>
            <View style={styles.carShell}>
              <View style={styles.carWheelLeft} />
              <View style={styles.carWheelRight} />
              <View style={styles.carBody}>
                <View style={styles.carRoofBar} />
                <View style={styles.carDash}>
                  <Ionicons name="navigate-circle-outline" size={16} color="#BCD0DB" />
                  <Text style={styles.carDashText}>Front / Driver Side</Text>
                </View>
                <View style={styles.seatDeck}>
                  {seatRowsForCar(selectedRide.carType, selectedRide.seatMap).map((row, rowIndex) => (
                    <View key={`row-${rowIndex}`} style={styles.carRow}>
                      {row.map((seat, seatIndex) => {
                        if (!seat) {
                          return <View key={`aisle-${rowIndex}-${seatIndex}`} style={styles.carAisle} />;
                        }
                        const active = selectedSeatId === seat.seatId;
                        const disabled = seat.occupied;
                        return (
                          <Pressable
                            key={seat.seatId}
                            style={[
                              styles.seatItem,
                              disabled && styles.seatOccupied,
                              active && styles.seatSelected,
                              seat.isWindow && styles.seatWindow,
                            ]}
                            disabled={disabled}
                            onPress={() => setSelectedSeatId(seat.seatId)}>
                            <Text style={[styles.seatLabel, disabled && styles.seatLabelDisabled]}>{seat.label}</Text>
                            {seat.occupied && seat.occupantGender ? (
                              <Text style={styles.occupantText}>
                                {showSeatGender ? (seat.occupantGender === 'male' ? 'M' : 'F') : 'BOOKED'}
                              </Text>
                            ) : (
                              <Text style={styles.freeText}>FREE</Text>
                            )}
                          </Pressable>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </View>
            </View>
            <Text style={styles.hintText}>
              Window seat charge: {user?.hasSubscription ? 'Rs 0 (subscription active)' : 'Rs 20 per ride'}
            </Text>
          </View>
        ) : null}

        {selectedRide ? (
          <View style={styles.checkoutCard}>
            <Text style={styles.checkoutTitle}>Payment Summary</Text>
            <Text style={styles.checkoutLine}>
              {selectedRide.mode.toUpperCase()} with {selectedRide.provider}
            </Text>
            <Text style={styles.checkoutLine}>
              Base fare Rs {selectedRide.baseFare} {windowSeatCharge ? `+ Window Rs ${windowSeatCharge}` : ''}
            </Text>
            <Text style={styles.checkoutLine}>Total payable: Rs {selectedRide.baseFare + windowSeatCharge}</Text>
            <Pressable style={styles.ctaButton} onPress={onPay} disabled={loading}>
              <Text style={styles.ctaText}>{loading ? 'Processing...' : 'Proceed to Payment'}</Text>
            </Pressable>
          </View>
        ) : null}

        {receipt ? (
          <View style={styles.receiptCard}>
            <Text style={styles.receiptTitle}>Travel Receipt</Text>
            <Text style={styles.receiptLine}>Booking: {receipt.bookingId}</Text>
            <Text style={styles.receiptLine}>
              {receipt.pickupName} to {receipt.dropName}
            </Text>
            <Text style={styles.receiptLine}>
              {receipt.travelDate} at {receipt.travelTime}
            </Text>
            <Text style={styles.receiptLine}>Amount paid: Rs {receipt.amountPaid}</Text>
            <Text style={styles.receiptLine}>Receipt code: {receipt.receiptCode}</Text>
            <View style={styles.qrWrap}>
              <QrCodeGrid value={receipt.qrCodeText} />
            </View>
            <Pressable style={styles.upcomingButton} onPress={() => router.push('/(tabs)/tickets' as never)}>
              <Text style={styles.upcomingButtonText}>Open Upcoming Trips</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      <Modal visible={showDatePicker} transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
        <Pressable style={styles.pickerOverlay} onPress={() => setShowDatePicker(false)}>
          <Pressable style={styles.pickerSheet} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.pickerTitle}>Select Travel Date</Text>
            <View style={styles.calendarHeader}>
              <Pressable
                disabled={!canGoPrevMonth}
                style={[styles.monthNavButton, !canGoPrevMonth && styles.monthNavButtonDisabled]}
                onPress={() => {
                  setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1));
                }}>
                <Ionicons name="chevron-back" size={16} color={canGoPrevMonth ? '#103647' : '#8AA0AD'} />
              </Pressable>
              <Text style={styles.calendarTitle}>{monthTitle(calendarMonth)}</Text>
              <Pressable
                disabled={!canGoNextMonth}
                style={[styles.monthNavButton, !canGoNextMonth && styles.monthNavButtonDisabled]}
                onPress={() => {
                  setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1));
                }}>
                <Ionicons name="chevron-forward" size={16} color={canGoNextMonth ? '#103647' : '#8AA0AD'} />
              </Pressable>
            </View>

            <View style={styles.calendarGrid}>
              {weekDayLabels.map((label) => (
                <Text key={label} style={styles.weekLabel}>
                  {label}
                </Text>
              ))}
              {calendarCells.map((dateCell) => {
                const outOfMonth = dateCell.getMonth() !== calendarMonth.getMonth();
                const disabled =
                  outOfMonth || dateCell.getTime() < today.getTime() || dateCell.getTime() > maxTravelDay.getTime();
                const active = formatDateValue(dateCell) === travelDate;
                return (
                  <Pressable
                    key={dateCell.toISOString()}
                    disabled={disabled}
                    style={[
                      styles.calendarCell,
                      outOfMonth && styles.calendarCellOut,
                      disabled && styles.calendarCellDisabled,
                      active && styles.calendarCellActive,
                    ]}
                    onPress={() => {
                      setTravelDate(formatDateValue(dateCell));
                      clearRideSelection();
                      setShowDatePicker(false);
                    }}>
                    <Text
                      style={[
                        styles.calendarCellText,
                        outOfMonth && styles.calendarCellTextOut,
                        disabled && styles.calendarCellTextDisabled,
                        active && styles.calendarCellTextActive,
                      ]}>
                      {dateCell.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.calendarHint}>Booking allowed for the next 20 days.</Text>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showTimePicker} transparent animationType="fade" onRequestClose={() => setShowTimePicker(false)}>
        <Pressable style={styles.pickerOverlay} onPress={() => setShowTimePicker(false)}>
          <Pressable style={styles.pickerSheet} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.pickerTitle}>Select Travel Time</Text>
            <View style={styles.clockPeriodRow}>
              {(['AM', 'PM'] as const).map((period) => {
                const active = clockPeriod === period;
                return (
                  <Pressable
                    key={period}
                    style={[styles.periodChip, active && styles.periodChipActive]}
                    onPress={() => setClockPeriod(period)}>
                    <Text style={[styles.periodChipText, active && styles.periodChipTextActive]}>{period}</Text>
                  </Pressable>
                );
              })}
              <View style={styles.clockPreviewPill}>
                <Ionicons name="time-outline" size={14} color="#0E485D" />
                <Text style={styles.clockPreviewText}>{clockPreview}</Text>
              </View>
            </View>

            <View style={styles.clockFace}>
              <View style={styles.clockCenterDot} />
              {([12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const).map((hour, index) => {
                const angle = (index / 12) * Math.PI * 2 - Math.PI / 2;
                const radius = 102;
                const nodeSize = 38;
                const center = 130;
                const left = center + radius * Math.cos(angle) - nodeSize / 2;
                const top = center + radius * Math.sin(angle) - nodeSize / 2;
                const active = clockHour === hour;
                return (
                  <Pressable
                    key={`hour-${hour}`}
                    style={[styles.clockHourNode, { left, top }, active && styles.clockHourNodeActive]}
                    onPress={() => setClockHour(hour)}>
                    <Text style={[styles.clockHourText, active && styles.clockHourTextActive]}>{hour}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.minuteRow}>
              {clockMinuteOptions.map((minuteOption) => {
                const active = clockMinute === minuteOption;
                return (
                  <Pressable
                    key={`minute-${minuteOption}`}
                    style={[styles.minuteChip, active && styles.minuteChipActive]}
                    onPress={() => setClockMinute(minuteOption)}>
                    <Text style={[styles.minuteChipText, active && styles.minuteChipTextActive]}>
                      {String(minuteOption).padStart(2, '0')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable style={styles.pickerDoneButton} onPress={applyClockSelection}>
              <Text style={styles.pickerDoneButtonText}>Use This Time</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#E9F0F5',
  },
  content: {
    paddingBottom: 24,
  },
  hero: {
    paddingTop: 22,
    paddingHorizontal: 18,
    paddingBottom: 28,
    backgroundColor: '#081A23',
  },
  brand: {
    color: '#F4B400',
    fontSize: 30,
    fontFamily: Fonts.rounded,
    letterSpacing: 1.4,
  },
  tagline: {
    color: '#D7E8F0',
    fontSize: 16,
    marginTop: 4,
  },
  heroHint: {
    color: '#AFC7D2',
    fontSize: 13,
    marginTop: 7,
  },
  searchCard: {
    marginHorizontal: 16,
    marginTop: -14,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#0A141B',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    borderWidth: 1,
    borderColor: '#DCE7ED',
  },
  cardTitle: {
    fontSize: 17,
    fontFamily: Fonts.rounded,
    color: '#0F2530',
    marginBottom: 10,
  },
  inputWrap: {
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CCDCE5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: '#1B313E',
    backgroundColor: '#F5FAFC',
  },
  suggestion: {
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#EEF4F8',
  },
  suggestionText: {
    color: '#2D4452',
    fontSize: 12,
  },
  metaRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    backgroundColor: '#E9EFF2',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metaInputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    backgroundColor: '#E9EFF2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 132,
  },
  metaValue: {
    color: '#0F2530',
    fontWeight: '600',
    minWidth: 80,
    paddingVertical: 6,
  },
  guaranteedPill: {
    backgroundColor: '#D8F2E8',
  },
  guaranteedText: {
    fontSize: 12,
    color: '#124D3A',
    fontWeight: '600',
  },
  modeSection: {
    marginTop: 18,
    paddingHorizontal: 16,
  },
  modeTitle: {
    color: '#30424D',
    fontWeight: '700',
    marginBottom: 8,
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: '#D8E4EB',
    borderRadius: 12,
    padding: 4,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#0F2530',
  },
  modeButtonText: {
    color: '#2C3E49',
    fontWeight: '700',
  },
  modeButtonTextActive: {
    color: '#FFFFFF',
  },
  sectionHeader: {
    marginTop: 20,
    paddingHorizontal: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontWeight: '700',
    color: '#30424D',
    marginBottom: 0,
    fontSize: 19,
    fontFamily: Fonts.rounded,
  },
  sectionCount: {
    color: '#5A7483',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D6E4EC',
    backgroundColor: '#F4F9FC',
    alignItems: 'center',
  },
  emptyTitle: {
    marginTop: 6,
    color: '#173542',
    fontWeight: '800',
  },
  emptyHint: {
    marginTop: 4,
    color: '#58717D',
    fontSize: 12,
    textAlign: 'center',
  },
  extraPanel: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    padding: 13,
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8EF',
    borderWidth: 1,
  },
  extraTitle: {
    color: '#2F4350',
    fontWeight: '700',
    marginBottom: 8,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#CAD9E1',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#F8FBFD',
  },
  chipActive: {
    borderColor: '#0F2530',
    backgroundColor: '#E4EEF4',
  },
  chipText: {
    color: '#445C69',
    fontSize: 12,
    fontWeight: '700',
  },
  chipTextActive: {
    color: '#0F2530',
  },
  hintText: {
    color: '#5B7583',
    fontSize: 12,
  },
  searchButton: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 13,
    backgroundColor: '#0A2533',
    alignItems: 'center',
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  rideCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 15,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE9F0',
  },
  rideCardActive: {
    borderColor: '#0F2530',
    backgroundColor: '#F7FAFB',
  },
  rideTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  rideTopLeft: {
    flexShrink: 1,
  },
  rideMetaRow: {
    marginTop: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rideProvider: {
    color: '#0F2530',
    fontWeight: '700',
    fontSize: 15,
  },
  badge: {
    backgroundColor: '#EEF6FB',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 9,
  },
  badgeText: {
    color: '#176C94',
    fontSize: 11,
    fontWeight: '700',
  },
  rideInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  rideTime: {
    color: '#253642',
    fontWeight: '600',
  },
  rideEta: {
    color: '#607380',
    fontWeight: '600',
  },
  rideRoute: {
    color: '#5C707D',
    fontSize: 12,
  },
  rideBottom: {
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fare: {
    fontSize: 19,
    fontFamily: Fonts.rounded,
    color: '#0F2530',
  },
  seats: {
    color: '#607380',
    fontSize: 12,
  },
  seatPanel: {
    marginHorizontal: 16,
    marginTop: 6,
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderColor: '#DCE9F0',
    borderWidth: 1,
  },
  carShell: {
    position: 'relative',
    borderRadius: 14,
    backgroundColor: '#102A36',
    paddingVertical: 20,
    paddingHorizontal: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  carWheelLeft: {
    position: 'absolute',
    left: -14,
    top: '36%',
    width: 22,
    height: 68,
    borderRadius: 12,
    backgroundColor: '#243B47',
    borderWidth: 1,
    borderColor: '#385563',
  },
  carWheelRight: {
    position: 'absolute',
    right: -14,
    top: '36%',
    width: 22,
    height: 68,
    borderRadius: 12,
    backgroundColor: '#243B47',
    borderWidth: 1,
    borderColor: '#385563',
  },
  carBody: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 460,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2D4653',
    backgroundColor: '#0F3443',
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  carRoofBar: {
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 6,
    width: 88,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#4A6A79',
  },
  carDash: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    justifyContent: 'center',
  },
  carDashText: {
    color: '#B8CED9',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  seatDeck: {
    marginTop: 2,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 310,
    paddingBottom: 2,
  },
  carRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
    marginBottom: 10,
  },
  carAisle: {
    width: 26,
  },
  seatItem: {
    width: 82,
    minHeight: 58,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#6F8894',
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DFF2FB',
  },
  seatOccupied: {
    backgroundColor: '#B9C6CC',
    borderColor: '#9BADB7',
  },
  seatSelected: {
    borderColor: '#F4B400',
    backgroundColor: '#FFF3CC',
  },
  seatWindow: {
    borderStyle: 'dashed',
  },
  seatLabel: {
    color: '#1F3744',
    fontWeight: '700',
    fontSize: 12,
  },
  seatLabelDisabled: {
    color: '#7C909D',
  },
  occupantText: {
    marginTop: 3,
    fontSize: 9,
    color: '#2A414E',
    fontWeight: '800',
  },
  freeText: {
    marginTop: 3,
    fontSize: 11,
    color: '#2A7478',
    fontWeight: '700',
  },
  checkoutCard: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: '#0F2530',
    borderRadius: 14,
    padding: 14,
  },
  checkoutTitle: {
    color: '#F4B400',
    fontFamily: Fonts.rounded,
    fontSize: 18,
    marginBottom: 8,
  },
  checkoutLine: {
    color: '#D8E5EB',
    marginBottom: 4,
  },
  ctaButton: {
    marginTop: 10,
    backgroundColor: '#F4B400',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  ctaText: {
    color: '#10212A',
    fontWeight: '800',
  },
  receiptCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4EDF2',
    padding: 14,
  },
  receiptTitle: {
    color: '#0F2530',
    fontWeight: '800',
    fontSize: 16,
    marginBottom: 6,
  },
  receiptLine: {
    color: '#415864',
    marginBottom: 3,
    fontSize: 12,
  },
  qrWrap: {
    marginTop: 12,
    alignItems: 'center',
  },
  upcomingButton: {
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: '#0F2530',
    paddingVertical: 10,
    alignItems: 'center',
  },
  upcomingButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 21, 30, 0.45)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: '72%',
    padding: 14,
    borderTopWidth: 1,
    borderColor: '#D9E6EE',
  },
  pickerTitle: {
    color: '#132A37',
    fontWeight: '800',
    fontSize: 16,
    marginBottom: 10,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  monthNavButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E9F1F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNavButtonDisabled: {
    backgroundColor: '#F1F5F8',
  },
  calendarTitle: {
    color: '#1A3848',
    fontWeight: '800',
    fontSize: 15,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  weekLabel: {
    width: '14.28%',
    textAlign: 'center',
    color: '#6F8793',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 6,
  },
  calendarCell: {
    width: '14.28%',
    aspectRatio: 1,
    borderRadius: 10,
    backgroundColor: '#EDF4F8',
    borderWidth: 1,
    borderColor: '#D6E4ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  calendarCellOut: {
    opacity: 0.5,
  },
  calendarCellDisabled: {
    opacity: 0.4,
  },
  calendarCellActive: {
    backgroundColor: '#0E4A60',
    borderColor: '#0E4A60',
  },
  calendarCellText: {
    color: '#1D3B4A',
    fontWeight: '700',
  },
  calendarCellTextOut: {
    color: '#58707D',
  },
  calendarCellTextDisabled: {
    color: '#7A8D98',
  },
  calendarCellTextActive: {
    color: '#FFFFFF',
  },
  calendarHint: {
    marginTop: 10,
    color: '#59707E',
    fontSize: 12,
  },
  clockPeriodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  periodChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#CADBE5',
    backgroundColor: '#F3F8FB',
  },
  periodChipActive: {
    backgroundColor: '#0E4A60',
    borderColor: '#0E4A60',
  },
  periodChipText: {
    color: '#1D3A49',
    fontWeight: '700',
    fontSize: 12,
  },
  periodChipTextActive: {
    color: '#FFFFFF',
  },
  clockPreviewPill: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#D8EDF4',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  clockPreviewText: {
    color: '#0E485D',
    fontWeight: '800',
  },
  clockFace: {
    alignSelf: 'center',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#EBF4F8',
    borderWidth: 1,
    borderColor: '#D4E4EE',
    marginBottom: 14,
    position: 'relative',
  },
  clockCenterDot: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 10,
    height: 10,
    marginTop: -5,
    marginLeft: -5,
    borderRadius: 999,
    backgroundColor: '#0E4A60',
  },
  clockHourNode: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#C5D8E4',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clockHourNodeActive: {
    backgroundColor: '#0E4A60',
    borderColor: '#0E4A60',
  },
  clockHourText: {
    color: '#203F4E',
    fontWeight: '800',
    fontSize: 12,
  },
  clockHourTextActive: {
    color: '#FFFFFF',
  },
  minuteRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  minuteChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#C9DBE6',
    backgroundColor: '#F4F9FC',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  minuteChipActive: {
    backgroundColor: '#0E4A60',
    borderColor: '#0E4A60',
  },
  minuteChipText: {
    color: '#1D3A49',
    fontWeight: '700',
  },
  minuteChipTextActive: {
    color: '#FFFFFF',
  },
  pickerDoneButton: {
    borderRadius: 12,
    backgroundColor: '#0E4A60',
    paddingVertical: 12,
    alignItems: 'center',
  },
  pickerDoneButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});

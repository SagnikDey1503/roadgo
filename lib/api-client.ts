import { API_BASE_URL } from '@/constants/api';

export type UserGender = 'male' | 'female' | 'other';
export type TravelMode = 'sharing' | 'solo';
export type SharingCarType = '4-seater' | '6-seater' | 'auto';
export type SoloCarType = 'auto' | 'mini' | 'sedan' | 'suv';

export type UserProfile = {
  id: string;
  name: string;
  phone: string;
  gender: UserGender;
  hasSubscription: boolean;
  canChangeGender: boolean;
  creditBalance: number;
};

export type LocationSuggestion = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

export type RideSeat = {
  seatId: string;
  label: string;
  isWindow: boolean;
  occupied: boolean;
  occupantGender: UserGender | null;
};

export type RideOption = {
  rideId: string;
  provider: string;
  mode: TravelMode;
  carType: SharingCarType | SoloCarType;
  seatsTotal: number;
  seatsAvailable: number;
  distanceFromPickupKm: number;
  departureTime: string;
  etaMinutes: number;
  totalTravelMinutes?: number;
  baseFare: number;
  seatMap: RideSeat[] | null;
  maleOnboard?: number;
  femaleOnboard?: number;
  driverName?: string;
  driverRating?: number;
  vehicleNumber?: string;
  vehicleColor?: string;
  estimatedDropTime?: string;
  pricingTag?: string;
  poolingMatchPercent?: number;
  policyHint?: string;
};

export type BookingRecord = {
  bookingId: string;
  mode: TravelMode;
  pickupName: string;
  dropName: string;
  travelDate: string;
  travelTime: string;
  carType: string;
  selectedSeatId: string | null;
  amountPaid: number;
  status: string;
  createdAt: string;
  qrCodeText: string;
  receiptCode: string;
  cancellationCharge: number;
};

export type CancellationPolicy = {
  subscriber: {
    summary: string;
    lateFee: number;
  };
  nonSubscriber: {
    summary: string;
    standardFee: number;
    lateFee: number;
  };
  note: string;
  creditPenaltyPerCancellation?: number;
};

type ApiConfig = {
  method?: 'GET' | 'POST';
  token?: string | null;
  body?: object;
};

class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, config: ApiConfig = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: config.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(config.token ? { Authorization: `Bearer ${config.token}` } : {}),
      },
      body: config.body ? JSON.stringify(config.body) : undefined,
    });
  } catch {
    throw new ApiError(`Could not connect to server (${API_BASE_URL}). Start backend and try again.`);
  }

  const contentType = response.headers.get('content-type') || '';
  const textPayload = await response.text();
  let payload: { error?: string } & Record<string, unknown> = {};

  if (textPayload) {
    if (contentType.includes('application/json')) {
      payload = JSON.parse(textPayload);
    } else {
      try {
        payload = JSON.parse(textPayload);
      } catch {
        payload = { error: textPayload };
      }
    }
  }

  if (!response.ok) {
    throw new ApiError(String(payload.error || `Request failed (${response.status})`));
  }
  return payload as T;
}

export async function signUpWithPassword(input: {
  name: string;
  phone: string;
  gender: UserGender;
  password: string;
}) {
  return request<{ message: string; token: string; user: UserProfile }>('/auth/signup', {
    method: 'POST',
    body: input,
  });
}

export async function loginWithPassword(phone: string, password: string) {
  return request<{ token: string; user: UserProfile }>('/auth/login', {
    method: 'POST',
    body: { phone, password },
  });
}

export async function fetchMe(token: string) {
  return request<{ user: UserProfile }>('/auth/me', {
    token,
  });
}

export async function logoutSession(token: string) {
  return request<{ ok: boolean }>('/auth/logout', {
    method: 'POST',
    token,
  });
}

export async function toggleSubscription(token: string, enabled: boolean) {
  return request<{ user: UserProfile }>('/subscription/toggle', {
    method: 'POST',
    token,
    body: { enabled },
  });
}

export async function updateProfileGender(token: string, gender: UserGender) {
  return request<{ user: UserProfile }>('/profile/update-gender', {
    method: 'POST',
    token,
    body: { gender },
  });
}

export async function suggestLocations(query: string) {
  const encoded = encodeURIComponent(query);
  return request<{ locations: LocationSuggestion[] }>(`/locations/suggest?q=${encoded}`);
}

export async function searchRides(
  token: string,
  payload: {
    pickupId: string;
    dropId: string;
    travelDate: string;
    travelTime: string;
    mode: TravelMode;
    carType?: string;
    sharingGender?: string;
  }
) {
  return request<{
    rides: RideOption[];
    constraints: {
      maxAdvanceDays: number;
      sharingRadiusKm: number;
      searchOptimizedForSeatFill: boolean;
      routeSource?: string;
    };
  }>('/rides/search', {
    method: 'POST',
    token,
    body: payload,
  });
}

export async function confirmDummyPayment(
  token: string,
  payload: {
    pickupId: string;
    dropId: string;
    travelDate: string;
    travelTime: string;
    mode: TravelMode;
    carType: string;
    selectedSeatId: string | null;
    rideId: string;
    quotedFare: number;
  }
) {
  return request<{ paymentStatus: 'SUCCESS'; booking: BookingRecord }>('/bookings/confirm-payment', {
    method: 'POST',
    token,
    body: {
      ...payload,
      paymentMethod: 'Dummy Success Payment',
    },
  });
}

export async function fetchBookings(token: string, segment: 'upcoming' | 'history') {
  return request<{ bookings: BookingRecord[] }>(`/bookings?segment=${segment}`, {
    token,
  });
}

export async function fetchCancellationPolicy(token: string) {
  return request<{ policy: CancellationPolicy }>('/cancellation-policy', { token });
}

export async function cancelBooking(token: string, bookingId: string) {
  return request<{
    message: string;
    cancellationCharge: number;
    creditPenalty: number;
    refundAmount: number;
    amountPaid: number;
    creditBalance: number;
    user: UserProfile;
    booking: BookingRecord;
  }>('/bookings/cancel', {
    method: 'POST',
    token,
    body: { bookingId },
  });
}

export { ApiError };

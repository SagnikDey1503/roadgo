export type RideType = 'Shared Seat' | 'Solo Cab';

export type RideOption = {
  id: string;
  provider: string;
  departure: string;
  eta: string;
  fare: number;
  seatsLeft: number;
  rideType: RideType;
  pickup: string;
  drop: string;
  status: 'Guaranteed' | 'RAC Available' | 'Waitlist';
};

export type TicketStatus = 'Confirmed' | 'RAC 02' | 'Waitlist 05';

export type Ticket = {
  id: string;
  from: string;
  to: string;
  date: string;
  time: string;
  rideType: RideType;
  fare: number;
  status: TicketStatus;
  note: string;
};

export const rideOptions: RideOption[] = [
  {
    id: 'rg-1',
    provider: 'RoadGo Swift',
    departure: '07:45 PM',
    eta: '38 min',
    fare: 149,
    seatsLeft: 3,
    rideType: 'Shared Seat',
    pickup: 'Powai Lake Gate',
    drop: 'BKC Metro Station',
    status: 'Guaranteed',
  },
  {
    id: 'rg-2',
    provider: 'RoadGo Prime',
    departure: '08:05 PM',
    eta: '34 min',
    fare: 329,
    seatsLeft: 1,
    rideType: 'Solo Cab',
    pickup: 'IIT Main Gate',
    drop: 'BKC Metro Station',
    status: 'Guaranteed',
  },
  {
    id: 'rg-3',
    provider: 'RoadGo Saver',
    departure: '08:20 PM',
    eta: '44 min',
    fare: 119,
    seatsLeft: 0,
    rideType: 'Shared Seat',
    pickup: 'Hiranandani Circle',
    drop: 'Kurla Terminus',
    status: 'RAC Available',
  },
];

export const tickets: Ticket[] = [
  {
    id: 'TK-4591',
    from: 'IIT Powai',
    to: 'BKC Metro',
    date: 'Today',
    time: '08:05 PM',
    rideType: 'Solo Cab',
    fare: 329,
    status: 'Confirmed',
    note: 'Guaranteed pickup in 6 mins',
  },
  {
    id: 'TK-4607',
    from: 'Powai Lake Gate',
    to: 'Kurla Terminus',
    date: 'Tomorrow',
    time: '07:40 AM',
    rideType: 'Shared Seat',
    fare: 109,
    status: 'RAC 02',
    note: 'Auto-confirms when a seat opens',
  },
  {
    id: 'TK-4622',
    from: 'Hiranandani',
    to: 'Airport T2',
    date: 'Fri, Mar 20',
    time: '05:50 AM',
    rideType: 'Shared Seat',
    fare: 179,
    status: 'Waitlist 05',
    note: 'Priority enabled with RoadGo Plus',
  },
];

export const uniqueFeatures = [
  'Ticket-based road travel with guaranteed slots',
  'No surge pricing at peak hours',
  'Seat sharing to reduce travel cost',
  'RAC and waiting list like railways',
  'Refund if flight/train is missed due to RoadGo delay',
  'Flexible pickup and drop points',
];

export const premiumPerks = [
  'Priority booking windows',
  'Faster confirmation from RAC/waitlist',
  'Airport and station protection cover',
  'Dedicated support line',
];

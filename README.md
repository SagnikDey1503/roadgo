# RoadGo Prototype (Expo + Node + MongoDB)

RoadGo is a prototype ride-booking app (Ola/Uber style) with:
- phone/password signup + login
- MongoDB-backed users/sessions/bookings
- shared + solo ride search
- dummy payment + QR receipt + history/upcoming + cancellation policy

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create env file:
```bash
cp .env.example .env
```
Then edit `.env` and set your real values (`MONGO_URI` required).
If Mongo is temporarily unreachable, keep `MONGO_FALLBACK_TO_MEMORY=true` for demo mode.

3. In another terminal, start Expo app:
```bash
npx expo start
```

4. Start backend:
```bash
npm run backend
```

If testing on a physical phone, replace `EXPO_PUBLIC_API_BASE_URL` in `.env` from `localhost` to your machine LAN IP.

## Notes

- Auth is now phone/password only (OTP flow removed).
- Auth session is persisted in local storage (`AsyncStorage`) so login survives refresh/reopen.
- Payment is intentionally dummy success for prototype submission.
- Shared ride seat occupancy data is simulated for demo behavior.

## Scripts

- `npm run backend` -> runs Node backend on port `4000`
- `npx expo start` -> runs Expo app
- `npm run lint` -> lint app
- `npm run build:apk` -> creates installable Android APK via EAS

## Export APK (No Play Store Needed)

1. Install EAS CLI (one-time):
```bash
npm install -g eas-cli
```

2. Login to Expo:
```bash
eas login
```

3. Build APK (cloud build):
```bash
npm run build:apk
```

4. After build finishes, open the download link shown in terminal and install APK on Android phone.

Note: APK is Android-only. iPhone does not install APK files.

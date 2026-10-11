# Aggie Playground for iPhone

This is the native iOS app in the WoCow repository. It is a separate Expo and React Native project; the existing website in `aggie-playground/` is unchanged.

## Run it on an iPhone

1. Install **Expo Go** from the App Store on your iPhone.
2. On your computer, run:

   ```sh
   cd ios-app
   npm start
   ```

3. Make sure your iPhone and computer are on the same Wi-Fi network. Scan the QR code shown in the terminal using your iPhone camera, then open it in Expo Go.

The app has Map, Discover, Buddies, and Profile tabs. Discover includes activity search and category filters, a host form, and student discussions. Buddies and Profile have preview interactions.

Until the native app is connected to Supabase, example activities and profile actions are preview-only and stay on the phone during the current app session. They do not sync to the website or other students. To enable shared sign-in, activity hosting and joining, buddy requests, profiles, notifications, and club events, configure the Supabase project URL and public publishable key for the native app and add the needed redirect URL in Supabase Auth. Never put a Supabase service-role key or the Context.dev secret in the iPhone app. Context.dev requests must go through the existing server route.

The campus map uses Apple Maps on iPhone and does not need a Google Maps key. Campus pins can be selected and opened in Apple Maps.

## Project layout

- `src/app/` contains native screens and navigation.
- `app.json` contains the iOS app name, bundle identifier, and native map setup.
- `aggie-playground/` at the repository root is the separate Next.js website and backend.

For an iOS Simulator build, install Xcode on a Mac and run `npm run ios`. Expo Go on a physical iPhone does not require Xcode.

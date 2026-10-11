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

The app opens to an interactive UC Davis campus map. It uses the iPhone's Apple Maps implementation and does not need a Google Maps key. The map can be panned and zoomed, campus pins can be selected, and the selected spot can be opened in Apple Maps.

Activity data is not connected yet. The map displays public meeting spots from the website project and clearly indicates that live activity pins need the data service. The app scaffold and map can be worked on before Supabase or Context.dev keys are available.

## Project layout

- `src/app/` contains native screens and navigation.
- `app.json` contains the iOS app name, bundle identifier, and native map setup.
- `aggie-playground/` at the repository root is the separate Next.js website and backend.

For an iOS Simulator build, install Xcode on a Mac and run `npm run ios`. Expo Go on a physical iPhone does not require Xcode.

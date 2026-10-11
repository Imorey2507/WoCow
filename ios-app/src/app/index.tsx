import { useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type CampusPlace = {
  key: string;
  name: string;
  shortName: string;
  latitude: number;
  longitude: number;
  emoji: string;
};

// Coordinates match the public UC Davis meeting spots used by the web app.
const CAMPUS_PLACES: CampusPlace[] = [
  { key: "mu", name: "Memorial Union", shortName: "MU", latitude: 38.54175, longitude: -121.74935, emoji: "🎓" },
  { key: "quad", name: "The Quad", shortName: "The Quad", latitude: 38.54213, longitude: -121.74935, emoji: "🌳" },
  { key: "arc", name: "Activities & Recreation Center", shortName: "ARC", latitude: 38.543, longitude: -121.75915, emoji: "🏃" },
  { key: "shields", name: "Shields Library", shortName: "Shields", latitude: 38.53976, longitude: -121.74928, emoji: "📚" },
  { key: "arboretum", name: "UC Davis Arboretum", shortName: "Arboretum", latitude: 38.5318, longitude: -121.7508, emoji: "🌿" },
  { key: "silo", name: "The Silo", shortName: "The Silo", latitude: 38.53933, longitude: -121.7555, emoji: "🥪" },
];

const CAMPUS_REGION: Region = {
  latitude: 38.5395,
  longitude: -121.7525,
  latitudeDelta: 0.014,
  longitudeDelta: 0.014,
};

export default function CampusMapScreen() {
  const insets = useSafeAreaInsets();
  const map = useRef<MapView | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<CampusPlace>(CAMPUS_PLACES[0]);

  function selectPlace(place: CampusPlace) {
    setSelectedPlace(place);
    map.current?.animateToRegion(
      { ...CAMPUS_REGION, latitude: place.latitude, longitude: place.longitude, latitudeDelta: 0.008, longitudeDelta: 0.008 },
      350,
    );
  }

  function resetMap() {
    setSelectedPlace(CAMPUS_PLACES[0]);
    map.current?.animateToRegion(CAMPUS_REGION, 350);
  }

  function openInAppleMaps() {
    const query = encodeURIComponent(selectedPlace.name);
    void Linking.openURL(`maps://?ll=${selectedPlace.latitude},${selectedPlace.longitude}&q=${query}`);
  }

  return (
    <View style={styles.screen}>
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        initialRegion={CAMPUS_REGION}
        mapType="standard"
        showsCompass
        showsScale={false}
        toolbarEnabled={false}
        accessibilityLabel="Interactive map of the UC Davis campus"
      >
        {CAMPUS_PLACES.map((place) => {
          const selected = selectedPlace.key === place.key;
          return (
            <Marker
              key={place.key}
              coordinate={{ latitude: place.latitude, longitude: place.longitude }}
              title={place.name}
              description="A public campus meeting spot"
              onPress={() => selectPlace(place)}
              tracksViewChanges={false}
            >
              <View style={[styles.marker, selected && styles.selectedMarker]}>
                <Text style={styles.markerEmoji}>{place.emoji}</Text>
                <Text style={styles.markerLabel}>{place.shortName}</Text>
              </View>
            </Marker>
          );
        })}
      </MapView>

      <View style={[styles.headerSafeArea, { paddingTop: insets.top + 6 }]}>
        <View style={styles.header}>
          <View style={styles.brandIcon}><Text style={styles.brandEmoji}>🐮</Text></View>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>Aggie Playground</Text>
            <Text style={styles.subtitle}>Find your people on campus</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Reset map to campus" onPress={resetMap} style={styles.locateButton}>
            <Text style={styles.locateEmoji}>⌖</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.sheetSafeArea, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetTopLine}>
            <View style={styles.livePill}><View style={styles.liveDot} /><Text style={styles.liveText}>CAMPUS MAP</Text></View>
            <Text style={styles.spotCount}>{CAMPUS_PLACES.length} meeting spots</Text>
          </View>
          <Text style={styles.placeTitle}>{selectedPlace.emoji}  {selectedPlace.name}</Text>
          <Text style={styles.helperText}>Tap a pin to choose a place. Activity pins will show here when the app’s data service is connected.</Text>
          <Pressable accessibilityRole="button" onPress={openInAppleMaps} style={({ pressed }) => [styles.directionsButton, pressed && styles.pressed]}>
            <Text style={styles.directionsText}>Open in Apple Maps</Text>
            <Text style={styles.directionsArrow}>↗</Text>
          </Pressable>
          <View style={styles.placeRow}>
            {CAMPUS_PLACES.slice(0, 4).map((place) => (
              <Pressable
                key={place.key}
                accessibilityRole="button"
                accessibilityLabel={`Show ${place.name}`}
                onPress={() => selectPlace(place)}
                style={[styles.placeChip, selectedPlace.key === place.key && styles.placeChipSelected]}
              >
                <Text style={styles.chipEmoji}>{place.emoji}</Text>
                <Text numberOfLines={1} style={styles.chipLabel}>{place.shortName}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#e7efe4" },
  headerSafeArea: { position: "absolute", left: 0, right: 0, top: 0, paddingHorizontal: 16 },
  header: {
    minHeight: 68,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fffaf0",
    borderWidth: 2,
    borderColor: "#29251f",
    borderRadius: 22,
    shadowColor: "#29251f",
    shadowOffset: { width: 2, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 0,
    elevation: 4,
  },
  brandIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", backgroundColor: "#ffdc62", borderRadius: 15 },
  brandEmoji: { fontSize: 26 },
  titleBlock: { flex: 1 },
  title: { color: "#29251f", fontSize: 18, fontWeight: "900", letterSpacing: -0.4 },
  subtitle: { marginTop: 2, color: "#5e574e", fontSize: 12, fontWeight: "700" },
  locateButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", backgroundColor: "#ffffff", borderWidth: 1.5, borderColor: "#29251f", borderRadius: 14 },
  locateEmoji: { color: "#29251f", fontSize: 28, lineHeight: 31, fontWeight: "600" },
  sheetSafeArea: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 12 },
  sheet: { paddingHorizontal: 17, paddingTop: 9, paddingBottom: 10, borderWidth: 2, borderColor: "#29251f", borderRadius: 26, backgroundColor: "#fffaf0", shadowColor: "#29251f", shadowOffset: { width: 2, height: -3 }, shadowOpacity: 0.17, shadowRadius: 0, elevation: 8 },
  sheetHandle: { width: 38, height: 4, alignSelf: "center", marginBottom: 11, borderRadius: 99, backgroundColor: "#c9c0b2" },
  sheetTopLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  livePill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99, backgroundColor: "#e4f2dd" },
  liveDot: { width: 7, height: 7, borderRadius: 99, backgroundColor: "#49875a" },
  liveText: { color: "#385c3d", fontSize: 10, fontWeight: "900", letterSpacing: 0.7 },
  spotCount: { color: "#696055", fontSize: 12, fontWeight: "700" },
  placeTitle: { marginTop: 10, color: "#29251f", fontSize: 21, fontWeight: "900", letterSpacing: -0.5 },
  helperText: { marginTop: 4, color: "#655e54", fontSize: 13, lineHeight: 18, fontWeight: "600" },
  directionsButton: { height: 46, marginTop: 13, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: "#ffdc62", borderWidth: 1.7, borderColor: "#29251f", borderRadius: 16 },
  directionsText: { color: "#29251f", fontSize: 15, fontWeight: "900" },
  directionsArrow: { color: "#29251f", fontSize: 18, fontWeight: "900" },
  pressed: { opacity: 0.7, transform: [{ scale: 0.99 }] },
  placeRow: { marginTop: 11, flexDirection: "row", gap: 7 },
  placeChip: { minHeight: 42, flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 5, backgroundColor: "#ffffff", borderWidth: 1.4, borderColor: "#d7cfc2", borderRadius: 13 },
  placeChipSelected: { backgroundColor: "#ffe98e", borderColor: "#29251f" },
  chipEmoji: { fontSize: 14 },
  chipLabel: { flexShrink: 1, color: "#29251f", fontSize: 11, fontWeight: "800" },
  marker: { minHeight: 35, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: "#fffaf0", borderWidth: 1.5, borderColor: "#29251f", borderRadius: 12, shadowColor: "#29251f", shadowOffset: { width: 1.5, height: 2 }, shadowOpacity: 0.2, shadowRadius: 0, elevation: 3 },
  selectedMarker: { backgroundColor: "#ffdc62", borderWidth: 2 },
  markerEmoji: { fontSize: 15 },
  markerLabel: { color: "#29251f", fontSize: 11, fontWeight: "900" },
});

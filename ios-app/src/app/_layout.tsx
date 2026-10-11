import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: "#29251f", tabBarInactiveTintColor: "#81786c", tabBarStyle: { height: 63, paddingTop: 5, backgroundColor: "#fffaf0", borderTopColor: "#29251f", borderTopWidth: 1.5 }, tabBarLabelStyle: { fontWeight: "800", fontSize: 11 } }}>
        <Tabs.Screen name="index" options={{ title: "Map", tabBarLabel: "Map" }} />
        <Tabs.Screen name="discover" options={{ title: "Discover", tabBarLabel: "Discover" }} />
        <Tabs.Screen name="buddies" options={{ title: "Buddies", tabBarLabel: "Buddies" }} />
        <Tabs.Screen name="profile" options={{ title: "Profile", tabBarLabel: "Profile" }} />
      </Tabs>
    </SafeAreaProvider>
  );
}

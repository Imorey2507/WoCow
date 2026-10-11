import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PEOPLE = [
  { name: "Maya", emoji: "🎨", bio: "Design major · always down for coffee and a walk", interests: ["Arts", "Social"], shared: 2 },
  { name: "Jordan", emoji: "🏐", bio: "First year · learning volleyball and exploring campus", interests: ["Sports", "Social"], shared: 1 },
  { name: "Alex", emoji: "📚", bio: "Bio major · looking for a study group", interests: ["Study", "Sports"], shared: 1 },
];
export default function BuddiesScreen() {
  const inset = useSafeAreaInsets(); const [sent, setSent] = useState<string[]>([]);
  return <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: inset.top + 18, paddingHorizontal: 18, paddingBottom: 24 }}>
    <Text style={styles.eyebrow}>🤝 MEET AGGIES</Text><Text style={styles.heading}>Matching Buddies</Text><Text style={styles.sub}>Find study partners, teammates, and friends who share your interests.</Text>
    <View style={styles.notice}><Text style={styles.noticeTitle}>Set up matching</Text><Text style={styles.body}>Buddy matching uses student profiles and requests from the shared database. Add the Supabase connection and sign-in before real students can appear here.</Text></View>
    <Text style={styles.section}>People to meet</Text>
    {PEOPLE.map((p) => <View key={p.name} style={styles.card}><View style={styles.top}><View style={styles.avatar}><Text style={{ fontSize: 25 }}>{p.emoji}</Text></View><View style={{ flex: 1 }}><Text style={styles.name}>{p.name}</Text><Text style={styles.bio}>{p.bio}</Text></View></View><Text style={styles.meta}>{p.shared} shared interests · {p.interests.join(" · ")}</Text><Pressable onPress={() => setSent(sent.includes(p.name) ? sent.filter((x) => x !== p.name) : [...sent, p.name])} style={[styles.button, sent.includes(p.name) && styles.sent]}><Text style={styles.buttonText}>{sent.includes(p.name) ? "Request sent ✓" : "Connect"}</Text></Pressable></View>)}
    <Text style={styles.foot}>Sample profiles are for preview only. Requests won’t reach anyone until backend setup is complete.</Text>
  </ScrollView>;
}
const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: "#e7efe4" }, eyebrow: { color: "#526b51", fontSize: 11, fontWeight: "900", letterSpacing: 1 }, heading: { marginTop: 6, color: "#29251f", fontSize: 32, fontWeight: "900", letterSpacing: -1 }, sub: { marginTop: 3, marginBottom: 17, color: "#655e54", fontSize: 14, lineHeight: 20, fontWeight: "600" }, notice: { marginBottom: 18, padding: 15, backgroundColor: "#ffedab", borderColor: "#29251f", borderWidth: 1.5, borderRadius: 20 }, noticeTitle: { color: "#29251f", fontSize: 15, fontWeight: "900" }, body: { marginTop: 6, color: "#514b43", fontSize: 13, lineHeight: 19, fontWeight: "600" }, section: { marginBottom: 10, color: "#29251f", fontSize: 19, fontWeight: "900" }, card: { marginBottom: 11, padding: 15, backgroundColor: "#fffaf0", borderColor: "#29251f", borderWidth: 1.5, borderRadius: 20 }, top: { flexDirection: "row", gap: 11, alignItems: "center" }, avatar: { width: 50, height: 50, justifyContent: "center", alignItems: "center", backgroundColor: "#ffdc62", borderRadius: 17 }, name: { color: "#29251f", fontSize: 17, fontWeight: "900" }, bio: { marginTop: 3, color: "#655e54", fontSize: 12, lineHeight: 17, fontWeight: "600" }, meta: { marginTop: 13, color: "#655e54", fontSize: 12, fontWeight: "800" }, button: { marginTop: 12, alignItems: "center", padding: 11, backgroundColor: "#b9dcf2", borderColor: "#29251f", borderWidth: 1.5, borderRadius: 14 }, sent: { backgroundColor: "#d5eccd" }, buttonText: { color: "#29251f", fontWeight: "900" }, foot: { marginTop: 5, color: "#746b5f", fontSize: 11, textAlign: "center", lineHeight: 16 } });

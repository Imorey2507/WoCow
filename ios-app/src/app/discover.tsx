import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Activity = { id: number; title: string; category: string; place: string; time: string; people: number; emoji: string; description: string };
const STARTER: Activity[] = [
  { id: 1, title: "Casual volleyball at the ARC", category: "Sports", place: "Activities & Recreation Center", time: "Today · 4:30 PM", people: 3, emoji: "🏐", description: "All levels welcome. Bring water!" },
  { id: 2, title: "Study session at Shields", category: "Study", place: "Shields Library", time: "Today · 5:00 PM", people: 2, emoji: "📚", description: "Working on bio and chem, come join." },
  { id: 3, title: "Coffee and a campus walk", category: "Social", place: "The Silo", time: "Tomorrow · 10:00 AM", people: 4, emoji: "☕", description: "A relaxed walk and a coffee break." },
];
const CATS = ["All", "Sports", "Study", "Social", "Arts"];
const box = { backgroundColor: "#fffaf0", borderColor: "#29251f", borderWidth: 1.5, borderRadius: 20 } as const;

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const [section, setSection] = useState("Activities");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [activities, setActivities] = useState(STARTER);
  const [joined, setJoined] = useState<number[]>([]);
  const [hosting, setHosting] = useState(false);
  const [title, setTitle] = useState("");
  const [place, setPlace] = useState("The Quad");
  const [post, setPost] = useState("");
  const [posts, setPosts] = useState<string[]>(["Anyone want to study together this afternoon? 📚"]);
  const filtered = useMemo(() => activities.filter((a) => (category === "All" || a.category === category) && `${a.title} ${a.place} ${a.description}`.toLowerCase().includes(query.toLowerCase())), [activities, category, query]);
  const button = (label: string, onPress: () => void, active = false) => <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text style={styles.chipText}>{label}</Text></Pressable>;

  function createActivity() {
    if (title.trim().length < 3) return;
    setActivities([{ id: Date.now(), title: title.trim(), category: "Social", place: place.trim() || "The Quad", time: "Today · 4:00 PM", people: 1, emoji: "✨", description: "Hosted by you · Add backend keys to publish for everyone." }, ...activities]);
    setTitle(""); setHosting(false); setSection("Activities");
  }

  return <View style={styles.screen}><ScrollView contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 24, paddingHorizontal: 18 }}>
    <Text style={styles.eyebrow}>🐮 AGGIE PLAYGROUND</Text><Text style={styles.heading}>Discover</Text><Text style={styles.sub}>Find something fun happening on campus.</Text>
    <View style={styles.row}>{["Activities", "Clubs", "Discussions"].map((s) => button(s, () => setSection(s), section === s))}</View>
    {section === "Activities" && <>
      <TextInput value={query} onChangeText={setQuery} placeholder="Search activities or places…" placeholderTextColor="#81786c" style={styles.search} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>{CATS.map((c) => button(c, () => setCategory(c), c === category))}</ScrollView>
      <View style={styles.sectionRow}><Text style={styles.sectionTitle}>Happening & coming up</Text><Pressable onPress={() => setHosting(true)} style={styles.hostButton}><Text style={styles.hostText}>＋ Host</Text></Pressable></View>
      {filtered.length ? filtered.map((a) => <View key={a.id} style={styles.card}><View style={styles.activityTop}><Text style={styles.emoji}>{a.emoji}</Text><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{a.title}</Text><Text style={styles.meta}>{a.time} · {a.place}</Text></View></View><Text style={styles.body}>{a.description}</Text><View style={styles.activityBottom}><Text style={styles.meta}>👥 {a.people} going · {a.category}</Text><Pressable onPress={() => setJoined(joined.includes(a.id) ? joined.filter((id) => id !== a.id) : [...joined, a.id])} style={[styles.joinButton, joined.includes(a.id) && styles.joined]}><Text style={styles.joinText}>{joined.includes(a.id) ? "Joined ✓" : "Join"}</Text></Pressable></View></View>) : <View style={styles.card}><Text style={styles.cardTitle}>No matches yet</Text><Text style={styles.body}>Try another search or category.</Text></View>}
    </>}
    {section === "Clubs" && <View style={styles.card}><Text style={styles.emoji}>🏫</Text><Text style={styles.cardTitle}>Campus club events</Text><Text style={styles.body}>Club events come from the WoCow server. Connect the shared backend to load live events here. The private Context.dev key stays on the server; it should never go in the iPhone app.</Text></View>}
    {section === "Discussions" && <><Text style={styles.sectionTitle}>Student discussions</Text><View style={styles.card}><TextInput value={post} onChangeText={setPost} placeholder="Start a conversation…" style={styles.search} /><Pressable style={styles.joinButton} onPress={() => { if (post.trim()) { setPosts([post.trim(), ...posts]); setPost(""); } }}><Text style={styles.joinText}>Post</Text></Pressable></View>{posts.map((p, i) => <View key={`${i}-${p}`} style={styles.card}><Text style={styles.body}>{p}</Text><Text style={styles.meta}>🐮 Aggie · just now</Text></View>)}</>}
    <Text style={styles.note}>Preview mode: actions on this phone are local until the shared Supabase backend is configured.</Text>
  </ScrollView>
  {hosting && <View style={styles.scrim}><View style={styles.modal}><Text style={styles.sectionTitle}>Host an activity</Text><TextInput value={title} onChangeText={setTitle} placeholder="What are you doing?" style={styles.search} maxLength={80} /><TextInput value={place} onChangeText={setPlace} placeholder="Campus meeting spot" style={styles.search} /><View style={styles.row}><Pressable onPress={() => setHosting(false)} style={styles.chip}><Text style={styles.chipText}>Cancel</Text></Pressable><Pressable onPress={createActivity} style={styles.hostButton}><Text style={styles.hostText}>Create preview</Text></Pressable></View></View></View>}
  </View>;
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: "#e7efe4" }, eyebrow: { color: "#526b51", fontSize: 11, fontWeight: "900", letterSpacing: 1 }, heading: { marginTop: 6, color: "#29251f", fontSize: 34, fontWeight: "900", letterSpacing: -1 }, sub: { marginTop: 2, marginBottom: 16, color: "#655e54", fontSize: 14, fontWeight: "600" }, row: { flexDirection: "row", gap: 8, marginBottom: 13 }, chip: { paddingVertical: 9, paddingHorizontal: 13, borderRadius: 99, backgroundColor: "#fffaf0", borderWidth: 1.3, borderColor: "#d7cfc2" }, chipActive: { backgroundColor: "#ffdc62", borderColor: "#29251f" }, chipText: { color: "#29251f", fontSize: 12, fontWeight: "800" }, search: { ...box, marginBottom: 10, paddingHorizontal: 14, paddingVertical: 12, color: "#29251f", fontSize: 15 }, sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4, marginBottom: 10 }, sectionTitle: { color: "#29251f", fontSize: 19, fontWeight: "900" }, hostButton: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, borderColor: "#29251f", backgroundColor: "#ffdc62" }, hostText: { color: "#29251f", fontWeight: "900" }, card: { ...box, marginBottom: 11, padding: 15 }, activityTop: { flexDirection: "row", gap: 11, alignItems: "center" }, emoji: { fontSize: 28 }, cardTitle: { color: "#29251f", fontSize: 16, fontWeight: "900" }, meta: { marginTop: 4, color: "#746b5f", fontSize: 12, fontWeight: "700" }, body: { marginTop: 11, color: "#514b43", fontSize: 14, lineHeight: 20, fontWeight: "600" }, activityBottom: { marginTop: 13, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, joinButton: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 13, borderWidth: 1.5, borderColor: "#29251f", backgroundColor: "#d5eccd" }, joined: { backgroundColor: "#ffdc62" }, joinText: { color: "#29251f", fontWeight: "900" }, note: { marginVertical: 12, color: "#746b5f", fontSize: 11, textAlign: "center", lineHeight: 16 }, scrim: { ...StyleSheet.absoluteFill, justifyContent: "center", padding: 20, backgroundColor: "#0008" }, modal: { ...box, padding: 18 }, });

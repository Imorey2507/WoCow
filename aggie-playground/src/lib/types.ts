export type LiveStatus = "live" | "upcoming" | "ended" | "cancelled";

export interface Activity {
  id: string;
  host_id: string;
  title: string;
  category: string;
  subcategory: string;
  location_key: string;
  location_name: string;
  lat: number;
  lng: number;
  starts_at: string;
  duration_min: number;
  max_participants: number;
  description: string;
  skill_level: string | null;
  vibe: string | null;
  what_to_bring: string | null;
  status: "active" | "cancelled";
  is_demo: boolean;
  created_at: string;
  participant_count: number;
  spots_remaining: number;
  host_name: string | null;
  host_emoji: string | null;
  host_color: string | null;
  live_status: LiveStatus;
}

export interface Profile {
  id: string;
  display_name: string;
  avatar_emoji: string;
  avatar_color: string;
  bio: string;
  favorite_categories: string[];
  preferred_activities: string[];
  discoverable: boolean;
  is_demo: boolean;
}

export interface AppNotification {
  id: string;
  kind: "new_activity" | "activity_updated" | "activity_cancelled";
  title: string;
  body: string;
  activity_id: string | null;
  read: boolean;
  created_at: string;
}

export interface ClubEvent {
  id: string;
  title: string;
  organization: string | null;
  starts_at: string | null;
  location: string | null;
  description: string | null;
  event_url: string;
  source_site: string;
  fetched_at: string;
}

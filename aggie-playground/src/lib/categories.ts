export type CategoryKey =
  | "social"
  | "career"
  | "academic"
  | "fitness"
  | "competitive"
  | "recreational"
  | "wellness";

export interface Category {
  key: CategoryKey;
  name: string;
  emoji: string;
  color: string; // pin + tag background
  ink: string; // text color on the tag
  subcategories: string[];
}

export const CATEGORIES: Category[] = [
  {
    key: "social",
    name: "Social & Hangouts",
    emoji: "🧋",
    color: "#FF8FA3",
    ink: "#6B1230",
    subcategories: ["Coffee / Boba Runs", "Dining Buddies", "Parties / Pregames", "Movie / Game Nights", "Casual Hangouts", "Campus Events", "Downtown Exploration"],
  },
  {
    key: "career",
    name: "Career & Networking",
    emoji: "💼",
    color: "#B9A4FF",
    ink: "#2D1B6B",
    subcategories: ["Hackathon Teammates", "Startup Brainstorming", "Networking / Coffee Chats", "Resume & LinkedIn Reviews", "Mock Interviews", "Case Competitions"],
  },
  {
    key: "academic",
    name: "Academic & Study",
    emoji: "📚",
    color: "#7CC4FF",
    ink: "#0B3A5E",
    subcategories: ["Study Buddies", "Group Study Sessions", "Exam Preparation", "Homework Help", "Library Meetups", "Language Exchange"],
  },
  {
    key: "fitness",
    name: "Fitness & Workouts",
    emoji: "💪",
    color: "#FFB454",
    ink: "#6B3A00",
    subcategories: ["Gym Buddies / Weightlifting", "Running / Jogging", "Pilates / Yoga", "HIIT / Bootcamp", "Cycling Workouts", "Fitness Challenges"],
  },
  {
    key: "competitive",
    name: "Competitive Sports",
    emoji: "🏐",
    color: "#FF7A59",
    ink: "#6B1F0B",
    subcategories: ["Basketball", "Soccer", "Volleyball", "Tennis", "Badminton", "Pickleball", "Ultimate Frisbee", "Table Tennis", "Scrimmages / Tournaments"],
  },
  {
    key: "recreational",
    name: "Recreational Sports",
    emoji: "🥏",
    color: "#7ED68A",
    ink: "#0F4A1B",
    subcategories: ["Casual Frisbee", "Beginner Pickleball", "Leisure Cycling", "Hiking / Nature Walks", "Roller Skating", "Casual Sports / Just-for-Fun Games"],
  },
  {
    key: "wellness",
    name: "Self-Care & Wellness",
    emoji: "🌿",
    color: "#FFE066",
    ink: "#5C4700",
    subcategories: ["Meditation / Mindfulness", "Journaling / Reading", "Arts & Crafts", "Nature Breaks / Sunset Watching", "Wellness Check-ins", "Relaxation / De-stress Sessions"],
  },
];

export const CATEGORY_BY_NAME: Record<string, Category> = Object.fromEntries(
  CATEGORIES.map((c) => [c.name, c]),
);

export function categoryOf(name: string): Category {
  return CATEGORY_BY_NAME[name] ?? CATEGORIES[0];
}

export const SPORT_CATEGORIES = ["Competitive Sports", "Recreational Sports"];

export const SKILL_LEVELS = ["Competitive", "Casual", "Beginners Welcome", "All Levels"] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

export const VIBES = ["Chill", "Energetic", "Focused", "Silly", "Wholesome"] as const;

export const FORUM_TOPICS = [
  "Looking for teammates",
  "Anyone free tonight?",
  "Campus recommendations",
  "Upcoming events",
  "Study groups",
] as const;

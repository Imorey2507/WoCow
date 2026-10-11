// WoCow category taxonomy. The 7 top-level categories are used as a JSON Schema
// enum, so Context.dev's extraction maps every scraped event straight into the
// categories the app already uses (no second classification step).

export const TAXONOMY = {
  "Social & Hangouts": [
    "Coffee / Boba Runs",
    "Dining Buddies",
    "Parties / Pregames",
    "Movie / Game Nights",
    "Casual Hangouts",
    "Campus Events",
    "Downtown Exploration",
  ],
  "Career & Networking": [
    "Hackathon Teammates",
    "Startup Brainstorming",
    "Networking / Coffee Chats",
    "Resume & LinkedIn Reviews",
    "Mock Interviews",
    "Case Competitions",
  ],
  "Academic & Study": [
    "Study Buddies",
    "Group Study Sessions",
    "Exam Preparation",
    "Homework Help",
    "Library Meetups",
    "Language Exchange",
  ],
  "Fitness & Workouts": [
    "Gym Buddies / Weightlifting",
    "Running / Jogging",
    "Pilates / Yoga",
    "HIIT / Bootcamp",
    "Cycling Workouts",
    "Fitness Challenges",
  ],
  "Competitive Sports": [
    "Basketball",
    "Soccer",
    "Volleyball",
    "Tennis",
    "Badminton",
    "Pickleball",
    "Ultimate Frisbee",
    "Table Tennis",
    "Scrimmages / Tournaments",
  ],
  "Recreational Sports": [
    "Casual Frisbee",
    "Beginner Pickleball",
    "Leisure Cycling",
    "Hiking / Nature Walks",
    "Roller Skating",
    "Casual Sports / Just-for-Fun Games",
  ],
  "Self-Care & Wellness": [
    "Meditation / Mindfulness",
    "Journaling / Reading",
    "Arts & Crafts",
    "Nature Breaks / Sunset Watching",
    "Wellness Check-ins",
    "Relaxation / De-stress Sessions",
  ],
} as const;

export type Category = keyof typeof TAXONOMY;
export const CATEGORIES = Object.keys(TAXONOMY) as Category[];
export const ALL_SUBCATEGORIES = Object.values(TAXONOMY).flat() as string[];

export interface WocowEvent {
  title: string;
  category: Category;
  subcategory: string | null;
  startTime: string | null; // ISO 8601, America/Los_Angeles
  endTime: string | null;
  location: string | null;
  hostClub: string | null;
  description: string | null;
  url: string | null;
  attendeeCount: number | null;
  isFree: boolean | null;
  source: "aggielife" | "club-site" | "answers" | "monitor";
  sourceUrl: string;
}

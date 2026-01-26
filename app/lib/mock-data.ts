import type {
  ActivityItem,
  Review,
  SourceStatus,
  StatCard,
} from "./types";

export const statCards: StatCard[] = [
  {
    label: "New reviews (24h)",
    value: "6",
    helper: "+2 from yesterday",
  },
  {
    label: "Ready to post",
    value: "3",
    helper: "2 waiting approval",
  },
  {
    label: "Auto-post queue",
    value: "2",
    helper: "Next run 2:00 AM",
  },
  {
    label: "Average rating",
    value: "4.6",
    helper: "Last 30 days",
  },
];

export const reviews: Review[] = [
  {
    id: "rev-001",
    source: "Google",
    author: "Hannah Patel",
    rating: 5,
    date: "Today, 9:18 AM",
    review:
      "Staff was quick, friendly, and the suite was spotless. The lobby aroma is a nice touch.",
    reply:
      "Thanks Hannah! We are glad the team made your morning easy. We will keep the lobby vibes going.",
    status: "ready",
    link: "https://maps.google.com/?q=place",
  },
  {
    id: "rev-002",
    source: "TripAdvisor",
    author: "Ramon Ellis",
    rating: 3.5,
    date: "Yesterday, 4:22 PM",
    review:
      "Great location but the room took a while to cool down. Breakfast options were limited.",
    reply:
      "Thanks for the detail, Ramon. We are reviewing the AC timing and breakfast lineup for next week.",
    status: "needs-review",
    link: "https://www.tripadvisor.com/",
  },
  {
    id: "rev-003",
    source: "Google",
    author: "Amelia Jordan",
    rating: 4.7,
    date: "Yesterday, 10:05 AM",
    review:
      "Loved the meeting room setup and the espresso bar. The only issue was parking at peak times.",
    reply:
      "Thanks Amelia! We will share your parking note with the team and keep the espresso ready.",
    status: "auto-post",
    link: "https://maps.google.com/?q=place",
  },
  {
    id: "rev-004",
    source: "TripAdvisor",
    author: "Chris Lee",
    rating: 5,
    date: "Jan 22, 7:30 PM",
    review:
      "Front desk handled a last-minute change perfectly. The welcome drink was a nice surprise.",
    reply:
      "Chris, that is wonderful to hear. We are happy the team could help and hope to see you again soon.",
    status: "posted",
    link: "https://www.tripadvisor.com/",
  },
  {
    id: "rev-005",
    source: "Google",
    author: "Priya N.",
    rating: 4.2,
    date: "Jan 21, 2:44 PM",
    review:
      "Clean rooms and comfortable bedding. The check-in line was long, but the staff stayed calm.",
    reply:
      "Thanks Priya! We are adding a second check-in host during peak hours to reduce the wait.",
    status: "draft",
    link: "https://maps.google.com/?q=place",
  },
];

export const activityItems: ActivityItem[] = [
  {
    id: "act-001",
    title: "Drafted reply for Hannah Patel",
    meta: "Google review",
    time: "25 min ago",
  },
  {
    id: "act-002",
    title: "Scheduled auto-post for Amelia Jordan",
    meta: "Google review",
    time: "2 hours ago",
  },
  {
    id: "act-003",
    title: "Flagged Ramon Ellis for manual review",
    meta: "TripAdvisor review",
    time: "Yesterday",
  },
];

export const sources: SourceStatus[] = [
  {
    id: "src-google",
    name: "Google",
    url: "https://maps.google.com/?q=place",
    status: "connected",
    lastSync: "Today, 2:03 AM",
  },
  {
    id: "src-trip",
    name: "TripAdvisor",
    url: "https://www.tripadvisor.com/",
    status: "connected",
    lastSync: "Today, 2:05 AM",
  },
];

export const replyPromptPreview =
  "Write a warm, concise reply. Mention the guest by name, thank them, and reference one detail from the review. Keep under 60 words.";

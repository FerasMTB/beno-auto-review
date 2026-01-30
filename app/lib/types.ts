export type ReviewSource = "Google" | "TripAdvisor";

export type ReviewStatus =
  | "posted"
  | "ready"
  | "auto-post"
  | "draft"
  | "needs-review";

export type Review = {
  id: string;
  reviewKey?: string | null;
  source: ReviewSource;
  author: string;
  rating: number | null;
  date: string;
  review: string | null;
  reply: string | null;
  status: ReviewStatus;
  link: string | null;
};

export type StatCard = {
  label: string;
  value: string;
  helper?: string;
};

export type ActivityItem = {
  id: string;
  title: string;
  meta: string;
  time: string;
};

export type SourceStatus = {
  id: string;
  name: ReviewSource;
  url: string;
  status: "connected" | "needs-auth" | "paused";
  lastSync: string;
};

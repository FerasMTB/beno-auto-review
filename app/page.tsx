"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "./components/app-shell";
import ReviewCard from "./components/review-card";
import ReviewWorkflow from "./components/review-workflow";
import type { Review, ReviewSource, ReviewStatus } from "./lib/types";

type ApiReviewItem = {
  reviewId?: string;
  externalId?: string;
  source?: string;
  reviewedAt?: string;
  status?: string;
  review?: string | null;
  reply?: string | null;
  rating?: number | null;
  link?: string | null;
  authorName?: string | null;
};

type ReviewItem = Review & {
  reviewedAt: string | null;
};

const FILTERS = [
  "All",
  "Google",
  "TripAdvisor",
  "Ready to post",
  "Needs review",
];

const normalizeSource = (value?: string | null): ReviewSource => {
  if (!value) {
    return "TripAdvisor";
  }
  const lowered = value.toLowerCase();
  if (lowered.includes("google")) {
    return "Google";
  }
  if (lowered.includes("trip")) {
    return "TripAdvisor";
  }
  return "TripAdvisor";
};

const normalizeStatus = (value?: string | null): ReviewStatus => {
  switch (value) {
    case "posted":
    case "ready":
    case "auto-post":
    case "draft":
    case "needs-review":
      return value;
    default:
      return "draft";
  }
};

const formatDate = (value?: string | null) => {
  if (!value) {
    return "Unknown date";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const getExternalId = (item: ApiReviewItem) => {
  if (item.externalId) {
    return item.externalId;
  }
  if (!item.reviewId) {
    return "unknown";
  }
  const parts = item.reviewId.split("#");
  if (parts.length > 1) {
    return parts.slice(1).join("#");
  }
  return item.reviewId;
};

const mapReviewItem = (item: ApiReviewItem): ReviewItem => {
  const source = normalizeSource(item.source);
  const reviewedAt = item.reviewedAt ?? null;

  return {
    id: getExternalId(item),
    reviewKey: item.reviewId ?? null,
    source,
    author: item.authorName ?? "Guest",
    rating: typeof item.rating === "number" ? item.rating : null,
    date: formatDate(reviewedAt),
    review: item.review ?? null,
    reply: item.reply ?? null,
    status: normalizeStatus(item.status),
    link: item.link ?? null,
    reviewedAt,
  };
};

const matchesFilter = (review: ReviewItem, filter: string) => {
  switch (filter) {
    case "Google":
      return review.source === "Google";
    case "TripAdvisor":
      return review.source === "TripAdvisor";
    case "Ready to post":
      return review.status === "ready";
    case "Needs review":
      return review.status === "needs-review";
    default:
      return true;
  }
};

const matchesSearch = (review: ReviewItem, query: string) => {
  if (!query.trim()) {
    return true;
  }
  const lowered = query.toLowerCase();
  const haystack = [review.author, review.review ?? "", review.reply ?? ""]
    .join(" ")
    .toLowerCase();
  return haystack.includes(lowered);
};

export default function DashboardPage() {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadReviews = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await fetch("/api/reviews?limit=100", {
          signal: controller.signal,
        });
        const data = (await response.json()) as {
          items?: ApiReviewItem[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error || "Failed to load reviews");
        }

        if (isMounted) {
          const items = (data.items ?? []).map(mapReviewItem);
          setReviews(items);
        }
      } catch (error) {
        if (isMounted && !controller.signal.aborted) {
          setLoadError(
            error instanceof Error ? error.message : "Failed to load reviews"
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadReviews();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const stats = useMemo(() => {
    const now = Date.now();
    const newReviews = reviews.filter((review) => {
      if (!review.reviewedAt) {
        return false;
      }
      const reviewedAt = new Date(review.reviewedAt).getTime();
      if (Number.isNaN(reviewedAt)) {
        return false;
      }
      return now - reviewedAt < 24 * 60 * 60 * 1000;
    });

    const readyCount = reviews.filter(
      (review) => review.status === "ready"
    ).length;
    const autoPostCount = reviews.filter(
      (review) => review.status === "auto-post"
    ).length;

    const ratingValues = reviews
      .map((review) => review.rating)
      .filter((rating): rating is number => rating !== null);
    const averageRating =
      ratingValues.length > 0
        ? ratingValues.reduce((sum, value) => sum + value, 0) /
          ratingValues.length
        : 0;

    return [
      {
        label: "New reviews (24h)",
        value: String(newReviews.length),
        helper: "Based on synced timestamps",
      },
      {
        label: "Ready to post",
        value: String(readyCount),
        helper: "Awaiting approval",
      },
      {
        label: "Auto-post queue",
        value: String(autoPostCount),
        helper: "Next run tonight",
      },
      {
        label: "Average rating",
        value: averageRating ? averageRating.toFixed(1) : "0.0",
        helper: "All sources",
      },
    ];
  }, [reviews]);

  const filteredReviews = useMemo(() => {
    return reviews.filter(
      (review) =>
        matchesFilter(review, filter) && matchesSearch(review, query)
    );
  }, [filter, query, reviews]);

  const handleWorkflowReplyUpdate = (reviewKey: string | null, reply: string) => {
    if (!reviewKey) {
      return;
    }
    setReviews((prev) =>
      prev.map((review) => {
        if (review.reviewKey === reviewKey) {
          return { ...review, reply };
        }
        const fallbackKey = `${review.source}#${review.id}`;
        if (!review.reviewKey && fallbackKey === reviewKey) {
          return { ...review, reply };
        }
        return review;
      })
    );
  };

  const handleWorkflowStatusUpdate = (
    reviewKey: string | null,
    status: ReviewStatus
  ) => {
    if (!reviewKey) {
      return;
    }
    setReviews((prev) =>
      prev.map((review) => {
        if (review.reviewKey === reviewKey) {
          return { ...review, status };
        }
        const fallbackKey = `${review.source}#${review.id}`;
        if (!review.reviewKey && fallbackKey === reviewKey) {
          return { ...review, status };
        }
        return review;
      })
    );
  };

  return (
    <AppShell
      title="Dashboard"
      subtitle="Track daily review syncs, prep replies, and keep posting consistent across Google and TripAdvisor."
      actions={
        <>
          <button
            className="rounded-full border border-[var(--color-stroke)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-ink)] transition hover:-translate-y-[1px] hover:border-[var(--color-ink)]"
            type="button"
          >
            Sync now
          </button>
          <button
            className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-canvas)] transition hover:-translate-y-[1px] hover:bg-[var(--color-ink-strong)]"
            type="button"
          >
            Draft replies
          </button>
        </>
      }
    >
      <div className="grid gap-8">
        <section className="space-y-6">
          <ReviewWorkflow
            reviews={reviews}
            onReplyUpdate={handleWorkflowReplyUpdate}
            onStatusUpdate={handleWorkflowStatusUpdate}
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-3xl border border-[var(--color-stroke)] bg-white/70 p-5 shadow-[0_16px_32px_rgba(29,27,22,0.08)] backdrop-blur"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  {stat.label}
                </p>
                <p className="mt-3 font-display text-3xl text-[var(--color-ink)]">
                  {stat.value}
                </p>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  {stat.helper}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-3xl border border-[var(--color-stroke)] bg-white/70 p-4 shadow-[0_16px_32px_rgba(29,27,22,0.08)] backdrop-blur">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-2xl border border-[var(--color-stroke)] bg-white px-3 py-2 text-sm text-[var(--color-muted)]">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  Search
                </span>
                <input
                  className="w-full bg-transparent text-sm text-[var(--color-ink)] outline-none"
                  placeholder="Search by guest or keyword"
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {FILTERS.map((filterOption) => (
                  <button
                    key={filterOption}
                    className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] transition ${
                      filter === filterOption
                        ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-canvas)]"
                        : "border-[var(--color-stroke)] bg-white text-[var(--color-ink)] hover:border-[var(--color-ink)]"
                    }`}
                    onClick={() => setFilter(filterOption)}
                    type="button"
                  >
                    {filterOption}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            {isLoading ? (
              <div className="rounded-3xl border border-[var(--color-stroke)] bg-white/70 p-6 text-sm text-[var(--color-muted)]">
                Loading reviews...
              </div>
            ) : loadError ? (
              <div className="rounded-3xl border border-[var(--color-alert)]/40 bg-white/70 p-6 text-sm text-[var(--color-alert-strong)]">
                {loadError}
              </div>
            ) : filteredReviews.length === 0 ? (
              <div className="rounded-3xl border border-[var(--color-stroke)] bg-white/70 p-6 text-sm text-[var(--color-muted)]">
                No reviews match your filters yet.
              </div>
            ) : (
              filteredReviews.map((review) => (
                <ReviewCard
                  key={
                    review.reviewedAt
                      ? `${review.id}-${review.reviewedAt}`
                      : review.id
                  }
                  review={review}
                />
              ))
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

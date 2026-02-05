"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/app-shell";
import type { ReviewStatus, ReviewSource } from "../lib/types";
import { getI18n } from "../lib/i18n";

type ApiReviewItem = {
  reviewId?: string;
  externalId?: string;
  source?: string;
  reviewedAt?: string;
  status?: string;
  review?: string | null;
  reviewTranslated?: string | null;
  reply?: string | null;
  replyOriginal?: string | null;
  replyTranslated?: string | null;
  rating?: number | null;
  link?: string | null;
  authorName?: string | null;
};

type ReviewItem = {
  id: string;
  source: ReviewSource;
  status: ReviewStatus;
  rating: number | null;
  reviewedAt: string | null;
};

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

const getStoredLanguage = () => {
  return "English";
};

const mapReviewItem = (item: ApiReviewItem): ReviewItem => {
  const source = normalizeSource(item.source);
  const status = normalizeStatus(item.status);
  const reviewedAt = item.reviewedAt ?? null;
  const rating = typeof item.rating === "number" ? item.rating : null;
  const id = item.externalId ?? item.reviewId ?? "unknown";

  return { id, source, status, rating, reviewedAt };
};

export default function ReportsPage() {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [minLoading, setMinLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [preferredLanguage, setPreferredLanguage] = useState(getStoredLanguage);
  const i18n = useMemo(() => getI18n(preferredLanguage), [preferredLanguage]);
  const { t } = i18n;

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    let minTimer: number | undefined;

    const load = async () => {
      setIsLoading(true);
      setMinLoading(true);
      setLoadError(null);
      minTimer = window.setTimeout(() => {
        if (isMounted) {
          setMinLoading(false);
        }
      }, 1200);

      try {
        const collected: ReviewItem[] = [];
        let cursor: string | null = null;
        let pages = 0;

        while (pages < 3) {
          const response = await fetch(
            `/api/reviews?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
            { signal: controller.signal }
          );
          const data = (await response.json()) as {
            items?: ApiReviewItem[];
            nextCursor?: string | null;
            error?: string;
          };

          if (!response.ok) {
            throw new Error(data.error || "Failed to load reviews");
          }

          const items = (data.items ?? []).map(mapReviewItem);
          collected.push(...items);
          cursor = data.nextCursor ?? null;
          pages += 1;
          if (!cursor) {
            break;
          }
        }

        if (isMounted) {
          setReviews(collected);
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

    load();

    return () => {
      isMounted = false;
      controller.abort();
      if (minTimer) {
        window.clearTimeout(minTimer);
      }
    };
  }, [preferredLanguage]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const stored = window.localStorage.getItem("preferredLanguage");
    if (stored && stored.trim().length && stored !== preferredLanguage) {
      setPreferredLanguage(stored);
    }
  }, [preferredLanguage]);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadSettings = async () => {
      try {
        const response = await fetch("/api/settings", {
          signal: controller.signal,
        });
        const data = (await response.json()) as {
          settings?: { preferredLanguage?: string | null };
        };
        if (response.ok && isMounted && data.settings?.preferredLanguage) {
          setPreferredLanguage(data.settings.preferredLanguage);
          if (typeof window !== "undefined") {
            window.localStorage.setItem(
              "preferredLanguage",
              data.settings.preferredLanguage
            );
          }
        }
      } catch {
        // ignore
      }
    };

    loadSettings();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const metrics = useMemo(() => {
    if (reviews.length === 0) {
      return null;
    }
    const total = reviews.length;
    const posted = reviews.filter((review) => review.status === "posted").length;
    const needsReview = reviews.filter((review) => {
      if (review.status === "needs-review") {
        return true;
      }
      return review.rating !== null && review.rating <= 3;
    }).length;
    const ratingValues = reviews
      .map((review) => review.rating)
      .filter((rating): rating is number => rating !== null);
    const average =
      ratingValues.length > 0
        ? ratingValues.reduce((sum, value) => sum + value, 0) /
          ratingValues.length
        : 0;
    const googleCount = reviews.filter(
      (review) => review.source === "Google"
    ).length;
    const tripCount = reviews.filter(
      (review) => review.source === "TripAdvisor"
    ).length;
    const replyRate = total > 0 ? posted / total : 0;

    const now = Date.now();
    const recent = reviews.filter((review) => {
      if (!review.reviewedAt) {
        return false;
      }
      const reviewedAt = new Date(review.reviewedAt).getTime();
      if (Number.isNaN(reviewedAt)) {
        return false;
      }
      return now - reviewedAt < 30 * 24 * 60 * 60 * 1000;
    }).length;

    const ratings = [1, 2, 3, 4, 5].map((value) => ({
      value,
      count: reviews.filter((review) => Math.round(review.rating ?? 0) === value)
        .length,
    }));

    const statusCounts = [
      { key: "posted", count: posted },
      {
        key: "ready",
        count: reviews.filter((review) => review.status === "ready").length,
      },
      {
        key: "draft",
        count: reviews.filter((review) => review.status === "draft").length,
      },
      {
        key: "auto-post",
        count: reviews.filter((review) => review.status === "auto-post").length,
      },
      {
        key: "needs-review",
        count: reviews.filter((review) => review.status === "needs-review")
          .length,
      },
    ];

    return {
      total,
      posted,
      needsReview,
      average,
      replyRate,
      googleCount,
      tripCount,
      recent,
      ratings,
      statusCounts,
    };
  }, [reviews]);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "posted":
        return t("status_posted");
      case "ready":
        return t("status_ready");
      case "auto-post":
        return t("status_auto_post");
      case "draft":
        return t("status_draft");
      case "needs-review":
        return t("status_needs_review");
      default:
        return status;
    }
  };

  const renderBar = (value: number, total: number, color: string) => {
    const percent = total > 0 ? Math.round((value / total) * 100) : 0;
    return (
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 rounded-full bg-[var(--color-stroke)]">
          <div
            className="h-2 rounded-full"
            style={{ width: `${percent}%`, background: color }}
          />
        </div>
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">
          {percent}%
        </span>
      </div>
    );
  };

  return (
    <AppShell
      title={t("reports_title")}
      subtitle={t("reports_subtitle")}
      preferredLanguage={preferredLanguage}
    >
      <div className="grid gap-8">
        {isLoading || minLoading ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[0, 1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="rounded-3xl border border-[var(--color-stroke)] bg-white/80 p-5 shadow-[0_16px_32px_rgba(29,27,22,0.08)] backdrop-blur"
                >
                  <div className="h-3 w-24 rounded-full bg-[var(--color-stroke)] shimmer" />
                  <div className="mt-4 h-8 w-20 rounded-full bg-[var(--color-stroke)] shimmer" />
                  <div className="mt-3 h-4 w-32 rounded-full bg-[var(--color-stroke)] shimmer" />
                </div>
              ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
              <div className="rounded-3xl border border-[var(--color-stroke)] bg-white/80 p-6 shadow-[0_16px_32px_rgba(29,27,22,0.08)] backdrop-blur">
                <div className="flex items-center justify-between">
                  <div className="h-3 w-32 rounded-full bg-[var(--color-stroke)] shimmer" />
                  <div className="h-3 w-20 rounded-full bg-[var(--color-stroke)] shimmer" />
                </div>
                <div className="mt-5 space-y-4">
                  {[0, 1].map((row) => (
                    <div key={row} className="space-y-2">
                      <div className="h-3 w-24 rounded-full bg-[var(--color-stroke)] shimmer" />
                      <div className="h-2 w-full rounded-full bg-[var(--color-stroke)] shimmer" />
                    </div>
                  ))}
                </div>
                <div className="mt-5 rounded-2xl border border-[var(--color-stroke)] bg-[var(--color-soft)] p-4">
                  <div className="h-3 w-24 rounded-full bg-[var(--color-stroke)] shimmer" />
                  <div className="mt-3 h-8 w-16 rounded-full bg-[var(--color-stroke)] shimmer" />
                </div>
              </div>
              <div className="rounded-3xl border border-[var(--color-stroke)] bg-white/80 p-6 shadow-[0_16px_32px_rgba(29,27,22,0.08)] backdrop-blur">
                <div className="h-3 w-32 rounded-full bg-[var(--color-stroke)] shimmer" />
                <div className="mt-5 space-y-3">
                  {[0, 1, 2, 3].map((row) => (
                    <div key={row} className="space-y-2">
                      <div className="h-3 w-28 rounded-full bg-[var(--color-stroke)] shimmer" />
                      <div className="h-2 w-full rounded-full bg-[var(--color-stroke)] shimmer" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-[var(--color-stroke)] bg-white/80 p-6 shadow-[0_16px_32px_rgba(29,27,22,0.08)] backdrop-blur">
              <div className="h-3 w-40 rounded-full bg-[var(--color-stroke)] shimmer" />
              <div className="mt-4 space-y-3">
                {[0, 1, 2, 3, 4].map((row) => (
                  <div key={row} className="space-y-2">
                    <div className="h-3 w-16 rounded-full bg-[var(--color-stroke)] shimmer" />
                    <div className="h-2 w-full rounded-full bg-[var(--color-stroke)] shimmer" />
                  </div>
                ))}
              </div>
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
              {t("loading_reviews")}
            </p>
          </div>
        ) : loadError ? (
          <div className="rounded-3xl border border-[var(--color-alert)]/40 bg-white/70 p-6 text-sm text-[var(--color-alert-strong)]">
            {loadError}
          </div>
        ) : !metrics ? (
          <div className="rounded-3xl border border-[var(--color-stroke)] bg-white/70 p-6 text-sm text-[var(--color-muted)]">
            {t("reports_empty")}
          </div>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: t("metrics_total_reviews"),
                  value: metrics.total,
                  helper: t("metrics_recent_reviews_help"),
                },
                {
                  label: t("metrics_posted"),
                  value: metrics.posted,
                  helper: t("metrics_posted_help"),
                },
                {
                  label: t("metrics_needs_review"),
                  value: metrics.needsReview,
                  helper: t("metrics_needs_review_help"),
                },
                {
                  label: t("metrics_average_rating"),
                  value: metrics.average.toFixed(2),
                  helper: t("metrics_average_rating_help"),
                },
              ].map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-3xl border border-[var(--color-stroke)] bg-white/70 p-5 shadow-[0_16px_32px_rgba(29,27,22,0.08)] backdrop-blur"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                    {metric.label}
                  </p>
                  <p className="mt-3 font-display text-3xl text-[var(--color-ink)]">
                    {metric.value}
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">
                    {metric.helper}
                  </p>
                </div>
              ))}
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
              <div className="rounded-3xl border border-[var(--color-stroke)] bg-white/70 p-6 shadow-[0_16px_32px_rgba(29,27,22,0.08)] backdrop-blur">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                    {t("reports_source_breakdown")}
                  </p>
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                    {t("metrics_reply_rate")} {(metrics.replyRate * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="mt-5 space-y-4 text-sm text-[var(--color-ink)]">
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <span>{t("metrics_google_share")}</span>
                      <span>{metrics.googleCount}</span>
                    </div>
                    {renderBar(metrics.googleCount, metrics.total, "rgba(31,122,107,0.9)")}
                  </div>
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <span>{t("metrics_tripadvisor_share")}</span>
                      <span>{metrics.tripCount}</span>
                    </div>
                    {renderBar(metrics.tripCount, metrics.total, "rgba(212,106,74,0.9)")}
                  </div>
                </div>
                <div className="mt-5 rounded-2xl border border-[var(--color-stroke)] bg-[var(--color-soft)] p-4 text-sm text-[var(--color-muted)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                    {t("metrics_recent_reviews")}
                  </p>
                  <p className="mt-2 text-2xl font-display text-[var(--color-ink)]">
                    {metrics.recent}
                  </p>
                </div>
              </div>

              <div className="rounded-3xl border border-[var(--color-stroke)] bg-white/70 p-6 shadow-[0_16px_32px_rgba(29,27,22,0.08)] backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  {t("reports_status_breakdown")}
                </p>
                <div className="mt-5 space-y-3 text-sm text-[var(--color-ink)]">
                  {metrics.statusCounts.map((item) => (
                    <div key={item.key} className="grid gap-2">
                      <div className="flex items-center justify-between">
                        <span>{getStatusLabel(item.key)}</span>
                        <span>{item.count}</span>
                      </div>
                      {renderBar(item.count, metrics.total, "rgba(29,27,22,0.75)")}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-[var(--color-stroke)] bg-white/70 p-6 shadow-[0_16px_32px_rgba(29,27,22,0.08)] backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                {t("reports_rating_distribution")}
              </p>
              <div className="mt-4 grid gap-3">
                {metrics.ratings.map((item) => (
                  <div key={item.value} className="grid gap-2 text-sm text-[var(--color-ink)]">
                    <div className="flex items-center justify-between">
                      <span>{item.value} ★</span>
                      <span>{item.count}</span>
                    </div>
                    {renderBar(item.count, metrics.total, "rgba(212,106,74,0.9)")}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

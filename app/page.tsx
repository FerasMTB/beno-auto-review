"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "./components/app-shell";
import ReviewCard from "./components/review-card";
import ReviewWorkflow from "./components/review-workflow";
import type { Review, ReviewSource, ReviewStatus } from "./lib/types";
import { getI18n } from "./lib/i18n";

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

type ReviewItem = Review & {
  reviewedAt: string | null;
};

type PageState = {
  items: ReviewItem[];
  nextCursor: string | null;
};

const FILTERS = [
  { key: "all", labelKey: "filter_all" },
  { key: "google", labelKey: "filter_google" },
  { key: "tripadvisor", labelKey: "filter_tripadvisor" },
  { key: "ready", labelKey: "filter_ready" },
  { key: "needs", labelKey: "filter_needs" },
] as const;

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

const getDateLocale = (value: string) => {
  if (value === "ar") {
    return "ar";
  }
  if (value === "de") {
    return "de-DE";
  }
  if (value === "fr") {
    return "fr-FR";
  }
  if (value === "es") {
    return "es-ES";
  }
  return "en-US";
};

const formatDate = (value?: string | null, locale = "en") => {
  if (!value) {
    return "Unknown date";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString(getDateLocale(locale), {
    weekday: "short",
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

const mapReviewItem = (item: ApiReviewItem, locale: string): ReviewItem => {
  const source = normalizeSource(item.source);
  const reviewedAt = item.reviewedAt ?? null;

  return {
    id: getExternalId(item),
    reviewKey: item.reviewId ?? null,
    source,
    author: item.authorName ?? "Guest",
    rating: typeof item.rating === "number" ? item.rating : null,
    date: formatDate(reviewedAt, locale),
    review: item.review ?? null,
    reviewTranslated: item.reviewTranslated ?? null,
    reply: item.reply ?? null,
    replyOriginal: item.replyOriginal ?? null,
    replyTranslated: item.replyTranslated ?? null,
    status: normalizeStatus(item.status),
    link: item.link ?? null,
    reviewedAt,
  };
};

const matchesFilter = (review: ReviewItem, filter: string) => {
  switch (filter) {
    case "google":
      return review.source === "Google";
    case "tripadvisor":
      return review.source === "TripAdvisor";
    case "ready":
      return review.status === "ready";
    case "needs":
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
  const haystack = [
    review.author,
    review.review ?? "",
    review.reviewTranslated ?? "",
    review.reply ?? "",
    review.replyOriginal ?? "",
    review.replyTranslated ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(lowered);
};

const getStoredLanguage = () => {
  return "English";
};

export default function DashboardPage() {
  const [pages, setPages] = useState<PageState[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [minLoading, setMinLoading] = useState(true);
  const [minListLoading, setMinListLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState(getStoredLanguage);
  const { t } = getI18n(preferredLanguage);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    let minTimer: number | undefined;
    let listTimer: number | undefined;

    const loadReviews = async () => {
      setIsLoading(true);
      setLoadError(null);
      setMinLoading(true);
      setMinListLoading(true);
      minTimer = window.setTimeout(() => {
        if (isMounted) {
          setMinLoading(false);
        }
      }, 3000);
      listTimer = window.setTimeout(() => {
        if (isMounted) {
          setMinListLoading(false);
        }
      }, 2000);

      try {
        const response = await fetch("/api/reviews?limit=25", {
          signal: controller.signal,
        });
        const data = (await response.json()) as {
          items?: ApiReviewItem[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error || t("failed_load_reviews"));
        }

        if (isMounted) {
          const items = (data.items ?? []).map((item) =>
            mapReviewItem(item, getI18n(preferredLanguage).locale)
          );
          setPages([{ items, nextCursor: data.nextCursor ?? null }]);
          setPageIndex(0);
        }
      } catch (error) {
        if (isMounted && !controller.signal.aborted) {
          setLoadError(
            error instanceof Error ? error.message : t("failed_load_reviews")
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
      if (minTimer) {
        window.clearTimeout(minTimer);
      }
      if (listTimer) {
        window.clearTimeout(listTimer);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const stored = window.localStorage.getItem("preferredLanguage");
    if (stored && stored.trim().length && stored !== preferredLanguage) {
      setPreferredLanguage(stored);
    }
  }, [preferredLanguage]);

  const currentPage = pages[pageIndex]?.items ?? [];
  const currentNextCursor = pages[pageIndex]?.nextCursor ?? null;
  const canPrev = pageIndex > 0;
  const canNext = Boolean(currentNextCursor);

  const goNext = async () => {
    if (!canNext) {
      return;
    }
    if (pages[pageIndex + 1]) {
      setPageIndex((prev) => prev + 1);
      return;
    }
    setListLoading(true);
    try {
      const response = await fetch(
        `/api/reviews?limit=25&cursor=${encodeURIComponent(
          currentNextCursor ?? ""
        )}`
      );
      const data = (await response.json()) as {
        items?: ApiReviewItem[];
        nextCursor?: string | null;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || t("failed_load_reviews"));
      }
      const items = (data.items ?? []).map((item) =>
        mapReviewItem(item, getI18n(preferredLanguage).locale)
      );
      setPages((prev) => [
        ...prev,
        { items, nextCursor: data.nextCursor ?? null },
      ]);
      setPageIndex((prev) => prev + 1);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : t("failed_load_reviews")
      );
    } finally {
      setListLoading(false);
    }
  };

  const goPrev = () => {
    if (!canPrev) {
      return;
    }
    setPageIndex((prev) => Math.max(prev - 1, 0));
  };

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
        // Settings are optional for display direction.
      }
    };

    loadSettings();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const dateLocale = getI18n(preferredLanguage).locale;
  const formattedPage = useMemo(
    () =>
      currentPage.map((review) => ({
        ...review,
        date: formatDate(review.reviewedAt, dateLocale),
      })),
    [currentPage, dateLocale]
  );

  const filteredReviews = useMemo(() => {
    return formattedPage.filter(
      (review) =>
        matchesFilter(review, filter) && matchesSearch(review, query)
    );
  }, [filter, query, formattedPage]);

  const handleWorkflowReplyUpdate = (
    reviewKey: string | null,
    reply: string,
    replyOriginal?: string | null,
    replyTranslated?: string | null,
    reviewTranslated?: string | null
  ) => {
    if (!reviewKey) {
      return;
    }
    setPages((prev) =>
      prev.map((page, index) => {
        if (index !== pageIndex) {
          return page;
        }
        return {
          ...page,
          items: page.items.map((review) => {
            if (review.reviewKey === reviewKey) {
              return {
                ...review,
                reply,
                replyOriginal: replyOriginal ?? review.replyOriginal ?? null,
                replyTranslated: replyTranslated ?? review.replyTranslated ?? null,
                reviewTranslated: reviewTranslated ?? review.reviewTranslated ?? null,
              };
            }
            const fallbackKey = `${review.source}#${review.id}`;
            if (!review.reviewKey && fallbackKey === reviewKey) {
              return {
                ...review,
                reply,
                replyOriginal: replyOriginal ?? review.replyOriginal ?? null,
                replyTranslated: replyTranslated ?? review.replyTranslated ?? null,
                reviewTranslated: reviewTranslated ?? review.reviewTranslated ?? null,
              };
            }
            return review;
          }),
        };
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
    setPages((prev) =>
      prev.map((page, index) => {
        if (index !== pageIndex) {
          return page;
        }
        return {
          ...page,
          items: page.items.map((review) => {
            if (review.reviewKey === reviewKey) {
              return { ...review, status };
            }
            const fallbackKey = `${review.source}#${review.id}`;
            if (!review.reviewKey && fallbackKey === reviewKey) {
              return { ...review, status };
            }
            return review;
          }),
        };
      })
    );
  };

  return (
    <AppShell
      title={t("dashboard_title")}
      subtitle={t("dashboard_subtitle")}
      preferredLanguage={preferredLanguage}
      actions={
        <button
          className="rounded-full border border-[var(--color-stroke)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-muted)] transition disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          disabled
        >
          {t("dashboard_sync_now")}
        </button>
      }
    >
      <div className="grid gap-8">
        <section className="space-y-6">
          <ReviewWorkflow
            reviews={formattedPage}
            preferredLanguage={preferredLanguage}
            isLoading={isLoading || minLoading}
            onReplyUpdate={handleWorkflowReplyUpdate}
            onStatusUpdate={handleWorkflowStatusUpdate}
          />
          <div className="rounded-3xl border border-[var(--color-stroke)] bg-white/70 p-4 shadow-[0_16px_32px_rgba(29,27,22,0.08)] backdrop-blur">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-2xl border border-[var(--color-stroke)] bg-white px-3 py-2 text-sm text-[var(--color-muted)]">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  {t("dashboard_search_label")}
                </span>
                <input
                  className="w-full bg-transparent text-sm text-[var(--color-ink)] outline-none"
                  placeholder={t("dashboard_search_placeholder")}
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {FILTERS.map((filterOption) => (
                  <button
                    key={filterOption.key}
                    className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] transition ${
                      filter === filterOption.key
                        ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-canvas)]"
                        : "border-[var(--color-stroke)] bg-white text-[var(--color-ink)] hover:border-[var(--color-ink)]"
                    }`}
                    onClick={() => setFilter(filterOption.key)}
                    type="button"
                  >
                    {t(filterOption.labelKey)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            {isLoading || minListLoading || listLoading ? (
              <div className="space-y-5">
                {[0, 1, 2].map((item) => (
                  <div
                    key={item}
                    className="rounded-3xl border border-[var(--color-stroke)] bg-white/75 p-6 shadow-[0_18px_40px_rgba(29,27,22,0.08)] backdrop-blur"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          <div className="h-5 w-20 rounded-full bg-[var(--color-stroke)] shimmer" />
                          <div className="h-4 w-24 rounded-full bg-[var(--color-stroke)] shimmer" />
                          <div className="h-4 w-20 rounded-full bg-[var(--color-stroke)] shimmer" />
                        </div>
                        <div className="h-5 w-40 rounded-full bg-[var(--color-stroke)] shimmer" />
                      </div>
                      <div className="h-6 w-24 rounded-full bg-[var(--color-stroke)] shimmer" />
                    </div>
                    <div className="mt-5 space-y-3">
                      <div className="h-4 w-full rounded-full bg-[var(--color-stroke)] shimmer" />
                      <div className="h-4 w-11/12 rounded-full bg-[var(--color-stroke)] shimmer" />
                    </div>
                    <div className="mt-5 rounded-2xl border border-[var(--color-stroke)] bg-[var(--color-soft)] p-4">
                      <div className="h-3 w-28 rounded-full bg-[var(--color-stroke)] shimmer" />
                      <div className="mt-3 h-4 w-full rounded-full bg-[var(--color-stroke)] shimmer" />
                      <div className="mt-2 h-4 w-10/12 rounded-full bg-[var(--color-stroke)] shimmer" />
                    </div>
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                      <div className="h-4 w-24 rounded-full bg-[var(--color-stroke)] shimmer" />
                      <div className="flex gap-2">
                        <div className="h-9 w-28 rounded-full bg-[var(--color-stroke)] shimmer" />
                        <div className="h-9 w-28 rounded-full bg-[var(--color-stroke)] shimmer" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : loadError ? (
              <div className="rounded-3xl border border-[var(--color-alert)]/40 bg-white/70 p-6 text-sm text-[var(--color-alert-strong)]">
                {loadError}
              </div>
            ) : filteredReviews.length === 0 ? (
              <div className="rounded-3xl border border-[var(--color-stroke)] bg-white/70 p-6 text-sm text-[var(--color-muted)]">
                {t("no_reviews_match")}
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
                  preferredLanguage={preferredLanguage}
                  onStatusUpdate={handleWorkflowStatusUpdate}
                />
              ))
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <button
              className="rounded-full border border-[var(--color-stroke)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-ink)] transition hover:-translate-y-[1px] hover:border-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={goPrev}
              disabled={!canPrev || listLoading}
            >
              {t("pagination_previous")}
            </button>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
              {t("pagination_page")} {pageIndex + 1}
            </span>
            <button
              className="rounded-full border border-[var(--color-stroke)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-ink)] transition hover:-translate-y-[1px] hover:border-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={goNext}
              disabled={!canNext || listLoading}
            >
              {t("pagination_next")}
            </button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

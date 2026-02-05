"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Review, ReviewSource, ReviewStatus } from "../lib/types";
import StatusPill from "./status-pill";
import { getI18n } from "../lib/i18n";

const sourceStyles: Record<ReviewSource, string> = {
  Google: "bg-[var(--color-accent-cool)]/15 text-[var(--color-accent-cool-strong)]",
  TripAdvisor: "bg-[var(--color-accent)]/15 text-[var(--color-accent-strong)]",
};

type ReviewCardProps = {
  review: Review;
  preferredLanguage?: string;
  onStatusUpdate?: (reviewKey: string | null, status: ReviewStatus) => void;
};

export default function ReviewCard({
  review,
  preferredLanguage,
  onStatusUpdate,
}: ReviewCardProps) {
  const { t, dir } = getI18n(preferredLanguage);
  const [draftReply, setDraftReply] = useState<string | null>(
    review.reply ?? null
  );
  const [draftReviewTranslated, setDraftReviewTranslated] =
    useState<string | null>(review.reviewTranslated ?? null);
  const [draftReplyOriginal, setDraftReplyOriginal] = useState<string | null>(
    review.replyOriginal ?? null
  );
  const [draftReplyTranslated, setDraftReplyTranslated] =
    useState<string | null>(review.replyTranslated ?? null);
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [postMessage, setPostMessage] = useState<string | null>(null);
  const [isPosted, setIsPosted] = useState(review.status === "posted");
  const [isMarkingPosted, setIsMarkingPosted] = useState(false);

  const renderStars = (rating: number | null) => {
    const safeRating = rating ?? 0;
    const filled = Math.max(0, Math.min(5, Math.round(safeRating)));
    return (
      <div className="flex items-center gap-1 text-base">
        {Array.from({ length: 5 }).map((_, idx) => (
          <span
            key={idx}
            className={
              idx < filled
                ? "text-[var(--color-accent-strong)]"
                : "text-[var(--color-muted)]/40"
            }
            aria-hidden="true"
          >
            ★
          </span>
        ))}
      </div>
    );
  };

  useEffect(() => {
    setIsPosted(review.status === "posted");
  }, [review.status]);

  useEffect(() => {
    setDraftReply(review.reply ?? null);
    setDraftReviewTranslated(review.reviewTranslated ?? null);
    setDraftReplyOriginal(review.replyOriginal ?? null);
    setDraftReplyTranslated(review.replyTranslated ?? null);
  }, [
    review.reply,
    review.reviewTranslated,
    review.replyOriginal,
    review.replyTranslated,
  ]);

  const showPostMessage = (message: string) => {
    setPostMessage(message);
    window.setTimeout(() => {
      setPostMessage(null);
    }, 2000);
  };

  const handleDraftReply = async () => {
    setIsDrafting(true);
    setDraftError(null);

    try {
      const response = await fetch("/api/reviews/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          review: {
            reviewId: review.reviewKey ?? review.id,
            reviewOrigin: review.source,
            source: review.source,
            authorName: review.author,
            rating: review.rating,
            review: review.review,
            link: review.link,
          },
        }),
      });

      const data = (await response.json()) as {
        reply?: string;
        replyOriginal?: string | null;
        replyTranslated?: string | null;
        reviewTranslated?: string | null;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || t("failed_draft_reply"));
      }

      if (data.reply) {
        setDraftReply(data.reply);
        setDraftReviewTranslated(data.reviewTranslated ?? null);
        setDraftReplyOriginal(data.replyOriginal ?? null);
        setDraftReplyTranslated(data.replyTranslated ?? null);
      }
    } catch (error) {
      setDraftError(
        error instanceof Error ? error.message : t("failed_draft_reply")
      );
    } finally {
      setIsDrafting(false);
    }
  };

  const handlePostReply = async () => {
    const reply = draftReply?.trim();

    if (!reply) {
      setPostError(t("no_reply_to_send"));
      return;
    }

    if (review.source !== "Google") {
      setPostError(t("only_google_post"));
      return;
    }

    setIsPosting(true);
    setPostError(null);
    setPostMessage(null);

    try {
      const response = await fetch("/api/reviews/google/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewId: review.id,
          reviewKey: review.reviewKey,
          reply,
          source: review.source,
        }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || t("failed_send_reply"));
      }

      setIsPosted(true);
      showPostMessage(t("reply_sent"));
    } catch (error) {
      setPostError(
        error instanceof Error ? error.message : t("failed_send_reply")
      );
    } finally {
      setIsPosting(false);
    }
  };

  const handleMarkPosted = async () => {
    if (review.source === "Google") {
      return;
    }
    setIsMarkingPosted(true);
    setPostError(null);
    setPostMessage(null);

    try {
      const response = await fetch("/api/reviews/mark-posted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewId: review.id,
          reviewKey: review.reviewKey,
          reply: draftReply ?? "",
          source: review.source,
        }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || t("failed_send_reply"));
      }

      setIsPosted(true);
      const updateKey = review.reviewKey ?? `${review.source}#${review.id}`;
      onStatusUpdate?.(updateKey, "posted");
      showPostMessage(t("marked_posted"));
    } catch (error) {
      setPostError(
        error instanceof Error ? error.message : t("failed_send_reply")
      );
    } finally {
      setIsMarkingPosted(false);
    }
  };

  return (
    <article className="rounded-3xl border border-[var(--color-stroke)] bg-white/75 p-6 shadow-[0_18px_40px_rgba(29,27,22,0.08)] backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] ${sourceStyles[review.source]}`}
            >
              {review.source}
            </span>
            <span className="text-[var(--color-muted)]">{review.date}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--color-muted)]">
            {renderStars(review.rating)}
            <span>
              {review.rating !== null ? review.rating.toFixed(1) : t("na")}{" "}
              {t("rating_label")}
            </span>
          </div>
          <div className="text-lg font-semibold text-[var(--color-ink)]">
            {review.author}
          </div>
        </div>
        <StatusPill status={review.status} preferredLanguage={preferredLanguage} />
      </div>

      <p className="mt-4 text-base leading-7 text-[var(--color-ink)]" dir={dir}>
        {review.review
          ? `"${review.review}"`
          : t("no_review_text")}
      </p>
      {draftReviewTranslated ? (
        <p className="mt-3 text-base leading-7 text-[var(--color-ink)]" dir={dir}>
          {`"${draftReviewTranslated}"`}
        </p>
      ) : null}

      <div className="mt-5 rounded-2xl border border-[var(--color-stroke)] bg-[var(--color-soft)] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
          {isPosted ? t("reply_posted") : t("draft_reply")}
        </p>
        <p className="mt-2 text-sm leading-6 text-[var(--color-ink)]" dir={dir}>
          {draftReply ?? t("no_reply_drafted")}
        </p>
        {draftReplyOriginal && draftReplyOriginal !== draftReply ? (
          <div className="mt-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
              {t("original_reply")}
            </p>
            <p className="mt-1 text-sm leading-6 text-[var(--color-ink)]" dir={dir}>
              {draftReplyOriginal}
            </p>
          </div>
        ) : null}
        {draftReplyTranslated && draftReplyTranslated !== draftReply ? (
          <div className="mt-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
              {t("translated_reply")}
            </p>
            <p className="mt-1 text-sm leading-6 text-[var(--color-ink)]" dir={dir}>
              {draftReplyTranslated}
            </p>
          </div>
        ) : null}
        {draftError ? (
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-alert-strong)]">
            {draftError}
          </p>
        ) : null}
        {postError ? (
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-alert-strong)]">
            {postError}
          </p>
        ) : null}
        {postMessage ? (
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-accent-strong)]">
            {postMessage}
          </p>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        {review.source !== "Google" ? (
          review.link ? (
            <Link
              href={review.link}
              className="text-sm font-semibold text-[var(--color-accent-strong)] underline-offset-4 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              {t("open_review")}
            </Link>
          ) : (
            <span className="text-sm text-[var(--color-muted)]">
              {t("no_review_link")}
            </span>
          )
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-full border border-[var(--color-stroke)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-ink)] transition hover:-translate-y-[1px] hover:border-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleDraftReply}
            disabled={isDrafting || isPosted}
            type="button"
          >
            {isDrafting
              ? t("drafting")
              : isPosted
                ? t("reply_posted")
                : t("draft_with_ai_button")}
          </button>
          {isPosted ? null : review.source === "Google" ? (
            <button
              className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-canvas)] transition hover:-translate-y-[1px] hover:bg-[var(--color-ink-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              onClick={handlePostReply}
              disabled={isPosting || !draftReply || review.source !== "Google"}
              type="button"
            >
              {isPosting ? t("sending") : t("send_reply_button")}
            </button>
          ) : (
            <button
              className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-canvas)] transition hover:-translate-y-[1px] hover:bg-[var(--color-ink-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              onClick={handleMarkPosted}
              disabled={isMarkingPosted}
              type="button"
            >
              {isMarkingPosted ? t("marking_posted") : t("mark_posted")}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

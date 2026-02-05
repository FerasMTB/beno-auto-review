"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Review, ReviewSource } from "../lib/types";
import StatusPill from "./status-pill";

const sourceStyles: Record<ReviewSource, string> = {
  Google: "bg-[var(--color-accent-cool)]/15 text-[var(--color-accent-cool-strong)]",
  TripAdvisor: "bg-[var(--color-accent)]/15 text-[var(--color-accent-strong)]",
};

type ReviewCardProps = {
  review: Review;
};

export default function ReviewCard({ review }: ReviewCardProps) {
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
        throw new Error(data.error || "Failed to draft reply");
      }

      if (data.reply) {
        setDraftReply(data.reply);
        setDraftReviewTranslated(data.reviewTranslated ?? null);
        setDraftReplyOriginal(data.replyOriginal ?? null);
        setDraftReplyTranslated(data.replyTranslated ?? null);
      }
    } catch (error) {
      setDraftError(
        error instanceof Error ? error.message : "Failed to draft reply"
      );
    } finally {
      setIsDrafting(false);
    }
  };

  const handlePostReply = async () => {
    const reply = draftReply?.trim();

    if (!reply) {
      setPostError("No reply to post");
      return;
    }

    if (review.source !== "Google") {
      setPostError("Only Google reviews can be posted");
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
        throw new Error(data.error || "Failed to send reply");
      }

      setIsPosted(true);
      showPostMessage("Reply sent");
    } catch (error) {
      setPostError(
        error instanceof Error ? error.message : "Failed to send reply"
      );
    } finally {
      setIsPosting(false);
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
            <span className="text-[var(--color-muted)]">
              {review.rating !== null ? review.rating.toFixed(1) : "N/A"} rating
            </span>
            <span className="text-[var(--color-muted)]">{review.date}</span>
          </div>
          <div className="text-lg font-semibold text-[var(--color-ink)]">
            {review.author}
          </div>
        </div>
        <StatusPill status={review.status} />
      </div>

      <p className="mt-4 text-base leading-7 text-[var(--color-ink)]">
        {review.review
          ? `"${review.review}"`
          : "No review text was provided."}
      </p>
      {draftReviewTranslated ? (
        <p className="mt-3 text-base leading-7 text-[var(--color-ink)]">
          {`"${draftReviewTranslated}"`}
        </p>
      ) : null}

      <div className="mt-5 rounded-2xl border border-[var(--color-stroke)] bg-[var(--color-soft)] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
          {isPosted ? "Reply posted" : "Draft reply"}
        </p>
        <p className="mt-2 text-sm leading-6 text-[var(--color-ink)]">
          {draftReply ?? "No reply drafted yet."}
        </p>
        {draftReplyOriginal && draftReplyOriginal !== draftReply ? (
          <div className="mt-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
              Original reply
            </p>
            <p className="mt-1 text-sm leading-6 text-[var(--color-ink)]">
              {draftReplyOriginal}
            </p>
          </div>
        ) : null}
        {draftReplyTranslated && draftReplyTranslated !== draftReply ? (
          <div className="mt-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
              Translated reply
            </p>
            <p className="mt-1 text-sm leading-6 text-[var(--color-ink)]">
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
        {review.link ? (
          <Link
            href={review.link}
            className="text-sm font-semibold text-[var(--color-accent-strong)] underline-offset-4 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            Open review
          </Link>
        ) : (
          <span className="text-sm text-[var(--color-muted)]">
            No review link
          </span>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-full border border-[var(--color-stroke)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-ink)] transition hover:-translate-y-[1px] hover:border-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleDraftReply}
            disabled={isDrafting || isPosted}
            type="button"
          >
            {isDrafting ? "Drafting..." : isPosted ? "Reply posted" : "Draft with AI"}
          </button>
          {isPosted ? null : (
            <button
              className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-canvas)] transition hover:-translate-y-[1px] hover:bg-[var(--color-ink-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              onClick={handlePostReply}
              disabled={isPosting || !draftReply || review.source !== "Google"}
              type="button"
            >
              {isPosting ? "Sending..." : "Send reply"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

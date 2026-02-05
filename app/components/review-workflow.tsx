"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import StatusPill from "./status-pill";
import type { Review, ReviewStatus } from "../lib/types";

type ReviewWorkflowProps = {
  reviews: Review[];
  onReplyUpdate?: (
    reviewKey: string | null,
    reply: string,
    replyOriginal?: string | null,
    replyTranslated?: string | null,
    reviewTranslated?: string | null
  ) => void;
  onStatusUpdate?: (reviewKey: string | null, status: ReviewStatus) => void;
};

const isTypingTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
};

export default function ReviewWorkflow({
  reviews,
  onReplyUpdate,
  onStatusUpdate,
}: ReviewWorkflowProps) {
  const needsReview = useMemo(
    () => reviews.filter((review) => review.status === "needs-review"),
    [reviews]
  );
  const [index, setIndex] = useState(0);
  const [draftReply, setDraftReply] = useState<string | null>(null);
  const [draftReplyOriginal, setDraftReplyOriginal] = useState<string | null>(null);
  const [draftReplyTranslated, setDraftReplyTranslated] =
    useState<string | null>(null);
  const [draftReviewTranslated, setDraftReviewTranslated] =
    useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [postError, setPostError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isDrafting, setIsDrafting] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [isPosted, setIsPosted] = useState(false);

  const current = needsReview[index] ?? null;

  useEffect(() => {
    if (index >= needsReview.length) {
      setIndex(0);
    }
  }, [index, needsReview.length]);

  useEffect(() => {
    setDraftReply(current?.reply ?? null);
    setDraftReplyOriginal(current?.replyOriginal ?? null);
    setDraftReplyTranslated(current?.replyTranslated ?? null);
    setDraftReviewTranslated(current?.reviewTranslated ?? null);
    setIsPosted(current?.status === "posted");
  }, [
    current?.reply,
    current?.replyOriginal,
    current?.replyTranslated,
    current?.reviewTranslated,
    current?.id,
    current?.status,
  ]);

  const showMessage = useCallback((message: string) => {
    setActionMessage(message);
    window.setTimeout(() => setActionMessage(null), 2000);
  }, []);

  const moveNext = useCallback(() => {
    if (needsReview.length === 0) {
      return;
    }
    setIndex((prev) => (prev + 1) % needsReview.length);
  }, [needsReview.length]);

  const movePrev = useCallback(() => {
    if (needsReview.length === 0) {
      return;
    }
    setIndex((prev) =>
      prev === 0 ? needsReview.length - 1 : prev - 1
    );
  }, [needsReview.length]);

  const handleCopy = useCallback(async () => {
    if (!draftReply) {
      showMessage("No reply to copy");
      return;
    }
    try {
      await navigator.clipboard.writeText(draftReply);
      showMessage("Reply copied");
    } catch {
      showMessage("Copy failed");
    }
  }, [draftReply, showMessage]);

  const handleOpen = useCallback(() => {
    if (!current?.link) {
      showMessage("No review link");
      return;
    }
    window.open(current.link, "_blank", "noopener,noreferrer");
  }, [current, showMessage]);

  const handleOpenWithCopy = useCallback(() => {
    if (!current?.link) {
      showMessage("No review link");
      return;
    }

    if (!draftReply) {
      showMessage("No reply to copy");
      window.open(current.link, "_blank", "noopener,noreferrer");
      return;
    }

    navigator.clipboard
      .writeText(draftReply)
      .then(() => showMessage("Reply copied"))
      .catch(() => showMessage("Copy failed"));

    window.open(current.link, "_blank", "noopener,noreferrer");
  }, [current, draftReply, showMessage]);

  const handleDraft = useCallback(async () => {
    if (!current) {
      return;
    }
    setIsDrafting(true);
    setDraftError(null);
    setPostError(null);
    try {
      const response = await fetch("/api/reviews/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          review: {
            reviewId: current.reviewKey ?? current.id,
            reviewOrigin: current.source,
            source: current.source,
            authorName: current.author,
            rating: current.rating,
            review: current.review,
            link: current.link,
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
        const updateKey =
          current.reviewKey ?? `${current.source}#${current.id}`;
        setDraftReply(data.reply);
        setDraftReplyOriginal(data.replyOriginal ?? null);
        setDraftReplyTranslated(data.replyTranslated ?? null);
        setDraftReviewTranslated(data.reviewTranslated ?? null);
        onReplyUpdate?.(
          updateKey,
          data.reply,
          data.replyOriginal ?? null,
          data.replyTranslated ?? null,
          data.reviewTranslated ?? null
        );
        showMessage("Reply drafted");
      }
    } catch (error) {
      setDraftError(
        error instanceof Error ? error.message : "Failed to draft reply"
      );
    } finally {
      setIsDrafting(false);
    }
  }, [current, onReplyUpdate, showMessage]);

  const handleSend = useCallback(async () => {
    if (!current) {
      return;
    }

    if (current.source !== "Google") {
      return;
    }

    const reply = draftReply?.trim();
    if (!reply) {
      showMessage("No reply to send");
      return;
    }

    setIsPosting(true);
    setPostError(null);

    try {
      const response = await fetch("/api/reviews/google/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewId: current.id,
          reviewKey: current.reviewKey,
          reply,
          source: current.source,
        }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Failed to send reply");
      }

      const updateKey = current.reviewKey ?? `${current.source}#${current.id}`;
      onStatusUpdate?.(updateKey, "posted");
      setIsPosted(true);
      showMessage("Reply sent");
    } catch (error) {
      setPostError(
        error instanceof Error ? error.message : "Failed to send reply"
      );
    } finally {
      setIsPosting(false);
    }
  }, [current, draftReply, onStatusUpdate, showMessage]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) {
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        moveNext();
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        movePrev();
      }
      if (event.key === "c" || event.key === "C") {
        event.preventDefault();
        void handleCopy();
      }
      if (event.key === "o" || event.key === "O") {
        event.preventDefault();
        void handleOpenWithCopy();
      }
      if (event.key === "d" || event.key === "D") {
        event.preventDefault();
        void handleDraft();
      }
      if (event.key === "s" || event.key === "S") {
        event.preventDefault();
        void handleSend();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    handleCopy,
    handleDraft,
    handleOpen,
    handleOpenWithCopy,
    handleSend,
    moveNext,
    movePrev,
  ]);

  if (needsReview.length === 0) {
    return (
      <div className="rounded-3xl border border-[var(--color-stroke)] bg-white/70 p-6 text-sm text-[var(--color-muted)] shadow-[0_16px_32px_rgba(29,27,22,0.08)] backdrop-blur">
        No reviews are waiting for manual review.
      </div>
    );
  }

  if (!current) {
    return null;
  }

  return (
    <section className="rounded-3xl border border-[var(--color-ink)]/10 bg-white/80 p-6 shadow-[0_24px_40px_rgba(29,27,22,0.12)] backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
            Needs review
          </p>
          <h2 className="mt-2 font-display text-2xl text-[var(--color-ink)]">
            {current.author}
          </h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            {current.source} • {current.date} •{" "}
            {current.rating !== null ? current.rating.toFixed(1) : "N/A"} rating
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusPill status={current.status} />
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
            {index + 1} / {needsReview.length}
          </span>
        </div>
      </div>

      <p className="mt-4 text-base leading-7 text-[var(--color-ink)]">
        {current.review
          ? `"${current.review}"`
          : "No review text was provided."}
      </p>
      {draftReviewTranslated ? (
        <p className="mt-3 text-base leading-7 text-[var(--color-ink)]">
          {`"${draftReviewTranslated}"`}
        </p>
      ) : null}

      <div className="mt-5 rounded-2xl border border-[var(--color-stroke)] bg-[var(--color-soft)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
            Suggested reply
          </p>
          {actionMessage ? (
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-accent-strong)]">
              {actionMessage}
            </span>
          ) : null}
        </div>
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
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-full border border-[var(--color-stroke)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-ink)] transition hover:-translate-y-[1px] hover:border-[var(--color-ink)]"
            type="button"
            onClick={movePrev}
          >
            Previous (←)
          </button>
          <button
            className="rounded-full border border-[var(--color-stroke)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-ink)] transition hover:-translate-y-[1px] hover:border-[var(--color-ink)]"
            type="button"
            onClick={moveNext}
          >
            Next (→)
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-full border border-[var(--color-stroke)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-ink)] transition hover:-translate-y-[1px] hover:border-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            onClick={handleDraft}
            disabled={isDrafting}
          >
            {isDrafting ? "Drafting..." : "Draft with AI (D)"}
          </button>
          {current.source === "Google" ? (
            <button
              className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-canvas)] transition hover:-translate-y-[1px] hover:bg-[var(--color-ink-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={() => void handleSend()}
              disabled={isPosting || !draftReply || isPosted}
            >
              {isPosting ? "Sending..." : isPosted ? "Reply sent" : "Send reply (S)"}
            </button>
          ) : null}
          <button
            className="rounded-full border border-[var(--color-stroke)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-ink)] transition hover:-translate-y-[1px] hover:border-[var(--color-ink)]"
            type="button"
            onClick={() => void handleCopy()}
          >
            Copy reply (C)
          </button>
          {current.link ? (
            <Link
              href={current.link}
              className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-canvas)] transition hover:-translate-y-[1px] hover:bg-[var(--color-ink-strong)]"
              target="_blank"
              rel="noreferrer"
            >
              Open review (O)
            </Link>
          ) : (
            <button
              className="rounded-full border border-[var(--color-stroke)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-muted)]"
              type="button"
              onClick={handleOpen}
            >
              No review link
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

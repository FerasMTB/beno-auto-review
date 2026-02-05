"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import StatusPill from "./status-pill";
import type { Review, ReviewStatus } from "../lib/types";
import { getI18n } from "../lib/i18n";

type ReviewWorkflowProps = {
  reviews: Review[];
  preferredLanguage?: string;
  isLoading?: boolean;
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
  preferredLanguage,
  isLoading = false,
  onReplyUpdate,
  onStatusUpdate,
}: ReviewWorkflowProps) {
  const needsReview = useMemo(
    () =>
      reviews.filter((review) => {
        if (review.status === "needs-review") {
          return true;
        }
        if (review.status === "posted") {
          return false;
        }
        return review.rating !== null && review.rating <= 3;
      }),
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
  const [isMarkingPosted, setIsMarkingPosted] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);
  const [isChangeOpen, setIsChangeOpen] = useState(false);
  const [changeRequest, setChangeRequest] = useState("");
  const [isChanging, setIsChanging] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);

  const current = needsReview[index] ?? null;
  const { t, dir } = getI18n(preferredLanguage);

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

  const replyForActions = draftReplyOriginal ?? draftReply ?? null;

  const handleCopy = useCallback(async () => {
    if (!replyForActions) {
      showMessage(t("no_reply_to_copy"));
      return;
    }
    try {
      await navigator.clipboard.writeText(replyForActions);
      showMessage(t("reply_copied"));
    } catch {
      showMessage(t("copy_failed"));
    }
  }, [replyForActions, showMessage, t]);

  const handleOpenWithCopy = useCallback(() => {
    if (current?.source === "Google") {
      return;
    }
    if (!current?.link) {
      showMessage(t("no_review_link"));
      return;
    }

    if (!replyForActions) {
      showMessage(t("no_reply_to_copy"));
      window.open(current.link, "_blank", "noopener,noreferrer");
      return;
    }

    navigator.clipboard
      .writeText(replyForActions)
      .then(() => showMessage(t("reply_copied")))
      .catch(() => showMessage(t("copy_failed")));

    window.open(current.link, "_blank", "noopener,noreferrer");
  }, [current, replyForActions, showMessage, t]);

  const handleReplyEdit = (value: string) => {
    setDraftReplyOriginal(value);
    setDraftReply(value);
    setDraftReplyTranslated(null);
    const updateKey =
      current?.reviewKey ?? (current ? `${current.source}#${current.id}` : null);
    if (updateKey) {
      onReplyUpdate?.(
        updateKey,
        value,
        value,
        null,
        draftReviewTranslated
      );
    }
  };

  const renderStars = (rating: number | null) => {
    const safeRating = rating ?? 0;
    const filled = Math.max(0, Math.min(5, Math.round(safeRating)));
    return (
      <div className="flex items-center gap-1 text-lg">
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
        throw new Error(data.error || t("failed_draft_reply"));
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
        showMessage(t("reply_drafted"));
      }
    } catch (error) {
      setDraftError(
        error instanceof Error ? error.message : t("failed_draft_reply")
      );
    } finally {
      setIsDrafting(false);
    }
  }, [current, onReplyUpdate, showMessage, t]);

  const handleSend = useCallback(async () => {
    if (!current) {
      return;
    }

    if (current.source !== "Google") {
      return;
    }

    const reply = replyForActions?.trim();
    if (!reply) {
      showMessage(t("no_reply_to_send"));
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
        throw new Error(data.error || t("failed_send_reply"));
      }

      const updateKey = current.reviewKey ?? `${current.source}#${current.id}`;
      onStatusUpdate?.(updateKey, "posted");
      setIsPosted(true);
      showMessage(t("reply_sent"));
    } catch (error) {
      setPostError(
        error instanceof Error ? error.message : t("failed_send_reply")
      );
    } finally {
      setIsPosting(false);
    }
  }, [current, replyForActions, onStatusUpdate, showMessage, t]);

  const handleMarkPosted = useCallback(async () => {
    if (!current) {
      return;
    }
    if (current.source === "Google") {
      return;
    }
    setIsMarkingPosted(true);
    setMarkError(null);

    try {
      const response = await fetch("/api/reviews/mark-posted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewId: current.id,
          reviewKey: current.reviewKey,
          reply: replyForActions ?? "",
          source: current.source,
        }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || t("failed_send_reply"));
      }

      const updateKey = current.reviewKey ?? `${current.source}#${current.id}`;
      onStatusUpdate?.(updateKey, "posted");
      setIsPosted(true);
      showMessage(t("marked_posted"));
    } catch (error) {
      setMarkError(
        error instanceof Error ? error.message : t("failed_send_reply")
      );
    } finally {
      setIsMarkingPosted(false);
    }
  }, [current, replyForActions, onStatusUpdate, showMessage, t]);

  const handleApplyChanges = async () => {
    if (!current) {
      return;
    }
    const trimmedChanges = changeRequest.trim();
    if (!trimmedChanges) {
      setChangeError(t("failed_draft_reply"));
      return;
    }
    const baseReply = draftReplyOriginal ?? draftReply ?? "";
    if (!baseReply.trim()) {
      setChangeError(t("no_reply_drafted"));
      return;
    }

    setIsChanging(true);
    setChangeError(null);

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
          ask_for_changes: true,
          need_changes: true,
          previousReply: baseReply,
          prompt: trimmedChanges,
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
        setChangeRequest("");
        setIsChangeOpen(false);
        showMessage(t("reply_drafted"));
      }
    } catch (error) {
      setChangeError(
        error instanceof Error ? error.message : t("failed_draft_reply")
      );
    } finally {
      setIsChanging(false);
    }
  };

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
    handleOpenWithCopy,
    handleSend,
    moveNext,
    movePrev,
  ]);

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-[var(--color-stroke)] bg-white/80 p-6 shadow-[0_24px_40px_rgba(29,27,22,0.12)] backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="h-3 w-24 rounded-full bg-[var(--color-stroke)] shimmer" />
            <div className="h-6 w-56 rounded-full bg-[var(--color-stroke)] shimmer" />
            <div className="h-4 w-48 rounded-full bg-[var(--color-stroke)] shimmer" />
          </div>
          <div className="h-8 w-28 rounded-full bg-[var(--color-stroke)] shimmer" />
        </div>
        <div className="mt-5 space-y-3">
          <div className="h-4 w-full rounded-full bg-[var(--color-stroke)] shimmer" />
          <div className="h-4 w-11/12 rounded-full bg-[var(--color-stroke)] shimmer" />
        </div>
        <div className="mt-5 rounded-2xl border border-[var(--color-stroke)] bg-[var(--color-soft)] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="h-3 w-28 rounded-full bg-[var(--color-stroke)] shimmer" />
            <div className="h-3 w-20 rounded-full bg-[var(--color-stroke)] shimmer" />
          </div>
          <div className="mt-3 h-4 w-full rounded-full bg-[var(--color-stroke)] shimmer" />
          <div className="mt-2 h-4 w-10/12 rounded-full bg-[var(--color-stroke)] shimmer" />
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <div className="h-9 w-28 rounded-full bg-[var(--color-stroke)] shimmer" />
            <div className="h-9 w-24 rounded-full bg-[var(--color-stroke)] shimmer" />
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-36 rounded-full bg-[var(--color-stroke)] shimmer" />
            <div className="h-9 w-32 rounded-full bg-[var(--color-stroke)] shimmer" />
            <div className="h-9 w-28 rounded-full bg-[var(--color-stroke)] shimmer" />
          </div>
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
          {t("loading_reviews")}
        </p>
      </div>
    );
  }

  if (needsReview.length === 0) {
    return (
      <div className="rounded-3xl border border-[var(--color-stroke)] bg-white/70 p-6 text-sm text-[var(--color-muted)] shadow-[0_16px_32px_rgba(29,27,22,0.08)] backdrop-blur">
        {t("no_reviews_manual")}
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
            {t("needs_review")}
          </p>
          <h2 className="mt-2 font-display text-2xl text-[var(--color-ink)]">
            {current.author}
          </h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            {current.source} • {current.date}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-[var(--color-muted)]">
            {renderStars(current.rating)}
            <span>
              {current.rating !== null ? current.rating.toFixed(1) : t("na")}{" "}
              {t("rating_label")}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusPill status={current.status} preferredLanguage={preferredLanguage} />
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
            {index + 1} / {needsReview.length}
          </span>
        </div>
      </div>

      <p
        className="mt-4 text-base leading-7 text-[var(--color-ink)]"
        dir={dir}
      >
        {current.review
          ? `"${current.review}"`
          : t("no_review_text")}
      </p>
      {draftReviewTranslated ? (
        <p
          className="mt-3 text-base leading-7 text-[var(--color-ink)]"
          dir={dir}
        >
          {`"${draftReviewTranslated}"`}
        </p>
      ) : null}

      <div className="mt-5 rounded-2xl border border-[var(--color-stroke)] bg-[var(--color-soft)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
            {t("suggested_reply")}
          </p>
          {actionMessage ? (
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-accent-strong)]">
              {actionMessage}
            </span>
          ) : null}
        </div>
        <textarea
          className="mt-2 min-h-[120px] w-full resize-y rounded-2xl border border-[var(--color-stroke)] bg-white px-4 py-3 text-sm leading-6 text-[var(--color-ink)] shadow-inner outline-none transition focus:border-[var(--color-ink)]"
          dir={dir}
          value={draftReplyOriginal ?? draftReply ?? ""}
          placeholder={t("no_reply_drafted")}
          onChange={(event) => handleReplyEdit(event.target.value)}
        />
        {draftReplyTranslated && draftReplyTranslated !== (draftReplyOriginal ?? draftReply) ? (
          <div className="mt-3 rounded-2xl border border-[var(--color-stroke)] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
              {t("translated_reply")}
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--color-ink)]" dir={dir}>
              {draftReplyTranslated}
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
        {markError ? (
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-alert-strong)]">
            {markError}
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
            {t("previous")}
          </button>
          <button
            className="rounded-full border border-[var(--color-stroke)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-ink)] transition hover:-translate-y-[1px] hover:border-[var(--color-ink)]"
            type="button"
            onClick={moveNext}
          >
            {t("next")}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-full border border-[var(--color-stroke)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-ink)] transition hover:-translate-y-[1px] hover:border-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            onClick={handleDraft}
            disabled={isDrafting}
          >
            {isDrafting ? t("drafting") : t("draft_with_ai")}
          </button>
          {current.source === "Google" ? (
            <button
              className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-canvas)] transition hover:-translate-y-[1px] hover:bg-[var(--color-ink-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={() => void handleSend()}
              disabled={isPosting || !replyForActions || isPosted}
            >
              {isPosting
                ? t("sending")
                : isPosted
                  ? t("reply_sent")
                  : t("send_reply")}
            </button>
          ) : (
            <button
              className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-canvas)] transition hover:-translate-y-[1px] hover:bg-[var(--color-ink-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={() => void handleMarkPosted()}
              disabled={isMarkingPosted || isPosted}
            >
              {isMarkingPosted
                ? t("marking_posted")
                : isPosted
                  ? t("marked_posted")
                  : t("mark_posted")}
            </button>
          )}
          <button
            className="rounded-full border border-[var(--color-stroke)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-ink)] transition hover:-translate-y-[1px] hover:border-[var(--color-ink)]"
            type="button"
            onClick={() => void handleCopy()}
          >
            {t("copy_reply")}
          </button>
          <button
            className="rounded-full border border-[var(--color-stroke)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-ink)] transition hover:-translate-y-[1px] hover:border-[var(--color-ink)]"
            type="button"
            onClick={() => {
              setChangeError(null);
              setIsChangeOpen(true);
            }}
          >
            {t("change_with_ai")}
          </button>
          {current.source !== "Google" ? (
            current.link ? (
              <Link
                href={current.link}
                className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-canvas)] transition hover:-translate-y-[1px] hover:bg-[var(--color-ink-strong)]"
                target="_blank"
                rel="noreferrer"
              >
                {t("open_review_shortcut")}
              </Link>
            ) : (
              <button
                className="rounded-full border border-[var(--color-stroke)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-muted)]"
                type="button"
                onClick={() => showMessage(t("no_review_link"))}
              >
                {t("no_review_link")}
              </button>
            )
          ) : null}
        </div>
      </div>
      {isChangeOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-[var(--color-stroke)] bg-white p-6 shadow-[0_30px_60px_rgba(29,27,22,0.2)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  {t("change_with_ai")}
                </p>
                <h3 className="mt-2 font-display text-xl text-[var(--color-ink)]">
                  {current.author}
                </h3>
              </div>
              <button
                className="rounded-full border border-[var(--color-stroke)] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-muted)]"
                type="button"
                onClick={() => {
                  setIsChangeOpen(false);
                  setChangeError(null);
                }}
              >
                {t("cancel")}
              </button>
            </div>
            <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
              {t("change_prompt_label")}
            </label>
            <textarea
              className="mt-2 min-h-[140px] w-full resize-y rounded-2xl border border-[var(--color-stroke)] bg-white px-4 py-3 text-sm leading-6 text-[var(--color-ink)] shadow-inner outline-none transition focus:border-[var(--color-ink)]"
              value={changeRequest}
              onChange={(event) => setChangeRequest(event.target.value)}
              placeholder={t("change_prompt_placeholder")}
            />
            {changeError ? (
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-alert-strong)]">
                {changeError}
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
              <button
                className="rounded-full border border-[var(--color-stroke)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-ink)] transition hover:-translate-y-[1px] hover:border-[var(--color-ink)]"
                type="button"
                onClick={() => setIsChangeOpen(false)}
              >
                {t("cancel")}
              </button>
              <button
                className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-canvas)] transition hover:-translate-y-[1px] hover:bg-[var(--color-ink-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                onClick={() => void handleApplyChanges()}
                disabled={isChanging}
              >
                {isChanging ? t("drafting") : t("apply_changes")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

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
              {review.rating.toFixed(1)} rating
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
        &quot;{review.review}&quot;
      </p>

      <div className="mt-5 rounded-2xl border border-[var(--color-stroke)] bg-[var(--color-soft)] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
          Draft reply
        </p>
        <p className="mt-2 text-sm leading-6 text-[var(--color-ink)]">
          {review.reply}
        </p>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={review.link}
          className="text-sm font-semibold text-[var(--color-accent-strong)] underline-offset-4 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          Open review
        </Link>
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-full border border-[var(--color-stroke)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-ink)] transition hover:-translate-y-[1px] hover:border-[var(--color-ink)]"
            type="button"
          >
            Refine reply
          </button>
          <button
            className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-canvas)] transition hover:-translate-y-[1px] hover:bg-[var(--color-ink-strong)]"
            type="button"
          >
            Post reply
          </button>
        </div>
      </div>
    </article>
  );
}

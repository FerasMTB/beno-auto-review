import type { ReviewStatus } from "../lib/types";

const statusStyles: Record<ReviewStatus, { label: string; className: string }> =
  {
    posted: {
      label: "Posted",
      className:
        "bg-[var(--color-accent-cool)]/15 text-[var(--color-accent-cool-strong)]",
    },
    ready: {
      label: "Ready to post",
      className: "bg-[var(--color-accent)]/15 text-[var(--color-accent-strong)]",
    },
    "auto-post": {
      label: "Auto-post queued",
      className:
        "bg-[var(--color-ink)]/10 text-[var(--color-ink)]",
    },
    draft: {
      label: "Draft in progress",
      className: "bg-[var(--color-muted)]/15 text-[var(--color-muted)]",
    },
    "needs-review": {
      label: "Needs review",
      className: "bg-[var(--color-alert)]/20 text-[var(--color-alert-strong)]",
    },
  };

type StatusPillProps = {
  status: ReviewStatus;
};

export default function StatusPill({ status }: StatusPillProps) {
  const config = statusStyles[status];

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] ${config.className}`}
    >
      {config.label}
    </span>
  );
}

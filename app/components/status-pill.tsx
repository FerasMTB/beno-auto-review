import type { ReviewStatus } from "../lib/types";
import { getI18n, type I18nKey } from "../lib/i18n";

const statusStyles: Record<ReviewStatus, { labelKey: I18nKey; className: string }> =
  {
    posted: {
      labelKey: "status_posted",
      className:
        "bg-[var(--color-accent-cool)]/15 text-[var(--color-accent-cool-strong)]",
    },
    ready: {
      labelKey: "status_ready",
      className: "bg-[var(--color-accent)]/15 text-[var(--color-accent-strong)]",
    },
    "auto-post": {
      labelKey: "status_auto_post",
      className:
        "bg-[var(--color-ink)]/10 text-[var(--color-ink)]",
    },
    draft: {
      labelKey: "status_draft",
      className: "bg-[var(--color-muted)]/15 text-[var(--color-muted)]",
    },
    "needs-review": {
      labelKey: "status_needs_review",
      className: "bg-[var(--color-alert)]/20 text-[var(--color-alert-strong)]",
    },
  };

type StatusPillProps = {
  status: ReviewStatus;
  preferredLanguage?: string;
};

export default function StatusPill({ status, preferredLanguage }: StatusPillProps) {
  const config = statusStyles[status];
  const { t } = getI18n(preferredLanguage);

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] ${config.className}`}
    >
      {t(config.labelKey)}
    </span>
  );
}

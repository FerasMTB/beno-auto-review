import AppShell from "./components/app-shell";
import ReviewCard from "./components/review-card";
import {
  activityItems,
  replyPromptPreview,
  reviews,
  sources,
  statCards,
} from "./lib/mock-data";

export default function DashboardPage() {
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
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <section className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {statCards.map((stat) => (
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
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  "All",
                  "Google",
                  "TripAdvisor",
                  "Ready to post",
                  "Needs review",
                ].map((filter) => (
                  <button
                    key={filter}
                    className="rounded-full border border-[var(--color-stroke)] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-ink)] transition hover:border-[var(--color-ink)]"
                    type="button"
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            {reviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-[var(--color-stroke)] bg-white/70 p-5 shadow-[0_16px_32px_rgba(29,27,22,0.08)] backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
              Automation status
            </p>
            <p className="mt-3 font-display text-2xl text-[var(--color-ink)]">
              Daily sync running
            </p>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              Amplify checks new reviews every morning at 2:00 AM and updates
              the queue.
            </p>
            <div className="mt-4 grid gap-2 text-sm text-[var(--color-muted)]">
              <div className="flex items-center justify-between">
                <span>Next run</span>
                <span className="font-semibold text-[var(--color-ink)]">
                  Tomorrow, 2:00 AM
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Auto replies</span>
                <span className="font-semibold text-[var(--color-ink)]">
                  Enabled
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Manual checks</span>
                <span className="font-semibold text-[var(--color-ink)]">
                  Required for 3 stars or less
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--color-stroke)] bg-white/70 p-5 shadow-[0_16px_32px_rgba(29,27,22,0.08)] backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
              Reply prompt
            </p>
            <p className="mt-3 text-sm leading-6 text-[var(--color-ink)]">
              {replyPromptPreview}
            </p>
            <button
              className="mt-4 rounded-full border border-[var(--color-stroke)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-ink)] transition hover:border-[var(--color-ink)]"
              type="button"
            >
              Edit prompt
            </button>
          </div>

          <div className="rounded-3xl border border-[var(--color-stroke)] bg-white/70 p-5 shadow-[0_16px_32px_rgba(29,27,22,0.08)] backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
              Connected sources
            </p>
            <div className="mt-4 space-y-3 text-sm">
              {sources.map((source) => (
                <div
                  key={source.id}
                  className="rounded-2xl border border-[var(--color-stroke)] bg-white px-4 py-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[var(--color-ink)]">
                      {source.name}
                    </span>
                    <span className="rounded-full bg-[var(--color-accent-cool)]/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-accent-cool-strong)]">
                      {source.status}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-[var(--color-muted)]">
                    {source.lastSync}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--color-stroke)] bg-white/70 p-5 shadow-[0_16px_32px_rgba(29,27,22,0.08)] backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
              Recent activity
            </p>
            <div className="mt-4 space-y-3 text-sm">
              {activityItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-[var(--color-stroke)] bg-white px-4 py-3"
                >
                  <p className="font-semibold text-[var(--color-ink)]">
                    {item.title}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    {item.meta}
                  </p>
                  <p className="mt-2 text-xs text-[var(--color-muted)]">
                    {item.time}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

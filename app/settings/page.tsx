import AppShell from "../components/app-shell";

const replyPrompt =
  "Write a warm, concise reply. Mention the guest by name, thank them, and reference one detail from the review. Keep under 60 words.";

export default function SettingsPage() {
  return (
    <AppShell
      title="Settings"
      subtitle="Connect your review sources, tune the reply prompt, and control when auto-posting runs."
      actions={
        <button
          className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-canvas)] transition hover:-translate-y-[1px] hover:bg-[var(--color-ink-strong)]"
          type="button"
        >
          Save changes
        </button>
      }
    >
      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        <section className="space-y-6">
          <div className="rounded-3xl border border-[var(--color-stroke)] bg-white/70 p-6 shadow-[0_16px_32px_rgba(29,27,22,0.08)] backdrop-blur">
            <h2 className="font-display text-2xl text-[var(--color-ink)]">
              Review sources
            </h2>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              Set the public URLs used for daily review discovery.
            </p>
            <div className="mt-5 space-y-4 text-sm">
              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  Google Maps URL
                </span>
                <input
                  className="w-full rounded-2xl border border-[var(--color-stroke)] bg-white px-4 py-3 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-ink)]"
                  defaultValue="https://maps.google.com/?q=place"
                  type="url"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  TripAdvisor URL
                </span>
                <input
                  className="w-full rounded-2xl border border-[var(--color-stroke)] bg-white px-4 py-3 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-ink)]"
                  defaultValue="https://www.tripadvisor.com/"
                  type="url"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  Daily sync time
                </span>
                <select className="w-full rounded-2xl border border-[var(--color-stroke)] bg-white px-4 py-3 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-ink)]">
                  <option>2:00 AM</option>
                  <option>5:00 AM</option>
                  <option>8:00 AM</option>
                  <option>12:00 PM</option>
                  <option>6:00 PM</option>
                </select>
              </label>
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--color-stroke)] bg-white/70 p-6 shadow-[0_16px_32px_rgba(29,27,22,0.08)] backdrop-blur">
            <h2 className="font-display text-2xl text-[var(--color-ink)]">
              Reply prompt
            </h2>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              This prompt guides the ChatGPT draft used for Google replies.
            </p>
            <div className="mt-5 space-y-3">
              <textarea
                className="min-h-[180px] w-full resize-none rounded-2xl border border-[var(--color-stroke)] bg-white px-4 py-3 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-ink)]"
                defaultValue={replyPrompt}
              />
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--color-muted)]">
                <span>Variables: {`{name}`}, {`{rating}`}, {`{source}`}</span>
                <span>Max length: 60 words</span>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-3xl border border-[var(--color-stroke)] bg-white/70 p-6 shadow-[0_16px_32px_rgba(29,27,22,0.08)] backdrop-blur">
            <h2 className="font-display text-2xl text-[var(--color-ink)]">
              Automation controls
            </h2>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              Decide when drafts are created and when replies post automatically.
            </p>
            <div className="mt-5 space-y-3 text-sm">
              {[
                {
                  title: "Auto-draft replies",
                  detail: "Generate a draft as soon as reviews sync.",
                  checked: true,
                },
                {
                  title: "Auto-post 4 stars or higher",
                  detail: "Post replies automatically for positive reviews.",
                  checked: false,
                },
                {
                  title: "Hold 3 stars or lower",
                  detail: "Require manual approval before posting.",
                  checked: true,
                },
              ].map((item) => (
                <label
                  key={item.title}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--color-stroke)] bg-white px-4 py-3"
                >
                  <div>
                    <p className="font-semibold text-[var(--color-ink)]">
                      {item.title}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-muted)]">
                      {item.detail}
                    </p>
                  </div>
                  <span className="relative inline-flex h-6 w-11 items-center">
                    <input
                      className="peer sr-only"
                      defaultChecked={item.checked}
                      type="checkbox"
                    />
                    <span className="absolute inset-0 rounded-full bg-[var(--color-stroke)] transition peer-checked:bg-[var(--color-accent-cool)]" />
                    <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-5" />
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--color-stroke)] bg-white/70 p-6 shadow-[0_16px_32px_rgba(29,27,22,0.08)] backdrop-blur">
            <h2 className="font-display text-2xl text-[var(--color-ink)]">
              Google reply settings
            </h2>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              Configure the reply voice and approval flow before auto-posting.
            </p>
            <div className="mt-5 grid gap-4 text-sm">
              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  Reply tone
                </span>
                <select className="w-full rounded-2xl border border-[var(--color-stroke)] bg-white px-4 py-3 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-ink)]">
                  <option>Warm and professional</option>
                  <option>Friendly and casual</option>
                  <option>Short and direct</option>
                </select>
              </label>
              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  Manual approval threshold
                </span>
                <input
                  className="w-full rounded-2xl border border-[var(--color-stroke)] bg-white px-4 py-3 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-ink)]"
                  defaultValue="3 stars and below"
                  type="text"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  Auto-post delay
                </span>
                <select className="w-full rounded-2xl border border-[var(--color-stroke)] bg-white px-4 py-3 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-ink)]">
                  <option>30 minutes</option>
                  <option>2 hours</option>
                  <option>6 hours</option>
                  <option>Next morning</option>
                </select>
              </label>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

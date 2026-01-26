"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/app-shell";

type SettingsState = {
  googleMapsUrl: string;
  tripAdvisorUrl: string;
  syncTime: string;
  replyPrompt: string;
  autoDraftReplies: boolean;
  autoPostHighStars: boolean;
  holdLowStars: boolean;
  replyTone: string;
  approvalThreshold: string;
  autoPostDelay: string;
};

const DEFAULT_SETTINGS: SettingsState = {
  googleMapsUrl: "https://maps.google.com/?q=place",
  tripAdvisorUrl: "https://www.tripadvisor.com/",
  syncTime: "2:00 AM",
  replyPrompt:
    "Write a warm, concise reply. Mention the guest by name, thank them, and reference one detail from the review. Keep under 60 words.",
  autoDraftReplies: true,
  autoPostHighStars: false,
  holdLowStars: true,
  replyTone: "Warm and professional",
  approvalThreshold: "3 stars and below",
  autoPostDelay: "30 minutes",
};

const SYNC_TIMES = ["2:00 AM", "5:00 AM", "8:00 AM", "12:00 PM", "6:00 PM"];
const REPLY_TONES = [
  "Warm and professional",
  "Friendly and casual",
  "Short and direct",
];
const AUTO_POST_DELAYS = ["30 minutes", "2 hours", "6 hours", "Next morning"];

export default function SettingsPage() {
  const [formState, setFormState] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadSettings = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/settings", {
          signal: controller.signal,
        });
        const data = (await response.json()) as {
          settings?: Partial<SettingsState>;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error || "Failed to load settings");
        }

        if (isMounted && data.settings) {
          setFormState((prev) => ({ ...prev, ...data.settings }));
        }
      } catch (error) {
        if (isMounted && !controller.signal.aborted) {
          setSaveError(
            error instanceof Error ? error.message : "Failed to load settings"
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadSettings();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const handleChange = <K extends keyof SettingsState>(
    key: K,
    value: SettingsState[K]
  ) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaveState("saving");
    setSaveError(null);

    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formState),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Failed to save settings");
      }

      setSaveState("saved");
      window.setTimeout(() => {
        setSaveState("idle");
      }, 2000);
    } catch (error) {
      setSaveState("error");
      setSaveError(
        error instanceof Error ? error.message : "Failed to save settings"
      );
    }
  };

  const statusLabel = useMemo(() => {
    if (saveState === "saving") {
      return "Saving...";
    }
    if (saveState === "saved") {
      return "Saved";
    }
    if (saveState === "error") {
      return "Save failed";
    }
    return null;
  }, [saveState]);

  return (
    <AppShell
      title="Settings"
      subtitle="Connect your review sources, tune the reply prompt, and control when auto-posting runs."
      actions={
        <>
          <button
            className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-canvas)] transition hover:-translate-y-[1px] hover:bg-[var(--color-ink-strong)] disabled:cursor-not-allowed disabled:opacity-70"
            type="button"
            onClick={handleSave}
            disabled={isLoading || saveState === "saving"}
          >
            {saveState === "saving" ? "Saving..." : "Save changes"}
          </button>
          {statusLabel ? (
            <span
              className={`text-xs font-semibold uppercase tracking-[0.14em] ${
                saveState === "error"
                  ? "text-[var(--color-alert-strong)]"
                  : "text-[var(--color-muted)]"
              }`}
            >
              {statusLabel}
            </span>
          ) : null}
        </>
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
                  type="url"
                  value={formState.googleMapsUrl}
                  onChange={(event) =>
                    handleChange("googleMapsUrl", event.target.value)
                  }
                />
              </label>
              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  TripAdvisor URL
                </span>
                <input
                  className="w-full rounded-2xl border border-[var(--color-stroke)] bg-white px-4 py-3 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-ink)]"
                  type="url"
                  value={formState.tripAdvisorUrl}
                  onChange={(event) =>
                    handleChange("tripAdvisorUrl", event.target.value)
                  }
                />
              </label>
              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  Daily sync time
                </span>
                <select
                  className="w-full rounded-2xl border border-[var(--color-stroke)] bg-white px-4 py-3 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-ink)]"
                  value={formState.syncTime}
                  onChange={(event) =>
                    handleChange("syncTime", event.target.value)
                  }
                >
                  {SYNC_TIMES.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
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
                value={formState.replyPrompt}
                onChange={(event) =>
                  handleChange("replyPrompt", event.target.value)
                }
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
                  key: "autoDraftReplies",
                  title: "Auto-draft replies",
                  detail: "Generate a draft as soon as reviews sync.",
                },
                {
                  key: "autoPostHighStars",
                  title: "Auto-post 4 stars or higher",
                  detail: "Post replies automatically for positive reviews.",
                },
                {
                  key: "holdLowStars",
                  title: "Hold 3 stars or lower",
                  detail: "Require manual approval before posting.",
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
                      type="checkbox"
                      checked={formState[item.key as keyof SettingsState] as boolean}
                      onChange={(event) =>
                        handleChange(
                          item.key as keyof SettingsState,
                          event.target.checked
                        )
                      }
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
                <select
                  className="w-full rounded-2xl border border-[var(--color-stroke)] bg-white px-4 py-3 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-ink)]"
                  value={formState.replyTone}
                  onChange={(event) =>
                    handleChange("replyTone", event.target.value)
                  }
                >
                  {REPLY_TONES.map((tone) => (
                    <option key={tone} value={tone}>
                      {tone}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  Manual approval threshold
                </span>
                <input
                  className="w-full rounded-2xl border border-[var(--color-stroke)] bg-white px-4 py-3 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-ink)]"
                  type="text"
                  value={formState.approvalThreshold}
                  onChange={(event) =>
                    handleChange("approvalThreshold", event.target.value)
                  }
                />
              </label>
              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  Auto-post delay
                </span>
                <select
                  className="w-full rounded-2xl border border-[var(--color-stroke)] bg-white px-4 py-3 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-ink)]"
                  value={formState.autoPostDelay}
                  onChange={(event) =>
                    handleChange("autoPostDelay", event.target.value)
                  }
                >
                  {AUTO_POST_DELAYS.map((delay) => (
                    <option key={delay} value={delay}>
                      {delay}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {saveError ? (
            <div className="rounded-2xl border border-[var(--color-alert)]/40 bg-white/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-alert-strong)]">
              {saveError}
            </div>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}

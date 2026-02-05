"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/app-shell";
import { getI18n } from "../lib/i18n";

type SettingsState = {
  googleMapsUrl: string;
  tripAdvisorUrl: string;
  syncTime: string;
  replyPrompt: string;
  preferredLanguage: string;
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
  preferredLanguage: "English",
  autoDraftReplies: true,
  autoPostHighStars: false,
  holdLowStars: true,
  replyTone: "Warm and professional",
  approvalThreshold: "3 stars and below",
  autoPostDelay: "30 minutes",
};

const PREFERRED_LANGUAGES = [
  "English",
  "Arabic",
  "German",
  "French",
  "Spanish",
];

const getStoredLanguage = () => {
  return "English";
};

export default function SettingsPage() {
  const [formState, setFormState] = useState<SettingsState>(() => ({
    ...DEFAULT_SETTINGS,
    preferredLanguage: getStoredLanguage(),
  }));
  const [isLoading, setIsLoading] = useState(true);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const { t } = getI18n(formState.preferredLanguage);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const stored = window.localStorage.getItem("preferredLanguage");
    if (stored && stored.trim().length) {
      setFormState((prev) => ({ ...prev, preferredLanguage: stored }));
    }
  }, []);

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
          if (data.settings.preferredLanguage && typeof window !== "undefined") {
            window.localStorage.setItem(
              "preferredLanguage",
              data.settings.preferredLanguage
            );
          }
        }
      } catch (error) {
        if (isMounted && !controller.signal.aborted) {
          setSaveError(
            error instanceof Error ? error.message : t("failed_load_settings")
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
        throw new Error(data.error || t("failed_save_settings"));
      }

      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          "preferredLanguage",
          formState.preferredLanguage
        );
      }

      setSaveState("saved");
      window.setTimeout(() => {
        setSaveState("idle");
      }, 2000);
    } catch (error) {
      setSaveState("error");
      setSaveError(
        error instanceof Error ? error.message : t("failed_save_settings")
      );
    }
  };

  const statusLabel = useMemo(() => {
    if (saveState === "saving") {
      return t("saving");
    }
    if (saveState === "saved") {
      return t("saved");
    }
    if (saveState === "error") {
      return t("save_failed");
    }
    return null;
  }, [saveState, t]);

  return (
    <AppShell
      title={t("settings_title")}
      subtitle={t("settings_subtitle")}
      preferredLanguage={formState.preferredLanguage}
      actions={
        <>
          <button
            className="rounded-full bg-[var(--color-ink)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-canvas)] transition hover:-translate-y-[1px] hover:bg-[var(--color-ink-strong)] disabled:cursor-not-allowed disabled:opacity-70"
            type="button"
            onClick={handleSave}
            disabled={isLoading || saveState === "saving"}
          >
            {saveState === "saving" ? t("saving") : t("save_changes")}
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
              {t("reply_prompt")}
            </h2>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              {t("reply_prompt_help")}
            </p>
            <div className="mt-5 space-y-3">
              <textarea
                className="min-h-[180px] w-full resize-none rounded-2xl border border-[var(--color-stroke)] bg-white px-4 py-3 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-ink)]"
                value={formState.replyPrompt}
                onChange={(event) =>
                  handleChange("replyPrompt", event.target.value)
                }
              />
              <label className="block space-y-2 text-sm">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  {t("preferred_language")}
                </span>
                <select
                  className="w-full rounded-2xl border border-[var(--color-stroke)] bg-white px-4 py-3 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-ink)]"
                  value={formState.preferredLanguage}
                  onChange={(event) =>
                    handleChange("preferredLanguage", event.target.value)
                  }
                >
                  {PREFERRED_LANGUAGES.map((language) => (
                    <option key={language} value={language}>
                      {language === "English"
                        ? t("lang_english")
                        : language === "Arabic"
                          ? t("lang_arabic")
                          : language === "German"
                            ? t("lang_german")
                            : language === "French"
                              ? t("lang_french")
                              : t("lang_spanish")}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--color-muted)]" />
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-3xl border border-[var(--color-stroke)] bg-white/70 p-6 shadow-[0_16px_32px_rgba(29,27,22,0.08)] backdrop-blur">
            <h2 className="font-display text-2xl text-[var(--color-ink)]">
              {t("automation_controls")}
            </h2>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              {t("automation_help")}
            </p>
            <div className="mt-5 space-y-3 text-sm">
              {[
                {
                  key: "autoDraftReplies",
                  title: t("auto_draft"),
                  detail: t("auto_draft_detail"),
                },
                {
                  key: "holdLowStars",
                  title: t("hold_low"),
                  detail: t("hold_low_detail"),
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

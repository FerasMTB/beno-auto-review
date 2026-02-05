"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { getI18n } from "../lib/i18n";

const navigation = [
  { href: "/", label: "Dashboard" },
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" },
];

type AppShellProps = {
  title: string;
  subtitle: string;
  preferredLanguage?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export default function AppShell({
  title,
  subtitle,
  preferredLanguage,
  actions,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const { t, dir } = getI18n(preferredLanguage);

  return (
    <div className="min-h-screen" dir={dir}>
      <div className="relative isolate overflow-hidden">
        <div className="pointer-events-none absolute -left-32 top-[-120px] h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,rgba(212,106,74,0.35),transparent_70%)] blur-3xl animate-[float_12s_ease-in-out_infinite]" />
        <div className="pointer-events-none absolute -right-24 top-24 h-96 w-96 rounded-full bg-[radial-gradient(circle_at_center,rgba(31,122,107,0.35),transparent_70%)] blur-3xl animate-[float_14s_ease-in-out_infinite]" />
        <div className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-[240px_1fr]">
            <aside className="flex flex-col gap-8">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-ink)] text-[var(--color-canvas)] shadow-[0_12px_30px_rgba(29,27,22,0.25)]">
                  AR
                </div>
                <div>
                  <p className="font-display text-lg text-[var(--color-ink)]">
                    {t("shell_autoreview")}
                  </p>
                  <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">
                    {t("shell_daily_sync")}
                  </p>
                </div>
              </div>

              <nav className="grid gap-2">
                {navigation.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`rounded-2xl border px-4 py-3 text-sm font-semibold uppercase tracking-[0.1em] transition ${
                        isActive
                          ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-canvas)] shadow-[0_12px_24px_rgba(29,27,22,0.2)]"
                          : "border-[var(--color-stroke)] bg-white/60 text-[var(--color-ink)] hover:-translate-y-[1px] hover:border-[var(--color-ink)]"
                      }`}
                    >
                      {item.href === "/"
                        ? t("nav_dashboard")
                        : item.href === "/reports"
                          ? t("nav_reports")
                          : t("nav_settings")}
                    </Link>
                  );
                })}
              </nav>

            </aside>

            <div className="space-y-8">
              <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                    {t("shell_review_ops")}
                  </p>
                  <h1 className="font-display text-3xl text-[var(--color-ink)] sm:text-4xl">
                    {title}
                  </h1>
                  <p className="max-w-2xl text-sm text-[var(--color-muted)]">
                    {subtitle}
                  </p>
                </div>
                {actions ? (
                  <div className="flex flex-wrap items-center gap-3">
                    {actions}
                  </div>
                ) : null}
              </header>

              <div className="animate-[fade-up_0.6s_ease_forwards] opacity-0">
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

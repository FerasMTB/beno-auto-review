import type { Metadata } from "next";
import { Noto_Sans, Noto_Sans_Mono } from "next/font/google";
import "./globals.css";

const notoSans = Noto_Sans({
  variable: "--font-primary",
  subsets: ["latin", "arabic"],
  weight: ["300", "400", "500", "600", "700"],
});

const notoSansDisplay = Noto_Sans({
  variable: "--font-display",
  subsets: ["latin", "arabic"],
  weight: ["600", "700"],
});

const notoSansMono = Noto_Sans_Mono({
  variable: "--font-code",
  subsets: ["latin"],
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: "AutoReview Console",
  description:
    "Dashboard for daily Google and TripAdvisor review sync, reply drafting, and automation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${notoSans.variable} ${notoSansDisplay.variable} ${notoSansMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

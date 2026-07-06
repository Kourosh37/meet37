import { QueryProvider } from "@/providers/QueryProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { ToastProvider } from "@/providers/ToastProvider";
import { LocaleProvider } from "@/providers/LocaleProvider";
import { SkipToContent } from "@/components/layout/SkipToContent";
import { localeHydrationScript } from "@/lib/i18n/config";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "meet37",
    template: "%s | meet37"
  },
  description:
    "Browser-based video meetings with room sharing, moderation, and server-relayed media.",
  applicationName: "meet37",
  manifest: "/manifest.webmanifest",
  icons: {
    apple: "/apple-touch-icon.png",
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      {
        url: "/favicon-32x32.png",
        sizes: "32x32",
        type: "image/png"
      },
      {
        url: "/favicon-16x16.png",
        sizes: "16x16",
        type: "image/png"
      },
      {
        url: "/icon-192.png",
        sizes: "192x192",
        type: "image/png"
      },
      {
        url: "/icon-512.png",
        sizes: "512x512",
        type: "image/png"
      },
      {
        media: "(prefers-color-scheme: light)",
        url: "/icons/meet37-logo-light.svg",
        type: "image/svg+xml"
      },
      {
        media: "(prefers-color-scheme: dark)",
        url: "/icons/meet37-logo-dark.svg",
        type: "image/svg+xml"
      }
    ],
    shortcut: "/favicon.ico"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e8e4da" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" }
  ]
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html dir="ltr" lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: localeHydrationScript }} />
        <ThemeProvider>
          <LocaleProvider>
            <SkipToContent />
            <QueryProvider>{children}</QueryProvider>
          </LocaleProvider>
          <ToastProvider />
        </ThemeProvider>
      </body>
    </html>
  );
}

import { QueryProvider } from "@/providers/QueryProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { ToastProvider } from "@/providers/ToastProvider";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "meet37",
    template: "%s | meet37"
  },
  description:
    "Browser-based video meetings with room sharing, moderation, and P2P-first media.",
  applicationName: "meet37",
  icons: {
    apple: "/icons/meet37-logo-light.svg",
    icon: [
      { url: "/icons/meet37-favicon.svg", type: "image/svg+xml" },
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
    shortcut: "/icons/meet37-favicon.svg"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" }
  ]
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <a
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
          href="#main-content"
        >
          Skip to content
        </a>
        <ThemeProvider>
          <QueryProvider>{children}</QueryProvider>
          <ToastProvider />
        </ThemeProvider>
      </body>
    </html>
  );
}

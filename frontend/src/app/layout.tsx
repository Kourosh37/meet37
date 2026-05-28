// Root application layout placeholder.
//
// Planned responsibilities:
// - Define the global HTML shell for the Next.js App Router.
// - Mount ThemeProvider for dark/light mode.
// - Mount React Query provider for backend REST cache.
// - Include global metadata, fonts, and base accessibility attributes.
// - Import globals.css after Tailwind is initialized.

import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}

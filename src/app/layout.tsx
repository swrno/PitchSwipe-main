import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RegisterSW } from "@/shared/shell/pwa/register-sw";
import { ThemeSync } from "@/shared/shell/pwa/theme-sync";
import { THEME_BOOT_SCRIPT, THEME_COLORS } from "@/shared/lib/feel/theme";
import { siteUrl } from "@/features/landing/ui/site-url";

export const metadata: Metadata = {
  // Absolute URLs for og:image and canonical links on every route (not localhost in production).
  metadataBase: new URL(siteUrl()),
  title: {
    default: "PitchSwipe",
    template: "%s · PitchSwipe",
  },
  description: "A/B test your pitch before you build your landing page.",
  applicationName: "PitchSwipe",
  appleWebApp: {
    capable: true,
    title: "PitchSwipe",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Dark by default; the boot script switches this meta to the light colour for light-mode visitors.
  themeColor: THEME_COLORS.dark,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: the boot script may set data-theme before React hydrates.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/*
          Outfit (headings, big numbers) and DM Sans (text), with Anek Devanagari for Hindi cards. Loaded at
          runtime (not at build) so builds work offline. The Devanagari files only download when Devanagari
          text is on screen (unicode-range).
        */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@400..800&family=DM+Sans:opsz,wght@9..40,400..700&family=Anek+Devanagari:wght@400..800&display=swap"
        />
      </head>
      <body className="min-h-dvh bg-background text-foreground antialiased">{children}
        <RegisterSW />
        <ThemeSync />
      </body>
    </html>
  );
}

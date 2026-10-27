import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import { LiveAnnouncerProvider } from "@/lib/a11y/live-announcer";
import "./globals.css";

// Latin only: the UI is English. Thai and Devanagari companions come with translations
// (docs/design-system.md, section 3). next/font downloads the files at build time and serves
// them from our own domain, so no request goes to Google when a customer opens the page.
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

// Every page needs its own title (WCAG 2.4.2). A page sets `title: "Services"` and the
// template turns it into "Services | MedEx". Pages without one get the default.
export const metadata: Metadata = {
  title: { default: "MedEx take-home", template: "%s | MedEx" },
  description: "Service explorer, cart and booking for MedEx",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${plexSans.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        {/* First thing a keyboard user reaches: jumps past the header straight to the content. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-foreground"
        >
          Skip to content
        </a>
        {/* Renders the one shared polite live region after the page content. */}
        <LiveAnnouncerProvider>
          {/* The only <main> in the app. Pages render inside it and must not add their own. */}
          <main id="main" className="flex flex-1 flex-col">
            {children}
          </main>
        </LiveAnnouncerProvider>
      </body>
    </html>
  );
}

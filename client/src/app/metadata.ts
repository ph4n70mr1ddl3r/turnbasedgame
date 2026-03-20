import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#064e3b",
};

export const metadata: Metadata = {
  title: "Turnbasedgame Poker",
  description: "Real-time two-player Texas Hold'em poker",
  applicationName: "Turnbasedgame Poker",
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  openGraph: {
    type: "website",
    siteName: "Turnbasedgame Poker",
    title: "Turnbasedgame Poker",
    description: "Real-time two-player Texas Hold'em poker",
  },
  twitter: {
    card: "summary",
    title: "Turnbasedgame Poker",
    description: "Real-time two-player Texas Hold'em poker",
  },
  robots: {
    index: true,
    follow: true,
  },
};

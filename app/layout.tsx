import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./site-theme.css";
import "./collections.css";
import "./royal-theme.css";
import ReviewPrompt from '@/components/ReviewPrompt';
import ProfileAccess from '@/components/ProfileAccess';
import SessionRecovery from "@/components/SessionRecovery";
import PresenceTracker from "@/components/PresenceTracker";
import SiteFooter from "@/components/SiteFooter";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "YAMONFILM",
  description: "Regarde tes films et séries préférés en streaming",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "YAMONFILM",
  },
  icons: {
    icon: "/icone.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head><link rel="preconnect" href="https://image.tmdb.org" /></head>
      <body className="min-h-full flex flex-col bg-[#0a0a0b] text-white">
        <Script src="/install-capture.js" strategy="beforeInteractive" />
        <SessionRecovery />
        <PresenceTracker />
        <ReviewPrompt />
        <ProfileAccess>{children}</ProfileAccess>
        <SiteFooter />
      </body>
    </html>
  );
}

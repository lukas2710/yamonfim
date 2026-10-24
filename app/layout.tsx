import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./site-theme.css";
import "./collections.css";
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
    apple: "/icone.png",
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
      <body className="min-h-full flex flex-col bg-[#0a0a0b] text-white">
        <SessionRecovery />
        <PresenceTracker />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}

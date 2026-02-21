import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Manassas Bill Tracker",
  description:
    "Analyze your City of Manassas utility bills over time. Free, private, and community-built.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png" }],
    other: [
      { rel: "android-chrome", url: "/android-chrome-192x192.png" },
      { rel: "android-chrome", url: "/android-chrome-512x512.png" },
    ],
  },
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    title: "Manassas Bill Tracker",
    description:
      "Analyze your City of Manassas utility bills over time. Free, private, and community-built.",
    images: [
      {
        url: "/OriginalImage.png",
        alt: "Manassas Bill Tracker",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Manassas Bill Tracker",
    description:
      "Analyze your City of Manassas utility bills over time. Free, private, and community-built.",
    images: ["/OriginalImage.png"],
  },
};

import { Toaster } from "@/components/ui/sonner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}

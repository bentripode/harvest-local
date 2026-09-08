import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { Toaster } from "@/components/ui/sonner";
import { env } from "@/lib/env";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Storefronts are public and shared as links, so relative `alternates` / `openGraph` URLs in
  // child routes need an absolute base to resolve against.
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
  title: {
    default: "Harvest Local",
    template: "%s",
  },
  description: "A hyper-local marketplace for farmers, artisans, and makers.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground min-h-full flex flex-col">
        {children}
        <Toaster richColors closeButton />
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Fraunces, Nunito_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";

import { Toaster } from "@/components/ui/sonner";
import { env } from "@/lib/env";

/**
 * Fraunces for headings, Nunito Sans for everything else.
 *
 * Fraunces is optical-size aware: `opsz` is wired to `auto` so a 40px hero and a 15px card title
 * are drawn with different letterforms rather than one scaled up, which is what stops large soft
 * serifs looking flabby. `SOFT` is nudged up and `WONK` left off — warmth without whimsy.
 *
 * Both are variable fonts loaded through next/font, so they are self-hosted, preloaded and carry no
 * layout shift. `display: "swap"` keeps text readable while they arrive.
 */
const heading = Fraunces({
  variable: "--font-heading-family",
  subsets: ["latin"],
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
});

const sans = Nunito_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
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
      className={`${sans.variable} ${heading.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground min-h-full flex flex-col">
        {children}
        <Toaster richColors closeButton />
      </body>
    </html>
  );
}

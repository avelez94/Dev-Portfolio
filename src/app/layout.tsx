import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { SITE_URL } from "@/content/site";

// Self hosted (OFL licensed) so builds never depend on reaching Google Fonts.
const display = localFont({
  src: [
    { path: "./fonts/fraunces-latin-full-normal.woff2", style: "normal", weight: "100 900" },
    { path: "./fonts/fraunces-latin-full-italic.woff2", style: "italic", weight: "100 900" },
  ],
  variable: "--font-display",
  display: "swap",
});

const body = localFont({
  src: [{ path: "./fonts/figtree-latin-wght-normal.woff2", style: "normal", weight: "300 900" }],
  variable: "--font-body",
  display: "swap",
});

const title = "Alante Velez | Website Design, Redesigns, and Care";
const description =
  "Friendly website design, redesigns, and ongoing care for small businesses, service providers, consultants, and creators. Clear plans, plain language, and help after launch.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: title, template: "%s | Alante Velez" },
  description,
  authors: [{ name: "Alante Velez" }],
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Alante Velez",
    title,
    description,
    locale: "en_US",
  },
  twitter: { card: "summary_large_image", title, description },
};

export const viewport: Viewport = {
  themeColor: "#FBF3E8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}

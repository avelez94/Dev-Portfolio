import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { site } from "@/config/site";
import "./globals.css";

// Self hosted variable fonts (SIL Open Font License) from @fontsource: no build or runtime calls to Google.
const serif = localFont({
  src: [
    { path: "../../node_modules/@fontsource-variable/source-serif-4/files/source-serif-4-latin-wght-normal.woff2", style: "normal", weight: "200 900" },
    { path: "../../node_modules/@fontsource-variable/source-serif-4/files/source-serif-4-latin-wght-italic.woff2", style: "italic", weight: "200 900" },
  ],
  variable: "--font-source-serif",
  display: "swap",
});
const sans = localFont({
  src: [{ path: "../../node_modules/@fontsource-variable/montserrat/files/montserrat-latin-wght-normal.woff2", style: "normal", weight: "100 900" }],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name} | Freight Brokerage & Transportation Coordination`, template: `%s | ${site.name}` },
  description: site.description,
  applicationName: site.name,
  openGraph: {
    type: "website",
    siteName: site.name,
    locale: "en_US",
    title: `${site.name} | Freight Brokerage & Transportation Coordination`,
    description: site.description,
    images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: `${site.name} logo and tagline beside a truck on a highway at dusk` }],
  },
  twitter: { card: "summary_large_image", title: `${site.name} | Freight Brokerage & Transportation Coordination`, description: site.description, images: ["/og-image.jpg"] },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = { themeColor: "#142839", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}

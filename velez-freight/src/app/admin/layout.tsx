import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s | Velez Freight Group Dashboard" },
  robots: { index: false, follow: false, nocache: true },
};

// Every admin request is rendered per user and never cached.
export const dynamic = "force-dynamic";

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-ivory">{children}</div>;
}

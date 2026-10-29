import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // The admin Docs page moved to its own address when the dashboard was split into pages.
    return [{ source: "/admin/docs", destination: "/admin/documents", permanent: false }];
  },
};

export default nextConfig;

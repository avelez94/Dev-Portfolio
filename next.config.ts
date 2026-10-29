import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The preview admin demo runs PostgreSQL in WebAssembly (src/lib/demo/engine.ts).
  // Loaded from node_modules at run time, with the care migrations it applies.
  serverExternalPackages: ["@electric-sql/pglite"],
  outputFileTracingIncludes: {
    "/api/demo": ["./supabase/pending/website-care/*.sql", "./node_modules/@electric-sql/pglite/dist/**/*"],
  },
  async redirects() {
    // The admin Docs page moved to its own address when the dashboard was split into pages.
    return [{ source: "/admin/docs", destination: "/admin/documents", permanent: false }];
  },
};

export default nextConfig;

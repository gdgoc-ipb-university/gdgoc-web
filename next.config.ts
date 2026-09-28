import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Extra hostnames (e.g. a dev tunnel) that may load dev-only assets and HMR.
  allowedDevOrigins: process.env.DEV_ALLOWED_ORIGINS?.split(",").map((host) => host.trim()).filter(Boolean),
  images: { qualities: [75, 90] },
  turbopack: { root: import.meta.dirname },
  // Apresiasi moved into the dashboard; keep old links and bookmarks working.
  redirects: async () => [
    { source: "/apresiasi", destination: "/dashboard/apresiasi", permanent: true },
    { source: "/apresiasi/admin", destination: "/dashboard/apresiasi/tinjau", permanent: true },
  ],
};

export default nextConfig;

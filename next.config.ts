import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Extra hostnames (e.g. a dev tunnel) that may load dev-only assets and HMR.
  allowedDevOrigins: process.env.DEV_ALLOWED_ORIGINS?.split(",").map((host) => host.trim()).filter(Boolean),
  images: { qualities: [75, 90] },
  turbopack: { root: import.meta.dirname },
  // Apresiasi moved into the dashboard; keep old links and bookmarks working.
  // World previews moved off the landing so that it can be prerendered.
  redirects: async () => [
    { source: "/", has: [{ type: "query", key: "world", value: "(?<world>dino-playground|cloud-club|after-hours)" }], destination: "/directions/:world", permanent: false },
    { source: "/apresiasi", destination: "/dashboard/apresiasi", permanent: true },
    { source: "/apresiasi/admin", destination: "/dashboard/apresiasi/tinjau", permanent: true },
  ],
};

export default nextConfig;

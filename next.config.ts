import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: { qualities: [75, 90] },
  turbopack: { root: import.meta.dirname },
};

export default nextConfig;

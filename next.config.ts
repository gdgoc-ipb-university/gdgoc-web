import type { NextConfig } from "next";

/** Tech League's hostname from NEXT_PUBLIC_LEAGUE_URL (#179), or null where the league has no host yet. */
function leagueHostname() {
  try { return process.env.NEXT_PUBLIC_LEAGUE_URL ? new URL(process.env.NEXT_PUBLIC_LEAGUE_URL).hostname : null; } catch { return null; }
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Extra hostnames (e.g. a dev tunnel) that may load dev-only assets and HMR.
  allowedDevOrigins: process.env.DEV_ALLOWED_ORIGINS?.split(",").map((host) => host.trim()).filter(Boolean),
  images: { qualities: [75, 90] },
  turbopack: { root: import.meta.dirname },
  // Apresiasi moved into the dashboard; keep old links and bookmarks working.
  // The design galleries were removed (#29); their art lives in design/.
  // On the league host every page path is served from src/app/league; the auth API, Next's files and static files (any
  // path with a dot) are shared. src/proxy.ts runs first and does the redirects. This is a config rewrite rather than
  // NextResponse.rewrite in the proxy: under `next dev` or `next start` bound to 127.0.0.1, as staging runs, the proxy
  // sees its URL as localhost and Next forwards a rewrite to it as an external URL, back into the proxy.
  rewrites: async () => {
    const hostname = leagueHostname();
    if (!hostname) return [];
    const has = [{ type: "host" as const, value: hostname }];
    return { beforeFiles: [
      { source: "/", has, destination: "/league" },
      // beforeFiles rewrites chain, so a path already under /league is left alone.
      { source: "/:path((?!api/|_next/|_vercel/|league(?:/|$))[^.]+)", has, destination: "/league/:path" },
    ] };
  },
  redirects: async () => [
    { source: "/directions/:world*", destination: "/", permanent: true },
    { source: "/footer-directions", destination: "/", permanent: true },
    { source: "/apresiasi", destination: "/dashboard/apresiasi", permanent: true },
    { source: "/apresiasi/admin", destination: "/dashboard/apresiasi/tinjau", permanent: true },
    // A member card's QR opens /k/<token>; the bare path has nothing to show.
    { source: "/k", destination: "/", permanent: false },
    // Printed as a QR on the member intake posts (#201). Temporary, so a new edition can replace the file behind it.
    { source: "/gb-member", destination: "/guidebook/member-2026-27.pdf", permanent: false },
  ],
};

export default nextConfig;

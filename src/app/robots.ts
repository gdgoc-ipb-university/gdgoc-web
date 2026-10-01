import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// The dashboard, onboarding, and design-review pages stay crawlable so their `noindex` tags can be read.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}

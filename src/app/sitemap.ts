import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// Only the indexable pages; everything else is `noindex`.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${siteUrl}/` }, { url: `${siteUrl}/tech-league` }, { url: `${siteUrl}/privasi` }];
}

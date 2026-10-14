import type { MetadataRoute } from "next";
import { indexablePaths, siteUrl } from "@/lib/site";

// Only the indexable pages; everything else is `noindex`.
export default function sitemap(): MetadataRoute.Sitemap {
  return indexablePaths.map((path) => ({ url: `${siteUrl}${path}` }));
}

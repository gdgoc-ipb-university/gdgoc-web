import { siteUrl } from "@/lib/site";

type BreadcrumbItem = { name: string; path: string };

/** `BreadcrumbList` JSON-LD for a public page: Beranda, then each item after it. The trail should match the URL path. */
export function breadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Beranda", item: siteUrl },
      ...items.map(({ name, path }, index) => ({
        "@type": "ListItem",
        position: index + 2,
        name,
        item: `${siteUrl}${path}`,
      })),
    ],
  };
}

import { describe, expect, it } from "vitest";
import { breadcrumbJsonLd } from "./breadcrumb";
import { indexablePaths, siteUrl } from "./site";

describe("breadcrumb structured data", () => {
  it("starts at Beranda and numbers each step after it, with absolute URLs", () => {
    expect(breadcrumbJsonLd([{ name: "Program", path: "/program" }, { name: "Tech League", path: "/program/tech-league" }])).toEqual({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Beranda", item: siteUrl },
        { "@type": "ListItem", position: 2, name: "Program", item: `${siteUrl}/program` },
        { "@type": "ListItem", position: 3, name: "Tech League", item: `${siteUrl}/program/tech-league` },
      ],
    });
  });

  it("lists the program hub in the sitemap", () => {
    expect(indexablePaths).toContain("/program");
  });
});

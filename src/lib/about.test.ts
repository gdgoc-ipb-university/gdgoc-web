import { describe, expect, it } from "vitest";
import { about, aboutPageJsonLd } from "./about";
import { indexablePaths, siteUrl } from "./site";

describe("about page", () => {
  it("lists the three missions in order", () => {
    expect(about.missions.map((mission) => mission.name)).toEqual(["Structured Learning", "Applied Growth", "Connected Ecosystem"]);
  });

  it("describes /tentang as an AboutPage of the landing's Organization and WebSite", () => {
    expect(aboutPageJsonLd()).toMatchObject({
      "@type": "AboutPage",
      url: `${siteUrl}/tentang`,
      about: { "@id": `${siteUrl}/#organization` },
      isPartOf: { "@id": `${siteUrl}/#website` },
    });
    expect(indexablePaths).toContain(about.path);
  });
});

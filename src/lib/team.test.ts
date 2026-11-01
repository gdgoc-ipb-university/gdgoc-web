import { describe, expect, it } from "vitest";
import { siteUrl } from "./site";
import { leaderInitial, team, teamJsonLd, type Leader } from "./team";

describe("team page", () => {
  it("names the Lead and Co-Lead and lists the five divisions without staff", () => {
    expect(team.leaders.map((leader) => leader.role)).toEqual(["Lead", "Co-Lead"]);
    expect(team.divisions.map((division) => division.name)).toEqual(["Program & Development", "Community & External", "Media & Creative", "Technical", "Secretary-Treasurer"]);
    for (const division of team.divisions) expect(Object.keys(division)).toEqual(["name", "purpose"]);
  });

  it("keeps the copy free of em dashes", () => {
    expect(JSON.stringify(team)).not.toContain("—");
  });

  it("falls back to the role's letter while a name is not set", () => {
    expect(leaderInitial({ name: "dika", role: "Lead" })).toBe("D");
    expect(leaderInitial({ name: null, role: "Co-Lead" })).toBe("C");
  });

  it("describes each named leader as a Person working for the landing's Organization", () => {
    const people = teamJsonLd()["@graph"];
    expect(people).toHaveLength(2);
    expect(people[0]).toEqual({
      "@type": "Person",
      "@id": `${siteUrl}/tim#lead`,
      name: "Dika Aprilio Wibowo",
      jobTitle: `Lead GDGoC IPB ${team.year}`,
      worksFor: { "@id": `${siteUrl}/#organization` },
      url: `${siteUrl}/tim`,
    });
  });

  it("adds a photo and profile links once approved, and leaves out unnamed slots", () => {
    const leaders: Leader[] = [
      { key: "lead", role: "Lead", name: "Contoh Lead", photo: "/team/lead.jpg", links: [{ label: "LinkedIn", href: "https://www.linkedin.com/in/contoh" }] },
      { key: "co-lead", role: "Co-Lead", name: null, photo: null, links: null },
    ];
    const people = teamJsonLd(leaders)["@graph"];
    expect(people).toHaveLength(1);
    expect(people[0]).toMatchObject({ image: `${siteUrl}/team/lead.jpg`, sameAs: ["https://www.linkedin.com/in/contoh"] });
  });
});

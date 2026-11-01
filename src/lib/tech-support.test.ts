import { describe, expect, it } from "vitest";
import { communityLinks } from "./community";
import { faqJsonLd, faqText } from "./faq";
import { indexablePaths, siteUrl } from "./site";
import { requestLink, techSupport, techSupportFaq, techSupportJsonLd } from "./tech-support";

describe("Tech Support", () => {
  it("walks a request through the five steps, from the request to the agreed scope", () => {
    expect(techSupport.steps.map((step) => step.title)).toEqual([
      "Ajukan permintaan mentoring",
      "Ceritakan kompetisi dan progresmu",
      "GDGoC mencarikan mentor",
      "Konsultasi pertama",
      "Sepakati cakupan pendampingan",
    ]);
    expect(techSupport.responseDays).toBe(3);
  });

  it("lists the eight kinds of help and the three confirmed mentors, each with a role line", () => {
    expect(techSupport.helpKinds).toHaveLength(8);
    expect(techSupport.helpKinds).toEqual(expect.arrayContaining(["Mencari rekan tim", "Mock judging", "Latihan presentasi"]));
    expect(techSupport.mentors.map((mentor) => mentor.name.split(" ")[0])).toEqual(["Badzlan", "Dika", "Maghfira"]);
    for (const mentor of techSupport.mentors) expect(mentor.role).not.toBe("");
  });

  it("sends members to Instagram until the dashboard form exists", () => {
    expect(techSupport.requestPath).toBeNull();
    expect(requestLink()).toEqual({ label: "Tanya alur mentoring", href: communityLinks.instagram, external: true });
    const how = techSupportFaq.find((item) => item.question === "Bagaimana cara mengajukan?");
    expect(how?.answer).toContainEqual({ text: "Instagram @gdgoc.ipb", href: communityLinks.instagram });
  });

  it("keeps the reply time, the join page and the FAQPage markup in step with the FAQ", () => {
    expect(faqText(techSupportFaq[2].answer)).toBe("Permintaan dibalas paling lama 3 hari kerja.");
    expect(techSupportFaq[0].answer).toContainEqual({ text: "cara bergabung", href: "/bergabung" });
    const faq = faqJsonLd(techSupportFaq);
    expect(faq.mainEntity.map((entry) => entry.name)).toEqual(techSupportFaq.map((item) => item.question));
    for (const entry of faq.mainEntity) expect(entry.acceptedAnswer.text).toMatch(/\.$/);
  });

  it("describes the program as a mentoring Service of the chapter, listing every kind of help", () => {
    const service = techSupportJsonLd();
    expect(service).toMatchObject({ "@type": "Service", serviceType: "Mentoring", url: `${siteUrl}/program/tech-support` });
    expect(service.provider["@id"]).toBe(`${siteUrl}/#organization`);
    expect(service.hasOfferCatalog.itemListElement.map((offer) => offer.itemOffered.name)).toEqual([...techSupport.helpKinds]);
    expect(indexablePaths).toContain(techSupport.path);
  });
});

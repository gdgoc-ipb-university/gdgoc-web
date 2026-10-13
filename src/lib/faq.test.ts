import { describe, expect, it } from "vitest";
import { faqJsonLd, faqText, type FaqItem } from "./faq";

const items: FaqItem[] = [
  { question: "Ada biaya?", answer: ["Gratis."] },
  { question: "Ke mana bertanya?", answer: ["Kirim pesan ke ", { text: "Instagram @gdgoc.ipb", href: "https://www.instagram.com/gdgoc.ipb/" }, "."] },
];

describe("FAQ", () => {
  it("reads an answer with links as the text a visitor sees", () => {
    expect(faqText(items[1].answer)).toBe("Kirim pesan ke Instagram @gdgoc.ipb.");
  });

  it("gives every question to FAQPage JSON-LD in page order", () => {
    expect(faqJsonLd(items)).toEqual({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        { "@type": "Question", name: "Ada biaya?", acceptedAnswer: { "@type": "Answer", text: "Gratis." } },
        { "@type": "Question", name: "Ke mana bertanya?", acceptedAnswer: { "@type": "Answer", text: "Kirim pesan ke Instagram @gdgoc.ipb." } },
      ],
    });
  });
});

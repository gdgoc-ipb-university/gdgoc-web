/** An answer is text with optional links, so the page and its FAQPage JSON-LD read from one source. */
export type FaqPart = string | { text: string; href: string };
export type FaqItem = { question: string; answer: readonly FaqPart[] };

export function faqText(answer: readonly FaqPart[]) {
  return answer.map((part) => (typeof part === "string" ? part : part.text)).join("");
}

export function faqJsonLd(items: readonly FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(({ question, answer }) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: faqText(answer) } })),
  };
}

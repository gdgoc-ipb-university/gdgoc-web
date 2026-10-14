import type { FaqItem } from "@/lib/faq";

/** A question list; links in an answer open in a new tab. Pair it with `faqJsonLd` on the same items. */
export function Faq({ items, className }: { items: readonly FaqItem[]; className?: string }) {
  return <dl className={className}>{items.map(({ question, answer }) => <div key={question}>
    <dt>{question}</dt>
    <dd>{answer.map((part, index) => typeof part === "string" ? part : <a key={index} href={part.href} target="_blank" rel="noreferrer">{part.text}</a>)}</dd>
  </div>)}</dl>;
}

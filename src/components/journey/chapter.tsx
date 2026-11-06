/**
 * One chapter of the landing's member journey (#165). Each chapter draws its stretch of road along its top edge and
 * down one side; the sides alternate, so stacked chapters join into one road that winds down the page. The badge is
 * the chapter's level marker, sitting on the road where it enters the chapter.
 */
export type RoadSide = "left" | "right";

export function Chapter({
  id,
  number,
  label,
  side,
  className = "",
  children,
}: {
  id: string;
  number: string;
  label: string;
  side: RoadSide;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={`chapter ${className}`} data-side={side} data-chapter aria-labelledby={`${id}-heading`}>
      <div className="road" aria-hidden="true">
        <span className="road-top" />
        <span className="road-side" />
        <span className="road-turn road-turn-in" />
        <span className="road-turn road-turn-out" />
      </div>
      <p className="chapter-badge">
        <span className="chapter-number">{number}</span>
        <span className="chapter-label">{label}</span>
      </p>
      {children}
    </section>
  );
}

/** A chapter's headline: the first line in ink, the second in blue, both in Pixelify Sans. */
export function ChapterTitle({ id, lead, accent }: { id: string; lead: string; accent: string }) {
  return (
    <h2 id={`${id}-heading`} className="chapter-title">
      {lead}
      <br />
      <span>{accent}</span>
    </h2>
  );
}

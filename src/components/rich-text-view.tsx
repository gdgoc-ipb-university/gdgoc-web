import type { ReactNode } from "react";
import { parseRichDoc, safeHref, type RichMark, type RichNode } from "@/lib/rich-text";

function withMarks(text: string, marks: RichMark[] = []) {
  let out: ReactNode = text;
  for (const mark of marks) {
    if (mark.type === "bold") out = <strong>{out}</strong>;
    else if (mark.type === "italic") out = <em>{out}</em>;
    else if (mark.type === "underline") out = <u>{out}</u>;
    else if (mark.type === "strike") out = <s>{out}</s>;
    else if (mark.type === "code") out = <code>{out}</code>;
  }
  const link = marks.find((mark) => mark.type === "link");
  const href = link && "attrs" in link ? safeHref(link.attrs.href) : null;
  return href ? <a href={href} target="_blank" rel="noopener noreferrer nofollow ugc">{out}</a> : out;
}

function render(nodes: RichNode[] = []): ReactNode[] {
  return nodes.map((node, index) => {
    const children = render(node.content);
    switch (node.type) {
      case "text": return <span key={index}>{withMarks(node.text ?? "", node.marks)}</span>;
      case "hardBreak": return <br key={index} />;
      case "horizontalRule": return <hr key={index} />;
      // Answers sit under the page's own h1/h2, so the editor's H2/H3 render one level lower.
      case "heading": return node.attrs?.level === 3 ? <h4 key={index} className="rich-h3">{children}</h4> : <h3 key={index} className="rich-h2">{children}</h3>;
      case "bulletList": return <ul key={index}>{children}</ul>;
      case "orderedList": return <ol key={index} start={node.attrs?.start ?? 1}>{children}</ol>;
      case "listItem": return <li key={index}>{children}</li>;
      case "blockquote": return <blockquote key={index}>{children}</blockquote>;
      case "codeBlock": return <pre key={index}><code>{children}</code></pre>;
      default: return <p key={index}>{children.length ? children : <br />}</p>;
    }
  });
}

/** Renders a stored rich answer through the allowlist; falls back to the plain-text copy. */
export function RichTextView({ json, text, className = "" }: { json?: string | null; text: string; className?: string }) {
  const doc = parseRichDoc(json);
  if (!doc) return <div className={`rich-text rich-text-plain ${className}`}>{text}</div>;
  return <div className={`rich-text ${className}`}>{render(doc.content)}</div>;
}

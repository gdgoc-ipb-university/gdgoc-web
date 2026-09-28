/**
 * Rich answers are Tiptap (ProseMirror) JSON. The server and the renderer rebuild every
 * document through this allowlist, so only known nodes, marks, and http(s)/mailto links survive.
 */
export type RichMark = { type: "bold" | "italic" | "underline" | "strike" | "code" } | { type: "link"; attrs: { href: string } };
export type RichNode = {
  type: string;
  attrs?: { level?: 2 | 3; start?: number };
  content?: RichNode[];
  text?: string;
  marks?: RichMark[];
};
export type RichDoc = { type: "doc"; content: RichNode[] };

export const richLimits = { json: 120_000, nodes: 5_000, depth: 24, text: 10_000 } as const;

type Slot = "block" | "inline" | "item" | "code";
const slots: Record<Slot, Set<string>> = {
  block: new Set(["paragraph", "heading", "bulletList", "orderedList", "blockquote", "codeBlock", "horizontalRule"]),
  inline: new Set(["text", "hardBreak"]),
  item: new Set(["listItem"]),
  code: new Set(["text"]),
};
const childSlot: Record<string, Slot> = {
  paragraph: "inline", heading: "inline", codeBlock: "code",
  bulletList: "item", orderedList: "item", listItem: "block", blockquote: "block",
};
const needsContent = new Set(["bulletList", "orderedList", "listItem", "blockquote"]);
const simpleMarks = new Set(["bold", "italic", "underline", "strike", "code"]);

class Invalid extends Error {}
function fail(): never { throw new Invalid(); }
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** Only absolute http(s) and mailto links are kept; anything else loses its link. */
export function safeHref(value: unknown) {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value.trim());
    return ["http:", "https:", "mailto:"].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

function cleanMarks(value: unknown, formatting: boolean): RichMark[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 8) fail();
  const marks = new Map<string, RichMark>();
  for (const mark of value) {
    if (!isRecord(mark) || typeof mark.type !== "string") fail();
    if (!formatting) continue;
    if (mark.type === "link") {
      const href = safeHref(isRecord(mark.attrs) ? mark.attrs.href : undefined);
      if (href) marks.set("link", { type: "link", attrs: { href } });
    } else if (simpleMarks.has(mark.type)) marks.set(mark.type, { type: mark.type } as RichMark);
    else fail();
  }
  return marks.size ? [...marks.values()] : undefined;
}

function cleanNode(value: unknown, slot: Slot, state: { nodes: number }, depth: number): RichNode {
  if (depth > richLimits.depth || ++state.nodes > richLimits.nodes || !isRecord(value) || typeof value.type !== "string" || !slots[slot].has(value.type)) fail();
  const type = value.type;
  if (type === "text") {
    if (typeof value.text !== "string" || !value.text || value.text.length > richLimits.text) fail();
    const marks = cleanMarks(value.marks, slot !== "code");
    return marks ? { type, text: value.text, marks } : { type, text: value.text };
  }
  if (type === "hardBreak" || type === "horizontalRule") return { type };
  const node: RichNode = { type };
  const attrs = isRecord(value.attrs) ? value.attrs : {};
  if (type === "heading") node.attrs = { level: Number(attrs.level) >= 3 ? 3 : 2 };
  if (type === "orderedList") {
    const start = Number(attrs.start ?? 1);
    node.attrs = { start: Number.isInteger(start) && start >= 1 && start <= 10_000 ? start : 1 };
  }
  if (value.content !== undefined) {
    if (!Array.isArray(value.content)) fail();
    const content = value.content.map((child) => cleanNode(child, childSlot[type], state, depth + 1));
    if (content.length) node.content = content;
  }
  if (needsContent.has(type) && !node.content) fail();
  return node;
}

/** A clean copy of a Tiptap document, or null when it contains anything outside the allowlist. */
export function sanitizeRichDoc(value: unknown): RichDoc | null {
  if (!isRecord(value) || value.type !== "doc" || !Array.isArray(value.content)) return null;
  try {
    const state = { nodes: 0 };
    return { type: "doc", content: value.content.map((child) => cleanNode(child, "block", state, 1)) };
  } catch (error) {
    if (error instanceof Invalid) return null;
    throw error;
  }
}

export function parseRichDoc(json: string | null | undefined) {
  if (!json || json.length > richLimits.json) return null;
  try { return sanitizeRichDoc(JSON.parse(json)); } catch { return null; }
}

const inlineParents = new Set(["paragraph", "heading", "codeBlock"]);
function textOf(node: RichNode | RichDoc): string {
  if (node.type === "text") return (node as RichNode).text ?? "";
  if (node.type === "hardBreak") return "\n";
  return (node.content ?? []).map(textOf).join(inlineParents.has(node.type) ? "" : "\n");
}

/** Readable plain text, used for previews, search, and older clients. */
export function richText(doc: RichDoc) {
  return textOf(doc).replace(/\n{3,}/g, "\n\n").trim();
}

/** Characters as the editor's counter sees them: text plus one per line break or divider. */
export function richLength(doc: RichDoc | RichNode): number {
  if (doc.type === "text") return (doc as RichNode).text?.length ?? 0;
  if (doc.type === "hardBreak" || doc.type === "horizontalRule") return 1;
  return (doc.content ?? []).reduce((total, child) => total + richLength(child), 0);
}

/** Older plain-text answers open in the editor as one paragraph per line. */
export function docFromPlainText(text: string): RichDoc {
  const lines = text.split(/\r?\n/);
  return { type: "doc", content: lines.map((line) => (line ? { type: "paragraph", content: [{ type: "text", text: line }] } : { type: "paragraph" })) };
}

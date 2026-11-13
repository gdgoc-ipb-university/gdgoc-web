import { docFromPlainText, richText } from "@/lib/rich-text";
import type { RichTextEditor } from "./rich-text-editor";

/**
 * A textarea that stands in for RichTextEditor in component tests, because JSDOM cannot type into ProseMirror; the real
 * editor is covered in rich-text-editor.test.tsx. Typed text reaches `onChange` as one paragraph per line, and like the
 * editor it is not a form control, so `required` is only announced (aria-required) and never blocks a form. Use it with
 * `vi.mock("./rich-text-editor", async () => ({ RichTextEditor: (await import("./rich-text-editor.stub")).RichTextEditorStub }))`.
 */
export function RichTextEditorStub({ id, labelledBy, describedBy, initialDoc, onChange, focusRef, disabled, required, invalid }: Parameters<typeof RichTextEditor>[0]) {
  return <textarea id={id} aria-labelledby={labelledBy} aria-describedby={describedBy} defaultValue={richText(initialDoc)} disabled={disabled} aria-required={required || undefined} aria-invalid={invalid || undefined}
    ref={(element) => { if (focusRef) focusRef.current = () => element?.focus(); }}
    onChange={(event) => onChange(docFromPlainText(event.target.value))} />;
}

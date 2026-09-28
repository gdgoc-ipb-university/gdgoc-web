"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import { safeHref, type RichDoc } from "@/lib/rich-text";
import { PixelIcon, type PixelIconName } from "../pixel-icons";

type Tool = { key: string; label: string; icon: PixelIconName; keys?: string; active?: boolean; disabled?: boolean; run: (editor: Editor) => void };

const shortcut = (keys?: string) => keys ? keys.split(" ").map((key) => `Control+${key} Meta+${key}`).join(" ") : undefined;

/** Tiptap editor with a pixel-icon toolbar (WAI-ARIA toolbar pattern) and an inline link bar. */
export function RichTextEditor({ id, labelledBy, describedBy, initialDoc, onChange, disabled = false, maxLength, placeholder, focusRef }: {
  id: string; labelledBy: string; describedBy?: string; initialDoc: RichDoc; onChange: (doc: RichDoc) => void;
  disabled?: boolean; maxLength: number; placeholder: string; focusRef?: RefObject<(() => void) | null>;
}) {
  const change = useRef(onChange);
  const [linkOpen, setLinkOpen] = useState(false);
  useEffect(() => { change.current = onChange; }, [onChange]);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: {
          openOnClick: false, autolink: true, defaultProtocol: "https",
          isAllowedUri: (url) => safeHref(url) !== null,
          HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
        },
      }),
      Placeholder.configure({ placeholder }),
      CharacterCount.configure({ limit: maxLength }),
    ],
    content: initialDoc,
    editable: !disabled,
    editorProps: {
      attributes: { id, role: "textbox", "aria-multiline": "true", "aria-labelledby": labelledBy, ...(describedBy ? { "aria-describedby": describedBy } : {}), class: "rich-text rich-editor-content" },
      handleKeyDown: (_view, event) => {
        if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === "k") { event.preventDefault(); setLinkOpen(true); return true; }
        return false;
      },
    },
    onUpdate: ({ editor }) => change.current(editor.getJSON() as RichDoc),
  });
  const state = useEditorState({
    editor,
    // The hook's snapshot keeps `editor: null` until the first transaction after creation,
    // so fall back to the instance from useEditor or the toolbar would never appear.
    selector: ({ editor: current }) => {
      const active = current ?? editor;
      return active && {
        bold: active.isActive("bold"), italic: active.isActive("italic"), underline: active.isActive("underline"), strike: active.isActive("strike"),
        code: active.isActive("code"), h2: active.isActive("heading", { level: 2 }), h3: active.isActive("heading", { level: 3 }),
        bullet: active.isActive("bulletList"), ordered: active.isActive("orderedList"), quote: active.isActive("blockquote"),
        codeBlock: active.isActive("codeBlock"), link: active.isActive("link"),
        canUndo: active.can().undo(), canRedo: active.can().redo(), count: active.storage.characterCount.characters(),
      };
    },
  });
  useEffect(() => { editor?.setEditable(!disabled, false); }, [editor, disabled]);
  useEffect(() => {
    if (!focusRef) return;
    focusRef.current = () => editor?.commands.focus("end");
    return () => { focusRef.current = null; };
  }, [editor, focusRef]);

  if (!editor || !state) return <div className="rich-editor" data-loading="true"><div className="rich-toolbar" aria-hidden="true" /><div className="rich-editor-content rich-editor-skeleton" role="status">Menyiapkan editor…</div></div>;

  const groups: Tool[][] = [
    [
      { key: "bold", label: "Tebal", icon: "bold", keys: "B", active: state.bold, run: (e) => e.chain().focus().toggleBold().run() },
      { key: "italic", label: "Miring", icon: "italic", keys: "I", active: state.italic, run: (e) => e.chain().focus().toggleItalic().run() },
      { key: "underline", label: "Garis bawah", icon: "underline", keys: "U", active: state.underline, run: (e) => e.chain().focus().toggleUnderline().run() },
      { key: "strike", label: "Coret", icon: "strikethrough", active: state.strike, run: (e) => e.chain().focus().toggleStrike().run() },
      { key: "code", label: "Kode", icon: "code", keys: "E", active: state.code, run: (e) => e.chain().focus().toggleCode().run() },
    ],
    [
      { key: "h2", label: "Judul", icon: "heading-2", active: state.h2, run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
      { key: "h3", label: "Subjudul", icon: "heading-3", active: state.h3, run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
      { key: "bullet", label: "Daftar poin", icon: "bulletlist", active: state.bullet, run: (e) => e.chain().focus().toggleBulletList().run() },
      { key: "ordered", label: "Daftar bernomor", icon: "list-ordered", active: state.ordered, run: (e) => e.chain().focus().toggleOrderedList().run() },
      { key: "quote", label: "Kutipan", icon: "quote-text-inline", active: state.quote, run: (e) => e.chain().focus().toggleBlockquote().run() },
      { key: "codeBlock", label: "Blok kode", icon: "terminal", active: state.codeBlock, run: (e) => e.chain().focus().toggleCodeBlock().run() },
    ],
    [{ key: "link", label: state.link ? "Ubah tautan" : "Tautan", icon: "link", keys: "K", active: state.link || linkOpen, run: () => setLinkOpen(true) }],
    [
      { key: "undo", label: "Urungkan", icon: "undo", keys: "Z", disabled: !state.canUndo, run: (e) => e.chain().focus().undo().run() },
      { key: "redo", label: "Ulangi", icon: "redo", disabled: !state.canRedo, run: (e) => e.chain().focus().redo().run() },
    ],
  ];
  const near = state.count >= maxLength * 0.9;
  return <div className="rich-editor" data-disabled={disabled}>
    <Toolbar editor={editor} groups={groups} controls={id} disabled={disabled} />
    {linkOpen && <LinkBar editor={editor} onClose={() => { setLinkOpen(false); editor.commands.focus(); }} />}
    <EditorContent editor={editor} className="rich-editor-body" data-lenis-prevent />
    <p className="rich-count" data-near={near}>{state.count.toLocaleString("id-ID")}/{maxLength.toLocaleString("id-ID")} karakter</p>
  </div>;
}

function Toolbar({ editor, groups, controls, disabled }: { editor: Editor; groups: Tool[][]; controls: string; disabled: boolean }) {
  const tools = groups.flat();
  const [focused, setFocused] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  function move(event: KeyboardEvent<HTMLDivElement>) {
    const next = { ArrowRight: focused + 1, ArrowLeft: focused - 1, Home: 0, End: tools.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const index = (next + tools.length) % tools.length;
    setFocused(index);
    buttons.current[index]?.focus();
  }
  const offsets = groups.map((_, groupIndex) => groups.slice(0, groupIndex).reduce((total, group) => total + group.length, 0));
  return <div className="rich-toolbar" role="toolbar" aria-label="Format jawaban" aria-controls={controls} onKeyDown={move}>
    {groups.map((group, groupIndex) => <div key={groupIndex} className="rich-tool-group">{group.map((tool, toolIndex) => {
      const position = offsets[groupIndex] + toolIndex;
      const inactive = disabled || tool.disabled;
      return <button key={tool.key} ref={(element) => { buttons.current[position] = element; }} type="button" className="rich-tool" tabIndex={position === focused ? 0 : -1}
        aria-label={tool.label} title={tool.keys ? `${tool.label} (Ctrl/⌘ + ${tool.keys})` : tool.label} aria-keyshortcuts={shortcut(tool.keys)}
        aria-pressed={tool.key === "undo" || tool.key === "redo" ? undefined : Boolean(tool.active)} aria-disabled={inactive || undefined}
        onFocus={() => setFocused(position)} onMouseDown={(event) => event.preventDefault()} onClick={() => { if (!inactive) tool.run(editor); }}>
        <PixelIcon name={tool.icon} size={20} />
      </button>;
    })}</div>)}
  </div>;
}

function LinkBar({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const current = (editor.getAttributes("link").href as string | undefined) ?? "";
  const [value, setValue] = useState(current);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); input.current?.select(); }, []);
  function apply() {
    const raw = value.trim();
    const href = safeHref(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
    if (!raw || !href) { setError("Gunakan link https://, http://, atau mailto:."); input.current?.focus(); return; }
    const { empty } = editor.state.selection;
    if (empty && !editor.isActive("link")) editor.chain().focus().insertContent({ type: "text", text: raw, marks: [{ type: "link", attrs: { href } }] }).run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    onClose();
  }
  function remove() { editor.chain().focus().extendMarkRange("link").unsetLink().run(); onClose(); }
  return <div className="rich-linkbar" role="group" aria-label="Tautan">
    <label htmlFor="rich-link-url" className="sr-only">Alamat tautan</label>
    <PixelIcon name="link" size={18} />
    <input ref={input} id="rich-link-url" type="url" inputMode="url" autoComplete="url" placeholder="https://contoh.com/demo" value={value} aria-invalid={Boolean(error)} aria-describedby={error ? "rich-link-error" : undefined}
      onChange={(event) => { setValue(event.target.value); setError(""); }}
      onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); apply(); } if (event.key === "Escape") { event.preventDefault(); onClose(); } }} />
    <button type="button" className="text-button" onClick={apply}>Pasang</button>
    {current && <button type="button" className="text-button text-danger" onClick={remove}><PixelIcon name="unlink" size={16} />Lepas</button>}
    <button type="button" className="text-button" onClick={onClose}>Batal</button>
    {error && <p className="field-error" id="rich-link-error" role="alert">{error}</p>}
  </div>;
}

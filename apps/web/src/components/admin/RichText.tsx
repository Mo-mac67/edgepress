"use client";

import { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { useAdminUI } from "./ui";
import { Icon, type IconName } from "@/components/Icon";

const AI_MODES: { mode: string; label: string }[] = [
  { mode: "rewrite", label: "Improve writing" },
  { mode: "expand", label: "Make longer" },
  { mode: "shorten", label: "Make shorter" },
  { mode: "professional", label: "More professional" },
  { mode: "friendly", label: "More friendly" },
  { mode: "fix", label: "Fix spelling & grammar" },
];

/** Proper WYSIWYG built on Tiptap/ProseMirror. Emits clean HTML on edit.
 *  Uncontrolled after mount — parent keys it by a stable id (e.g. locale) to
 *  reset content. */
export function RichText({ value, onChange, placeholder, locale = "en" }: { value: string; onChange: (html: string) => void; placeholder?: string; locale?: string }) {
  const ui = useAdminUI();
  const [aiOpen, setAiOpen] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener", target: "_blank" } }),
      Placeholder.configure({ placeholder: placeholder ?? "Write something…" }),
    ],
    content: value || "<p></p>",
    editorProps: { attributes: { class: "prose min-h-[140px] max-w-none px-3.5 py-3 focus:outline-none" } },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html === "<p></p>" ? "" : html);
    },
  });

  if (!editor) return <div className="min-h-[186px] rounded-lg border border-line bg-sand/40" />;

  const Btn = ({ icon, label, active, onClick }: { icon?: IconName; label?: string; active?: boolean; onClick: () => void }) => (
    <button
      type="button"
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`grid h-8 min-w-8 place-items-center rounded px-1.5 text-sm transition ${active ? "bg-brand text-white" : "text-ink hover:bg-sand"}`}
    >
      {icon ? <Icon name={icon} size={15} /> : <span className="font-bold">{label}</span>}
    </button>
  );

  async function setLink() {
    const prev = editor!.getAttributes("link").href as string | undefined;
    const url = await ui.prompt({ title: "Add link", label: "URL", placeholder: "https://…", defaultValue: prev ?? "" });
    if (url === null) return;
    if (url === "") editor!.chain().focus().unsetLink().run();
    else editor!.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  async function runAi(mode: string) {
    setAiOpen(false);
    const { from, to, empty } = editor!.state.selection;
    const selectedText = empty ? "" : editor!.state.doc.textBetween(from, to, "\n");
    const source = selectedText || editor!.getText();
    if (!source.trim()) {
      ui.toast("Nothing to rewrite", "error");
      return;
    }
    setAiBusy(true);
    try {
      const res = await fetch("/api/admin/ai/write", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, text: source, locale }) });
      const d = await res.json();
      if (!res.ok) {
        ui.toast(d.error || "AI failed", "error");
        return;
      }
      if (selectedText) editor!.chain().focus().insertContentAt({ from, to }, d.text).run();
      else editor!.chain().focus().setContent(d.text.split(/\n{2,}/).map((p: string) => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("")).run();
      onChange(editor!.getHTML());
      ui.toast("Rewritten with AI", "success");
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-line focus-within:border-brand focus-within:ring-2 focus-within:ring-brand-soft">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-line bg-sand/50 p-1">
        <Btn label="B" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} />
        <Btn label="I" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} />
        <span className="mx-0.5 h-5 w-px bg-line" />
        <Btn label="H2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
        <Btn label="H3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
        <span className="mx-0.5 h-5 w-px bg-line" />
        <Btn icon="list" label="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} />
        <Btn label="1." active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
        <Btn label="❝" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
        <span className="mx-0.5 h-5 w-px bg-line" />
        <Btn icon="arrow-up-right" label="Link" active={editor.isActive("link")} onClick={setLink} />
        <div className="relative ml-auto flex gap-0.5">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setAiOpen((o) => !o)}
            disabled={aiBusy}
            className="flex h-8 items-center gap-1 rounded bg-accent-soft px-2 text-xs font-semibold text-accent-dark hover:bg-accent-soft/70"
            title="Rewrite with AI"
          >
            <Icon name="star" size={13} /> {aiBusy ? "…" : "AI"}
          </button>
          <Btn icon="refresh" label="Undo" onClick={() => editor.chain().focus().undo().run()} />
          {aiOpen && (
            <div className="absolute right-0 top-9 z-20 w-48 rounded-lg border border-line bg-white p-1 shadow-lg">
              {AI_MODES.map((m) => (
                <button key={m.mode} type="button" onClick={() => runAi(m.mode)} className="block w-full rounded px-3 py-1.5 text-left text-sm hover:bg-sand">
                  {m.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

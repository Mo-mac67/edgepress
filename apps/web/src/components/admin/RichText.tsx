"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { useAdminUI } from "./ui";
import { Icon, type IconName } from "@/components/Icon";

/** Proper WYSIWYG built on Tiptap/ProseMirror. Emits clean HTML on edit.
 *  Uncontrolled after mount — parent keys it by a stable id (e.g. locale) to
 *  reset content. */
export function RichText({ value, onChange, placeholder }: { value: string; onChange: (html: string) => void; placeholder?: string }) {
  const ui = useAdminUI();
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
        <div className="ml-auto flex gap-0.5">
          <Btn icon="refresh" label="Undo" onClick={() => editor.chain().focus().undo().run()} />
        </div>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

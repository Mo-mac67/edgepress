"use client";

import { useRef } from "react";
import { Icon } from "@/components/Icon";

/** Minimal WYSIWYG built on contentEditable. Emits HTML on edit. Uncontrolled
 *  after mount (parent should key it by a stable id to reset). */
export function RichText({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  function cmd(command: string, arg?: string) {
    document.execCommand(command, false, arg);
    if (ref.current) onChange(ref.current.innerHTML);
    ref.current?.focus();
  }

  const Btn = ({ c, arg, children, title }: { c: string; arg?: string; children: React.ReactNode; title: string }) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
        cmd(c, arg);
      }}
      className="grid h-8 w-8 place-items-center rounded hover:bg-sand"
    >
      {children}
    </button>
  );

  return (
    <div className="rounded-lg border border-line">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-line bg-sand/50 p-1">
        <Btn c="bold" title="Bold"><b className="text-sm">B</b></Btn>
        <Btn c="italic" title="Italic"><i className="text-sm">I</i></Btn>
        <Btn c="formatBlock" arg="<h2>" title="Heading"><span className="text-xs font-bold">H2</span></Btn>
        <Btn c="formatBlock" arg="<h3>" title="Subheading"><span className="text-xs font-bold">H3</span></Btn>
        <Btn c="formatBlock" arg="<p>" title="Paragraph"><span className="text-xs">P</span></Btn>
        <Btn c="insertUnorderedList" title="Bullet list"><Icon name="list" size={15} /></Btn>
        <button
          type="button"
          title="Link"
          onMouseDown={(e) => {
            e.preventDefault();
            const url = window.prompt("Link URL:");
            if (url) cmd("createLink", url);
          }}
          className="grid h-8 w-8 place-items-center rounded hover:bg-sand"
        >
          <Icon name="arrow-up-right" size={15} />
        </button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={() => ref.current && onChange(ref.current.innerHTML)}
        className="prose min-h-[120px] max-w-none p-3 text-sm focus:outline-none"
        dangerouslySetInnerHTML={{ __html: value }}
      />
    </div>
  );
}

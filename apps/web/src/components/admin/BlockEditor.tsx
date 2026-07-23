"use client";

import { useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { MediaField } from "./MediaField";
import { RichText } from "./RichText";
import { BLOCKS, type Block, type FieldDef } from "@/lib/cms-types";
import type { Locale } from "@/i18n/config";

type Val = Record<string, unknown>;

function FieldInput({
  field,
  value,
  locale,
  onChange,
}: {
  field: FieldDef;
  value: unknown;
  locale: Locale;
  onChange: (v: unknown) => void;
}) {
  if (field.localized) {
    const lv = (value as Record<string, string>) ?? { en: "", fr: "" };
    const set = (s: string) => onChange({ ...lv, [locale]: s });
    const cur = lv[locale] ?? "";
    if (field.type === "textarea")
      return <textarea className="field min-h-[80px]" value={cur} onChange={(e) => set(e.target.value)} />;
    if (field.type === "richtext")
      return <RichText key={locale} value={cur} onChange={set} locale={locale} />;
    return <input className="field" value={cur} onChange={(e) => set(e.target.value)} />;
  }

  switch (field.type) {
    case "image":
      return <MediaField value={(value as string) ?? ""} onChange={onChange} />;
    case "textarea":
      return <textarea className="field min-h-[80px]" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "select":
      return (
        <select className="field" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)}>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case "toggle":
      return (
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
          <span className="text-sm text-ink-soft">Yes</span>
        </label>
      );
    case "list":
      return <ListField field={field} value={(value as Val[]) ?? []} locale={locale} onChange={onChange} />;
    default:
      return <input className="field" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />;
  }
}

function ListField({
  field,
  value,
  locale,
  onChange,
}: {
  field: FieldDef;
  value: Val[];
  locale: Locale;
  onChange: (v: Val[]) => void;
}) {
  const itemFields = field.itemFields ?? [];
  const newItem = (): Val => {
    const o: Val = {};
    for (const f of itemFields) o[f.key] = f.localized ? { en: "", fr: "" } : f.type === "toggle" ? false : "";
    return o;
  };
  const update = (i: number, key: string, v: unknown) => {
    const next = value.slice();
    next[i] = { ...next[i], [key]: v };
    onChange(next);
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = value.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {value.map((item, i) => (
        <div key={i} className="rounded-lg border border-line bg-sand/40 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-soft">Item {i + 1}</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => move(i, -1)} className="rounded p-1 hover:bg-white" title="Up"><Icon name="arrow-left" size={14} className="rotate-90" /></button>
              <button type="button" onClick={() => move(i, 1)} className="rounded p-1 hover:bg-white" title="Down"><Icon name="arrow-right" size={14} className="rotate-90" /></button>
              <button type="button" onClick={() => onChange(value.filter((_, k) => k !== i))} className="rounded p-1 text-red-600 hover:bg-white" title="Remove"><Icon name="trash" size={14} /></button>
            </div>
          </div>
          <div className="grid gap-2">
            {itemFields.map((f) => (
              <label key={f.key} className="block">
                <span className="mb-1 block text-xs font-medium text-ink-soft">{f.label}</span>
                <FieldInput field={f} value={item[f.key]} locale={locale} onChange={(v) => update(i, f.key, v)} />
              </label>
            ))}
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...value, newItem()])} className="btn-secondary py-2 text-sm">
        <Icon name="check" size={15} />
        {field.addLabel ?? "Add item"}
      </button>
    </div>
  );
}

export function BlockEditor({
  block,
  locale,
  onChange,
  onDelete,
  onDuplicate,
  onMove,
  index,
  total,
}: {
  block: Block;
  locale: Locale;
  onChange: (b: Block) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMove: (dir: -1 | 1) => void;
  index: number;
  total: number;
}) {
  const [open, setOpen] = useState(false);
  const def = BLOCKS[block.type];
  const setField = (key: string, v: unknown) => onChange({ ...block, data: { ...block.data, [key]: v } });

  return (
    <div className="rounded-xl border border-line bg-white">
      <div className="flex items-center gap-2 p-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
          <Icon name={def.icon as IconName} size={16} />
        </span>
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex-1 text-left font-semibold text-brand">
          {def.label}
        </button>
        <button type="button" onClick={() => onMove(-1)} disabled={index === 0} className="rounded p-1 hover:bg-sand disabled:opacity-30" title="Move up">
          <Icon name="arrow-left" size={16} className="rotate-90" />
        </button>
        <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} className="rounded p-1 hover:bg-sand disabled:opacity-30" title="Move down">
          <Icon name="arrow-right" size={16} className="rotate-90" />
        </button>
        <button type="button" onClick={onDuplicate} className="rounded p-1 hover:bg-sand" title="Duplicate block" aria-label="Duplicate block">
          <Icon name="edit" size={16} />
        </button>
        <button type="button" onClick={onDelete} className="rounded p-1 text-red-600 hover:bg-sand" title="Delete block" aria-label="Delete block">
          <Icon name="trash" size={16} />
        </button>
        <button type="button" onClick={() => setOpen((o) => !o)} className="rounded p-1 hover:bg-sand">
          <Icon name="chevron-down" size={16} className={open ? "rotate-180" : ""} />
        </button>
      </div>
      {open && (
        <div className="space-y-3 border-t border-line p-4">
          {def.fields.map((f) => (
            <label key={f.key} className="block">
              <span className="mb-1 block text-sm font-medium text-ink">{f.label}</span>
              <FieldInput field={f} value={block.data[f.key]} locale={locale} onChange={(v) => setField(f.key, v)} />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

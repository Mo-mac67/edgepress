"use client";

export interface Segment {
  label: string;
  value: number;
  valueLabel: string;
  color: string;
}

export function Donut({
  segments,
  centerLabel,
  centerSub,
  size = 180,
  thickness = 28,
}: {
  segments: Segment[];
  centerLabel: string;
  centerSub?: string;
  size?: number;
  thickness?: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const radius = (size - thickness) / 2;
  const circ = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={centerLabel}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--color-line)" strokeWidth={thickness} />
          {segments.map((s, i) => {
            const len = (s.value / total) * circ;
            const el = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeDasharray={`${len} ${circ - len}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
        </g>
        <text x="50%" y="47%" textAnchor="middle" className="fill-[var(--color-ink)]" style={{ fontSize: 22, fontWeight: 600 }}>
          {centerLabel}
        </text>
        {centerSub && (
          <text x="50%" y="60%" textAnchor="middle" className="fill-[var(--color-ink-soft)]" style={{ fontSize: 12 }}>
            {centerSub}
          </text>
        )}
      </svg>
      <ul className="flex-1 space-y-2">
        {segments.map((s, i) => (
          <li key={i} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </span>
            <span className="font-semibold">{s.valueLabel}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TimeBars({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  const many = items.length > 16;
  const labelEvery = Math.ceil(items.length / 8);
  return (
    <div className="flex h-36 w-full items-end gap-px overflow-hidden">
      {items.map((b, i) => {
        const showLabel = !many || i === 0 || i === items.length - 1 || i % labelEvery === 0;
        return (
          <div key={i} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${b.label}: ${b.value}`}>
            {!many && <span className="text-[10px] font-medium text-ink-soft">{b.value > 0 ? b.value : ""}</span>}
            <div
              className="w-full rounded-t bg-brand"
              style={{ height: `${(b.value / max) * 100}%`, minHeight: b.value > 0 ? 4 : 2, opacity: b.value > 0 ? 1 : 0.25 }}
            />
            <span className="h-3 w-full truncate text-center text-[9px] text-ink-soft">{showLabel ? b.label : ""}</span>
          </div>
        );
      })}
    </div>
  );
}

export interface Bar {
  label: string;
  value: number;
  valueLabel: string;
}

export function BarList({ items, color = "var(--color-brand)" }: { items: Bar[]; color?: string }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="space-y-3">
      {items.map((b, i) => (
        <li key={i}>
          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
            <span className="truncate">{b.label}</span>
            <span className="font-semibold text-accent-dark">{b.valueLabel}</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full" style={{ width: `${Math.max(4, (b.value / max) * 100)}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

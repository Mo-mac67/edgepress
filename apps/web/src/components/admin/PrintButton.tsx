"use client";

/** Triggers the browser's print dialog → "Save as PDF". Hidden when printing. */
export function PrintButton({ label = "Print / Save as PDF" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn-primary no-print">
      {label}
    </button>
  );
}

/** EdgePress logo mark — a rounded tile with stacked "edge" chevrons.
 *  Uses theme tokens so it recolors with the active theme. Matches icon.svg. */
export function BrandMark({ size = 38 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="40" height="40" rx="10" fill="var(--color-brand-dark, #0e2438)" />
      <g fill="none" stroke="var(--color-accent, #dca02c)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 12 22 20l-8 8" />
        <path d="M22 12l8 8-8 8" opacity="0.55" />
      </g>
    </svg>
  );
}

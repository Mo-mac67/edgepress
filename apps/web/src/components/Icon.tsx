import type { SVGProps } from "react";

type IconName =
  | "bolt"
  | "leaf"
  | "home"
  | "building"
  | "check"
  | "arrow-right"
  | "arrow-left"
  | "phone"
  | "map-pin"
  | "map-pin-check"
  | "search"
  | "download"
  | "x"
  | "chevron-down"
  | "sun"
  | "info"
  | "menu"
  | "refresh"
  | "grip"
  | "chart"
  | "gavel"
  | "tools"
  | "user"
  | "list"
  | "mail"
  | "lock"
  | "trash"
  | "edit"
  | "image"
  | "star"
  | "award"
  | "shield"
  | "hammer"
  | "ruler"
  | "quote"
  | "clock"
  | "hard-hat"
  | "grid"
  | "code"
  | "arrow-up-right"
  | "loan"
  | "logout"
  | "instagram"
  | "linkedin"
  | "youtube"
  | "facebook";

const PATHS: Record<IconName, React.ReactNode> = {
  bolt: <path d="M13 2 4.5 13H11l-1 9 8.5-11H12l1-9Z" />,
  leaf: <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8a7 7 0 0 1-7 7c-1.53 0-3-.5-4-1m0 0V11" />,
  home: <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V9.5Z" />,
  building: <><path d="M5 21V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v17" /><path d="M16 8h3a1 1 0 0 1 1 1v12" /><path d="M2 21h20M9 7h2M9 11h2M9 15h2" /></>,
  check: <path d="m5 12 4.5 4.5L19 7" />,
  "arrow-right": <path d="M5 12h14m-6-6 6 6-6 6" />,
  "arrow-left": <path d="M19 12H5m6 6-6-6 6-6" />,
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L19 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />,
  "map-pin": <><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></>,
  "map-pin-check": <><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" /><path d="m9 10 2 2 4-4" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  download: <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4 12H2m20 0h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  refresh: <><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 4v5h-5" /></>,
  grip: <><circle cx="9" cy="6" r="1" /><circle cx="15" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="9" cy="18" r="1" /><circle cx="15" cy="18" r="1" /></>,
  chart: <><path d="M4 4v16h16" /><path d="M8 16v-4m4 4V8m4 8v-6" /></>,
  gavel: <><path d="m14 3 7 7-3 3-7-7 3-3Z" /><path d="m11 8-6 6 3 3 6-6" /><path d="M4 21h10" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  code: <><path d="m16 18 6-6-6-6" /><path d="m8 6-6 6 6 6" /></>,
  tools: <><path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L4 16.8 7.2 20l5.3-5.3a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.2-2.2 2.6-2.4Z" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  trash: <><path d="M4 7h16M9 7V4h6v3M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M10 11v6M14 11v6" /></>,
  edit: <><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17l-1 3Z" /><path d="m14 7 3 3" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m4 18 5-5 3 3 3-3 5 5" /></>,
  star: <path d="m12 3 2.6 5.6 6 .7-4.4 4.1 1.2 6L12 16.9 6.6 19.4l1.2-6L3.4 9.3l6-.7L12 3Z" />,
  award: <><circle cx="12" cy="9" r="6" /><path d="m8.5 13.5-1.5 7 5-3 5 3-1.5-7" /></>,
  shield: <><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" /><path d="m9 12 2 2 4-4" /></>,
  hammer: <><path d="M14 6l4 4-8 8-4-4 8-8Z" /><path d="M14 6l2.5-2.5a2 2 0 0 1 3 0l1 1a2 2 0 0 1 0 3L18 10" /><path d="m6 14-3 3 4 4 3-3" /></>,
  ruler: <><rect x="3" y="8" width="18" height="8" rx="1" transform="rotate(0 12 12)" /><path d="M7 8v3M11 8v4M15 8v3M19 8v4" /></>,
  quote: <path d="M9 7H5a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h3v2a2 2 0 0 1-2 2m14-10h-4a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h3v2a2 2 0 0 1-2 2" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  "hard-hat": <><path d="M4 16a8 8 0 0 1 16 0" /><path d="M10 8a2 2 0 0 1 4 0v4M10 8c-2 .7-3 2.2-3 4m10-4c2 .7 3 2.2 3 4" /><path d="M3 16h18v2H3z" /></>,
  "arrow-up-right": <path d="M7 17 17 7m0 0H8m9 0v9" />,
  loan: <><circle cx="12" cy="12" r="9" /><path d="M12 7v10m2.5-7.5C13.8 9 13 8.7 12 8.7c-1.7 0-2.5.8-2.5 1.8s.8 1.5 2.5 1.5 2.5.6 2.5 1.6-1 1.7-2.5 1.7c-1 0-1.8-.3-2.5-1" /></>,
  logout: <path d="M9 5H5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h4m6-4 4-4-4-4m4 4H9" />,
  instagram: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><path d="M16.9 7.1h.01" /></>,
  linkedin: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M7.5 10.5v6" /><path d="M7.5 7.5v.01" /><path d="M11.5 16.5v-6" /><path d="M11.5 13.2a2.4 2.4 0 0 1 4.8 0v3.3" /></>,
  youtube: <><rect x="2.5" y="6" width="19" height="12" rx="4" /><path d="m10.5 9.3 5.2 2.7-5.2 2.7z" /></>,
  facebook: <><circle cx="12" cy="12" r="9" /><path d="M13.4 17.5v-4.6h1.7l.3-2.1h-2v-1.3c0-.6.2-1 1-1h1V6.6c-.4 0-1-.1-1.7-.1-1.6 0-2.7 1-2.7 2.8v1.5H9.3v2.1H11v4.6z" /></>,
};

export function Icon({
  name,
  size = 24,
  ...props
}: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {PATHS[name]}
    </svg>
  );
}

export type { IconName };

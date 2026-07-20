"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { locales as builtinLocales, type Locale } from "@/i18n/config";

export function LanguageSwitcher({
  locale,
  locales = [...builtinLocales],
  onDark = false,
}: {
  locale: Locale;
  locales?: string[];
  onDark?: boolean;
}) {
  const pathname = usePathname();

  function pathFor(target: string): string {
    const segments = (pathname || "/").split("/");
    if (locales.includes(segments[1])) {
      segments[1] = target;
    } else {
      segments.splice(1, 0, target);
    }
    return segments.join("/") || `/${target}`;
  }

  if (locales.length < 2) return null;

  return (
    <div className="flex items-center gap-3 text-xs font-semibold tracking-[0.12em]">
      {locales.map((l, i) => (
        <span key={l} className="flex items-center gap-3">
          {i > 0 && <span className={onDark ? "text-white/30" : "text-line"}>/</span>}
          <Link
            href={pathFor(l)}
            className={`transition ${
              l === locale
                ? onDark
                  ? "text-white"
                  : "text-ink"
                : onDark
                  ? "text-white/55 hover:text-white"
                  : "text-ink-soft hover:text-ink"
            }`}
          >
            {l.toUpperCase()}
          </Link>
        </span>
      ))}
    </div>
  );
}

// Built-in locales that ship with translated UI dictionaries. Sites can add
// MORE content locales at runtime (Site settings → Languages); those reuse the
// English UI dictionary and fall back to the default language for untranslated
// content. See getActiveLocales() in cms-store.
export const locales = ["en", "fr"] as const;
/** A locale code. Widened to string so sites can configure any language. */
export type Locale = string;
export const defaultLocale = "en";

/** Display names for common locale codes (fallback: the code, upper-cased). */
export const LOCALE_LABELS: Record<string, string> = {
  en: "English", fr: "Français", es: "Español", de: "Deutsch", it: "Italiano",
  pt: "Português", nl: "Nederlands", sv: "Svenska", pl: "Polski", ar: "العربية",
  fa: "فارسی", tr: "Türkçe", ru: "Русский", uk: "Українська", zh: "中文",
  ja: "日本語", ko: "한국어", hi: "हिन्दी",
};
export function localeLabel(code: string): string {
  return LOCALE_LABELS[code] ?? code.toUpperCase();
}

/** True when `value` is a well-formed locale code (e.g. "en", "pt-br"). Route
 *  handlers additionally check membership in the site's active locales. */
export function isLocale(value: string): boolean {
  return typeof value === "string" && /^[a-z]{2}(-[a-z]{2})?$/i.test(value);
}

export function otherLocale(locale: Locale): Locale {
  return locale === "en" ? "fr" : "en";
}

/** Right-to-left languages — the site renders with dir="rtl" for these. */
export const RTL_LOCALES = new Set(["ar", "fa", "he", "ur", "ps", "sd", "dv", "ug", "yi"]);
export function isRtl(locale: string): boolean {
  return RTL_LOCALES.has((locale || "").slice(0, 2).toLowerCase());
}
export function dir(locale: string): "rtl" | "ltr" {
  return isRtl(locale) ? "rtl" : "ltr";
}

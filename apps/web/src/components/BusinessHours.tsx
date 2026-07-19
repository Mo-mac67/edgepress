"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

/** One day's schedule. `closed` or "appt" (by appointment) instead of times. */
type Day = { open: number; close: number } | "closed" | "appt";

// Mon..Sun (index 0 = Monday). 8:00–18:00 weekdays, Sat by appointment, Sun closed.
const SCHEDULE: Day[] = [
  { open: 8, close: 18 },
  { open: 8, close: 18 },
  { open: 8, close: 18 },
  { open: 8, close: 18 },
  { open: 8, close: 18 },
  "appt",
  "closed",
];
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_NAMES_FR = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

// ─── Ontario statutory holidays (computed, no data source needed) ───────
function easter(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}
function nthMonday(year: number, month: number, n: number): Date {
  const d = new Date(year, month, 1);
  const offset = (8 - d.getDay()) % 7; // days until first Monday
  return new Date(year, month, 1 + offset + (n - 1) * 7);
}
function mondayBefore(d: Date): Date {
  const r = new Date(d);
  const back = (r.getDay() + 6) % 7 || 7; // days back to the previous Monday
  r.setDate(r.getDate() - back);
  return r;
}
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function ontarioHolidays(year: number): Record<string, { en: string; fr: string }> {
  const e = easter(year);
  const goodFriday = new Date(e);
  goodFriday.setDate(e.getDate() - 2);
  const list: [Date, string, string][] = [
    [new Date(year, 0, 1), "New Year's Day", "Jour de l'An"],
    [nthMonday(year, 1, 3), "Family Day", "Jour de la famille"],
    [goodFriday, "Good Friday", "Vendredi saint"],
    [mondayBefore(new Date(year, 4, 25)), "Victoria Day", "Fête de la Reine"],
    [new Date(year, 6, 1), "Canada Day", "Fête du Canada"],
    [nthMonday(year, 7, 1), "Civic Holiday", "Congé civique"],
    [nthMonday(year, 8, 1), "Labour Day", "Fête du Travail"],
    [nthMonday(year, 9, 2), "Thanksgiving", "Action de grâce"],
    [new Date(year, 11, 25), "Christmas Day", "Noël"],
    [new Date(year, 11, 26), "Boxing Day", "Lendemain de Noël"],
  ];
  const out: Record<string, { en: string; fr: string }> = {};
  for (const [d, en, fr] of list) if (en) out[iso(d)] = { en, fr };
  return out;
}

/** "Now" in America/Toronto, as {dowMon0, minutes, isoDate}. */
function torontoNow(): { dow: number; minutes: number; isoDate: string } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  const map: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  const dow = map[parts.weekday] ?? 0;
  const minutes = parseInt(parts.hour, 10) * 60 + parseInt(parts.minute, 10);
  return { dow, minutes, isoDate: `${parts.year}-${parts.month}-${parts.day}` };
}

function fmtTime(h: number): string {
  const period = h >= 12 ? "PM" : "AM";
  const hh = h % 12 || 12;
  return `${hh}:00 ${period}`;
}

export function BusinessHours({ locale = "en", tone = "dark" }: { locale?: "en" | "fr"; tone?: "dark" | "light" }) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState<ReturnType<typeof torontoNow> | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const fr = locale === "fr";

  useEffect(() => {
    setNow(torontoNow());
    const t = setInterval(() => setNow(torontoNow()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const names = fr ? DAY_NAMES_FR : DAY_NAMES;
  const label = (d: Day): string =>
    d === "closed" ? (fr ? "Fermé" : "Closed") : d === "appt" ? (fr ? "Sur rendez-vous" : "By appointment") : `${fmtTime(d.open)} – ${fmtTime(d.close)}`;

  // Holidays for this + next year (covers the upcoming-holidays window at year end).
  const year = now ? Number(now.isoDate.slice(0, 4)) : new Date().getFullYear();
  const holidays = { ...ontarioHolidays(year), ...ontarioHolidays(year + 1) };

  // Status
  let statusText = fr ? "Voir les heures" : "View hours";
  let statusTone: "open" | "closed" | "holiday" = "closed";
  let todayHoliday: { en: string; fr: string } | null = null;
  if (now) {
    todayHoliday = holidays[now.isoDate] ?? null;
    const today = SCHEDULE[now.dow];
    if (todayHoliday) {
      statusTone = "holiday";
      statusText = fr ? "Jour férié — horaire variable" : "Holiday — hours may vary";
    } else if (typeof today === "object" && now.minutes >= today.open * 60 && now.minutes < today.close * 60) {
      statusTone = "open";
      statusText = fr ? `Ouvert · ferme à ${fmtTime(today.close)}` : `Open now · closes ${fmtTime(today.close)}`;
    } else if (today === "appt") {
      statusTone = "closed";
      statusText = fr ? "Sur rendez-vous aujourd'hui" : "By appointment today";
    } else {
      statusTone = "closed";
      statusText = fr ? "Fermé" : "Closed";
    }
  }

  // Upcoming holidays (next 90 days), so the client can see them.
  const upcoming: { date: string; name: string }[] = [];
  if (now) {
    const todayMs = new Date(now.isoDate).getTime();
    for (const [d, n] of Object.entries(holidays)) {
      const diff = (new Date(d).getTime() - todayMs) / 86400000;
      if (diff >= 0 && diff <= 90) upcoming.push({ date: d, name: fr ? n.fr : n.en });
    }
    upcoming.sort((a, b) => a.date.localeCompare(b.date));
  }

  const dark = tone === "dark";
  const dotColor = statusTone === "open" ? "bg-emerald-400" : statusTone === "holiday" ? "bg-amber-400" : dark ? "bg-white/40" : "bg-ink-soft/50";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex items-center gap-2.5 text-left text-sm ${dark ? "text-white/85 hover:text-white" : "text-ink hover:text-brand"}`}
      >
        <Icon name="clock" size={17} className={dark ? "shrink-0 text-accent" : "shrink-0 text-accent-dark"} />
        <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${dotColor}`} />
        <span>{statusText}</span>
        <Icon name="chevron-down" size={14} className={`transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className={`absolute bottom-full z-30 mb-2 w-72 rounded-lg border p-3 shadow-xl ${
            dark ? "border-line-dark bg-brand-dark text-white/85" : "border-line bg-white text-ink"
          }`}
        >
          <ul className="text-sm">
            {SCHEDULE.map((d, i) => (
              <li
                key={i}
                className={`flex items-center justify-between gap-4 rounded px-2 py-1.5 ${
                  now && i === now.dow ? (dark ? "bg-white/10 font-semibold" : "bg-sand font-semibold") : ""
                }`}
              >
                <span>{names[i]}</span>
                <span className={dark ? "text-white/70" : "text-ink-soft"}>{label(d)}</span>
              </li>
            ))}
          </ul>
          {upcoming.length > 0 && (
            <div className={`mt-2 border-t pt-2 ${dark ? "border-line-dark" : "border-line"}`}>
              <p className={`mb-1.5 px-2 text-[0.62rem] font-semibold uppercase tracking-[0.14em] ${dark ? "text-white/45" : "text-ink-soft"}`}>
                {fr ? "Jours fériés à venir (Ontario)" : "Upcoming Ontario holidays"}
              </p>
              <ul className="text-[0.8rem]">
                {upcoming.map((h) => (
                  <li key={h.date} className="flex items-center justify-between gap-4 px-2 py-1">
                    <span className="text-amber-500">{h.name}</span>
                    <span className={dark ? "text-white/55" : "text-ink-soft"}>
                      {new Date(h.date).toLocaleDateString(fr ? "fr-CA" : "en-CA", { month: "short", day: "numeric", timeZone: "UTC" })}
                    </span>
                  </li>
                ))}
              </ul>
              <p className={`mt-1.5 px-2 text-[0.66rem] leading-snug ${dark ? "text-white/45" : "text-ink-soft"}`}>
                {fr
                  ? "Les heures peuvent varier les jours fériés — appelez pour confirmer."
                  : "Hours may vary on holidays — please call to confirm."}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

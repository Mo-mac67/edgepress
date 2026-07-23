import "server-only";
import { randomUUID } from "node:crypto";
import { appendLogItem, readWithCompaction } from "./append-log";
import { readJsonDoc, writeJsonDoc } from "./storage";

/**
 * Appointment booking v1. The owner sets weekly opening hours + a slot
 * length; visitors pick a free slot. Times are the site's local wall time
 * (no timezone math — one business, one timezone). Double-booking is
 * resolved deterministically: earliest createdAt wins, the loser is
 * auto-cancelled on the next read (see resolveConflicts).
 */

export interface DayHours {
  start: string; // "09:00"
  end: string; // "17:00"
}
export interface BookingConfig {
  enabled: boolean;
  slotMinutes: number;
  /** Weekday 0 (Sun) … 6 (Sat) → hours, or null = closed. */
  days: Record<string, DayHours | null>;
}
export interface Booking {
  id: string;
  /** "YYYY-MM-DDTHH:MM" — site-local wall time. */
  slot: string;
  name: string;
  email: string;
  note?: string;
  status: "confirmed" | "cancelled";
  createdAt: string;
}

const CONFIG_KEY = "booking-config.json";
const BOOKINGS_KEY = "bookings.json";
const ITEM_PREFIX = "booking-item-";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const DEFAULT_BOOKING_CONFIG: BookingConfig = {
  enabled: false,
  slotMinutes: 30,
  days: { "0": null, "1": { start: "09:00", end: "17:00" }, "2": { start: "09:00", end: "17:00" }, "3": { start: "09:00", end: "17:00" }, "4": { start: "09:00", end: "17:00" }, "5": { start: "09:00", end: "17:00" }, "6": null },
};

export async function getBookingConfig(): Promise<BookingConfig> {
  const cfg = await readJsonDoc<BookingConfig | null>(CONFIG_KEY, null);
  return cfg ? { ...DEFAULT_BOOKING_CONFIG, ...cfg, days: { ...DEFAULT_BOOKING_CONFIG.days, ...cfg.days } } : DEFAULT_BOOKING_CONFIG;
}

export async function saveBookingConfig(input: Partial<BookingConfig>): Promise<BookingConfig> {
  const cur = await getBookingConfig();
  const next: BookingConfig = {
    enabled: typeof input.enabled === "boolean" ? input.enabled : cur.enabled,
    slotMinutes: [15, 30, 45, 60, 90, 120].includes(Number(input.slotMinutes)) ? Number(input.slotMinutes) : cur.slotMinutes,
    days: cur.days,
  };
  if (input.days && typeof input.days === "object") {
    const days: BookingConfig["days"] = { ...cur.days };
    for (const k of ["0", "1", "2", "3", "4", "5", "6"]) {
      const v = (input.days as Record<string, DayHours | null>)[k];
      if (v === null) days[k] = null;
      else if (v && TIME_RE.test(v.start) && TIME_RE.test(v.end) && v.start < v.end) days[k] = { start: v.start, end: v.end };
    }
    next.days = days;
  }
  await writeJsonDoc(CONFIG_KEY, next);
  return next;
}

/** All slot start times ("HH:MM") the config allows on a weekday. Pure. */
export function slotGrid(config: BookingConfig, weekday: number): string[] {
  const hours = config.days[String(weekday)];
  if (!hours) return [];
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const pad = (n: number) => String(n).padStart(2, "0");
  const out: string[] = [];
  for (let m = toMin(hours.start); m + config.slotMinutes <= toMin(hours.end); m += config.slotMinutes) {
    out.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
  }
  return out;
}

/** Deterministic double-booking resolution: earliest createdAt (then id)
 *  wins per slot; every other confirmed booking of that slot is cancelled. */
export function resolveConflicts(bookings: Booking[]): Booking[] {
  const winners = new Map<string, Booking>();
  for (const b of bookings) {
    if (b.status !== "confirmed") continue;
    const w = winners.get(b.slot);
    if (!w || b.createdAt < w.createdAt || (b.createdAt === w.createdAt && b.id < w.id)) winners.set(b.slot, b);
  }
  return bookings.map((b) => (b.status === "confirmed" && winners.get(b.slot) !== b ? { ...b, status: "cancelled" as const } : b));
}

export async function getBookings(): Promise<Booking[]> {
  const all = await readWithCompaction<Booking>(BOOKINGS_KEY, ITEM_PREFIX);
  return resolveConflicts(all).sort((a, b) => a.slot.localeCompare(b.slot));
}

export async function freeSlots(date: string): Promise<string[]> {
  if (!DATE_RE.test(date)) return [];
  const cfg = await getBookingConfig();
  if (!cfg.enabled) return [];
  const weekday = new Date(`${date}T00:00:00`).getDay();
  const taken = new Set((await getBookings()).filter((b) => b.status === "confirmed" && b.slot.startsWith(date)).map((b) => b.slot.slice(11)));
  return slotGrid(cfg, weekday).filter((t) => !taken.has(t));
}

export async function createBooking(input: { date: string; time: string; name: string; email: string; note?: string }): Promise<Booking | { error: string }> {
  const cfg = await getBookingConfig();
  if (!cfg.enabled) return { error: "Booking is not enabled on this site" };
  const name = String(input.name ?? "").trim().slice(0, 80);
  const email = String(input.email ?? "").trim().toLowerCase().slice(0, 120);
  if (name.length < 2) return { error: "Enter your name" };
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email" };
  if (!DATE_RE.test(input.date) || !TIME_RE.test(input.time)) return { error: "Pick a date and time" };
  const weekday = new Date(`${input.date}T00:00:00`).getDay();
  if (!slotGrid(cfg, weekday).includes(input.time)) return { error: "That time isn't available" };
  const slot = `${input.date}T${input.time}`;
  // Workers run on UTC, whose "today" can be AHEAD of the visitor's local
  // date (western timezones after UTC midnight) — accept yesterday-UTC so
  // same-day evening slots stay bookable everywhere.
  const minDate = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  if (input.date < minDate) return { error: "That date is in the past" };
  if ((await getBookings()).some((b) => b.slot === slot && b.status === "confirmed")) return { error: "That slot was just taken — pick another" };

  const booking: Booking = {
    id: randomUUID().slice(0, 10),
    slot,
    name,
    email,
    ...(input.note ? { note: String(input.note).slice(0, 500) } : {}),
    status: "confirmed",
    createdAt: new Date().toISOString(),
  };
  await appendLogItem(ITEM_PREFIX, booking.id, booking);
  // Race check: if someone else grabbed the slot concurrently, the
  // deterministic resolver decides — reflect the outcome honestly.
  const mine = (await getBookings()).find((b) => b.id === booking.id);
  if (mine?.status !== "confirmed") return { error: "That slot was just taken — pick another" };
  return booking;
}

export async function cancelBooking(id: string): Promise<boolean> {
  const all = await readWithCompaction<Booking>(BOOKINGS_KEY, ITEM_PREFIX);
  const b = all.find((x) => x.id === id);
  if (!b || b.status === "cancelled") return false;
  b.status = "cancelled";
  await writeJsonDoc(BOOKINGS_KEY, all);
  return true;
}

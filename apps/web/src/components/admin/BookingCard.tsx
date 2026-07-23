"use client";

import { useEffect, useState } from "react";
import { useAdminUI } from "./ui";

interface DayHours { start: string; end: string }
interface BookingConfig { enabled: boolean; slotMinutes: number; days: Record<string, DayHours | null> }
interface Booking { id: string; slot: string; name: string; email: string; note?: string; status: string; createdAt: string }

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Appointment booking: weekly availability + upcoming bookings. */
export function BookingCard() {
  const ui = useAdminUI();
  const [config, setConfig] = useState<BookingConfig | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);

  async function load() {
    const res = await fetch("/api/admin/booking");
    if (!res.ok) return;
    const d = await res.json();
    setConfig(d.config);
    setBookings(d.bookings ?? []);
  }
  useEffect(() => { load(); }, []);

  if (!config) return null;

  async function save(next: BookingConfig) {
    setConfig(next);
    const res = await fetch("/api/admin/booking", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
    if (res.ok) ui.toast("Booking settings saved", "success");
  }

  async function cancel(id: string) {
    if (!(await ui.confirm({ title: "Cancel this booking?", danger: true, confirmLabel: "Cancel booking" }))) return;
    await fetch(`/api/admin/booking?id=${id}`, { method: "DELETE" });
    load();
  }

  const upcoming = bookings.filter((b) => b.status === "confirmed" && b.slot >= new Date().toISOString().slice(0, 16));

  return (
    <div className="card mt-6 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display font-bold text-brand">Appointments</h3>
          <p className="text-xs text-ink-soft">Add the <b>Appointment booking</b> block to any page. Times are your local business hours.</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={config.enabled} onChange={(e) => save({ ...config, enabled: e.target.checked })} />
          Booking enabled
        </label>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {DAY_LABELS.map((label, i) => {
          const d = config.days[String(i)];
          return (
            <div key={label} className="rounded-lg border border-line p-2.5 text-sm">
              <label className="flex items-center gap-1.5 font-semibold">
                <input type="checkbox" checked={!!d} onChange={(e) => save({ ...config, days: { ...config.days, [String(i)]: e.target.checked ? { start: "09:00", end: "17:00" } : null } })} />
                {label}
              </label>
              {d && (
                <div className="mt-1.5 flex items-center gap-1">
                  <input type="time" className="field px-1.5 py-1 text-xs" value={d.start} onChange={(e) => save({ ...config, days: { ...config.days, [String(i)]: { ...d, start: e.target.value } } })} />
                  –
                  <input type="time" className="field px-1.5 py-1 text-xs" value={d.end} onChange={(e) => save({ ...config, days: { ...config.days, [String(i)]: { ...d, end: e.target.value } } })} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <label className="mt-3 inline-flex items-center gap-2 text-sm">
        Slot length
        <select className="field w-auto" value={config.slotMinutes} onChange={(e) => save({ ...config, slotMinutes: Number(e.target.value) })}>
          {[15, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m} min</option>)}
        </select>
      </label>

      <h4 className="mt-5 text-sm font-semibold text-ink">Upcoming ({upcoming.length})</h4>
      {upcoming.length === 0 ? (
        <p className="mt-1 text-xs text-ink-soft">No upcoming bookings.</p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {upcoming.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0 truncate"><b>{b.slot.replace("T", " · ")}</b> — {b.name} <span className="text-xs text-ink-soft">{b.email}</span>{b.note && <span className="ml-2 text-xs text-ink-soft">“{b.note}”</span>}</span>
              <button onClick={() => cancel(b.id)} className="shrink-0 text-xs font-semibold text-red-600">Cancel</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

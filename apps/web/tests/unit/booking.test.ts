import { beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Point the storage adapter at a throwaway fs dir BEFORE any store call.
beforeAll(() => {
  process.env.EDGEPRESS_STORAGE = "fs";
  process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "ep-booking-"));
});

import { createBooking, DEFAULT_BOOKING_CONFIG, freeSlots, getBookings, resolveConflicts, saveBookingConfig, slotGrid, type Booking } from "@/lib/booking-store";

const futureDate = (() => {
  const d = new Date(Date.now() + 7 * 86_400_000);
  // land on a Monday so default hours apply
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7));
  return d.toISOString().slice(0, 10);
})();

describe("slotGrid (pure)", () => {
  it("builds the grid from opening hours", () => {
    const cfg = { ...DEFAULT_BOOKING_CONFIG, slotMinutes: 60, days: { ...DEFAULT_BOOKING_CONFIG.days, "1": { start: "09:00", end: "12:00" } } };
    expect(slotGrid(cfg, 1)).toEqual(["09:00", "10:00", "11:00"]);
    expect(slotGrid(cfg, 0)).toEqual([]); // closed Sunday
  });

  it("last slot must FIT before closing", () => {
    const cfg = { ...DEFAULT_BOOKING_CONFIG, slotMinutes: 45, days: { ...DEFAULT_BOOKING_CONFIG.days, "1": { start: "09:00", end: "10:30" } } };
    expect(slotGrid(cfg, 1)).toEqual(["09:00", "09:45"]);
  });
});

describe("resolveConflicts (pure)", () => {
  const b = (id: string, slot: string, createdAt: string): Booking => ({ id, slot, name: "N", email: "e@x.co", status: "confirmed", createdAt });
  it("earliest createdAt wins, deterministic tie-break by id", () => {
    const out = resolveConflicts([b("b", "2030-01-06T09:00", "T2"), b("a", "2030-01-06T09:00", "T1"), b("c", "2030-01-06T10:00", "T3")]);
    expect(out.find((x) => x.id === "a")?.status).toBe("confirmed");
    expect(out.find((x) => x.id === "b")?.status).toBe("cancelled");
    expect(out.find((x) => x.id === "c")?.status).toBe("confirmed");
  });
});

describe("booking flow (fs adapter)", () => {
  it("disabled by default; enabling opens slots", async () => {
    expect(await createBooking({ date: futureDate, time: "09:00", name: "Amy", email: "a@x.co" })).toHaveProperty("error");
    await saveBookingConfig({ enabled: true, slotMinutes: 60 });
    expect((await freeSlots(futureDate)).length).toBeGreaterThan(0);
  });

  it("books a slot and removes it from availability", async () => {
    const r = await createBooking({ date: futureDate, time: "09:00", name: "Amy", email: "a@x.co" });
    expect("error" in r).toBe(false);
    expect(await freeSlots(futureDate)).not.toContain("09:00");
  });

  it("rejects double-booking and off-grid/past requests", async () => {
    expect(await createBooking({ date: futureDate, time: "09:00", name: "Bob", email: "b@x.co" })).toHaveProperty("error");
    expect(await createBooking({ date: futureDate, time: "09:07", name: "Bob", email: "b@x.co" })).toHaveProperty("error");
    expect(await createBooking({ date: "2020-01-06", time: "09:00", name: "Bob", email: "b@x.co" })).toHaveProperty("error");
  });

  it("concurrent grabs of one slot leave exactly one confirmed", async () => {
    const results = await Promise.all([...Array(6)].map((_, i) => createBooking({ date: futureDate, time: "10:00", name: `R${i}`, email: `r${i}@x.co` })));
    const okCount = results.filter((r) => !("error" in r)).length;
    const confirmed = (await getBookings()).filter((b) => b.slot === `${futureDate}T10:00` && b.status === "confirmed");
    expect(confirmed.length).toBe(1);
    expect(okCount).toBeGreaterThanOrEqual(1); // winner(s) told yes — resolver guarantees storage-level single winner
  });
});

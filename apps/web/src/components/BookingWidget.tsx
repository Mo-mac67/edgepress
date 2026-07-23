"use client";

import { useEffect, useState } from "react";

/** Public appointment picker: date → free slots → name/email → confirm. */
export function BookingWidget({ locale }: { locale: string }) {
  const fr = locale === "fr";
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [slots, setSlots] = useState<string[]>([]);
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "sending" | "done">("idle");
  const [err, setErr] = useState("");

  useEffect(() => {
    setState("loading");
    setTime("");
    fetch(`/api/booking?date=${date}`)
      .then((r) => r.json())
      .then((d) => setSlots(d.slots ?? []))
      .catch(() => setSlots([]))
      .finally(() => setState("idle"));
  }, [date]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setErr("");
    const res = await fetch("/api/booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, time, name, email, note }),
    }).catch(() => null);
    const d = await res?.json().catch(() => ({}));
    if (res?.ok) setState("done");
    else {
      setState("idle");
      setErr(d?.error || (fr ? "Échec de la réservation" : "Couldn't book — try another slot"));
      fetch(`/api/booking?date=${date}`).then((r) => r.json()).then((x) => setSlots(x.slots ?? [])).catch(() => {});
    }
  }

  if (state === "done") {
    return (
      <p className="mx-auto mt-6 max-w-md rounded-lg bg-accent-soft p-4 text-center font-medium text-accent-dark">
        {fr ? `Réservé ! ${date} à ${time}. Une confirmation suit par courriel.` : `Booked! ${date} at ${time}. You'll get an email confirmation.`}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-6 max-w-md space-y-4 text-left">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink">{fr ? "Date" : "Date"}</span>
        <input type="date" className="field" min={today} value={date} onChange={(e) => setDate(e.target.value)} required />
      </label>
      <div>
        <span className="mb-1 block text-sm font-medium text-ink">{fr ? "Heure" : "Time"}</span>
        {state === "loading" ? (
          <p className="text-sm text-ink-soft">{fr ? "Chargement…" : "Loading…"}</p>
        ) : slots.length === 0 ? (
          <p className="text-sm text-ink-soft">{fr ? "Aucun créneau ce jour-là — essayez une autre date." : "No slots that day — try another date."}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {slots.map((s) => (
              <button key={s} type="button" onClick={() => setTime(s)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${time === s ? "bg-brand text-white" : "border border-line text-ink hover:border-brand"}`}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
      {time && (
        <>
          <input className="field" placeholder={fr ? "Votre nom" : "Your name"} value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} />
          <input type="email" className="field" placeholder={fr ? "votre@email.com" : "you@email.com"} value={email} onChange={(e) => setEmail(e.target.value)} required />
          <textarea className="field min-h-[70px]" placeholder={fr ? "Note (optionnel)" : "Anything we should know? (optional)"} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button type="submit" disabled={state === "sending"} className="btn-primary w-full">
            {state === "sending" ? "…" : fr ? `Réserver ${date} · ${time}` : `Book ${date} · ${time}`}
          </button>
        </>
      )}
    </form>
  );
}

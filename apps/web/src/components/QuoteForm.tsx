"use client";

import { useState } from "react";
import { Icon } from "./Icon";
import { track } from "@/lib/track";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { PROJECT_TYPES } from "@/lib/types";

type FormDict = Dictionary["contact"]["form"];

export function QuoteForm({ locale, form }: { locale: Locale; form: FormDict }) {
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [times, setTimes] = useState<string[]>([]);
  const [started, setStarted] = useState(false);

  function onFirstInput() {
    if (!started) {
      setStarted(true);
      track("quiz_start", { form: "quote" });
    }
  }

  function toggleTime(t: string) {
    setTimes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      locale,
      name: String(fd.get("name") ?? ""),
      email: String(fd.get("email") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      city: String(fd.get("city") ?? ""),
      projectType: String(fd.get("projectType") ?? "other"),
      budget: String(fd.get("budget") ?? ""),
      timeline: String(fd.get("timeline") ?? ""),
      message: String(fd.get("message") ?? ""),
      preferredTimes: times,
      hp: String(fd.get("company_website") ?? ""),
    };

    if (!payload.name.trim()) return setError(form.errorName);

    setStatus("sending");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        track("quiz_submit", { form: "quote", projectType: payload.projectType });
        setStatus("done");
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { reason?: string };
      if (data.reason === "name") setError(form.errorName);
      else if (data.reason === "phone") setError(form.errorPhone);
      else if (data.reason === "email" || data.reason === "disposable" || data.reason === "undeliverable")
        setError(form.errorEmail);
      else setError(form.errorGeneric);
      setStatus("idle");
    } catch {
      setError(form.errorGeneric);
      setStatus("idle");
    }
  }

  if (status === "done") {
    return (
      <div className="card p-8 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent-soft text-accent-dark">
          <Icon name="check" size={30} />
        </span>
        <h3 className="mt-5 font-display text-2xl font-bold text-brand">{form.successTitle}</h3>
        <p className="mx-auto mt-3 max-w-md text-ink-soft">{form.success}</p>
        <button
          type="button"
          onClick={() => {
            setStatus("idle");
            setTimes([]);
            setStarted(false);
          }}
          className="btn-secondary mt-6"
        >
          {form.another}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} onInput={onFirstInput} className="card p-6 sm:p-8">
      <h3 className="font-display text-xl font-bold text-brand">{form.heading}</h3>

      {/* Honeypot */}
      <input
        type="text"
        name="company_website"
        tabIndex={-1}
        autoComplete="off"
        className="absolute left-[-9999px] h-0 w-0"
        aria-hidden="true"
      />

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label={form.name} required>
          <input name="name" required placeholder={form.namePlaceholder} className="field" />
        </Field>
        <Field label={form.phone} required>
          <input name="phone" required type="tel" placeholder={form.phonePlaceholder} className="field" />
        </Field>
        <Field label={form.email} required>
          <input name="email" required type="email" placeholder={form.emailPlaceholder} className="field" />
        </Field>
        <Field label={form.city}>
          <input name="city" placeholder={form.cityPlaceholder} className="field" />
        </Field>
        <Field label={form.projectType}>
          <select name="projectType" defaultValue="custom_home" className="field">
            {PROJECT_TYPES.map((t) => (
              <option key={t} value={t}>
                {form.projectTypes[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={form.budget}>
          <select name="budget" className="field" defaultValue="">
            <option value="" disabled>
              —
            </option>
            {form.budgets.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </Field>
        <Field label={form.timeline}>
          <select name="timeline" className="field" defaultValue="">
            <option value="" disabled>
              —
            </option>
            {form.timelines.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mt-4">
        <Field label={form.message}>
          <textarea name="message" rows={4} placeholder={form.messagePlaceholder} className="field resize-none" />
        </Field>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-sm font-medium text-ink">{form.preferredTimes}</p>
        <div className="flex flex-wrap gap-2">
          {form.times.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => toggleTime(t)}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                times.includes(t)
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-white text-ink-soft hover:border-brand"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <button type="submit" disabled={status === "sending"} className="btn-primary mt-6 w-full disabled:opacity-70">
        {status === "sending" ? form.submitting : form.submit}
        {status !== "sending" && <Icon name="arrow-right" size={18} />}
      </button>
    </form>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">
        {label}
        {required && <span className="text-accent-dark"> *</span>}
      </span>
      {children}
    </label>
  );
}

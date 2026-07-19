"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useAdminUI } from "./ui";
import { EMAIL_TEMPLATES } from "@/lib/email-templates";
import type { Locale } from "@/i18n/config";
import { LEAD_STATUSES, type Lead, type LeadStatus } from "@/lib/types";

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  quoted: "Quoted",
  won: "Won",
  lost: "Lost",
};

export function LeadDetail({ lead, locale }: { lead: Lead; locale: Locale }) {
  const base = `/${locale}`;
  const router = useRouter();
  const ui = useAdminUI();

  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [savedNotes, setSavedNotes] = useState(lead.notes ?? "");
  const fill = (str: string) => str.replace("{name}", lead.name).replace("{city}", lead.city || "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<"sent" | "logged" | "">("");
  const [score, setScore] = useState<{ score: number; summary: string; hot: boolean } | null>(null);
  const [scoring, setScoring] = useState(false);
  const [drafting, setDrafting] = useState(false);

  async function aiScore() {
    setScoring(true);
    try {
      const r = await fetch("/api/admin/ai/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadId: lead.id, action: "score" }) });
      const d = await r.json();
      if (r.ok) setScore(d);
      else ui.toast(d.error || "Scoring failed", "error");
    } finally {
      setScoring(false);
    }
  }
  async function aiDraft() {
    setDrafting(true);
    try {
      const r = await fetch("/api/admin/ai/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadId: lead.id, action: "reply", locale }) });
      const d = await r.json();
      if (r.ok) {
        setSubject(d.subject);
        setBody(d.body);
        ui.toast("Reply drafted", "success");
      } else ui.toast(d.error || "Draft failed", "error");
    } finally {
      setDrafting(false);
    }
  }

  async function patch(p: Partial<Pick<Lead, "status" | "notes">>) {
    await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
  }

  async function removeLead() {
    if (!(await ui.confirm({ title: "Delete lead?", message: `${lead.name}'s enquiry will be permanently removed.`, confirmLabel: "Delete", danger: true }))) return;
    await fetch(`/api/leads/${lead.id}`, { method: "DELETE" });
    router.push(`${base}/admin`);
  }

  function applyTemplate(id: string) {
    const tpl = EMAIL_TEMPLATES.find((x) => x.id === id);
    if (!tpl) return;
    setSubject(fill(tpl.subject[locale]));
    setBody(fill(tpl.body[locale]));
  }

  async function sendEmail() {
    setSending(true);
    setResult("");
    try {
      const res = await fetch(`/api/leads/${lead.id}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data.sent ? "sent" : "logged");
        if (status === "new") {
          setStatus("contacted");
          patch({ status: "contacted" });
        }
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="container-page py-8">
      <Link href={`${base}/admin`} className="inline-flex items-center gap-1 text-sm font-medium text-ink-soft hover:text-brand">
        <Icon name="arrow-left" size={16} />
        Back to dashboard
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-soft font-display text-lg font-bold text-brand">
            {lead.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold text-brand">{lead.name}</h1>
            <p className="text-sm text-ink-soft">
              {new Date(lead.createdAt).toLocaleString(locale === "fr" ? "fr-CA" : "en-CA")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={removeLead} className="btn-secondary text-red-600">
            <Icon name="trash" size={18} />
            Delete
          </button>
          <select
            className="field max-w-[170px]"
            value={status}
            onChange={(e) => {
              const s = e.target.value as LeadStatus;
              setStatus(s);
              patch({ status: s });
            }}
          >
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-3 font-display font-semibold text-brand">Contact</h2>
          <dl className="space-y-2 text-sm">
            <Row icon="phone"><a href={`tel:${lead.phone}`} className="text-accent-dark hover:underline">{lead.phone}</a></Row>
            <Row icon="mail"><a href={`mailto:${lead.email}`} className="text-accent-dark hover:underline">{lead.email}</a></Row>
            <Row icon="map-pin">{lead.city || "—"}</Row>
          </dl>
        </div>

        <div className="card p-5">
          <h2 className="mb-3 font-display font-semibold text-brand">Project</h2>
          <dl className="space-y-2 text-sm">
            <Row icon="hammer">{lead.projectType.replace(/_/g, " ")}</Row>
            <Row icon="loan">{lead.budget || "—"}</Row>
            <Row icon="clock">{lead.timeline || "—"}</Row>
            {lead.preferredTimes && lead.preferredTimes.length > 0 && (
              <Row icon="phone">{lead.preferredTimes.join(" · ")}</Row>
            )}
          </dl>
          {lead.message && <p className="mt-3 rounded-lg bg-sand p-3 text-sm text-ink">{lead.message}</p>}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white p-4">
        <button onClick={aiScore} disabled={scoring} className="btn-secondary py-2 text-sm">
          <Icon name="star" size={15} /> {scoring ? "Scoring…" : "AI lead score"}
        </button>
        {score && (
          <div className="flex items-center gap-3">
            <span className={`grid h-11 w-11 place-items-center rounded-full text-sm font-extrabold ${score.hot ? "bg-red-50 text-red-600" : score.score >= 40 ? "bg-amber-50 text-amber-700" : "bg-sand text-ink-soft"}`}>{score.score}</span>
            <span className="text-sm text-ink">{score.summary}{score.hot && <span className="ml-2 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">HOT</span>}</span>
          </div>
        )}
      </div>

      <h2 className="mt-8 font-display text-lg font-bold text-brand">Notes</h2>
      <textarea
        className="field mt-3 min-h-[100px] w-full"
        value={notes}
        placeholder="Internal notes…"
        onChange={(e) => setNotes(e.target.value)}
      />
      {notes !== savedNotes && (
        <button
          onClick={() => {
            patch({ notes });
            setSavedNotes(notes);
          }}
          className="btn-secondary mt-2"
        >
          Save notes
        </button>
      )}

      <div className="card mt-8 p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-display font-semibold text-brand">
            <Icon name="mail" size={18} className="text-accent-dark" />
            Send a follow-up email
          </h2>
          <button onClick={aiDraft} disabled={drafting} className="btn-secondary py-1.5 text-xs">
            <Icon name="star" size={13} /> {drafting ? "Drafting…" : "Draft with AI"}
          </button>
        </div>
        <select className="field mb-3 w-full" defaultValue="" onChange={(e) => applyTemplate(e.target.value)}>
          <option value="" disabled>
            Choose a template…
          </option>
          {EMAIL_TEMPLATES.map((tpl) => (
            <option key={tpl.id} value={tpl.id}>
              {tpl.name[locale]}
            </option>
          ))}
        </select>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink-soft">Subject</span>
          <input className="field w-full" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </label>
        <label className="mt-3 block text-sm">
          <span className="mb-1 block font-medium text-ink-soft">Message</span>
          <textarea className="field min-h-[160px] w-full" value={body} onChange={(e) => setBody(e.target.value)} />
        </label>
        <div className="mt-3 flex items-center gap-3">
          <button onClick={sendEmail} disabled={sending || !subject} className="btn-primary">
            <Icon name="mail" size={18} />
            {sending ? "Sending…" : "Send"}
          </button>
          {result === "sent" && <span className="text-sm font-medium text-accent-dark">Sent.</span>}
          {result === "logged" && <span className="text-sm text-ink-soft">Logged (no email key set).</span>}
        </div>
      </div>
    </section>
  );
}

function Row({ icon, children }: { icon: Parameters<typeof Icon>[0]["name"]; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <Icon name={icon} size={16} className="text-ink-soft" />
      <span>{children}</span>
    </div>
  );
}

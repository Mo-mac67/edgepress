"use client";

import { useEffect, useState } from "react";
import { useAdminUI } from "./ui";

interface Subscriber { id: string; email: string; locale?: string; createdAt: string }
interface Campaign { id: string; subject: string; sentAt: string; recipients: number; delivered: boolean }

export function NewsletterPanel() {
  const ui = useAdminUI();
  const [subs, setSubs] = useState<Subscriber[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/newsletter");
    if (res.ok) {
      const d = await res.json();
      setSubs(d.subscribers ?? []);
      setCampaigns(d.campaigns ?? []);
    }
  }
  useEffect(() => { load(); }, []);

  async function send() {
    if (!subject.trim() || !body.trim()) return ui.toast("Subject and body are required", "error");
    if (!(await ui.confirm({ title: `Send to ${subs.length} subscriber${subs.length === 1 ? "" : "s"}?`, message: "This emails everyone on the list. There's no undo.", confirmLabel: "Send campaign" }))) return;
    setSending(true);
    const res = await fetch("/api/admin/newsletter/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject, body }) });
    setSending(false);
    const d = await res.json().catch(() => ({}));
    if (res.ok) {
      ui.toast(d.campaign?.delivered ? "Campaign sent ✓" : "Campaign logged (no RESEND_API_KEY set — nothing was emailed)", d.campaign?.delivered ? "success" : "error");
      setSubject("");
      setBody("");
      load();
    } else ui.toast(d.error || "Send failed", "error");
  }

  async function remove(email: string) {
    await fetch(`/api/admin/newsletter?email=${encodeURIComponent(email)}`, { method: "DELETE" });
    load();
  }

  const csv = () => {
    const rows = ["email,subscribed_at", ...subs.map((s) => `${s.email},${s.createdAt}`)].join("\n");
    const url = URL.createObjectURL(new Blob([rows], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "subscribers.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h3 className="font-display font-bold text-brand">Send a campaign</h3>
        <p className="mt-1 text-sm text-ink-soft">Plain-text email to all {subs.length} subscriber{subs.length === 1 ? "" : "s"}, with a signed unsubscribe link appended. Requires RESEND_API_KEY (logs otherwise).</p>
        <input className="field mt-4" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} />
        <textarea className="field mt-2 min-h-[160px]" placeholder="Write your update…" value={body} onChange={(e) => setBody(e.target.value)} />
        <button onClick={send} disabled={sending || subs.length === 0} className="btn-primary mt-3">{sending ? "Sending…" : "Send campaign"}</button>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-brand">Subscribers ({subs.length})</h3>
          <button onClick={csv} className="btn-secondary text-sm" disabled={subs.length === 0}>Export CSV</button>
        </div>
        <p className="mt-1 text-xs text-ink-soft">Grow the list with the <b>Newsletter signup</b> block — add it to any page from the block picker.</p>
        {subs.length > 0 && (
          <ul className="mt-3 divide-y divide-line">
            {subs.slice(0, 200).map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>{s.email} <span className="ml-2 text-xs text-ink-soft">{new Date(s.createdAt).toLocaleDateString()}</span></span>
                <button onClick={() => remove(s.email)} className="text-xs font-semibold text-red-600">Remove</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {campaigns.length > 0 && (
        <div className="card p-5">
          <h3 className="font-display font-bold text-brand">Past campaigns</h3>
          <ul className="mt-3 divide-y divide-line">
            {campaigns.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate font-medium">{c.subject}</span>
                <span className="shrink-0 text-xs text-ink-soft">{new Date(c.sentAt).toLocaleString()} · {c.recipients} recipient{c.recipients === 1 ? "" : "s"} · {c.delivered ? "delivered" : "logged only"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useAdminUI } from "./ui";

interface ApiKey { id: string; label: string; prefix: string; createdAt: string; lastUsed?: string }
interface Webhook { id: string; url: string; events: string[]; secret: string; active: boolean; lastStatus?: number; lastFiredAt?: string }

export function DeveloperPanel() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ApiDocsCard />
      <ApiKeysCard />
      <WebhooksCard />
      <PaymentsCard />
    </div>
  );
}

/** Stripe hosted-checkout config + paid orders. Keys are stored server-side
 *  and masked ("set") on read — never echoed back. */
function PaymentsCard() {
  const ui = useAdminUI();
  interface Order { id: string; product: string; amount: number; currency: string; email?: string; createdAt: string }
  const [secretKey, setSecretKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);

  async function load() {
    const res = await fetch("/api/admin/payments");
    if (!res.ok) return;
    const d = await res.json();
    setSecretKey(d.config.stripeSecretKey);
    setWebhookSecret(d.config.stripeWebhookSecret);
    setOrders(d.orders ?? []);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    const res = await fetch("/api/admin/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stripeSecretKey: secretKey, stripeWebhookSecret: webhookSecret }) });
    if (res.ok) { ui.toast("Payment settings saved", "success"); load(); }
    else ui.toast("Couldn't save (owner only)", "error");
  }

  return (
    <div className="card p-5">
      <h3 className="font-display font-bold text-brand">Payments (Stripe)</h3>
      <p className="mt-1 text-xs text-ink-soft">
        Add a <b>Payment button</b> block to any page. Buyers pay on Stripe&apos;s hosted checkout — card data never touches this site. Point a Stripe webhook (event <code className="rounded bg-surface-soft px-1">checkout.session.completed</code>) at <code className="rounded bg-surface-soft px-1">/api/pay/webhook</code> to record orders below.
      </p>
      <label className="mt-3 block"><span className="mb-1 block text-xs font-medium text-ink-soft">Secret key (sk_…)</span><input type="password" className="field" placeholder="sk_live_…" value={secretKey} onChange={(e) => setSecretKey(e.target.value)} /></label>
      <label className="mt-2 block"><span className="mb-1 block text-xs font-medium text-ink-soft">Webhook signing secret (whsec_…)</span><input type="password" className="field" placeholder="whsec_…" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} /></label>
      <button onClick={save} className="btn-secondary mt-3">Save payment settings</button>

      <h4 className="mt-5 text-sm font-semibold text-ink">Orders ({orders.length})</h4>
      {orders.length === 0 ? (
        <p className="mt-1 text-xs text-ink-soft">No paid orders yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {orders.slice(0, 50).map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0 truncate">{o.product}{o.email && <span className="ml-2 text-xs text-ink-soft">{o.email}</span>}</span>
              <span className="shrink-0 text-xs"><b>{(o.amount / 100).toFixed(2)} {o.currency.toUpperCase()}</b> · {new Date(o.createdAt).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ApiDocsCard() {
  return (
    <div className="card p-6 lg:col-span-2">
      <h3 className="font-display font-semibold text-brand">Content API</h3>
      <p className="mt-1 text-sm text-ink-soft">
        Every content type is served as JSON — use EdgePress as a headless CMS from any frontend, app, or script.
      </p>
      <div className="mt-4 space-y-2 text-sm">
        <p className="font-mono rounded bg-surface-soft px-3 py-2">GET <b>/api/content/&lt;type&gt;</b> <span className="text-ink-soft">— published entries</span></p>
        <p className="font-mono rounded bg-surface-soft px-3 py-2">GET <b>/api/content/&lt;type&gt;/&lt;slug&gt;</b> <span className="text-ink-soft">— a single entry</span></p>
        <p className="font-mono rounded bg-surface-soft px-3 py-2">GET <b>/api/content/&lt;type&gt;?status=all</b> <span className="text-ink-soft">— include drafts (needs API key)</span></p>
      </div>
      <p className="mt-3 text-xs text-ink-soft">Authenticate drafts with <code className="rounded bg-surface-soft px-1">Authorization: Bearer &lt;key&gt;</code> or <code className="rounded bg-surface-soft px-1">?key=…</code>. Public reads are CORS-enabled.</p>
    </div>
  );
}

function ApiKeysCard() {
  const ui = useAdminUI();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [label, setLabel] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/api-keys");
    if (res.ok) setKeys((await res.json()).keys ?? []);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!label.trim()) return ui.toast("Name the key", "error");
    const res = await fetch("/api/admin/api-keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label }) });
    const data = await res.json().catch(() => ({}));
    if (res.ok) { setFresh(data.token); setLabel(""); load(); }
    else ui.toast(data.error || "Failed", "error");
  }
  async function revoke(id: string) {
    if (!(await ui.confirm({ title: "Revoke this key?", message: "Any integration using it stops working immediately.", danger: true, confirmLabel: "Revoke" }))) return;
    const res = await fetch("/api/admin/api-keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "revoke", id }) });
    if (res.ok) { ui.toast("Key revoked", "success"); load(); }
  }

  return (
    <div className="card p-6">
      <h3 className="font-display font-semibold text-brand">API keys</h3>
      <p className="mt-1 text-sm text-ink-soft">Grant read access to draft/unpublished content.</p>

      {fresh && (
        <div className="mt-4 rounded-lg border border-accent bg-accent/10 p-3">
          <p className="text-xs font-semibold text-brand">Copy this now — it won&apos;t be shown again:</p>
          <code className="mt-1 block break-all font-mono text-sm">{fresh}</code>
          <button onClick={() => { navigator.clipboard?.writeText(fresh); ui.toast("Copied", "success"); }} className="mt-2 text-xs font-semibold text-brand">Copy</button>
        </div>
      )}

      <ul className="mt-4 space-y-2 text-sm">
        {keys.map((k) => (
          <li key={k.id} className="flex items-center justify-between border-b border-line pb-2 last:border-0">
            <span><span className="font-medium">{k.label}</span> <code className="ml-1 text-xs text-ink-soft">{k.prefix}…</code></span>
            <span className="flex items-center gap-3">
              <span className="text-xs text-ink-soft">{k.lastUsed ? `used ${new Date(k.lastUsed).toLocaleDateString()}` : "never used"}</span>
              <button onClick={() => revoke(k.id)} className="text-xs font-semibold text-red-600">Revoke</button>
            </span>
          </li>
        ))}
        {keys.length === 0 && <li className="text-ink-soft">No API keys.</li>}
      </ul>

      <div className="mt-4 flex gap-2">
        <input className="field" placeholder="Key name (e.g. Marketing site)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <button onClick={create} className="btn-secondary shrink-0">Create key</button>
      </div>
    </div>
  );
}

function WebhooksCard() {
  const ui = useAdminUI();
  const [hooks, setHooks] = useState<Webhook[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [url, setUrl] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  async function load() {
    const res = await fetch("/api/admin/webhooks");
    if (res.ok) { const d = await res.json(); setHooks(d.webhooks ?? []); setEvents(d.events ?? []); }
  }
  useEffect(() => { load(); }, []);

  async function add() {
    const res = await fetch("/api/admin/webhooks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, events: selected }) });
    const data = await res.json().catch(() => ({}));
    if (res.ok) { ui.toast("Webhook added", "success"); setUrl(""); setSelected([]); load(); }
    else ui.toast(data.error || "Failed", "error");
  }
  async function act(action: string, id: string) {
    const res = await fetch("/api/admin/webhooks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, id }) });
    const data = await res.json().catch(() => ({}));
    if (action === "test") ui.toast(data.ok ? `Test delivered (${data.status})` : "Test failed", data.ok ? "success" : "error");
    if (action === "remove" && res.ok) ui.toast("Webhook removed", "success");
    load();
  }

  return (
    <div className="card p-6 lg:col-span-2">
      <h3 className="font-display font-semibold text-brand">Webhooks</h3>
      <p className="mt-1 text-sm text-ink-soft">POST a signed payload to your endpoint when content or leads change. Verify with the <code className="rounded bg-surface-soft px-1">x-edgepress-signature</code> HMAC-SHA256 header.</p>

      <ul className="mt-4 space-y-2 text-sm">
        {hooks.map((h) => (
          <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2 last:border-0">
            <span className="min-w-0">
              <span className="block truncate font-medium">{h.url}</span>
              <span className="text-xs text-ink-soft">{h.events.join(", ")}{h.lastStatus != null && ` · last: ${h.lastStatus || "failed"}`}</span>
            </span>
            <span className="flex items-center gap-3">
              <button onClick={() => act("test", h.id)} className="text-xs font-semibold text-brand">Test</button>
              <button onClick={() => act("remove", h.id)} className="text-xs font-semibold text-red-600">Remove</button>
            </span>
          </li>
        ))}
        {hooks.length === 0 && <li className="text-ink-soft">No webhooks.</li>}
      </ul>

      <div className="mt-4 rounded-lg border border-line p-4">
        <input className="field" placeholder="https://your-app.com/webhook" value={url} onChange={(e) => setUrl(e.target.value)} />
        <div className="mt-3 flex flex-wrap gap-3">
          {events.map((ev) => (
            <label key={ev} className="flex items-center gap-1.5 text-xs text-ink-soft">
              <input type="checkbox" checked={selected.includes(ev)} onChange={(e) => setSelected((s) => e.target.checked ? [...s, ev] : s.filter((x) => x !== ev))} />
              {ev}
            </label>
          ))}
        </div>
        <button onClick={add} className="btn-secondary mt-3">Add webhook</button>
      </div>
    </div>
  );
}

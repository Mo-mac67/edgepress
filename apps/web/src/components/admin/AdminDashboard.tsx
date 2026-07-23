"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import pkg from "../../../package.json";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { Icon } from "@/components/Icon";
import { BarList, Donut, TimeBars } from "@/components/charts";
import { BlogPanel, MediaPanel, MenuPanel, PagesPanel, SitePanel } from "./CmsPanels";
import { HelpPanel } from "./HelpPanel";
import { MarketplacePanel } from "./MarketplacePanel";
import { CollectionsPanel } from "./CollectionsPanel";
import { FormsPanel } from "./FormsPanel";
import { DeveloperPanel } from "./DeveloperPanel";
import { TabPermissionsCard } from "./TabPermissionsCard";
import { SeoPanel } from "./SeoPanel";
import { NewsletterPanel } from "./NewsletterPanel";
import { BookingCard } from "./BookingCard";
import { CoursesPanel } from "./CoursesPanel";
import { AiPanel } from "./AiPanel";
import { CopilotPanel } from "./CopilotPanel";
import { ThemePanel } from "./ThemePanel";
import { useAdminUI } from "./ui";
import { computeAnalytics, detectAnomalies } from "@/lib/analytics";
import type { SiteEvent } from "@/lib/events-store";
import type { AuditEntry } from "@/lib/audit-store";
import type { AdminUser, Role } from "@/lib/admin-auth";
import type { NotificationChannels } from "@/lib/notify";
import { LEAD_STATUSES, type Lead, type LeadStatus } from "@/lib/types";
import type { Locale } from "@/i18n/config";

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  quoted: "Quoted",
  won: "Won",
  lost: "Lost",
};
const PALETTE = ["#16324f", "#e0a52e", "#1c4066", "#c2861a", "#5a6571", "#9aa4ae"];
type Tab = "overview" | "copilot" | "leads" | "marketplace" | "pages" | "menu" | "blog" | "collections" | "forms" | "media" | "courses" | "appearance" | "seo" | "newsletter" | "ai" | "site" | "developer" | "activity" | "settings" | "audit" | "help";
/** Every dashboard tab id — also the vocabulary for per-admin tab permissions ("audit"/"developer" stay super-only regardless). */
const ALL_TAB_IDS: Tab[] = ["overview", "leads", "marketplace", "activity", "audit", "pages", "menu", "blog", "collections", "forms", "media", "courses", "seo", "newsletter", "appearance", "site", "developer", "settings", "help"];

export function AdminDashboard({
  locale,
  initialLeads,
  events,
  role,
  audit,
  adminUsers,
  channels,
  allowedTabs = null,
}: {
  locale: Locale;
  initialLeads: Lead[];
  events: SiteEvent[];
  role: Role;
  audit: AuditEntry[];
  adminUsers: AdminUser[];
  channels: NotificationChannels;
  allowedTabs?: string[] | null;
}) {
  const router = useRouter();
  const base = `/${locale}`;
  const [tab, setTab] = useState<Tab>("overview");
  const [leads, setLeads] = useState(initialLeads);
  const [days, setDays] = useState(30);

  const isSuper = role === "super";
  const analytics = useMemo(() => computeAnalytics(leads, events, days), [leads, events, days]);
  const anomalies = useMemo(() => detectAnomalies(leads, events), [leads, events]);
  const unread = leads.filter((l) => !l.read).length;

  async function signOut() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.refresh();
  }

  const canSee = (id: Tab) => isSuper || !allowedTabs || allowedTabs.includes(id);
  const rawGroups: { title: string; items: { id: Tab; label: string; icon: Parameters<typeof Icon>[0]["name"]; badge?: number }[] }[] = [
    {
      title: "Insights",
      items: [
        { id: "overview", label: "Dashboard", icon: "chart" },
        // Neutral name: "Copilot" reads as a Microsoft brand (and assumes
        // which AI the owner uses) — the id stays for saved tab permissions.
        { id: "copilot", label: "Assistant", icon: "star" },
        { id: "leads", label: "Leads", icon: "user", badge: unread || undefined },
        { id: "marketplace", label: "Marketplace", icon: "gavel" },
        { id: "activity", label: "Activity", icon: "refresh" },
        ...(isSuper ? [{ id: "audit" as Tab, label: "Audit log", icon: "shield" as const }] : []),
      ],
    },
    {
      title: "Content",
      items: [
        { id: "pages", label: "Pages", icon: "list" },
        { id: "menu", label: "Menus", icon: "menu" },
        { id: "blog", label: "Blog", icon: "edit" },
        { id: "collections", label: "Collections", icon: "grid" },
        { id: "forms", label: "Forms", icon: "list" },
        { id: "courses" as Tab, label: "Courses", icon: "info" as const },
        { id: "media", label: "Media", icon: "image" },
      ],
    },
    {
      title: "Growth",
      items: [
        { id: "seo" as Tab, label: "SEO", icon: "chart" as const },
        { id: "newsletter" as Tab, label: "Newsletter", icon: "mail" as const },
        { id: "ai" as Tab, label: "AI", icon: "star" as const },
      ],
    },
    {
      title: "Design & setup",
      items: [
        { id: "appearance", label: "Appearance", icon: "star" },
        { id: "site", label: "Site info", icon: "building" },
        ...(isSuper ? [{ id: "developer" as Tab, label: "Developer", icon: "code" as const }] : []),
        { id: "settings", label: "Security", icon: "lock" },
        { id: "help", label: "Help & guide", icon: "info" },
      ],
    },
  ];
  // Per-admin tab permissions: hide disallowed tabs (super always sees all).
  const groups = rawGroups
    .map((g) => ({ ...g, items: g.items.filter((i) => canSee(i.id)) }))
    .filter((g) => g.items.length > 0);
  const active = groups.flatMap((g) => g.items).find((i) => i.id === tab);

  return (
    <div className="flex min-h-screen bg-sand">
      {/* The admin is its own app — hide the public site header/footer around it. */}
      <style dangerouslySetInnerHTML={{ __html: "body>header,body>footer{display:none!important}" }} />
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col bg-brand-dark md:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-line-dark px-5">
          <BrandMark size={32} />
          <span className="font-display font-bold text-white">EdgePress</span>
          <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-accent">{role === "super" ? "Owner" : "Team"}</span>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {groups.map((g) => (
            <div key={g.title} className="mb-5">
              {/* WCAG AA: white/60 keeps ~6.6:1 on the dark rail (white/40 fell to ~3.9). */}
              <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/60">{g.title}</p>
              {g.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  aria-current={tab === item.id ? "page" : undefined}
                  className={`mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                    tab === item.id ? "bg-accent-dark font-semibold text-white" : "font-medium text-white/75 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon name={item.icon} size={17} />
                  {item.label}
                  {item.badge ? (
                    <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold ${tab === item.id ? "bg-white/20 text-white" : "bg-accent-dark text-white"}`}>
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="border-t border-line-dark p-3">
          <a href={base} target="_blank" rel="noopener noreferrer" className="mb-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-white/75 hover:bg-white/10 hover:text-white">
            <Icon name="arrow-up-right" size={17} />
            View site
          </a>
          <button onClick={signOut} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-white/75 hover:bg-white/10 hover:text-white">
            <Icon name="logout" size={17} />
            Sign out
          </button>
          <p className="px-3 pt-1 text-[10px] text-white/30" title="Upgrade with: npx create-edgepress upgrade">EdgePress v{pkg.version}</p>
        </div>
      </aside>

      {/* Main */}
      <div className="min-w-0 flex-1">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-line bg-white">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
            <h1 className="font-display text-lg font-bold text-brand">{active?.label ?? "Dashboard"}</h1>
            <div className="flex items-center gap-2">
              {tab === "overview" && (
                <select className="field max-w-[150px] py-2 text-sm" value={days} onChange={(e) => setDays(Number(e.target.value))}>
                  {[7, 14, 30, 90, 3650].map((d) => (
                    <option key={d} value={d}>
                      {d === 3650 ? "All time" : `Last ${d} days`}
                    </option>
                  ))}
                </select>
              )}
              <a href={base} target="_blank" rel="noopener noreferrer" className="btn-secondary hidden py-2 text-sm sm:inline-flex">
                <Icon name="arrow-up-right" size={15} />
                View site
              </a>
            </div>
          </div>
          {/* Mobile nav */}
          <nav className="flex gap-1 overflow-x-auto border-t border-line px-3 py-2 md:hidden">
            {groups.flatMap((g) => g.items).map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold ${tab === item.id ? "bg-brand text-white" : "text-ink-soft"}`}
              >
                {item.label}
                {item.badge ? ` (${item.badge})` : ""}
              </button>
            ))}
            <button onClick={signOut} className="whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600">Sign out</button>
          </nav>
        </header>

        <div className="p-4 sm:p-6">
          {isSuper && <UpdateBanner />}
          {tab === "overview" && <Overview analytics={analytics} anomalies={anomalies} base={base} />}
          {tab === "leads" && (<><LeadsTable leads={leads} setLeads={setLeads} base={base} locale={locale} /><BookingCard /></>)}
          {tab === "marketplace" && <MarketplacePanel locale={locale} />}
          {tab === "pages" && <PagesPanel locale={locale} />}
          {tab === "menu" && <MenuPanel locale={locale} />}
          {tab === "blog" && <BlogPanel locale={locale} />}
          {tab === "collections" && <CollectionsPanel isSuper={isSuper} />}
          {tab === "forms" && <FormsPanel />}
          {tab === "media" && <MediaPanel />}
          {tab === "appearance" && <ThemePanel />}
          {tab === "copilot" && <CopilotPanel locale={locale} />}
          {tab === "seo" && <SeoPanel />}
          {tab === "newsletter" && <NewsletterPanel />}
          {tab === "courses" && <CoursesPanel />}
          {tab === "ai" && <AiPanel />}
          {tab === "help" && <HelpPanel />}
          {tab === "site" && <SitePanel />}
          {tab === "activity" && <Activity events={events} />}
          {tab === "developer" && isSuper && <DeveloperPanel />}
          {tab === "settings" && <Settings isSuper={isSuper} channels={channels} adminUsers={adminUsers} />}
          {tab === "audit" && isSuper && <AuditTab audit={audit} />}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-ink-soft">{label}</p>
      <p className="mt-1 font-display text-2xl font-extrabold text-brand">{value}</p>
    </div>
  );
}

function Overview({ analytics: a, anomalies = [], base = "" }: { analytics: ReturnType<typeof computeAnalytics>; anomalies?: { label: string; severity: "warn" }[]; base?: string }) {
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");
  const [asking, setAsking] = useState(false);
  async function ask() {
    if (!q.trim()) return;
    setAsking(true);
    setAnswer("");
    try {
      const r = await fetch("/api/admin/ai/analytics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: q }) });
      const d = await r.json();
      setAnswer(r.ok ? d.answer : d.error || "Couldn't answer that.");
    } finally {
      setAsking(false);
    }
  }
  return (
    <div className="space-y-6">
      {anomalies.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-800"><Icon name="shield" size={16} /> Heads up</p>
          <ul className="mt-1.5 space-y-1 text-sm text-amber-900">
            {anomalies.map((an, i) => <li key={i}>• {an.label}</li>)}
          </ul>
        </div>
      )}
      <div className="flex justify-end">
        <Link href={`${base}/admin/report`} className="btn-secondary py-1.5 text-sm"><Icon name="download" size={14} /> Report (PDF)</Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Leads" value={a.kpis.leads} />
        <Kpi label="Sessions" value={a.kpis.sessions} />
        <Kpi label="Page views" value={a.kpis.pageviews} />
        <Kpi label="Conversion" value={pct(a.kpis.conversionRate)} />
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-2">
          <Icon name="star" size={16} className="text-accent-dark" />
          <span className="text-sm font-semibold text-brand">Ask about your data</span>
        </div>
        <div className="mt-3 flex gap-2">
          <input className="field" placeholder="e.g. Which page drives the most leads?" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()} />
          <button onClick={ask} disabled={asking || !q.trim()} className="btn-primary py-2 text-sm">{asking ? "…" : "Ask"}</button>
        </div>
        {answer && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-sand p-3 text-sm text-ink">{answer}</p>}
      </div>

      <div className="card p-6">
        <h3 className="mb-4 font-display font-semibold text-brand">Leads over time</h3>
        <TimeBars items={a.leadsByDay.map((d) => ({ label: d.key.slice(5), value: d.value }))} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card p-6">
          <h3 className="mb-4 font-display font-semibold text-brand">By status</h3>
          <Donut
            centerLabel={String(a.kpis.leads)}
            centerSub="leads"
            segments={a.leadsByStatus.map((s, i) => ({
              label: STATUS_LABEL[s.key as LeadStatus] ?? s.key,
              value: s.value,
              valueLabel: String(s.value),
              color: PALETTE[i % PALETTE.length],
            }))}
          />
        </div>
        <div className="card p-6">
          <h3 className="mb-4 font-display font-semibold text-brand">By project type</h3>
          <BarList
            items={a.leadsByProjectType.map((s) => ({
              label: s.key.replace(/_/g, " "),
              value: s.value,
              valueLabel: String(s.value),
            }))}
          />
        </div>
        <div className="card p-6">
          <h3 className="mb-4 font-display font-semibold text-brand">Top cities</h3>
          <BarList
            items={a.leadsByCity.slice(0, 6).map((s) => ({ label: s.key, value: s.value, valueLabel: String(s.value) }))}
          />
        </div>
      </div>
    </div>
  );
}

function LeadsTable({
  leads,
  setLeads,
  base,
  locale,
}: {
  leads: Lead[];
  setLeads: (l: Lead[]) => void;
  base: string;
  locale: Locale;
}) {
  const ui = useAdminUI();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | LeadStatus>("all");

  const shown = leads.filter((l) => {
    if (statusFilter !== "all" && l.status !== statusFilter) return false;
    if (!q) return true;
    const hay = `${l.name} ${l.email} ${l.phone} ${l.city} ${l.projectType}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  async function setStatus(id: string, status: LeadStatus) {
    setLeads(leads.map((l) => (l.id === id ? { ...l, status } : l)));
    await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  async function remove(id: string) {
    if (!(await ui.confirm({ title: "Delete lead?", message: "This enquiry will be permanently removed.", confirmLabel: "Delete", danger: true }))) return;
    setLeads(leads.filter((l) => l.id !== id));
    await fetch(`/api/leads/${id}`, { method: "DELETE" });
    ui.toast("Lead deleted", "success");
  }

  function exportCsv() {
    const headers = ["Date", "Name", "Email", "Phone", "City", "Project", "Budget", "Timeline", "Status"];
    const rows = shown.map((l) => [
      l.createdAt,
      l.name,
      l.email,
      l.phone,
      l.city,
      l.projectType,
      l.budget ?? "",
      l.timeline ?? "",
      l.status,
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "leads.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input className="field max-w-xs" placeholder="Search leads…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select
          className="field max-w-[150px]"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as LeadStatus | "all")}
        >
          <option value="all">All statuses</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <button onClick={exportCsv} className="btn-secondary py-2 text-sm">
          <Icon name="download" size={16} />
          CSV
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-xs uppercase text-ink-soft">
            <tr>
              <th scope="col" className="px-4 py-3">Name</th>
              <th scope="col" className="px-4 py-3">Project</th>
              <th scope="col" className="px-4 py-3">City</th>
              <th scope="col" className="px-4 py-3">Received</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((l) => (
              <tr key={l.id} className="border-b border-line last:border-0 hover:bg-sand/50">
                <td className="px-4 py-3">
                  <Link href={`${base}/admin/leads/${l.id}`} className="font-semibold text-brand hover:underline">
                    {!l.read && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-accent" />}
                    {l.name}
                  </Link>
                  <p className="text-xs text-ink-soft">{l.phone}</p>
                </td>
                <td className="px-4 py-3 capitalize">{l.projectType.replace(/_/g, " ")}</td>
                <td className="px-4 py-3">{l.city || "—"}</td>
                <td className="px-4 py-3 text-ink-soft">
                  {new Date(l.createdAt).toLocaleDateString(locale === "fr" ? "fr-CA" : "en-CA")}
                </td>
                <td className="px-4 py-3">
                  <select
                    className="rounded-lg border border-line bg-white px-2 py-1 text-xs"
                    value={l.status}
                    onChange={(e) => setStatus(l.id, e.target.value as LeadStatus)}
                  >
                    {LEAD_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => remove(l.id)} className="text-ink-soft hover:text-red-600" title="Delete">
                    <Icon name="trash" size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-ink-soft">
                  No leads found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Activity({ events }: { events: SiteEvent[] }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-line text-left text-xs uppercase text-ink-soft">
          <tr>
            <th scope="col" className="px-4 py-3">Type</th>
            <th scope="col" className="px-4 py-3">Path</th>
            <th scope="col" className="px-4 py-3">Locale</th>
            <th scope="col" className="px-4 py-3">When</th>
          </tr>
        </thead>
        <tbody>
          {events.slice(0, 100).map((e) => (
            <tr key={e.id} className="border-b border-line last:border-0">
              <td className="px-4 py-2.5 font-medium">{e.type}</td>
              <td className="px-4 py-2.5 text-ink-soft">{e.path}</td>
              <td className="px-4 py-2.5">{e.locale}</td>
              <td className="px-4 py-2.5 text-ink-soft">{new Date(e.createdAt).toLocaleString()}</td>
            </tr>
          ))}
          {events.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-10 text-center text-ink-soft">
                No activity yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Settings({
  isSuper,
  channels,
  adminUsers,
}: {
  isSuper: boolean;
  channels: NotificationChannels;
  adminUsers: AdminUser[];
}) {
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  const [users, setUsers] = useState<AdminUser[]>(adminUsers);
  const [uLabel, setULabel] = useState("");
  const [uPass, setUPass] = useState("");

  async function manageUsers(payload: Record<string, string>) {
    const res = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) setUsers((await res.json()).users);
  }

  async function changePw(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    setMsg(res.ok ? "Password updated." : "Failed to update password.");
    setPw("");
  }

  const channelList: [string, boolean][] = [
    ["Email (Resend)", channels.email],
    ["Telegram", channels.telegram],
    ["SMS (Twilio)", channels.sms],
    ["WhatsApp (Twilio)", channels.whatsapp],
    ["CRM webhook", channels.crm],
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card p-6">
        <h3 className="font-display font-semibold text-brand">Change admin password</h3>
        <form onSubmit={changePw} className="mt-4">
          <input
            type="password"
            className="field"
            placeholder="New password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
          <button type="submit" className="btn-primary mt-3">
            Update password
          </button>
          {msg && <p className="mt-3 text-sm text-ink-soft">{msg}</p>}
        </form>
      </div>

      <div className="card p-6">
        <h3 className="font-display font-semibold text-brand">Lead notifications</h3>
        <ul className="mt-4 space-y-2 text-sm">
          {channelList.map(([label, on]) => (
            <li key={label} className="flex items-center justify-between border-b border-line pb-2 last:border-0">
              <span>{label}</span>
              <span className={on ? "font-semibold text-accent-dark" : "text-ink-soft"}>
                {on ? "Active" : "Not set up"}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-soft">
          Configure via environment variables (RESEND_API_KEY, TELEGRAM_*, TWILIO_*, CRM_WEBHOOK_URL).
        </p>
      </div>

      {isSuper && <TwoFactorCard />}
      {isSuper && <BackupCard />}

      {isSuper && (
        <div className="card p-6 lg:col-span-2">
          <h3 className="font-display font-semibold text-brand">Admin users</h3>
          <ul className="mt-4 space-y-2 text-sm">
            {users.map((u) => (
              <li key={u.id} className="flex items-center justify-between border-b border-line pb-2 last:border-0">
                <span>{u.label}</span>
                <span className="flex items-center gap-3">
                  <span className="text-ink-soft">{new Date(u.createdAt).toLocaleDateString()}</span>
                  <button onClick={() => manageUsers({ action: "remove", id: u.id })} className="text-xs font-semibold text-red-600">Remove</button>
                </span>
              </li>
            ))}
            {users.length === 0 && <li className="text-ink-soft">No additional admin users.</li>}
          </ul>
          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input className="field" placeholder="Name (label)" value={uLabel} onChange={(e) => setULabel(e.target.value)} />
            <input type="password" className="field" placeholder="Password" value={uPass} onChange={(e) => setUPass(e.target.value)} autoComplete="new-password" />
            <button
              type="button"
              onClick={() => {
                if (uLabel && uPass.length >= 4) {
                  manageUsers({ action: "add", label: uLabel, password: uPass });
                  setULabel("");
                  setUPass("");
                }
              }}
              className="btn-secondary"
            >
              Add admin user
            </button>
          </div>
        </div>
      )}

      {/* Super-only: per-admin tab permissions */}
      {isSuper && (
        <div className="lg:col-span-2">
          <TabPermissionsCard tabIds={ALL_TAB_IDS} />
        </div>
      )}
    </div>
  );
}

/** Owner-only: enable/disable TOTP two-factor auth. Enrollment shows the secret
 *  to type into an authenticator app, then confirms with a live code. */
function TwoFactorCard() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/admin/2fa").then((r) => r.json()).then((d) => setEnabled(!!d.enabled)).catch(() => setEnabled(false));
  }, []);

  async function call(action: string, extra: Record<string, string> = {}) {
    const res = await fetch("/api/admin/2fa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    return { ok: res.ok, data: await res.json().catch(() => ({})) };
  }

  async function begin() {
    setMsg("");
    const { data } = await call("start");
    if (data.secret) setSetup(data);
  }
  async function confirm() {
    setMsg("");
    const { data } = await call("confirm", { code });
    if (data.ok) {
      setEnabled(true);
      setSetup(null);
      setCode("");
      setMsg("Two-factor authentication is on.");
    } else {
      setMsg("That code didn't match. Try the current one.");
    }
  }
  async function disable() {
    await call("disable");
    setEnabled(false);
    setMsg("Two-factor authentication turned off.");
  }

  return (
    <div className="card p-6 lg:col-span-2">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-brand">Two-factor authentication</h3>
        <span className={enabled ? "text-sm font-semibold text-accent-dark" : "text-sm text-ink-soft"}>
          {enabled == null ? "…" : enabled ? "On" : "Off"}
        </span>
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        Add a one-time code from an authenticator app on top of your password. Owner account only.
      </p>

      {enabled && !setup && (
        <button type="button" onClick={disable} className="btn-secondary mt-4">
          Turn off 2FA
        </button>
      )}

      {!enabled && !setup && (
        <button type="button" onClick={begin} className="btn-primary mt-4">
          Set up 2FA
        </button>
      )}

      {setup && (
        <div className="mt-4 rounded-lg border border-line p-4">
          <p className="text-sm text-ink-soft">1. In your authenticator app, add a manual key:</p>
          <code className="mt-1 block break-all rounded bg-surface-soft px-3 py-2 font-mono text-sm tracking-wider">{setup.secret}</code>
          <p className="mt-3 text-sm text-ink-soft">2. Enter the 6-digit code it shows:</p>
          <div className="mt-2 flex gap-2">
            <input inputMode="numeric" maxLength={6} className="field tracking-[0.3em]" placeholder="000000" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
            <button type="button" onClick={confirm} className="btn-primary shrink-0">Verify &amp; enable</button>
          </div>
        </div>
      )}

      {msg && <p className="mt-3 text-sm text-ink-soft">{msg}</p>}
    </div>
  );
}

/** Owner-only: download a full JSON backup, or restore from one. */
function BackupCard() {
  const ui = useAdminUI();
  const [restoring, setRestoring] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!(await ui.confirm({ title: "Restore this backup?", message: "Documents in the file overwrite the matching ones on your site. This can't be undone — download a fresh backup first if unsure.", danger: true, confirmLabel: "Restore" }))) return;
    setRestoring(true);
    try {
      const json = JSON.parse(await file.text());
      const res = await fetch("/api/admin/backup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(json) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) ui.toast(`Restored ${data.restored} document(s). Reload to see changes.`, "success");
      else ui.toast(data.error || "Restore failed", "error");
    } catch {
      ui.toast("That doesn't look like a valid backup file.", "error");
    }
    setRestoring(false);
  }

  return (
    <div className="card p-6 lg:col-span-2">
      <h3 className="font-display font-semibold text-brand">Backup &amp; restore</h3>
      <p className="mt-1 text-sm text-ink-soft">
        Export every document — pages, posts, collections, forms, leads, settings — as one JSON file. Restore it here or on another EdgePress site. <span className="text-ink-soft">(Media files in R2 aren&apos;t included.)</span>
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- API file download, not a page */}
        <a href="/api/admin/backup" className="btn-primary">Download backup</a>
        <label className={`btn-secondary cursor-pointer ${restoring ? "opacity-60" : ""}`}>
          {restoring ? "Restoring…" : "Restore from file"}
          <input type="file" accept="application/json,.json" className="hidden" onChange={onFile} disabled={restoring} />
        </label>
      </div>
    </div>
  );
}

function AuditTab({ audit }: { audit: AuditEntry[] }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-line text-left text-xs uppercase text-ink-soft">
          <tr>
            <th scope="col" className="px-4 py-3">Action</th>
            <th scope="col" className="px-4 py-3">Role</th>
            <th scope="col" className="px-4 py-3">Detail</th>
            <th scope="col" className="px-4 py-3">When</th>
          </tr>
        </thead>
        <tbody>
          {audit.map((e) => (
            <tr key={e.id} className="border-b border-line last:border-0">
              <td className="px-4 py-2.5 font-medium">{e.action}</td>
              <td className="px-4 py-2.5">{e.role ?? "—"}</td>
              <td className="px-4 py-2.5 text-ink-soft">{e.detail ?? "—"}</td>
              <td className="px-4 py-2.5 text-ink-soft">{new Date(e.createdAt).toLocaleString()}</td>
            </tr>
          ))}
          {audit.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-10 text-center text-ink-soft">
                No audit entries.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Quiet owner-only banner when a newer EdgePress release exists (daily-
 *  cached check against the upstream repo — see lib/update-check.ts). */
function UpdateBanner() {
  const [info, setInfo] = useState<{ current: string; latest: string | null; url: string | null; updateAvailable: boolean } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch("/api/admin/update").then(async (r) => r.ok && setInfo(await r.json())).catch(() => {});
    setDismissed(sessionStorage.getItem("ep-update-dismissed") === "1");
  }, []);

  if (!info?.updateAvailable || dismissed) return null;
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-accent/30 bg-accent-soft px-4 py-2.5 text-sm">
      <span className="font-semibold text-accent-dark">EdgePress {info.latest} is available</span>
      <span className="text-ink-soft">— you&apos;re on v{info.current}.</span>
      {info.url && (
        <a href={info.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent-dark underline underline-offset-2">
          See what&apos;s new
        </a>
      )}
      <span className="text-xs text-ink-soft">Upgrade: <code className="rounded bg-white/70 px-1">npx create-edgepress upgrade</code></span>
      <button
        onClick={() => { sessionStorage.setItem("ep-update-dismissed", "1"); setDismissed(true); }}
        className="ml-auto text-xs font-semibold text-ink-soft hover:text-ink"
        aria-label="Dismiss update notice"
      >
        Dismiss
      </button>
    </div>
  );
}

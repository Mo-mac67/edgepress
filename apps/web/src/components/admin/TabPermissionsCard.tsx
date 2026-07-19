"use client";

import { useEffect, useState } from "react";

/**
 * Super-only card for the Settings/Security panel: per-admin dashboard tab
 * permissions. Pass the site's own tab ids (order = display order).
 * Storage: admin-config.json → tabPermissions: { [adminUsername]: string[] }.
 * Absent username = all tabs. "admin" is the primary client-admin password;
 * managed admin users are keyed by label. Super is never restricted.
 * Render only when the logged-in role is "super".
 */
export function TabPermissionsCard({ tabIds, locale = "en" }: { tabIds: string[]; locale?: string }) {
  const fr = locale === "fr";
  const L = {
    title: fr ? "Permissions d'onglets par admin" : "Per-admin tab permissions",
    note: fr
      ? "Décochez des onglets pour restreindre un admin. Sans restriction, l'admin voit tout. Le super-admin n'est jamais restreint."
      : "Untick tabs to restrict an admin. With no restriction, the admin sees everything. The super admin is never restricted.",
    restricted: fr ? "Restreint" : "Restricted",
    allTabs: fr ? "Tous les onglets" : "All tabs",
    save: fr ? "Enregistrer" : "Save",
    clear: fr ? "Retirer la restriction" : "Remove restriction",
    saved: fr ? "Enregistré." : "Saved.",
    error: fr ? "Échec de l'enregistrement." : "Failed to save.",
    primary: fr ? "admin (mot de passe principal)" : "admin (primary password)",
  };

  const [admins, setAdmins] = useState<string[]>([]);
  const [perms, setPerms] = useState<Record<string, string[]>>({});
  const [draft, setDraft] = useState<Record<string, string[] | null>>({});
  const [msg, setMsg] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/admin/tab-permissions")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data) => {
        setAdmins(data.admins ?? []);
        setPerms(data.tabPermissions ?? {});
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  if (!loaded) return null;

  const effective = (name: string): string[] | null =>
    name in draft ? draft[name] : (perms[name] ?? null);

  function toggle(name: string, tab: string) {
    const cur = effective(name) ?? [...tabIds];
    const next = cur.includes(tab) ? cur.filter((t) => t !== tab) : [...cur, tab];
    setDraft((d) => ({ ...d, [name]: next }));
  }

  async function save(name: string, tabs: string[] | null) {
    const res = await fetch("/api/admin/tab-permissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: name, tabs }),
    });
    if (res.ok) {
      const data = await res.json();
      setPerms(data.tabPermissions ?? {});
      setDraft((d) => {
        const { [name]: _drop, ...rest } = d;
        return rest;
      });
      setMsg((m) => ({ ...m, [name]: L.saved }));
    } else {
      setMsg((m) => ({ ...m, [name]: L.error }));
    }
  }

  return (
    <div className="card p-6">
      <h2 className="font-semibold">{L.title}</h2>
      <p className="mt-1 text-sm text-ink-soft">{L.note}</p>
      <div className="mt-4 space-y-5">
        {admins.map((name) => {
          const cur = effective(name);
          const restricted = cur !== null;
          return (
            <div key={name} className="rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold">{name === "admin" ? L.primary : name}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${restricted ? "bg-black/10" : "bg-black/5 text-ink-soft"}`}>
                  {restricted ? L.restricted : L.allTabs}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                {tabIds.map((tab) => (
                  <label key={tab} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={cur === null ? true : cur.includes(tab)}
                      onChange={() => toggle(name, tab)}
                    />
                    {tab}
                  </label>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button onClick={() => save(name, effective(name) ?? [...tabIds])} className="btn-primary px-3 py-1.5 text-xs">
                  {L.save}
                </button>
                {restricted && (
                  <button onClick={() => save(name, null)} className="btn-secondary px-3 py-1.5 text-xs">
                    {L.clear}
                  </button>
                )}
                {msg[name] && <span className="text-xs text-ink-soft">{msg[name]}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
